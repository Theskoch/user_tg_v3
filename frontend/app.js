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
const adminBtn = document.getElementById('admin-btn');
const debugPanel = document.getElementById('debug-panel');
const menuToggle = document.getElementById('menu-toggle');
const sideMenu = document.getElementById('side-menu');
const replenishBtn = document.getElementById('replenish-btn');
const topupPage = document.getElementById('topup-page');
const topupBack = document.getElementById('topup-back');
const userInitialTopup = document.getElementById('user-initial-topup');
const userBalanceTopup = document.getElementById('user-balance-topup');
const connectionsBox = document.getElementById('connections');
const sheet = document.getElementById('sheet');
const sheetOverlay = document.getElementById('sheet-overlay');
const sheetTitle = document.getElementById('sheet-title');
const sheetText = document.getElementById('sheet-text');
const sheetQr = document.getElementById('sheet-qr');
const copyConfigBtn = document.getElementById('copy-config');
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
const adminConfigsBox = document.getElementById('admin-configs');
const adminConfigAdd = document.getElementById('admin-config-add');
const adminUserDelete = document.getElementById('admin-user-delete');
const adminInitial = document.getElementById('user-initial-admin');
const adminInitialUser = document.getElementById('user-initial-admin-user');
const addOverlay = document.getElementById('add-overlay');
const addSheet = document.getElementById('add-sheet');
const addText = document.getElementById('add-text');
const addSave = document.getElementById('add-save');
const addCancel = document.getElementById('add-cancel');
const qrVideo = document.getElementById('qr-video');
const qrCanvas = document.getElementById('qr-canvas');

// API URL
const API_URL = window.location.origin;

async function apiGet(path) {
  const r = await fetch(path, { credentials: 'include' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPost(path, payload = {}) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
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
        if (debugPanel) {
            debugPanel.style.display = 'block';
            debugPanel.textContent = `tg.initData=${tg?.initData || 'EMPTY'}\nuser=${JSON.stringify(tg?.initDataUnsafe?.user || {})}`;
        }
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
            body: JSON.stringify({
                code: code,
                telegram_user: telegramUser
            })
        });

        if (debugPanel) {
            debugPanel.textContent += `\nstatus=${response.status}`;
        }

        // Parse response
        const data = await response.json();

        if (debugPanel) {
            debugPanel.textContent += `\nresp=${JSON.stringify(data)}`;
        }

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
            const userData = data.user ? data.user : await (await fetch(`${API_URL}/user`)).json();
            
            // Set balance
            const balance = Number(userData.balance || 0).toFixed(2);
            userBalance.textContent = `${balance} ₽`;
            if (userBalanceTopup) {
              userBalanceTopup.textContent = `${balance} ₽`;
            }
            if (userInitialTopup) {
              userInitialTopup.textContent = userInitial.textContent;
            }
            
            // Show/hide admin button based on user role
            if (userData.is_admin) {
                adminBtn.classList.remove('hidden');
            }
        } else {
            errorMessage.textContent = data.message || 'Неверный код доступа';
        }
    } catch (error) {
        console.error('Authentication error:', error);
        errorMessage.textContent = error?.message || 'Ошибка авторизации. Попробуйте позже.';
        if (debugPanel) {
            debugPanel.textContent += `\nerror=${error?.message || String(error)}`;
        }
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

// Connections placeholder
function renderConnections() {
  if (!connectionsBox) return;
  connectionsBox.innerHTML = '';

  const dummy = {
    title: 'Connection #1',
    proto: 'VLESS',
    name: 'NL-1 Amsterdam',
    text: 'vless://example-connection-text'
  };

  const card = document.createElement('div');
  card.className = 'conn-card';
  card.innerHTML = `
    <div class="conn-title">${dummy.name}</div>
    <div class="conn-sub">${dummy.proto} • ${dummy.title}</div>
    <div class="conn-sub">${dummy.text.slice(0, 18)}...</div>
  `;
  card.addEventListener('click', () => openSheet(dummy));
  connectionsBox.appendChild(card);
}

function openSheet(conn) {
  if (!sheet || !sheetOverlay) return;
  sheetTitle.textContent = conn.name;
  sheetText.textContent = conn.text;
  if (sheetQr) {
    sheetQr.innerHTML = '';
    if (window.QRCode) {
      new QRCode(sheetQr, { text: conn.text, width: 180, height: 180 });
    } else {
      sheetQr.textContent = 'QR';
    }
  }
  sheetOverlay.classList.remove('hidden');
  sheet.classList.remove('hidden');
}

function closeSheet() {
  sheetOverlay?.classList.add('hidden');
  sheet?.classList.add('hidden');
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
  } catch {}
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
  if (adminInitialUser) adminInitialUser.textContent = (u.first_name || 'U')[0].toUpperCase();
  adminUserTitle.textContent = `${u.first_name || ''} @${u.username || ''}`;

  if (adminTariffSelect) {
    adminTariffSelect.value = u.tariff_id ? String(u.tariff_id) : '';
  }
  if (adminBalanceInput) {
    adminBalanceInput.value = (Number(u.balance || 0)).toFixed(2);
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
    openBtn.addEventListener('click', () => openSheet({ name: c.name || c.title, text: c.config_text }));
    delBtn.addEventListener('click', async () => {
      await apiPost(`${API_URL}/api/admin/configs/delete`, { config_id: c.id });
      await loadAdminConfigs();
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
  const txt = addText.value.trim();
  if (!txt) return;
  await apiPost(`${API_URL}/api/admin/configs/add`, {
    target_user_id: ADMIN_SELECTED.id,
    title: 'Config',
    config_text: txt
  });
  closeAddSheet();
  await loadAdminConfigs();
});

let qrStream = null;
let qrScanTimer = null;

function openAddSheet() {
  addText.value = '';
  addOverlay?.classList.remove('hidden');
  addSheet?.classList.remove('hidden');
  startQr();
}

function closeAddSheet() {
  addOverlay?.classList.add('hidden');
  addSheet?.classList.add('hidden');
  stopQr();
}

async function startQr() {
  try {
    if (!qrVideo) return;
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    qrVideo.srcObject = qrStream;
    await qrVideo.play();
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
}

function scanQrLoop() {
  if (!qrVideo || !qrCanvas) return;
  const ctx = qrCanvas.getContext('2d');
  qrCanvas.width = qrVideo.videoWidth || 320;
  qrCanvas.height = qrVideo.videoHeight || 240;
  ctx.drawImage(qrVideo, 0, 0, qrCanvas.width, qrCanvas.height);
  const img = ctx.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
  const code = window.jsQR ? window.jsQR(img.data, img.width, img.height) : null;
  if (code && code.data) {
    addText.value = code.data;
  }
  qrScanTimer = requestAnimationFrame(scanQrLoop);
}

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
      body: JSON.stringify({ code: '', telegram_user: telegramUser })
    });

    const data = await response.json();

    if (data.success) {
      loginPage.classList.add('hidden');
      userPage.classList.remove('hidden');

      userInitial.textContent = telegramUser.first_name
        ? telegramUser.first_name[0].toUpperCase()
        : 'U';

      const userData = data.user ? data.user : await (await fetch(`${API_URL}/user`)).json();
      const balance = Number(userData.balance || 0).toFixed(2);
      userBalance.textContent = `${balance} ₽`;
      if (userBalanceTopup) {
        userBalanceTopup.textContent = `${balance} ₽`;
      }
      if (userInitialTopup) {
        userInitialTopup.textContent = userInitial.textContent;
      }
      if (userData.is_admin) {
        adminBtn.classList.remove('hidden');
      }
    }
  } catch (e) {
    // silent
  }
}

tryAutoLogin();
renderConnections();