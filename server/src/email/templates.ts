import type { OutboundEmail } from './mailer.js';

function wrap(title: string, body: string): { text: string; html: string } {
  const text = `${title}\n\n${body}\n\n— LegalConnect Ghana`;
  const html = `
    <div style="font-family: Manrope, Arial, sans-serif; color: #0c1628; line-height: 1.5; max-width: 560px;">
      <h1 style="font-size: 20px; margin: 0 0 12px;">${title}</h1>
      <p style="margin: 0 0 12px; white-space: pre-wrap;">${body.replace(/\n/g, '<br/>')}</p>
      <p style="margin: 24px 0 0; color: #5c6b82; font-size: 13px;">LegalConnect Ghana — connecting people with legal professionals. This is not legal advice.</p>
    </div>
  `;
  return { text, html };
}

export function verificationEmail(input: {
  to: string;
  fullName: string;
  verifyUrl: string;
}): OutboundEmail {
  const { text, html } = wrap(
    'Confirm your email',
    `Hello ${input.fullName},\n\nThanks for creating a LegalConnect Ghana account. Confirm your email by opening this link (valid for 24 hours):\n\n${input.verifyUrl}\n\nIf you did not sign up, you can ignore this message.`,
  );
  return { to: input.to, subject: 'Confirm your LegalConnect Ghana email', text, html };
}

export function passwordResetEmail(input: {
  to: string;
  fullName: string;
  resetUrl: string;
}): OutboundEmail {
  const { text, html } = wrap(
    'Reset your password',
    `Hello ${input.fullName},\n\nWe received a request to reset your password. Open this link within one hour:\n\n${input.resetUrl}\n\nIf you did not ask for a reset, you can ignore this message. Your password will stay the same.`,
  );
  return { to: input.to, subject: 'Reset your LegalConnect Ghana password', text, html };
}

export function consultationNewRequestEmail(input: {
  to: string;
  lawyerName: string;
  clientName: string;
  category: string;
  requestUrl: string;
}): OutboundEmail {
  const { text, html } = wrap(
    'New consultation request',
    `Hello ${input.lawyerName},\n\n${input.clientName} has sent you a consultation request${input.category ? ` about ${input.category}` : ''}.\n\nReview it here:\n${input.requestUrl}`,
  );
  return { to: input.to, subject: 'New consultation request on LegalConnect Ghana', text, html };
}

export function consultationStatusEmail(input: {
  to: string;
  clientName: string;
  lawyerName: string;
  statusLabel: string;
  requestUrl: string;
}): OutboundEmail {
  const { text, html } = wrap(
    `Your request was ${input.statusLabel.toLowerCase()}`,
    `Hello ${input.clientName},\n\n${input.lawyerName} has ${input.statusLabel.toLowerCase()} your consultation request.\n\nSee the details:\n${input.requestUrl}`,
  );
  return {
    to: input.to,
    subject: `Consultation ${input.statusLabel.toLowerCase()} — LegalConnect Ghana`,
    text,
    html,
  };
}

export function lawyerWelcomeEmail(input: {
  to: string;
  fullName: string;
  temporaryPassword: string;
  loginUrl: string;
}): OutboundEmail {
  const { text, html } = wrap(
    'Your lawyer account is ready',
    `Hello ${input.fullName},\n\nAn administrator has created your LegalConnect Ghana account.\n\nSign in at: ${input.loginUrl}\nEmail: ${input.to}\nTemporary password: ${input.temporaryPassword}\n\nPlease sign in and change your password as soon as you can. Do not share this message.`,
  );
  return { to: input.to, subject: 'Your LegalConnect Ghana lawyer account', text, html };
}

export function lawyerApprovedEmail(input: {
  to: string;
  fullName: string;
  profileUrl: string;
}): OutboundEmail {
  const { text, html } = wrap(
    'Your profile is now public',
    `Hello ${input.fullName},\n\nAn administrator has approved your LegalConnect Ghana profile. Citizens can now find you in the directory and send consultation requests.\n\nReview your profile:\n${input.profileUrl}`,
  );
  return { to: input.to, subject: 'Your LegalConnect Ghana profile was approved', text, html };
}

export function lawyerRejectedEmail(input: {
  to: string;
  fullName: string;
  profileUrl: string;
}): OutboundEmail {
  const { text, html } = wrap(
    'Your profile was not approved',
    `Hello ${input.fullName},\n\nAn administrator reviewed your LegalConnect Ghana application and did not approve it for the public directory. You can still sign in and update your profile if you believe something was incomplete.\n\nYour profile:\n${input.profileUrl}`,
  );
  return { to: input.to, subject: 'Your LegalConnect Ghana profile was not approved', text, html };
}
