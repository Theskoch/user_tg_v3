// ================== TELEGRAM ==================
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// ================== HELPERS ==================
const el = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showBlocking(html) {
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#0e1014;color:#fff;padding:20px;font-family:system-ui">
      <div style="max-width:420px;margin:60px auto">
        ${html}
      </div>
    </div>
  `;
}

function mustBeTelegram() {
  if (!tg || !tg.initData) {
    showBlocking(`<h3>Ошибка запуска</h3><p>Перейдите в Telegram.</p>`);
    throw new Error("Not Telegram");
  }
}

async function api(path, payload = {}) {
  const r = await fetch(path, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ initData: tg.initData, ...payload }),
    cache: "no-store"
  });
  if (!r.ok) {
    const e = new Error(`${path} ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

function toast(text) {
  if (tg?.showToast) tg.showToast({ message: text });
  else alert(text);
}

// ================== GLOBAL STATE ==================
let ME = null;
let USERS = [];
let CURRENT_USER = null;

// ================== AUTH ==================
async function auth() {
  mustBeTelegram();
  try {
    const r = await api("/api/auth");
    ME = r.me;
  } catch (e) {
    if (e.status === 403) return showInviteScreen();
    showBlocking(`<h3>Ошибка запуска</h3><p>Перейдите в Telegram.</p>`);
    throw e;
  }
}

function showInviteScreen() {
  showBlocking(`
    <h3>Доступ отсутствует</h3>
    <p>Введите код приглашения:</p>
    <input id="inviteCode" placeholder="Invite code"
      style="width:100%;padding:10px;border-radius:8px;border:none;margin:10px 0">
    <button id="inviteBtn"
      style="width:100%;padding:12px;border-radius:10px;background:#2a7fff;color:#fff;border:none">
      Авторизоваться
    </button>
  `);

  el("inviteBtn").onclick = async () => {
    const code = el("inviteCode").value.trim();
    if (!code) return toast("Введите код");
    try {
      const r = await api("/api/redeem", { code });
      ME = r.me;
      location.reload();
    } catch {
      toast("Неверный код");
    }
  };
}

// ================== ADMIN UI ==================
function addAdminButton() {
  const menu = document.querySelector(".dropdown");
  if (!menu) return;

  const btn = document.createElement("button");
  btn.className = "dropdown-btn";
  btn.textContent = "Админ-консоль";
  btn.onclick = openAdminConsole;
  menu.appendChild(btn);
}

async function openAdminConsole() {
  USERS = await api("/api/admin/users");

  showBlocking(`
    <h3>Админ-консоль</h3>

    <div style="display:flex;gap:10px;margin-bottom:15px">
      <button id="inviteUser">➕ User</button>
      <button id="inviteAdmin">➕ Admin</button>
    </div>

    <div id="users"></div>
  `);

  el("inviteUser").onclick = () => createInvite("user");
  el("inviteAdmin").onclick = () => createInvite("admin");

  renderUsers();
}

async function createInvite(role) {
  const r = await api("/api/admin/invite", { role });
  navigator.clipboard.writeText(r.code);
  toast(`Код скопирован: ${r.code}`);
}

function renderUsers() {
  const box = el("users");
  box.innerHTML = "";

  USERS.forEach(u => {
    const div = document.createElement("div");
    div.style.padding = "10px";
    div.style.borderBottom = "1px solid #333";
    div.innerHTML = `
      <b>${escapeHtml(u.first_name || "")}</b>
      <small>@${escapeHtml(u.username || "")}</small><br>
      ${u.role} | ${u.balance_rub} ₽ | ${u.tariff_name}
    `;
    div.onclick = () => openUser(u.tg_user_id);
    box.appendChild(div);
  });
}

async function openUser(tgUserId) {
  CURRENT_USER = USERS.find(u => u.tg_user_id === tgUserId);

  const configs = await api("/api/admin/configs/list", { target_tg_user_id: tgUserId });

  showBlocking(`
    <button onclick="location.reload()">← Назад</button>
    <h3>${escapeHtml(CURRENT_USER.first_name || "")}</h3>

    <p>Баланс</p>
    <input id="bal" value="${CURRENT_USER.balance_rub}">
    <button id="saveBal">Сохранить</button>

    <p>Тариф</p>
    <input id="tarName" value="${CURRENT_USER.tariff_name}">
    <input id="tarPrice" value="${CURRENT_USER.tariff_price_rub}">
    <input id="tarPeriod" value="${CURRENT_USER.tariff_period_months}">
    <button id="saveTar">Сохранить тариф</button>

    <h4>Конфиги</h4>
    <div id="cfgs"></div>
    <button id="addCfg">➕ Добавить</button>

    <hr>
    <button id="delUser" style="color:red">Удалить пользователя</button>
  `);

  el("saveBal").onclick = () =>
    api("/api/admin/user/set_balance", {
      target_tg_user_id: tgUserId,
      balance_rub: el("bal").value
    }).then(() => toast("Сохранено"));

  el("saveTar").onclick = () =>
    api("/api/admin/user/set_tariff", {
      target_tg_user_id: tgUserId,
      tariff_name: el("tarName").value,
      tariff_price_rub: el("tarPrice").value,
      tariff_period_months: el("tarPeriod").value
    }).then(() => toast("Тариф обновлён"));

  el("delUser").onclick = async () => {
    if (!confirm("Удалить пользователя?")) return;
    await api("/api/admin/user/delete", { target_tg_user_id: tgUserId });
    toast("Удалено");
    location.reload();
  };

  renderConfigs(configs);
}

function renderConfigs(cfgs) {
  const box = el("cfgs");
  box.innerHTML = "";

  cfgs.forEach(c => {
    const d = document.createElement("div");
    d.innerHTML = `
      <b>${escapeHtml(c.title)}</b>
      <button onclick="deleteCfg(${c.id})">❌</button>
    `;
    box.appendChild(d);
  });

  el("addCfg").onclick = async () => {
    const title = prompt("Название");
    const text = prompt("Config");
    if (!text) return;
    await api("/api/admin/configs/add", {
      target_tg_user_id: CURRENT_USER.tg_user_id,
      title,
      config_text: text
    });
    toast("Добавлено");
    openUser(CURRENT_USER.tg_user_id);
  };
}

async function deleteCfg(id) {
  await api("/api/admin/configs/delete", { config_id: id });
  toast("Удалено");
  openUser(CURRENT_USER.tg_user_id);
}

// ================== BOOT ==================
(async () => {
  await auth();

  // обычный UI уже есть — просто дополняем
  if (ME.role === "admin") addAdminButton();

})();
