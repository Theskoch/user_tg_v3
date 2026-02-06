const tg = window.Telegram?.WebApp;

const el = (id) => document.getElementById(id);
const show = (id) => (el(id).style.display = "");
const hide = (id) => (el(id).style.display = "none");

function isTelegram() {
  return !!(tg && tg.initData);
}

function letter() {
  const u = tg?.initDataUnsafe?.user;
  return ((u?.first_name || "U")[0] || "U").toUpperCase();
}

function activeFlag(v) { return Number(v) === 1; }

async function api(path, payload = {}) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData: tg?.initData || "", ...payload }),
    cache: "no-store",
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    const e = new Error(`${path} ${r.status} ${t}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

function setPage(id) {
  ["pageHome", "pageTopup", "pageAdmin", "pageAdminUser"].forEach((p) =>
    el(p).classList.remove("page-active")
  );
  el(id).classList.add("page-active");
}

function setMenu(open) {
  el("dropdown").style.display = open ? "block" : "none";
}

// ---------- Copy helper (works in TG webview) ----------
async function copyTextSmart(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ---------- Sheet view (QR + copy) ----------
function openSheet(title, text) {
  el("sheetTitle").textContent = title || "Конфиг";
  el("sheetText").textContent = text || "";

  const qr = el("qrWrap");
  qr.innerHTML = "";
  if (window.QRCode && text) {
    try {
      new QRCode(qr, { text, width: 180, height: 180 });
    } catch {
      qr.innerHTML = `<div class="muted small">QR не удалось отрисовать</div>`;
    }
  }

  show("sheetOverlay");
  show("sheet");
}

function closeSheet() {
  hide("sheetOverlay");
  hide("sheet");
}

async function refreshMyConfigs() {
  const cfgs = await api("/api/my_configs");
  const box = el("myConfigs");
  box.innerHTML = "";

  if (!cfgs || cfgs.length === 0) {
    box.innerHTML = `<div class="muted small">Пока нет подключений</div>`;
    return;
  }

  cfgs.forEach((c) => {
    const active = activeFlag(c.is_active);
    const div = document.createElement("div");
    div.className = "item";
    if (!active) div.style.opacity = "0.55";
    div.innerHTML = `
      <div class="itemRow">
        <div class="itemTitle">${c.title}</div>
        <div class="tag">${active ? "active" : "blocked"}</div>
      </div>
      <div class="itemSub">${active ? "Нажмите чтобы открыть" : "Заблокировано"}</div>
    `;
    div.onclick = () => {
      if (!active) return;
      openSheet(c.title, c.config_text);
    };
    box.appendChild(div);
  });
}

// ---------- Invite flow (unregistered) ----------
async function redeemCode() {
  const code = (el("inviteInput").value || "").trim();
  el("inviteErr").style.display = "none";

  if (!code) {
    el("inviteErr").textContent = "Введите код.";
    el("inviteErr").style.display = "block";
    return;
  }

  el("inviteBtn").disabled = true;
  el("inviteBtn").textContent = "Проверяем…";

  try {
    await api("/api/redeem", { code, invite_code: code });
    await bootAuthed(); // авто переход в ЛК без перезапуска
  } catch (e) {
    el("inviteErr").textContent = "Код неверный или уже использован.";
    el("inviteErr").style.display = "block";
  } finally {
    el("inviteBtn").disabled = false;
    el("inviteBtn").textContent = "Авторизоваться";
  }
}

// ---------- Admin ----------
let ME = null;
let TARIFFS = [];
let USERS = [];
let ADMIN_SELECTED = null;
let LAST_INVITE_CODE = "";

async function loadTariffs() {
  const r = await api("/api/tariffs");
  TARIFFS = r.tariffs || [];
}

function fillTariffSelect(currentId) {
  el("adminTariffSelect").innerHTML = TARIFFS
    .map((t) => `<option value="${t.id}">${t.name} — ${t.price_rub} ₽ / ${t.period_months} мес</option>`)
    .join("");
  if (currentId) el("adminTariffSelect").value = String(currentId);
}

function findTariffName(id) {
  const t = TARIFFS.find((x) => Number(x.id) === Number(id));
  return t ? t.name : "—";
}

function renderUsers() {
  const box = el("adminUsers");
  box.innerHTML = "";
  USERS.forEach((u) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemRow">
        <div class="itemTitle">${u.first_name || ""} <span class="muted small">@${u.username || ""}</span></div>
        <div class="tag">${u.role}</div>
      </div>
      <div class="itemSub">${Number(u.balance_rub).toFixed(2)} ₽ • ${u.tariff_name || "—"}</div>
    `;
    div.onclick = async () => {
      ADMIN_SELECTED = u;
      await openAdminUser(u);
    };
    box.appendChild(div);
  });

  if (USERS.length === 0) box.innerHTML = `<div class="muted small">Пользователей нет</div>`;
}

async function openAdmin() {
  setPage("pageAdmin");
  // обновить список пользователей каждый раз
  USERS = await api("/api/admin/users");
  renderUsers();
}

async function refreshAdminConfigs() {
  const cfgs = await api("/api/admin/configs/list", { target_tg_user_id: ADMIN_SELECTED.tg_user_id });
  const box = el("adminConfigs");
  box.innerHTML = "";

  cfgs.forEach((c) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemRow">
        <div class="itemTitle">${c.title}</div>
        <div class="tag">id:${c.id}</div>
      </div>
      <div class="itemSub">${(c.config_text || "").slice(0, 110)}${(c.config_text || "").length > 110 ? "…" : ""}</div>
      <div class="row" style="margin-top:10px">
        <button class="btn ghost" type="button" data-open>Открыть</button>
        <button class="btn danger" type="button" data-del>Удалить</button>
      </div>
    `;

    // open like user
    div.querySelector("[data-open]").onclick = (e) => {
      e.stopPropagation();
      openSheet(c.title, c.config_text);
    };
    div.onclick = () => openSheet(c.title, c.config_text);

    div.querySelector("[data-del]").onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Удалить коннект?")) return;
      await api("/api/admin/configs/delete", {
        target_tg_user_id: ADMIN_SELECTED.tg_user_id,
        config_id: c.id,
      });
      await refreshAdminConfigs();
    };

    box.appendChild(div);
  });

  if (cfgs.length === 0) box.innerHTML = `<div class="muted small">Нет коннектов</div>`;
}

async function openAdminUser(u) {
  setPage("pageAdminUser");

  el("adminUserTitle").textContent = `${u.first_name || "User"} @${u.username || ""}`;

  // tariff
  el("adminTariffNow").textContent = u.tariff_name || "—";
  fillTariffSelect(u.tariff_id);

  // balance
  el("adminBalanceNow").textContent = `${Number(u.balance_rub).toFixed(2)} ₽`;
  el("adminBalanceInput").value = String(u.balance_rub ?? "");

  await refreshAdminConfigs();
}

// ---------- Add config panel + QR scan ----------
let qrStream = null;
let qrRaf = null;

function openAddPanel() {
  el("addText").value = "";
  el("addErr").style.display = "none";
  show("addModal");
  show("addPanel");
}
function closeAddPanel() {
  hide("addModal");
  hide("addPanel");
}

async function saveConfig() {
  const txt = (el("addText").value || "").trim();
  el("addErr").style.display = "none";
  if (!txt) {
    el("addErr").textContent = "Пусто.";
    el("addErr").style.display = "block";
    return;
  }
  await api("/api/admin/configs/add", {
    target_tg_user_id: ADMIN_SELECTED.tg_user_id,
    title: "Config",
    config_text: txt,
  });
  closeAddPanel();
  await refreshAdminConfigs();
}

async function openQrScanner() {
  show("qrModal");
  show("qrPanel");
  el("qrHint").textContent = "Наведи камеру на QR";

  const video = el("qrVideo");
  const canvas = el("qrCanvas");
  const ctx = canvas.getContext("2d");

  try {
    qrStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
  } catch {
    el("qrHint").textContent = "Нет доступа к камере";
    return;
  }

  video.srcObject = qrStream;
  await video.play();

  const tick = () => {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code?.data) {
        el("addText").value = code.data;
        closeQrScanner();
        return;
      }
    }
    qrRaf = requestAnimationFrame(tick);
  };
  qrRaf = requestAnimationFrame(tick);
}

function closeQrScanner() {
  hide("qrModal");
  hide("qrPanel");
  if (qrRaf) cancelAnimationFrame(qrRaf);
  qrRaf = null;
  if (qrStream) qrStream.getTracks().forEach((t) => t.stop());
  qrStream = null;
}

// ---------- Admin invites UI (show + copy) ----------
function showInviteGenError(msg) {
  el("inviteGenErr").textContent = msg;
  el("inviteGenErr").style.display = "block";
}
function clearInviteGenError() {
  el("inviteGenErr").textContent = "";
  el("inviteGenErr").style.display = "none";
}

async function generateInvite(role) {
  clearInviteGenError();
  el("inviteCodeValue").textContent = "Генерируем…";
  LAST_INVITE_CODE = "";
  try {
    const r = await api("/api/admin/invite", { role });
    LAST_INVITE_CODE = r.code;
    el("inviteCodeValue").textContent = r.code;
  } catch (e) {
    console.error(e);
    el("inviteCodeValue").textContent = "—";
    showInviteGenError("Ошибка генерации (проверь роль admin / initData / BOT_TOKEN).");
  }
}

// ---------- Boot ----------
async function bootAuthed() {
  hide("inviteScreen");
  hide("notTelegram");
  show("app");

  el("avatar").textContent = letter();
  await loadTariffs();

  const r = await api("/api/auth");
  ME = r.me;

  el("balanceVal").textContent = `${Number(ME.balance_rub).toFixed(2)} ₽`;
  el("roleBadge").textContent = ME.role;

  el("tariffName").textContent = ME.tariff?.name || "—";
  el("tariffPrice").textContent = ME.tariff ? `${ME.tariff.price_rub} ₽ / ${ME.tariff.period_months} мес` : "—";

  await refreshMyConfigs();

  // admin menu button
  el("adminMenuBtn").style.display = ME.role === "admin" ? "" : "none";

  setPage("pageHome");
}

async function boot() {
  if (!isTelegram()) {
    hide("app");
    hide("inviteScreen");
    show("notTelegram");
    return;
  }

  if (tg) { tg.ready(); tg.expand(); }

  // menu
  el("burger").onclick = (e) => {
    e.stopPropagation();
    setMenu(el("dropdown").style.display !== "block");
  };
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu")) setMenu(false);
  });

  // sheet
  el("sheetOverlay").onclick = closeSheet;
  el("closeSheet").onclick = closeSheet;
  el("cfgTextBox").onclick = async () => {
    const txt = el("sheetText").textContent || "";
    if (!txt.trim()) return;
    await copyTextSmart(txt);
  };

  // nav
  el("topupMenuBtn").onclick = () => { setMenu(false); setPage("pageTopup"); };
  el("backFromTopup").onclick = () => setPage("pageHome");
  el("balanceBtn").onclick = () => setPage("pageTopup");

  el("adminMenuBtn").onclick = async () => { setMenu(false); await openAdmin(); };
  el("backFromAdmin").onclick = () => setPage("pageHome");
  el("backFromAdminUser").onclick = () => setPage("pageAdmin");

  // invite screen
  el("inviteBtn").onclick = redeemCode;

  // admin invites
  el("inviteUserBtn").onclick = () => generateInvite("user");
  el("inviteAdminBtn").onclick = () => generateInvite("admin");
  el("copyInviteBtn").onclick = async () => {
    clearInviteGenError();
    if (!LAST_INVITE_CODE) {
      showInviteGenError("Сначала сгенерируйте код.");
      return;
    }
    const ok = await copyTextSmart(LAST_INVITE_CODE);
    if (!ok) showInviteGenError("Не удалось скопировать. Скопируйте вручную.");
    else {
      const b = el("copyInviteBtn");
      const old = b.textContent;
      b.textContent = "Скопировано ✓";
      setTimeout(() => (b.textContent = old), 1200);
    }
  };

  // admin user actions
  el("adminSaveTariff").onclick = async () => {
    el("adminTariffErr").style.display = "none";
    const tariff_id = Number(el("adminTariffSelect").value);
    try {
      await api("/api/admin/user/set_tariff", { target_tg_user_id: ADMIN_SELECTED.tg_user_id, tariff_id });
      ADMIN_SELECTED.tariff_id = tariff_id;
      ADMIN_SELECTED.tariff_name = findTariffName(tariff_id);
      el("adminTariffNow").textContent = ADMIN_SELECTED.tariff_name;

      USERS = await api("/api/admin/users");
      renderUsers();
    } catch {
      el("adminTariffErr").textContent = "Ошибка сохранения тарифа";
      el("adminTariffErr").style.display = "block";
    }
  };

  el("adminSaveBalance").onclick = async () => {
    el("adminBalanceErr").style.display = "none";
    const val = Number(el("adminBalanceInput").value);
    if (Number.isNaN(val)) {
      el("adminBalanceErr").textContent = "Баланс должен быть числом";
      el("adminBalanceErr").style.display = "block";
      return;
    }
    try {
      await api("/api/admin/user/set_balance", { target_tg_user_id: ADMIN_SELECTED.tg_user_id, balance_rub: val });
      ADMIN_SELECTED.balance_rub = val;
      el("adminBalanceNow").textContent = `${val.toFixed(2)} ₽`;

      USERS = await api("/api/admin/users");
      renderUsers();

      if (ME && Number(ME.tg_user_id) === Number(ADMIN_SELECTED.tg_user_id)) {
        el("balanceVal").textContent = `${val.toFixed(2)} ₽`;
      }
    } catch {
      el("adminBalanceErr").textContent = "Ошибка сохранения баланса";
      el("adminBalanceErr").style.display = "block";
    }
  };

  el("deleteUserBtn").onclick = async () => {
    if (!confirm("Удалить пользователя?")) return;
    await api("/api/admin/user/delete", { target_tg_user_id: ADMIN_SELECTED.tg_user_id });
    setPage("pageAdmin");
    USERS = await api("/api/admin/users");
    renderUsers();
  };

  // add config UI
  el("addConnBtn").onclick = openAddPanel;
  el("addModal").onclick = closeAddPanel;
  el("cancelAdd").onclick = closeAddPanel;
  el("saveBtn").onclick = saveConfig;
  el("scanBtn").onclick = openQrScanner;

  el("qrModal").onclick = closeQrScanner;
  el("closeQr").onclick = closeQrScanner;

  // try auth
  try {
    await bootAuthed();
  } catch (e) {
    if (e.status === 403) {
      hide("app");
      show("inviteScreen");
      return;
    }
    hide("app");
    show("notTelegram");
  }
}

boot();
