import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { setToken } from '../api/client';
import { authApi, usersApi } from '../api/endpoints';
import type { AuthResult, PublicUser, RegisterPayload, RegisterResult } from '../api/types';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
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

function applySession(result: AuthResult): PublicUser {
  setToken(result.token);
  return result.user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('lc_token');

    if (!token) {
      setState({ status: 'anonymous' });
      return;
    }

    usersApi
      .me()
      .then((user) => {
        if (!cancelled) setState({ status: 'authenticated', user });
      })
      .catch(() => {
        setToken(null);
        if (!cancelled) setState({ status: 'anonymous' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
