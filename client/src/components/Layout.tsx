import { Alert, Button, Flex, Layout, Menu, Typography } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const { Header, Content, Footer } = Layout;
const { Text } = Typography;

export const DISCLAIMER =
  'AI-assisted results are provided to help organise your request and connect you with an appropriate legal professional. They are not a substitute for professional legal advice.';

const NAV_BY_ROLE: Record<Role, Array<{ key: string; label: string }>> = {
  USER: [
    { key: '/app', label: 'Home' },
    { key: '/app/intake', label: 'New enquiry' },
    { key: '/lawyers', label: 'Find a lawyer' },
    { key: '/app/requests', label: 'My requests' },
    { key: '/app/account', label: 'Account' },
  ],
  LAWYER: [
    { key: '/app', label: 'Home' },
    { key: '/app/requests', label: 'Requests' },
    { key: '/app/profile', label: 'My profile' },
    { key: '/app/account', label: 'Account' },
  ],
  ADMIN: [
    { key: '/app', label: 'Home' },
    { key: '/app/admin', label: 'Administration' },
    { key: '/lawyers', label: 'Directory' },
    { key: '/app/account', label: 'Account' },
  ],
};

function BrandMark({ to }: { to: string }) {
  return (
    <Link to={to} className="lc-brand" aria-label="LegalConnect Ghana home">
      <span className="lc-mark">LC</span>
      <span className="lc-brand__name">
        LegalConnect <span>Ghana</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { isAuthenticated, user, logout, state } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const items =
    isAuthenticated && user
      ? NAV_BY_ROLE[user.role].map((item) => ({
          key: item.key,
          label: item.label,
        }))
      : [
          { key: '/lawyers', label: 'Find a lawyer' },
          { key: '/login', label: 'Sign in' },
        ];

  const selected =
    items
      .map((item) => item.key)
      .filter((key) => location.pathname === key || location.pathname.startsWith(`${key}/`))
      .sort((a, b) => b.length - a.length)[0] ?? '';

  return (
    <Header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        width: '100%',
      }}
    >
      <BrandMark to={isAuthenticated ? '/app' : '/'} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {state.status !== 'loading' ? (
          <Menu
            mode="horizontal"
            selectedKeys={selected ? [selected] : []}
            items={items}
            onClick={({ key }) => void navigate(key)}
            style={{ border: 'none', minWidth: 0 }}
          />
        ) : null}
      </div>

      <Flex align="center" gap={8} style={{ flexShrink: 0 }}>
        {isAuthenticated ? (
          <>
            <Button type="text" onClick={() => void navigate('/app/account')}>
              {user?.fullName.split(' ')[0]}
            </Button>
            <Button onClick={() => void logout()}>Sign out</Button>
          </>
        ) : (
          <Button type="primary" onClick={() => void navigate('/register')}>
            Get started
          </Button>
        )}
      </Flex>
    </Header>
  );
}

export function SiteFooter({ showDisclaimer = false }: { showDisclaimer?: boolean }) {
  const { isAuthenticated } = useAuth();
  const year = new Date().getFullYear();
  return (
    <Footer className="lc-footer">
      <div style={{ maxWidth: 72 * 16, margin: '0 auto' }}>
        {showDisclaimer ? (
          <Text
            style={{
              display: 'block',
              marginBottom: 20,
              maxWidth: 720,
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            {DISCLAIMER}
          </Text>
        ) : null}
        <Flex justify="space-between" gap={16} wrap="wrap" align="flex-start">
          <div>
            <div className="lc-brand" style={{ color: '#fff', marginBottom: 8 }}>
              <span className="lc-mark">LC</span>
              <span className="lc-brand__name" style={{ color: '#fff' }}>
                LegalConnect <span style={{ color: '#c4a35a' }}>Ghana</span>
              </span>
            </div>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
              Connecting people with legal professionals. Not a law firm.
            </Text>
          </div>
          <Flex gap={20} wrap="wrap">
            <Link to="/lawyers">Find a lawyer</Link>
            {isAuthenticated ? (
              <Link to="/app">Home</Link>
            ) : (
              <>
                <Link to="/register">Create an account</Link>
                <Link to="/login">Sign in</Link>
              </>
            )}
          </Flex>
        </Flex>
        <Text
          style={{ display: 'block', marginTop: 20, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}
        >
          © {year} LegalConnect Ghana
        </Text>
      </div>
    </Footer>
  );
}

export function PageShell({
  children,
  showDisclaimer = false,
}: {
  children: React.ReactNode;
  showDisclaimer?: boolean;
}) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <Content>{children}</Content>
      <SiteFooter showDisclaimer={showDisclaimer} />
    </Layout>
  );
}

export function AiDisclaimer() {
  return <Alert type="info" showIcon message="Not legal advice" description={DISCLAIMER} />;
}
