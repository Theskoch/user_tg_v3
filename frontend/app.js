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

function addPressFx(node) {
  if (!node) return;
  node.addEventListener("pointerdown", () => node.classList.add("pressed"));
  const up = () => node.classList.remove("pressed");
  node.addEventListener("pointerup", up);
  node.addEventListener("pointercancel", up);
  node.addEventListener("pointerleave", up);
}

function toast(text) {
  if (tg?.showToast) tg.showToast({ message: text });
  else console.log("[toast]", text);
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
    throw e;
  }
  return r.json();
}

function mustBeTelegram() {
  if (!tg || !tg.initData) {
    showBlockingScreen("Ошибка запуска", "Перейдите в Telegram.");
    throw new Error("Not Telegram");
  }
}

function showBlockingScreen(title, text, extraHtml = "") {
  document.body.innerHTML = `
    <style>
      .btn { width:100%; padding:12px; border-radius:10px; border:none; background:#2a7fff; color:#fff; font-weight:700; }
      .btn.secondary{ background:#2a2f3a; }
      .pressed{ transform: scale(.98); filter: brightness(.95); }
      .err { color:#ff5a5a; margin-top:10px; font-size:14px; }
      .spin { display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,.35); border-top-color:#fff; border-radius:50%; animation: spin 0.8s linear infinite; vertical-align: -3px; }
      @keyframes spin { to { transform: rotate(360deg);} }
    </style>
    <div style="min-height:100vh;background:#0e1014;color:#fff;padding:20px;font-family:system-ui">
      <div style="max-width:420px;margin:60px auto">
        <div style="font-size:20px;font-weight:800;margin-bottom:10px">${escapeHtml(title)}</div>
        <div style="opacity:.85;line-height:1.4;margin-bottom:14px">${escapeHtml(text)}</div>
        ${extraHtml}
      </div>
    </div>
  `;
}

function setAvatarLetter() {
  const user = tg?.initDataUnsafe?.user;
  const letter = (user?.first_name?.trim()?.[0] || "U").toUpperCase();
  const a = el("avatar");
  if (a) a.textContent = letter;
}

function formatRub(x) {
  const n = Number(x || 0);
  return `${n.toFixed(2)} ₽`;
}

// ================== UI INIT (works without API) ==================
function wireMenu() {
  const burger = el("burger");
  const dropdown = el("dropdown");
  if (!burger || !dropdown) return;

  addPressFx(burger);

  burger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdown.style.display = (dropdown.style.display === "block") ? "none" : "block";
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu")) dropdown.style.display = "none";
  });
}

function showPage(name) {
  el("pageHome")?.classList.remove("page-active");
  el("pageTariffs")?.classList.remove("page-active");
  el("pageTopup")?.classList.remove("page-active");

  if (name === "home") el("pageHome")?.classList.add("page-active");
  if (name === "tariffs") el("pageTariffs")?.classList.add("page-active");
  if (name === "topup") el("pageTopup")?.classList.add("page-active");
}

// ================== USER: invite screen ==================
function showInviteScreen() {
  showBlockingScreen(
    "У вас отсутствует доступ.",
    "Введите код приглашения:",
    `
      <input id="inviteCode" placeholder="Код"
        style="width:100%;padding:10px;border-radius:8px;border:none;margin:10px 0">
      <button id="inviteBtn" class="btn">Авторизоваться</button>
      <div id="inviteErr" class="err" style="display:none"></div>
    `
  );

  const btn = el("inviteBtn");
  const err = el("inviteErr");
  addPressFx(btn);

  btn.onclick = async () => {
    const code = el("inviteCode").value.trim();
    if (!code) {
      err.style.display = "block";
      err.textContent = "Введите код.";
      return;
    }

    // spinner
    btn.disabled = true;
    btn.innerHTML = `<span class="spin"></span> Проверяем...`;

    err.style.display = "none";
    err.textContent = "";

    try {
      await api("/api/redeem", { code });
      // успех: автопереход в ЛК без reload
      await boot(); // перезапуск логики
    } catch (e) {
      err.style.display = "block";
      err.textContent = "Код неверный или уже использован.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Авторизоваться";
    }
  };
}

// ================== USER: topup wiring ==================
function wireTopupEntry() {
  // 1) Кнопка в меню: "Пополнить" вместо "Обновить"
  const btnRefresh = el("btnRefresh");
  if (btnRefresh) {
    btnRefresh.textContent = "Пополнить";
    addPressFx(btnRefresh);
    btnRefresh.onclick = () => {
      el("dropdown").style.display = "none";
      showPage("topup");
    };
  }

  // 2) Клик по балансу должен вести на пополнение
  const balanceBtn = el("balanceBtn");
  if (balanceBtn) {
    addPressFx(balanceBtn);
    balanceBtn.onclick = () => showPage("topup");
  }

  // Back buttons (если есть)
  el("backFromTopup")?.addEventListener("click", () => showPage("home"));
}

// ================== ADMIN: menu button ==================
function addAdminButton() {
  const menu = document.querySelector(".dropdown");
  if (!menu) return;
  if (document.getElementById("adminBtn")) return;

  const btn = document.createElement("button");
  btn.id = "adminBtn";
  btn.className = "dropdown-btn";
  btn.type = "button";
  btn.textContent = "Админ-консоль";
  addPressFx(btn);

  btn.onclick = () => {
    const dd = el("dropdown");
    if (dd) dd.style.display = "none";
    openAdminConsole().catch(err => {
      console.error(err);
      toast("Ошибка админки");
    });
  };

  menu.appendChild(btn);
}

// ================== ADMIN CONSOLE ==================
let ADMIN_TARIFFS = [];
let USERS_CACHE = [];
let CURRENT_USER = null;

async function openAdminConsole() {
  USERS_CACHE = await api("/api/admin/users");
  ADMIN_TARIFFS = await api("/api/admin/tariffs");

  showBlockingScreen("Админ-консоль", "Управление", `
    <style>
      .row{padding:10px 0;border-bottom:1px solid #2a2f3a;cursor:pointer}
      .muted{opacity:.7;font-size:12px}
      .btn{width:100%;padding:12px;border-radius:10px;border:none}
      .btn.primary{background:#2a7fff;color:#fff;font-weight:700}
      .btn.dark{background:#2a2f3a;color:#fff}
      .pressed{transform:scale(.98);filter:brightness(.95)}
    </style>

    <div style="display:flex;gap:10px;margin-bottom:12px">
      <button id="invUser" class="btn dark" style="flex:1">+ User</button>
      <button id="invAdmin" class="btn dark" style="flex:1">+ Admin</button>
    </div>

    <div id="usersList" style="border-top:1px solid #2a2f3a"></div>

    <button id="backMain" class="btn primary" style="margin-top:14px">Назад</button>
  `);

  addPressFx(el("invUser"));
  addPressFx(el("invAdmin"));
  addPressFx(el("backMain"));

  el("backMain").onclick = () => window.location.href = "/";

  el("invUser").onclick = () => createInvite("user");
  el("invAdmin").onclick = () => createInvite("admin");

  renderUsersList();
}

function renderUsersList() {
  const list = el("usersList");
  list.innerHTML = USERS_CACHE.map(u => `
    <div class="row" data-id="${u.tg_user_id}">
      <div style="font-weight:800">${escapeHtml(u.first_name || "")} <span class="muted">@${escapeHtml(u.username || "")}</span></div>
      <div class="muted">${u.role} | ${u.balance_rub} ₽ | ${escapeHtml(u.tariff_name)}</div>
    </div>
  `).join("");

  [...list.querySelectorAll("[data-id]")].forEach(div => {
    addPressFx(div);
    div.addEventListener("click", () => openUserEditor(Number(div.getAttribute("data-id"))));
  });
}

async function createInvite(role) {
  const r = await api("/api/admin/invite", { role });
  try { await navigator.clipboard.writeText(r.code); } catch {}
  toast("Код скопирован");

  showBlockingScreen("Код приглашения", r.code, `
    <button id="backAdmin" class="btn" style="background:#2a7fff;color:#fff;font-weight:800;margin-top:14px">Назад</button>
  `);
  addPressFx(el("backAdmin"));
  el("backAdmin").onclick = () => openAdminConsole();
}

async function openUserEditor(targetTgId) {
  USERS_CACHE = await api("/api/admin/users");
  CURRENT_USER = USERS_CACHE.find(x => x.tg_user_id === targetTgId);
  const cfgs = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });

  const headerName = `${escapeHtml(CURRENT_USER.first_name || "")} @${escapeHtml(CURRENT_USER.username || "")}`;
  const headerBal = `${Number(CURRENT_USER.balance_rub).toFixed(2)} ₽`;

  const tariffOptions = ADMIN_TARIFFS.map(t => {
    const label = `${t.name} — ${t.months} мес — ${t.price_rub} ₽`;
    // пытаемся "сматчить" по имени+цене+сроку
    const selected = (CURRENT_USER.tariff_name === t.name && Number(CURRENT_USER.tariff_price_rub) === Number(t.price_rub) && Number(CURRENT_USER.tariff_period_months) === Number(t.months))
      ? "selected" : "";
    return `<option value="${escapeHtml(t.key)}" ${selected}>${escapeHtml(label)}</option>`;
  }).join("");

  showBlockingScreen("Пользователь", "", `
    <style>
      .btn{width:100%;padding:12px;border-radius:10px;border:none}
      .btn.primary{background:#2a7fff;color:#fff;font-weight:800}
      .btn.dark{background:#2a2f3a;color:#fff}
      .btn.danger{background:#a83232;color:#fff}
      .pressed{transform:scale(.98);filter:brightness(.95)}
      .muted{opacity:.75;font-size:12px}
      .box{padding:10px 0;border-bottom:1px solid #2a2f3a}
      input,select{width:100%;padding:10px;border-radius:8px;border:none;margin:8px 0}
    </style>

    <div style="margin-bottom:10px">
      <div style="font-weight:900;font-size:18px">${headerName}</div>
      <div class="muted">Баланс: <span id="headerBal" style="font-weight:900">${headerBal}</span></div>
    </div>

    <div class="box">
      <div class="muted">Новый баланс</div>
      <input id="bal" value="${CURRENT_USER.balance_rub}">
      <button id="saveBal" class="btn dark">Сохранить баланс</button>
      <div id="balErr" class="muted" style="color:#ff5a5a;display:none;margin-top:6px"></div>
    </div>

    <div class="box">
      <div class="muted">Тариф (только админ)</div>
      <select id="tarSelect">${tariffOptions}</select>
      <button id="saveTar" class="btn dark">Сохранить тариф</button>
    </div>

    <div class="box">
      <div class="muted" style="margin-bottom:6px">Конфиги</div>
      <div id="cfgList" style="border-top:1px solid #2a2f3a"></div>
      <button id="addCfg" class="btn dark" style="margin-top:10px">Добавить конфиг</button>
    </div>

    <button id="delUser" class="btn danger" style="margin-top:14px">Удалить учётку</button>
    <button id="backAdmin" class="btn primary" style="margin-top:10px">Назад</button>
  `);

  addPressFx(el("saveBal"));
  addPressFx(el("saveTar"));
  addPressFx(el("addCfg"));
  addPressFx(el("delUser"));
  addPressFx(el("backAdmin"));

  el("backAdmin").onclick = () => openAdminConsole();

  // Save balance with spinner + update header
  el("saveBal").onclick = async () => {
    const b = el("saveBal");
    const err = el("balErr");
    err.style.display = "none";
    err.textContent = "";

    const val = Number(el("bal").value);
    if (Number.isNaN(val)) {
      err.style.display = "block";
      err.textContent = "Баланс должен быть числом.";
      return;
    }

    b.disabled = true;
    const oldText = b.textContent;
    b.textContent = "Сохраняем...";

    try {
      await api("/api/admin/user/set_balance", { target_tg_user_id: targetTgId, balance_rub: val });

      // обновим header баланс сразу
      el("headerBal").textContent = `${val.toFixed(2)} ₽`;

      toast("Сохранено");
    } catch (e) {
      err.style.display = "block";
      err.textContent = "Ошибка сохранения.";
    } finally {
      b.disabled = false;
      b.textContent = oldText;
    }
  };

  // Save tariff from select
  el("saveTar").onclick = async () => {
    const b = el("saveTar");
    b.disabled = true;
    const oldText = b.textContent;
    b.textContent = "Сохраняем...";

    try {
      const key = el("tarSelect").value;
      const t = ADMIN_TARIFFS.find(x => x.key === key);
      await api("/api/admin/user/set_tariff", {
        target_tg_user_id: targetTgId,
        tariff_name: t.name,
        tariff_price_rub: t.price_rub,
        tariff_period_months: t.months,
      });
      toast("Тариф обновлён");
      // можно перерисовать пользователя, чтобы обновились подписи
      openUserEditor(targetTgId);
    } finally {
      b.disabled = false;
      b.textContent = oldText;
    }
  };

  // Delete user
  el("delUser").onclick = async () => {
    if (!confirm("Удалить пользователя?")) return;
    await api("/api/admin/user/delete", { target_tg_user_id: targetTgId });
    toast("Удалено");
    openAdminConsole();
  };

  renderConfigs(cfgs, targetTgId);
}

function renderConfigs(cfgs, targetTgId) {
  const cfgList = el("cfgList");
  cfgList.innerHTML = (cfgs || []).map(c => `
    <div style="padding:10px 0;border-bottom:1px solid #2a2f3a">
      <div style="font-weight:800">${escapeHtml(c.title)}</div>
      <div style="opacity:.7;font-size:12px;word-break:break-all">${escapeHtml(c.config_text).slice(0, 120)}${c.config_text.length>120?"…":""}</div>
      <div style="margin-top:6px;display:flex;gap:8px">
        <button data-edit="${c.id}" class="btn dark" style="flex:1;padding:10px">Редактировать</button>
        <button data-del="${c.id}" class="btn danger" style="flex:1;padding:10px">Удалить</button>
      </div>
    </div>
  `).join("");

  [...cfgList.querySelectorAll("[data-del]")].forEach(b => {
    addPressFx(b);
    b.addEventListener("click", async () => {
      await api("/api/admin/configs/delete", { config_id: Number(b.getAttribute("data-del")) });
      toast("Удалено");
      openUserEditor(targetTgId);
    });
  });

  [...cfgList.querySelectorAll("[data-edit]")].forEach(b => {
    addPressFx(b);
    b.addEventListener("click", async () => {
      const id = Number(b.getAttribute("data-edit"));
      const c = cfgs.find(x => x.id === id);
      const title = prompt("Название", c.title);
      if (title === null) return;
      const text = prompt("Текст", c.config_text);
      if (text === null) return;
      const isActive = confirm("Сделать активным? (OK=да, Cancel=нет)") ? 1 : 0;

      await api("/api/admin/configs/update", { config_id: id, title, config_text: text, is_active: isActive });
      toast("Сохранено");
      openUserEditor(targetTgId);
    });
  });

  const addBtn = el("addCfg");
  addPressFx(addBtn);
  addBtn.onclick = async () => {
    const title = prompt("Название", "Config");
    if (title === null) return;
    const text = prompt("Текст");
    if (!text) return;
    await api("/api/admin/configs/add", { target_tg_user_id: targetTgId, title, config_text: text });
    toast("Добавлено");
    openUserEditor(targetTgId);
  };
}

// ================== MAIN BOOT ==================
async function boot() {
  mustBeTelegram();
  setAvatarLetter();
  wireMenu();
  wireTopupEntry();

  try {
    const r = await api("/api/auth");
    const me = r.me;

    // заполнить UI
    el("balance") && (el("balance").textContent = formatRub(me.balance_rub));

    // тариф (показываем, но без смены юзером)
    el("tariffName") && (el("tariffName").textContent = me.tariff?.name || "—");
    el("tariffPrice") && (el("tariffPrice").textContent = `${me.tariff?.price_rub ?? 0} ₽ / ${me.tariff?.period_months ?? 1} мес`);
    el("nextPay") && (el("nextPay").textContent = `Окончание: ${me.tariff?.expires_at || "—"}`);

    // админка
    if (me.role === "admin") addAdminButton();

    // список конфигов юзера на главной
    try {
      const myCfgs = await api("/api/my_configs");
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
          const btn = row.querySelector("button");
          addPressFx(btn);
          btn.addEventListener("click", () => {
            const sheet = el("sheet");
            const overlay = el("sheetOverlay");
            const sheetTitle = el("sheetTitle");
            const configText = el("configText");
            const qrWrap = document.getElementById("qr");

            if (sheetTitle) sheetTitle.textContent = c.title;
            if (configText) configText.textContent = c.config_text;

            if (qrWrap) {
              qrWrap.innerHTML = "";
              if (window.QRCode) new QRCode(qrWrap, { text: c.config_text, width: 180, height: 180 });
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

    // закрытие шита (если есть)
    el("sheetOverlay")?.addEventListener("click", () => {
      el("sheet")?.classList.remove("open");
      el("sheetOverlay")?.classList.remove("open");
    });
    el("sheetClose")?.addEventListener("click", () => {
      el("sheet")?.classList.remove("open");
      el("sheetOverlay")?.classList.remove("open");
    });
    el("configBox")?.addEventListener("click", async () => {
      const text = el("configText")?.textContent || "";
      if (!text.trim()) return;
      try { await navigator.clipboard.writeText(text); toast("Скопировано"); } catch {}
    });

    showPage("home");
  } catch (e) {
    if (e.status === 403) return showInviteScreen();
    showBlockingScreen("Ошибка запуска", "Перейдите в Telegram.");
    console.error(e);
  }
}

// старт
boot().catch(console.error);
