document.addEventListener('DOMContentLoaded', () => {
    // Function to check authentication and load admin content
    async function loadAdminContent() {
        try {
            const tg = window.Telegram?.WebApp;
            if (!tg || !tg.initData) {
                alert('Пожалуйста, откройте приложение через Telegram');
                return;
            }

            const response = await fetch('/api/check-admin-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData })
            });
            const { isAdmin } = await response.json();

            if (!isAdmin) {
                alert('У вас нет доступа к администраторской панели');
                window.location.href = '/';
                return;
            }

            // Load admin panel content
            const contentResponse = await fetch('/api/admin-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData })
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
            alert('Не удалось загрузить административную панель');
            window.location.href = '/';
        }
    }

    loadAdminContent();
});
