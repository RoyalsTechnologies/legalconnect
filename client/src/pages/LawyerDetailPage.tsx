import { Button, Card, Col, Form, Input, Row, Select, Space, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { consultationsApi, intakesApi, lawyersApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { AiDisclaimer, PageShell } from '../components/Layout';
import { MomoPayFields, type MomoPayValues } from '../components/MomoPayFields';
import { Badge, ErrorNotice, formatGhs, Loading } from '../components/ui';
import { messageFor, useAsync } from '../hooks/useAsync';

const { Title, Paragraph, Text } = Typography;

/**
 * Lets a citizen attach one of their existing enquiries to this lawyer (FR-013).
 *
 * A consultation always references an intake — there is no "just message a lawyer"
 * path — because the structured summary is the thing that makes the request useful to
 * the person receiving it.
 */
function RequestForm({
  lawyerProfileId,
  feePesewas,
}: {
  lawyerProfileId: string;
  feePesewas: number;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const intakes = useAsync(() => intakesApi.list(), [], 'Could not load your enquiries.');
  const [form] = Form.useForm<{ intakeId: string; message?: string } & MomoPayValues>();
  const intakeId = Form.useWatch('intakeId', form);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (intakes.status === 'loading') return <Loading label="Loading your enquiries…" />;
  if (intakes.status === 'error') return <ErrorNotice message={intakes.message} />;

  if (intakes.data.length === 0) {
    return (
      <Card>
        <Title level={4} className="lc-display" style={{ marginTop: 0 }}>
          Describe your issue first
        </Title>
        <Paragraph type="secondary">
          A consultation request carries a summary of your situation, so start by telling us what
          happened. It only takes a few sentences.
        </Paragraph>
        <Button type="primary" onClick={() => void navigate('/app/intake')}>
          Describe your issue
        </Button>
      </Card>
    );
  }

  async function onFinish(values: { intakeId: string; message?: string } & MomoPayValues) {
    setError(null);
    setSubmitting(true);

    try {
      const created = await consultationsApi.create({
        intakeId: values.intakeId,
        lawyerProfileId,
        message: values.message?.trim() || undefined,
      });
      const payment = await consultationsApi.pay(created.id, {
        phone: values.phone,
        network: values.network,
      });
      if (payment.authorizationUrl) {
        window.location.assign(payment.authorizationUrl);
        return;
      }
      void navigate(`/app/requests/${payment.consultation.id}`);
    } catch (err) {
      setError(messageFor(err, 'Could not send your request.'));
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <Title level={4} className="lc-display" style={{ marginTop: 0 }}>
        Send a consultation request
      </Title>
      <Paragraph type="secondary">
        You pay this lawyer's consultation fee ({formatGhs(feePesewas)}) by mobile money to send the
        request. Approve the prompt on your phone. The lawyer sees it only after payment.
      </Paragraph>

      <Form
        form={form}
        layout="vertical"
        initialValues={{ phone: user?.phone ?? undefined }}
        onFinish={(values) => void onFinish(values)}
        style={{ marginTop: 8 }}
        requiredMark={false}
      >
        <Form.Item
          label="Which enquiry is this about?"
          name="intakeId"
          rules={[{ required: true, message: 'Choose an enquiry' }]}
        >
          <Select
            placeholder="Choose an enquiry…"
            options={intakes.data.map((intake) => ({
              value: intake.id,
              label: `${intake.category?.name ?? 'Awaiting review'} — ${intake.originalDescription.slice(0, 60)}…`,
            }))}
          />
        </Form.Item>

        <Form.Item
          label="Anything to add? (optional)"
          name="message"
          extra="A short note about your availability or what you need most."
        >
          <Input.TextArea rows={3} maxLength={1000} />
        </Form.Item>

        <MomoPayFields />

        {error ? <ErrorNotice message={error} /> : null}

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={submitting} disabled={!intakeId}>
            {submitting ? 'Sending payment prompt…' : `Book and pay ${formatGhs(feePesewas)}`}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

export function LawyerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, state } = useAuth();
  const lawyer = useAsync(() => lawyersApi.get(id ?? ''), [id], 'We could not find that lawyer.');

  return (
    <PageShell showDisclaimer>
      <main className="lc-page lc-page--medium">
        <Button type="link" style={{ paddingInline: 0 }} onClick={() => void navigate('/lawyers')}>
          ← Back to directory
        </Button>

        {lawyer.status === 'loading' ? (
          <Loading label="Loading profile…" />
        ) : lawyer.status === 'error' ? (
          <div style={{ marginTop: 32 }}>
            <ErrorNotice message={lawyer.message} />
          </div>
        ) : (
          <Space direction="vertical" size={24} style={{ width: '100%', marginTop: 24 }}>
            <header>
              <Space wrap size={12} align="center">
                <Title level={1} className="lc-display" style={{ margin: 0 }}>
                  {lawyer.data.displayName}
                </Title>
                <Badge tone={lawyer.data.isAvailable ? 'success' : 'neutral'}>
                  {lawyer.data.isAvailable ? 'Accepting enquiries' : 'Not accepting'}
                </Badge>
              </Space>
              <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
                {lawyer.data.firmName ? `${lawyer.data.firmName} · ` : ''}
                {lawyer.data.city}, {lawyer.data.region}
              </Paragraph>
            </header>

            <Card>
              <Text type="secondary">About</Text>
              <Paragraph className="lc-prewrap" style={{ marginTop: 8 }}>
                {lawyer.data.bio}
              </Paragraph>

              <Row
                gutter={[16, 16]}
                style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid #d7deea' }}
              >
                {lawyer.data.yearsExperience !== null ? (
                  <Col xs={24} sm={12}>
                    <Text type="secondary">Years in practice</Text>
                    <div>
                      <Text strong>{lawyer.data.yearsExperience}</Text>
                    </div>
                  </Col>
                ) : null}
                <Col xs={24} sm={12}>
                  <Text type="secondary">Consultation fee</Text>
                  <div>
                    <Text strong>{formatGhs(lawyer.data.consultationFeePesewas)}</Text>
                  </div>
                </Col>
                {lawyer.data.licenseNumber ? (
                  <Col xs={24} sm={12}>
                    <Text type="secondary">Licence number</Text>
                    <div>
                      <Text strong>{lawyer.data.licenseNumber}</Text>
                    </div>
                  </Col>
                ) : null}
              </Row>

              <div style={{ marginTop: 20 }}>
                <Text type="secondary">Practice areas</Text>
                <Space wrap size={[6, 6]} style={{ marginTop: 8, display: 'flex' }}>
                  {lawyer.data.practiceAreas.map(({ legalCategory }) => (
                    <Badge key={legalCategory.id} tone="info">
                      {legalCategory.name}
                    </Badge>
                  ))}
                </Space>
              </div>
            </Card>

            <AiDisclaimer />

            {user?.role === 'USER' ? (
              <RequestForm
                lawyerProfileId={lawyer.data.id}
                feePesewas={lawyer.data.consultationFeePesewas}
              />
            ) : null}

            {/* A visitor who has read this far is the most likely person to sign up,
                so the prompt sits here rather than only in the header. */}
            {state.status === 'anonymous' ? (
              <Card>
                <Title level={4} className="lc-display" style={{ marginTop: 0 }}>
                  Contact {lawyer.data.displayName}
                </Title>
                <Paragraph type="secondary">
                  To send a consultation request you need an account. It takes a minute, and it is
                  how we pass your situation to the lawyer in a form they can act on.
                </Paragraph>
                <Space wrap>
                  <Button type="primary" onClick={() => void navigate('/register')}>
                    Create an account
                  </Button>
                  <Button onClick={() => void navigate('/login')}>Sign in</Button>
                </Space>
              </Card>
            ) : null}
          </Space>
        )}
      </main>
    </PageShell>
  );
}
