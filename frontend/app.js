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

// ================== SHEET (bottom) ==================
function openSheet(title, configText) {
  const sheet = el("sheet");
  const overlay = el("sheetOverlay");
  const sheetTitle = el("sheetTitle");
  const textEl = el("configText");
  const qrWrap = document.getElementById("qr");

  if (sheetTitle) sheetTitle.textContent = title || "Конфиг";
  if (textEl) textEl.textContent = configText || "";

  if (qrWrap) {
    qrWrap.innerHTML = "";
    if (window.QRCode) {
      new QRCode(qrWrap, { text: configText || "empty", width: 180, height: 180 });
    } else {
      // если QRCode lib нет — просто пусто
    }
  }

  sheet?.classList.add("open");
  overlay?.classList.add("open");
}

function wireSheet() {
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
      // автопереход в ЛК: возвращаемся на /
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

// ================== USER MAIN LIST (configs) ==================
function renderUserConfigs(myCfgs) {
  const list = el("vpnList");
  if (!list) return;

  list.innerHTML = "";
  myCfgs.forEach(c => {
    const row = document.createElement("div");
    row.className = "vpn";
    const inactive = !c.is_active;

    row.innerHTML = `
      <div class="vpnLeft">
        <b style="${inactive ? "opacity:.45" : ""}">${escapeHtml(c.title)}</b>
        <small style="${inactive ? "opacity:.45" : ""}">${inactive ? "заблокирован" : "активен"}</small>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <button class="connectBtn" type="button" ${inactive ? "disabled" : ""} style="${inactive ? "opacity:.45" : ""}">
          Открыть
        </button>
      </div>
    `;

    const btn = row.querySelector("button");
    addPressFx(btn);
    btn.addEventListener("click", () => {
      if (inactive) return;
      openSheet(c.title, c.config_text);
    });

    list.appendChild(row);
  });
}

// ================== ADMIN OVERLAY (НЕ перетирает body) ==================
function ensureAdminOverlayStyles() {
  if (document.getElementById("adminOverlayStyles")) return;
  const st = document.createElement("style");
  st.id = "adminOverlayStyles";
  st.textContent = `
    .adminOverlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-end}
    .adminPanel{width:100%;max-height:92vh;overflow:auto;background:#0e1014;color:#fff;border-radius:18px 18px 0 0;padding:14px 14px 20px;font-family:system-ui}
    .adminTop{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}
    .adminTitle{font-weight:900;font-size:16px}
    .adminBtn{border:none;border-radius:12px;padding:10px 12px;background:#2a2f3a;color:#fff;font-weight:800}
    .adminBtn.primary{background:#2a7fff}
    .adminBtn.danger{background:#a83232}
    .adminBtn.ghost{background:transparent;border:1px solid #2a2f3a}
    .adminRow{padding:12px 0;border-bottom:1px solid #2a2f3a;cursor:pointer}
    .adminMuted{opacity:.75;font-size:12px}
    .adminTag{display:inline-block;font-size:11px;padding:3px 8px;border-radius:999px;background:#2a2f3a;color:#fff;opacity:.9}
    .adminConfig{padding:12px 0;border-bottom:1px solid #2a2f3a}
    .adminConfig.inactive{opacity:.45}
    .adminBtns{display:flex;gap:10px;margin-top:10px}
    .adminInput{width:100%;padding:10px;border-radius:10px;border:none;background:#161b24;color:#fff}
    .adminTextarea{width:100%;min-height:110px;padding:10px;border-radius:10px;border:none;background:#161b24;color:#fff;resize:vertical}
    .pressed{ transform: scale(.98); filter: brightness(.95); }
  `;
  document.head.appendChild(st);
}

function openAdminOverlay(title, renderFn) {
  ensureAdminOverlayStyles();

  // закрыть если есть
  document.getElementById("adminOverlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "adminOverlay";
  overlay.className = "adminOverlay";

  const panel = document.createElement("div");
  panel.className = "adminPanel";

  panel.innerHTML = `
    <div class="adminTop">
      <div class="adminTitle">${escapeHtml(title)}</div>
      <button id="adminClose" class="adminBtn ghost">Закрыть</button>
    </div>
    <div id="adminBody"></div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const closeBtn = panel.querySelector("#adminClose");
  addPressFx(closeBtn);
  closeBtn.onclick = () => overlay.remove();

  renderFn(panel.querySelector("#adminBody"), overlay);
}

// ================== ADMIN: button in menu ==================
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

  // небольшой отступ чтобы не слипалось с "Пополнить"
  const spacer = document.createElement("div");
  spacer.style.height = "8px";
  menu.appendChild(spacer);

  menu.appendChild(btn);
}

let USERS_CACHE = [];
let CURRENT_USER = null;

// ================== ADMIN: console/users ==================
async function openAdminConsole() {
  USERS_CACHE = await api("/api/admin/users");

  openAdminOverlay("Админ-консоль", (body, overlay) => {
    body.innerHTML = `
      <div style="display:flex;gap:10px;margin:10px 0 14px">
        <button id="invUser" class="adminBtn">+ User</button>
        <button id="invAdmin" class="adminBtn">+ Admin</button>
      </div>

      <div id="usersList" style="border-top:1px solid #2a2f3a"></div>
    `;

    const invUser = body.querySelector("#invUser");
    const invAdmin = body.querySelector("#invAdmin");
    addPressFx(invUser); addPressFx(invAdmin);

    invUser.onclick = () => createInvite("user");
    invAdmin.onclick = () => createInvite("admin");

    const list = body.querySelector("#usersList");
    list.innerHTML = USERS_CACHE.map(u => `
      <div class="adminRow" data-id="${u.tg_user_id}">
        <div style="font-weight:900">
          ${escapeHtml(u.first_name || "")}
          <span class="adminMuted">@${escapeHtml(u.username || "")}</span>
          ${u.role === "admin" ? `<span class="adminTag" style="margin-left:8px">admin</span>` : ``}
        </div>
        <div class="adminMuted">${u.balance_rub} ₽ • ${escapeHtml(u.tariff_name)}</div>
      </div>
    `).join("");

    [...list.querySelectorAll("[data-id]")].forEach(div => {
      addPressFx(div);
      div.onclick = () => openUserCard(Number(div.getAttribute("data-id")));
    });
  });
}

async function createInvite(role) {
  const r = await api("/api/admin/invite", { role });
  try { await navigator.clipboard.writeText(r.code); } catch {}
  toast("Код скопирован");

  openAdminOverlay("Код приглашения", (body) => {
    body.innerHTML = `
      <div style="font-weight:900;font-size:18px;word-break:break-all;background:#161b24;padding:12px;border-radius:12px;border:1px solid #2a2f3a">
        ${escapeHtml(r.code)}
      </div>
      <div class="adminMuted" style="margin-top:8px">Роль: ${escapeHtml(role)}</div>
    `;
  });
}

// ================== ADMIN: user card ==================
async function openUserCard(targetTgId) {
  USERS_CACHE = await api("/api/admin/users");
  CURRENT_USER = USERS_CACHE.find(x => x.tg_user_id === targetTgId);

  openAdminOverlay("Пользователь", (body) => {
    body.innerHTML = `
      <div style="margin-bottom:10px">
        <div style="font-weight:900;font-size:18px">
          ${escapeHtml(CURRENT_USER.first_name || "")}
          <span class="adminMuted">@${escapeHtml(CURRENT_USER.username || "")}</span>
        </div>
        <div class="adminMuted">Баланс: <b id="uBal">${Number(CURRENT_USER.balance_rub).toFixed(2)} ₽</b></div>
        <div class="adminMuted">Роль: <span class="adminTag">${escapeHtml(CURRENT_USER.role)}</span></div>
      </div>

      <div style="border-top:1px solid #2a2f3a;padding-top:12px">
        <div class="adminMuted">Новый баланс</div>
        <input id="balInp" class="adminInput" value="${CURRENT_USER.balance_rub}">
        <div class="adminBtns">
          <button id="saveBal" class="adminBtn">Сохранить баланс</button>
          <button id="configsBtn" class="adminBtn primary">Конфиги пользователя</button>
        </div>
        <div id="balErr" class="adminMuted" style="color:#ff5a5a;display:none;margin-top:8px"></div>
      </div>

      <div style="margin-top:14px">
        <button id="delUser" class="adminBtn danger">Удалить учётку</button>
      </div>
    `;

    const saveBal = body.querySelector("#saveBal");
    const configsBtn = body.querySelector("#configsBtn");
    const delUser = body.querySelector("#delUser");

    addPressFx(saveBal); addPressFx(configsBtn); addPressFx(delUser);

    saveBal.onclick = async () => {
      const err = body.querySelector("#balErr");
      err.style.display = "none";
      err.textContent = "";

      const val = Number(body.querySelector("#balInp").value);
      if (Number.isNaN(val)) {
        err.style.display = "block";
        err.textContent = "Баланс должен быть числом.";
        return;
      }

      saveBal.disabled = true;
      const old = saveBal.textContent;
      saveBal.textContent = "Сохраняем...";

      try {
        await api("/api/admin/user/set_balance", { target_tg_user_id: targetTgId, balance_rub: val });
        body.querySelector("#uBal").textContent = `${val.toFixed(2)} ₽`;
        toast("Сохранено");
      } catch {
        err.style.display = "block";
        err.textContent = "Ошибка сохранения.";
      } finally {
        saveBal.disabled = false;
        saveBal.textContent = old;
      }
    };

    configsBtn.onclick = () => openUserConfigs(targetTgId);

    delUser.onclick = async () => {
      if (!confirm("Удалить пользователя?")) return;
      await api("/api/admin/user/delete", { target_tg_user_id: targetTgId });
      toast("Удалено");
      openAdminConsole();
    };
  });
}

// ================== ADMIN: configs screen (list/open/block/delete/add) ==================
async function openUserConfigs(targetTgId) {
  const cfgs = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });

  openAdminOverlay("Конфиги пользователя", (body) => {
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
        <div class="adminMuted">Нажми на конфиг чтобы открыть</div>
        <button id="addBtn" class="adminBtn primary">+</button>
      </div>

      <div id="cfgList"></div>
    `;

    const addBtn = body.querySelector("#addBtn");
    addPressFx(addBtn);
    addBtn.onclick = () => openAddConfigComposer(targetTgId);

    const list = body.querySelector("#cfgList");
    list.innerHTML = (cfgs || []).map(c => `
      <div class="adminConfig ${c.is_active ? "" : "inactive"}" data-id="${c.id}">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div>
            <div style="font-weight:900">${escapeHtml(c.title)}</div>
            <div class="adminMuted" style="word-break:break-all;margin-top:4px">${escapeHtml(c.config_text).slice(0, 90)}${c.config_text.length>90?"…":""}</div>
          </div>
          <div style="text-align:right">
            <div class="adminTag">${c.is_active ? "активен" : "заблокирован"}</div>
          </div>
        </div>

        <div class="adminBtns">
          <button class="adminBtn" data-open="${c.id}" ${c.is_active ? "" : "disabled"} style="${c.is_active ? "" : "opacity:.4"}">Открыть</button>
          <button class="adminBtn" data-block="${c.id}">${c.is_active ? "Блокировать" : "Разблок."}</button>
          <button class="adminBtn danger" data-del="${c.id}">Удалить</button>
        </div>
      </div>
    `).join("");

    // open
    [...list.querySelectorAll("[data-open]")].forEach(b => {
      addPressFx(b);
      b.onclick = () => {
        const id = Number(b.getAttribute("data-open"));
        const c = cfgs.find(x => x.id === id);
        if (!c || !c.is_active) return;
        openSheet(c.title, c.config_text);
      };
    });

    // block/unblock
    [...list.querySelectorAll("[data-block]")].forEach(b => {
      addPressFx(b);
      b.onclick = async () => {
        const id = Number(b.getAttribute("data-block"));
        const c = cfgs.find(x => x.id === id);
        if (!c) return;
        await api("/api/admin/configs/update", {
          config_id: id,
          title: c.title,
          config_text: c.config_text,
          is_active: c.is_active ? 0 : 1
        });
        toast(c.is_active ? "Заблокировано" : "Разблокировано");
        openUserConfigs(targetTgId);
      };
    });

    // delete with confirm
    [...list.querySelectorAll("[data-del]")].forEach(b => {
      addPressFx(b);
      b.onclick = async () => {
        const id = Number(b.getAttribute("data-del"));
        const c = cfgs.find(x => x.id === id);
        if (!c) return;
        if (!confirm(`Удалить конфиг "${c.title}"?`)) return;
        await api("/api/admin/configs/delete", { config_id: id });
        toast("Удалено");
        openUserConfigs(targetTgId);
      };
    });
  });
}

// ================== ADMIN: add config composer + QR scanner ==================
function openAddConfigComposer(targetTgId) {
  // сделаем маленькое bottom-меню поверх (не мешает sheet)
  ensureAdminOverlayStyles();

  // remove old if exists
  document.getElementById("adminComposer")?.remove();

  const wrap = document.createElement("div");
  wrap.id = "adminComposer";
  wrap.className = "adminOverlay"; // используем тот же фон
  wrap.style.alignItems = "flex-end";

  const panel = document.createElement("div");
  panel.className = "adminPanel";
  panel.style.maxHeight = "70vh";

  panel.innerHTML = `
    <div class="adminTop">
      <div class="adminTitle">Добавить конфиг</div>
      <button id="cmpClose" class="adminBtn ghost">Закрыть</button>
    </div>

    <div class="adminMuted" style="margin-bottom:8px">Вставь текст или отсканируй QR</div>
    <textarea id="cfgText" class="adminTextarea" placeholder="vless://... или любой текст конфига"></textarea>

    <div class="adminBtns" style="margin-top:10px">
      <button id="scanQr" class="adminBtn secondary" style="flex:1">Сканировать QR</button>
      <button id="saveCfg" class="adminBtn primary" style="flex:1">Сохранить</button>
    </div>

    <div id="cmpErr" class="adminMuted" style="color:#ff5a5a;display:none;margin-top:10px"></div>
  `;

  wrap.appendChild(panel);
  document.body.appendChild(wrap);

  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) wrap.remove();
  });

  const closeBtn = panel.querySelector("#cmpClose");
  const scanBtn = panel.querySelector("#scanQr");
  const saveBtn = panel.querySelector("#saveCfg");
  const err = panel.querySelector("#cmpErr");
  const txt = panel.querySelector("#cfgText");

  addPressFx(closeBtn); addPressFx(scanBtn); addPressFx(saveBtn);

  closeBtn.onclick = () => wrap.remove();

  saveBtn.onclick = async () => {
    err.style.display = "none"; err.textContent = "";
    const val = (txt.value || "").trim();
    if (!val) {
      err.style.display = "block";
      err.textContent = "Текст конфига пустой.";
      return;
    }

    saveBtn.disabled = true;
    const old = saveBtn.textContent;
    saveBtn.textContent = "Сохраняем...";

    try {
      await api("/api/admin/configs/add", {
        target_tg_user_id: targetTgId,
        title: "Config",
        config_text: val
      });
      toast("Добавлено");
      wrap.remove();
      openUserConfigs(targetTgId);
    } catch {
      err.style.display = "block";
      err.textContent = "Ошибка сохранения.";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = old;
    }
  };

  scanBtn.onclick = async () => {
    const scanned = await openQrScanner();
    if (scanned) {
      txt.value = scanned;
      toast("QR считан");
    }
  };
}

// QR scanner overlay using getUserMedia + jsQR
async function openQrScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Камера недоступна");
    return null;
  }
  if (!window.jsQR) {
    toast("jsQR не загрузился");
    return null;
  }

  // remove old
  document.getElementById("qrScanner")?.remove();

  return new Promise(async (resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "qrScanner";
    overlay.className = "adminOverlay";
    overlay.style.alignItems = "center";
    overlay.style.padding = "16px";

    const box = document.createElement("div");
    box.style.width = "100%";
    box.style.maxWidth = "420px";
    box.style.background = "#0e1014";
    box.style.border = "1px solid #2a2f3a";
    box.style.borderRadius = "16px";
    box.style.padding = "12px";
    box.style.color = "#fff";
    box.style.fontFamily = "system-ui";

    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
        <div style="font-weight:900">Сканер QR</div>
        <button id="qrClose" class="adminBtn ghost">Закрыть</button>
      </div>
      <div class="adminMuted" style="margin-bottom:10px">Наведи камеру на QR</div>
      <video id="qrVideo" playsinline style="width:100%;border-radius:12px;background:#000"></video>
      <canvas id="qrCanvas" style="display:none"></canvas>
      <div class="adminMuted" id="qrHint" style="margin-top:10px;opacity:.85">Ожидание...</div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const closeBtn = box.querySelector("#qrClose");
    addPressFx(closeBtn);

    let stream = null;
    let rafId = null;

    async function stop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null;
      overlay.remove();
    }

    closeBtn.onclick = async () => {
      await stop();
      resolve(null);
    };

    overlay.addEventListener("click", async (e) => {
      if (e.target === overlay) {
        await stop();
        resolve(null);
      }
    });

    const video = box.querySelector("#qrVideo");
    const canvas = box.querySelector("#qrCanvas");
    const hint = box.querySelector("#qrHint");
    const ctx = canvas.getContext("2d");

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
    } catch (e) {
      hint.textContent = "Нет доступа к камере.";
      return;
    }

    function tick() {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          hint.textContent = "Считано!";
          const data = code.data;
          stop().then(() => resolve(data));
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
  });
}

// ================== MAIN BOOT ==================
async function boot() {
  mustBeTelegram();
  setAvatarLetter();
  wireMenu();
  wireTopupEntry();
  wireSheet();

  try {
    const r = await api("/api/auth");
    const me = r.me;

    // UI fill
    if (el("balance")) el("balance").textContent = formatRub(me.balance_rub);

    if (el("tariffName")) el("tariffName").textContent = me.tariff?.name || "—";
    if (el("tariffPrice")) el("tariffPrice").textContent = `${me.tariff?.price_rub ?? 0} ₽ / ${me.tariff?.period_months ?? 1} мес`;
    if (el("nextPay")) el("nextPay").textContent = `Окончание: ${me.tariff?.expires_at || "—"}`;

    // configs for user list
    try {
      const myCfgs = await api("/api/my_configs");
      renderUserConfigs(myCfgs);
    } catch (e) {
      console.warn("my_configs failed", e);
    }

    // admin button
    if (me.role === "admin") addAdminButton();

    showPage("home");
  } catch (e) {
    if (e.status === 403) return showInviteScreen();
    showBlockingScreen("Ошибка запуска", "Перейдите в Telegram.");
    console.error(e);
  }
}

// start
boot().catch(console.error);
