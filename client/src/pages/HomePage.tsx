import { Button, Col, Flex, Row, Space, Statistic, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi, consultationsApi, intakesApi, lawyersApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { PageShell } from '../components/Layout';
import {
  ApprovalBadge,
  Card,
  ConsultationBadge,
  EmptyState,
  ErrorNotice,
  formatDate,
  Loading,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';

const { Title, Paragraph, Text } = Typography;

function CitizenHome({ fullName }: { fullName: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const request = useAsync(() => intakesApi.list(), [], 'Could not load your previous requests.');
  const intakes = request.status === 'ready' ? request.data : null;
  const error = request.status === 'error' ? request.message : null;

  return (
    <Space direction="vertical" size={40} style={{ width: '100%' }}>
      <section>
        <Text strong style={{ color: '#1f4a9a' }}>
          Welcome, {fullName.split(' ')[0]}
        </Text>
        <Title level={1} className="lc-display" style={{ marginTop: 4 }}>
          What do you need help with?
        </Title>
        <Paragraph type="secondary" style={{ maxWidth: 640 }}>
          Start with a plain-language description. We will organise it and help you find a suitable
          legal professional — they remain responsible for advice.
        </Paragraph>
        <Space wrap>
          <Button type="primary" size="large" onClick={() => void navigate('/app/intake')}>
            Tell us what happened
          </Button>
          <Button size="large" onClick={() => void navigate('/lawyers')}>
            Browse lawyers
          </Button>
        </Space>
      </section>

      {!user?.phone ? (
        <Card>
          <Flex justify="space-between" align="center" gap={12} wrap="wrap">
            <div>
              <Text strong>Add a phone number</Text>
              <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
                Consultation fees are paid by mobile money. Save a Ghana number on your account so
                you do not have to type it each time.
              </Paragraph>
            </div>
            <Button onClick={() => void navigate('/app/account')}>Open account</Button>
          </Flex>
        </Card>
      ) : null}

      <section>
        <Title level={3}>Your recent enquiries</Title>
        {error ? (
          <ErrorNotice message={error} />
        ) : intakes === null ? (
          <Loading label="Loading your requests…" />
        ) : intakes.length === 0 ? (
          <EmptyState
            title="No requests yet"
            description="When you describe a concern, it will appear here so you can track what you submitted."
            action={
              <Button type="link" onClick={() => void navigate('/app/intake')}>
                Start your first request
              </Button>
            }
          />
        ) : (
          <div>
            {intakes.map((intake) => (
              <Link key={intake.id} className="lc-row" to={`/app/intakes/${intake.id}`}>
                <Flex justify="space-between" align="center" gap={16} wrap="wrap">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text strong>{intake.category?.name ?? 'Being organised'}</Text>
                    <div className="lc-clamp-1">
                      <Text type="secondary">{intake.aiSummary ?? intake.originalDescription}</Text>
                    </div>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                    <time dateTime={intake.createdAt}>{formatDate(intake.createdAt)}</time>
                  </Text>
                </Flex>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Space>
  );
}

function LawyerHome({ fullName }: { fullName: string }) {
  const navigate = useNavigate();
  const requests = useAsync(() => consultationsApi.list(), [], 'Could not load your requests.');
  const profile = useAsync(() => lawyersApi.me(), [], 'Could not load your profile.');

  const waiting =
    requests.status === 'ready'
      ? requests.data.filter((request) => request.status === 'PENDING')
      : [];

  return (
    <Space direction="vertical" size={40} style={{ width: '100%' }}>
      <section>
        <Text strong style={{ color: '#1f4a9a' }}>
          Welcome, {fullName.split(' ')[0]}
        </Text>
        <Title level={1} className="lc-display" style={{ marginTop: 4 }}>
          {waiting.length === 0
            ? 'Nothing is waiting on you'
            : `${waiting.length} enquir${waiting.length === 1 ? 'y' : 'ies'} awaiting your reply`}
        </Title>
        <Paragraph type="secondary" style={{ maxWidth: 640 }}>
          Each request arrives with a structured summary and the citizen's own description, so you
          can judge quickly whether it is a matter you handle.
        </Paragraph>
      </section>

      {profile.status === 'ready' && profile.data.approvalStatus === 'PENDING' ? (
        <Card>
          <Flex justify="space-between" align="center" gap={12} wrap="wrap">
            <div>
              <Text strong>Waiting for administrator review</Text>
              <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
                Confirm your profile details. You will not appear in the directory or receive
                consultation requests until you are approved.
              </Paragraph>
            </div>
            <ApprovalBadge status={profile.data.approvalStatus} />
          </Flex>
        </Card>
      ) : null}

      {profile.status === 'ready' && profile.data.approvalStatus === 'REJECTED' ? (
        <Card>
          <Flex justify="space-between" align="center" gap={12} wrap="wrap">
            <div>
              <Text strong>Your profile was not approved</Text>
              <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
                Update your details if something was incomplete. An administrator can review again.
              </Paragraph>
            </div>
            <ApprovalBadge status={profile.data.approvalStatus} />
          </Flex>
        </Card>
      ) : null}

      {profile.status === 'ready' && !profile.data.subscription.active ? (
        <Card>
          <Flex justify="space-between" align="center" gap={12} wrap="wrap">
            <div>
              <Text strong>Subscribe to appear in matching</Text>
              <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
                Citizens only see lawyers with a live plan. Each plan is for a set number of legal
                areas of interest. You can pay for a month or a year.
              </Paragraph>
            </div>
            <Button type="primary" onClick={() => void navigate('/app/profile')}>
              Choose a plan
            </Button>
          </Flex>
        </Card>
      ) : null}

      <section>
        <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
          <Title level={3} style={{ margin: 0 }}>
            Recent requests
          </Title>
          <Button type="link" onClick={() => void navigate('/app/requests')}>
            View all
          </Button>
        </Flex>

        <div style={{ marginTop: 16 }}>
          {requests.status === 'loading' ? (
            <Loading label="Loading requests…" />
          ) : requests.status === 'error' ? (
            <ErrorNotice message={requests.message} />
          ) : requests.data.length === 0 ? (
            <EmptyState
              title="No requests yet"
              description="Keep your practice areas and availability accurate — recommendations only reach lawyers who list the matching area."
              action={
                <Button type="link" onClick={() => void navigate('/app/profile')}>
                  Review your profile
                </Button>
              }
            />
          ) : (
            <div>
              {requests.data.slice(0, 5).map((request) => (
                <Link key={request.id} className="lc-row" to={`/app/requests/${request.id}`}>
                  <Flex justify="space-between" align="center" gap={16} wrap="wrap">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Space wrap size={8}>
                        <Text strong>{request.client.fullName}</Text>
                        <ConsultationBadge status={request.status} />
                      </Space>
                      <div className="lc-clamp-1">
                        <Text type="secondary">
                          {request.intake.category?.name ?? 'Awaiting review'} —{' '}
                          {request.intake.aiSummary ?? request.intake.originalDescription}
                        </Text>
                      </div>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                      <time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time>
                    </Text>
                  </Flex>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </Space>
  );
}

function AdminHome({ fullName }: { fullName: string }) {
  const navigate = useNavigate();
  const stats = useAsync(() => adminApi.stats(), [], 'Could not load platform statistics.');

  const attention =
    stats.status === 'ready' ? stats.data.lawyers.pending + stats.data.intakes.needsReview : 0;

  return (
    <Space direction="vertical" size={32} style={{ width: '100%' }}>
      <section>
        <Text strong style={{ color: '#1f4a9a' }}>
          Welcome, {fullName.split(' ')[0]}
        </Text>
        <Title level={1} className="lc-display" style={{ marginTop: 4 }}>
          {attention === 0 ? 'Nothing needs your attention' : `${attention} items need attention`}
        </Title>
        <Paragraph type="secondary" style={{ maxWidth: 640 }}>
          Approve practitioners, manage categories, and keep an eye on enquiries the AI could not
          categorise confidently.
        </Paragraph>
        <Button type="primary" size="large" onClick={() => void navigate('/app/admin')}>
          Open administration
        </Button>
      </section>

      {stats.status === 'error' ? <ErrorNotice message={stats.message} /> : null}

      {stats.status === 'ready' ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="Lawyers awaiting approval" value={stats.data.lawyers.pending} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="Enquiries needing review" value={stats.data.intakes.needsReview} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Requests awaiting a lawyer"
                value={stats.data.consultations.pending}
              />
            </Card>
          </Col>
        </Row>
      ) : null}
    </Space>
  );
}

export function HomePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <PageShell showDisclaimer>
      <main className="lc-page">
        {user.role === 'USER' && <CitizenHome fullName={user.fullName} />}
        {user.role === 'LAWYER' && <LawyerHome fullName={user.fullName} />}
        {user.role === 'ADMIN' && <AdminHome fullName={user.fullName} />}
      </main>
    </PageShell>
  );
}
