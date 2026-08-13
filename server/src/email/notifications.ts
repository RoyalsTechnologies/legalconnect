import type { ApprovalStatus, ConsultationStatus } from '@prisma/client';
import { sendSms } from '../sms/sms-client.js';
import { consultationNewRequestSms, consultationStatusSms } from '../sms/sms-messages.js';
import { appUrl, sendEmail } from './mailer.js';
import {
  consultationNewRequestEmail,
  consultationStatusEmail,
  lawyerApprovedEmail,
  lawyerRejectedEmail,
  lawyerWelcomeEmail,
} from './templates.js';

/** Fire-and-forget: never throws to the caller. */
function notify(task: Promise<unknown>): void {
  void task.catch((error: unknown) => {
    console.error('[notify] alert failed', error);
  });
}

export function notifyLawyerOfNewRequest(input: {
  lawyerEmail: string;
  lawyerPhone?: string | null;
  lawyerName: string;
  clientName: string;
  category: string | null;
  consultationId: string;
}): void {
  notify(
    sendEmail(
      consultationNewRequestEmail({
        to: input.lawyerEmail,
        lawyerName: input.lawyerName,
        clientName: input.clientName,
        category: input.category ?? '',
        requestUrl: appUrl(`/app/requests/${input.consultationId}`),
      }),
      false,
    ),
  );

  notify(
    sendSms(
      input.lawyerPhone,
      consultationNewRequestSms({
        lawyerName: input.lawyerName,
        clientName: input.clientName,
        category: input.category,
      }),
    ),
  );
}

const STATUS_LABEL: Partial<Record<ConsultationStatus, string>> = {
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

export function notifyClientOfStatusChange(input: {
  clientEmail: string;
  clientPhone?: string | null;
  clientName: string;
  lawyerName: string;
  status: ConsultationStatus;
  consultationId: string;
}): void {
  const statusLabel = STATUS_LABEL[input.status];
  if (!statusLabel) return;

  notify(
    sendEmail(
      consultationStatusEmail({
        to: input.clientEmail,
        clientName: input.clientName,
        lawyerName: input.lawyerName,
        statusLabel,
        requestUrl: appUrl(`/app/requests/${input.consultationId}`),
      }),
      false,
    ),
  );

  const smsBody = consultationStatusSms({
    clientName: input.clientName,
    lawyerName: input.lawyerName,
    status: input.status,
  });
  if (smsBody) {
    notify(sendSms(input.clientPhone, smsBody));
  }
}

export function notifyLawyerWelcome(input: {
  email: string;
  fullName: string;
  temporaryPassword: string;
}): void {
  notify(
    sendEmail(
      lawyerWelcomeEmail({
        to: input.email,
        fullName: input.fullName,
        temporaryPassword: input.temporaryPassword,
        loginUrl: appUrl('/login'),
      }),
      false,
    ),
  );
}

export function notifyLawyerApprovalDecision(input: {
  email: string;
  fullName: string;
  approvalStatus: ApprovalStatus;
}): void {
  if (input.approvalStatus === 'APPROVED') {
    notify(
      sendEmail(
        lawyerApprovedEmail({
          to: input.email,
          fullName: input.fullName,
          profileUrl: appUrl('/app/profile'),
        }),
        false,
      ),
    );
    return;
  }

  if (input.approvalStatus === 'REJECTED') {
    notify(
      sendEmail(
        lawyerRejectedEmail({
          to: input.email,
          fullName: input.fullName,
          profileUrl: appUrl('/app/profile'),
        }),
        false,
      ),
    );
  }
}
