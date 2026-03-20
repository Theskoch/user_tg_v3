export const API_URL = window.location.origin;

export async function apiGet(path) {
  const r = await fetch(path, {
    credentials: 'include',
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiPost(path, payload = {}) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
