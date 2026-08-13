import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, fieldErrorsFromApi } from '../api/client';
import { authApi, categoriesApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { PageShell } from '../components/Layout';
import { Loading, toFormFields } from '../components/ui';
import { useAsync } from '../hooks/useAsync';

const { Title, Paragraph, Text } = Typography;

type AccountType = 'citizen' | 'lawyer';

type RegisterValues = {
  accountType: AccountType;
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  displayName?: string;
  firmName?: string;
  bio?: string;
  licenseNumber?: string;
  city?: string;
  region?: string;
  yearsExperience?: number | null;
  consultationFeeGhs?: number;
  practiceAreaIds?: string[];
};

export function RegisterPage() {
  const { register, isAuthenticated, state } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialType: AccountType = params.get('as') === 'lawyer' ? 'lawyer' : 'citizen';
  const [form] = Form.useForm<RegisterValues>();
  const accountType = Form.useWatch('accountType', form) ?? initialType;
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const categories = useAsync(
    () => categoriesApi.selectable(),
    [],
    'Could not load practice areas.',
  );

  const practiceOptions = useMemo(
    () =>
      categories.status === 'ready'
        ? categories.data.map((category) => ({
            label: category.name,
            value: category.id,
          }))
        : [],
    [categories],
  );

  if (state.status === 'loading') {
    return (
      <PageShell>
        <main className="lc-page lc-page--narrow">
          <Loading />
        </main>
      </PageShell>
    );
  }

  if (isAuthenticated) return <Navigate to="/app" replace />;

  async function onFinish(values: RegisterValues) {
    setFormError(null);
    form.setFields([]);
    setSubmitting(true);
    try {
      const asLawyer = values.accountType === 'lawyer';
      const result = await register({
        accountType: values.accountType,
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        password: values.password,
        phone: values.phone?.trim() || undefined,
        ...(asLawyer
          ? {
              displayName: values.displayName?.trim() || values.fullName.trim(),
              firmName: values.firmName?.trim() || undefined,
              bio: values.bio?.trim(),
              licenseNumber: values.licenseNumber?.trim() || undefined,
              city: values.city?.trim(),
              region: values.region?.trim(),
              yearsExperience:
                values.yearsExperience === null || values.yearsExperience === undefined
                  ? undefined
                  : Number(values.yearsExperience),
              consultationFeeGhs: Number(values.consultationFeeGhs),
              practiceAreaIds: values.practiceAreaIds ?? [],
            }
          : {}),
      });
      const next = asLawyer
        ? `/check-email?email=${encodeURIComponent(result.email)}&as=lawyer`
        : `/check-email?email=${encodeURIComponent(result.email)}`;
      void navigate(next, { replace: true });
    } catch (error) {
      form.setFields(toFormFields(fieldErrorsFromApi(error)));
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Could not create your account. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell>
      <main className="lc-page lc-page--narrow">
        <Title level={1} className="lc-display">
          Create your account
        </Title>
        <Paragraph type="secondary">
          Citizens describe a concern in their own words. Lawyers apply with a professional profile
          that an administrator reviews before it is public.
        </Paragraph>

        <Card style={{ marginTop: 32 }}>
          <Form
            form={form}
            layout="vertical"
            initialValues={{ accountType: initialType }}
            onFinish={(values) => void onFinish(values)}
            noValidate
            requiredMark={false}
          >
            <Form.Item name="accountType" label="I am">
              <Radio.Group>
                <Radio.Button value="citizen">Seeking legal help</Radio.Button>
                <Radio.Button value="lawyer">A lawyer</Radio.Button>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              label="Full name"
              name="fullName"
              rules={[{ required: true, message: 'Full name is required' }]}
            >
              <Input autoComplete="name" />
            </Form.Item>

            <Form.Item
              label="Email"
              name="email"
              rules={[{ required: true, message: 'Email is required' }]}
            >
              <Input type="email" autoComplete="email" />
            </Form.Item>

            <Form.Item
              label="Phone (optional)"
              name="phone"
              extra="Ghana number, e.g. 0244123456. Needed to pay consultation fees by mobile money."
            >
              <Input type="tel" autoComplete="tel" />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              extra="At least 8 characters"
              rules={[
                { required: true, message: 'Password is required' },
                { min: 8, message: 'At least 8 characters' },
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>

            {accountType === 'lawyer' ? (
              <>
                <Form.Item
                  label="Display name"
                  name="displayName"
                  extra="How you appear in the directory. Defaults to your full name."
                >
                  <Input />
                </Form.Item>

                <Form.Item label="Firm or chambers (optional)" name="firmName">
                  <Input />
                </Form.Item>

                <Form.Item
                  label="Licence or roll number (optional)"
                  name="licenseNumber"
                  extra="Helps the administrator verify you. This is not an automated licence check."
                >
                  <Input />
                </Form.Item>

                <Form.Item
                  label="About your practice"
                  name="bio"
                  extra="A short paragraph in plain language. At least 30 characters."
                  rules={[
                    { required: true, message: 'A short description is required' },
                    { min: 30, message: 'Write at least a short paragraph' },
                  ]}
                >
                  <Input.TextArea rows={5} />
                </Form.Item>

                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="City"
                      name="city"
                      rules={[{ required: true, message: 'City is required' }]}
                    >
                      <Input placeholder="e.g. Accra" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Region"
                      name="region"
                      rules={[{ required: true, message: 'Region is required' }]}
                    >
                      <Input placeholder="e.g. Greater Accra" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="Years in practice (optional)" name="yearsExperience">
                  <InputNumber min={0} max={70} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  label="Consultation fee (GHS)"
                  name="consultationFeeGhs"
                  extra="What a citizen pays to book you. You can change this later."
                  rules={[{ required: true, message: 'Set a consultation fee' }]}
                >
                  <InputNumber min={1} max={50000} step={10} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  label="Practice areas"
                  name="practiceAreaIds"
                  extra="Choose the areas you genuinely handle. After approval you subscribe to a plan that caps how many you can list."
                  rules={[{ required: true, message: 'Select at least one practice area' }]}
                >
                  <Checkbox.Group
                    options={practiceOptions}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
                  />
                </Form.Item>

                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="Your profile stays hidden until an administrator approves it. Approval means a person reviewed this record — not that a licence register was checked automatically."
                />
              </>
            ) : null}

            {formError ? (
              <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />
            ) : null}

            <Button type="primary" htmlType="submit" block loading={submitting}>
              {submitting
                ? 'Creating account…'
                : accountType === 'lawyer'
                  ? 'Apply as a lawyer'
                  : 'Create account'}
            </Button>
          </Form>
        </Card>

        <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 24 }}>
          Already have an account?{' '}
          <Link to="/login">
            <Text strong style={{ color: '#1f4a9a' }}>
              Sign in
            </Text>
          </Link>
        </Paragraph>
      </main>
    </PageShell>
  );
}

export function CheckEmailPage() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const asLawyer = params.get('as') === 'lawyer';
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function resend() {
    if (!email) return;
    setError(null);
    setSending(true);
    try {
      await authApi.resendVerification({ email });
      setResent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend the email.');
    } finally {
      setSending(false);
    }
  }

  return (
    <PageShell>
      <main className="lc-page lc-page--narrow">
        <Title level={1} className="lc-display">
          Check your email
        </Title>
        <Paragraph type="secondary">
          We sent a confirmation link{email ? ` to ${email}` : ''}. Open it to activate your
          account, then sign in.
        </Paragraph>
        {asLawyer ? (
          <Paragraph type="secondary">
            After you confirm, an administrator reviews your profile. After approval, choose a plan
            on My profile — citizens cannot find you until that plan is live.
          </Paragraph>
        ) : null}
        <Card style={{ marginTop: 24 }}>
          {resent ? (
            <Alert
              type="success"
              showIcon
              message="If that address has an account, we sent another link."
            />
          ) : null}
          {error ? (
            <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
          ) : null}
          <Button type="default" loading={sending} disabled={!email} onClick={() => void resend()}>
            Resend confirmation email
          </Button>
          <div style={{ marginTop: 16 }}>
            <Link to="/login">
              <Button type="primary">Go to sign in</Button>
            </Link>
          </div>
        </Card>
      </main>
    </PageShell>
  );
}
