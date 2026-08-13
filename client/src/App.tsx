import { Flex, Spin, Typography } from 'antd';
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import type { Role } from './api/types';
import { useAuth } from './auth/AuthContext';
import { AccountPage } from './pages/AccountPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminLawyersPage } from './pages/admin/AdminLawyersPage';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminPackagesPage } from './pages/admin/AdminPackagesPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { HomePage } from './pages/HomePage';
import { IntakeDetailPage } from './pages/IntakeDetailPage';
import { IntakePage } from './pages/IntakePage';
import { LandingPage } from './pages/LandingPage';
import { LawyerDetailPage } from './pages/LawyerDetailPage';
import { LawyerProfilePage } from './pages/LawyerProfilePage';
import { LawyersPage } from './pages/LawyersPage';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from './pages/PasswordPages';
import { PaymentReturnPage } from './pages/PaymentReturnPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { CheckEmailPage, RegisterPage } from './pages/RegisterPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { RequestsPage } from './pages/RequestsPage';

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
  if (!isAuthenticated) return <Navigate to="/login" replace />;
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

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, state } = useAuth();
  if (state.status === 'loading') return <Splash />;
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
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
  );
}
