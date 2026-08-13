import { Alert, Button, Flex, Form, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { consultationsApi } from '../api/endpoints';
import type { ConsultationStatus, ConsultationView, Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { AiDisclaimer, PageShell } from '../components/Layout';
import { MomoPayFields, type MomoPayValues } from '../components/MomoPayFields';
import {
  BackLink,
  Badge,
  Card,
  ConsultationBadge,
  ErrorNotice,
  formatDate,
  formatDateTime,
  formatGhs,
  Loading,
  UrgencyBadge,
} from '../components/ui';
import { messageFor, useAsync } from '../hooks/useAsync';
import { usePendingPayment } from '../hooks/usePendingPayment';

const { Title, Paragraph, Text } = Typography;

/**
 * Mirrors the transitions the API will accept (FR-014).
 *
 * Duplicating the rule on the client is a UX decision, not a security one — the
 * server refuses anything invalid regardless. Showing only the buttons that will
 * work avoids offering an action that is guaranteed to fail.
 */
const ACTIONS: Record<
  Role,
  Partial<Record<ConsultationStatus, Array<{ status: ConsultationStatus; label: string }>>>
> = {
  USER: {
    AWAITING_PAYMENT: [{ status: 'CANCELLED', label: 'Cancel request' }],
    PENDING: [{ status: 'CANCELLED', label: 'Cancel request' }],
    ACCEPTED: [{ status: 'CANCELLED', label: 'Cancel request' }],
  },
  LAWYER: {
    PENDING: [
      { status: 'ACCEPTED', label: 'Accept request' },
      { status: 'DECLINED', label: 'Decline' },
    ],
    ACCEPTED: [{ status: 'COMPLETED', label: 'Mark as completed' }],
  },
  ADMIN: {},
};

function StatusExplanation({
  request,
  asLawyer,
}: {
  request: ConsultationView;
  asLawyer: boolean;
}) {
  const text: Record<ConsultationStatus, string> = {
    AWAITING_PAYMENT: asLawyer
      ? 'This booking is waiting for the client to pay.'
      : 'Approve the mobile money prompt on your phone to send this request to the lawyer.',
    PENDING: asLawyer
      ? 'This enquiry is waiting for your response.'
      : 'Your request has been sent. The lawyer will accept or decline it.',
    ACCEPTED: asLawyer
      ? 'You accepted this enquiry. Contact details are shown below so you can reach the client. The Google Meet link is on this page.'
      : 'The lawyer accepted. Add the time to Google Calendar and join with Google Meet when the call starts.',
    DECLINED: asLawyer
      ? 'You declined this enquiry.'
      : 'This lawyer declined. That is not a judgement on your situation — you can send the same enquiry to someone else.',
    COMPLETED: 'This consultation has been marked as completed.',
    CANCELLED: 'This request was cancelled.',
  };

  return <Alert type="info" showIcon message={text[request.status]} role="status" />;
}

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const asLawyer = user?.role === 'LAWYER';

  const request = useAsync(
    () => consultationsApi.get(id ?? ''),
    [id],
    'Could not load this request.',
  );

  const [pendingStatus, setPendingStatus] = useState<ConsultationStatus | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [meetForm] = Form.useForm<{ meetUrl: string }>();
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paymentHint, setPaymentHint] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payForm] = Form.useForm<MomoPayValues>();

  async function payNow(values: MomoPayValues) {
    setActionError(null);
    setPaying(true);
    try {
      const payment = await consultationsApi.pay(id ?? '', {
        phone: values.phone,
        network: values.network,
      });
      if (payment.authorizationUrl) {
        window.location.assign(payment.authorizationUrl);
        return;
      }
      setPaymentHint(payment.paymentHint);
      request.refresh();
    } catch (err) {
      setActionError(messageFor(err, 'Could not start payment.'));
    } finally {
      setPaying(false);
    }
  }

  async function confirmPaid() {
    const reference = request.status === 'ready' ? request.data.paymentReference : null;
    if (!reference) {
      setActionError('Start payment first, then approve the prompt on your phone.');
      return;
    }
    setActionError(null);
    setConfirming(true);
    try {
      await consultationsApi.verifyPayment(reference);
      setPaymentHint(null);
      request.refresh();
    } catch (err) {
      setActionError(messageFor(err, 'Payment has not been confirmed yet.'));
    } finally {
      setConfirming(false);
    }
  }

  const awaitingPay =
    !asLawyer && request.status === 'ready' && request.data.status === 'AWAITING_PAYMENT';
  const payReference = request.status === 'ready' ? request.data.paymentReference : null;

  usePendingPayment(Boolean(awaitingPay && payReference), async () => {
    if (!payReference) return false;
    try {
      await consultationsApi.verifyPayment(payReference);
      setPaymentHint(null);
      request.refresh();
      return true;
    } catch {
      return false;
    }
  });

  async function act(status: ConsultationStatus, extra: { meetUrl?: string } = {}) {
    setActionError(null);
    setPendingStatus(status);
    try {
      await consultationsApi.setStatus(id ?? '', status, extra);
      setAccepting(false);
      meetForm.resetFields();
      request.refresh();
    } catch (err) {
      setActionError(messageFor(err, 'Could not update this request.'));
    } finally {
      setPendingStatus(null);
    }
  }

  if (request.status === 'loading') {
    return (
      <PageShell>
        <main className="lc-page lc-page--medium">
          <Loading label="Loading request…" />
        </main>
      </PageShell>
    );
  }

  if (request.status === 'error') {
    return (
      <PageShell>
        <main className="lc-page lc-page--medium">
          <ErrorNotice message={request.message} />
        </main>
      </PageShell>
    );
  }

  const data = request.data;
  const actions = user ? (ACTIONS[user.role][data.status] ?? []) : [];

  return (
    <PageShell showDisclaimer>
      <main className="lc-page lc-page--medium">
        <BackLink to="/app/requests">Back to requests</BackLink>

        <Space direction="vertical" size={24} style={{ width: '100%', marginTop: 24 }}>
          <header>
            <Space wrap size={12} align="center">
              <Title level={1} className="lc-display" style={{ margin: 0 }}>
                {asLawyer ? data.client.fullName : data.lawyerProfile.displayName}
              </Title>
              <ConsultationBadge status={data.status} />
            </Space>
            <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
              Sent {formatDate(data.createdAt)}
            </Paragraph>
          </header>

          <StatusExplanation request={data} asLawyer={asLawyer} />

          {!asLawyer ? (
            <Card>
              <Text type="secondary">Consultation fee</Text>
              <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                <Text strong>{formatGhs(data.feePesewas)}</Text>
                {data.status === 'AWAITING_PAYMENT'
                  ? ' — pay by mobile money to send this to the lawyer'
                  : ' — paid'}
              </Paragraph>
            </Card>
          ) : (
            <Card>
              <Text type="secondary">Consultation fee paid</Text>
              <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                <Text strong>{formatGhs(data.feePesewas)}</Text>
              </Paragraph>
            </Card>
          )}

          {actionError ? <ErrorNotice message={actionError} /> : null}

          <Card>
            <Text type="secondary">Video consultation</Text>
            <Paragraph style={{ marginTop: 8, marginBottom: 8 }}>
              <Text strong>{formatDateTime(data.scheduledAt)}</Text>
              {` · ${data.durationMinutes} minutes (Ghana time)`}
            </Paragraph>
            <Space wrap>
              <Button href={data.googleCalendarUrl} target="_blank" rel="noreferrer">
                Add to Google Calendar
              </Button>
              {data.meetUrl && data.status === 'ACCEPTED' ? (
                <Button type="primary" href={data.meetUrl} target="_blank" rel="noreferrer">
                  Join Google Meet
                </Button>
              ) : null}
            </Space>
            {data.status !== 'ACCEPTED' && !asLawyer ? (
              <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                The Google Meet link appears here after the lawyer accepts.
              </Paragraph>
            ) : null}
          </Card>

          {data.status === 'AWAITING_PAYMENT' && !asLawyer ? (
            <Card>
              {paymentHint || data.paymentReference ? (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={
                    paymentHint ??
                    'Approve the mobile money prompt on your phone. This page checks every few seconds, or tap the button when you have approved it.'
                  }
                />
              ) : null}
              <Form
                form={payForm}
                layout="vertical"
                initialValues={{ phone: user?.phone ?? undefined }}
                onFinish={(values) => void payNow(values)}
                requiredMark={false}
              >
                <MomoPayFields />
                <Form.Item style={{ marginBottom: 0 }}>
                  <Space wrap>
                    <Button type="primary" htmlType="submit" loading={paying}>
                      {paying
                        ? 'Sending payment prompt…'
                        : data.paymentReference
                          ? 'Send prompt again'
                          : `Pay ${formatGhs(data.feePesewas)}`}
                    </Button>
                    {data.paymentReference ? (
                      <Button loading={confirming} onClick={() => void confirmPaid()}>
                        I have approved the prompt
                      </Button>
                    ) : null}
                  </Space>
                </Form.Item>
              </Form>
            </Card>
          ) : null}

          {accepting ? (
            <Card>
              <Text type="secondary">Accept with Google Meet</Text>
              <Paragraph type="secondary" style={{ marginTop: 8 }}>
                Open Google Meet, start a meeting, copy the invite link, and paste it here so the
                client can join at the booked time.
              </Paragraph>
              <Form
                form={meetForm}
                layout="vertical"
                requiredMark={false}
                onFinish={(values) => void act('ACCEPTED', { meetUrl: values.meetUrl.trim() })}
              >
                <Form.Item
                  label="Google Meet link"
                  name="meetUrl"
                  rules={[
                    { required: true, message: 'Paste the Google Meet link' },
                    {
                      pattern: /^https:\/\/meet\.google\.com\/.+/i,
                      message: 'Use a meet.google.com link',
                    },
                  ]}
                >
                  <Input placeholder="https://meet.google.com/abc-defg-hij" />
                </Form.Item>
                <Space wrap>
                  <Button href="https://meet.google.com/new" target="_blank" rel="noreferrer">
                    Open Google Meet
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={pendingStatus === 'ACCEPTED'}
                  >
                    Accept and share Meet link
                  </Button>
                  <Button onClick={() => setAccepting(false)}>Cancel</Button>
                </Space>
              </Form>
            </Card>
          ) : null}

          {actions.length > 0 && !accepting ? (
            <Space wrap>
              {actions.map((action, index) => (
                <Button
                  key={action.status}
                  type={index === 0 ? 'primary' : 'default'}
                  disabled={pendingStatus !== null}
                  loading={pendingStatus === action.status}
                  onClick={() => {
                    if (action.status === 'ACCEPTED') {
                      setAccepting(true);
                      return;
                    }
                    void act(action.status);
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Space>
          ) : null}

          {/* Contact details are withheld until the lawyer has accepted, so the
              directory cannot be used to harvest phone numbers (NFR-002). */}
          {data.status === 'ACCEPTED' ? (
            <Card>
              <Text type="secondary">Contact</Text>
              <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                {asLawyer ? data.client.fullName : data.lawyerProfile.displayName}
                {asLawyer && data.client.phone ? ` · ${data.client.phone}` : ''}
              </Paragraph>
              {!asLawyer ? (
                <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
                  {data.lawyerProfile.firmName ? `${data.lawyerProfile.firmName}, ` : ''}
                  {data.lawyerProfile.city}, {data.lawyerProfile.region}
                </Paragraph>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <Flex justify="space-between" align="center" gap={12} wrap="wrap">
              <Text type="secondary">The enquiry</Text>
              <Space size={8}>
                <UrgencyBadge urgency={data.intake.urgency} />
                {data.intake.category ? (
                  <Badge tone="info">{data.intake.category.name}</Badge>
                ) : (
                  <Badge tone="warn">Awaiting review</Badge>
                )}
              </Space>
            </Flex>

            <Text
              type="secondary"
              style={{
                display: 'block',
                marginTop: 16,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Summary
            </Text>
            <Paragraph className="lc-prewrap" style={{ marginTop: 4 }}>
              {data.intake.aiSummary ??
                'No summary was generated. Read the original description below.'}
            </Paragraph>

            <Text
              type="secondary"
              style={{
                display: 'block',
                marginTop: 8,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              In their own words
            </Text>
            <Paragraph type="secondary" className="lc-prewrap" style={{ marginTop: 4 }}>
              {data.intake.originalDescription}
            </Paragraph>

            {data.intake.city || data.intake.region ? (
              <Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
                Location: {[data.intake.city, data.intake.region].filter(Boolean).join(', ')}
              </Paragraph>
            ) : null}
          </Card>

          {data.clientMessage ? (
            <Card>
              <Text type="secondary">Note from the client</Text>
              <Paragraph className="lc-prewrap" style={{ marginTop: 8, marginBottom: 0 }}>
                {data.clientMessage}
              </Paragraph>
            </Card>
          ) : null}

          <Card>
            <Text type="secondary">Why this match</Text>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              {data.matchReason}
            </Paragraph>
          </Card>

          <AiDisclaimer />
        </Space>
      </main>
    </PageShell>
  );
}
