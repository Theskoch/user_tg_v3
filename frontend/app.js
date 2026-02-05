// ================== TELEGRAM ==================
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// ================== HELPERS ==================
const el = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showBlockingScreen(title, text, extraHtml = "") {
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#0e1014;color:#fff;padding:20px;font-family:system-ui">
      <div style="max-width:420px;margin:60px auto">
        <div style="font-size:20px;font-weight:800;margin-bottom:10px">${escapeHtml(title)}</div>
        <div style="opacity:.85;line-height:1.4;margin-bottom:14px">${escapeHtml(text)}</div>
        ${extraHtml}
        <div style="opacity:.35;margin-top:16px;font-size:12px">js:v2</div>
      </div>
    </div>
  `;
}

function mustBeTelegram() {
  if (!tg || !tg.initData) {
    showBlockingScreen("Ошибка запуска", "Перейдите в Telegram.");
    throw new Error("Not in Telegram");
  }
}

async function api(path, payload = {}) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData: tg.initData, ...payload }),
    cache: "no-store",
  });
  if (!r.ok) {
    const e = new Error(`${path} ${r.status}`);
    e.status = r.status;
    return Promise.reject(e);
  }
  return r.json();
}

function toast(text) {
  if (tg?.showToast) tg.showToast({ message: text });
  else console.log("[toast]", text);
}

function setAvatarLetter() {
  const user = tg?.initDataUnsafe?.user;
  const letter = (user?.first_name?.trim()?.[0] || "U").toUpperCase();
  const a = el("avatar");
  if (a) a.textContent = letter;
}

// ================== UI INIT (должно работать даже без API) ==================
function wireMenu() {
  const burger = el("burger");
  const dropdown = el("dropdown");
  if (!burger || !dropdown) return;

  burger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdown.style.display = (dropdown.style.display === "block") ? "none" : "block";
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu")) dropdown.style.display = "none";
  });
}

function formatRub(x) {
  const n = Number(x || 0);
  return `${n.toFixed(2)} ₽`;
}

function setMeUI(me) {
  // баланс
  const balance = el("balance");
  if (balance) balance.textContent = formatRub(me.balance_rub);

  // тариф
  const tn = el("tariffName");
  const tp = el("tariffPrice");
  const np = el("nextPay");

  if (tn) tn.textContent = me.tariff?.name || "—";
  if (tp) tp.textContent = `${me.tariff?.price_rub ?? 0} ₽ / ${me.tariff?.period_months ?? 1} мес`;
  if (np) np.textContent = `Окончание: ${me.tariff?.expires_at || "—"}`;
}

// ================== ADMIN BUTTON ==================
function addAdminButton() {
  const menu = document.querySelector(".dropdown");
  if (!menu) return;

  // не добавлять повторно
  if (document.getElementById("adminBtn")) return;

  const btn = document.createElement("button");
  btn.id = "adminBtn";
  btn.className = "dropdown-btn";
  btn.type = "button";
  btn.textContent = "Админ-консоль";
  btn.addEventListener("click", () => {
    // закрыть меню
    const dd = el("dropdown");
    if (dd) dd.style.display = "none";
    openAdminConsole().catch(err => {
      console.error(err);
      toast("Ошибка админки");
    });
  });
  menu.appendChild(btn);
}

// ================== ADMIN CONSOLE (простая) ==================
async function openAdminConsole() {
  const users = await api("/api/admin/users");

  showBlockingScreen(
    "Админ-консоль",
    "Управление пользователями",
    `
    <div style="display:flex;gap:10px;margin-bottom:12px">
      <button id="invUser" style="flex:1;padding:12px;border-radius:10px;border:none">+ User</button>
      <button id="invAdmin" style="flex:1;padding:12px;border-radius:10px;border:none">+ Admin</button>
    </div>
    <div id="usersList" style="border-top:1px solid #2a2f3a"></div>
    <button id="backMain" style="margin-top:14px;width:100%;padding:12px;border-radius:10px;border:none;background:#2a7fff;color:#fff">Назад</button>
    `
  );

  el("backMain").onclick = () => {
    // вместо reload — просто вернуть на основной UI
    window.location.href = "/";
  };

  el("invUser").onclick = () => createInvite("user");
  el("invAdmin").onclick = () => createInvite("admin");

  const list = el("usersList");
  list.innerHTML = users.map(u => `
    <div data-id="${u.tg_user_id}" style="padding:10px 0;border-bottom:1px solid #2a2f3a;cursor:pointer">
      <div style="font-weight:700">${escapeHtml(u.first_name || "")} <span style="opacity:.6">@${escapeHtml(u.username || "")}</span></div>
      <div style="opacity:.75;font-size:12px">${u.role} | ${u.balance_rub} ₽ | ${escapeHtml(u.tariff_name)}</div>
    </div>
  `).join("");

  [...list.querySelectorAll("[data-id]")].forEach(div => {
    div.addEventListener("click", () => openUserEditor(Number(div.getAttribute("data-id"))));
  });
}

async function createInvite(role) {
  const r = await api("/api/admin/invite", { role });
  try { await navigator.clipboard.writeText(r.code); } catch {}
  toast("Код скопирован");
  // показываем код в alert (без VPN слов)
  showBlockingScreen("Код приглашения", r.code, `
    <button id="backAdmin" style="margin-top:14px;width:100%;padding:12px;border-radius:10px;border:none;background:#2a7fff;color:#fff">Назад</button>
  `);
  el("backAdmin").onclick = () => openAdminConsole();
}

async function openUserEditor(targetTgId) {
  const users = await api("/api/admin/users");
  const u = users.find(x => x.tg_user_id === targetTgId);
  const cfgs = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });

  showBlockingScreen("Пользователь", `${u.first_name || ""} @${u.username || ""}`, `
    <div style="margin-top:10px">
      <div style="opacity:.7;margin-bottom:6px">Баланс</div>
      <input id="bal" value="${u.balance_rub}" style="width:100%;padding:10px;border-radius:8px;border:none;margin-bottom:10px">

      <div style="opacity:.7;margin-bottom:6px">Тариф</div>
      <input id="tarName" value="${escapeHtml(u.tariff_name)}" style="width:100%;padding:10px;border-radius:8px;border:none;margin-bottom:8px">
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <input id="tarPrice" value="${u.tariff_price_rub}" style="flex:1;padding:10px;border-radius:8px;border:none">
        <input id="tarPeriod" value="${u.tariff_period_months}" style="flex:1;padding:10px;border-radius:8px;border:none">
      </div>

      <button id="saveBal" style="width:100%;padding:12px;border-radius:10px;border:none;margin-bottom:8px">Сохранить баланс</button>
      <button id="saveTar" style="width:100%;padding:12px;border-radius:10px;border:none;margin-bottom:12px">Сохранить тариф</button>

      <div style="opacity:.7;margin:10px 0 6px">Конфиги</div>
      <div id="cfgList" style="border-top:1px solid #2a2f3a"></div>
      <button id="addCfg" style="margin-top:10px;width:100%;padding:12px;border-radius:10px;border:none">Добавить конфиг</button>

      <button id="delUser" style="margin-top:16px;width:100%;padding:12px;border-radius:10px;border:none;background:#a83232;color:#fff">Удалить учётку</button>

      <button id="backAdmin" style="margin-top:12px;width:100%;padding:12px;border-radius:10px;border:none;background:#2a7fff;color:#fff">Назад</button>
    </div>
  `);

  el("backAdmin").onclick = () => openAdminConsole();

  el("saveBal").onclick = async () => {
    await api("/api/admin/user/set_balance", { target_tg_user_id: targetTgId, balance_rub: Number(el("bal").value) });
    toast("Сохранено");
    openUserEditor(targetTgId);
  };

  el("saveTar").onclick = async () => {
    await api("/api/admin/user/set_tariff", {
      target_tg_user_id: targetTgId,
      tariff_name: el("tarName").value,
      tariff_price_rub: Number(el("tarPrice").value),
      tariff_period_months: Number(el("tarPeriod").value),
    });
    toast("Тариф обновлён");
    openUserEditor(targetTgId);
  };

  el("delUser").onclick = async () => {
    if (!confirm("Удалить пользователя?")) return;
    await api("/api/admin/user/delete", { target_tg_user_id: targetTgId });
    toast("Удалено");
    openAdminConsole();
  };

  // configs render
  const cfgList = el("cfgList");
  cfgList.innerHTML = (cfgs || []).map(c => `
    <div style="padding:10px 0;border-bottom:1px solid #2a2f3a">
      <div style="font-weight:700">${escapeHtml(c.title)}</div>
      <div style="opacity:.7;font-size:12px;word-break:break-all">${escapeHtml(c.config_text).slice(0, 120)}${c.config_text.length>120?"…":""}</div>
      <div style="margin-top:6px;display:flex;gap:8px">
        <button data-edit="${c.id}" style="flex:1;padding:8px;border-radius:8px;border:none">Редактировать</button>
        <button data-del="${c.id}" style="flex:1;padding:8px;border-radius:8px;border:none;background:#a83232;color:#fff">Удалить</button>
      </div>
    </div>
  `).join("");

  [...cfgList.querySelectorAll("[data-del]")].forEach(b => {
    b.addEventListener("click", async () => {
      await api("/api/admin/configs/delete", { config_id: Number(b.getAttribute("data-del")) });
      toast("Удалено");
      openUserEditor(targetTgId);
    });
  });

  [...cfgList.querySelectorAll("[data-edit]")].forEach(b => {
    b.addEventListener("click", async () => {
      const id = Number(b.getAttribute("data-edit"));
      const c = cfgs.find(x => x.id === id);
      const title = prompt("Название", c.title);
      if (title === null) return;
      const text = prompt("Текст", c.config_text);
      if (text === null) return;
      const isActive = confirm("Сделать активным? (OK=активен, Cancel=неактивен)") ? 1 : 0;
      await api("/api/admin/configs/update", { config_id: id, title, config_text: text, is_active: isActive });
      toast("Сохранено");
      openUserEditor(targetTgId);
    });
  });

  el("addCfg").onclick = async () => {
    const title = prompt("Название", "Config");
    if (title === null) return;
    const text = prompt("Текст");
    if (!text) return;
    await api("/api/admin/configs/add", { target_tg_user_id: targetTgId, title, config_text: text });
    toast("Добавлено");
    openUserEditor(targetTgId);
  };
}

// ================== INVITE SCREEN (403) ==================
function showInviteScreen() {
  showBlockingScreen("У вас отсутствует доступ.", "Введите код приглашения:", `
    <input id="inviteCode" placeholder="Код"
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
      await api("/api/redeem", { code });
      toast("Готово");
      // без reload: просто перезапускаем приложение
      boot().catch(console.error);
    } catch (e) {
      toast("Неверный код");
    }
  };
}

// ================== MAIN BOOT ==================
async function boot() {
  mustBeTelegram();
  setAvatarLetter();
  wireMenu();

  // авторизация
  try {
    const r = await api("/api/auth");
    const me = r.me;

    // обновить UI
    const balance = el("balance");
    if (balance) balance.textContent = formatRub(me.balance_rub);

    setMeUI(me);

    // админ-кнопка
    if (me.role === "admin") addAdminButton();

    // Подгрузка списка конфигов пользователя (если ты хочешь показывать их на главной)
    // Сейчас оставляем как было у тебя (в списке "подключений" заглушки/пусто),
    // потому что UI "не трогаем". Позже привяжем к /api/my_configs.
    // Можем уже сейчас подставить туда реальные данные:
    try {
      const myCfgs = await api("/api/my_configs");
      // если у тебя список ожидает поля {name, status, expires, config}, сделаем адаптацию:
      const list = el("vpnList");
      if (list) {
        list.innerHTML = "";
        myCfgs.forEach(c => {
          const row = document.createElement("div");
          row.className = "vpn";
          row.innerHTML = `
            <div class="vpnLeft">
              <b>${escapeHtml(c.title)}</b>
              <small>активен: ${c.is_active ? "да" : "нет"}</small>
            </div>
            <div style="display:flex;gap:10px;align-items:center">
              <button class="connectBtn" type="button">Открыть</button>
            </div>
          `;
          row.querySelector("button").addEventListener("click", () => {
            // открываем нижнюю панель с текстом
            const title = c.title;
            const config = c.config_text;
            // используем уже существующий sheet, если он есть в твоём html
            const sheet = el("sheet");
            const overlay = el("sheetOverlay");
            const sheetTitle = el("sheetTitle");
            const configText = el("configText");
            const qrWrap = document.getElementById("qr");

            if (sheetTitle) sheetTitle.textContent = title;
            if (configText) configText.textContent = config;

            // QR (если подключена lib)
            if (qrWrap) {
              qrWrap.innerHTML = "";
              if (window.QRCode) new QRCode(qrWrap, { text: config, width: 180, height: 180 });
            }

            sheet?.classList.add("open");
            overlay?.classList.add("open");
          });

          list.appendChild(row);
        });
      }
    } catch (e) {
      console.warn("my_configs failed", e);
    }

  } catch (e) {
    if (e.status === 403) return showInviteScreen();
    showBlockingScreen("Ошибка запуска", "Перейдите в Telegram.");
    console.error(e);
  }
}

// старт
boot().catch(console.error);
