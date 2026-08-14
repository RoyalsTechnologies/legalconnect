import { Alert, Button, Form, Input, InputNumber, Select, Typography } from 'antd';
import { useState } from 'react';
import { ApiError, fieldErrorsFromApi } from '../api/client';
import { lawyersApi } from '../api/endpoints';
import { PageShell } from '../components/Layout';
import { MOMO_NETWORK_OPTIONS, type MomoNetwork } from '../components/MomoPayFields';
import { Card, ErrorNotice, formatGhs, Loading, PageHeading, toFormFields } from '../components/ui';
import { messageFor, useAsync } from '../hooks/useAsync';

const { Paragraph } = Typography;

type WalletForm = {
  paymentAccountName: string;
  paymentPhone: string;
  paymentNetwork: MomoNetwork;
};

/**
 * Lawyer wallet (FR-020, FR-021): saved MoMo account, held-fee credits after both
 * parties confirm a consultation, and withdrawals to that account.
 */
export function WalletPage() {
  const profile = useAsync(() => lawyersApi.me(), [], 'Could not load your wallet.');
  const withdrawals = useAsync(
    () => lawyersApi.listWithdrawals(),
    [],
    'Could not load withdrawals.',
  );
  const [form] = Form.useForm<WalletForm>();
  const [withdrawForm] = Form.useForm<{ amountGhs: number }>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(values: WalletForm) {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await lawyersApi.updateMe({
        paymentAccountName: values.paymentAccountName.trim(),
        paymentPhone: values.paymentPhone.trim(),
        paymentNetwork: values.paymentNetwork,
      });
      profile.refresh();
      form.setFieldsValue({
        paymentAccountName: updated.paymentAccount?.accountName ?? values.paymentAccountName,
        paymentPhone: updated.paymentAccount?.phone ?? values.paymentPhone,
        paymentNetwork: updated.paymentAccount?.network ?? values.paymentNetwork,
      });
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = fieldErrorsFromApi(err);
        if (Object.keys(fields).length > 0) form.setFields(toFormFields(fields));
      }
      setError(messageFor(err, 'Could not save your payment account.'));
    } finally {
      setSaving(false);
    }
  }

  async function withdraw(values: { amountGhs: number }) {
    setError(null);
    setWithdrawn(false);
    setWithdrawing(true);
    try {
      await lawyersApi.withdraw(Number(values.amountGhs));
      withdrawForm.resetFields();
      profile.refresh();
      withdrawals.refresh();
      setWithdrawn(true);
    } catch (err) {
      setError(messageFor(err, 'Could not start that withdrawal.'));
    } finally {
      setWithdrawing(false);
    }
  }

  if (profile.status === 'loading') {
    return (
      <PageShell>
        <main className="lc-page lc-page--narrow">
          <Loading label="Loading wallet…" />
        </main>
      </PageShell>
    );
  }

  if (profile.status === 'error') {
    return (
      <PageShell>
        <main className="lc-page lc-page--narrow">
          <ErrorNotice message={profile.message} />
        </main>
      </PageShell>
    );
  }

  const account = profile.data.paymentAccount;
  const wallet = profile.data.wallet;
  const available = wallet?.availablePesewas ?? 0;

  return (
    <PageShell>
      <main className="lc-page lc-page--narrow">
        <PageHeading
          title="Wallet"
          eyebrow="Lawyer"
          description="Consultation fees are held until both you and the client confirm you met. They then credit this wallet. Withdraw to the mobile money account saved below."
        />

        <div style={{ marginTop: 24, display: 'grid', gap: 24 }}>
          <Card title="Available balance">
            <Paragraph style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 24 }}>{formatGhs(available)}</strong>
            </Paragraph>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              Plan subscription fees are paid from this number; they are not a wallet credit.
            </Paragraph>
            <Form
              form={withdrawForm}
              layout="vertical"
              requiredMark={false}
              onFinish={(values) => void withdraw(values)}
            >
              <Form.Item
                label="Withdraw (GHS)"
                name="amountGhs"
                extra={
                  account
                    ? 'Sent to your saved mobile money account.'
                    : 'Save a payment account below before you can withdraw.'
                }
                rules={[{ required: true, message: 'Enter an amount' }]}
              >
                <InputNumber
                  min={1}
                  max={50000}
                  step={10}
                  style={{ width: '100%' }}
                  disabled={!account}
                />
              </Form.Item>
              {error ? <ErrorNotice message={error} /> : null}
              {withdrawn ? (
                <Paragraph type="secondary" role="status">
                  Withdrawal sent to your mobile money account.
                </Paragraph>
              ) : null}
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={withdrawing} disabled={!account}>
                  Request withdrawal
                </Button>
              </Form.Item>
            </Form>
          </Card>

          {wallet && wallet.entries.length > 0 ? (
            <Card title="Recent activity">
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {wallet.entries.map((entry) => (
                  <li
                    key={entry.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '8px 0',
                      borderBottom: '1px solid #eef1f6',
                    }}
                  >
                    <span>
                      {entry.consultationId
                        ? 'Consultation credit'
                        : entry.amountPesewas < 0
                          ? 'Withdrawal'
                          : 'Withdrawal reversed'}
                    </span>
                    <span>
                      {entry.amountPesewas > 0 ? '+' : ''}
                      {formatGhs(entry.amountPesewas)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {withdrawals.status === 'ready' && withdrawals.data.length > 0 ? (
            <Card title="Withdrawals">
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {withdrawals.data.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '8px 0',
                      borderBottom: '1px solid #eef1f6',
                    }}
                  >
                    <span>
                      {formatGhs(item.amountPesewas)} · {item.status.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Payment account">
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Where money is sent"
              description={
                <>
                  Withdrawals and plan payments use this number. After a consultation, the client’s
                  fee is credited here only when both of you confirm you met.
                </>
              }
            />
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              initialValues={{
                paymentAccountName: account?.accountName,
                paymentPhone: account?.phone,
                paymentNetwork: account?.network,
              }}
              onFinish={(values) => void save(values)}
            >
              <Form.Item
                label="Account name"
                name="paymentAccountName"
                extra="The name registered on the mobile money wallet."
                rules={[{ required: true, message: 'Enter the account name' }]}
              >
                <Input autoComplete="name" />
              </Form.Item>
              <Form.Item
                label="Mobile money number"
                name="paymentPhone"
                extra="Ghana number, e.g. 0244123456."
                rules={[
                  { required: true, message: 'Enter the mobile money number' },
                  {
                    pattern: /^(\+233|0)\d{9}$/,
                    message: 'Enter a valid Ghana phone number, e.g. 0244123456',
                  },
                ]}
              >
                <Input type="tel" autoComplete="tel" placeholder="0244123456" />
              </Form.Item>
              <Form.Item
                label="Network"
                name="paymentNetwork"
                rules={[{ required: true, message: 'Choose the network' }]}
              >
                <Select
                  options={[...MOMO_NETWORK_OPTIONS]}
                  placeholder="MTN, AirtelTigo, or Telecel"
                />
              </Form.Item>

              {error ? <ErrorNotice message={error} /> : null}
              {saved ? (
                <Paragraph type="secondary" role="status">
                  Payment account saved.
                </Paragraph>
              ) : null}

              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={saving}>
                  Save payment account
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </main>
    </PageShell>
  );
}
