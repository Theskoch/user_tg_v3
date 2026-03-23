import { apiGet, apiPost, API_URL } from './api.js?v=3';
import { openBottomSheet, closeBottomSheet, copyText, showToast } from './ui.js?v=3';

// DOM refs
const topupOverlay    = document.getElementById('topup-overlay');
const topupSheet      = document.getElementById('topup-sheet');
const topupAmountInput = document.getElementById('topup-amount');
const topupSubmit     = document.getElementById('topup-submit');
const topupCancel     = document.getElementById('topup-cancel');
const topupStepAmount = document.getElementById('topup-step-amount');
const topupStepInfo   = document.getElementById('topup-step-info');
const topupInfoText   = document.getElementById('topup-info-text');
const topupCopy       = document.getElementById('topup-copy');
const topupSent       = document.getElementById('topup-sent');
const topupHistory    = document.getElementById('topup-history');
const topupHistoryMore = document.getElementById('topup-history-more');
const topupAllPage    = document.getElementById('topup-all-page');
const topupAllBack    = document.getElementById('topup-all-back');
const topupHistoryAll = document.getElementById('topup-history-all');
const topupPage       = document.getElementById('topup-page');
const userPage        = document.getElementById('user-page');
const topupCopyToast  = document.getElementById('topup-copy-toast');
const userInitialTopupAll = document.getElementById('user-initial-topup-all');

let TOPUP_DETAILS = { bank_name: 'Т-Банк', phone: '+79857959395' };

export async function loadTopupDetails() {
  try {
    const r = await fetch(`${API_URL}/topup_details.json`, { cache: 'no-store' });
    const data = await r.json();
    TOPUP_DETAILS = { ...TOPUP_DETAILS, ...data };
  } catch {}
}

// ─── Status helpers ──────────────────────────────────────────────────────────

function formatTopupStatus(status) {
  if (status === 'approved') return { text: 'Подтвержден', cls: 'approved' };
  if (status === 'rejected') return { text: 'Отклонён', cls: 'rejected' };
  return { text: 'На подтверждении', cls: 'pending' };
}

export function formatTopupMethod(method) {
  return method === 'transfer' ? 'Перевод' : method || '—';
}

export function renderTopupCard(t) {
  const { text, cls } = formatTopupStatus(t.status);
  const date = t.created_at ? new Date(t.created_at).toLocaleString('ru-RU') : '—';
  const card = document.createElement('div');
  card.className = 'conn-card' + (t.status === 'pending' ? ' pending-highlight' : '');
  card.innerHTML = `
    <div class="conn-title">${Number(t.amount || 0).toFixed(2)} ₽</div>
    <div class="conn-sub">${date} • ${formatTopupMethod(t.method)}</div>
    <div class="topup-status ${cls}">${text}</div>
  `;
  return card;
}

// ─── Sheet open / close ──────────────────────────────────────────────────────

export function openTopupSheet() {
  if (!topupOverlay || !topupSheet) return;
  topupAmountInput.value = '';
  topupStepAmount?.classList.remove('hidden');
  topupStepInfo?.classList.add('hidden');
  openBottomSheet(topupOverlay, topupSheet);
}

export function closeTopupSheet() {
  closeBottomSheet(topupOverlay, topupSheet);
}

function showTopupInfo() {
  topupStepAmount?.classList.add('hidden');
  topupStepInfo?.classList.remove('hidden');
  if (topupInfoText) {
    topupInfoText.textContent =
      `Тип пополнения: Перевод. Для пополнения совершите перевод на ${TOPUP_DETAILS.bank_name}, ` +
      `по номеру ${TOPUP_DETAILS.phone} и ожидайте зачисление. ` +
      `Зачисление средств происходит в течение 1–2 часов, максимум 24 часа.`;
  }
}

// ─── History ─────────────────────────────────────────────────────────────────

export async function loadTopupHistory() {
  if (!topupHistory) return;
  topupHistory.innerHTML = '';
  try {
    const items = await apiGet(`${API_URL}/api/topup/history`);
    if (!items.length) {
      topupHistory.innerHTML = '<div class="conn-sub">Пока нет пополнений</div>';
      topupHistoryMore?.classList.add('hidden');
      return;
    }
    items.slice(0, 3).forEach(t => topupHistory.appendChild(renderTopupCard(t)));
    topupHistoryMore?.classList.toggle('hidden', items.length <= 3);
  } catch {
    topupHistory.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
    topupHistoryMore?.classList.add('hidden');
  }
}

async function loadTopupHistoryAll() {
  if (!topupHistoryAll) return;
  topupHistoryAll.innerHTML = '';
  try {
    const items = await apiGet(`${API_URL}/api/topup/history`);
    if (!items.length) {
      topupHistoryAll.innerHTML = '<div class="conn-sub">Пока нет пополнений</div>';
      return;
    }
    items.forEach(t => topupHistoryAll.appendChild(renderTopupCard(t)));
  } catch {
    topupHistoryAll.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
  }
}

// ─── Event listeners ─────────────────────────────────────────────────────────

topupCancel?.addEventListener('click', closeTopupSheet);
topupOverlay?.addEventListener('click', closeTopupSheet);

topupSubmit?.addEventListener('click', () => {
  const amount = parseFloat(String(topupAmountInput?.value || '').replace(',', '.'));
  if (!amount || amount <= 0) return;
  showTopupInfo();
});

topupCopy?.addEventListener('click', async () => {
  const ok = await copyText(TOPUP_DETAILS.phone || '');
  if (ok) showToast(topupCopyToast);
});

topupSent?.addEventListener('click', async () => {
  const amount = parseFloat(String(topupAmountInput?.value || '').replace(',', '.'));
  if (!amount || amount <= 0) return;
  try {
    await apiPost(`${API_URL}/api/topup/create`, { amount, method: 'transfer' });
    closeTopupSheet();
    await loadTopupHistory();
  } catch {}
});

topupHistoryMore?.addEventListener('click', async () => {
  topupPage?.classList.add('hidden');
  topupAllPage?.classList.remove('hidden');
  const userInitial = document.getElementById('user-initial');
  if (userInitialTopupAll) userInitialTopupAll.textContent = userInitial?.textContent || 'U';
  await loadTopupHistoryAll();
});

topupAllBack?.addEventListener('click', () => {
  topupAllPage?.classList.add('hidden');
  topupPage?.classList.remove('hidden');
});
