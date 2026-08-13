import { Button, Input, Select, Space, Table, Typography } from 'antd';
import { useState } from 'react';
import { adminApi } from '../../api/endpoints';
import type { AdminUserView, Role, UserStatus } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { PageShell } from '../../components/Layout';
import { Badge, EmptyState, ErrorNotice, formatDate, Loading } from '../../components/ui';
import { messageFor, useAsync } from '../../hooks/useAsync';
import { AdminShell } from './AdminTabs';

const { Text } = Typography;

const ROLE_LABEL: Record<Role, string> = {
  USER: 'Citizen',
  LAWYER: 'Lawyer',
  ADMIN: 'Admin',
};

export function AdminUsersPage() {
  const { user: currentAdmin } = useAuth();
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [error, setError] = useState<string | null>(null);

  const users = useAsync(
    () =>
      adminApi.listUsers({
        role: role || undefined,
        status: status || undefined,
        q: applied || undefined,
      }),
    [role, status, applied],
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
      title: 'Person',
      key: 'name',
      render: (_: unknown, row: AdminUserView) => (
        <div>
          <Text strong>{row.fullName}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.email}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (value: Role) => (
        <Badge tone={value === 'ADMIN' ? 'info' : 'neutral'}>{ROLE_LABEL[value]}</Badge>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
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
      width: 140,
      render: (value: string) => <Text type="secondary">{formatDate(value)}</Text>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right' as const,
      width: 140,
      render: (_: unknown, row: AdminUserView) =>
        row.id === currentAdmin?.id ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            You
          </Text>
        ) : (
          <Button size="small" onClick={() => void toggleStatus(row.id, row.status)}>
            {row.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
          </Button>
        ),
    },
  ];

  return (
    <PageShell>
      <AdminShell
        title="Users"
        description="Suspend an account to revoke access on the next request. You cannot suspend yourself."
      >
        <div className="lc-admin__toolbar">
          <Input.Search
            value={search}
            placeholder="Search name or email"
            allowClear
            onChange={(event) => setSearch(event.target.value)}
            onSearch={(value) => setApplied(value.trim())}
            style={{ maxWidth: 280 }}
          />
          <Select
            value={role}
            onChange={(value: Role | '') => setRole(value)}
            style={{ width: 160 }}
            options={[
              { value: '', label: 'All roles' },
              { value: 'USER', label: 'Citizens' },
              { value: 'LAWYER', label: 'Lawyers' },
              { value: 'ADMIN', label: 'Admins' },
            ]}
          />
          <Select
            value={status}
            onChange={(value: UserStatus | '') => setStatus(value)}
            style={{ width: 150 }}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'SUSPENDED', label: 'Suspended' },
            ]}
          />
          <Space>
            <Text type="secondary">
              {users.status === 'ready' ? `${users.data.length} shown` : ''}
            </Text>
          </Space>
        </div>

        {error ? (
          <div style={{ marginBottom: 16 }}>
            <ErrorNotice message={error} />
          </div>
        ) : null}

        {users.status === 'loading' ? (
          <Loading label="Loading users…" />
        ) : users.status === 'error' ? (
          <ErrorNotice message={users.message} />
        ) : users.data.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Try a different search, role, or status."
          />
        ) : (
          <div className="lc-panel">
            <Table
              rowKey="id"
              columns={columns}
              dataSource={users.data}
              pagination={false}
              size="middle"
            />
          </div>
        )}
      </AdminShell>
    </PageShell>
  );
}
