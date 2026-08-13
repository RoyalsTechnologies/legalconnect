import {
  Alert,
  Button,
  Checkbox,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Row,
  Select,
  Space,
  Typography,
} from 'antd';
import { useState } from 'react';
import { ApiError, fieldErrorsFromApi } from '../../api/client';
import { adminApi, categoriesApi, lawyersApi, packagesApi } from '../../api/endpoints';
import type { ApprovalStatus, LawyerView } from '../../api/types';
import { PageShell } from '../../components/Layout';
import {
  ApprovalBadge,
  Badge,
  Card,
  EmptyState,
  ErrorNotice,
  formatGhs,
  Loading,
  PageHeading,
  RegionSelect,
  toFormFields,
} from '../../components/ui';
import { messageFor, useAsync } from '../../hooks/useAsync';
import { AdminTabs } from './AdminTabs';

const { Title, Paragraph, Text } = Typography;

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

/**
 * Optional admin-created accounts (invitation-style). Most lawyers now self-register
 * and wait for approval. New profiles still start pending.
 */
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
    <Card>
      <Title level={4} className="lc-display" style={{ marginTop: 0 }}>
        Add a lawyer
      </Title>
      <Paragraph type="secondary">
        Use this when you need to provision an account yourself. Self-registered lawyers appear in
        the list below as pending until you approve them. Verify the licence before approving.
      </Paragraph>

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
              extra="Share it with the lawyer directly and ask them to change it."
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
          <Col xs={24} sm={12}>
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
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}
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

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            {saving ? 'Creating…' : 'Create lawyer account'}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

export function AdminLawyersPage() {
  const [showForm, setShowForm] = useState(false);
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

  return (
    <PageShell>
      <main className="lc-page lc-page--wide">
        <PageHeading
          title="Lawyers"
          description="Self-registered lawyers wait here as pending. Approve a profile only after you have checked the practitioner. They also need a live plan before citizens can find them."
          action={
            <Button type={showForm ? 'default' : 'primary'} onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Close' : 'Add a lawyer'}
            </Button>
          }
        />
        <AdminTabs />

        {showForm ? (
          <div style={{ marginTop: 24 }}>
            <CreateLawyerForm onCreated={() => lawyers.reload()} />
          </div>
        ) : null}

        {error ? (
          <div style={{ marginTop: 24 }}>
            <ErrorNotice message={error} />
          </div>
        ) : null}

        <div style={{ marginTop: 24 }}>
          {lawyers.status === 'loading' ? (
            <Loading label="Loading profiles…" />
          ) : lawyers.status === 'error' ? (
            <ErrorNotice message={lawyers.message} />
          ) : lawyers.data.results.length === 0 ? (
            <EmptyState
              title="No lawyer profiles yet"
              description="Add the first practitioner to make matching possible."
            />
          ) : (
            <List
              dataSource={[...lawyers.data.results].sort((a, b) => {
                const rank = { PENDING: 0, REJECTED: 1, APPROVED: 2 };
                return rank[a.approvalStatus] - rank[b.approvalStatus];
              })}
              renderItem={(lawyer: LawyerView) => (
                <List.Item key={lawyer.id} style={{ padding: 0, marginBottom: 16, border: 'none' }}>
                  <div style={{ width: '100%' }}>
                    <Card>
                      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
                        <div>
                          <Space wrap size={8}>
                            <Title level={4} className="lc-display" style={{ margin: 0 }}>
                              {lawyer.displayName}
                            </Title>
                            <Space wrap>
                              <ApprovalBadge status={lawyer.approvalStatus} />
                              {lawyer.subscription.active && lawyer.subscription.package ? (
                                <Badge tone="success">
                                  {lawyer.subscription.package.name} plan
                                </Badge>
                              ) : (
                                <Badge tone="warn">No live plan</Badge>
                              )}
                            </Space>
                          </Space>
                          <Text type="secondary">
                            {lawyer.firmName ? `${lawyer.firmName} · ` : ''}
                            {lawyer.city}, {lawyer.region}
                            {` · ${formatGhs(lawyer.consultationFeePesewas)}`}
                            {lawyer.licenseNumber ? ` · Licence ${lawyer.licenseNumber}` : ''}
                          </Text>
                        </div>

                        <Space wrap>
                          {lawyer.approvalStatus !== 'APPROVED' ? (
                            <Button
                              type="primary"
                              onClick={() => void setApproval(lawyer.id, 'APPROVED')}
                            >
                              Approve
                            </Button>
                          ) : null}
                          {lawyer.approvalStatus !== 'REJECTED' ? (
                            <Button onClick={() => void setApproval(lawyer.id, 'REJECTED')}>
                              Reject
                            </Button>
                          ) : null}
                          <Select
                            placeholder="Grant a plan"
                            style={{ minWidth: 160 }}
                            value={grantPackageId}
                            onChange={(value) => setGrantPackageId(value)}
                            options={
                              packages.status === 'ready'
                                ? packages.data.map((pkg) => ({
                                    value: pkg.id,
                                    label: `${pkg.name} (${pkg.maxPracticeAreas})`,
                                  }))
                                : []
                            }
                          />
                          <Select
                            aria-label="Grant period"
                            style={{ minWidth: 140 }}
                            value={grantPeriodDays}
                            onChange={(value) => setGrantPeriodDays(value)}
                            options={[
                              { value: 30, label: '1 month' },
                              { value: 365, label: '1 year' },
                            ]}
                          />
                          <Button
                            onClick={() => void grant(lawyer.id)}
                            loading={grantingId === lawyer.id}
                            disabled={!grantPackageId}
                          >
                            Grant
                          </Button>
                        </Space>
                      </Flex>

                      <Paragraph type="secondary" className="lc-clamp-2" style={{ marginTop: 12 }}>
                        {lawyer.bio}
                      </Paragraph>

                      <Space wrap size={[6, 6]} style={{ marginTop: 8 }}>
                        {lawyer.practiceAreas.map(({ legalCategory }) => (
                          <Badge key={legalCategory.id} tone="info">
                            {legalCategory.name}
                          </Badge>
                        ))}
                      </Space>
                    </Card>
                  </div>
                </List.Item>
              )}
            />
          )}
        </div>
      </main>
    </PageShell>
  );
}
