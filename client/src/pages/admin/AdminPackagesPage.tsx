import { Alert, Button, Col, Form, Input, InputNumber, List, Row, Space, Switch } from 'antd';
import { useEffect, useState } from 'react';
import { ApiError, fieldErrorsFromApi } from '../../api/client';
import { packagesApi } from '../../api/endpoints';
import type { SubscriptionPackage } from '../../api/types';
import { PageShell } from '../../components/Layout';
import {
  Badge,
  Card,
  EmptyState,
  ErrorNotice,
  formatGhs,
  Loading,
  PageHeading,
  toFormFields,
} from '../../components/ui';
import { messageFor, useAsync } from '../../hooks/useAsync';
import { AdminTabs } from './AdminTabs';

function PackageCard({
  pkg,
  onToggle,
  onSaveFee,
}: {
  pkg: SubscriptionPackage;
  onToggle: (checked: boolean) => void;
  onSaveFee: (monthlyFeeGhs: number) => Promise<void>;
}) {
  const [feeGhs, setFeeGhs] = useState(pkg.monthlyFeePesewas / 100);
  const [saving, setSaving] = useState(false);
  const dirty = feeGhs !== pkg.monthlyFeePesewas / 100;

  useEffect(() => {
    setFeeGhs(pkg.monthlyFeePesewas / 100);
  }, [pkg.monthlyFeePesewas]);

  async function save() {
    setSaving(true);
    try {
      await onSaveFee(Number(feeGhs));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <Space wrap size={8} style={{ width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Space wrap size={8}>
            <strong>{pkg.name}</strong>
            <Badge tone={pkg.isActive ? 'success' : 'neutral'}>
              {pkg.isActive ? 'Offered' : 'Retired'}
            </Badge>
          </Space>
          <p style={{ marginBottom: 0, marginTop: 8, color: '#5b6b82' }}>{pkg.description}</p>
          <p style={{ marginBottom: 0, marginTop: 4, color: '#5b6b82' }}>
            {pkg.maxPracticeAreas} practice area{pkg.maxPracticeAreas === 1 ? '' : 's'}
          </p>
          <p style={{ marginBottom: 0, marginTop: 4, color: '#5b6b82' }}>
            Yearly equivalent {formatGhs(Math.round(feeGhs * 12 * 100))} (12 × monthly)
          </p>
        </div>
        <Switch
          checked={pkg.isActive}
          checkedChildren="Offered"
          unCheckedChildren="Retired"
          onChange={onToggle}
        />
      </Space>

      <Space wrap align="end" style={{ marginTop: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: '#5b6b82', marginBottom: 4 }}>Monthly fee (GHS)</div>
          <InputNumber
            min={1}
            max={50000}
            value={feeGhs}
            onChange={(value) => setFeeGhs(value ?? pkg.monthlyFeePesewas / 100)}
            style={{ width: 140 }}
            aria-label={`${pkg.name} monthly fee in Ghana cedis`}
          />
        </div>
        <Button type="primary" onClick={() => void save()} loading={saving} disabled={!dirty}>
          {saving ? 'Saving…' : 'Save fee'}
        </Button>
      </Space>
    </Card>
  );
}

export function AdminPackagesPage() {
  const packages = useAsync(() => packagesApi.list(), [], 'Could not load subscription plans.');
  const [form] = Form.useForm<{
    name: string;
    description: string;
    monthlyFeeGhs: number;
    maxPracticeAreas: number;
  }>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  async function create(values: {
    name: string;
    description: string;
    monthlyFeeGhs: number;
    maxPracticeAreas: number;
  }) {
    setError(null);
    setSaving(true);
    try {
      const pkg = await packagesApi.create({
        name: values.name.trim(),
        description: values.description.trim(),
        monthlyFeeGhs: Number(values.monthlyFeeGhs),
        maxPracticeAreas: Number(values.maxPracticeAreas),
      });
      setCreated(pkg.name);
      form.resetFields();
      packages.reload();
    } catch (err) {
      if (err instanceof ApiError) form.setFields(toFormFields(fieldErrorsFromApi(err)));
      setError(messageFor(err, 'Could not create that plan.'));
    } finally {
      setSaving(false);
    }
  }

  async function setActive(pkg: SubscriptionPackage, isActive: boolean) {
    setError(null);
    try {
      await packagesApi.update(pkg.id, { isActive });
      packages.reload();
    } catch (err) {
      setError(messageFor(err, 'Could not update that plan.'));
    }
  }

  async function saveFee(pkg: SubscriptionPackage, monthlyFeeGhs: number) {
    setError(null);
    try {
      await packagesApi.update(pkg.id, { monthlyFeeGhs });
      packages.reload();
    } catch (err) {
      setError(messageFor(err, 'Could not save that fee.'));
    }
  }

  return (
    <PageShell>
      <main className="lc-page lc-page--wide">
        <PageHeading
          title="Subscription plans"
          description="Set the monthly fee and area cap for each plan. Lawyers pay a month or a year (twelve times that fee). A fee change applies to the next payment — a period already paid is not rewritten."
        />
        <AdminTabs />

        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col xs={24} lg={10}>
            <Card>
              <Form
                form={form}
                layout="vertical"
                onFinish={(values) => void create(values)}
                initialValues={{ monthlyFeeGhs: 50, maxPracticeAreas: 1 }}
              >
                <Form.Item
                  label="Name"
                  name="name"
                  rules={[{ required: true, message: 'Name is required' }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="Description"
                  name="description"
                  rules={[{ required: true, message: 'Describe the plan' }]}
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="Monthly fee (GHS)"
                      name="monthlyFeeGhs"
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={1} max={50000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="Practice areas allowed"
                      name="maxPracticeAreas"
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={1} max={9} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                {error ? <ErrorNotice message={error} /> : null}
                {created ? (
                  <Alert
                    type="success"
                    showIcon
                    message={`Created ${created}.`}
                    style={{ marginBottom: 16 }}
                  />
                ) : null}
                <Button type="primary" htmlType="submit" loading={saving}>
                  {saving ? 'Creating…' : 'Add plan'}
                </Button>
              </Form>
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            {packages.status === 'loading' ? (
              <Loading label="Loading plans…" />
            ) : packages.status === 'error' ? (
              <ErrorNotice message={packages.message} />
            ) : packages.data.length === 0 ? (
              <EmptyState
                title="No plans yet"
                description="Add Starter, Practice, and Chambers so lawyers can subscribe."
              />
            ) : (
              <List
                dataSource={packages.data}
                renderItem={(pkg) => (
                  <List.Item key={pkg.id} style={{ padding: 0, marginBottom: 12, border: 'none' }}>
                    <div style={{ width: '100%' }}>
                      <PackageCard
                        pkg={pkg}
                        onToggle={(checked) => void setActive(pkg, checked)}
                        onSaveFee={(ghs) => saveFee(pkg, ghs)}
                      />
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Col>
        </Row>
      </main>
    </PageShell>
  );
}
