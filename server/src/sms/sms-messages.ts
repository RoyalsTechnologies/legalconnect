import type { ConsultationStatus } from '@prisma/client';

const STATUS_LABEL: Partial<Record<ConsultationStatus, string>> = {
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
};

/** Short plain-text bodies suitable for a single SMS segment. */
export function consultationNewRequestSms(input: {
  lawyerName: string;
  clientName: string;
  category: string | null;
}): string {
  const category = input.category ? ` (${input.category})` : '';
  return `LegalConnect: New consultation request from ${input.clientName}${category}. Open Requests in the app to review.`;
}

export function consultationStatusSms(input: {
  clientName: string;
  lawyerName: string;
  status: ConsultationStatus;
}): string | null {
  const label = STATUS_LABEL[input.status];
  if (!label) return null;
  return `LegalConnect: ${input.lawyerName} has ${label} your consultation request. Check My requests in the app for details.`;
}
