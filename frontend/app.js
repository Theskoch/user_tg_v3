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

// API URL
const API_URL = window.location.origin;

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
            userBalance.textContent = `${userData.balance.toFixed(2)} ₽`;
            if (userBalanceTopup) {
              userBalanceTopup.textContent = `${userData.balance.toFixed(2)} ₽`;
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
        errorMessage.textContent = 'Ошибка авторизации. Попробуйте позже.';
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
    await navigator.clipboard.writeText(sheetText.textContent || '');
  } catch {}
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
      userBalance.textContent = `${userData.balance.toFixed(2)} ₽`;
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