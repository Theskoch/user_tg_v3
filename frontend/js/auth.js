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

async function doAuth(initData, code = '') {
  const r = await fetch(`${API_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ init_data: initData, code })
  });
  return r.json();
}

/**
 * Try to auto-login using Telegram initData (called on page load).
 * Returns user data object on success, null otherwise.
 */
export async function autoLogin() {
  const initData = getInitData();
  if (!initData) return null;
  try {
    const data = await doAuth(initData);
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
 * Returns user data object on success.
 */
export async function login(code) {
  const initData = getInitData();
  if (!initData) throw new Error('Откройте приложение из Telegram');
  const data = await doAuth(initData, code);
  if (!data.success) throw new Error(data.message || 'Неверный код доступа');
  const userData = await apiGet(`${API_URL}/user`);
  setCurrentUser(userData);
  return userData;
}
