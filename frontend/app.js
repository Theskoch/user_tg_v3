const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

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
    document.body.innerHTML = `<div style="padding:24px;color:#fff;font-family:system-ui">Откройте приложение в Telegram.</div>`;
    throw new Error("Not Telegram");
  }
}

function setAvatarLetter() {
  const user = tg?.initDataUnsafe?.user;
  const letter = (user?.first_name?.trim()?.[0] || "U").toUpperCase();
  el("avatar").textContent = letter;
}

function formatRub(x) {
  const n = Number(x || 0);
  return `${n.toFixed(2)} ₽`;
}

// ================== Pages ==================
function showPage(name) {
  const ids = ["pageHome","pageTopup","pageAdmin","pageAdminUser","pageAdminConfigs"];
  ids.forEach(id => el(id)?.classList.remove("page-active"));
  if (name === "home") el("pageHome")?.classList.add("page-active");
  if (name === "topup") el("pageTopup")?.classList.add("page-active");
  if (name === "admin") el("pageAdmin")?.classList.add("page-active");
  if (name === "adminUser") el("pageAdminUser")?.classList.add("page-active");
  if (name === "adminConfigs") el("pageAdminConfigs")?.classList.add("page-active");
}

// ================== Menu ==================
function wireMenu() {
  const burger = el("burger");
  const dropdown = el("dropdown");
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
  addPressFx(el("btnRefresh"));
  el("btnRefresh").onclick = () => {
    el("dropdown").style.display = "none";
    showPage("topup");
  };

  addPressFx(el("balanceBtn"));
  el("balanceBtn").onclick = () => showPage("topup");

  addPressFx(el("backFromTopup"));
  el("backFromTopup").onclick = () => showPage("home");
}

// ================== Sheet ==================
function openSheet(title, configText) {
  el("sheetTitle").textContent = title || "Конфиг";
  el("configText").textContent = configText || "";

  const qrWrap = el("qr");
  if (qrWrap) {
    qrWrap.innerHTML = "";
    // если подключена QRCode — рисуем
    if (window.QRCode && configText) {
      new QRCode(qrWrap, { text: configText, width: 180, height: 180 });
    }
  }

  el("sheet").classList.add("open");
  el("sheetOverlay").classList.add("open");
}

function wireSheet() {
  el("sheetOverlay").onclick = () => {
    el("sheet").classList.remove("open");
    el("sheetOverlay").classList.remove("open");
  };

  addPressFx(el("sheetClose"));
  el("sheetClose").onclick = () => {
    el("sheet").classList.remove("open");
    el("sheetOverlay").classList.remove("open");
  };

  el("configBox").onclick = async () => {
    const text = el("configText").textContent || "";
    if (!text.trim()) return;
    try { await navigator.clipboard.writeText(text); toast("Скопировано"); } catch {}
  };
}

// ================== User configs ==================
function renderUserConfigs(cfgs) {
  const box = el("vpnList");
  box.innerHTML = "";

  if (!cfgs || cfgs.length === 0) {
    box.innerHTML = `<div class="muted">Пока нет подключений</div>`;
    return;
  }

  cfgs.forEach(c => {
    const inactive = !c.is_active;

    const node = document.createElement("div");
    node.className = "item";
    if (inactive) node.style.opacity = "0.55";

    node.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">${escapeHtml(c.title)}</div>
          <div class="itemSub">${inactive ? "заблокирован" : "активен"}</div>
        </div>
        <div class="tag">${inactive ? "off" : "on"}</div>
      </div>
      <div class="btnRow">
        <button class="btn ${inactive ? "ghost" : "primary"}" style="flex:1" ${inactive ? "disabled" : ""}>Открыть</button>
      </div>
    `;

    const btn = node.querySelector("button");
    addPressFx(btn);
    btn.onclick = () => {
      if (inactive) return;
      openSheet(c.title, c.config_text);
    };

    box.appendChild(node);
  });
}

// ================== Admin state ==================
let ME = null;
let ADMIN_SELECTED_USER_ID = null;
let ADMIN_SELECTED_USER = null;

// add admin button into dropdown (with gap)
function ensureAdminMenuButton() {
  const dropdown = el("dropdown");
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
    el("dropdown").style.display = "none";
    await openAdminPage();
    showPage("admin");
  };

  dropdown.appendChild(btn);
}

// ================== Admin pages ==================
async function openAdminPage() {
  addPressFx(el("adminBackHome"));
  el("adminBackHome").onclick = () => showPage("home");

  // invites
  addPressFx(el("invUser"));
  addPressFx(el("invAdmin"));

  el("invUser").onclick = async () => {
    const r = await api("/api/admin/invite", { role: "user" });
    try { await navigator.clipboard.writeText(r.code); } catch {}
    toast("Код User скопирован");
  };

  el("invAdmin").onclick = async () => {
    const r = await api("/api/admin/invite", { role: "admin" });
    try { await navigator.clipboard.writeText(r.code); } catch {}
    toast("Код Admin скопирован");
  };

  const users = await api("/api/admin/users");
  renderAdminUsers(users);
}

function renderAdminUsers(users) {
  const box = el("adminUsersList");
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
          <div class="itemSub">${u.balance_rub} ₽ • ${escapeHtml(u.tariff_name)} • ${escapeHtml(u.role)}</div>
        </div>
        <div class="tag">${escapeHtml(u.role)}</div>
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
  addPressFx(el("adminUserBack"));
  el("adminUserBack").onclick = () => showPage("admin");

  el("adminUserTitle").textContent =
    `${u.first_name || "Пользователь"} @${u.username || ""}`;

  // show current balance
  el("adminUserBalanceNow").textContent = `${Number(u.balance_rub).toFixed(2)} ₽`;
  el("adminUserBalanceInput").value = String(u.balance_rub ?? "");

  el("adminBalanceErr").style.display = "none";
  el("adminBalanceErr").textContent = "";

  // save balance
  addPressFx(el("adminSaveBalance"));
  el("adminSaveBalance").onclick = async () => {
    const err = el("adminBalanceErr");
    err.style.display = "none";
    err.textContent = "";

    const val = Number(el("adminUserBalanceInput").value);
    if (Number.isNaN(val)) {
      err.style.display = "block";
      err.textContent = "Баланс должен быть числом.";
      return;
    }

    const btn = el("adminSaveBalance");
    const old = btn.textContent;
    btn.textContent = "Сохраняем...";
    btn.disabled = true;

    try {
      await api("/api/admin/user/set_balance", {
        target_tg_user_id: ADMIN_SELECTED_USER_ID,
        balance_rub: val
      });

      // обновим верхнее значение
      el("adminUserBalanceNow").textContent = `${val.toFixed(2)} ₽`;

      // и обновим кеш + список пользователей, чтобы в админке тоже обновилось
      ADMIN_SELECTED_USER.balance_rub = val;
      toast("Сохранено");
    } catch {
      err.style.display = "block";
      err.textContent = "Ошибка сохранения.";
    } finally {
      btn.textContent = old;
      btn.disabled = false;
    }
  };

  // configs
  addPressFx(el("adminOpenConfigs"));
  el("adminOpenConfigs").onclick = async () => {
    await openAdminConfigsPage(ADMIN_SELECTED_USER_ID, ADMIN_SELECTED_USER);
    showPage("adminConfigs");
  };

  // delete user
  addPressFx(el("adminDeleteUser"));
  el("adminDeleteUser").onclick = async () => {
    if (!confirm("Удалить пользователя?")) return;
    await api("/api/admin/user/delete", { target_tg_user_id: ADMIN_SELECTED_USER_ID });
    toast("Удалено");
    await openAdminPage();
    showPage("admin");
  };
}

// ================== Admin configs ==================
async function openAdminConfigsPage(targetTgId, userObj) {
  addPressFx(el("configsBack"));
  el("configsBack").onclick = () => showPage("adminUser");

  el("configsTitle").textContent =
    `Конфиги: ${userObj?.first_name || ""}`;

  // composer
  el("cfgComposer").style.display = "none";
  el("cfgErr").style.display = "none";
  el("cfgText").value = "";

  addPressFx(el("cfgToggleComposer"));
  el("cfgToggleComposer").onclick = () => {
    const v = el("cfgComposer").style.display;
    el("cfgComposer").style.display = (v === "none" || !v) ? "block" : "none";
  };

  addPressFx(el("scanQrBtn"));
  el("scanQrBtn").onclick = async () => {
    const s = await openQrScanner();
    if (s) el("cfgText").value = s;
  };

  addPressFx(el("saveCfgBtn"));
  el("saveCfgBtn").onclick = async () => {
    const err = el("cfgErr");
    err.style.display = "none";
    err.textContent = "";

    const txt = (el("cfgText").value || "").trim();
    if (!txt) {
      err.style.display = "block";
      err.textContent = "Текст подключения пустой.";
      return;
    }

    await api("/api/admin/configs/add", {
      target_tg_user_id: targetTgId,
      title: "Config",
      config_text: txt
    });
    toast("Добавлено");

    el("cfgText").value = "";
    el("cfgComposer").style.display = "none";

    const cfgs2 = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });
    renderAdminConfigsList(targetTgId, cfgs2);
  };

  const cfgs = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });
  renderAdminConfigsList(targetTgId, cfgs);
}

function renderAdminConfigsList(targetTgId, cfgs) {
  const box = el("adminConfigsList");
  box.innerHTML = "";

  if (!cfgs || cfgs.length === 0) {
    box.innerHTML = `<div class="muted">Конфигов нет</div>`;
    return;
  }

  cfgs.forEach(c => {
    const inactive = !c.is_active;

    const node = document.createElement("div");
    node.className = "item";
    if (inactive) node.style.opacity = "0.55";

    node.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">${escapeHtml(c.title)}</div>
          <div class="itemSub">${escapeHtml(c.config_text).slice(0,140)}${c.config_text.length>140?"…":""}</div>
        </div>
        <div class="tag">${inactive ? "blocked" : "active"}</div>
      </div>

      <div class="btnRow">
        <button class="btn primary" data-open="1" style="flex:1">Открыть</button>
        <button class="btn" data-toggle="1" style="flex:1">${inactive ? "Разблок." : "Блокировать"}</button>
        <button class="btn danger" data-del="1" style="flex:1">Удалить</button>
      </div>
    `;

    // open: админ всегда может открыть
    const bOpen = node.querySelector('[data-open="1"]');
    addPressFx(bOpen);
    bOpen.onclick = () => openSheet(c.title, c.config_text);

    // toggle: ВАЖНО — отправляем title+config_text+is_active (как ты делал ранее)
    const bToggle = node.querySelector('[data-toggle="1"]');
    addPressFx(bToggle);
    bToggle.onclick = async () => {
      await api("/api/admin/configs/update", {
        config_id: c.id,
        title: c.title,
        config_text: c.config_text,
        is_active: c.is_active ? 0 : 1
      });
      toast(c.is_active ? "Заблокировано" : "Разблокировано");

      // перерисовать список
      const cfgs2 = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });
      renderAdminConfigsList(targetTgId, cfgs2);

      // и обновить на главной у юзера при следующем открытии — backend уже отдаст is_active=0
    };

    // delete with confirm
    const bDel = node.querySelector('[data-del="1"]');
    addPressFx(bDel);
    bDel.onclick = async () => {
      if (!confirm(`Удалить конфиг "${c.title}"?`)) return;
      await api("/api/admin/configs/delete", { config_id: c.id });
      toast("Удалено");
      const cfgs2 = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });
      renderAdminConfigsList(targetTgId, cfgs2);
    };

    box.appendChild(node);
  });
}

// ================== QR Scanner ==================
async function openQrScanner() {
  if (!navigator.mediaDevices?.getUserMedia) { toast("Камера недоступна"); return null; }
  if (!window.jsQR) { toast("jsQR не загрузился"); return null; }

  const modal = document.createElement("div");
  modal.className = "qrModal";
  modal.innerHTML = `
    <div class="qrBox">
      <div class="row">
        <div style="font-weight:900">Сканер QR</div>
        <button id="qrClose" class="btn ghost" type="button" style="min-height:36px;padding:6px 10px">Закрыть</button>
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
    } catch {
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

// ================== Invite fallback ==================
function showInviteScreen() {
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#0e1014;color:#fff;padding:22px;font-family:system-ui">
      <div style="max-width:420px;margin:70px auto">
        <div style="font-weight:900;font-size:20px;margin-bottom:10px">Доступ отсутствует</div>
        <div style="opacity:.8;margin-bottom:12px">если есть код — введи его:</div>
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

// ================== Boot ==================
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
