import { Alert, Button, Card, Form, Input, Result, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { authApi } from '../api/endpoints';
import { PageShell } from '../components/Layout';
import { Loading } from '../components/ui';

const { Title, Paragraph } = Typography;

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This confirmation link is missing a token.');
      return;
    }

    let cancelled = false;
    authApi
      .verifyEmail({ token })
      .then((result) => {
        if (cancelled) return;
        setMessage(result.message);
        setStatus('ok');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMessage(
          error instanceof ApiError ? error.message : 'Could not confirm this email address.',
        );
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <PageShell>
      <main className="lc-page lc-page--narrow">
        {status === 'loading' ? <Loading label="Confirming your email…" /> : null}
        {status === 'ok' ? (
          <Result
            status="success"
            title="Email confirmed"
            subTitle={message}
            extra={
              <Link to="/login">
                <Button type="primary">Sign in</Button>
              </Link>
            }
          />
        ) : null}
        {status === 'error' ? (
          <Result
            status="error"
            title="Could not confirm email"
            subTitle={message}
            extra={
              <Link to="/login">
                <Button>Back to sign in</Button>
              </Link>
            }
          />
        ) : null}
      </main>
    </PageShell>
  );
}

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: { email: string }) {
    setError(null);
    setSubmitting(true);
    try {
      await authApi.forgotPassword({ email: values.email.trim() });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start a password reset.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell>
      <main className="lc-page lc-page--narrow">
        <Title level={1} className="lc-display">
          Forgot your password?
        </Title>
        <Paragraph type="secondary">
          Enter the email for your account. If it exists, we will send a reset link.
        </Paragraph>

        <Card style={{ marginTop: 24 }}>
          {submitted ? (
            <Alert
              type="success"
              showIcon
              message="If that email is registered, we sent a reset link. Check your inbox."
            />
          ) : (
            <Form
              layout="vertical"
              onFinish={(values) => void onFinish(values)}
              requiredMark={false}
            >
              <Form.Item
                label="Email"
                name="email"
                rules={[{ required: true, message: 'Email is required' }]}
              >
                <Input type="email" autoComplete="email" />
              </Form.Item>
              {error ? (
                <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
              ) : null}
              <Button type="primary" htmlType="submit" block loading={submitting}>
                Send reset link
              </Button>
            </Form>
          )}
        </Card>

        <Paragraph style={{ marginTop: 24 }}>
          <Link to="/login">Back to sign in</Link>
        </Paragraph>
      </main>
    </PageShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: { password: string }) {
    setError(null);
    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, password: values.password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset your password.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <PageShell>
        <main className="lc-page lc-page--narrow">
          <Alert type="error" showIcon message="This reset link is missing a token." />
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main className="lc-page lc-page--narrow">
        <Title level={1} className="lc-display">
          Choose a new password
        </Title>
        <Paragraph type="secondary">Use at least 8 characters.</Paragraph>

        <Card style={{ marginTop: 24 }}>
          {done ? (
            <Result
              status="success"
              title="Password updated"
              extra={
                <Link to="/login">
                  <Button type="primary">Sign in</Button>
                </Link>
              }
            />
          ) : (
            <Form
              layout="vertical"
              onFinish={(values) => void onFinish(values)}
              requiredMark={false}
            >
              <Form.Item
                label="New password"
                name="password"
                rules={[
                  { required: true, message: 'Password is required' },
                  { min: 8, message: 'At least 8 characters' },
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                label="Confirm new password"
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Confirm your new password' },
                  ({ getFieldValue }) => ({
                    validator(_, value: string) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Passwords do not match'));
                    },
                  }),
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              {error ? (
                <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
              ) : null}
              <Button type="primary" htmlType="submit" block loading={submitting}>
                Update password
              </Button>
            </Form>
          )}
        </Card>
      </main>
    </PageShell>
  );
}
