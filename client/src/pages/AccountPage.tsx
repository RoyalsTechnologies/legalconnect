import { Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { ApiError, fieldErrorsFromApi } from '../api/client';
import { usersApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { PageShell } from '../components/Layout';
import { Card, ErrorNotice, PageHeading, toFormFields } from '../components/ui';
import { messageFor } from '../hooks/useAsync';

const { Paragraph, Text } = Typography;

/**
 * Own-account name and phone (FR-003). Email stays read-only — changing it would
 * need a new verification flow that is out of MVP scope.
 */
export function AccountPage() {
  const { user, applyUser } = useAuth();
  const [form] = Form.useForm<{ fullName: string; phone?: string }>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <PageShell>
      <main className="lc-page lc-page--narrow">
        <PageHeading
          title="Your account"
          description="Your name is how lawyers see you. A Ghana mobile money number is used to pay consultation fees and to text you when a request changes."
        />

        <div style={{ marginTop: 24 }}>
          <Card>
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
        </div>
      </main>
    </PageShell>
  );
}
