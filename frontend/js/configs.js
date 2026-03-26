import { apiGet, apiPost, API_URL } from './api.js?v=8';
import { adminSelected, connectionTypes, setConnectionTypes } from './state.js?v=8';
import { openBottomSheet, closeBottomSheet, copyText, showToast } from './ui.js?v=8';

// DOM refs
const connectionsBox = document.getElementById('connections');
const sheet          = document.getElementById('sheet');
const sheetOverlay   = document.getElementById('sheet-overlay');
const sheetTitle     = document.getElementById('sheet-title');
const sheetText      = document.getElementById('sheet-text');
const sheetQr        = document.getElementById('sheet-qr');
const copyConfigBtn  = document.getElementById('copy-config');
const copyToast      = document.getElementById('copy-toast');
const closeSheetBtn  = document.getElementById('close-sheet');
const warnOverlay    = document.getElementById('warn-overlay');
const warnSheet      = document.getElementById('warn-sheet');
const warnView       = document.getElementById('warn-view');
const warnClose      = document.getElementById('warn-close');

let currentOpenConfig = null;
let warnConfig        = null;
let nameSaveTimer     = null;

export function getCurrentOpenConfig() { return currentOpenConfig; }

// ─── Connection types ────────────────────────────────────────────────────────

export async function fetchConnectionTypes() {
  try {
    const r = await fetch(`${API_URL}/connection_types.json`, { cache: 'no-store' });
    const data = await r.json();
    setConnectionTypes(data.types || []);
  } catch {
    setConnectionTypes([]);
  }
}

function resolveType(protocol) {
  if (!protocol) return null;
  return connectionTypes.find(
    t => t.id === protocol || t.name?.toLowerCase() === String(protocol).toLowerCase()
  );
}

// ─── Connections list ────────────────────────────────────────────────────────

export async function renderConnections() {
  if (!connectionsBox) return;
  connectionsBox.innerHTML = '';
  try {
    const configs = await apiGet(`${API_URL}/api/configs`);
    if (!connectionTypes.length) await fetchConnectionTypes();
    if (!configs.length) {
      connectionsBox.innerHTML = '<div class="conn-sub">Нет подключений</div>';
      return;
    }
    configs.forEach(c => {
      const type = resolveType(c.protocol);
      const badge = type
        ? `<span class="type-badge" style="background:${type.bg};color:${type.text}">${type.name}</span>`
        : '';
      const card = document.createElement('div');
      card.className = 'conn-card' + (c.is_used ? ' used' : '');
      card.innerHTML = `
        <div class="conn-title">${c.name || c.title || 'Config'}</div>
        ${badge}
        <div class="conn-sub">${c.protocol || '—'} • ${String(c.config_text || '').slice(0, 18)}...</div>
      `;
      card.addEventListener('click', () => handleConfigOpen(c));
      connectionsBox.appendChild(card);
    });
  } catch {
    connectionsBox.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
  }
}

// ─── Open / warn logic ───────────────────────────────────────────────────────

export function handleConfigOpen(c, options = {}) {
  const { ignoreUsedWarning = false, markUsed = true } = options;
  if (!ignoreUsedWarning && c.is_used) {
    openWarnSheet(c);
  } else if (markUsed) {
    markUsedAndOpen(c);
  } else {
    openConfigSheet({ id: c.id, name: c.name || c.title, text: c.config_text });
  }
}

async function markUsedAndOpen(c) {
  try { await apiPost(`${API_URL}/api/configs/mark_used`, { config_id: c.id }); } catch {}
  await renderConnections();
  openConfigSheet({ id: c.id, name: c.name || c.title, text: c.config_text });
}

function openWarnSheet(c) {
  warnConfig = c;
  openBottomSheet(warnOverlay, warnSheet);
}

function closeWarnSheet() {
  closeBottomSheet(warnOverlay, warnSheet);
  warnConfig = null;
}

// ─── Config bottom sheet ─────────────────────────────────────────────────────

export function openConfigSheet(conn) {
  currentOpenConfig = conn;
  sheetTitle.textContent = conn.name;
  sheetTitle.setAttribute('contenteditable', 'true');
  sheetText.textContent = conn.text;

  if (sheetQr) {
    sheetQr.innerHTML = '';
    const rawText = String(conn.text || '');
    const size = Math.floor(Math.min(window.innerWidth * 0.9, 360));
    sheetQr.style.width = `${size}px`;
    sheetQr.style.height = `${size}px`;
    const img = document.createElement('img');
    img.alt = 'QR';
    img.style.cssText = `width:${size}px;height:${size}px;display:block;margin:0 auto;object-fit:contain`;
    sheetQr.appendChild(img);
    apiPost(`${API_URL}/api/qr`, { text: rawText, size })
      .then(res => { if (res?.url) img.src = res.url; else sheetQr.textContent = 'QR недоступен'; })
      .catch(() => { sheetQr.textContent = 'QR недоступен'; });
  }

  openBottomSheet(sheetOverlay, sheet);
}

export function closeConfigSheet() {
  closeBottomSheet(sheetOverlay, sheet);
  currentOpenConfig = null;
}

// ─── Event listeners ─────────────────────────────────────────────────────────

warnClose?.addEventListener('click', closeWarnSheet);
warnOverlay?.addEventListener('click', closeWarnSheet);
warnView?.addEventListener('click', () => {
  if (warnConfig) {
    openConfigSheet({ id: warnConfig.id, name: warnConfig.name || warnConfig.title, text: warnConfig.config_text });
  }
  closeWarnSheet();
});

sheetOverlay?.addEventListener('click', closeConfigSheet);
closeSheetBtn?.addEventListener('click', closeConfigSheet);

copyConfigBtn?.addEventListener('click', async () => {
  const ok = await copyText(sheetText?.innerText || '');
  if (ok) {
    copyConfigBtn.classList.add('copy-pressed');
    setTimeout(() => copyConfigBtn.classList.remove('copy-pressed'), 180);
    showToast(copyToast);
  }
});

sheetTitle?.addEventListener('input', () => {
  if (!currentOpenConfig) return;
  clearTimeout(nameSaveTimer);
  nameSaveTimer = setTimeout(async () => {
    const newName = sheetTitle.textContent?.trim() || 'Config';
    try {
      const url = adminSelected
        ? `${API_URL}/api/admin/configs/update_name`
        : `${API_URL}/api/configs/update_name`;
      await apiPost(url, { config_id: currentOpenConfig.id, name: newName });
      document.dispatchEvent(new CustomEvent('config-name-updated', { detail: { adminMode: !!adminSelected } }));
    } catch {}
  }, 600);
});
