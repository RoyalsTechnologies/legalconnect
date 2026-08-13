import { Tabs } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';

const items = [
  { key: '/app/admin', label: 'Overview' },
  { key: '/app/admin/users', label: 'Users' },
  { key: '/app/admin/lawyers', label: 'Lawyers' },
  { key: '/app/admin/packages', label: 'Plans' },
  { key: '/app/admin/categories', label: 'Categories' },
];

export function AdminTabs() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeKey =
    items
      .map((item) => item.key)
      .filter(
        (key) =>
          location.pathname === key ||
          (key !== '/app/admin' && location.pathname.startsWith(`${key}/`)),
      )
      .sort((a, b) => b.length - a.length)[0] ?? '/app/admin';

  return (
    <Tabs
      activeKey={activeKey}
      onChange={(key) => {
        void navigate(key);
      }}
      items={items}
      style={{ marginTop: 24 }}
      aria-label="Admin"
    />
  );
}
