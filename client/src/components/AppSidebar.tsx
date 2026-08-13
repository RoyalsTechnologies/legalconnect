import {
  AppstoreOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FormOutlined,
  HomeOutlined,
  IdcardOutlined,
  InboxOutlined,
  SearchOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import { adminApi, consultationsApi } from '../api/endpoints';
import type { Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useAsync } from '../hooks/useAsync';

type NavItem = {
  key: string;
  label: string;
  icon: typeof HomeOutlined;
  exact?: boolean;
  matchPrefixes?: string[];
};

const NAV: Record<Role, { label: string; items: NavItem[]; more: NavItem[] }> = {
  USER: {
    label: 'Menu',
    items: [
      { key: '/app', label: 'Home', icon: HomeOutlined, exact: true },
      {
        key: '/app/intake',
        label: 'New enquiry',
        icon: FormOutlined,
        matchPrefixes: ['/app/intake', '/app/intakes'],
      },
      { key: '/lawyers', label: 'Find a lawyer', icon: SearchOutlined },
      { key: '/app/requests', label: 'My requests', icon: FileTextOutlined },
    ],
    more: [{ key: '/app/account', label: 'Account', icon: UserOutlined }],
  },
  LAWYER: {
    label: 'Practice',
    items: [
      { key: '/app', label: 'Home', icon: HomeOutlined, exact: true },
      { key: '/app/requests', label: 'Requests', icon: InboxOutlined },
      { key: '/app/profile', label: 'My profile', icon: IdcardOutlined },
    ],
    more: [{ key: '/app/account', label: 'Account', icon: UserOutlined }],
  },
  ADMIN: {
    label: 'Administration',
    items: [
      { key: '/app/admin', label: 'Overview', icon: DashboardOutlined, exact: true },
      { key: '/app/admin/users', label: 'Users', icon: TeamOutlined },
      { key: '/app/admin/lawyers', label: 'Lawyers', icon: IdcardOutlined },
      { key: '/app/admin/packages', label: 'Plans', icon: CreditCardOutlined },
      { key: '/app/admin/categories', label: 'Categories', icon: AppstoreOutlined },
    ],
    more: [
      { key: '/lawyers', label: 'Directory', icon: UnorderedListOutlined },
      { key: '/app/account', label: 'Account', icon: UserOutlined },
    ],
  },
};

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.key;
  const prefixes = item.matchPrefixes ?? [item.key];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function NavLink({
  to,
  label,
  icon: Icon,
  active,
  count = 0,
}: {
  to: string;
  label: string;
  icon: typeof HomeOutlined;
  active: boolean;
  count?: number;
}) {
  return (
    <Link to={to} className={active ? 'lc-shell__link is-active' : 'lc-shell__link'}>
      <Icon aria-hidden />
      <span>{label}</span>
      {count > 0 ? <span className="lc-nav-count">{count}</span> : null}
    </Link>
  );
}

export function AppSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role;
  const nav = role ? NAV[role] : null;

  const adminStats = useAsync(
    () => (role === 'ADMIN' ? adminApi.stats() : Promise.resolve(null)),
    [role],
    'Could not load platform statistics.',
  );
  const lawyerRequests = useAsync(
    () => (role === 'LAWYER' ? consultationsApi.list() : Promise.resolve([])),
    [role],
    'Could not load your requests.',
  );

  const pendingLawyers =
    adminStats.status === 'ready' ? (adminStats.data?.lawyers.pending ?? 0) : 0;
  const waitingRequests =
    lawyerRequests.status === 'ready'
      ? lawyerRequests.data.filter((request) => request.status === 'PENDING').length
      : 0;

  if (!nav) return null;

  return (
    <nav className="lc-shell__nav" aria-label={nav.label}>
      <p className="lc-shell__nav-label">{nav.label}</p>
      {nav.items.map((item) => (
        <NavLink
          key={item.key}
          to={item.key}
          label={item.label}
          icon={item.icon}
          active={isActive(location.pathname, item)}
          count={
            item.key === '/app/admin/lawyers'
              ? pendingLawyers
              : item.key === '/app/requests' && role === 'LAWYER'
                ? waitingRequests
                : 0
          }
        />
      ))}
      <p className="lc-shell__nav-label lc-shell__nav-label--more">More</p>
      {nav.more.map((item) => (
        <NavLink
          key={item.key}
          to={item.key}
          label={item.label}
          icon={item.icon}
          active={isActive(location.pathname, item)}
        />
      ))}
    </nav>
  );
}
