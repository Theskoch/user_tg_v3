const tg = window.Telegram?.WebApp;

// ---------- helpers ----------
const el = (id) => document.getElementById(id);
const show = (id) => { el(id).style.display = ""; };
const hide = (id) => { el(id).style.display = "none"; };

function isTelegram() {
  return !!(tg && tg.initData);
}

function getUserLetter() {
  const u = tg?.initDataUnsafe?.user;
  return ((u?.first_name || "U")[0] || "U").toUpperCase();
}

function activeFlag(v){ return Number(v) === 1; }

async function api(path, payload = {}) {
  const r = await fetch(path, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ initData: tg?.initData || "", ...payload }),
    cache:"no-store"
  });
  if (!r.ok) {
    const t = await r.text().catch(()=> "");
    const e = new Error(`${path} ${r.status} ${t}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

function setPage(name){
  ["pageHome","pageTopup","pageAdmin","pageAdminUser"].forEach(p=>el(p).classList.remove("page-active"));
  el(name).classList.add("page-active");
}

// ---------- UI: menu ----------
function wireMenu(){
  el("burger").onclick = (e) => {
    e.stopPropagation();
    el("dropdown").style.display = (el("dropdown").style.display === "block") ? "none" : "block";
  };
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu")) el("dropdown").style.display = "none";
  });
}

// ---------- Sheet view ----------
function openSheet(title, text){
  el("sheetTitle").textContent = title || "Конфиг";
  el("sheetText").textContent = text || "";
  el("qrWrap").innerHTML = ""; // QR необязательно: часто конфиги уже QR-строкой у клиента

  show("sheetOverlay"); show("sheet");
}
function closeSheet(){ hide("sheetOverlay"); hide("sheet"); }

el("sheetOverlay").onclick = closeSheet;
el("closeSheet").onclick = closeSheet;
el("cfgTextBox").onclick = async () => {
  const txt = el("sheetText").textContent || "";
  if (!txt.trim()) return;
  try { await navigator.clipboard.writeText(txt); } catch {}
};

// ---------- Invite ----------
async function redeemFlow(){
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
    await api("/api/redeem", { code, invite_code: code }); // шлём оба ключа
    // автопереход в ЛК: просто повторно запрашиваем auth
    await bootAuthed();
  } catch (e) {
    el("inviteErr").textContent = "Код неверный или уже использован.";
    el("inviteErr").style.display = "block";
  } finally {
    el("inviteBtn").disabled = false;
    el("inviteBtn").textContent = "Авторизоваться";
  }
}

// ---------- render home configs ----------
function renderMyConfigs(cfgs){
  const box = el("myConfigs");
  box.innerHTML = "";
  if (!cfgs || cfgs.length === 0) {
    box.innerHTML = `<div class="muted small">Пока нет подключений</div>`;
    return;
  }

  cfgs.forEach(c=>{
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

// ---------- Admin UI ----------
let ME = null;
let TARIFFS = [];
let ADMIN_SELECTED = null;

async function loadTariffs(){
  const r = await api("/api/tariffs");
  TARIFFS = r.tariffs || [];
}

function fillTariffsSelect(currentTariffId){
  const s = el("adminTariffSelect");
  s.innerHTML = TARIFFS.map(t => `<option value="${t.id}">${t.name} — ${t.price_rub} ₽ / ${t.period_months} мес</option>`).join("");
  if (currentTariffId) s.value = String(currentTariffId);
}

function renderUsers(users){
  const box = el("adminUsers");
  box.innerHTML = "";
  users.forEach(u=>{
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemRow">
        <div class="itemTitle">${u.first_name || ""} <span class="muted small">@${u.username || ""}</span></div>
        <div class="tag">${u.role}</div>
      </div>
      <div class="itemSub">${u.balance_rub} ₽ • ${u.tariff_name || "—"}</div>
    `;
    div.onclick = async () => {
      ADMIN_SELECTED = u;
      await openAdminUser(u);
    };
    box.appendChild(div);
  });
}

async function openAdmin(){
  // скрываем topbar в админке как ты хотел
  hide("topbar");
  setPage("pageAdmin");

  const users = await api("/api/admin/users");
  renderUsers(users);
}

async function openAdminUser(u){
  hide("topbar");
  setPage("pageAdminUser");

  el("adminUserTitle").textContent = `${u.first_name || "User"} @${u.username || ""}`;

  // tariff
  el("adminTariffNow").textContent = u.tariff_name || "—";
  fillTariffsSelect(u.tariff_id);

  // balance
  el("adminBalanceNow").textContent = `${Number(u.balance_rub).toFixed(2)} ₽`;
  el("adminBalanceInput").value = String(u.balance_rub ?? "");

  // configs
  await refreshAdminConfigs();
}

async function refreshAdminConfigs(){
  const cfgs = await api("/api/admin/configs/list", { target_tg_user_id: ADMIN_SELECTED.tg_user_id });
  const box = el("adminConfigs");
  box.innerHTML = "";

  cfgs.forEach(c=>{
    const active = activeFlag(c.is_active);
    const div = document.createElement("div");
    div.className = "item";
    if (!active) div.style.opacity = "0.6";

    div.innerHTML = `
      <div class="itemRow">
        <div class="itemTitle">${c.title}</div>
        <div class="tag">${active ? "active" : "blocked"}</div>
      </div>
      <div class="itemSub">${(c.config_text || "").slice(0,120)}${(c.config_text||"").length>120?"…":""}</div>

      <div class="row" style="margin-top:10px">
        <button class="btn ghost" data-open>Открыть</button>
        <button class="btn danger" data-del>Удалить</button>
      </div>
    `;

    div.querySelector("[data-open]").onclick = (e)=>{ e.stopPropagation(); openSheet(c.title, c.config_text); };
    div.querySelector("[data-del]").onclick = async (e)=>{
      e.stopPropagation();
      if (!confirm("Удалить коннект?")) return;
      const r = await api("/api/admin/configs/delete", { target_tg_user_id: ADMIN_SELECTED.tg_user_id, config_id: c.id });
      // если changed==0 — значит ты пытался удалить не тот id или tg_user_id, но тут всё корректно
      await refreshAdminConfigs();
    };

    // по нажатию на сам item — тоже открыть как у пользователя
    div.onclick = ()=> openSheet(c.title, c.config_text);

    box.appendChild(div);
  });

  if (cfgs.length === 0) box.innerHTML = `<div class="muted small">Нет коннектов</div>`;
}

// ---------- Add config modal ----------
function openAddPanel(){
  show("addModal"); show("addPanel");
  el("addText").value = "";
  el("addErr").style.display = "none";
}
function closeAddPanel(){
  hide("addModal"); hide("addPanel");
}
el("addModal").onclick = closeAddPanel;
el("cancelAdd").onclick = closeAddPanel;

async function saveNewConfig(){
  const txt = (el("addText").value || "").trim();
  if (!txt) {
    el("addErr").textContent = "Пусто.";
    el("addErr").style.display = "block";
    return;
  }
  await api("/api/admin/configs/add", {
    target_tg_user_id: ADMIN_SELECTED.tg_user_id,
    title: "Config",
    config_text: txt
  });
  closeAddPanel();
  await refreshAdminConfigs();
}

// ---------- QR Scanner ----------
let qrStream = null;
let qrRaf = null;

async function openQrScanner(){
  show("qrModal"); show("qrPanel");
  el("qrHint").textContent = "Наведи камеру на QR";

  const video = el("qrVideo");
  const canvas = el("qrCanvas");
  const ctx = canvas.getContext("2d");

  qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
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

function closeQrScanner(){
  hide("qrModal"); hide("qrPanel");
  if (qrRaf) cancelAnimationFrame(qrRaf);
  qrRaf = null;
  if (qrStream) qrStream.getTracks().forEach(t=>t.stop());
  qrStream = null;
}

el("qrModal").onclick = closeQrScanner;
el("closeQr").onclick = closeQrScanner;

// ---------- Boot flows ----------
async function bootAuthed(){
  hide("inviteScreen");
  hide("notTelegram");
  show("app");
  show("topbar");

  // avatar
  el("avatar").textContent = getUserLetter();

  // tariffs
  await loadTariffs();

  // auth
  const r = await api("/api/auth");
  ME = r.me;

  el("balanceVal").textContent = `${Number(ME.balance_rub).toFixed(2)} ₽`;

  el("tariffName").textContent = ME.tariff?.name || "—";
  el("tariffPrice").textContent = ME.tariff ? `${ME.tariff.price_rub} ₽ / ${ME.tariff.period_months} мес` : "—";
  el("tariffBadge").textContent = ME.role === "admin" ? "admin" : "user";

  // my configs
  const myCfgs = await api("/api/my_configs");
  renderMyConfigs(myCfgs);

  // admin button
  el("adminMenuBtn").style.display = (ME.role === "admin") ? "" : "none";

  setPage("pageHome");
}

async function boot(){
  if (!isTelegram()){
    hide("app");
    hide("inviteScreen");
    show("notTelegram");
    return;
  }

  // menu wiring
  wireMenu();

  el("topupMenuBtn").onclick = ()=> { el("dropdown").style.display="none"; setPage("pageTopup"); };
  el("backFromTopup").onclick = ()=> setPage("pageHome");
  el("balanceBtn").onclick = ()=> setPage("pageTopup");

  el("adminMenuBtn").onclick = async ()=> { el("dropdown").style.display="none"; await openAdmin(); };

  el("backFromAdmin").onclick = ()=> { show("topbar"); setPage("pageHome"); };
  el("backFromAdminUser").onclick = ()=> setPage("pageAdmin");

  // admin actions
  el("inviteUserBtn").onclick = async ()=> {
    const r = await api("/api/admin/invite", { role:"user" });
    await navigator.clipboard.writeText(r.code).catch(()=>{});
  };
  el("inviteAdminBtn").onclick = async ()=> {
    const r = await api("/api/admin/invite", { role:"admin" });
    await navigator.clipboard.writeText(r.code).catch(()=>{});
  };

  // invite
  el("inviteBtn").onclick = redeemFlow;

  // admin detail actions
  el("adminSaveTariff").onclick = async ()=> {
    el("adminTariffErr").style.display="none";
    const tariff_id = Number(el("adminTariffSelect").value);
    try {
      await api("/api/admin/user/set_tariff", { target_tg_user_id: ADMIN_SELECTED.tg_user_id, tariff_id });
      const chosen = TARIFFS.find(t=>Number(t.id)===tariff_id);
      el("adminTariffNow").textContent = chosen ? chosen.name : "—";
      // обновить везде
      ADMIN_SELECTED.tariff_id = tariff_id;
      ADMIN_SELECTED.tariff_name = chosen?.name || ADMIN_SELECTED.tariff_name;
      const users = await api("/api/admin/users"); // чтобы список тоже обновился
      renderUsers(users);
    } catch {
      el("adminTariffErr").textContent="Ошибка сохранения тарифа";
      el("adminTariffErr").style.display="block";
    }
  };

  el("adminSaveBalance").onclick = async ()=> {
    el("adminBalanceErr").style.display="none";
    const val = Number(el("adminBalanceInput").value);
    if (Number.isNaN(val)) {
      el("adminBalanceErr").textContent="Баланс должен быть числом";
      el("adminBalanceErr").style.display="block";
      return;
    }
    try {
      await api("/api/admin/user/set_balance", { target_tg_user_id: ADMIN_SELECTED.tg_user_id, balance_rub: val });
      el("adminBalanceNow").textContent = `${val.toFixed(2)} ₽`;
      ADMIN_SELECTED.balance_rub = val;

      // обновить список пользователей и если это я — обновить topbar баланс
      const users = await api("/api/admin/users");
      renderUsers(users);

      if (ME && Number(ME.tg_user_id) === Number(ADMIN_SELECTED.tg_user_id)) {
        el("balanceVal").textContent = `${val.toFixed(2)} ₽`;
      }
    } catch {
      el("adminBalanceErr").textContent="Ошибка сохранения баланса";
      el("adminBalanceErr").style.display="block";
    }
  };

  el("deleteUserBtn").onclick = async ()=> {
    if (!confirm("Удалить пользователя?")) return;
    await api("/api/admin/user/delete", { target_tg_user_id: ADMIN_SELECTED.tg_user_id });
    setPage("pageAdmin");
    const users = await api("/api/admin/users");
    renderUsers(users);
  };

  el("addConnBtn").onclick = openAddPanel;
  el("saveBtn").onclick = saveNewConfig;
  el("scanBtn").onclick = openQrScanner;

  // try auth
  try {
    await bootAuthed();
  } catch (e) {
    if (e.status === 403) {
      hide("app");
      show("inviteScreen");
      return;
    }
    // 401/other → tg only error
    hide("app");
    show("notTelegram");
  }
}

boot();
