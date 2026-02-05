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
      .btn { width:100%; padding:12px; border-radius:10px; border:none; background:#2a7fff; color:#fff; font-weight:800; }
      .btn.secondary{ background:#2a2f3a; color:#fff; font-weight:700; }
      .btn.danger{ background:#a83232; color:#fff; font-weight:800; }
      .pressed{ transform: scale(.98); filter: brightness(.95); }
      .err { color:#ff5a5a; margin-top:10px; font-size:14px; }
      .spin { display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,.35); border-top-color:#fff; border-radius:50%; animation: spin 0.8s linear infinite; vertical-align: -3px; }
      @keyframes spin { to { transform: rotate(360deg);} }

      /* Admin tariff cards */
      .tarGrid{display:grid;grid-template-columns:1fr;gap:10px;margin-top:10px}
      .tarCard{background:#161b24;border:1px solid #2a2f3a;border-radius:14px;padding:12px;cursor:pointer}
      .tarCard.active{border-color:#2a7fff;box-shadow:0 0 0 1px rgba(42,127,255,.35) inset}
      .tarTop{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
      .tarName{font-weight:900;font-size:15px}
      .tarPrice{font-weight:900;font-size:15px}
      .tarMeta{opacity:.75;font-size:12px;margin-top:6px}
      .tag{display:inline-block;font-size:11px;padding:3px 8px;border-radius:999px;background:#2a2f3a;color:#fff;opacity:.9}
      .muted{opacity:.75;font-size:12px}
    </style>

    <div style="min-height:100vh;background:#0e1014;color:#fff;padding:20px;font-family:system-ui">
      <div style="max-width:440px;margin:50px auto">
        <div style="font-size:20px;font-weight:900;margin-bottom:10px">${escapeHtml(title)}</div>
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

// ================== UI INIT ==================
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

function wireTopupEntry() {
  // кнопка в меню: "Пополнить"
  const btnRefresh = el("btnRefresh");
  if (btnRefresh) {
    btnRefresh.textContent = "Пополнить";
    addPressFx(btnRefresh);
    btnRefresh.onclick = () => {
      el("dropdown").style.display = "none";
      showPage("topup");
    };
  }

  // клик по балансу
  const balanceBtn = el("balanceBtn");
  if (balanceBtn) {
    addPressFx(balanceBtn);
    balanceBtn.onclick = () => showPage("topup");
  }

  el("backFromTopup")?.addEventListener("click", () => showPage("home"));
}

// ================== INVITE SCREEN ==================
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

    btn.disabled = true;
    btn.innerHTML = `<span class="spin"></span> Проверяем...`;
    err.style.display = "none";
    err.textContent = "";

    try {
      await api("/api/redeem", { code });
      // успех: сразу переходим на главную страницу приложения
      window.location.href = "/?autologin=1";
      return;
    } catch (e) {
      err.style.display = "block";
      err.textContent = "Код неверный или уже использован.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Авторизоваться";
    }
  };
}

// ================== ADMIN ==================
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
    el("dropdown").style.display = "none";
    openAdminConsole().catch(err => {
      console.error(err);
      toast("Ошибка админки");
    });
  };
  // spacer между существующими кнопками и админкой
  const spacer = document.createElement("div");
  spacer.style.height = "8px";
  menu.appendChild(spacer);

  menu.appendChild(btn);


  menu.appendChild(btn);
}

let ADMIN_TARIFFS = [];
let USERS_CACHE = [];
let CURRENT_USER = null;

async function openAdminConsole() {
  USERS_CACHE = await api("/api/admin/users");
  ADMIN_TARIFFS = await api("/api/admin/tariffs");

  showBlockingScreen("Админ-консоль", "Управление пользователями", `
    <div style="display:flex;gap:10px;margin-bottom:12px">
      <button id="invUser" class="btn secondary" style="flex:1">+ User</button>
      <button id="invAdmin" class="btn secondary" style="flex:1">+ Admin</button>
    </div>

    <div id="usersList" style="border-top:1px solid #2a2f3a"></div>

    <button id="backMain" class="btn" style="margin-top:14px">Назад</button>
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
    <div data-id="${u.tg_user_id}" style="padding:12px 0;border-bottom:1px solid #2a2f3a;cursor:pointer">
      <div style="font-weight:900">${escapeHtml(u.first_name || "")}
        <span class="muted">@${escapeHtml(u.username || "")}</span>
        ${u.role === "admin" ? `<span class="tag" style="margin-left:8px">admin</span>` : ``}
      </div>
      <div class="muted">${u.balance_rub} ₽ • ${escapeHtml(u.tariff_name)} • активен: ${u.is_active ? "да" : "нет"}</div>
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
    <button id="backAdmin" class="btn" style="margin-top:14px">Назад</button>
  `);
  addPressFx(el("backAdmin"));
  el("backAdmin").onclick = () => openAdminConsole();
}

function sameTariff(u, t) {
  return (u.tariff_name === t.name &&
          Number(u.tariff_price_rub) === Number(t.price_rub) &&
          Number(u.tariff_period_months) === Number(t.months));
}

async function openUserEditor(targetTgId) {
  USERS_CACHE = await api("/api/admin/users");
  CURRENT_USER = USERS_CACHE.find(x => x.tg_user_id === targetTgId);
  const cfgs = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });

  let selectedTariffKey = null;

  const headerName = `${escapeHtml(CURRENT_USER.first_name || "")} @${escapeHtml(CURRENT_USER.username || "")}`;
  const headerBal = `${Number(CURRENT_USER.balance_rub).toFixed(2)} ₽`;

  showBlockingScreen("Пользователь", "", `
    <div style="margin-bottom:12px">
      <div style="font-weight:900;font-size:18px">${headerName}</div>
      <div class="muted">Баланс: <span id="headerBal" style="font-weight:900">${headerBal}</span></div>
      <div class="muted">Роль: <span class="tag">${escapeHtml(CURRENT_USER.role)}</span></div>
    </div>

    <div style="padding:12px 0;border-top:1px solid #2a2f3a;border-bottom:1px solid #2a2f3a">
      <div class="muted">Новый баланс</div>
      <input id="bal" value="${CURRENT_USER.balance_rub}" style="width:100%;padding:10px;border-radius:8px;border:none;margin:8px 0">
      <button id="saveBal" class="btn secondary">Сохранить баланс</button>
      <div id="balErr" class="err" style="display:none"></div>
    </div>

    <div style="padding:12px 0;border-bottom:1px solid #2a2f3a">
      <div style="font-weight:900;margin-bottom:6px">Тариф</div>
      <div class="muted">Выберите тариф и нажмите “Сохранить”</div>
      <div id="tariffsGrid" class="tarGrid"></div>
      <button id="saveTar" class="btn secondary" style="margin-top:10px">Сохранить тариф</button>
      <div id="tarErr" class="err" style="display:none"></div>
    </div>

    <div style="padding:12px 0;border-bottom:1px solid #2a2f3a">
      <div style="font-weight:900;margin-bottom:6px">Конфиги</div>
      <div id="cfgList" style="border-top:1px solid #2a2f3a"></div>
      <button id="addCfg" class="btn secondary" style="margin-top:10px">Добавить конфиг</button>
    </div>

    <button id="delUser" class="btn danger" style="margin-top:14px">Удалить учётку</button>
    <button id="backAdmin" class="btn" style="margin-top:10px">Назад</button>
  `);

  // Press FX
  addPressFx(el("saveBal"));
  addPressFx(el("saveTar"));
  addPressFx(el("addCfg"));
  addPressFx(el("delUser"));
  addPressFx(el("backAdmin"));

  el("backAdmin").onclick = () => openAdminConsole();

  // Render tariff cards
  function renderTariffCards() {
    const grid = el("tariffsGrid");
    grid.innerHTML = "";

    ADMIN_TARIFFS.forEach(t => {
      const card = document.createElement("div");
      card.className = "tarCard";

      const isCurrent = sameTariff(CURRENT_USER, t);
      if (isCurrent && !selectedTariffKey) selectedTariffKey = t.key;
      if (selectedTariffKey === t.key) card.classList.add("active");

      card.innerHTML = `
        <div class="tarTop">
          <div>
            <div class="tarName">${escapeHtml(t.name)}</div>
            <div class="tarMeta">${t.months} мес • <span class="tag">${escapeHtml(t.key)}</span></div>
          </div>
          <div class="tarPrice">${t.price_rub} ₽</div>
        </div>
        <div class="tarMeta" style="margin-top:10px">
          ${isCurrent ? `<span class="tag" style="background:#2a7fff">текущий</span>` : `<span class="tag">доступно</span>`}
        </div>
      `;

      addPressFx(card);
      card.addEventListener("click", () => {
        selectedTariffKey = t.key;
        renderTariffCards();
      });

      grid.appendChild(card);
    });
  }

  renderTariffCards();

  // Save balance
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
    b.innerHTML = `<span class="spin"></span> Сохраняем...`;

    try {
      await api("/api/admin/user/set_balance", { target_tg_user_id: targetTgId, balance_rub: val });
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

  // Save tariff
  el("saveTar").onclick = async () => {
    const b = el("saveTar");
    const err = el("tarErr");
    err.style.display = "none";
    err.textContent = "";

    const t = ADMIN_TARIFFS.find(x => x.key === selectedTariffKey);
    if (!t) {
      err.style.display = "block";
      err.textContent = "Выберите тариф.";
      return;
    }

    b.disabled = true;
    const oldText = b.textContent;
    b.innerHTML = `<span class="spin"></span> Сохраняем...`;

    try {
      await api("/api/admin/user/set_tariff", {
        target_tg_user_id: targetTgId,
        tariff_name: t.name,
        tariff_price_rub: t.price_rub,
        tariff_period_months: t.months,
      });
      toast("Тариф обновлён");
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

  // Configs
  const cfgList = el("cfgList");
  cfgList.innerHTML = (cfgs || []).map(c => `
    <div style="padding:12px 0;border-bottom:1px solid #2a2f3a">
      <div style="font-weight:900">${escapeHtml(c.title)}</div>
      <div class="muted" style="word-break:break-all;margin-top:6px">${escapeHtml(c.config_text).slice(0, 120)}${c.config_text.length>120?"…":""}</div>
      <div style="margin-top:10px;display:flex;gap:10px">
        <button data-edit="${c.id}" class="btn secondary" style="flex:1;padding:10px">Редактировать</button>
        <button data-del="${c.id}" class="btn danger" style="flex:1;padding:10px">Удалить</button>
      </div>
    </div>
  `).join("");

  [...cfgList.querySelectorAll("[data-del]")].forEach(btn => {
    addPressFx(btn);
    btn.addEventListener("click", async () => {
      await api("/api/admin/configs/delete", { config_id: Number(btn.getAttribute("data-del")) });
      toast("Удалено");
      openUserEditor(targetTgId);
    });
  });

  [...cfgList.querySelectorAll("[data-edit]")].forEach(btn => {
    addPressFx(btn);
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-edit"));
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

  addPressFx(el("addCfg"));
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

// ================== MAIN BOOT ==================
async function boot() {
  mustBeTelegram();
  setAvatarLetter();
  wireMenu();
  wireTopupEntry();

  try {
    const r = await api("/api/auth");
    const me = r.me;

    // UI fill
    if (el("balance")) el("balance").textContent = formatRub(me.balance_rub);

    if (el("tariffName")) el("tariffName").textContent = me.tariff?.name || "—";
    if (el("tariffPrice")) el("tariffPrice").textContent = `${me.tariff?.price_rub ?? 0} ₽ / ${me.tariff?.period_months ?? 1} мес`;
    if (el("nextPay")) el("nextPay").textContent = `Окончание: ${me.tariff?.expires_at || "—"}`;

    if (me.role === "admin") addAdminButton();

    // My configs list on main
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

    // sheet close/copy (if exists)
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

// start
boot().catch(console.error);
