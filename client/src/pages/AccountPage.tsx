import { Button, Form, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, fieldErrorsFromApi } from '../api/client';
import { authApi, usersApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { PageShell } from '../components/Layout';
import { Card, ErrorNotice, PageHeading, toFormFields } from '../components/ui';
import { messageFor } from '../hooks/useAsync';

const { Paragraph, Text } = Typography;

/**
 * Own-account name, phone, and password (FR-003). Email stays read-only — changing
 * it would need a new verification flow that is out of MVP scope.
 */
export function AccountPage() {
  const { user, applyUser } = useAuth();
  const [form] = Form.useForm<{ fullName: string; phone?: string }>();
  const [passwordForm] = Form.useForm<{
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!user) return null;

  async function save(values: { fullName: string; phone?: string }) {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({
        fullName: values.fullName.trim(),
        phone: values.phone?.trim() ? values.phone.trim() : null,
      });
      applyUser(updated);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = fieldErrorsFromApi(err);
        if (Object.keys(fields).length > 0) form.setFields(toFormFields(fields));
      }
      setError(messageFor(err, 'Could not save your details.'));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(values: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    setPasswordError(null);
    setPasswordSaved(false);
    setChangingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      passwordForm.resetFields();
      setPasswordSaved(true);
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = fieldErrorsFromApi(err);
        if (Object.keys(fields).length > 0) passwordForm.setFields(toFormFields(fields));
      }
      setPasswordError(messageFor(err, 'Could not update your password.'));
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <PageShell>
      <main className="lc-page lc-page--narrow">
        <PageHeading
          title="Your account"
          eyebrow={
            user.role === 'USER' ? 'Citizen' : user.role === 'LAWYER' ? 'Lawyer' : 'Administrator'
          }
          description="Your name is how lawyers see you. A Ghana mobile money number is used to pay consultation fees and to text you when a request changes."
        />

        <Space direction="vertical" size={24} style={{ width: '100%', marginTop: 24 }}>
          <Card title="Details">
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              initialValues={{ fullName: user.fullName, phone: user.phone ?? undefined }}
              onFinish={(values) => void save(values)}
            >
              <Form.Item label="Email">
                <Input value={user.email} disabled />
                <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                  Email cannot be changed here.
                </Text>
              </Form.Item>

              <Form.Item
                label="Full name"
                name="fullName"
                rules={[{ required: true, message: 'Enter your full name' }]}
              >
                <Input autoComplete="name" />
              </Form.Item>

              <Form.Item
                label="Mobile money / phone"
                name="phone"
                extra="Ghana number, e.g. 0244123456. Leave blank if you prefer to enter it only when paying."
                rules={[
                  {
                    pattern: /^$|^(\+233|0)\d{9}$/,
                    message: 'Enter a valid Ghana phone number, e.g. 0244123456',
                  },
                ]}
              >
                <Input type="tel" autoComplete="tel" placeholder="0244123456" />
              </Form.Item>

              {error ? <ErrorNotice message={error} /> : null}
              {saved ? (
                <Paragraph type="secondary" role="status">
                  Saved.
                </Paragraph>
              ) : null}

              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={saving}>
                  Save details
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Card title="Password">
            <Form
              form={passwordForm}
              layout="vertical"
              requiredMark={false}
              onFinish={(values) => void changePassword(values)}
            >
              <Form.Item
                label="Current password"
                name="currentPassword"
                rules={[{ required: true, message: 'Enter your current password' }]}
              >
                <Input.Password autoComplete="current-password" />
              </Form.Item>

              <Form.Item
                label="New password"
                name="newPassword"
                rules={[
                  { required: true, message: 'Enter a new password' },
                  { min: 8, message: 'At least 8 characters' },
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>

              <Form.Item
                label="Confirm new password"
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Confirm your new password' },
                  ({ getFieldValue }) => ({
                    validator(_, value: string) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Passwords do not match'));
                    },
                  }),
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>

              {passwordError ? <ErrorNotice message={passwordError} /> : null}
              {passwordSaved ? (
                <Paragraph type="secondary" role="status">
                  Password updated. Use it the next time you sign in.
                </Paragraph>
              ) : null}

              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={changingPassword}>
                  Update password
                </Button>
              </Form.Item>
            </Form>
            <Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
              If you do not remember your current password,{' '}
              <Link to="/forgot-password">reset it by email</Link>.
            </Paragraph>
          </Card>
        </Space>
      </main>
    </PageShell>
  );
}
