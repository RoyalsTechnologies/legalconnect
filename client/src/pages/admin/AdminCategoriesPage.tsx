import { Button, Form, Input, Table, Typography } from 'antd';
import { useState } from 'react';
import { ApiError, fieldErrorsFromApi } from '../../api/client';
import { categoriesApi } from '../../api/endpoints';
import type { LegalCategory } from '../../api/types';
import { PageShell } from '../../components/Layout';
import { Badge, Card, ErrorNotice, Loading, toFormFields } from '../../components/ui';
import { messageFor, useAsync } from '../../hooks/useAsync';
import { AdminShell } from './AdminTabs';

const { Text } = Typography;

export function AdminCategoriesPage() {
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
      if (err instanceof ApiError) form.setFields(toFormFields(fieldErrorsFromApi(err)));
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

  const columns = [
    {
      title: 'Category',
      key: 'name',
      render: (_: unknown, category: LegalCategory) => (
        <div>
          <Text strong>{category.name}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {category.description}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_: unknown, category: LegalCategory) =>
        category.isActive ? (
          <Badge tone="success">Offered</Badge>
        ) : (
          <Badge tone="neutral">Retired</Badge>
        ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right' as const,
      width: 120,
      render: (_: unknown, category: LegalCategory) => (
        <Button size="small" onClick={() => void toggle(category.id, category.isActive)}>
          {category.isActive ? 'Retire' : 'Restore'}
        </Button>
      ),
    },
  ];

  return (
    <PageShell>
      <AdminShell
        title="Categories"
        description="These drive AI triage and matching. Retiring one hides it from new work without breaking old records."
      >
        <div className="lc-admin-split">
          <Card title="Add a category">
            <Form form={form} layout="vertical" onFinish={(values) => void create(values)}>
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
                extra="Plain language — this helps the AI place enquiries."
                rules={[{ required: true, message: 'Description is required' }]}
              >
                <Input.TextArea rows={3} />
              </Form.Item>
              {error ? <ErrorNotice message={error} /> : null}
              <Button type="primary" htmlType="submit" loading={saving}>
                {saving ? 'Adding…' : 'Add category'}
              </Button>
            </Form>
          </Card>

          <div>
            {categories.status === 'loading' ? (
              <Loading label="Loading categories…" />
            ) : categories.status === 'error' ? (
              <ErrorNotice message={categories.message} />
            ) : (
              <div className="lc-panel">
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={categories.data}
                  pagination={false}
                  size="middle"
                />
              </div>
            )}
          </div>
        </div>
      </AdminShell>
    </PageShell>
  );
}
