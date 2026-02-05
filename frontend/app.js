// ================== TELEGRAM ==================
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// ================== HELPERS ==================
const el = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
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
    body: JSON.stringify({ initData: tg?.initData, ...payload }),
    cache: "no-store",
  });

  if (!r.ok) {
    let msg = "";
    try { msg = await r.text(); } catch {}
    const e = new Error(`${path} ${r.status} ${msg}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

function mustBeTelegram() {
  if (!tg || !tg.initData) {
    document.body.innerHTML = `<div style="padding:24px;color:#fff;font-family:system-ui">Откройте приложение в Telegram.</div>`;
    throw new Error("Not in Telegram");
  }
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

// ВАЖНО: is_active может приходить как 0/1 или "0"/"1"
function isActiveFlag(v) {
  return Number(v) === 1;
}

// ================== PAGES ==================
function showPage(name) {
  const ids = ["pageHome","pageTopup","pageAdmin","pageAdminUser","pageAdminConfigs"];
  ids.forEach(id => el(id)?.classList.remove("page-active"));

  if (name === "home") el("pageHome")?.classList.add("page-active");
  if (name === "topup") el("pageTopup")?.classList.add("page-active");
  if (name === "admin") el("pageAdmin")?.classList.add("page-active");
  if (name === "adminUser") el("pageAdminUser")?.classList.add("page-active");
  if (name === "adminConfigs") el("pageAdminConfigs")?.classList.add("page-active");

  // скрывать верхнюю панель в админке (если в CSS есть .hideTopbar .topbar {display:none})
  const isAdminPage = (name === "admin" || name === "adminUser" || name === "adminConfigs");
  document.body.classList.toggle("hideTopbar", isAdminPage);
}

// ================== MENU ==================
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

function wireTopup() {
  const btnRefresh = el("btnRefresh");
  if (btnRefresh) {
    btnRefresh.textContent = "Пополнить";
    addPressFx(btnRefresh);
    btnRefresh.onclick = () => {
      el("dropdown").style.display = "none";
      showPage("topup");
    };
  }

  const balanceBtn = el("balanceBtn");
  if (balanceBtn) {
    addPressFx(balanceBtn);
    balanceBtn.onclick = () => showPage("topup");
  }

  const back = el("backFromTopup");
  if (back) {
    addPressFx(back);
    back.onclick = () => showPage("home");
  }
}

// ================== SHEET ==================
function openSheet(title, configText) {
  const sheet = el("sheet");
  const overlay = el("sheetOverlay");
  if (!sheet || !overlay) return;

  el("sheetTitle").textContent = title || "Конфиг";
  el("configText").textContent = configText || "";

  const qrWrap = el("qr");
  if (qrWrap) {
    qrWrap.innerHTML = "";
    if (window.QRCode && configText) {
      // QRCodejs
      try {
        new QRCode(qrWrap, { text: configText, width: 180, height: 180 });
      } catch (e) {
        qrWrap.innerHTML = `<div class="muted">Не удалось отрисовать QR</div>`;
      }
    } else {
      // если библиотека не подключена — показываем подсказку, чтобы не было "пропал QR"
      qrWrap.innerHTML = `<div class="muted">QR не подключён (нет библиотеки QRCode)</div>`;
    }
  }

  sheet.classList.add("open");
  overlay.classList.add("open");
}

function wireSheet() {
  const overlay = el("sheetOverlay");
  const closeBtn = el("sheetClose");
  const box = el("configBox");

  if (overlay) {
    overlay.onclick = () => {
      el("sheet")?.classList.remove("open");
      overlay.classList.remove("open");
    };
  }

  if (closeBtn) {
    addPressFx(closeBtn);
    closeBtn.onclick = () => {
      el("sheet")?.classList.remove("open");
      el("sheetOverlay")?.classList.remove("open");
    };
  }

  if (box) {
    box.onclick = async () => {
      const text = el("configText")?.textContent || "";
      if (!text.trim()) return;
      try { await navigator.clipboard.writeText(text); toast("Скопировано"); } catch {}
    };
  }
}

// ================== USER CONFIGS ==================
function renderUserConfigs(cfgs) {
  const box = el("vpnList");
  if (!box) return;

  box.innerHTML = "";
  if (!cfgs || cfgs.length === 0) {
    box.innerHTML = `<div class="muted">Пока нет подключений</div>`;
    return;
  }

  cfgs.forEach(c => {
    const active = isActiveFlag(c.is_active);
    const node = document.createElement("div");
    node.className = "item";
    if (!active) node.style.opacity = "0.55";

    node.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">${escapeHtml(c.title)}</div>
          <div class="itemSub">${active ? "активен" : "заблокирован"}</div>
        </div>
        <div class="tag">${active ? "on" : "off"}</div>
      </div>
      <div class="btnRow">
        <button class="btn ${active ? "primary" : "ghost"}" style="flex:1" ${active ? "" : "disabled"}>Открыть</button>
      </div>
    `;

    const btn = node.querySelector("button");
    addPressFx(btn);
    btn.onclick = () => {
      if (!active) return;
      openSheet(c.title, c.config_text);
    };

    box.appendChild(node);
  });
}

// ================== ADMIN STATE ==================
let ME = null;
let ADMIN_SELECTED_USER_ID = null;
let ADMIN_SELECTED_USER = null;

// тарифы: кэш + fallback
let TARIFFS_CACHE = null;
const FALLBACK_TARIFFS = [
  { id: 1, name: "lite",  period_months: 1,  price_rub: 150 },
  { id: 2, name: "uwuw",  period_months: 6,  price_rub: 700 },
  { id: 3, name: "pro",   period_months: 12, price_rub: 1200 },
  { id: 4, name: "prime", period_months: 12, price_rub: 1 },
];

async function loadTariffsBestEffort() {
  if (TARIFFS_CACHE) return TARIFFS_CACHE;
  try {
    const r = await api("/api/tariffs");
    const tariffs = r.tariffs || r;
    if (Array.isArray(tariffs) && tariffs.length) {
      TARIFFS_CACHE = tariffs;
      return tariffs;
    }
  } catch (e) {
    console.warn("tariffs endpoint not available, using fallback", e);
  }
  TARIFFS_CACHE = FALLBACK_TARIFFS;
  return TARIFFS_CACHE;
}

// add admin button into dropdown (with gap)
function ensureAdminMenuButton() {
  const dropdown = el("dropdown");
  if (!dropdown) return;
  if (el("adminMenuBtn")) return;

  const spacer = document.createElement("div");
  spacer.style.height = "8px";
  dropdown.appendChild(spacer);

  const btn = document.createElement("button");
  btn.id = "adminMenuBtn";
  btn.className = "dropdown-btn";
  btn.type = "button";
  btn.textContent = "Админ-консоль";
  addPressFx(btn);

  btn.onclick = async () => {
    dropdown.style.display = "none";
    await openAdminPage();
    showPage("admin");
  };

  dropdown.appendChild(btn);
}

// ================== ADMIN PAGES ==================
async function openAdminPage() {
  const back = el("adminBackHome");
  if (back) { addPressFx(back); back.onclick = () => showPage("home"); }

  const invUser = el("invUser");
  const invAdmin = el("invAdmin");

  if (invUser) {
    addPressFx(invUser);
    invUser.onclick = async () => {
      const r = await api("/api/admin/invite", { role: "user" });
      try { await navigator.clipboard.writeText(r.code); } catch {}
      toast("Код User скопирован");
    };
  }

  if (invAdmin) {
    addPressFx(invAdmin);
    invAdmin.onclick = async () => {
      const r = await api("/api/admin/invite", { role: "admin" });
      try { await navigator.clipboard.writeText(r.code); } catch {}
      toast("Код Admin скопирован");
    };
  }

  const users = await api("/api/admin/users");
  renderAdminUsers(users);
}

function renderAdminUsers(users) {
  const box = el("adminUsersList");
  if (!box) return;

  box.innerHTML = "";
  if (!users || users.length === 0) {
    box.innerHTML = `<div class="muted">Пользователей нет</div>`;
    return;
  }

  users.forEach(u => {
    const node = document.createElement("div");
    node.className = "item";

    node.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">
            ${escapeHtml(u.first_name || "")}
            <span style="opacity:.7">@${escapeHtml(u.username || "")}</span>
          </div>
          <div class="itemSub">${u.balance_rub} ₽ • ${escapeHtml(u.tariff_name || "—")} • ${escapeHtml(u.role || "")}</div>
        </div>
        <div class="tag">${escapeHtml(u.role || "")}</div>
      </div>

      <div class="btnRow">
        <button class="btn primary" style="flex:1">Открыть</button>
      </div>
    `;

    const btn = node.querySelector("button");
    addPressFx(btn);
    btn.onclick = async () => {
      ADMIN_SELECTED_USER_ID = Number(u.tg_user_id);
      ADMIN_SELECTED_USER = u;
      await openAdminUserPage(u);
      showPage("adminUser");
    };

    box.appendChild(node);
  });
}

async function openAdminUserPage(u) {
  const back = el("adminUserBack");
  if (back) { addPressFx(back); back.onclick = () => showPage("admin"); }

  const title = el("adminUserTitle");
  if (title) title.textContent = `${u.first_name || "Пользователь"} @${u.username || ""}`;

  const balNow = el("adminUserBalanceNow");
  if (balNow) balNow.textContent = `${Number(u.balance_rub).toFixed(2)} ₽`;

  const balInp = el("adminUserBalanceInput");
  if (balInp) balInp.value = String(u.balance_rub ?? "");

  const balErr = el("adminBalanceErr");
  if (balErr) { balErr.style.display = "none"; balErr.textContent = ""; }

  // save balance
  const saveBal = el("adminSaveBalance");
  if (saveBal) {
    addPressFx(saveBal);
    saveBal.onclick = async () => {
      const err = el("adminBalanceErr");
      err.style.display = "none";
      err.textContent = "";

      const val = Number(el("adminUserBalanceInput").value);
      if (Number.isNaN(val)) {
        err.style.display = "block";
        err.textContent = "Баланс должен быть числом.";
        return;
      }

      const old = saveBal.textContent;
      saveBal.textContent = "Сохраняем...";
      saveBal.disabled = true;

      try {
        await api("/api/admin/user/set_balance", {
          target_tg_user_id: ADMIN_SELECTED_USER_ID,
          balance_rub: val
        });

        el("adminUserBalanceNow").textContent = `${val.toFixed(2)} ₽`;
        ADMIN_SELECTED_USER.balance_rub = val;
        toast("Сохранено");
      } catch (e) {
        err.style.display = "block";
        err.textContent = "Ошибка сохранения.";
        console.error(e);
      } finally {
        saveBal.textContent = old;
        saveBal.disabled = false;
      }
    };
  }

  // tariff selector (если есть элементы на странице)
  await wireAdminTariffSection(u);

  // open configs button (где бы он ни был)
  const openCfgBtn = el("adminOpenConfigs");
  if (openCfgBtn) {
    addPressFx(openCfgBtn);
    openCfgBtn.onclick = async () => {
      await openAdminConfigsPage(ADMIN_SELECTED_USER_ID, ADMIN_SELECTED_USER);
      showPage("adminConfigs");
    };
  }

  // delete user
  const delBtn = el("adminDeleteUser");
  if (delBtn) {
    addPressFx(delBtn);
    delBtn.onclick = async () => {
      if (!confirm("Удалить пользователя?")) return;
      await api("/api/admin/user/delete", { target_tg_user_id: ADMIN_SELECTED_USER_ID });
      toast("Удалено");
      await openAdminPage();
      showPage("admin");
    };
  }
}

async function wireAdminTariffSection(u) {
  // Эти элементы есть только если ты добавил секцию тарифа в HTML
  const now = el("adminUserTariffNow");
  const sel = el("adminTariffSelect");
  const save = el("adminSaveTariff");
  const err = el("adminTariffErr");

  if (!sel || !save || !now) return;

  if (err) { err.style.display = "none"; err.textContent = ""; }

  const tariffs = await loadTariffsBestEffort();

  now.textContent = u.tariff_name || "—";
  sel.innerHTML = tariffs.map(t => (
    `<option value="${t.id}">${escapeHtml(t.name)} — ${t.price_rub} ₽ / ${t.period_months} мес</option>`
  )).join("");

  // попробуем выбрать текущий по имени
  const current = tariffs.find(t => t.name === u.tariff_name);
  if (current) sel.value = String(current.id);

  addPressFx(save);
  save.onclick = async () => {
    if (err) { err.style.display = "none"; err.textContent = ""; }

    const tariffId = Number(sel.value);
    if (!tariffId) {
      if (err) { err.style.display = "block"; err.textContent = "Выберите тариф."; }
      return;
    }

    const old = save.textContent;
    save.textContent = "Сохраняем...";
    save.disabled = true;

    try {
      // Если у тебя другой эндпоинт — скажи имя, поменяю сразу
      await api("/api/admin/user/set_tariff", {
        target_tg_user_id: ADMIN_SELECTED_USER_ID,
        tariff_id: tariffId
      });

      const t = tariffs.find(x => x.id === tariffId);
      now.textContent = t ? t.name : "—";
      ADMIN_SELECTED_USER.tariff_name = t ? t.name : ADMIN_SELECTED_USER.tariff_name;
      toast("Тариф сохранён");
    } catch (e) {
      console.error(e);
      if (err) { err.style.display = "block"; err.textContent = "Ошибка сохранения тарифа."; }
    } finally {
      save.textContent = old;
      save.disabled = false;
    }
  };
}

// ================== ADMIN CONFIGS ==================
async function openAdminConfigsPage(targetTgId, userObj) {
  const back = el("configsBack");
  if (back) { addPressFx(back); back.onclick = () => showPage("adminUser"); }

  const title = el("configsTitle");
  if (title) title.textContent = `Конфиги: ${userObj?.first_name || ""}`;

  const composer = el("cfgComposer");
  const toggle = el("cfgToggleComposer");
  const err = el("cfgErr");
  const txt = el("cfgText");
  const scan = el("scanQrBtn");
  const save = el("saveCfgBtn");

  if (composer) composer.style.display = "none";
  if (err) { err.style.display = "none"; err.textContent = ""; }
  if (txt) txt.value = "";

  if (toggle) {
    addPressFx(toggle);
    toggle.onclick = () => {
      if (!composer) return;
      composer.style.display = (composer.style.display === "none" || !composer.style.display) ? "block" : "none";
    };
  }

  if (scan) {
    addPressFx(scan);
    scan.onclick = async () => {
      const s = await openQrScanner();
      if (s && txt) txt.value = s;
    };
  }

  if (save) {
    addPressFx(save);
    save.onclick = async () => {
      if (!txt) return;
      const value = (txt.value || "").trim();
      if (!value) {
        if (err) { err.style.display = "block"; err.textContent = "Текст подключения пустой."; }
        return;
      }

      if (err) { err.style.display = "none"; err.textContent = ""; }

      await api("/api/admin/configs/add", {
        target_tg_user_id: targetTgId,
        title: "Config",
        config_text: value
      });

      toast("Добавлено");
      txt.value = "";
      if (composer) composer.style.display = "none";

      const cfgs2 = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });
      renderAdminConfigsList(targetTgId, cfgs2);
    };
  }

  const cfgs = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });
  renderAdminConfigsList(targetTgId, cfgs);
}

function renderAdminConfigsList(targetTgId, cfgs) {
  const box = el("adminConfigsList");
  if (!box) return;

  box.innerHTML = "";
  if (!cfgs || cfgs.length === 0) {
    box.innerHTML = `<div class="muted">Конфигов нет</div>`;
    return;
  }

  cfgs.forEach(c => {
    const active = isActiveFlag(c.is_active);

    const node = document.createElement("div");
    node.className = "item";
    if (!active) node.style.opacity = "0.55";

    node.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">${escapeHtml(c.title)}</div>
          <div class="itemSub">${escapeHtml(c.config_text).slice(0,140)}${(c.config_text || "").length>140?"…":""}</div>
        </div>
        <div class="tag">${active ? "active" : "blocked"}</div>
      </div>

      <div class="btnRow">
        <button class="btn primary" data-open="1" style="flex:1">Открыть</button>
        <button class="btn" data-toggle="1" style="flex:1">${active ? "Блокировать" : "Разблок."}</button>
        <button class="btn danger" data-del="1" style="flex:1">Удалить</button>
      </div>
    `;

    // admin can always open (even if blocked)
    const bOpen = node.querySelector('[data-open="1"]');
    addPressFx(bOpen);
    bOpen.onclick = () => openSheet(c.title, c.config_text);

    // toggle: шлём максимально совместимо (включая target_tg_user_id)
    const bToggle = node.querySelector('[data-toggle="1"]');
    addPressFx(bToggle);
    bToggle.onclick = async () => {
      const nextActive = active ? 0 : 1;

      await api("/api/admin/configs/update", {
        target_tg_user_id: targetTgId,     // <--- ВАЖНО (часто требуется)
        config_id: c.id,
        title: c.title,
        config_text: c.config_text,
        is_active: nextActive
      });

      toast(active ? "Заблокировано" : "Разблокировано");

      const cfgs2 = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });
      renderAdminConfigsList(target_tg_user_id = targetTgId, cfgs2); // безопасно
    };

    // delete
    const bDel = node.querySelector('[data-del="1"]');
    addPressFx(bDel);
    bDel.onclick = async () => {
      if (!confirm(`Удалить конфиг "${c.title}"?`)) return;
      await api("/api/admin/configs/delete", { target_tg_user_id: targetTgId, config_id: c.id });
      toast("Удалено");
      const cfgs2 = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });
      renderAdminConfigsList(targetTgId, cfgs2);
    };

    box.appendChild(node);
  });
}

// ================== QR SCANNER ==================
async function openQrScanner() {
  if (!navigator.mediaDevices?.getUserMedia) { toast("Камера недоступна"); return null; }
  if (!window.jsQR) { toast("jsQR не загрузился"); return null; }

  const modal = document.createElement("div");
  modal.className = "qrModal";
  modal.innerHTML = `
    <div class="qrBox">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div style="font-weight:900">Сканер QR</div>
        <button id="qrClose" class="btn ghost" type="button" style="min-height:34px;padding:6px 10px">Закрыть</button>
      </div>
      <div class="muted" style="margin-top:6px">Наведи камеру на QR</div>
      <video id="qrVideo" class="qrVideo" playsinline></video>
      <canvas id="qrCanvas" style="display:none"></canvas>
      <div id="qrHint" class="muted" style="margin-top:10px">Ожидание…</div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector("#qrClose");
  addPressFx(closeBtn);

  let stream = null;
  let rafId = null;

  async function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    modal.remove();
  }

  return new Promise(async (resolve) => {
    closeBtn.onclick = async () => { await stop(); resolve(null); };
    modal.addEventListener("click", async (e) => {
      if (e.target === modal) { await stop(); resolve(null); }
    });

    const video = modal.querySelector("#qrVideo");
    const canvas = modal.querySelector("#qrCanvas");
    const hint = modal.querySelector("#qrHint");
    const ctx = canvas.getContext("2d");

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
    } catch (e) {
      console.error(e);
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

// ================== INVITE FALLBACK ==================
function showInviteScreen() {
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#0e1014;color:#fff;padding:22px;font-family:system-ui">
      <div style="max-width:420px;margin:70px auto">
        <div style="font-weight:900;font-size:20px;margin-bottom:10px">Доступ отсутствует</div>
        <div style="opacity:.8;margin-bottom:12px">Введите код приглашения:</div>
        <input id="inviteCode" style="width:100%;padding:12px;border-radius:12px;border:1px solid #2a2f3a;background:#161b24;color:#fff;font-size:14px" placeholder="Код">
        <button id="inviteBtn" style="width:100%;margin-top:12px;min-height:42px;border-radius:12px;border:none;background:#2a7fff;color:#fff;font-weight:900;font-size:14px">Авторизоваться</button>
        <div id="inviteErr" style="display:none;color:#ff5a5a;margin-top:10px;font-size:13px"></div>
      </div>
    </div>
  `;

  const btn = document.getElementById("inviteBtn");
  btn.addEventListener("pointerdown", () => btn.classList.add("pressed"));
  const up = () => btn.classList.remove("pressed");
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointerleave", up);
  btn.addEventListener("pointercancel", up);

  btn.onclick = async () => {
    const code = (document.getElementById("inviteCode").value || "").trim();
    const err = document.getElementById("inviteErr");
    err.style.display = "none";
    err.textContent = "";

    if (!code) {
      err.style.display = "block";
      err.textContent = "Введите код.";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Проверяем...";

    try {
      await api("/api/redeem", { code });
      window.location.href = "/?autologin=1";
    } catch {
      err.style.display = "block";
      err.textContent = "Код неверный или уже использован.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Авторизоваться";
    }
  };
}

// ================== BOOT ==================
async function boot() {
  mustBeTelegram();
  setAvatarLetter();

  wireMenu();
  wireTopup();
  wireSheet();

  try {
    const r = await api("/api/auth");
    ME = r.me;

    el("balance").textContent = formatRub(ME.balance_rub);
    el("tariffName").textContent = ME.tariff?.name || "—";
    el("tariffPrice").textContent = `${ME.tariff?.price_rub ?? 0} ₽ / ${ME.tariff?.period_months ?? 1} мес`;
    el("nextPay").textContent = `Окончание: ${ME.tariff?.expires_at || "—"}`;

    // user configs
    const myCfgs = await api("/api/my_configs");
    renderUserConfigs(myCfgs);

    // admin
    if (ME.role === "admin") ensureAdminMenuButton();

    showPage("home");
  } catch (e) {
    if (e.status === 403) return showInviteScreen();
    document.body.innerHTML = `<div style="padding:24px;color:#fff;font-family:system-ui">Ошибка запуска</div>`;
    console.error(e);
  }
}

boot().catch(console.error);
