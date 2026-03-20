// Telegram Web App initialization
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
}

// Page elements
const loginPage = document.getElementById('login-page');
const userPage = document.getElementById('user-page');
const loginBtn = document.getElementById('login-btn');
const accessCodeInput = document.getElementById('access-code');
const errorMessage = document.getElementById('error-message');
const userInitial = document.getElementById('user-initial');
const userBalance = document.getElementById('user-balance');
const userTariffName = document.getElementById('user-tariff-name');
const userTariffUntil = document.getElementById('user-tariff-until');
const adminBtn = document.getElementById('admin-btn');
const menuToggle = document.getElementById('menu-toggle');
const sideMenu = document.getElementById('side-menu');
const replenishBtn = document.getElementById('replenish-btn');
const downloadBtn = document.getElementById('download-btn');
const topupPage = document.getElementById('topup-page');
const topupBack = document.getElementById('topup-back');
const downloadPage = document.getElementById('download-page');
const downloadBack = document.getElementById('download-back');
const downloadList = document.getElementById('download-list');
const userInitialDownload = document.getElementById('user-initial-download');
const userInitialTopup = document.getElementById('user-initial-topup');
const userBalanceTopup = document.getElementById('user-balance-topup');
const userTariffNameTopup = document.getElementById('user-tariff-name-topup');
const userTariffUntilTopup = document.getElementById('user-tariff-until-topup');
const connectionsBox = document.getElementById('connections');
const sheet = document.getElementById('sheet');
const sheetOverlay = document.getElementById('sheet-overlay');
const sheetTitle = document.getElementById('sheet-title');
let CURRENT_OPEN_CONFIG = null;
const sheetText = document.getElementById('sheet-text');
const sheetQr = document.getElementById('sheet-qr');
const copyConfigBtn = document.getElementById('copy-config');
const copyToast = document.getElementById('copy-toast');
const closeSheetBtn = document.getElementById('close-sheet');
const adminPage = document.getElementById('admin-page');
const adminBack = document.getElementById('admin-back');
const adminUsersBox = document.getElementById('admin-users');
const inviteAdminBtn = document.getElementById('invite-admin');
const inviteUserBtn = document.getElementById('invite-user');
const inviteCodeBox = document.getElementById('invite-code');
const inviteCopyBtn = document.getElementById('invite-copy');
const inviteCopyToast = document.getElementById('invite-copy-toast');
const adminUserPage = document.getElementById('admin-user-page');
const adminUserBack = document.getElementById('admin-user-back');
const adminUserTitle = document.getElementById('admin-user-title');
const adminTariffSelect = document.getElementById('admin-tariff');
const adminTariffSave = document.getElementById('admin-tariff-save');
const adminBalanceInput = document.getElementById('admin-balance');
const adminBalanceSave = document.getElementById('admin-balance-save');
const adminBalanceCurrent = document.getElementById('admin-balance-current');
const adminTariffUntil = document.getElementById('admin-tariff-until');
const adminTariffUntilSave = document.getElementById('admin-tariff-until-save');
const adminConfigsBox = document.getElementById('admin-configs');
const adminConfigAdd = document.getElementById('admin-config-add');
const adminUserDelete = document.getElementById('admin-user-delete');
const adminInitial = document.getElementById('user-initial-admin');
const adminInitialUser = document.getElementById('user-initial-admin-user');
const addOverlay = document.getElementById('add-overlay');
const addSheet = document.getElementById('add-sheet');
const addText = document.getElementById('add-text');
const addType = document.getElementById('add-type');
const addName = document.getElementById('add-name');
const addSave = document.getElementById('add-save');
const addCancel = document.getElementById('add-cancel');
const qrVideo = document.getElementById('qr-video');
const qrCanvas = document.getElementById('qr-canvas');
const qrRescan = document.getElementById('qr-rescan');
const warnOverlay = document.getElementById('warn-overlay');
const warnSheet = document.getElementById('warn-sheet');
const warnView = document.getElementById('warn-view');
const warnClose = document.getElementById('warn-close');
const payTransferBtn = document.getElementById('pay-transfer');
const topupOverlay = document.getElementById('topup-overlay');
const topupSheet = document.getElementById('topup-sheet');
const topupAmountInput = document.getElementById('topup-amount');
const topupSubmit = document.getElementById('topup-submit');
const topupCancel = document.getElementById('topup-cancel');
const topupStepAmount = document.getElementById('topup-step-amount');
const topupStepInfo = document.getElementById('topup-step-info');
const topupInfoText = document.getElementById('topup-info-text');
const topupCopy = document.getElementById('topup-copy');
const topupSent = document.getElementById('topup-sent');
const topupHistory = document.getElementById('topup-history');
const topupHistoryMore = document.getElementById('topup-history-more');
const topupAllPage = document.getElementById('topup-all-page');
const topupAllBack = document.getElementById('topup-all-back');
const topupHistoryAll = document.getElementById('topup-history-all');
const userInitialTopupAll = document.getElementById('user-initial-topup-all');
const adminTopupHistory = document.getElementById('admin-topup-history');
const adminTopupHistoryMore = document.getElementById('admin-topup-history-more');
const adminTopupAllPage = document.getElementById('admin-topup-all-page');
const adminTopupAllBack = document.getElementById('admin-topup-all-back');
const adminTopupHistoryAll = document.getElementById('admin-topup-history-all');
const adminInitialTopupAll = document.getElementById('user-initial-admin-topup-all');
const topupCopyToast = document.getElementById('topup-copy-toast');
const adminTopupOverlay = document.getElementById('admin-topup-overlay');
const adminTopupSheet = document.getElementById('admin-topup-sheet');
const adminTopupText = document.getElementById('admin-topup-text');
const adminTopupApprove = document.getElementById('admin-topup-approve');
const adminTopupReject = document.getElementById('admin-topup-reject');
const adminTopupClose = document.getElementById('admin-topup-close');
const adminPendingCard = document.getElementById('admin-pending-card');
const adminPendingOpen = document.getElementById('admin-pending-open');
const adminPendingPage = document.getElementById('admin-pending-page');
const adminPendingBack = document.getElementById('admin-pending-back');
const adminPendingList = document.getElementById('admin-pending-list');
const adminInitialPending = document.getElementById('user-initial-admin-pending');

let ADMIN_TOPUP_SELECTED = null;

let TOPUP_DETAILS = { bank_name: 'Т-Банк', phone: '+79857959395' };

async function loadTopupDetails() {
  try {
    const r = await fetch(`${API_URL}/topup_details.json`, { cache: 'no-store' });
    const data = await r.json();
    TOPUP_DETAILS = { ...TOPUP_DETAILS, ...data };
  } catch {}
}

function openTopupSheet() {
  if (!topupOverlay || !topupSheet) return;
  topupAmountInput.value = '';
  topupStepAmount?.classList.remove('hidden');
  topupStepInfo?.classList.add('hidden');
  topupOverlay.classList.remove('hidden');
  topupSheet.classList.remove('hidden');
  requestAnimationFrame(() => topupSheet.classList.add('show'));
}

function closeTopupSheet() {
  topupSheet?.classList.remove('show');
  topupOverlay?.classList.add('hidden');
  setTimeout(() => topupSheet?.classList.add('hidden'), 250);
}

function showTopupInfo() {
  if (topupStepAmount) topupStepAmount.classList.add('hidden');
  if (topupStepInfo) topupStepInfo.classList.remove('hidden');
  if (topupInfoText) {
    topupInfoText.textContent = `Тип пополнения: Перевод. Для пополнения совершите перевод на ${TOPUP_DETAILS.bank_name}, по номеру ${TOPUP_DETAILS.phone} и ожидайте зачисление. Зачисление средств происходит в течение 1–2 часов, максимум 24 часа.`;
  }
}

function formatTopupStatus(status) {
  if (status === 'approved') return { text: 'Подтвержден', cls: 'approved' };
  if (status === 'rejected') return { text: 'Отклонён', cls: 'rejected' };
  return { text: 'На подтверждении', cls: 'pending' };
}

function renderTopupCard(t) {
  const status = formatTopupStatus(t.status);
  const card = document.createElement('div');
  card.className = 'conn-card';
  const date = t.created_at ? new Date(t.created_at).toLocaleString('ru-RU') : '—';
  if (t.status === 'pending') card.classList.add('pending-highlight');
  card.innerHTML = `
    <div class="conn-title">${Number(t.amount || 0).toFixed(2)} ₽</div>
    <div class="conn-sub">${date} • ${formatTopupMethod(t.method)}</div>
    <div class="topup-status ${status.cls}">${status.text}</div>
  `;
  return card;
}

async function loadAdminPendingTopups() {
  if (!adminPendingList) return;
  adminPendingList.innerHTML = '';
  try {
    const items = await apiGet(`${API_URL}/api/admin/topup/pending`);
    if (!items.length) {
      adminPendingList.innerHTML = '<div class="conn-sub">Нет платежей на подтверждение</div>';
      return;
    }
    items.forEach(t => {
      const card = renderTopupCard(t);
      card.addEventListener('click', () => openAdminTopupSheet(t));
      adminPendingList.appendChild(card);
    });
  } catch {
    adminPendingList.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
  }
}

async function updatePendingBadge() {
  if (!adminPendingCard) return;
  try {
    const items = await apiGet(`${API_URL}/api/admin/topup/pending`);
    if (items.length) {
      adminPendingCard.classList.remove('hidden');
    } else {
      adminPendingCard.classList.add('hidden');
    }
  } catch {
    adminPendingCard.classList.add('hidden');
  }
}

function formatTopupMethod(method) {
  if (method === 'transfer') return 'Перевод';
  return method || '—';
}

function openAdminTopupSheet(ticket) {
  if (!adminTopupOverlay || !adminTopupSheet) return;
  ADMIN_TOPUP_SELECTED = ticket;
  if (adminTopupText) {
    const date = ticket.created_at ? new Date(ticket.created_at).toLocaleString('ru-RU') : '—';
    const status = formatTopupStatus(ticket.status);
    let extra = '';
    if (ticket.status === 'approved') {
      const who = ticket.approved_by_name || '—';
      const when = ticket.approved_at ? new Date(ticket.approved_at).toLocaleString('ru-RU') : '—';
      extra = `\nПодтвердил: ${who}\nДата: ${when}`;
    } else if (ticket.status === 'rejected') {
      const who = ticket.rejected_by_name || '—';
      const when = ticket.rejected_at ? new Date(ticket.rejected_at).toLocaleString('ru-RU') : '—';
      extra = `\nОтклонил: ${who}\nДата: ${when}`;
    }
    adminTopupText.textContent = `Платёж ${Number(ticket.amount || 0).toFixed(2)} ₽ • ${formatTopupMethod(ticket.method)} • ${date}\nСтатус: ${status.text}${extra}`;
  }
  const canAct = ticket?.status === 'pending';
  if (adminTopupApprove) {
    adminTopupApprove.disabled = !canAct;
    adminTopupApprove.classList.toggle('hidden', !canAct);
  }
  if (adminTopupReject) {
    adminTopupReject.disabled = !canAct;
    adminTopupReject.classList.toggle('hidden', !canAct);
  }
  adminTopupOverlay.classList.remove('hidden');
  adminTopupSheet.classList.remove('hidden');
  requestAnimationFrame(() => adminTopupSheet.classList.add('show'));
}

function closeAdminTopupSheet() {
  adminTopupSheet?.classList.remove('show');
  adminTopupOverlay?.classList.add('hidden');
  setTimeout(() => adminTopupSheet?.classList.add('hidden'), 250);
  ADMIN_TOPUP_SELECTED = null;
}

async function loadTopupHistory() {
  if (!topupHistory) return;
  topupHistory.innerHTML = '';
  try {
    const items = await apiGet(`${API_URL}/api/topup/history`);
    if (!items.length) {
      topupHistory.innerHTML = '<div class="conn-sub">Пока нет пополнений</div>';
      if (topupHistoryMore) topupHistoryMore.classList.add('hidden');
      return;
    }
    const visible = items.slice(0, 3);
    visible.forEach(t => topupHistory.appendChild(renderTopupCard(t)));
    if (topupHistoryMore) {
      if (items.length > 3) topupHistoryMore.classList.remove('hidden');
      else topupHistoryMore.classList.add('hidden');
    }
  } catch {
    topupHistory.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
    if (topupHistoryMore) topupHistoryMore.classList.add('hidden');
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

async function loadAdminTopupHistory() {
  if (!ADMIN_SELECTED || !adminTopupHistory) return;
  adminTopupHistory.innerHTML = '';
  try {
    const items = await apiPost(`${API_URL}/api/admin/topup/history`, { target_user_id: ADMIN_SELECTED.id });
    if (!items.length) {
      adminTopupHistory.innerHTML = '<div class="conn-sub">Нет пополнений</div>';
      if (adminTopupHistoryMore) adminTopupHistoryMore.classList.add('hidden');
      return;
    }
    const visible = items.slice(0, 3);
    visible.forEach(t => {
      const card = renderTopupCard(t);
      card.addEventListener('click', () => openAdminTopupSheet(t));
      adminTopupHistory.appendChild(card);
    });
    if (adminTopupHistoryMore) {
      if (items.length > 3) adminTopupHistoryMore.classList.remove('hidden');
      else adminTopupHistoryMore.classList.add('hidden');
    }
  } catch {
    adminTopupHistory.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
    if (adminTopupHistoryMore) adminTopupHistoryMore.classList.add('hidden');
  }
}

async function loadAdminTopupHistoryAll() {
  if (!ADMIN_SELECTED || !adminTopupHistoryAll) return;
  adminTopupHistoryAll.innerHTML = '';
  try {
    const items = await apiPost(`${API_URL}/api/admin/topup/history`, { target_user_id: ADMIN_SELECTED.id });
    if (!items.length) {
      adminTopupHistoryAll.innerHTML = '<div class="conn-sub">Нет пополнений</div>';
      return;
    }
    items.forEach(t => {
      const card = renderTopupCard(t);
      card.addEventListener('click', () => openAdminTopupSheet(t));
      adminTopupHistoryAll.appendChild(card);
    });
  } catch {
    adminTopupHistoryAll.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
  }
}

// API URL
const API_URL = window.location.origin;

function saveTelegramUser(user) {
  try {
    if (user?.id) {
      localStorage.setItem('tg_user', JSON.stringify(user));
    }
  } catch {}
}

function getStoredTelegramUser() {
  try {
    const raw = localStorage.getItem('tg_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getTelegramId() {
  const liveId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || null;
  if (liveId) return liveId;
  const stored = getStoredTelegramUser();
  return stored?.id || null;
}

function loadQrLib() {
  return new Promise((resolve, reject) => {
    const existing = window.QRCode || window.qrcode || window.QRCodeGenerator;
    if (existing) return resolve(existing);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
    script.onload = () => resolve(window.QRCode || window.qrcode || window.QRCodeGenerator);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function getAuthHeaders() {
  const telegramId = getTelegramId();
  return telegramId ? { 'X-Telegram-Id': String(telegramId) } : {};
}

async function apiGet(path) {
  const r = await fetch(path, {
    credentials: 'include',
    cache: 'no-store',
    headers: getAuthHeaders()
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPost(path, payload = {}) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function applyTariffUi(userData) {
  const tariffName = userData?.tariff_name || '—';
  const paidUntil = userData?.tariff_paid_until ? new Date(userData.tariff_paid_until) : null;
  const paidUntilText = paidUntil ? paidUntil.toLocaleDateString('ru-RU') : '—';
  const nextChargeAt = userData?.tariff_next_charge_at ? new Date(userData.tariff_next_charge_at) : null;
  const tariffPrice = Number(userData?.tariff_price_rub || 0);
  const balanceValue = Number(userData?.balance || 0);
  const now = new Date();

  if (userTariffName) userTariffName.textContent = tariffName;
  if (userTariffUntil) userTariffUntil.textContent = paidUntil ? `до ${paidUntilText}` : '—';

  if (userTariffNameTopup) userTariffNameTopup.textContent = tariffName;
  if (userTariffUntilTopup) userTariffUntilTopup.textContent = paidUntil ? `до ${paidUntilText}` : '—';

  if (userBalance) {
    const isOverdue = nextChargeAt ? now >= nextChargeAt : paidUntil ? paidUntil < now : false;
    const hasDebt = tariffPrice > 0 && balanceValue < tariffPrice;
    if (isOverdue && hasDebt) {
      userBalance.style.color = '#ff5d5d';
    } else if (paidUntil && paidUntil < now) {
      userBalance.style.color = '#ff5d5d';
    } else {
      userBalance.style.color = '';
    }
  }
}

async function refreshUserBalance() {
  try {
    const userData = await apiGet(`${API_URL}/user`);
    const balance = Number(userData.balance || 0).toFixed(2);
    if (userBalance) userBalance.textContent = `${balance} ₽`;
    if (userBalanceTopup) userBalanceTopup.textContent = `${balance} ₽`;
    applyTariffUi(userData);
  } catch {}
}

// Authentication
loginBtn.addEventListener('click', async () => {
    const code = accessCodeInput.value.trim();
    
    // Clear previous error
    errorMessage.textContent = '';
    
    // Validate input
    if (!code) {
        errorMessage.textContent = 'Введите код';
        return;
    }
    
    try {
        // Prepare telegram user data
        if (!tg || !tg.initDataUnsafe || !tg.initDataUnsafe.user) {
            errorMessage.textContent = 'Откройте приложение из Telegram';
            return;
        }

        const telegramUser = {
            id: tg.initDataUnsafe.user.id,
            username: tg.initDataUnsafe.user.username,
            first_name: tg.initDataUnsafe.user.first_name,
            last_name: tg.initDataUnsafe.user.last_name
        };
        saveTelegramUser(telegramUser);
        
        // Send authentication request
        const response = await fetch(`${API_URL}/auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                code: code,
                telegram_user: telegramUser
            })
        });


        // Parse response
        const data = await response.json();


        // Handle authentication result
        if (data.success) {
            // Hide login page
            loginPage.classList.add('hidden');
            
            // Show user page
            userPage.classList.remove('hidden');
            
            // Set user initial
            userInitial.textContent = telegramUser.first_name 
                ? telegramUser.first_name[0].toUpperCase() 
                : 'U';
            
            // Fetch and set user details
            const userData = await apiGet(`${API_URL}/user`);
            
            // Set balance
            const balance = Number(userData.balance || 0).toFixed(2);
            userBalance.textContent = `${balance} ₽`;
            if (userBalanceTopup) {
              userBalanceTopup.textContent = `${balance} ₽`;
            }
            if (userInitialTopup) {
              userInitialTopup.textContent = userInitial.textContent;
            }

            applyTariffUi(userData);
            
            // Show/hide admin button based on user role
            if (userData.is_admin) {
                adminBtn.classList.remove('hidden');
            }
        await renderConnections();
        setInterval(refreshUserBalance, 20000);
        } else {
            errorMessage.textContent = data.message || 'Неверный код доступа';
        }
    } catch (error) {
        console.error('Authentication error:', error);
        errorMessage.textContent = error?.message || 'Ошибка авторизации. Попробуйте позже.';
    }
});

// Basic menu toggle
if (menuToggle && sideMenu) {
  menuToggle.addEventListener('click', () => {
    sideMenu.classList.toggle('hidden');
  });
}

// Admin navigation
if (adminBtn && adminPage) {
  adminBtn.addEventListener('click', async () => {
    userPage.classList.add('hidden');
    adminPage.classList.remove('hidden');
    sideMenu?.classList.add('hidden');
    if (adminInitial) adminInitial.textContent = userInitial.textContent || 'A';
    await loadAdminUsers();
    await loadTariffs();
    await updatePendingBadge();
  });
}

adminBack?.addEventListener('click', () => {
  adminPage.classList.add('hidden');
  userPage.classList.remove('hidden');
});

adminUserBack?.addEventListener('click', () => {
  adminUserPage.classList.add('hidden');
  adminPage.classList.remove('hidden');
});

adminPendingOpen?.addEventListener('click', async () => {
  adminPage.classList.add('hidden');
  adminPendingPage?.classList.remove('hidden');
  if (adminInitialPending) {
    adminInitialPending.textContent = userInitial.textContent || 'A';
  }
  await loadAdminPendingTopups();
});

adminPendingBack?.addEventListener('click', () => {
  adminPendingPage?.classList.add('hidden');
  adminPage.classList.remove('hidden');
});

// Top up navigation
if (replenishBtn && topupPage) {
  replenishBtn.addEventListener('click', () => {
    userPage.classList.add('hidden');
    topupPage.classList.remove('hidden');
    sideMenu?.classList.add('hidden');
    loadTopupHistory();
  });
}

if (downloadBtn && downloadPage) {
  downloadBtn.addEventListener('click', async () => {
    userPage.classList.add('hidden');
    downloadPage.classList.remove('hidden');
    sideMenu?.classList.add('hidden');
    if (userInitialDownload) userInitialDownload.textContent = userInitial.textContent || 'U';
    await loadDownloads();
  });
}

if (userBalance && topupPage) {
  userBalance.addEventListener('click', () => {
    userPage.classList.add('hidden');
    topupPage.classList.remove('hidden');
    loadTopupHistory();
  });
}

if (topupBack) {
  topupBack.addEventListener('click', () => {
    topupPage.classList.add('hidden');
    userPage.classList.remove('hidden');
  });
}

if (topupHistoryMore && topupAllPage) {
  topupHistoryMore.addEventListener('click', async () => {
    topupPage.classList.add('hidden');
    topupAllPage.classList.remove('hidden');
    if (userInitialTopupAll) userInitialTopupAll.textContent = userInitial.textContent || 'U';
    await loadTopupHistoryAll();
  });
}

if (topupAllBack) {
  topupAllBack.addEventListener('click', () => {
    topupAllPage.classList.add('hidden');
    topupPage.classList.remove('hidden');
  });
}

payTransferBtn?.addEventListener('click', async () => {
  await loadTopupDetails();
  openTopupSheet();
});

topupCancel?.addEventListener('click', closeTopupSheet);
topupOverlay?.addEventListener('click', closeTopupSheet);

topupSubmit?.addEventListener('click', () => {
  const amount = parseFloat(String(topupAmountInput?.value || '').replace(',', '.'));
  if (!amount || amount <= 0) return;
  showTopupInfo();
});

topupCopy?.addEventListener('click', async () => {
  try {
    const phone = TOPUP_DETAILS.phone || '';
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = phone;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (topupCopyToast) {
      topupCopyToast.classList.add('show');
      setTimeout(() => topupCopyToast.classList.remove('show'), 1800);
    }
  } catch {}
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

adminTopupApprove?.addEventListener('click', async () => {
  if (!ADMIN_TOPUP_SELECTED) return;
  await apiPost(`${API_URL}/api/admin/topup/act`, { ticket_id: ADMIN_TOPUP_SELECTED.id, action: 'approve' });
  closeAdminTopupSheet();
  await loadAdminTopupHistory();
  await loadAdminPendingTopups();
  await updatePendingBadge();
  await loadAdminUsers();
});

adminTopupReject?.addEventListener('click', async () => {
  if (!ADMIN_TOPUP_SELECTED) return;
  await apiPost(`${API_URL}/api/admin/topup/act`, { ticket_id: ADMIN_TOPUP_SELECTED.id, action: 'reject' });
  closeAdminTopupSheet();
  await loadAdminTopupHistory();
  await loadAdminPendingTopups();
  await updatePendingBadge();
  await loadAdminUsers();
});

adminTopupClose?.addEventListener('click', closeAdminTopupSheet);
adminTopupOverlay?.addEventListener('click', closeAdminTopupSheet);

if (adminTopupHistoryMore && adminTopupAllPage) {
  adminTopupHistoryMore.addEventListener('click', async () => {
    adminUserPage.classList.add('hidden');
    adminTopupAllPage.classList.remove('hidden');
    if (adminInitialTopupAll) {
      const initial = (ADMIN_SELECTED?.first_name || userInitial.textContent || 'A')[0].toUpperCase();
      adminInitialTopupAll.textContent = initial;
    }
    await loadAdminTopupHistoryAll();
  });
}

if (adminTopupAllBack) {
  adminTopupAllBack.addEventListener('click', () => {
    adminTopupAllPage.classList.add('hidden');
    adminUserPage.classList.remove('hidden');
  });
}

if (downloadBack) {
  downloadBack.addEventListener('click', () => {
    downloadPage.classList.add('hidden');
    userPage.classList.remove('hidden');
  });
}

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
      card.innerHTML = `
        <img src="${item.icon}" alt="" />
        <span>${item.title}</span>
      `;
      card.addEventListener('click', () => {
        if (item.url) window.open(item.url, '_blank');
      });
      downloadList.appendChild(card);
    });
  } catch {
    downloadList.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
  }
}

let CONNECTION_TYPES = [];
async function fetchConnectionTypes() {
  try {
    const r = await fetch(`${API_URL}/connection_types.json`, { cache: 'no-store' });
    const data = await r.json();
    CONNECTION_TYPES = data.types || [];
  } catch {
    CONNECTION_TYPES = [];
  }
}

function resolveType(protocol) {
  if (!protocol) return null;
  return CONNECTION_TYPES.find(t => t.id === protocol || t.name?.toLowerCase() === String(protocol).toLowerCase());
}

// Connections placeholder
async function renderConnections() {
  if (!connectionsBox) return;
  connectionsBox.innerHTML = '';
  try {
    const configs = await apiGet(`${API_URL}/api/configs`);
    if (!CONNECTION_TYPES.length) await fetchConnectionTypes();
    if (!configs.length) {
      connectionsBox.innerHTML = '<div class="conn-sub">Нет подключений</div>';
      return;
    }
    configs.forEach(c => {
      const type = resolveType(c.protocol);
      const typeBadge = type
        ? `<span class="type-badge" style="background:${type.bg}; color:${type.text};">${type.name}</span>`
        : '';
      const card = document.createElement('div');
      card.className = 'conn-card';
      if (c.is_used) card.classList.add('used');
      card.innerHTML = `
        <div class="conn-title">${c.name || c.title || 'Config'}</div>
        ${typeBadge}
        <div class="conn-sub">${(c.protocol || '—')} • ${String(c.config_text || '').slice(0, 18)}...</div>
      `;
      card.addEventListener('click', () => handleConfigOpen(c));
      connectionsBox.appendChild(card);
    });
  } catch {
    connectionsBox.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
  }
}

function handleConfigOpen(c, options = {}) {
  const { ignoreUsedWarning = false, markUsed = true } = options;
  if (!ignoreUsedWarning && c.is_used) {
    openWarnSheet(c);
  } else {
    if (markUsed) {
      markUsedAndOpen(c);
    } else {
      openSheet({ id: c.id, name: c.name || c.title, text: c.config_text });
    }
  }
}

async function markUsedAndOpen(c) {
  try {
    await apiPost(`${API_URL}/api/configs/mark_used`, { config_id: c.id });
  } catch {}
  await renderConnections();
  openSheet({ id: c.id, name: c.name || c.title, text: c.config_text });
}

let warnConfig = null;
function openWarnSheet(c) {
  warnConfig = c;
  warnOverlay?.classList.remove('hidden');
  warnSheet?.classList.remove('hidden');
  requestAnimationFrame(() => warnSheet?.classList.add('show'));
}

function closeWarnSheet() {
  warnOverlay?.classList.add('hidden');
  warnSheet?.classList.remove('show');
  setTimeout(() => warnSheet?.classList.add('hidden'), 250);
  warnConfig = null;
}

warnClose?.addEventListener('click', () => {
  closeWarnSheet();
});

warnOverlay?.addEventListener('click', () => {
  closeWarnSheet();
});

warnView?.addEventListener('click', () => {
  if (warnConfig) {
    openSheet({ id: warnConfig.id, name: warnConfig.name || warnConfig.title, text: warnConfig.config_text });
  }
  closeWarnSheet();
});

function openSheet(conn) {
  if (!sheet || !sheetOverlay) return;
  CURRENT_OPEN_CONFIG = conn;
  sheetTitle.textContent = conn.name;
  sheetTitle.setAttribute('contenteditable', 'true');
  sheetText.textContent = conn.text;
  if (sheetQr) {
    sheetQr.innerHTML = '';
    try {
      const rawText = String(conn.text || '');
      const trimmed = rawText.includes('#') ? rawText.split('#')[0] : rawText;
      const size = Math.floor(Math.min(window.innerWidth * 0.9, 360));
      sheetQr.style.width = `${size}px`;
      sheetQr.style.height = `${size}px`;

      const img = document.createElement('img');
      img.alt = 'QR';
      img.style.width = `${size}px`;
      img.style.height = `${size}px`;
      img.style.display = 'block';
      img.style.margin = '0 auto';
      img.style.objectFit = 'contain';
      sheetQr.appendChild(img);

      apiPost(`${API_URL}/api/qr`, { text: rawText, size })
        .then((res) => {
          if (res?.url) {
            img.src = res.url;
          } else {
            sheetQr.textContent = 'QR недоступен';
          }
        })
        .catch(() => {
          apiPost(`${API_URL}/api/qr`, { text: trimmed, size })
            .then((res) => {
              if (res?.url) {
                img.src = res.url;
              } else {
                sheetQr.textContent = 'QR недоступен';
              }
            })
            .catch(() => {
              sheetQr.textContent = 'QR недоступен';
            });
        });
    } catch (e) {
      console.warn('QR render error', e);
      sheetQr.textContent = 'QR недоступен';
    }
  }
  sheetOverlay.classList.remove('hidden');
  sheet.classList.remove('hidden');
  requestAnimationFrame(() => sheet.classList.add('show'));
}

function closeSheet() {
  sheet?.classList.remove('show');
  sheetOverlay?.classList.add('hidden');
  setTimeout(() => sheet?.classList.add('hidden'), 250);
  CURRENT_OPEN_CONFIG = null;
}

sheetOverlay?.addEventListener('click', closeSheet);
closeSheetBtn?.addEventListener('click', closeSheet);

copyConfigBtn?.addEventListener('click', async () => {
  try {
    const value = sheetText?.innerText || '';
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (copyConfigBtn) {
      copyConfigBtn.classList.add('copy-pressed');
      setTimeout(() => copyConfigBtn.classList.remove('copy-pressed'), 180);
    }
    if (copyToast) {
      copyToast.classList.add('show');
      setTimeout(() => copyToast.classList.remove('show'), 1800);
    }
  } catch {}
});

let nameSaveTimer = null;
sheetTitle?.addEventListener('input', () => {
  if (!CURRENT_OPEN_CONFIG) return;
  if (nameSaveTimer) clearTimeout(nameSaveTimer);
  nameSaveTimer = setTimeout(async () => {
    const newName = sheetTitle.textContent?.trim() || 'Config';
    try {
      const url = ADMIN_SELECTED
        ? `${API_URL}/api/admin/configs/update_name`
        : `${API_URL}/api/configs/update_name`;
      await apiPost(url, {
        config_id: CURRENT_OPEN_CONFIG.id,
        name: newName
      });
      if (ADMIN_SELECTED) {
        await loadAdminConfigs();
      } else {
        await renderConnections();
      }
    } catch {}
  }, 600);
});

// Admin logic
let ADMIN_USERS = [];
let ADMIN_TARIFFS = [];
let ADMIN_SELECTED = null;

async function loadTariffs() {
  try {
    const r = await apiGet(`${API_URL}/api/tariffs`);
    ADMIN_TARIFFS = r.tariffs || [];
    if (adminTariffSelect) {
      adminTariffSelect.innerHTML = ADMIN_TARIFFS
        .map(t => `<option value="${t.id}">${t.name} — ${t.price_rub} ₽ / ${t.period_months} мес</option>`)
        .join('');
    }
  } catch {}
}

async function loadAdminUsers() {
  if (!adminUsersBox) return;
  adminUsersBox.innerHTML = '';
  try {
    ADMIN_USERS = await apiGet(`${API_URL}/api/admin/users`);
  } catch {
    adminUsersBox.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
    return;
  }

  ADMIN_USERS.forEach(u => {
    const card = document.createElement('div');
    card.className = 'conn-card';
    card.innerHTML = `
      <div class="user-row">
        <div>
          <div class="conn-title">${u.first_name || ''} @${u.username || ''}</div>
          <div class="conn-sub">${(Number(u.balance || 0)).toFixed(2)} ₽ • ${u.tariff_name || '—'}</div>
        </div>
        <span class="tag">${u.role}</span>
      </div>
    `;
    card.addEventListener('click', () => openAdminUser(u));
    adminUsersBox.appendChild(card);
  });

  if (ADMIN_SELECTED) {
    const fresh = ADMIN_USERS.find(x => x.id === ADMIN_SELECTED.id);
    if (fresh) ADMIN_SELECTED = fresh;
  }
}

async function openAdminUser(u) {
  ADMIN_SELECTED = u;
  userPage?.classList.add('hidden');
  adminPage.classList.add('hidden');
  adminUserPage.classList.remove('hidden');
  if (adminInitialUser && !adminInitialUser.textContent) {
    adminInitialUser.textContent = (u.first_name || 'U')[0].toUpperCase();
  }
  adminUserTitle.textContent = `${u.first_name || ''} @${u.username || ''}`;

  if (adminTariffSelect) {
    adminTariffSelect.value = u.tariff_id ? String(u.tariff_id) : '';
  }
  if (adminBalanceInput) {
    const current = (Number(u.balance || 0)).toFixed(2);
    adminBalanceInput.value = current;
    if (adminBalanceCurrent) {
      adminBalanceCurrent.textContent = `Текущий: ${current} ₽`;
    }
  }
  if (adminTariffUntil) {
    if (u.tariff_paid_until) {
      const d = new Date(u.tariff_paid_until);
      const iso = d.toISOString().slice(0, 10);
      adminTariffUntil.value = iso;
    } else {
      adminTariffUntil.value = '';
    }
  }
  await loadAdminConfigs();
  await loadAdminTopupHistory();
  await autoOpenFromQuery();
}

function getQueryParams() {
  const params = new URLSearchParams(window.location.search || '');
  const obj = {};
  params.forEach((v, k) => { obj[k] = v; });
  return obj;
}

async function openAdminUserById(userId) {
  if (!userId) return false;
  if (!ADMIN_USERS?.length) await loadAdminUsers();
  const user = ADMIN_USERS.find(u => String(u.id) === String(userId));
  if (!user) return false;
  await openAdminUser(user);
  return true;
}

async function autoOpenFromQuery() {
  const q = getQueryParams();
  if (!q.admin || !q.user_id) return;
  if (!ADMIN_SELECTED || String(ADMIN_SELECTED.id) !== String(q.user_id)) return;
  if (q.ticket_id) {
    const items = await apiPost(`${API_URL}/api/admin/topup/history`, { target_user_id: ADMIN_SELECTED.id });
    const ticket = items.find(t => String(t.id) === String(q.ticket_id));
    if (ticket) openAdminTopupSheet(ticket);
  }
}

async function autoOpenAdminFromQuery() {
  const q = getQueryParams();
  if (!q.admin || !q.user_id) return;
  const opened = await openAdminUserById(q.user_id);
  if (opened) {
    await autoOpenFromQuery();
  }
}

async function loadAdminConfigs() {
  if (!ADMIN_SELECTED || !adminConfigsBox) return;
  adminConfigsBox.innerHTML = '';
  const configs = await apiPost(`${API_URL}/api/admin/configs/list`, { target_user_id: ADMIN_SELECTED.id });
  configs.forEach(c => {
    const card = document.createElement('div');
    card.className = 'conn-card';
    card.innerHTML = `
      <div class="conn-title">${c.name || c.title || 'Config'}</div>
      <div class="conn-sub">${(c.protocol || '—')} • ${String(c.config_text || '').slice(0, 18)}...</div>
      <div class="row" style="display:flex; gap:8px; margin-top:8px;">
        <button class="btn ghost" type="button">Открыть</button>
        <button class="btn ghost" type="button">Удалить</button>
      </div>
    `;
    const [openBtn, delBtn] = card.querySelectorAll('button');
    openBtn.addEventListener('click', () => handleConfigOpen(c, { ignoreUsedWarning: true, markUsed: false }));
    delBtn.addEventListener('click', async () => {
      await apiPost(`${API_URL}/api/admin/configs/delete`, { config_id: c.id });
      await loadAdminConfigs();
      await renderConnections();
    });
    adminConfigsBox.appendChild(card);
  });
}

async function loadConnectionTypes() {
  await fetchConnectionTypes();
  if (addType) {
    const options = CONNECTION_TYPES.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    addType.innerHTML = `<option value="">—</option>${options}`;
  }
}

inviteAdminBtn?.addEventListener('click', async () => {
  try {
    const r = await apiPost(`${API_URL}/generate_code`, { role: 'admin' });
    inviteCodeBox.textContent = r.code;
  } catch {}
});

inviteUserBtn?.addEventListener('click', async () => {
  try {
    const r = await apiPost(`${API_URL}/generate_code`, { role: 'user' });
    inviteCodeBox.textContent = r.code;
  } catch {}
});

inviteCopyBtn?.addEventListener('click', async () => {
  try {
    const code = inviteCodeBox?.textContent?.trim();
    if (!code || code === '—') return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    inviteCopyBtn.classList.add('copy-pressed');
    setTimeout(() => inviteCopyBtn.classList.remove('copy-pressed'), 180);
    inviteCopyToast?.classList.add('show');
    setTimeout(() => inviteCopyToast?.classList.remove('show'), 1800);
  } catch {}
});

adminTariffSave?.addEventListener('click', async () => {
  if (!ADMIN_SELECTED) return;
  await apiPost(`${API_URL}/api/admin/user/set_tariff`, {
    target_user_id: ADMIN_SELECTED.id,
    tariff_id: Number(adminTariffSelect.value)
  });
  await loadAdminUsers();
});

adminBalanceSave?.addEventListener('click', async () => {
  if (!ADMIN_SELECTED) return;
  await apiPost(`${API_URL}/api/admin/user/set_balance`, {
    target_user_id: ADMIN_SELECTED.id,
    balance: adminBalanceInput.value
  });
  const current = Number(adminBalanceInput.value || 0).toFixed(2);
  if (adminBalanceCurrent) {
    adminBalanceCurrent.textContent = `Текущий: ${current} ₽`;
  }
  await loadAdminUsers();
});

adminTariffUntilSave?.addEventListener('click', async () => {
  if (!ADMIN_SELECTED) return;
  await apiPost(`${API_URL}/api/admin/user/set_tariff_until`, {
    target_user_id: ADMIN_SELECTED.id,
    tariff_paid_until: adminTariffUntil?.value || null
  });
  await loadAdminUsers();
});

adminConfigAdd?.addEventListener('click', async () => {
  if (!ADMIN_SELECTED) return;
  openAddSheet();
});

addCancel?.addEventListener('click', closeAddSheet);
addOverlay?.addEventListener('click', closeAddSheet);

addSave?.addEventListener('click', async () => {
  if (!ADMIN_SELECTED) return;
  const txt = (addText.value || '').replace(/\u0000/g, '').trim();
  if (!txt) return;
  await apiPost(`${API_URL}/api/admin/configs/add`, {
    target_user_id: ADMIN_SELECTED.id,
    title: 'Config',
    name: addName?.value?.trim() || 'Config',
    config_text: txt,
    protocol: addType?.value || null
  });
  closeAddSheet();
  await loadAdminConfigs();
  await renderConnections();
});

let qrStream = null;
let qrScanTimer = null;
let qrScanned = false;

function openAddSheet() {
  addText.value = '';
  if (addName) addName.value = 'Config';
  if (addType) addType.value = '';
  qrScanned = false;
  addOverlay?.classList.remove('hidden');
  addSheet?.classList.remove('hidden');
  requestAnimationFrame(() => addSheet?.classList.add('show'));
  startQr();
  loadConnectionTypes();
}

function closeAddSheet() {
  addSheet?.classList.remove('show');
  addOverlay?.classList.add('hidden');
  setTimeout(() => addSheet?.classList.add('hidden'), 250);
  stopQr();
}

async function startQr() {
  try {
    if (!qrVideo) return;
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    qrVideo.srcObject = qrStream;
    await qrVideo.play();
    qrScanned = false;
    scanQrLoop();
  } catch (e) {
    // no camera
  }
}

function stopQr() {
  if (qrScanTimer) cancelAnimationFrame(qrScanTimer);
  if (qrStream) {
    qrStream.getTracks().forEach(t => t.stop());
    qrStream = null;
  }
  qrScanned = false;
}

function scanQrLoop() {
  if (!qrVideo || !qrCanvas) return;
  if (qrScanned) return;
  const ctx = qrCanvas.getContext('2d');
  qrCanvas.width = qrVideo.videoWidth || 320;
  qrCanvas.height = qrVideo.videoHeight || 240;
  ctx.drawImage(qrVideo, 0, 0, qrCanvas.width, qrCanvas.height);
  const img = ctx.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
  const code = window.jsQR ? window.jsQR(img.data, img.width, img.height) : null;
  if (code && code.data) {
    const cleaned = String(code.data || '').replace(/\u0000/g, '').trim();
    if (cleaned) {
      addText.value = cleaned;
    }
    qrScanned = true;
    stopQr();
    return;
  }
  qrScanTimer = requestAnimationFrame(scanQrLoop);
}

qrRescan?.addEventListener('click', () => {
  startQr();
});

adminUserDelete?.addEventListener('click', async () => {
  if (!ADMIN_SELECTED) return;
  await apiPost(`${API_URL}/api/admin/user/delete`, { target_user_id: ADMIN_SELECTED.id });
  adminUserPage.classList.add('hidden');
  adminPage.classList.remove('hidden');
  await loadAdminUsers();
});

// Auto-login on load if user already exists
async function tryAutoLogin() {
  try {
    const rawUser = tg?.initDataUnsafe?.user || getStoredTelegramUser();
    if (!rawUser?.id) {
      return;
    }

    const telegramUser = {
      id: rawUser.id,
      username: rawUser.username,
      first_name: rawUser.first_name,
      last_name: rawUser.last_name
    };
    saveTelegramUser(telegramUser);

    const response = await fetch(`${API_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code: '', telegram_user: telegramUser })
    });

    const data = await response.json();

    if (data.success) {
      loginPage.classList.add('hidden');
      userPage.classList.remove('hidden');

      userInitial.textContent = telegramUser.first_name
        ? telegramUser.first_name[0].toUpperCase()
        : 'U';

      const userData = await apiGet(`${API_URL}/user`);
      const balance = Number(userData.balance || 0).toFixed(2);
      userBalance.textContent = `${balance} ₽`;
      if (userBalanceTopup) {
        userBalanceTopup.textContent = `${balance} ₽`;
      }
      if (userInitialTopup) {
        userInitialTopup.textContent = userInitial.textContent;
      }

      applyTariffUi(userData);
      if (userData.is_admin) {
        adminBtn.classList.remove('hidden');
      }
      await renderConnections();
      await loadAdminUsers();
      if (userData.is_admin) {
        await loadTariffs();
        await autoOpenAdminFromQuery();
        await updatePendingBadge();
      }

      setInterval(refreshUserBalance, 20000);
    }
  } catch (e) {
    // silent
  }
}

tryAutoLogin();