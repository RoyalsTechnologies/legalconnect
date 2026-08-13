import { Alert, Button, Flex, Form, Space, Typography } from 'antd';
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
      ? 'You accepted this enquiry. Contact details are shown below so you can reach the client.'
      : 'The lawyer accepted your request and can now contact you.',
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

  async function act(status: ConsultationStatus) {
    setActionError(null);
    setPendingStatus(status);
    try {
      await consultationsApi.setStatus(id ?? '', status);
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

          {actions.length > 0 ? (
            <Space wrap>
              {actions.map((action, index) => (
                <Button
                  key={action.status}
                  type={index === 0 ? 'primary' : 'default'}
                  disabled={pendingStatus !== null}
                  loading={pendingStatus === action.status}
                  onClick={() => void act(action.status)}
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
