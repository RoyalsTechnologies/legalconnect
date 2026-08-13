import { Alert, Button, Card, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { consultationsApi } from '../api/endpoints';
import { PageShell } from '../components/Layout';
import { ErrorNotice, Loading } from '../components/ui';
import { messageFor } from '../hooks/useAsync';

const { Title, Paragraph } = Typography;

/** After a hosted checkout (or a manual ?reference= link), confirm the fee was captured. */
export function PaymentReturnPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = params.get('reference') ?? params.get('trxref') ?? '';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) {
      setError(
        'No payment reference was returned. Open the request from My requests to try again.',
      );
      return;
    }

    let cancelled = false;
    consultationsApi
      .verifyPayment(reference)
      .then((consultation) => {
        if (!cancelled) void navigate(`/app/requests/${consultation.id}`, { replace: true });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageFor(err, 'Could not confirm that payment.'));
      });

    return () => {
      cancelled = true;
    };
  }, [reference, navigate]);

  return (
    <PageShell>
      <main className="lc-page lc-page--narrow">
        <Title level={1} className="lc-display">
          Confirming payment
        </Title>
        <Paragraph type="secondary">
          We are checking that the consultation fee was received.
        </Paragraph>
        <Card style={{ marginTop: 24 }}>
          {error ? (
            <>
              <ErrorNotice message={error} />
              <Button
                type="primary"
                style={{ marginTop: 16 }}
                onClick={() => void navigate('/app/requests')}
              >
                Back to requests
              </Button>
            </>
          ) : (
            <>
              <Loading label="Confirming payment…" />
              <Alert
                type="info"
                showIcon
                message="Do not close this page."
                style={{ marginTop: 16 }}
              />
            </>
          )}
        </Card>
      </main>
    </PageShell>
  );
}
