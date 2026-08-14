import { ConsultationStatus, Prisma, Role } from '@prisma/client';
import { appUrl } from '../../email/mailer.js';
import { notifyClientOfStatusChange, notifyLawyerOfNewRequest } from '../../email/notifications.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import {
  CONSULTATION_DURATION_MINUTES,
  googleCalendarTemplateUrl,
} from '../../lib/google-calendar.js';
import { log } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import {
  inferMomoNetwork,
  isPaidStatus,
  newPaymentReference,
  pesewasFromAmount,
  startPayment,
  verifyPayment,
} from '../../payments/nalopay.js';
import { publicLawyerWhere } from '../lawyers/eligibility.js';
import { rememberPhone } from '../users/users.service.js';
import { creditConsultationFee, refundHeldFee } from '../wallet/wallet.service.js';
import type {
  CreateConsultationInput,
  StartPaymentInput,
  UpdateConsultationInput,
} from './consultations.schema.js';

/**
 * Allowed status transitions, by who is asking.
 *
 * Encoded as data rather than nested conditionals so the whole workflow can be read
 * at a glance and tested exhaustively. Anything not listed is refused, which means a
 * new status cannot accidentally become reachable by omission.
 */
const TRANSITIONS: Record<Role, Partial<Record<ConsultationStatus, ConsultationStatus[]>>> = {
  [Role.USER]: {
    [ConsultationStatus.AWAITING_PAYMENT]: [ConsultationStatus.CANCELLED],
    [ConsultationStatus.PENDING]: [ConsultationStatus.CANCELLED],
    [ConsultationStatus.ACCEPTED]: [ConsultationStatus.CANCELLED],
  },
  [Role.LAWYER]: {
    [ConsultationStatus.PENDING]: [ConsultationStatus.ACCEPTED, ConsultationStatus.DECLINED],
  },
  [Role.ADMIN]: {},
};

const consultationFields = {
  id: true,
  status: true,
  clientMessage: true,
  matchReason: true,
  feePesewas: true,
  paymentReference: true,
  scheduledAt: true,
  meetUrl: true,
  clientConfirmedAt: true,
  lawyerConfirmedAt: true,
  createdAt: true,
  updatedAt: true,
  intake: {
    select: {
      id: true,
      originalDescription: true,
      aiSummary: true,
      urgency: true,
      keywords: true,
      needsHumanReview: true,
      aiStatus: true,
      city: true,
      region: true,
      category: { select: { id: true, name: true } },
    },
  },
  client: { select: { id: true, fullName: true, phone: true } },
  lawyerProfile: {
    select: { id: true, displayName: true, firmName: true, city: true, region: true },
  },
} satisfies Prisma.ConsultationRequestSelect;

export type ConsultationRecord = Prisma.ConsultationRequestGetPayload<{
  select: typeof consultationFields;
}>;

export type ConsultationView = ConsultationRecord & {
  durationMinutes: number;
  googleCalendarUrl: string;
};

export type PaymentStartView = {
  consultation: ConsultationView;
  authorizationUrl: string | null;
  paymentHint: string | null;
};

function present(row: ConsultationRecord): ConsultationView {
  const details = [
    `LegalConnect Ghana consultation (${CONSULTATION_DURATION_MINUTES} minutes).`,
    'This is not legal advice.',
    row.meetUrl
      ? `Join with Google Meet: ${row.meetUrl}`
      : 'A Google Meet link is added when the lawyer accepts.',
    `Request: ${appUrl(`/app/requests/${row.id}`)}`,
  ].join('\n\n');

  return {
    ...row,
    durationMinutes: CONSULTATION_DURATION_MINUTES,
    googleCalendarUrl: googleCalendarTemplateUrl({
      title: `Consultation: ${row.client.fullName} and ${row.lawyerProfile.displayName}`,
      start: row.scheduledAt,
      details,
      location: row.meetUrl ?? 'Google Meet',
    }),
  };
}

/**
 * Creates a consultation request. It stays AWAITING_PAYMENT until the client pays
 * this lawyer's fee — the lawyer is not notified, and cannot see it, until then.
 */
export async function createConsultation(
  clientId: string,
  input: CreateConsultationInput,
): Promise<ConsultationView> {
  const intake = await prisma.legalIntake.findFirst({
    where: { id: input.intakeId, clientId },
    select: { id: true, category: { select: { id: true, name: true } } },
  });

  if (!intake) throw notFound('Intake not found');

  const lawyer = await prisma.lawyerProfile.findFirst({
    where: {
      id: input.lawyerProfileId,
      ...publicLawyerWhere(),
    },
    select: {
      id: true,
      displayName: true,
      region: true,
      city: true,
      isAvailable: true,
      consultationFeePesewas: true,
      practiceAreas: { select: { legalCategoryId: true } },
    },
  });

  if (!lawyer) throw notFound('Lawyer not found');

  if (lawyer.consultationFeePesewas < 100) {
    throw badRequest('This lawyer has not set a consultation fee yet');
  }

  const matchesCategory =
    intake.category !== null &&
    lawyer.practiceAreas.some((area) => area.legalCategoryId === intake.category?.id);

  const matchReason = matchesCategory
    ? `Recommended because ${lawyer.displayName} lists ${intake.category?.name} as a practice area.`
    : `Chosen by the client from the lawyer directory rather than from a recommendation.`;

  try {
    const created = await prisma.consultationRequest.create({
      data: {
        intakeId: intake.id,
        clientId,
        lawyerProfileId: lawyer.id,
        clientMessage: input.message ?? null,
        matchReason,
        feePesewas: lawyer.consultationFeePesewas,
        scheduledAt: input.scheduledAt,
        status: ConsultationStatus.AWAITING_PAYMENT,
      },
      select: consultationFields,
    });
    return present(created);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('You have already sent this enquiry to that lawyer');
    }
    throw error;
  }
}

export async function startConsultationPayment(
  clientId: string,
  consultationId: string,
  input: StartPaymentInput = {},
): Promise<PaymentStartView> {
  const consultation = await prisma.consultationRequest.findFirst({
    where: { id: consultationId, clientId },
    select: {
      ...consultationFields,
      client: { select: { id: true, fullName: true, phone: true, email: true } },
    },
  });

  if (!consultation) throw notFound('Consultation request not found');

  if (consultation.status !== ConsultationStatus.AWAITING_PAYMENT) {
    return {
      consultation: present(stripClientEmail(consultation)),
      authorizationUrl: null,
      paymentHint: null,
    };
  }

  const phone = input.phone ?? consultation.client.phone;
  const network = input.network ?? (phone ? (inferMomoNetwork(phone) ?? undefined) : undefined);
  if (!phone) {
    throw badRequest(
      'Enter the mobile money number you will pay from. You can also add a phone number to your account.',
    );
  }

  const reference = newPaymentReference(consultation.id);
  const started = await startPayment({
    accountName: consultation.client.fullName,
    phone: phone ?? '',
    network,
    amountPesewas: consultation.feePesewas,
    reference,
    description: `LegalConnect consultation ${consultation.id}`,
  });

  await rememberPhone(clientId, input.phone ?? phone);

  await prisma.consultationRequest.update({
    where: { id: consultation.id },
    data: {
      paymentReference: started.reference,
      paymentOrderId: started.orderId,
      payerPhone: phone,
      payerNetwork: network ?? inferMomoNetwork(phone),
    },
  });

  if (started.captured) {
    const paid = await markPaid(consultation.id);
    return { consultation: paid, authorizationUrl: null, paymentHint: null };
  }

  const pending = await prisma.consultationRequest.findFirstOrThrow({
    where: { id: consultation.id },
    select: consultationFields,
  });
  return {
    consultation: present(pending),
    authorizationUrl: started.authorizationUrl,
    paymentHint: started.paymentHint,
  };
}

export async function confirmConsultationPayment(
  clientId: string,
  reference: string,
): Promise<ConsultationView> {
  const consultation = await prisma.consultationRequest.findFirst({
    where: { paymentReference: reference, clientId },
    select: {
      id: true,
      status: true,
      feePesewas: true,
      paymentReference: true,
      paymentOrderId: true,
    },
  });

  if (!consultation) throw notFound('Payment not found');

  if (consultation.status !== ConsultationStatus.AWAITING_PAYMENT) {
    return getConsultation(consultation.id, clientId, Role.USER);
  }

  const ok = await verifyPayment({
    reference,
    expectedPesewas: consultation.feePesewas,
    orderId: consultation.paymentOrderId,
  });
  if (!ok) {
    throw badRequest(
      'Payment has not been confirmed yet. Approve the prompt on your phone, then try again.',
    );
  }

  return markPaid(consultation.id);
}

export async function capturePaidCallback(payload: {
  order_id?: string;
  status?: string;
  amount?: string | number;
  reference?: string;
}): Promise<boolean> {
  if (!isPaidStatus(payload.status)) return false;

  const reference = payload.reference;
  const orderId = payload.order_id;
  if (!reference && !orderId) return false;

  const consultation = await prisma.consultationRequest.findFirst({
    where: {
      OR: [
        ...(reference ? [{ paymentReference: reference }] : []),
        ...(orderId ? [{ paymentOrderId: orderId }] : []),
      ],
    },
    select: { id: true, status: true, feePesewas: true },
  });

  if (!consultation) return false;

  if (consultation.status !== ConsultationStatus.AWAITING_PAYMENT) return true;

  const paidPesewas = pesewasFromAmount(payload.amount ?? NaN);
  if (paidPesewas !== consultation.feePesewas) {
    log.payment.error('callback amount mismatch', { consultationId: consultation.id });
    return true;
  }

  await markPaid(consultation.id);
  return true;
}

async function markPaid(consultationId: string): Promise<ConsultationView> {
  // Only the winner of a webhook/poll race may notify the lawyer.
  const claimed = await prisma.consultationRequest.updateMany({
    where: { id: consultationId, status: ConsultationStatus.AWAITING_PAYMENT },
    data: { status: ConsultationStatus.PENDING },
  });

  const paid = await prisma.consultationRequest.findFirstOrThrow({
    where: { id: consultationId },
    select: {
      ...consultationFields,
      lawyerProfile: {
        select: {
          id: true,
          displayName: true,
          firmName: true,
          city: true,
          region: true,
          user: { select: { email: true, phone: true } },
        },
      },
    },
  });

  if (claimed.count === 1) {
    notifyLawyerOfNewRequest({
      lawyerEmail: paid.lawyerProfile.user.email,
      lawyerPhone: paid.lawyerProfile.user.phone,
      lawyerName: paid.lawyerProfile.displayName,
      clientName: paid.client.fullName,
      category: paid.intake.category?.name ?? null,
      consultationId: paid.id,
      scheduledAt: paid.scheduledAt,
    });
  }

  const { lawyerProfile, ...rest } = paid;
  return present({
    ...rest,
    lawyerProfile: {
      id: lawyerProfile.id,
      displayName: lawyerProfile.displayName,
      firmName: lawyerProfile.firmName,
      city: lawyerProfile.city,
      region: lawyerProfile.region,
    },
  });
}

function stripClientEmail(
  consultation: ConsultationRecord & { client: ConsultationRecord['client'] & { email?: string } },
): ConsultationRecord {
  const { client, ...rest } = consultation;
  return {
    ...rest,
    client: { id: client.id, fullName: client.fullName, phone: client.phone },
  };
}

/** Restricts every query to what the caller is entitled to see. */
async function scopeFor(userId: string, role: Role): Promise<Prisma.ConsultationRequestWhereInput> {
  if (role === Role.ADMIN) return {};
  if (role === Role.USER) return { clientId: userId };

  const profile = await prisma.lawyerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  // Unpaid bookings are invisible to the lawyer — they are not a request yet.
  return {
    lawyerProfileId: profile?.id ?? '__no_profile__',
    status: { not: ConsultationStatus.AWAITING_PAYMENT },
  };
}

export async function listConsultations(
  userId: string,
  role: Role,
  status?: ConsultationStatus,
): Promise<ConsultationView[]> {
  if (role === Role.LAWYER && status === ConsultationStatus.AWAITING_PAYMENT) {
    return [];
  }

  const rows = await prisma.consultationRequest.findMany({
    where: { ...(await scopeFor(userId, role)), ...(status ? { status } : {}) },
    select: consultationFields,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(present);
}

export async function getConsultation(
  id: string,
  userId: string,
  role: Role,
): Promise<ConsultationView> {
  const consultation = await prisma.consultationRequest.findFirst({
    where: { id, ...(await scopeFor(userId, role)) },
    select: consultationFields,
  });

  if (!consultation) throw notFound('Consultation request not found');
  return present(consultation);
}

/**
 * Moves a request to a new status.
 *
 * Two separate checks: the caller must be a party to this request, and the transition
 * must be one their role can make from the current status. Being the right person is
 * not enough — a client cannot complete a consultation, and a lawyer cannot cancel one.
 */
export async function updateConsultationStatus(
  id: string,
  userId: string,
  role: Role,
  input: UpdateConsultationInput,
): Promise<ConsultationView> {
  const next = input.status;
  const existing = await prisma.consultationRequest.findFirst({
    where: { id, ...(await scopeFor(userId, role)) },
    select: { id: true, status: true, settledAt: true },
  });

  if (!existing) throw notFound('Consultation request not found');

  const allowed = TRANSITIONS[role][existing.status] ?? [];

  if (!allowed.includes(next)) {
    const roleCanEver = Object.values(TRANSITIONS[role]).some((targets) => targets.includes(next));

    if (!roleCanEver) throw forbidden(`Your role cannot set a request to ${next}`);
    throw badRequest(`A ${existing.status.toLowerCase()} request cannot become ${next}`);
  }

  const paidHold =
    existing.status === ConsultationStatus.PENDING ||
    existing.status === ConsultationStatus.ACCEPTED;
  if (paidHold && (next === ConsultationStatus.CANCELLED || next === ConsultationStatus.DECLINED)) {
    const refunded = await refundHeldFee(id);
    if (!refunded) {
      throw badRequest('This consultation is already settled and cannot be cancelled or declined.');
    }
  }

  const moved = await prisma.consultationRequest.updateMany({
    where: { id, status: existing.status },
    data: {
      status: next,
      ...(next === ConsultationStatus.ACCEPTED && input.meetUrl ? { meetUrl: input.meetUrl } : {}),
    },
  });
  if (moved.count === 0) {
    throw conflict('This request was already updated');
  }

  const updated = await prisma.consultationRequest.findFirstOrThrow({
    where: { id },
    select: {
      ...consultationFields,
      client: { select: { id: true, fullName: true, phone: true, email: true } },
    },
  });

  const view = present(stripClientEmail(updated));

  notifyClientOfStatusChange({
    clientEmail: updated.client.email,
    clientPhone: updated.client.phone,
    clientName: updated.client.fullName,
    lawyerName: updated.lawyerProfile.displayName,
    status: updated.status,
    consultationId: updated.id,
    scheduledAt: view.scheduledAt,
    meetUrl: view.meetUrl,
    googleCalendarUrl: view.googleCalendarUrl,
  });

  return view;
}

/**
 * Client or lawyer confirms the consultation happened (FR-021). The fee stays held
 * until both have confirmed; the second confirm credits the lawyer wallet.
 */
export async function confirmConsultation(
  id: string,
  userId: string,
  role: Role,
): Promise<ConsultationView> {
  if (role !== Role.USER && role !== Role.LAWYER) {
    throw forbidden('Only the client and the lawyer can confirm this consultation');
  }

  const existing = await prisma.consultationRequest.findFirst({
    where: { id, ...(await scopeFor(userId, role)) },
    select: {
      id: true,
      status: true,
      feePesewas: true,
      lawyerProfileId: true,
      clientConfirmedAt: true,
      lawyerConfirmedAt: true,
      settledAt: true,
    },
  });
  if (!existing) throw notFound('Consultation request not found');

  if (
    existing.status !== ConsultationStatus.ACCEPTED &&
    existing.status !== ConsultationStatus.COMPLETED
  ) {
    throw badRequest('Confirm after the lawyer has accepted and you have met.');
  }

  const field = role === Role.USER ? 'clientConfirmedAt' : 'lawyerConfirmedAt';
  if (!existing[field]) {
    await prisma.consultationRequest.update({
      where: { id },
      data: { [field]: new Date() },
    });
  }

  const current = await prisma.consultationRequest.findFirstOrThrow({
    where: { id },
    select: {
      clientConfirmedAt: true,
      lawyerConfirmedAt: true,
      settledAt: true,
      feePesewas: true,
      lawyerProfileId: true,
    },
  });

  if (current.clientConfirmedAt && current.lawyerConfirmedAt && !current.settledAt) {
    await creditConsultationFee(id, current.lawyerProfileId, current.feePesewas);
  }

  return getConsultation(id, userId, role);
}
