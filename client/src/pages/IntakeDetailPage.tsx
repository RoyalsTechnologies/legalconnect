import { Alert, Button, Card, Col, Flex, Row, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { FALLBACK_CATEGORY_NAME, intakesApi } from '../api/endpoints';
import type { IntakeView } from '../api/types';
import { AiDisclaimer, PageShell } from '../components/Layout';
import { BackLink, ErrorNotice, Loading, UrgencyBadge } from '../components/ui';

const { Title, Paragraph, Text } = Typography;

function statusAlert(intake: IntakeView): { type: 'warning' | 'success' | 'info'; text: string } {
  if (intake.aiStatus === 'FAILED_FALLBACK' || intake.needsHumanReview) {
    return {
      type: 'warning',
      text: 'We saved your request. Matching needs a confirmed category first — this is not a rejection. You can still browse the directory.',
    };
  }
  if (intake.aiStatus === 'COMPLETED') {
    return {
      type: 'success',
      text: 'Your request has been organised. Review the summary below — you can still compare it with your original words.',
    };
  }
  return {
    type: 'info',
    text: 'We are still organising your request.',
  };
}

export function IntakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [intake, setIntake] = useState<IntakeView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    intakesApi
      .get(id)
      .then((data) => {
        if (!cancelled) setIntake(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Could not load this request.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <PageShell showDisclaimer>
      <main className="lc-page lc-page--narrow">
        <BackLink to="/app">Back to home</BackLink>

        {error ? (
          <div style={{ marginTop: 32 }}>
            <ErrorNotice message={error} />
          </div>
        ) : intake === null ? (
          <Loading label="Loading request…" />
        ) : (
          <Space direction="vertical" size={24} style={{ width: '100%', marginTop: 24 }}>
            <header>
              <Title level={1} className="lc-display" style={{ marginTop: 0 }}>
                Your organised request
              </Title>
              <Alert
                type={statusAlert(intake).type}
                showIcon
                message={statusAlert(intake).text}
                role="status"
                style={{ marginTop: 16 }}
              />
            </header>

            <AiDisclaimer />

            <Card>
              <span className="lc-label">Suggested category</span>
              <Title level={4} style={{ marginTop: 4, marginBottom: 16 }}>
                {intake.category?.name ?? 'Needs review'}
              </Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Text type="secondary">Urgency</Text>
                  <div style={{ marginTop: 4 }}>
                    <UrgencyBadge urgency={intake.urgency} />
                  </div>
                </Col>
                {(intake.city || intake.region) && (
                  <Col xs={24} sm={12}>
                    <Text type="secondary">Location</Text>
                    <div>
                      <Text strong>{[intake.city, intake.region].filter(Boolean).join(', ')}</Text>
                    </div>
                  </Col>
                )}
              </Row>
            </Card>

            <Card>
              <span className="lc-label">Summary for the lawyer</span>
              <Paragraph className="lc-prewrap" style={{ marginTop: 8, marginBottom: 0 }}>
                {intake.aiSummary ?? 'Summary not available yet.'}
              </Paragraph>
            </Card>

            <Card>
              <span className="lc-label">Your original words</span>
              <Paragraph
                type="secondary"
                className="lc-prewrap"
                style={{ marginTop: 8, marginBottom: 0 }}
              >
                {intake.originalDescription}
              </Paragraph>
            </Card>

            {intake.keywords.length > 0 && (
              <section>
                <Text type="secondary">Keywords</Text>
                <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  {intake.keywords.join(' · ')}
                </Paragraph>
              </section>
            )}

            {/* Matching skips the holding category (FR-010). Send those enquiries
                to the directory instead of an empty recommendations page. */}
            <Flex wrap="wrap" gap={12}>
              {intake.category && intake.category.name !== FALLBACK_CATEGORY_NAME ? (
                <Button
                  type="primary"
                  size="large"
                  onClick={() => void navigate(`/app/intakes/${intake.id}/recommendations`)}
                >
                  See suggested lawyers
                </Button>
              ) : null}
              <Button
                type={
                  !intake.category || intake.category.name === FALLBACK_CATEGORY_NAME
                    ? 'primary'
                    : 'default'
                }
                size="large"
                onClick={() => void navigate('/lawyers')}
              >
                Browse the full directory
              </Button>
            </Flex>
          </Space>
        )}
      </main>
    </PageShell>
  );
}
