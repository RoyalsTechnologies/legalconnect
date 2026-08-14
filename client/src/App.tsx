import { Flex, Spin, Typography } from 'antd';
import { lazy, type ReactNode, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import type { Role } from './api/types';
import { useAuth } from './auth/AuthContext';

const AccountPage = lazy(() =>
  import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })),
);
const AdminCategoriesPage = lazy(() =>
  import('./pages/admin/AdminCategoriesPage').then((m) => ({ default: m.AdminCategoriesPage })),
);
const AdminLawyersPage = lazy(() =>
  import('./pages/admin/AdminLawyersPage').then((m) => ({ default: m.AdminLawyersPage })),
);
const AdminOverviewPage = lazy(() =>
  import('./pages/admin/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })),
);
const AdminPackagesPage = lazy(() =>
  import('./pages/admin/AdminPackagesPage').then((m) => ({ default: m.AdminPackagesPage })),
);
const AdminUsersPage = lazy(() =>
  import('./pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const IntakeDetailPage = lazy(() =>
  import('./pages/IntakeDetailPage').then((m) => ({ default: m.IntakeDetailPage })),
);
const IntakePage = lazy(() =>
  import('./pages/IntakePage').then((m) => ({ default: m.IntakePage })),
);
const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);
const LawyerDetailPage = lazy(() =>
  import('./pages/LawyerDetailPage').then((m) => ({ default: m.LawyerDetailPage })),
);
const LawyerProfilePage = lazy(() =>
  import('./pages/LawyerProfilePage').then((m) => ({ default: m.LawyerProfilePage })),
);
const LawyersPage = lazy(() =>
  import('./pages/LawyersPage').then((m) => ({ default: m.LawyersPage })),
);
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() =>
  import('./pages/PasswordPages').then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/PasswordPages').then((m) => ({ default: m.ResetPasswordPage })),
);
const VerifyEmailPage = lazy(() =>
  import('./pages/PasswordPages').then((m) => ({ default: m.VerifyEmailPage })),
);
const PaymentReturnPage = lazy(() =>
  import('./pages/PaymentReturnPage').then((m) => ({ default: m.PaymentReturnPage })),
);
const RecommendationsPage = lazy(() =>
  import('./pages/RecommendationsPage').then((m) => ({ default: m.RecommendationsPage })),
);
const CheckEmailPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.CheckEmailPage })),
);
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const RequestDetailPage = lazy(() =>
  import('./pages/RequestDetailPage').then((m) => ({ default: m.RequestDetailPage })),
);
const RequestsPage = lazy(() =>
  import('./pages/RequestsPage').then((m) => ({ default: m.RequestsPage })),
);

const WalletPage = lazy(() =>
  import('./pages/WalletPage').then((m) => ({ default: m.WalletPage })),
);

const { Text } = Typography;

function Splash() {
  return (
    <Flex vertical align="center" justify="center" gap={12} style={{ minHeight: '100vh' }}>
      <Spin size="large" />
      <Text type="secondary">Loading…</Text>
    </Flex>
  );
}

function RequireAuth() {
  const { isAuthenticated, state } = useAuth();

  if (state.status === 'loading') return <Splash />;
  if (!isAuthenticated) {
    const expired = state.status === 'anonymous' && state.reason === 'expired';
    return <Navigate to={expired ? '/login?expired=1' : '/login'} replace />;
  }
  return <Outlet />;
}

/**
 * Route-level role gate.
 *
 * This is convenience, not protection — every one of these screens calls an endpoint
 * that enforces the same rule server-side. Its job is to keep people out of pages
 * that would only show them errors.
 */
function RequireRole({ allow }: { allow: Role[] }) {
  const { user } = useAuth();
  if (!user || !allow.includes(user.role)) return <Navigate to="/app" replace />;
  return <Outlet />;
}

/** Preserves the profile id when forwarding an old in-app link to the public route. */
function RedirectToPublicLawyer() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/lawyers/${id}`} replace />;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, state } = useAuth();
  if (state.status === 'loading') return <Splash />;
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route
          path="/"
          element={
            <PublicOnly>
              <LandingPage />
            </PublicOnly>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/check-email" element={<CheckEmailPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Browsable without an account (FR-012). Someone weighing up whether to
          register needs to see that the platform has lawyers for their problem
          before being asked for their details. */}
        <Route path="/lawyers" element={<LawyersPage />} />
        <Route path="/lawyers/:id" element={<LawyerDetailPage />} />

        {/* The authenticated app used these paths before the directory became public;
          keep them working so saved links and in-app history do not break. */}
        <Route path="/app/lawyers" element={<Navigate to="/lawyers" replace />} />
        <Route path="/app/lawyers/:id" element={<RedirectToPublicLawyer />} />

        <Route element={<RequireAuth />}>
          <Route path="/app" element={<HomePage />} />
          <Route path="/app/account" element={<AccountPage />} />

          <Route path="/app/requests" element={<RequestsPage />} />
          <Route path="/app/requests/:id" element={<RequestDetailPage />} />
          <Route path="/app/payments/return" element={<PaymentReturnPage />} />

          <Route element={<RequireRole allow={['USER']} />}>
            <Route path="/app/intake" element={<IntakePage />} />
            <Route path="/app/intakes/:id" element={<IntakeDetailPage />} />
            <Route path="/app/intakes/:id/recommendations" element={<RecommendationsPage />} />
          </Route>

          <Route element={<RequireRole allow={['LAWYER']} />}>
            <Route path="/app/profile" element={<LawyerProfilePage />} />
            <Route path="/app/wallet" element={<WalletPage />} />
          </Route>

          <Route element={<RequireRole allow={['ADMIN']} />}>
            <Route path="/app/admin" element={<AdminOverviewPage />} />
            <Route path="/app/admin/users" element={<AdminUsersPage />} />
            <Route path="/app/admin/lawyers" element={<AdminLawyersPage />} />
            <Route path="/app/admin/packages" element={<AdminPackagesPage />} />
            <Route path="/app/admin/categories" element={<AdminCategoriesPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
