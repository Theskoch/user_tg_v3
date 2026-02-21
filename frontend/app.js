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
const adminUserPage = document.getElementById('admin-user-page');
const adminUserBack = document.getElementById('admin-user-back');
const adminUserTitle = document.getElementById('admin-user-title');
const adminTariffSelect = document.getElementById('admin-tariff');
const adminTariffSave = document.getElementById('admin-tariff-save');
const adminBalanceInput = document.getElementById('admin-balance');
const adminBalanceSave = document.getElementById('admin-balance-save');
const adminBalanceCurrent = document.getElementById('admin-balance-current');
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

// API URL
const API_URL = window.location.origin;

function getTelegramId() {
  return window.Telegram?.WebApp?.initDataUnsafe?.user?.id || null;
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

  if (userTariffName) userTariffName.textContent = tariffName;
  if (userTariffUntil) userTariffUntil.textContent = paidUntil ? `до ${paidUntilText}` : '—';

  if (userTariffNameTopup) userTariffNameTopup.textContent = tariffName;
  if (userTariffUntilTopup) userTariffUntilTopup.textContent = paidUntil ? `до ${paidUntilText}` : '—';

  if (paidUntil && userBalance) {
    if (paidUntil < new Date()) {
      userBalance.style.color = '#ff5d5d';
    } else {
      userBalance.style.color = '';
    }
  }
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

// Top up navigation
if (replenishBtn && topupPage) {
  replenishBtn.addEventListener('click', () => {
    userPage.classList.add('hidden');
    topupPage.classList.remove('hidden');
    sideMenu?.classList.add('hidden');
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
  });
}

if (topupBack) {
  topupBack.addEventListener('click', () => {
    topupPage.classList.add('hidden');
    userPage.classList.remove('hidden');
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
      const size = 180;

      if (window.QRCode && window.QRCode.toCanvas) {
        const canvas = document.createElement('canvas');
        sheetQr.appendChild(canvas);
        window.QRCode.toCanvas(canvas, rawText, { width: size, margin: 1 }, (err) => {
          if (err) {
            window.QRCode.toCanvas(canvas, trimmed, { width: size, margin: 1 }, (err2) => {
              if (err2) {
                sheetQr.textContent = 'QR слишком длинный';
              }
            });
          }
        });
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
      } else {
        sheetQr.textContent = 'QR';
      }
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
      await apiPost(`${API_URL}/api/configs/update_name`, {
        config_id: CURRENT_OPEN_CONFIG.id,
        name: newName
      });
      await renderConnections();
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
}

async function openAdminUser(u) {
  ADMIN_SELECTED = u;
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
  await loadAdminConfigs();
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
    if (!tg || !tg.initDataUnsafe || !tg.initDataUnsafe.user) {
      return;
    }

    const telegramUser = {
      id: tg.initDataUnsafe.user.id,
      username: tg.initDataUnsafe.user.username,
      first_name: tg.initDataUnsafe.user.first_name,
      last_name: tg.initDataUnsafe.user.last_name
    };

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
    }
  } catch (e) {
    // silent
  }
}

tryAutoLogin();