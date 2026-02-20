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
            const userData = data.user ? data.user : await (await fetch(`${API_URL}/user`)).json();
            
            // Set balance
            userBalance.textContent = `${userData.balance.toFixed(2)} ₽`;
            
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
    }
});