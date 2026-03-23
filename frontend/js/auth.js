import { apiGet, API_URL } from './api.js?v=3';
import { setCurrentUser } from './state.js?v=3';

export const tg = window.Telegram?.WebApp ?? null;
if (tg) tg.ready();

// ─── Telegram data helpers ────────────────────────────────────────────────────

export function getInitData() {
  return tg?.initData ?? '';
}

export function getTelegramUser() {
  return tg?.initDataUnsafe?.user ?? null;
}

function getStoredTelegramId() {
  try {
    // New format
    const id = localStorage.getItem('tg_id');
    if (id) return id;
    // Legacy format written by old app.js
    const legacy = JSON.parse(localStorage.getItem('tg_user') || 'null');
    return legacy?.id ? String(legacy.id) : null;
  } catch { return null; }
}

export function saveStoredTelegramId(id) {
  try {
    if (id) {
      localStorage.setItem('tg_id', String(id));
    }
  } catch {}
}

// ─── Core auth request ────────────────────────────────────────────────────────

async function doAuth(code = '') {
  const tgUser = getTelegramUser();
  const body = {
    init_data:         getInitData(),
    telegram_user:     tgUser,
    stored_telegram_id: tgUser ? null : getStoredTelegramId(),
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Try to auto-login on page load.
 * 1. Check existing server session (fastest — no Telegram data needed).
 * 2. Re-auth with whatever Telegram data is available.
 */
export async function autoLogin() {
  // Fast path: valid session cookie
  try {
    const userData = await apiGet(`${API_URL}/user`);
    setCurrentUser(userData);
    return userData;
  } catch {}

  // Nothing to identify the user
  if (!getInitData() && !getTelegramUser() && !getStoredTelegramId()) return null;

  try {
    const data = await doAuth();
    if (!data.success) return null;
    const userData = await apiGet(`${API_URL}/user`);
    if (userData.telegram_id) saveStoredTelegramId(userData.telegram_id);
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
  const data = await doAuth(code);
  if (!data.success) throw new Error(data.message || 'Неверный код доступа');
  const userData = await apiGet(`${API_URL}/user`);
  if (userData.telegram_id) saveStoredTelegramId(userData.telegram_id);
  setCurrentUser(userData);
  return userData;
}
