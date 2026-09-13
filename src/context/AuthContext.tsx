import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type Role = 'teacher' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  plan: 'free' | 'pro';
}

export interface AuthInput {
  name?: string;
  email: string;
  password: string;
  role: Role;
}

export interface AuthResult {
  ok: boolean;
  code?: string;
  message?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  checkingSession: boolean;
  signup: (input: AuthInput) => Promise<AuthResult>;
  login: (input: AuthInput) => Promise<AuthResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'eduplay-auth-user';
const TOKEN_KEY = 'eduplay-auth-token';

// Read + parse stored session with a single guard so a corrupt payload cannot
// crash the app at startup.
function readStoredSession(): { user: User | null; token: string | null } {
  try {
    const rawUser = window.localStorage.getItem(STORAGE_KEY);
    const rawToken = window.localStorage.getItem(TOKEN_KEY);
    return {
      user: rawUser ? (JSON.parse(rawUser) as User) : null,
      token: rawToken || null,
    };
  } catch {
    return { user: null, token: null };
  }
}

// Map a server error code to a localized message (fallback: the server's own
// Uzbek message, which is what all other endpoints return).
const CODE_KEYS: Record<string, string> = {
  email_taken: 'auth_err_email_taken',
  invalid_credentials: 'auth_err_invalid_credentials',
  invalid_email: 'auth_err_invalid_email',
  invalid_password: 'auth_err_password_min',
  invalid_role: 'auth_err_generic',
  invalid_name: 'auth_err_name_required',
  role_mismatch: 'auth_err_role_mismatch',
  rate_limited: 'auth_err_rate_limited',
  not_authenticated: 'auth_err_not_authenticated',
};

export function authErrorMessage(t: (key: string) => string, code?: string, fallback?: string): string {
  if (!code) return fallback || t('auth_err_generic');
  const key = CODE_KEYS[code];
  if (!key) return fallback || t('auth_err_generic');
  return t(key);
}

async function authCall(path: string, body: Record<string, unknown>): Promise<AuthResult & { user?: User; token?: string }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      success: boolean;
      code?: string;
      message?: string;
      user?: User;
      token?: string;
    };
    if (!res.ok || !data.success) {
      return { ok: false, code: data.code, message: data.message };
    }
    return { ok: true, user: data.user, token: data.token };
  } catch {
    return { ok: false, code: undefined, message: undefined };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = readStoredSession();
  const [user, setUser] = useState<User | null>(initial.user);
  const [token, setToken] = useState<string | null>(initial.token);
  const [checkingSession, setCheckingSession] = useState(true);

  const persist = (nextUser: User | null, nextToken: string | null) => {
    setUser(nextUser);
    setToken(nextToken);
    try {
      if (nextUser) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      if (nextToken) {
        window.localStorage.setItem(TOKEN_KEY, nextToken);
      } else {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      // localStorage unavailable (private mode etc.) — sessions are best-effort.
    }
  };

  // On first load: if a stored token exists, confirm it with the server so a
  // revoked/expired session is dropped instead of silently shown as logged in.
  useEffect(() => {
    let cancelled = false;
    const tokenToCheck = initial.token;
    if (!tokenToCheck) {
      setCheckingSession(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${tokenToCheck}` },
        });
        if (cancelled) return;
        const data = (await res.json()) as { success: boolean; user?: User };
        if (res.ok && data.success && data.user) {
          const restored: User = { ...data.user, plan: data.user.plan ?? 'free' };
          setUser(restored);
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
          } catch {
            /* ignore */
          }
        } else {
          persist(null, null);
        }
      } catch {
        // Network failure: keep the cached session (offline-first); the next
        // server round-trip will re-validate it.
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (input: AuthInput): Promise<AuthResult> => {
    const res = await authCall('/api/auth/login', {
      email: input.email,
      password: input.password,
      role: input.role,
    });
    if (res.ok && res.user && res.token) {
      // Plan comes from the server (the account may be 'pro').
      persist({ ...res.user, plan: res.user.plan ?? 'free' }, res.token);
    }
    return { ok: res.ok, code: res.code, message: res.message };
  };

  const signup = async (input: AuthInput): Promise<AuthResult> => {
    const res = await authCall('/api/auth/signup', {
      name: input.name,
      email: input.email,
      password: input.password,
      role: input.role,
    });
    if (res.ok && res.user && res.token) {
      persist({ ...res.user, plan: res.user.plan ?? 'free' }, res.token);
    }
    return { ok: res.ok, code: res.code, message: res.message };
  };

  const logout = () => {
    const currentToken = token;
    if (currentToken) {
      // Fire-and-forget server-side revocation; the client is unauthenticated
      // immediately either way.
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch(() => {});
    }
    persist(null, null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        checkingSession,
        signup,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}