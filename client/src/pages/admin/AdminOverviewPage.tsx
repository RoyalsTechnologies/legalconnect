import { Col, Row, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import { PageShell } from '../../components/Layout';
import { ErrorNotice, Loading } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { AdminShell } from './AdminTabs';

const { Text } = Typography;

function Metric({
  label,
  value,
  hint,
  to,
  warn = false,
}: {
  label: string;
  value: number;
  hint?: string;
  to?: string;
  warn?: boolean;
}) {
  const hot = warn && value > 0;
  const inner = (
    <>
      <div className="lc-metric__label">{label}</div>
      <div className="lc-metric__value">{value.toLocaleString('en-GB')}</div>
      {hint ? <div className="lc-metric__hint">{hint}</div> : null}
    </>
  );
  const className = hot ? 'lc-metric lc-metric--warn' : 'lc-metric';
  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function AdminOverviewPage() {
  const stats = useAsync(() => adminApi.stats(), [], 'Could not load platform statistics.');

  return (
    <PageShell>
      <AdminShell
        title="Overview"
        description="What needs a decision today, then the rest of the platform at a glance."
      >
        {stats.status === 'loading' ? (
          <Loading label="Loading statistics…" />
        ) : stats.status === 'error' ? (
          <ErrorNotice message={stats.message} />
        ) : (
          <>
            <section>
              <Text
                type="secondary"
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Needs a decision
              </Text>
              {stats.data.lawyers.pending === 0 &&
              stats.data.intakes.needsReview === 0 &&
              stats.data.intakes.aiFallback === 0 &&
              stats.data.consultations.pending === 0 ? (
                <div className="lc-queue" style={{ padding: '20px 24px' }}>
                  <Text strong>You are caught up</Text>
                  <div>
                    <Text type="secondary">
                      No pending lawyers, review enquiries, or unpaid work queues.
                    </Text>
                  </div>
                </div>
              ) : (
                <div className="lc-queue">
                  <Link
                    to="/app/admin/lawyers"
                    className={stats.data.lawyers.pending > 0 ? 'is-hot' : undefined}
                  >
                    <span className="lc-queue__n">{stats.data.lawyers.pending}</span>
                    <div style={{ flex: 1 }}>
                      <Text strong>Lawyers awaiting approval</Text>
                      <div>
                        <Text type="secondary">
                          Hidden from citizens until you approve and they have a live plan.
                        </Text>
                      </div>
                    </div>
                    <Text type="secondary">Review →</Text>
                  </Link>
                  <div className={stats.data.intakes.needsReview > 0 ? 'is-hot' : undefined}>
                    <span className="lc-queue__n">{stats.data.intakes.needsReview}</span>
                    <div style={{ flex: 1 }}>
                      <Text strong>Enquiries needing review</Text>
                      <div>
                        <Text type="secondary">
                          Low confidence or uncategorised. Citizens can still browse the directory.
                        </Text>
                      </div>
                    </div>
                  </div>
                  <div className={stats.data.intakes.aiFallback > 0 ? 'is-hot' : undefined}>
                    <span className="lc-queue__n">{stats.data.intakes.aiFallback}</span>
                    <div style={{ flex: 1 }}>
                      <Text strong>AI fallbacks</Text>
                      <div>
                        <Text type="secondary">
                          Saved without triage — a rising count means the provider is degraded.
                        </Text>
                      </div>
                    </div>
                  </div>
                  <div className={stats.data.consultations.pending > 0 ? 'is-hot' : undefined}>
                    <span className="lc-queue__n">{stats.data.consultations.pending}</span>
                    <div style={{ flex: 1 }}>
                      <Text strong>Awaiting a lawyer</Text>
                      <div>
                        <Text type="secondary">
                          Paid requests still waiting for accept or decline.
                        </Text>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section style={{ marginTop: 36 }}>
              <Text
                type="secondary"
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Platform
              </Text>
              <Row gutter={[12, 12]}>
                <Col xs={12} md={8} lg={6}>
                  <Metric
                    label="Users"
                    value={stats.data.users.total}
                    hint={`${stats.data.users.suspended} suspended`}
                    to="/app/admin/users"
                  />
                </Col>
                <Col xs={12} md={8} lg={6}>
                  <Metric
                    label="Approved lawyers"
                    value={stats.data.lawyers.approved}
                    hint={`${stats.data.lawyers.total} profiles in total`}
                    to="/app/admin/lawyers"
                  />
                </Col>
                <Col xs={12} md={8} lg={6}>
                  <div className="lc-metric">
                    <div className="lc-metric__label">Live plans</div>
                    <div className="lc-metric__value">{stats.data.lawyers.subscribed}</div>
                    <div className="lc-bar">
                      <span
                        style={{
                          width: `${
                            stats.data.lawyers.approved === 0
                              ? 0
                              : Math.min(
                                  100,
                                  Math.round(
                                    (stats.data.lawyers.subscribed / stats.data.lawyers.approved) *
                                      100,
                                  ),
                                )
                          }%`,
                        }}
                      />
                    </div>
                    <div className="lc-metric__hint">
                      {stats.data.lawyers.approved === 0
                        ? 'No approved lawyers yet'
                        : `${Math.round(
                            (stats.data.lawyers.subscribed / stats.data.lawyers.approved) * 100,
                          )}% of approved lawyers are visible`}
                    </div>
                  </div>
                </Col>
                <Col xs={12} md={8} lg={6}>
                  <Metric
                    label="Categories"
                    value={stats.data.categories.active}
                    hint="Used for matching and triage"
                    to="/app/admin/categories"
                  />
                </Col>
                <Col xs={12} md={8} lg={6}>
                  <Metric label="Enquiries" value={stats.data.intakes.total} />
                </Col>
                <Col xs={12} md={8} lg={6}>
                  <Metric
                    label="Consultations"
                    value={stats.data.consultations.total}
                    hint={`${stats.data.consultations.pending} awaiting a lawyer`}
                  />
                </Col>
              </Row>
            </section>
          </>
        )}
      </AdminShell>
    </PageShell>
  );
}
