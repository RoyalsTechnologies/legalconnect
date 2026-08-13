import {
  Alert,
  Button,
  Checkbox,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import { ApiError, fieldErrorsFromApi } from '../../api/client';
import { adminApi, categoriesApi, lawyersApi, packagesApi } from '../../api/endpoints';
import type { ApprovalStatus, LawyerView } from '../../api/types';
import { PageShell } from '../../components/Layout';
import {
  ApprovalBadge,
  Badge,
  EmptyState,
  ErrorNotice,
  formatGhs,
  InitialsAvatar,
  Loading,
  RegionSelect,
  toFormFields,
} from '../../components/ui';
import { messageFor, useAsync } from '../../hooks/useAsync';
import { AdminShell } from './AdminTabs';

const { Paragraph, Text } = Typography;

const EMPTY_FORM = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  displayName: '',
  firmName: '',
  bio: '',
  licenseNumber: '',
  city: '',
  region: '',
  yearsExperience: null as number | null,
  consultationFeeGhs: 200 as number | null,
  practiceAreaIds: [] as string[],
};

function CreateLawyerForm({ onCreated }: { onCreated: () => void }) {
  const categories = useAsync(
    () => categoriesApi.selectable(),
    [],
    'Could not load practice areas.',
  );
  const [form] = Form.useForm<typeof EMPTY_FORM>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  async function submit(values: typeof EMPTY_FORM) {
    setError(null);
    setSaving(true);

    try {
      const lawyer = await lawyersApi.create({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        password: values.password,
        phone: values.phone.trim() || undefined,
        displayName: values.displayName.trim() || values.fullName.trim(),
        firmName: values.firmName.trim() || undefined,
        bio: values.bio.trim(),
        licenseNumber: values.licenseNumber.trim() || undefined,
        city: values.city.trim(),
        region: values.region.trim(),
        yearsExperience:
          values.yearsExperience === null || values.yearsExperience === undefined
            ? undefined
            : Number(values.yearsExperience),
        consultationFeeGhs: Number(values.consultationFeeGhs),
        practiceAreaIds: values.practiceAreaIds ?? [],
      });
      setCreated(lawyer.displayName);
      form.setFieldsValue(EMPTY_FORM);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        form.setFields(toFormFields(fieldErrorsFromApi(err)));
      }
      setError(messageFor(err, 'Could not create that account.'));
    } finally {
      setSaving(false);
    }
  }

  const practiceOptions =
    categories.status === 'ready'
      ? categories.data.map((category) => ({
          label: category.name,
          value: category.id,
        }))
      : [];

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={EMPTY_FORM}
      onFinish={(values) => void submit(values)}
    >
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item
            label="Full name"
            name="fullName"
            rules={[{ required: true, message: 'Full name is required' }]}
          >
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Display name" name="displayName" extra="Defaults to the full name.">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input type="email" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            label="Temporary password"
            name="password"
            extra="Share it with the lawyer and ask them to change it."
            rules={[
              { required: true, message: 'Password is required' },
              { min: 8, message: 'At least 8 characters' },
            ]}
          >
            <Input.Password visibilityToggle />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Phone (optional)" name="phone">
            <Input placeholder="0244123456" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Firm or chambers (optional)" name="firmName">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="City" name="city" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Region" name="region" rules={[{ required: true }]}>
            <RegionSelect />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Licence number (optional)" name="licenseNumber">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Years in practice (optional)" name="yearsExperience">
            <InputNumber min={0} max={70} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item
            label="Consultation fee (GHS)"
            name="consultationFeeGhs"
            rules={[{ required: true, message: 'Set a consultation fee' }]}
          >
            <InputNumber min={1} max={50000} step={10} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label="About their practice"
        name="bio"
        extra="At least a short paragraph, in plain language."
        rules={[{ required: true, message: 'A short description is required' }]}
      >
        <Input.TextArea rows={4} />
      </Form.Item>

      <Form.Item label="Practice areas" name="practiceAreaIds">
        <Checkbox.Group
          options={practiceOptions}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
        />
      </Form.Item>

      {error ? <ErrorNotice message={error} /> : null}
      {created ? (
        <Alert
          type="success"
          showIcon
          role="status"
          style={{ marginBottom: 16 }}
          message={`Created ${created}. They can sign in with the email and password you set.`}
        />
      ) : null}

      <Button type="primary" htmlType="submit" loading={saving}>
        {saving ? 'Creating…' : 'Create lawyer account'}
      </Button>
    </Form>
  );
}

type Filter = 'PENDING' | 'ALL' | ApprovalStatus;

export function AdminLawyersPage() {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [error, setError] = useState<string | null>(null);
  const lawyers = useAsync(
    () => lawyersApi.list({ limit: 50 }),
    [],
    'Could not load lawyer profiles.',
  );
  const packages = useAsync(() => packagesApi.list(), [], 'Could not load subscription plans.');
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [grantPackageId, setGrantPackageId] = useState<string | undefined>();
  const [grantPeriodDays, setGrantPeriodDays] = useState(30);

  async function setApproval(id: string, status: ApprovalStatus) {
    setError(null);
    try {
      await lawyersApi.adminUpdate(id, { approvalStatus: status });
      lawyers.reload();
    } catch (err) {
      setError(messageFor(err, 'Could not update that profile.'));
    }
  }

  async function grant(lawyerId: string) {
    if (!grantPackageId) return;
    setError(null);
    setGrantingId(lawyerId);
    try {
      await adminApi.grantSubscription(lawyerId, {
        packageId: grantPackageId,
        periodDays: grantPeriodDays,
      });
      lawyers.reload();
    } catch (err) {
      setError(
        messageFor(err, 'Could not grant that plan. The lawyer may list too many areas for it.'),
      );
    } finally {
      setGrantingId(null);
    }
  }

  const rows = useMemo(() => {
    if (lawyers.status !== 'ready') return [];
    const sorted = [...lawyers.data.results].sort((a, b) => {
      const rank = { PENDING: 0, REJECTED: 1, APPROVED: 2 };
      return rank[a.approvalStatus] - rank[b.approvalStatus];
    });
    if (filter === 'ALL') return sorted;
    return sorted.filter((lawyer) => lawyer.approvalStatus === filter);
  }, [lawyers, filter]);

  const pendingCount =
    lawyers.status === 'ready'
      ? lawyers.data.results.filter((lawyer) => lawyer.approvalStatus === 'PENDING').length
      : 0;

  const columns = [
    {
      title: 'Practitioner',
      key: 'name',
      render: (_: unknown, lawyer: LawyerView) => (
        <Space align="start">
          <InitialsAvatar name={lawyer.displayName} />
          <div>
            <Text strong>{lawyer.displayName}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {lawyer.firmName ? `${lawyer.firmName} · ` : ''}
                {lawyer.city}, {lawyer.region}
              </Text>
            </div>
            {lawyer.licenseNumber ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Licence {lawyer.licenseNumber}
              </Text>
            ) : null}
          </div>
        </Space>
      ),
    },
    {
      title: 'Review',
      key: 'approval',
      width: 140,
      render: (_: unknown, lawyer: LawyerView) => <ApprovalBadge status={lawyer.approvalStatus} />,
    },
    {
      title: 'Plan',
      key: 'plan',
      width: 140,
      render: (_: unknown, lawyer: LawyerView) =>
        lawyer.subscription.active && lawyer.subscription.package ? (
          <Badge tone="success">{lawyer.subscription.package.name}</Badge>
        ) : (
          <Badge tone="warn">No live plan</Badge>
        ),
    },
    {
      title: 'Areas',
      key: 'areas',
      render: (_: unknown, lawyer: LawyerView) => (
        <Space wrap size={[4, 4]}>
          {lawyer.practiceAreas.slice(0, 2).map(({ legalCategory }) => (
            <Badge key={legalCategory.id} tone="info">
              {legalCategory.name}
            </Badge>
          ))}
          {lawyer.practiceAreas.length > 2 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              +{lawyer.practiceAreas.length - 2}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Fee',
      key: 'fee',
      width: 110,
      render: (_: unknown, lawyer: LawyerView) => (
        <Text type="secondary">{formatGhs(lawyer.consultationFeePesewas)}</Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right' as const,
      width: 260,
      render: (_: unknown, lawyer: LawyerView) => (
        <Space wrap size={8}>
          {lawyer.approvalStatus !== 'APPROVED' ? (
            <Button
              type="primary"
              size="small"
              onClick={() => void setApproval(lawyer.id, 'APPROVED')}
            >
              Approve
            </Button>
          ) : null}
          {lawyer.approvalStatus !== 'REJECTED' ? (
            <Button size="small" onClick={() => void setApproval(lawyer.id, 'REJECTED')}>
              Reject
            </Button>
          ) : null}
          <Button
            size="small"
            onClick={() => void grant(lawyer.id)}
            loading={grantingId === lawyer.id}
            disabled={!grantPackageId}
          >
            Grant plan
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageShell>
      <AdminShell
        title="Lawyers"
        description="Approve only after you have checked the practitioner. They also need a live plan before citizens can find them."
        action={
          <Button type="primary" onClick={() => setShowForm(true)}>
            Add a lawyer
          </Button>
        }
      >
        <div className="lc-admin__toolbar">
          <Segmented
            value={filter}
            onChange={(value) => setFilter(value as Filter)}
            options={[
              {
                label: pendingCount > 0 ? `Pending (${pendingCount})` : 'Pending',
                value: 'PENDING',
              },
              { label: 'Approved', value: 'APPROVED' },
              { label: 'Rejected', value: 'REJECTED' },
              { label: 'All', value: 'ALL' },
            ]}
          />
          <Select
            placeholder="Plan to grant"
            style={{ minWidth: 160 }}
            value={grantPackageId}
            onChange={(value) => setGrantPackageId(value)}
            allowClear
            options={
              packages.status === 'ready'
                ? packages.data.map((pkg) => ({
                    value: pkg.id,
                    label: `${pkg.name} (${pkg.maxPracticeAreas} areas)`,
                  }))
                : []
            }
          />
          <Select
            aria-label="Grant period"
            style={{ minWidth: 130 }}
            value={grantPeriodDays}
            onChange={(value) => setGrantPeriodDays(value)}
            options={[
              { value: 30, label: '1 month' },
              { value: 365, label: '1 year' },
            ]}
          />
          <Text type="secondary" style={{ fontSize: 13 }}>
            Choose a plan, then Grant on a row.
          </Text>
        </div>

        {error ? (
          <div style={{ marginBottom: 16 }}>
            <ErrorNotice message={error} />
          </div>
        ) : null}

        {lawyers.status === 'loading' ? (
          <Loading label="Loading profiles…" />
        ) : lawyers.status === 'error' ? (
          <ErrorNotice message={lawyers.message} />
        ) : lawyers.data.results.length === 0 ? (
          <EmptyState
            title="No lawyer profiles yet"
            description="Add the first practitioner to make matching possible."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing in this view"
            description="Try another filter — pending is empty when the queue is clear."
          />
        ) : (
          <div className="lc-panel">
            <Table
              rowKey="id"
              columns={columns}
              dataSource={rows}
              pagination={false}
              size="middle"
              expandable={{
                expandedRowRender: (lawyer: LawyerView) => (
                  <Paragraph type="secondary" style={{ margin: 0, maxWidth: 720 }}>
                    {lawyer.bio}
                  </Paragraph>
                ),
              }}
            />
          </div>
        )}

        <Drawer
          title="Add a lawyer"
          open={showForm}
          onClose={() => setShowForm(false)}
          width={560}
          destroyOnHidden
        >
          <Paragraph type="secondary">
            Use this to provision an account. Self-registered lawyers appear as pending until you
            approve them. Verify the licence before approving.
          </Paragraph>
          <CreateLawyerForm
            onCreated={() => {
              lawyers.reload();
            }}
          />
        </Drawer>
      </AdminShell>
    </PageShell>
  );
}
