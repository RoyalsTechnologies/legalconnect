import { apiRequest } from './client';
import type {
  AdminUserView,
  ApprovalStatus,
  AuthResult,
  ConsultationStatus,
  ConsultationView,
  IntakeView,
  LawyerPage,
  LawyerView,
  LegalCategory,
  MatchResult,
  PlatformStats,
  PublicUser,
  RegisterPayload,
  RegisterResult,
  Role,
  SubscriptionPackage,
  SubscriptionView,
  UserStatus,
} from './types';

/** Drops empty filters so the URL only carries values the user actually chose. */
function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const authApi = {
  register(body: RegisterPayload): Promise<RegisterResult> {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  login(body: { email: string; password: string }): Promise<AuthResult> {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  verifyEmail(body: { token: string }): Promise<{ message: string }> {
    return apiRequest('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  resendVerification(body: { email: string }): Promise<void> {
    return apiRequest('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  forgotPassword(body: { email: string }): Promise<void> {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  resetPassword(body: { token: string; password: string }): Promise<{ message: string }> {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  changePassword(body: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ message: string }> {
    return apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  logout(): Promise<void> {
    return apiRequest('/auth/logout', { method: 'POST' });
  },
};

export const usersApi = {
  me(): Promise<PublicUser> {
    return apiRequest('/users/me');
  },

  updateMe(body: { fullName?: string; phone?: string | null }): Promise<PublicUser> {
    return apiRequest('/users/me', { method: 'PATCH', body: JSON.stringify(body) });
  },
};

/**
 * The holding category the AI assigns when it cannot place an enquiry. It is a real
 * row so intakes can point at something, but it is not a field of law — the API
 * refuses it as a practice area, and it should never appear in a picker.
 */
export const FALLBACK_CATEGORY_NAME = 'Other / Needs Review';

export const categoriesApi = {
  list(includeInactive = false): Promise<LegalCategory[]> {
    return apiRequest(`/categories${query({ includeInactive: includeInactive || undefined })}`);
  },

  /** Categories a lawyer can actually practise, for selection and filtering. */
  async selectable(): Promise<LegalCategory[]> {
    const categories = await categoriesApi.list();
    return categories.filter((category) => category.name !== FALLBACK_CATEGORY_NAME);
  },

  create(body: { name: string; description: string }): Promise<LegalCategory> {
    return apiRequest('/categories', { method: 'POST', body: JSON.stringify(body) });
  },

  update(
    id: string,
    body: { name?: string; description?: string; isActive?: boolean },
  ): Promise<LegalCategory> {
    return apiRequest(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  },

  deactivate(id: string): Promise<LegalCategory> {
    return apiRequest(`/categories/${id}`, { method: 'DELETE' });
  },
};

export interface LawyerFilters {
  categoryId?: string;
  region?: string;
  q?: string;
  available?: boolean;
  limit?: number;
  offset?: number;
}

export const lawyersApi = {
  list(filters: LawyerFilters = {}): Promise<LawyerPage> {
    return apiRequest(`/lawyers${query({ ...filters })}`);
  },

  get(id: string): Promise<LawyerView> {
    return apiRequest(`/lawyers/${id}`);
  },

  me(): Promise<LawyerView> {
    return apiRequest('/lawyers/me');
  },

  updateMe(body: Record<string, unknown>): Promise<LawyerView> {
    return apiRequest('/lawyers/me', { method: 'PATCH', body: JSON.stringify(body) });
  },

  create(body: Record<string, unknown>): Promise<LawyerView> {
    return apiRequest('/lawyers', { method: 'POST', body: JSON.stringify(body) });
  },

  adminUpdate(id: string, body: Record<string, unknown>): Promise<LawyerView> {
    return apiRequest(`/lawyers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  },

  subscribe(body: {
    packageId: string;
    interval?: 'month' | 'year';
    phone?: string;
    network?: 'MTN' | 'AT' | 'TELECEL';
  }): Promise<{
    subscription: SubscriptionView;
    authorizationUrl: string | null;
    paymentHint: string | null;
    reference: string | null;
  }> {
    return apiRequest('/lawyers/me/subscription', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  confirmSubscription(reference: string): Promise<SubscriptionView> {
    return apiRequest('/lawyers/me/subscription/confirm', {
      method: 'POST',
      body: JSON.stringify({ reference }),
    });
  },

  listWithdrawals(): Promise<
    Array<{
      id: string;
      amountPesewas: number;
      status: 'PENDING' | 'PAID' | 'FAILED';
      paymentReference: string | null;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    return apiRequest('/lawyers/me/withdrawals');
  },

  withdraw(amountGhs: number): Promise<{
    id: string;
    amountPesewas: number;
    status: 'PENDING' | 'PAID' | 'FAILED';
    paymentReference: string | null;
    createdAt: string;
    updatedAt: string;
  }> {
    return apiRequest('/lawyers/me/withdrawals', {
      method: 'POST',
      body: JSON.stringify({ amountGhs }),
    });
  },
};

export const packagesApi = {
  list(): Promise<SubscriptionPackage[]> {
    return apiRequest('/packages');
  },

  create(body: {
    name: string;
    description: string;
    monthlyFeeGhs: number;
    maxPracticeAreas: number;
  }): Promise<SubscriptionPackage> {
    return apiRequest('/packages', { method: 'POST', body: JSON.stringify(body) });
  },

  update(
    id: string,
    body: {
      name?: string;
      description?: string;
      monthlyFeeGhs?: number;
      maxPracticeAreas?: number;
      isActive?: boolean;
    },
  ): Promise<SubscriptionPackage> {
    return apiRequest(`/packages/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  },
};

export const consultationsApi = {
  create(body: {
    intakeId: string;
    lawyerProfileId: string;
    message?: string;
    scheduledAt: string;
  }): Promise<ConsultationView> {
    return apiRequest('/consultations', { method: 'POST', body: JSON.stringify(body) });
  },

  list(status?: ConsultationStatus): Promise<ConsultationView[]> {
    return apiRequest(`/consultations${query({ status })}`);
  },

  get(id: string): Promise<ConsultationView> {
    return apiRequest(`/consultations/${id}`);
  },

  setStatus(
    id: string,
    status: ConsultationStatus,
    extra: { meetUrl?: string } = {},
  ): Promise<ConsultationView> {
    return apiRequest(`/consultations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...extra }),
    });
  },

  pay(
    id: string,
    body: { phone?: string; network?: 'MTN' | 'AT' | 'TELECEL' } = {},
  ): Promise<{
    consultation: ConsultationView;
    authorizationUrl: string | null;
    paymentHint: string | null;
  }> {
    return apiRequest(`/consultations/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  verifyPayment(reference: string): Promise<ConsultationView> {
    return apiRequest('/consultations/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ reference }),
    });
  },

  confirm(id: string): Promise<ConsultationView> {
    return apiRequest(`/consultations/${id}/confirm`, { method: 'POST' });
  },
};

export const adminApi = {
  listUsers(
    filters: { role?: Role; status?: UserStatus; q?: string } = {},
  ): Promise<AdminUserView[]> {
    return apiRequest(`/admin/users${query({ ...filters })}`);
  },

  setUserStatus(id: string, status: UserStatus): Promise<AdminUserView> {
    return apiRequest(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  stats(): Promise<PlatformStats> {
    return apiRequest('/admin/stats');
  },

  setApproval(lawyerId: string, approvalStatus: ApprovalStatus): Promise<LawyerView> {
    return lawyersApi.adminUpdate(lawyerId, { approvalStatus });
  },

  grantSubscription(
    lawyerId: string,
    body: { packageId: string; periodDays?: number },
  ): Promise<SubscriptionView> {
    return apiRequest(`/admin/lawyers/${lawyerId}/subscription`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

export const intakesApi = {
  create(body: { description: string; city?: string; region?: string }): Promise<IntakeView> {
    return apiRequest('/intakes', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  list(): Promise<IntakeView[]> {
    return apiRequest('/intakes');
  },

  get(id: string): Promise<IntakeView> {
    return apiRequest(`/intakes/${id}`);
  },

  recommendations(id: string): Promise<MatchResult> {
    return apiRequest(`/intakes/${id}/recommendations`);
  },
};
