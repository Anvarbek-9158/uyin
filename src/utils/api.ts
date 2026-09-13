const CLIENT_ID_KEY = 'rv_client_id';
const SESSION_TOKEN_KEY = 'rv_session_token';
// The account session token (email+password login) is stored by AuthContext
// under this key. Attaching it on every call lets the server resolve the logged
// in account and use its OWN question bank (per-account isolation).
const ACCOUNT_TOKEN_KEY = 'eduplay-auth-token';

export function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

// The server binds every clientId to an unguessable session token minted at
// create-game / join-game time. It is kept next to the clientId and attached to
// every API call so a stolen clientId alone cannot impersonate its owner.
export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // localStorage unavailable (private mode etc.) — tokens are best-effort.
  }
}

function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  const accountToken = (() => {
    try {
      return localStorage.getItem(ACCOUNT_TOKEN_KEY);
    } catch {
      return null;
    }
  })();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(accountToken ? { 'x-auth-token': accountToken } : {}),
  };
}

export async function apiPost<T = { success: boolean }>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

export async function apiGet<T = { success: boolean }>(path: string): Promise<T> {
  const res = await fetch(path, { headers: authHeaders() });
  return (await res.json()) as T;
}
