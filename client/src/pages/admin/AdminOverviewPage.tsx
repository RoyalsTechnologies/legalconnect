import { Col, Row, Statistic, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import { PageShell } from '../../components/Layout';
import { Card, ErrorNotice, Loading, PageHeading } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { AdminTabs } from './AdminTabs';

const { Title, Text } = Typography;

function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'neutral' | 'warn';
}) {
  const warn = tone === 'warn' && value > 0;
  return (
    <Card>
      <Statistic title={label} value={value} valueStyle={warn ? { color: '#b45309' } : undefined} />
      {hint ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

export function AdminOverviewPage() {
  const stats = useAsync(() => adminApi.stats(), [], 'Could not load platform statistics.');

  return (
    <PageShell>
      <main className="lc-page lc-page--wide">
        <PageHeading
          title="Platform overview"
          description="A snapshot of activity and anything waiting on a human decision."
        />
        <AdminTabs />

        {stats.status === 'loading' ? (
          <Loading label="Loading statistics…" />
        ) : stats.status === 'error' ? (
          <div style={{ marginTop: 24 }}>
            <ErrorNotice message={stats.message} />
          </div>
        ) : (
          <div style={{ marginTop: 32 }}>
            <section>
              <Title
                level={5}
                type="secondary"
                style={{ marginTop: 0, textTransform: 'uppercase' }}
              >
                Needs attention
              </Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Link
                    to="/app/admin/lawyers"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <Stat
                      label="Lawyers awaiting approval"
                      value={stats.data.lawyers.pending}
                      hint="Open the lawyers tab to approve"
                      tone="warn"
                    />
                  </Link>
                </Col>
                <Col xs={24} sm={8}>
                  <Stat
                    label="Enquiries needing review"
                    value={stats.data.intakes.needsReview}
                    hint="Low confidence or uncategorised"
                    tone="warn"
                  />
                </Col>
                {/* The clearest signal available that the AI provider is degraded
                    (TD-014 — there is no metrics aggregation yet). */}
                <Col xs={24} sm={8}>
                  <Stat
                    label="AI fallbacks"
                    value={stats.data.intakes.aiFallback}
                    hint="Saved without AI triage"
                    tone="warn"
                  />
                </Col>
              </Row>
            </section>

            <section style={{ marginTop: 32 }}>
              <Title
                level={5}
                type="secondary"
                style={{ marginTop: 0, textTransform: 'uppercase' }}
              >
                Platform
              </Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                  <Stat label="Users" value={stats.data.users.total} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Stat label="Suspended accounts" value={stats.data.users.suspended} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Stat label="Approved lawyers" value={stats.data.lawyers.approved} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Stat label="Lawyers on a live plan" value={stats.data.lawyers.subscribed} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Stat label="Active categories" value={stats.data.categories.active} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Stat label="Enquiries" value={stats.data.intakes.total} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Stat label="Consultation requests" value={stats.data.consultations.total} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Stat label="Awaiting a lawyer" value={stats.data.consultations.pending} />
                </Col>
              </Row>
            </section>

            <Text type="secondary" style={{ display: 'block', marginTop: 24 }}>
              Review new practitioners on the <Link to="/app/admin/lawyers">lawyers tab</Link>.
            </Text>
          </div>
        )}
      </main>
    </PageShell>
  );
}
