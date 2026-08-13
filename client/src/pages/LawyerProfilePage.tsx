import {
  Alert,
  Button,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Space,
  Switch,
} from 'antd';
import { useEffect, useState } from 'react';
import { ApiError, fieldErrorsFromApi } from '../api/client';
import { categoriesApi, lawyersApi, packagesApi } from '../api/endpoints';
import type { LawyerView, SubscriptionPackage } from '../api/types';
import { PageShell } from '../components/Layout';
import { MomoPayFields, type MomoPayValues } from '../components/MomoPayFields';
import {
  ApprovalBadge,
  Badge,
  Card,
  ErrorNotice,
  formatDate,
  formatGhs,
  Loading,
  PageHeading,
  toFormFields,
} from '../components/ui';
import { messageFor, useAsync } from '../hooks/useAsync';
import { usePendingPayment } from '../hooks/usePendingPayment';

interface FormState {
  displayName: string;
  firmName: string;
  bio: string;
  licenseNumber: string;
  city: string;
  region: string;
  yearsExperience: number | null;
  consultationFeeGhs: number;
  isAvailable: boolean;
  practiceAreaIds: string[];
}

function valuesFromProfile(data: LawyerView): FormState {
  return {
    displayName: data.displayName,
    firmName: data.firmName ?? '',
    bio: data.bio,
    licenseNumber: data.licenseNumber ?? '',
    city: data.city,
    region: data.region,
    yearsExperience: data.yearsExperience,
    consultationFeeGhs: data.consultationFeePesewas / 100,
    isAvailable: data.isAvailable,
    practiceAreaIds: data.practiceAreas.map((area) => area.legalCategory.id),
  };
}

function PlanSection({
  profile,
  onUpdated,
}: {
  profile: LawyerView;
  onUpdated: (next: LawyerView) => void;
}) {
  const packages = useAsync(() => packagesApi.list(), [], 'Could not load subscription plans.');
  const [form] = Form.useForm<MomoPayValues & { packageId: string; interval: 'month' | 'year' }>();
  const interval = Form.useWatch('interval', form) ?? 'month';
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const current = profile.subscription;
  const maxAreas = current.active ? (current.package?.maxPracticeAreas ?? null) : null;

  async function pay(values: MomoPayValues & { packageId: string; interval: 'month' | 'year' }) {
    setError(null);
    setPaying(true);
    try {
      const started = await lawyersApi.subscribe({
        packageId: values.packageId,
        interval: values.interval,
        phone: values.phone,
        network: values.network,
      });
      if (started.subscription.active) {
        const refreshed = await lawyersApi.me();
        onUpdated(refreshed);
        setHint(null);
        setReference(null);
        return;
      }
      setHint(started.paymentHint);
      setReference(started.reference);
    } catch (err) {
      setError(messageFor(err, 'Could not start that subscription payment.'));
    } finally {
      setPaying(false);
    }
  }

  async function confirm() {
    if (!reference) return;
    setError(null);
    setPaying(true);
    try {
      await lawyersApi.confirmSubscription(reference);
      onUpdated(await lawyersApi.me());
      setHint(null);
      setReference(null);
    } catch (err) {
      setError(messageFor(err, 'Payment has not been confirmed yet.'));
    } finally {
      setPaying(false);
    }
  }

  usePendingPayment(Boolean(reference) && !current.active, async () => {
    if (!reference) return false;
    try {
      await lawyersApi.confirmSubscription(reference);
      onUpdated(await lawyersApi.me());
      setHint(null);
      setReference(null);
      return true;
    } catch {
      return false;
    }
  });

  return (
    <Card>
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        {current.active && current.package ? (
          <Alert
            type="success"
            showIcon
            message={`${current.package.name} plan is active`}
            description={`You may list up to ${current.package.maxPracticeAreas} practice area${current.package.maxPracticeAreas === 1 ? '' : 's'}. ${current.periodEnd ? `Renews or lapses on ${formatDate(current.periodEnd)}.` : ''} Pay one month or one year at a time — a year is twelve times the current monthly fee.`}
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            message="Citizens cannot find you until you subscribe"
            description="Choose a plan and pay for one month or one year. Each plan is for a set number of legal areas of interest — you will only appear in matching for the areas you list."
          />
        )}

        {packages.status === 'loading' ? (
          <Loading label="Loading plans…" />
        ) : packages.status === 'error' ? (
          <ErrorNotice message={packages.message} />
        ) : (
          <Row gutter={[12, 12]}>
            {packages.data.map((pkg) => (
              <Col xs={24} md={8} key={pkg.id}>
                <Card>
                  <Space wrap size={8}>
                    <strong>{pkg.name}</strong>
                    {current.package?.id === pkg.id && current.active ? (
                      <Badge tone="success">Current</Badge>
                    ) : null}
                  </Space>
                  <p style={{ marginTop: 8, marginBottom: 8 }}>{pkg.description}</p>
                  <p style={{ marginBottom: 0 }}>
                    {formatGhs(pkg.monthlyFeePesewas)} / month ·{' '}
                    {formatGhs(pkg.monthlyFeePesewas * 12)} / year · {pkg.maxPracticeAreas} area
                    {pkg.maxPracticeAreas === 1 ? '' : 's'}
                  </p>
                </Card>
              </Col>
            ))}
          </Row>
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => void pay(values)}
          initialValues={{ packageId: current.package?.id, interval: 'month' }}
        >
          <Form.Item
            label="Plan"
            name="packageId"
            rules={[{ required: true, message: 'Choose a plan' }]}
          >
            <Radio.Group
              options={
                packages.status === 'ready'
                  ? packages.data.map((pkg: SubscriptionPackage) => ({
                      label: `${pkg.name} — ${pkg.maxPracticeAreas} area${pkg.maxPracticeAreas === 1 ? '' : 's'}`,
                      value: pkg.id,
                    }))
                  : []
              }
            />
          </Form.Item>
          <Form.Item
            label="How long"
            name="interval"
            rules={[{ required: true, message: 'Choose a month or a year' }]}
          >
            <Radio.Group
              options={[
                { label: 'One month', value: 'month' },
                { label: 'One year (12 × the current monthly fee)', value: 'year' },
              ]}
            />
          </Form.Item>
          <MomoPayFields />
          {error ? <ErrorNotice message={error} /> : null}
          {hint ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={hint}
              description="This page checks every few seconds. You can also tap the button when you have approved the prompt."
            />
          ) : null}
          <Space wrap>
            <Button type="primary" htmlType="submit" loading={paying}>
              {paying
                ? 'Starting…'
                : interval === 'year'
                  ? 'Pay for this year'
                  : 'Pay for this month'}
            </Button>
            {reference ? (
              <Button onClick={() => void confirm()} loading={paying}>
                I have approved the prompt
              </Button>
            ) : null}
          </Space>
        </Form>
      </Space>
      {maxAreas ? (
        <p style={{ marginTop: 16, marginBottom: 0, color: '#5b6b82', fontSize: 13 }}>
          Your current plan allows {maxAreas} practice area{maxAreas === 1 ? '' : 's'}. Drop extras
          before switching to a smaller plan.
        </p>
      ) : null}
    </Card>
  );
}

export function LawyerProfilePage() {
  const profile = useAsync(() => lawyersApi.me(), [], 'Could not load your profile.');
  const categories = useAsync(
    () => categoriesApi.selectable(),
    [],
    'Could not load practice areas.',
  );

  const [form] = Form.useForm<FormState>();
  // Local copy so a post-save refresh cannot blank the form while useAsync is
  // briefly back in `loading` (which discards prior data).
  const [snapshot, setSnapshot] = useState<LawyerView | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile.status !== 'ready') return;
    setSnapshot(profile.data);
    form.setFieldsValue(valuesFromProfile(profile.data));
  }, [profile, form]);

  if (profile.status === 'error' && !snapshot) {
    return (
      <PageShell>
        <main className="lc-page lc-page--medium">
          <ErrorNotice message={profile.message} />
        </main>
      </PageShell>
    );
  }

  if (!snapshot) {
    return (
      <PageShell>
        <main className="lc-page lc-page--medium">
          <Loading label="Loading your profile…" />
        </main>
      </PageShell>
    );
  }

  async function save(values: FormState) {
    setError(null);
    setSaving(true);

    try {
      const updated = await lawyersApi.updateMe({
        displayName: values.displayName.trim(),
        firmName: values.firmName.trim() || null,
        bio: values.bio.trim(),
        licenseNumber: values.licenseNumber.trim() || null,
        city: values.city.trim(),
        region: values.region.trim(),
        yearsExperience: values.yearsExperience === null ? null : Number(values.yearsExperience),
        consultationFeeGhs: Number(values.consultationFeeGhs),
        isAvailable: values.isAvailable,
        practiceAreaIds: values.practiceAreaIds ?? [],
      });
      setSnapshot(updated);
      form.setFieldsValue(valuesFromProfile(updated));
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError) {
        form.setFields(toFormFields(fieldErrorsFromApi(err)));
      }
      setError(messageFor(err, 'Could not save your profile.'));
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
    <PageShell>
      <main className="lc-page lc-page--medium">
        <PageHeading
          title="Your professional profile"
          description="This is what citizens see in the directory and in recommendations. Keep your practice areas accurate — matching relies on them."
          action={<ApprovalBadge status={snapshot.approvalStatus} />}
        />

        <Space orientation="vertical" size="large" style={{ width: '100%', marginTop: 24 }}>
          {snapshot.approvalStatus === 'PENDING' ? (
            <Alert
              type="warning"
              showIcon
              message="Your profile is waiting for an administrator to review it. It is not visible in the directory yet."
            />
          ) : null}
          {snapshot.approvalStatus === 'REJECTED' ? (
            <Alert
              type="error"
              showIcon
              message="Your profile was not approved. You can update your details and wait for another review."
            />
          ) : null}

          <PlanSection profile={snapshot} onUpdated={setSnapshot} />

          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => void save(values)}
            onValuesChange={() => setSaved(false)}
          >
            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              <Card>
                <Form.Item
                  label="Display name"
                  name="displayName"
                  rules={[{ required: true, message: 'Display name is required' }]}
                >
                  <Input />
                </Form.Item>

                <Form.Item label="Firm or chambers (optional)" name="firmName">
                  <Input />
                </Form.Item>

                <Form.Item
                  label="Licence or roll number (optional)"
                  name="licenseNumber"
                  extra="Shown to administrators reviewing your profile."
                >
                  <Input />
                </Form.Item>

                <Form.Item
                  label="About your practice"
                  name="bio"
                  extra="Describe the matters you handle in plain language. At least a short paragraph."
                  rules={[{ required: true, message: 'A short description is required' }]}
                >
                  <Input.TextArea rows={6} />
                </Form.Item>
              </Card>

              <Card>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="City" name="city" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Region" name="region" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="Years in practice" name="yearsExperience">
                  <InputNumber min={0} max={70} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  label="Consultation fee (GHS)"
                  name="consultationFeeGhs"
                  extra="What a citizen pays to send you a consultation request. Each lawyer sets their own fee."
                  rules={[{ required: true, message: 'Set a consultation fee' }]}
                >
                  <InputNumber min={1} max={50000} step={10} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  name="isAvailable"
                  valuePropName="checked"
                  label="I am accepting new enquiries"
                  extra="Turning this off keeps your profile visible but ranks you lower in recommendations."
                >
                  <Switch />
                </Form.Item>
              </Card>

              <Card>
                <Form.Item
                  label="Practice areas"
                  name="practiceAreaIds"
                  extra={
                    snapshot.subscription.active && snapshot.subscription.package
                      ? `Your ${snapshot.subscription.package.name} plan allows ${snapshot.subscription.package.maxPracticeAreas} area${snapshot.subscription.package.maxPracticeAreas === 1 ? '' : 's'}. Recommendations only reach lawyers who list the matching area.`
                      : 'Choose the areas you genuinely handle. The number you can list is set by your plan.'
                  }
                >
                  <Checkbox.Group
                    options={practiceOptions}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
                  />
                </Form.Item>
              </Card>

              {error ? <ErrorNotice message={error} /> : null}
              {saved ? (
                <Alert
                  type="success"
                  showIcon
                  message="Your profile has been saved."
                  role="status"
                />
              ) : null}

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={saving}>
                  {saving ? 'Saving…' : 'Save profile'}
                </Button>
              </Form.Item>
            </Space>
          </Form>
        </Space>
      </main>
    </PageShell>
  );
}
