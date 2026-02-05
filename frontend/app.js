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
    document.body.innerHTML = `<div style="color:#fff;padding:30px;font-family:system-ui">Ошибка запуска. Перейдите в Telegram.</div>`;
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

// ================== PAGES ==================
function showPage(name) {
  const ids = ["pageHome", "pageTopup", "pageAdmin", "pageAdminConfigs"];
  ids.forEach(id => el(id)?.classList.remove("page-active"));

  if (name === "home") el("pageHome")?.classList.add("page-active");
  if (name === "topup") el("pageTopup")?.classList.add("page-active");
  if (name === "admin") el("pageAdmin")?.classList.add("page-active");
  if (name === "adminConfigs") el("pageAdminConfigs")?.classList.add("page-active");
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
  const btn = el("btnRefresh");
  const balanceBtn = el("balanceBtn");

  if (btn) {
    addPressFx(btn);
    btn.textContent = "Пополнить";
    btn.onclick = () => {
      el("dropdown").style.display = "none";
      showPage("topup");
    };
  }

  if (balanceBtn) {
    addPressFx(balanceBtn);
    balanceBtn.onclick = () => showPage("topup");
  }

  el("backFromTopup") && (el("backFromTopup").onclick = () => showPage("home"));
}

// ================== SHEET ==================
function openSheet(title, configText) {
  const sheet = el("sheet");
  const overlay = el("sheetOverlay");
  const sheetTitle = el("sheetTitle");
  const textEl = el("configText");
  const qrWrap = el("qr");

  if (sheetTitle) sheetTitle.textContent = title || "Конфиг";
  if (textEl) textEl.textContent = configText || "";

  // QR render if QRCode library exists
  if (qrWrap) {
    qrWrap.innerHTML = "";
    if (window.QRCode && configText) {
      new QRCode(qrWrap, { text: configText, width: 180, height: 180 });
    }
  }

  sheet?.classList.add("open");
  overlay?.classList.add("open");
}

function wireSheet() {
  const overlay = el("sheetOverlay");
  const closeBtn = el("sheetClose");
  const box = el("configBox");

  if (overlay) overlay.onclick = () => { el("sheet")?.classList.remove("open"); overlay.classList.remove("open"); };
  if (closeBtn) {
    addPressFx(closeBtn);
    closeBtn.onclick = () => { el("sheet")?.classList.remove("open"); el("sheetOverlay")?.classList.remove("open"); };
  }
  if (box) {
    box.onclick = async () => {
      const text = el("configText")?.textContent || "";
      if (!text.trim()) return;
      try { await navigator.clipboard.writeText(text); toast("Скопировано"); } catch {}
    };
  }
}

// ================== USER LIST ==================
function renderUserConfigs(cfgs) {
  const list = el("vpnList");
  if (!list) return;

  list.innerHTML = "";

  (cfgs || []).forEach(c => {
    const inactive = !c.is_active;

    const node = document.createElement("div");
    node.className = "item";
    node.style.opacity = inactive ? "0.45" : "1";

    node.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">${escapeHtml(c.title)}</div>
          <div class="itemSub">${inactive ? "заблокирован" : "активен"}</div>
        </div>
        <div class="tag">${inactive ? "off" : "on"}</div>
      </div>

      <div class="btnRow">
        <button class="bigBtn ${inactive ? "ghost" : "primary"}" style="flex:1" ${inactive ? "disabled" : ""}>Открыть</button>
      </div>
    `;

    const btn = node.querySelector("button");
    addPressFx(btn);
    btn.onclick = () => {
      if (inactive) return;
      openSheet(c.title, c.config_text);
    };

    list.appendChild(node);
  });

  if ((cfgs || []).length === 0) {
    list.innerHTML = `<div class="skeleton">Пока нет подключений</div>`;
  }
}

// ================== ADMIN ==================
let IS_ADMIN = false;
let ADMIN_SELECTED_USER_ID = null;

function addAdminMenuButton() {
  const menu = el("dropdown");
  if (!menu) return;
  if (el("adminMenuBtn")) return;

  const spacer = document.createElement("div");
  spacer.style.height = "8px";
  menu.appendChild(spacer);

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

  menu.appendChild(btn);
}

async function openAdminPage() {
  el("adminBackHome").onclick = () => showPage("home");

  // invite buttons
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
  if (!box) return;

  box.innerHTML = "";

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
          <div class="itemSub">${u.balance_rub} ₽ • ${escapeHtml(u.tariff_name)} • ${u.role}</div>
        </div>
        <div class="tag">${u.role}</div>
      </div>
      <div class="btnRow">
        <button class="bigBtn primary" style="flex:1">Конфиги</button>
      </div>
    `;

    const btn = node.querySelector("button");
    addPressFx(btn);
    btn.onclick = async () => {
      ADMIN_SELECTED_USER_ID = Number(u.tg_user_id);
      await openAdminConfigsPage(ADMIN_SELECTED_USER_ID, u);
      showPage("adminConfigs");
    };

    box.appendChild(node);
  });

  if ((users || []).length === 0) {
    box.innerHTML = `<div class="skeleton">Пользователей нет</div>`;
  }
}

// ================== ADMIN CONFIGS PAGE ==================
async function openAdminConfigsPage(targetTgId, userObj = null) {
  el("configsBackAdmin").onclick = () => showPage("admin");

  const title = userObj
    ? `Конфиги: ${userObj.first_name || ""}`
    : `Конфиги`;

  el("configsTitle").textContent = title;

  // composer controls
  el("cfgErr").style.display = "none";
  el("cfgComposer").style.display = "none";
  el("cfgText").value = "";

  addPressFx(el("cfgAddBtn"));
  addPressFx(el("cfgCloseComposerBtn"));
  addPressFx(el("scanQrBtn"));
  addPressFx(el("saveCfgBtn"));

  el("cfgAddBtn").onclick = () => { el("cfgComposer").style.display = "block"; };
  el("cfgCloseComposerBtn").onclick = () => { el("cfgComposer").style.display = "none"; };

  el("scanQrBtn").onclick = async () => {
    const scanned = await openQrScanner();
    if (scanned) el("cfgText").value = scanned;
  };

  el("saveCfgBtn").onclick = async () => {
    const txt = (el("cfgText").value || "").trim();
    if (!txt) {
      el("cfgErr").style.display = "block";
      el("cfgErr").textContent = "Текст подключения пустой.";
      return;
    }

    el("cfgErr").style.display = "none";
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
  if (!box) return;

  box.innerHTML = "";

  (cfgs || []).forEach(c => {
    const inactive = !c.is_active;

    const node = document.createElement("div");
    node.className = "item";
    node.style.opacity = inactive ? "0.55" : "1";

    node.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">${escapeHtml(c.title)}</div>
          <div class="itemSub">${escapeHtml(c.config_text).slice(0,140)}${c.config_text.length>140?"…":""}</div>
        </div>
        <div class="tag">${inactive ? "blocked" : "active"}</div>
      </div>

      <div class="btnRow">
        <button class="bigBtn primary" data-open="${c.id}" style="flex:1">Открыть</button>
        <button class="bigBtn" data-toggle="${c.id}" style="flex:1">${inactive ? "Разблок." : "Блокировать"}</button>
        <button class="bigBtn danger" data-del="${c.id}" style="flex:1">Удалить</button>
      </div>
    `;

    // open: админ может открыть всегда, даже если blocked
    const btnOpen = node.querySelector(`[data-open="${c.id}"]`);
    addPressFx(btnOpen);
    btnOpen.onclick = () => openSheet(c.title, c.config_text);

    // block/unblock: реально меняем is_active
    const btnToggle = node.querySelector(`[data-toggle="${c.id}"]`);
    addPressFx(btnToggle);
    btnToggle.onclick = async () => {
      await api("/api/admin/configs/update", {
        config_id: c.id,
        title: c.title,
        config_text: c.config_text,
        is_active: c.is_active ? 0 : 1
      });
      toast(c.is_active ? "Заблокировано" : "Разблокировано");
      const cfgs2 = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });
      renderAdminConfigsList(targetTgId, cfgs2);
    };

    // delete with confirm
    const btnDel = node.querySelector(`[data-del="${c.id}"]`);
    addPressFx(btnDel);
    btnDel.onclick = async () => {
      if (!confirm(`Удалить конфиг "${c.title}"?`)) return;
      await api("/api/admin/configs/delete", { config_id: c.id });
      toast("Удалено");
      const cfgs2 = await api("/api/admin/configs/list", { target_tg_user_id: targetTgId });
      renderAdminConfigsList(targetTgId, cfgs2);
    };

    box.appendChild(node);
  });

  if ((cfgs || []).length === 0) {
    box.innerHTML = `<div class="skeleton">Конфигов пока нет</div>`;
  }
}

// ================== QR SCANNER ==================
async function openQrScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Камера недоступна");
    return null;
  }
  if (!window.jsQR) {
    toast("jsQR не загрузился");
    return null;
  }

  // modal
  const modal = document.createElement("div");
  modal.className = "qrModal";

  modal.innerHTML = `
    <div class="qrBox">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div style="font-weight:900;font-size:16px">Сканер QR</div>
        <button id="qrClose" class="bigBtn ghost" style="min-height:44px;padding:10px 12px;border-radius:14px;font-size:14px">Закрыть</button>
      </div>
      <div class="muted" style="margin-top:6px">Наведи камеру на QR</div>
      <video id="qrVideo" class="qrVideo" playsinline></video>
      <canvas id="qrCanvas" style="display:none"></canvas>
      <div id="qrHint" class="muted" style="margin-top:10px">Ожидание...</div>
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

// ================== BOOT ==================
async function boot() {
  mustBeTelegram();
  setAvatarLetter();
  wireMenu();
  wireTopup();
  wireSheet();

  try {
    const r = await api("/api/auth");
    const me = r.me;

    el("balance").textContent = formatRub(me.balance_rub);
    el("tariffName").textContent = me.tariff?.name || "—";
    el("tariffPrice").textContent = `${me.tariff?.price_rub ?? 0} ₽ / ${me.tariff?.period_months ?? 1} мес`;
    el("nextPay").textContent = `Окончание: ${me.tariff?.expires_at || "—"}`;

    // user configs
    try {
      const myCfgs = await api("/api/my_configs");
      renderUserConfigs(myCfgs);
    } catch (e) {
      el("vpnList").innerHTML = `<div class="skeleton">Не удалось загрузить список</div>`;
      console.warn(e);
    }

    IS_ADMIN = (me.role === "admin");
    if (IS_ADMIN) addAdminMenuButton();

    // admin navigation wiring
    el("adminBackHome").onclick = () => showPage("home");
    el("configsBackAdmin").onclick = () => showPage("admin");

    showPage("home");
  } catch (e) {
    if (e.status === 403) {
      // invite screen (простая)
      document.body.innerHTML = `
        <div style="min-height:100vh;background:#0e1014;color:#fff;padding:22px;font-family:system-ui">
          <div style="max-width:420px;margin:70px auto">
            <div style="font-weight:900;font-size:20px;margin-bottom:10px">Доступ отсутствует</div>
            <div style="opacity:.8;margin-bottom:12px">Введите код приглашения:</div>
            <input id="inviteCode" style="width:100%;padding:14px;border-radius:14px;border:1px solid #2a2f3a;background:#161b24;color:#fff;font-size:16px" placeholder="Код">
            <button id="inviteBtn" style="width:100%;margin-top:12px;min-height:56px;border-radius:16px;border:none;background:#2a7fff;color:#fff;font-weight:900;font-size:16px">Авторизоваться</button>
            <div id="inviteErr" style="display:none;color:#ff5a5a;margin-top:10px"></div>
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
          // автопереход в ЛК
          window.location.href = "/?autologin=1";
        } catch {
          err.style.display = "block";
          err.textContent = "Код неверный или уже использован.";
        } finally {
          btn.disabled = false;
          btn.textContent = "Авторизоваться";
        }
      };
      return;
    }

    document.body.innerHTML = `<div style="color:#fff;padding:30px;font-family:system-ui">Ошибка запуска. Перейдите в Telegram.</div>`;
    console.error(e);
  }
}

// start
boot().catch(console.error);
