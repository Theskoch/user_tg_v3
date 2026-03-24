import { autoLogin, login, getTelegramUser } from './auth.js?v=7';
import { renderConnections, fetchConnectionTypes } from './configs.js?v=7';
import {
  loadTopupHistory,
  loadTopupDetails,
  openTopupSheet
} from './topup.js?v=7';
import {
  loadAdminUsers,
  loadTariffs,
  updatePendingBadge,
  openAdminUser,
  autoOpenAdminFromQuery
} from './admin.js?v=7';
import { apiGet, API_URL } from './api.js?v=7';
import { openConsolePage, closeConsolePage } from './console.js?v=7';

let _isAdmin = false;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const loginPage     = document.getElementById('login-page');
const userPage      = document.getElementById('user-page');
const adminPage     = document.getElementById('admin-page');
const topupPage     = document.getElementById('topup-page');
const downloadPage  = document.getElementById('download-page');

const accessCodeInput = document.getElementById('access-code');
const loginBtn        = document.getElementById('login-btn');
const errorMessage    = document.getElementById('error-message');

const userInitial     = document.getElementById('user-initial');
const userBalance     = document.getElementById('user-balance');
const userBalanceTopup = document.getElementById('user-balance-topup');
const userInitialTopup = document.getElementById('user-initial-topup');
const userTariffName  = document.getElementById('user-tariff-name');
const userTariffUntil = document.getElementById('user-tariff-until');
const userTariffNameTopup  = document.getElementById('user-tariff-name-topup');
const userTariffUntilTopup = document.getElementById('user-tariff-until-topup');

const adminBtn    = document.getElementById('admin-btn');
const menuToggle  = document.getElementById('menu-toggle');
const sideMenu    = document.getElementById('side-menu');
const replenishBtn = document.getElementById('replenish-btn');
const downloadBtn  = document.getElementById('download-btn');
const downloadBack = document.getElementById('download-back');
const downloadList = document.getElementById('download-list');
const topupBack    = document.getElementById('topup-back');
const adminBack    = document.getElementById('admin-back');
const userInitialDownload = document.getElementById('user-initial-download');
const consoleOpenBtn = document.getElementById('console-open-btn');
const consoleBack    = document.getElementById('console-back');

// ─── UI helpers ───────────────────────────────────────────────────────────────

function applyTariffUi(userData) {
  const tariffName  = userData?.tariff_name || '—';
  const paidUntil   = userData?.tariff_paid_until ? new Date(userData.tariff_paid_until) : null;
  const paidUntilText = paidUntil ? paidUntil.toLocaleDateString('ru-RU') : '—';
  const nextChargeAt = userData?.tariff_next_charge_at ? new Date(userData.tariff_next_charge_at) : null;
  const tariffPrice  = Number(userData?.tariff_price_rub || 0);
  const balance      = Number(userData?.balance || 0);
  const now          = new Date();

  if (userTariffName)  userTariffName.textContent  = tariffName;
  if (userTariffUntil) userTariffUntil.textContent = paidUntil ? `до ${paidUntilText}` : '—';
  if (userTariffNameTopup)  userTariffNameTopup.textContent  = tariffName;
  if (userTariffUntilTopup) userTariffUntilTopup.textContent = paidUntil ? `до ${paidUntilText}` : '—';

  if (userBalance) {
    const isOverdue = nextChargeAt ? now >= nextChargeAt : paidUntil ? paidUntil < now : false;
    const hasDebt   = tariffPrice > 0 && balance < tariffPrice;
    userBalance.style.color = (isOverdue && hasDebt) || (paidUntil && paidUntil < now) ? '#ff5d5d' : '';
  }
}

function setUserInitials(firstName) {
  const initial = firstName ? firstName[0].toUpperCase() : 'U';
  if (userInitial) userInitial.textContent = initial;
  if (userInitialTopup) userInitialTopup.textContent = initial;
}

async function refreshUserBalance() {
  try {
    const userData = await apiGet(`${API_URL}/user`);
    const balance = Number(userData.balance || 0).toFixed(2);
    if (userBalance)      userBalance.textContent      = `${balance} ₽`;
    if (userBalanceTopup) userBalanceTopup.textContent = `${balance} ₽`;
    applyTariffUi(userData);
  } catch {}
  try { await renderConnections(); } catch {}
  if (_isAdmin) try { await updatePendingBadge(); } catch {}
}

function onLoggedIn(userData) {
  loginPage?.classList.add('hidden');
  userPage?.classList.remove('hidden');

  const tgUser = getTelegramUser();
  setUserInitials(tgUser?.first_name || userData?.first_name || '');

  const balance = Number(userData?.balance || 0).toFixed(2);
  if (userBalance)      userBalance.textContent      = `${balance} ₽`;
  if (userBalanceTopup) userBalanceTopup.textContent = `${balance} ₽`;

  applyTariffUi(userData);

  if (userData?.is_admin) {
    adminBtn?.classList.remove('hidden');
    _isAdmin = true;
  }

  setInterval(refreshUserBalance, 20000);
}

// ─── Downloads ────────────────────────────────────────────────────────────────

async function loadDownloads() {
  if (!downloadList) return;
  downloadList.innerHTML = '';
  try {
    const r = await fetch(`${API_URL}/downloads.json`);
    const data = await r.json();
    const items = data.items || [];
    if (!items.length) {
      downloadList.innerHTML = '<div class="conn-sub">Нет ссылок</div>';
      return;
    }
    items.forEach(item => {
      const card = document.createElement('button');
      card.className = 'download-card';
      card.type = 'button';
      card.innerHTML = `<img src="${item.icon}" alt=""/><span>${item.title}</span>`;
      card.addEventListener('click', () => { if (item.url) window.open(item.url, '_blank'); });
      downloadList.appendChild(card);
    });
  } catch {
    downloadList.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────────

menuToggle?.addEventListener('click', () => sideMenu?.classList.toggle('hidden'));

adminBtn?.addEventListener('click', async () => {
  userPage?.classList.add('hidden');
  adminPage?.classList.remove('hidden');
  sideMenu?.classList.add('hidden');
  if (document.getElementById('user-initial-admin')) {
    document.getElementById('user-initial-admin').textContent = userInitial?.textContent || 'A';
  }
  await loadAdminUsers();
  await loadTariffs();
  await updatePendingBadge();
});

adminBack?.addEventListener('click', () => {
  adminPage?.classList.add('hidden');
  userPage?.classList.remove('hidden');
});

consoleOpenBtn?.addEventListener('click', () => {
  openConsolePage(adminPage, document.getElementById('user-initial-admin'));
});

consoleBack?.addEventListener('click', () => {
  closeConsolePage(adminPage);
});

replenishBtn?.addEventListener('click', async () => {
  userPage?.classList.add('hidden');
  topupPage?.classList.remove('hidden');
  sideMenu?.classList.add('hidden');
  await loadTopupHistory();
});


topupBack?.addEventListener('click', () => {
  topupPage?.classList.add('hidden');
  userPage?.classList.remove('hidden');
});

downloadBtn?.addEventListener('click', async () => {
  userPage?.classList.add('hidden');
  downloadPage?.classList.remove('hidden');
  sideMenu?.classList.add('hidden');
  const userInitialDownload = document.getElementById('user-initial-download');
  if (userInitialDownload) userInitialDownload.textContent = userInitial?.textContent || 'U';
  await loadDownloads();
});

downloadBack?.addEventListener('click', () => {
  downloadPage?.classList.add('hidden');
  userPage?.classList.remove('hidden');
});

document.getElementById('pay-transfer')?.addEventListener('click', async () => {
  await loadTopupDetails();
  openTopupSheet();
});

// Refresh connections after name update (non-admin mode)
document.addEventListener('config-name-updated', async (e) => {
  if (!e.detail?.adminMode) await renderConnections();
});

// ─── Login ────────────────────────────────────────────────────────────────────

loginBtn?.addEventListener('click', async () => {
  const code = accessCodeInput?.value?.trim() || '';
  if (errorMessage) errorMessage.textContent = '';
  if (!code) {
    if (errorMessage) errorMessage.textContent = 'Введите код';
    return;
  }
  try {
    const userData = await login(code);
    onLoggedIn(userData);
    await renderConnections();
  } catch (e) {
    if (errorMessage) errorMessage.textContent = e.message || 'Ошибка авторизации';
  }
});

// ─── Auto-login on load ───────────────────────────────────────────────────────

async function init() {
  await fetchConnectionTypes();
  const userData = await autoLogin();
  if (!userData) return; // stays on login page

  onLoggedIn(userData);
  await renderConnections();

  if (userData.is_admin) {
    await loadAdminUsers();
    await loadTariffs();
    await updatePendingBadge();
    await autoOpenAdminFromQuery();
  }
}

init();
