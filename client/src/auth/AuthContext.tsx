import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ApiError, getToken, onSessionInvalid, setToken } from '../api/client';
import { authApi, usersApi } from '../api/endpoints';
import type { AuthResult, PublicUser, RegisterPayload, RegisterResult } from '../api/types';
import { tokenExpiresAtMs } from './session';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; reason?: 'expired' }
  | { status: 'authenticated'; user: PublicUser };

type AuthContextValue = {
  state: AuthState;
  user: PublicUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (input: RegisterPayload) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  /** Replaces the in-memory user after a profile save without a new login. */
  applyUser: (user: PublicUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Browsers clamp setTimeout; anything longer is still caught by the next 401. */
const MAX_TIMEOUT_MS = 2_147_483_647;

function applySession(result: AuthResult): PublicUser {
  setToken(result.token);
  return result.user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const endExpiredSession = useCallback(() => {
    setToken(null);
    setState({ status: 'anonymous', reason: 'expired' });
  }, []);

  useEffect(() => {
    return onSessionInvalid(() => {
      setState({ status: 'anonymous', reason: 'expired' });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = getToken();

    if (!token) {
      setState({ status: 'anonymous' });
      return;
    }

    const expiresAt = tokenExpiresAtMs(token);
    if (expiresAt !== null && expiresAt <= Date.now()) {
      endExpiredSession();
      return;
    }

    usersApi
      .me()
      .then((user) => {
        if (!cancelled) setState({ status: 'authenticated', user });
      })
      .catch((error: unknown) => {
        setToken(null);
        if (cancelled) return;
        const expired = error instanceof ApiError && error.status === 401;
        setState((prev) =>
          prev.status === 'anonymous'
            ? prev
            : { status: 'anonymous', reason: expired ? 'expired' : undefined },
        );
      });

    return () => {
      cancelled = true;
    };
  }, [endExpiredSession]);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    const token = getToken();
    if (!token) return;
    const expiresAt = tokenExpiresAtMs(token);
    if (expiresAt === null) return;

    const delay = Math.min(MAX_TIMEOUT_MS, Math.max(0, expiresAt - Date.now()));
    const id = window.setTimeout(endExpiredSession, delay);
    return () => window.clearTimeout(id);
  }, [state, endExpiredSession]);

  const login = useCallback(async (email: string, password: string) => {
    const user = applySession(await authApi.login({ email, password }));
    setState({ status: 'authenticated', user });
    return user;
  }, []);

  const register = useCallback(async (input: RegisterPayload) => {
    // No session yet — the person must confirm their email first.
    return authApi.register(input);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setToken(null);
      setState({ status: 'anonymous' });
    }
  }, []);

  const applyUser = useCallback((user: PublicUser) => {
    setState({ status: 'authenticated', user });
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = state.status === 'authenticated' ? state.user : null;
    return {
      state,
      user,
      isAuthenticated: state.status === 'authenticated',
      login,
      register,
      logout,
      applyUser,
    };
  }, [state, login, register, logout, applyUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
