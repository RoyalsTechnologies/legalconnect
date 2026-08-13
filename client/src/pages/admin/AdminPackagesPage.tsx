import { Alert, Button, Col, Form, Input, InputNumber, Row, Switch, Table, Typography } from 'antd';
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
  toFormFields,
} from '../../components/ui';
import { messageFor, useAsync } from '../../hooks/useAsync';
import { AdminShell } from './AdminTabs';

const { Text } = Typography;

function FeeEditor({
  pkg,
  onSave,
}: {
  pkg: SubscriptionPackage;
  onSave: (monthlyFeeGhs: number) => Promise<void>;
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
      await onSave(Number(feeGhs));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <InputNumber
        min={1}
        max={50000}
        value={feeGhs}
        onChange={(value) => setFeeGhs(value ?? pkg.monthlyFeePesewas / 100)}
        style={{ width: 110 }}
        aria-label={`${pkg.name} monthly fee in Ghana cedis`}
      />
      <Button
        type="primary"
        size="small"
        onClick={() => void save()}
        loading={saving}
        disabled={!dirty}
      >
        Save
      </Button>
    </div>
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

  const columns = [
    {
      title: 'Plan',
      key: 'name',
      render: (_: unknown, pkg: SubscriptionPackage) => (
        <div>
          <Text strong>{pkg.name}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {pkg.description}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Areas',
      dataIndex: 'maxPracticeAreas',
      key: 'areas',
      width: 90,
    },
    {
      title: 'Yearly',
      key: 'year',
      width: 130,
      render: (_: unknown, pkg: SubscriptionPackage) => (
        <Text type="secondary">{formatGhs(pkg.monthlyFeePesewas * 12)}</Text>
      ),
    },
    {
      title: 'Monthly (GHS)',
      key: 'fee',
      width: 220,
      render: (_: unknown, pkg: SubscriptionPackage) => (
        <FeeEditor pkg={pkg} onSave={(ghs) => saveFee(pkg, ghs)} />
      ),
    },
    {
      title: 'Offered',
      key: 'active',
      width: 110,
      render: (_: unknown, pkg: SubscriptionPackage) => (
        <Switch
          checked={pkg.isActive}
          checkedChildren="Yes"
          unCheckedChildren="No"
          onChange={(checked) => void setActive(pkg, checked)}
        />
      ),
    },
    {
      title: '',
      key: 'status',
      width: 100,
      render: (_: unknown, pkg: SubscriptionPackage) => (
        <Badge tone={pkg.isActive ? 'success' : 'neutral'}>
          {pkg.isActive ? 'Live' : 'Retired'}
        </Badge>
      ),
    },
  ];

  return (
    <PageShell>
      <AdminShell
        title="Plans"
        description="Monthly fee and area cap. A year is twelve times that fee. A change applies to the next payment only."
      >
        <Row gutter={[20, 20]}>
          <Col xs={24} xl={8}>
            <Card title="New plan">
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
                <Row gutter={12}>
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
                      label="Areas allowed"
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
          <Col xs={24} xl={16}>
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
              <div className="lc-panel">
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={packages.data}
                  pagination={false}
                  size="middle"
                />
              </div>
            )}
          </Col>
        </Row>
      </AdminShell>
    </PageShell>
  );
}
