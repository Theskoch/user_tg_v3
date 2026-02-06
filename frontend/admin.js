document.addEventListener('DOMContentLoaded', () => {
    // Function to check authentication and load admin content
    async function loadAdminContent() {
        try {
            const tg = window.Telegram?.WebApp;
            const initData = tg?.initData || localStorage.getItem('initData');

            const response = await fetch('/api/check-admin-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData })
            });
            const { isAdmin } = await response.json();

            if (!isAdmin) {
                // Fallback to previous admin console method
                const script = document.createElement('script');
                script.src = '/app.js';
                script.onload = () => {
                    if (window.openAdminConsole) {
                        window.openAdminConsole();
                    }
                };
                document.body.appendChild(script);
                return;
            }

            // Load admin panel content
            const contentResponse = await fetch('/api/admin-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData })
            });
            const content = await contentResponse.json();

            const adminContentEl = document.getElementById('admin-content');
            adminContentEl.innerHTML = `
                <div class="admin-sections">
                    <div class="admin-section">
                        <h2>Пользователи</h2>
                        <ul>${content.users.map(user => `<li>${user.name} (ID: ${user.tg_id})</li>`).join('')}</ul>
                    </div>
                    <div class="admin-section">
                        <h2>Тарифы</h2>
                        <ul>${content.tariffs.map(tariff => `<li>${tariff.name} - ${tariff.price} ₽</li>`).join('')}</ul>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Ошибка загрузки admin-контента:', error);
            
            // Fallback to previous admin console method
            const script = document.createElement('script');
            script.src = '/app.js';
            script.onload = () => {
                if (window.openAdminConsole) {
                    window.openAdminConsole();
                }
            };
            document.body.appendChild(script);
        }
    }

    loadAdminContent();
});
