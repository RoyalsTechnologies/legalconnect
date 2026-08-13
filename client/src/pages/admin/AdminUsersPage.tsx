import { Button, Form, Input, Select, Table, Typography } from 'antd';
import { useState } from 'react';
import { adminApi } from '../../api/endpoints';
import type { AdminUserView, Role, UserStatus } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { PageShell } from '../../components/Layout';
import {
  Badge,
  EmptyState,
  ErrorNotice,
  formatDate,
  Loading,
  PageHeading,
} from '../../components/ui';
import { messageFor, useAsync } from '../../hooks/useAsync';
import { AdminTabs } from './AdminTabs';

const { Text } = Typography;

export function AdminUsersPage() {
  const { user: currentAdmin } = useAuth();
  const [role, setRole] = useState<Role | ''>('');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [error, setError] = useState<string | null>(null);

  const users = useAsync(
    () =>
      adminApi.listUsers({
        role: role || undefined,
        q: applied || undefined,
      }),
    [role, applied],
    'Could not load users.',
  );

  async function toggleStatus(id: string, current: UserStatus) {
    setError(null);
    try {
      await adminApi.setUserStatus(id, current === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE');
      users.reload();
    } catch (err) {
      setError(messageFor(err, 'Could not change that account.'));
    }
  }

  const columns = [
    {
      title: 'Name',
      key: 'name',
      render: (_: unknown, row: AdminUserView) => (
        <div>
          <Text strong>{row.fullName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.email}
          </Text>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (value: Role) => <Badge tone={value === 'ADMIN' ? 'info' : 'neutral'}>{value}</Badge>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (value: UserStatus) => (
        <Badge tone={value === 'ACTIVE' ? 'success' : 'danger'}>
          {value === 'ACTIVE' ? 'Active' : 'Suspended'}
        </Badge>
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => <Text type="secondary">{formatDate(value)}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: unknown, row: AdminUserView) =>
        // Self-suspension is refused by the API; hiding the button
        // keeps the admin from discovering that the hard way.
        row.id === currentAdmin?.id ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            This is you
          </Text>
        ) : (
          <Button onClick={() => void toggleStatus(row.id, row.status)}>
            {row.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
          </Button>
        ),
    },
  ];

  return (
    <PageShell>
      <main className="lc-page lc-page--wide">
        <PageHeading
          title="Users"
          description="Suspend an account to revoke access immediately. Suspension takes effect on the account holder's very next request."
        />
        <AdminTabs />

        <Form
          layout="inline"
          style={{ marginTop: 24, flexWrap: 'wrap', gap: 8 }}
          onFinish={() => setApplied(search.trim())}
        >
          <Form.Item label="Search">
            <Input
              value={search}
              placeholder="Name or email"
              onChange={(event) => setSearch(event.target.value)}
              style={{ width: 220 }}
            />
          </Form.Item>

          <Form.Item label="Role">
            <Select
              value={role}
              onChange={(value: Role | '') => setRole(value)}
              style={{ width: 176 }}
              options={[
                { value: '', label: 'All roles' },
                { value: 'USER', label: 'Citizens' },
                { value: 'LAWYER', label: 'Lawyers' },
                { value: 'ADMIN', label: 'Administrators' },
              ]}
            />
          </Form.Item>

          <Form.Item>
            <Button type="default" htmlType="submit">
              Search
            </Button>
          </Form.Item>
        </Form>

        {error ? (
          <div style={{ marginTop: 16 }}>
            <ErrorNotice message={error} />
          </div>
        ) : null}

        <div style={{ marginTop: 24 }}>
          {users.status === 'loading' ? (
            <Loading label="Loading users…" />
          ) : users.status === 'error' ? (
            <ErrorNotice message={users.message} />
          ) : users.data.length === 0 ? (
            <EmptyState title="No users found" description="Try a different search or role." />
          ) : (
            <Table rowKey="id" columns={columns} dataSource={users.data} pagination={false} />
          )}
        </div>
      </main>
    </PageShell>
  );
}
