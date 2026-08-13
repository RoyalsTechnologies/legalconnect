import { Button, Flex, Form, Input, List, Space, Typography } from 'antd';
import { useState } from 'react';
import { categoriesApi } from '../../api/endpoints';
import type { LegalCategory } from '../../api/types';
import { PageShell } from '../../components/Layout';
import { Badge, Card, ErrorNotice, Loading, PageHeading } from '../../components/ui';
import { messageFor, useAsync } from '../../hooks/useAsync';
import { AdminTabs } from './AdminTabs';

const { Title, Paragraph, Text } = Typography;

export function AdminCategoriesPage() {
  // Inactive categories are shown here and nowhere else: they are retired rather than
  // deleted, because past enquiries still point at them (ADR-008).
  const categories = useAsync(
    () => categoriesApi.list(true),
    [],
    'Could not load legal categories.',
  );

  const [form] = Form.useForm<{ name: string; description: string }>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(values: { name: string; description: string }) {
    setError(null);
    setSaving(true);
    try {
      await categoriesApi.create({
        name: values.name.trim(),
        description: values.description.trim(),
      });
      form.resetFields();
      categories.reload();
    } catch (err) {
      setError(messageFor(err, 'Could not create that category.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: string, isActive: boolean) {
    setError(null);
    try {
      if (isActive) await categoriesApi.deactivate(id);
      else await categoriesApi.update(id, { isActive: true });
      categories.reload();
    } catch (err) {
      setError(messageFor(err, 'Could not update that category.'));
    }
  }

  return (
    <PageShell>
      <main className="lc-page lc-page--wide">
        <PageHeading
          title="Legal categories"
          description="Categories drive both AI triage and lawyer matching. Retiring one hides it from new enquiries without breaking the records that already reference it."
        />
        <AdminTabs />

        <div style={{ marginTop: 24 }}>
          <Card>
            <Title level={4} className="lc-display" style={{ marginTop: 0 }}>
              Add a category
            </Title>
            <Form
              form={form}
              layout="vertical"
              style={{ marginTop: 16 }}
              onFinish={(values) => void create(values)}
            >
              <Form.Item
                label="Name"
                name="name"
                rules={[{ required: true, message: 'Name is required' }]}
              >
                <Input placeholder="e.g. Immigration & Travel" />
              </Form.Item>

              <Form.Item
                label="Description"
                name="description"
                extra="Plain language — this text helps the AI place enquiries correctly."
                rules={[{ required: true, message: 'Description is required' }]}
              >
                <Input.TextArea rows={2} />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={saving}>
                  {saving ? 'Adding…' : 'Add category'}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>

        {error ? (
          <div style={{ marginTop: 24 }}>
            <ErrorNotice message={error} />
          </div>
        ) : null}

        <div style={{ marginTop: 24 }}>
          {categories.status === 'loading' ? (
            <Loading label="Loading categories…" />
          ) : categories.status === 'error' ? (
            <ErrorNotice message={categories.message} />
          ) : (
            <List
              dataSource={categories.data}
              renderItem={(category: LegalCategory) => (
                <List.Item
                  key={category.id}
                  style={{ padding: 0, marginBottom: 12, border: 'none' }}
                >
                  <div style={{ width: '100%' }}>
                    <Card>
                      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
                        <div>
                          <Space wrap size={8}>
                            <Text strong>{category.name}</Text>
                            {category.isActive ? null : <Badge tone="neutral">Retired</Badge>}
                          </Space>
                          <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
                            {category.description}
                          </Paragraph>
                        </div>
                        <Button onClick={() => void toggle(category.id, category.isActive)}>
                          {category.isActive ? 'Retire' : 'Restore'}
                        </Button>
                      </Flex>
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
