import type { Page, Route } from '@playwright/test';

const STARTER = {
  id: 'pkg_starter',
  name: 'Starter',
  slug: 'starter',
  description: 'One practice area for a focused practice.',
  monthlyFeePesewas: 5_000,
  maxPracticeAreas: 1,
  isActive: true,
};

const EMPLOYMENT = {
  id: 'cat_employment',
  name: 'Employment & Labour',
  slug: 'employment-labour',
  description: 'Dismissal, unpaid salary, contracts.',
  isActive: true,
};

const AKUA_PUBLIC = {
  id: 'lawyer_akua',
  displayName: 'Akua Owusu',
  firmName: 'Owusu & Partners',
  bio: 'I handle employment disputes, unfair dismissal, and unpaid salary claims in Accra.',
  licenseNumber: null,
  city: 'Accra',
  region: 'Greater Accra',
  isAvailable: true,
  approvalStatus: 'APPROVED' as const,
  yearsExperience: 8,
  consultationFeePesewas: 20_000,
  createdAt: '2026-01-01T00:00:00.000Z',
  practiceAreas: [{ legalCategory: EMPLOYMENT }],
  subscription: { active: true, periodEnd: '2026-12-31T00:00:00.000Z', package: STARTER },
};

function citizenUser() {
  return {
    id: 'user_ama',
    email: 'ama.mensah@example.com',
    fullName: 'Ama Mensah',
    phone: '0244123456',
    role: 'USER' as const,
    status: 'ACTIVE' as const,
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function lawyerUser() {
  return {
    id: 'user_akua',
    email: 'akua.owusu@example.com',
    fullName: 'Akua Owusu',
    phone: '0244123456',
    role: 'LAWYER' as const,
    status: 'ACTIVE' as const,
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function error(route: Route, status: number, message: string, code = 'UNPROCESSABLE_ENTITY') {
  return json(route, status, { error: { code, message } });
}

export type SubscribeMode = 'pending' | 'invalid';

export async function installApiMocks(
  page: Page,
  options: { subscribeMode?: SubscribeMode } = {},
): Promise<void> {
  const subscribeMode = options.subscribeMode ?? 'pending';
  let planActive = false;
  const intakes = new Map<
    string,
    {
      id: string;
      originalDescription: string;
      city: string | null;
      region: string | null;
      aiSummary: string;
      urgency: 'NORMAL';
      keywords: string[];
      confidence: number;
      needsHumanReview: boolean;
      aiStatus: 'COMPLETED';
      aiError: null;
      createdAt: string;
      category: { id: string; name: string; slug: string };
    }
  >();

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '') || '/';
    const method = request.method();
    const auth = request.headers().authorization ?? '';
    const isLawyer = auth.includes('e2e-lawyer');
    const isCitizen = auth.includes('e2e-citizen');

    if (method === 'POST' && path === '/auth/login') {
      const body = request.postDataJSON() as { email?: string; password?: string };
      if (body.email === 'akua.owusu@example.com' && body.password === 'demo-password-2026') {
        return json(route, 200, { token: 'e2e-lawyer-token', user: lawyerUser() });
      }
      if (body.email === 'ama.mensah@example.com' && body.password === 'demo-password-2026') {
        return json(route, 200, { token: 'e2e-citizen-token', user: citizenUser() });
      }
      return error(route, 401, 'Invalid email or password', 'UNAUTHORIZED');
    }

    if (method === 'POST' && path === '/auth/logout') {
      return route.fulfill({ status: 204, body: '' });
    }

    if (method === 'GET' && path === '/users/me') {
      if (isLawyer) return json(route, 200, lawyerUser());
      if (isCitizen) return json(route, 200, citizenUser());
      return error(route, 401, 'Authentication required', 'UNAUTHORIZED');
    }

    if (method === 'GET' && path === '/categories') {
      return json(route, 200, [EMPLOYMENT]);
    }

    if (method === 'GET' && path === '/packages') {
      return json(route, 200, [STARTER]);
    }

    if (method === 'GET' && path === '/lawyers') {
      return json(route, 200, {
        results: [AKUA_PUBLIC],
        total: 1,
        limit: 12,
        offset: 0,
      });
    }

    if (method === 'GET' && path === '/lawyers/lawyer_akua') {
      return json(route, 200, AKUA_PUBLIC);
    }

    if (method === 'GET' && path === '/lawyers/me') {
      if (!isLawyer)
        return error(route, 403, 'You do not have access to this resource', 'FORBIDDEN');
      return json(route, 200, {
        ...AKUA_PUBLIC,
        paymentAccount: {
          accountName: 'Akua Owusu',
          phone: '0244123456',
          network: 'MTN',
        },
        wallet: { availablePesewas: 0, entries: [] },
        subscription: planActive
          ? {
              active: true,
              periodEnd: '2026-09-13T00:00:00.000Z',
              package: STARTER,
            }
          : { active: false, periodEnd: null, package: null },
      });
    }

    if (method === 'GET' && path === '/consultations') {
      return json(route, 200, []);
    }

    if (method === 'GET' && path === '/intakes') {
      return json(route, 200, [...intakes.values()]);
    }

    if (method === 'POST' && path === '/intakes') {
      const body = request.postDataJSON() as {
        description?: string;
        city?: string;
        region?: string;
      };
      const created = {
        id: 'intake_e2e',
        originalDescription: body.description ?? '',
        city: body.city ?? null,
        region: body.region ?? null,
        aiSummary: 'Client reports dismissal without notice and unpaid wages in Accra.',
        urgency: 'NORMAL' as const,
        keywords: ['dismissal', 'salary'],
        confidence: 0.86,
        needsHumanReview: false,
        aiStatus: 'COMPLETED' as const,
        aiError: null,
        createdAt: new Date().toISOString(),
        category: { id: EMPLOYMENT.id, name: EMPLOYMENT.name, slug: EMPLOYMENT.slug },
      };
      intakes.set(created.id, created);
      return json(route, 201, created);
    }

    if (method === 'GET' && path === '/intakes/intake_e2e') {
      const intake = intakes.get('intake_e2e');
      if (!intake) return error(route, 404, 'Intake not found', 'NOT_FOUND');
      return json(route, 200, intake);
    }

    if (method === 'POST' && path === '/lawyers/me/subscription') {
      if (subscribeMode === 'invalid') {
        return error(route, 422, 'Invalid reference');
      }
      return json(route, 201, {
        subscription: { active: false, periodEnd: null, package: null },
        authorizationUrl: null,
        paymentHint: 'Approve the mobile money prompt sent to 0244123456.',
        reference: 'LCP0123456789abcdef0123',
      });
    }

    if (method === 'POST' && path === '/lawyers/me/subscription/confirm') {
      planActive = true;
      return json(route, 200, {
        active: true,
        periodEnd: '2026-09-13T00:00:00.000Z',
        package: STARTER,
      });
    }

    return error(route, 404, `No mock for ${method} ${path}`, 'NOT_FOUND');
  });
}
