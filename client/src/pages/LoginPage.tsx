import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError, fieldErrorsFromApi } from '../api/client';
import { authApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { PageShell } from '../components/Layout';
import { Loading, toFormFields } from '../components/ui';

const { Title, Paragraph, Text } = Typography;

type LoginValues = {
  email: string;
  password: string;
};

export function LoginPage() {
  const { login, isAuthenticated, state } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginValues>();
  const [formError, setFormError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

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

  async function onFinish(values: LoginValues) {
    setFormError(null);
    setNeedsVerify(false);
    setResent(false);
    form.setFields([]);
    setSubmitting(true);
    try {
      await login(values.email.trim(), values.password);
      void navigate('/app', { replace: true });
    } catch (error) {
      form.setFields(toFormFields(fieldErrorsFromApi(error)));
      const message =
        error instanceof ApiError ? error.message : 'Could not sign in. Please try again.';
      setFormError(message);
      if (
        error instanceof ApiError &&
        error.status === 403 &&
        message.includes('Confirm your email')
      ) {
        setNeedsVerify(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    const email = form.getFieldValue('email')?.trim();
    if (!email) return;
    setResending(true);
    setResent(false);
    try {
      await authApi.resendVerification({ email });
      setResent(true);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not resend the email.');
    } finally {
      setResending(false);
    }
  }

  return (
    <PageShell>
      <main className="lc-page lc-page--narrow">
        <Title level={1} className="lc-display" style={{ marginBottom: 8 }}>
          Welcome back
        </Title>
        <Paragraph type="secondary">
          One sign-in for everyone — members of the public, lawyers, and administrators. You will be
          taken to the right place for your account.
        </Paragraph>

        <Card style={{ marginTop: 28 }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => void onFinish(values)}
            noValidate
            requiredMark={false}
          >
            <Form.Item
              label="Email"
              name="email"
              rules={[{ required: true, message: 'Email is required' }]}
            >
              <Input type="email" autoComplete="email" />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'Password is required' }]}
              extra={
                <Link to="/forgot-password">
                  <Text style={{ color: '#1f4a9a' }}>Forgot password?</Text>
                </Link>
              }
            >
              <Input.Password autoComplete="current-password" />
            </Form.Item>

            {formError ? (
              <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />
            ) : null}

            {needsVerify ? (
              <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
                <Button loading={resending} onClick={() => void resend()}>
                  Resend confirmation email
                </Button>
                {resent ? (
                  <Alert
                    type="success"
                    showIcon
                    message="If that address needs confirming, we sent another link."
                  />
                ) : null}
              </Space>
            ) : null}

            <Button type="primary" htmlType="submit" block loading={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Form>
        </Card>

        <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 24 }}>
          New here?{' '}
          <Link to="/register">
            <Text strong style={{ color: '#1f4a9a' }}>
              Create an account
            </Text>
          </Link>
        </Paragraph>
      </main>
    </PageShell>
  );
}
