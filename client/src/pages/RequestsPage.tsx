import { Button, Flex, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { consultationsApi } from '../api/endpoints';
import type { ConsultationView } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { PageShell } from '../components/Layout';
import {
  ConsultationBadge,
  EmptyState,
  ErrorNotice,
  formatDate,
  Loading,
  PageHeading,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';

const { Text } = Typography;

function RequestRow({ request, asLawyer }: { request: ConsultationView; asLawyer: boolean }) {
  const navigate = useNavigate();
  const counterparty = asLawyer ? request.client.fullName : request.lawyerProfile.displayName;
  const href = `/app/requests/${request.id}`;

  return (
    <div
      className="lc-row"
      role="link"
      tabIndex={0}
      onClick={() => void navigate(href)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          void navigate(href);
        }
      }}
    >
      <Flex justify="space-between" align="center" gap={16} wrap="wrap">
        <div style={{ minWidth: 0, flex: 1 }}>
          <Space wrap size={8}>
            <Text strong>{counterparty}</Text>
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
    </div>
  );
}

export function RequestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const asLawyer = user?.role === 'LAWYER';
  const requests = useAsync(() => consultationsApi.list(), [], 'Could not load your requests.');

  return (
    <PageShell showDisclaimer>
      <main className="lc-page lc-page--wide">
        <PageHeading
          title={asLawyer ? 'Incoming consultation requests' : 'Your consultation requests'}
          description={
            asLawyer
              ? 'Each request includes a structured summary of the enquiry so you can decide quickly whether it is something you handle.'
              : 'Track the lawyers you have contacted and how they have responded.'
          }
        />

        <div style={{ marginTop: 32 }}>
          {requests.status === 'loading' ? (
            <Loading label="Loading requests…" />
          ) : requests.status === 'error' ? (
            <ErrorNotice message={requests.message} />
          ) : requests.data.length === 0 ? (
            <EmptyState
              title={asLawyer ? 'No requests yet' : 'You have not contacted anyone yet'}
              description={
                asLawyer
                  ? 'When a citizen sends you an enquiry it will appear here with their summary and their own words.'
                  : 'Describe your issue, review the suggestions, and send a request to a lawyer who fits.'
              }
              action={
                asLawyer ? undefined : (
                  <Button type="link" onClick={() => void navigate('/app/intake')}>
                    Describe your issue
                  </Button>
                )
              }
            />
          ) : (
            requests.data.map((request) => (
              <RequestRow key={request.id} request={request} asLawyer={asLawyer} />
            ))
          )}
        </div>
      </main>
    </PageShell>
  );
}
