import { Alert, Button, Flex, Form, Space, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { consultationsApi, intakesApi } from '../api/endpoints';
import type { Recommendation } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { AiDisclaimer, PageShell } from '../components/Layout';
import { MomoPayFields, type MomoPayValues } from '../components/MomoPayFields';
import {
  Badge,
  Card,
  EmptyState,
  ErrorNotice,
  formatGhs,
  Loading,
  PageHeading,
} from '../components/ui';
import { messageFor, useAsync } from '../hooks/useAsync';

const { Text, Paragraph } = Typography;

function RecommendationCard({
  recommendation,
  intakeId,
}: {
  recommendation: Recommendation;
  intakeId: string;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lawyer, reason } = recommendation;
  const [form] = Form.useForm<MomoPayValues>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(values: MomoPayValues) {
    setError(null);
    setSending(true);
    try {
      const created = await consultationsApi.create({
        intakeId,
        lawyerProfileId: lawyer.id,
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
      setSending(false);
    }
  }

  return (
    <Card>
      <Flex justify="space-between" align="flex-start" gap={12} wrap="wrap">
        <div>
          <Button
            type="link"
            className="lc-display"
            style={{ padding: 0, height: 'auto', fontSize: 18, fontWeight: 600 }}
            onClick={() => void navigate(`/lawyers/${lawyer.id}`)}
          >
            {lawyer.displayName}
          </Button>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {lawyer.firmName ? `${lawyer.firmName} · ` : ''}
            {lawyer.city}, {lawyer.region} · {formatGhs(lawyer.consultationFeePesewas)}
          </Paragraph>
        </div>
        <Badge tone={lawyer.isAvailable ? 'success' : 'neutral'}>
          {lawyer.isAvailable ? 'Accepting enquiries' : 'Not accepting'}
        </Badge>
      </Flex>

      {/* NFR-007 — the reason is shown next to the recommendation, never hidden
          behind a tooltip, so nobody has to take the ordering on trust. */}
      <Alert type="info" showIcon={false} message={reason} style={{ marginTop: 16 }} />

      <Space wrap size={[6, 6]} style={{ marginTop: 16 }}>
        {lawyer.practiceAreas.map((area) => (
          <Badge key={area} tone="info">
            {area}
          </Badge>
        ))}
      </Space>

      {error ? (
        <div style={{ marginTop: 16 }}>
          <ErrorNotice message={error} />
        </div>
      ) : null}

      <Form
        form={form}
        layout="vertical"
        initialValues={{ phone: user?.phone ?? undefined }}
        onFinish={(values) => void send(values)}
        style={{ marginTop: 20 }}
        requiredMark={false}
      >
        <MomoPayFields />
        <Form.Item style={{ marginBottom: 0 }}>
          <Space wrap>
            <Button type="primary" htmlType="submit" loading={sending}>
              {sending
                ? 'Sending payment prompt…'
                : `Book and pay ${formatGhs(lawyer.consultationFeePesewas)}`}
            </Button>
            <Button htmlType="button" onClick={() => void navigate(`/lawyers/${lawyer.id}`)}>
              View profile
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}

export function RecommendationsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const match = useAsync(
    () => intakesApi.recommendations(id ?? ''),
    [id],
    'Could not load recommendations for this enquiry.',
  );

  return (
    <PageShell showDisclaimer>
      <main className="lc-page lc-page--medium">
        <Button
          type="link"
          style={{ paddingInline: 0 }}
          onClick={() => void navigate(`/app/intakes/${id}`)}
        >
          ← Back to your enquiry
        </Button>

        <div style={{ marginTop: 24 }}>
          <PageHeading
            title="Suggested legal professionals"
            description="These suggestions are based on practice area, location, and availability. Each one explains why it appeared — you are free to ignore them and browse the full directory."
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <AiDisclaimer />
        </div>

        <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 24 }}>
          {match.status === 'loading' ? (
            <Loading label="Finding suitable lawyers…" />
          ) : match.status === 'error' ? (
            <ErrorNotice message={match.message} />
          ) : match.data.recommendations.length === 0 ? (
            <EmptyState
              title="No suggestions yet"
              description={
                match.data.note ??
                'No approved lawyer currently lists this practice area. You can still browse the directory.'
              }
              action={
                <Button type="link" onClick={() => void navigate('/lawyers')}>
                  Browse all lawyers
                </Button>
              }
            />
          ) : (
            <>
              {match.data.category ? (
                <Text type="secondary">
                  Matching on <Text strong>{match.data.category.name}</Text>.
                </Text>
              ) : null}
              {match.data.recommendations.map((recommendation) => (
                <RecommendationCard
                  key={recommendation.lawyer.id}
                  recommendation={recommendation}
                  intakeId={id ?? ''}
                />
              ))}
            </>
          )}
        </Space>
      </main>
    </PageShell>
  );
}
