import { apiGet, API_URL } from './api.js';
import { setCurrentUser } from './state.js';

export const tg = window.Telegram?.WebApp ?? null;
if (tg) tg.ready();

export function getInitData() {
  return tg?.initData ?? '';
}

export function getTelegramUser() {
  return tg?.initDataUnsafe?.user ?? null;
}

async function doAuth(code = '') {
  const body = {
    init_data: getInitData(),
    telegram_user: getTelegramUser(),
    code
  };
  const r = await fetch(`${API_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  return r.json();
}

/**
 * Try to auto-login on page load.
 * 1. First checks if an existing server session is valid (fastest path).
 * 2. Falls back to authenticating with Telegram initData.
 */
export async function autoLogin() {
  // Fast path: existing session cookie
  try {
    const userData = await apiGet(`${API_URL}/user`);
    setCurrentUser(userData);
    return userData;
  } catch {}

  // Slow path: re-authenticate with Telegram data
  if (!getInitData() && !getTelegramUser()) return null;
  try {
    const data = await doAuth();
    if (!data.success) return null;
    const userData = await apiGet(`${API_URL}/user`);
    setCurrentUser(userData);
    return userData;
  } catch {
    return null;
  }
}

/**
 * Login with a one-time code. Throws on failure.
 */
export async function login(code) {
  if (!getInitData() && !getTelegramUser()) {
    throw new Error('Откройте приложение из Telegram');
  }
  const data = await doAuth(code);
  if (!data.success) throw new Error(data.message || 'Неверный код доступа');
  const userData = await apiGet(`${API_URL}/user`);
  setCurrentUser(userData);
  return userData;
}
