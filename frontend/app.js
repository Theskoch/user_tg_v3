const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showBlockingMessage(text) {
  document.body.innerHTML = `
    <div style="padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#fff;background:#0e1014;min-height:100vh">
      <div style="max-width:520px;margin:40px auto">
        <div style="font-size:18px;font-weight:800;margin-bottom:8px">Ошибка</div>
        <div style="opacity:.85;line-height:1.4">${escapeHtml(text)}</div>
      </div>
    </div>
  `;
}

function mustBeInTelegram() {
  if (!tg || !tg.initData) {
    showBlockingMessage("Ошибка запуска. Перейдите в Telegram.");
    throw new Error("Not in Telegram");
  }
}

const el = (id) => document.getElementById(id);

async function apiPost(path) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ initData: tg.initData })
  });

  if (!r.ok) {
    const err = new Error(`${path} -> ${r.status}`);
    err.httpStatus = r.status;
    throw err;
  }
  return r.json();
}

function toast(text) {
  if (tg?.showToast) tg.showToast({ message: text });
  else console.log("[toast]", text);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  }
}

// ---------- UI elements ----------
const avatarEl = el("avatar");
const balanceEl = el("balance");
const balanceBtn = el("balanceBtn");

const burger = el("burger");
const dropdown = el("dropdown");
const btnRefresh = el("btnRefresh");

const tariffNameEl = el("tariffName");
const tariffPriceEl = el("tariffPrice");
const nextPayEl = el("nextPay");

const vpnList = el("vpnList"); // можно позже переименовать в list
const tariffCardsWrap = el("tariffCards");

// Pages
const pageHome = el("pageHome");
const pageTariffs = el("pageTariffs");
const pageTopup = el("pageTopup");

el("backFromTariffs")?.addEventListener("click", () => showPage("home"));
el("backFromTopup")?.addEventListener("click", () => showPage("home"));

burger?.addEventListener("click", () => {
  dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu")) dropdown.style.display = "none";
});

btnRefresh?.addEventListener("click", () => {
  dropdown.style.display = "none";
  showPage("tariffs");
});

balanceBtn?.addEventListener("click", () => {
  dropdown.style.display = "none";
  showPage("topup");
});

el("payStars")?.addEventListener("click", () => toast("Заглушка"));
el("payCrypto")?.addEventListener("click", () => toast("Заглушка"));
el("payTransfer")?.addEventListener("click", () => toast("Заглушка"));

// Bottom sheet (оставляем функционал как есть)
const sheet = el("sheet");
const sheetOverlay = el("sheetOverlay");
const sheetTitle = el("sheetTitle");
const sheetClose = el("sheetClose");
const configBox = el("configBox");
const configText = el("configText");

let currentConfig = "";

sheetOverlay?.addEventListener("click", closeSheet);
sheetClose?.addEventListener("click", closeSheet);

configBox?.addEventListener("click", async () => {
  if (!currentConfig) return;
  await copyToClipboard(currentConfig);
  toast("Скопировано");
});

function openSheet({ title, config }) {
  if (sheetTitle) sheetTitle.textContent = title || "Подключение";
  currentConfig = config || "";
  if (configText) configText.textContent = currentConfig || "—";
  renderQR(currentConfig);

  sheet?.classList.add("open");
  sheetOverlay?.classList.add("open");
}

function closeSheet() {
  sheet?.classList.remove("open");
  sheetOverlay?.classList.remove("open");
}

function renderQR(text) {
  const qrWrap = document.getElementById("qr");
  if (!qrWrap) return;
  qrWrap.innerHTML = "";

  if (!window.QRCode) {
    const d = document.createElement("div");
    d.style.color = "#000";
    d.style.fontFamily = "monospace";
    d.style.fontSize = "12px";
    d.textContent = "QR lib не загрузилась";
    qrWrap.appendChild(d);
    return;
  }

  new QRCode(qrWrap, { text: text || "empty", width: 180, height: 180 });
}

// ---------- UI helpers ----------
function showPage(name) {
  pageHome?.classList.remove("page-active");
  pageTariffs?.classList.remove("page-active");
  pageTopup?.classList.remove("page-active");

  if (name === "home") pageHome?.classList.add("page-active");
  if (name === "tariffs") pageTariffs?.classList.add("page-active");
  if (name === "topup") pageTopup?.classList.add("page-active");
}

function setAvatarLetterFromTelegram() {
  const user = tg?.initDataUnsafe?.user;
  const firstName = user?.first_name || "";
  const letter = (firstName.trim()[0] || "U").toUpperCase();
  if (avatarEl) avatarEl.textContent = letter;
}

function formatRub(amount) {
  const n = Number(amount || 0);
  return `${n.toFixed(2)} ₽`;
}

function setTariffUI(name, priceText, nextDate) {
  if (tariffNameEl) tariffNameEl.textContent = name || "—";
  if (tariffPriceEl) tariffPriceEl.textContent = priceText || "—";
  if (nextPayEl) nextPayEl.textContent = `Следующее списание: ${nextDate || "—"}`;
}

// ---------- Renders ----------
function renderList(items) {
  // пока оставим существующий контейнер vpnList, но можно переименовать позже
  if (!vpnList) return;
  vpnList.innerHTML = "";

  (items || []).forEach(v => {
    const row = document.createElement("div");
    row.className = "vpn";

    const left = document.createElement("div");
    left.className = "vpnLeft";
    left.innerHTML = `
      <b>${escapeHtml(v.name)}</b>
      <small>до ${escapeHtml(v.expires)}</small>
    `;

    const badge = document.createElement("span");
    badge.className = `badge ${v.status}`;
    badge.textContent = v.status === "online" ? "online" : "offline";

    const btn = document.createElement("button");
    btn.className = "connectBtn";
    btn.type = "button";
    btn.textContent = "Подключить";
    btn.addEventListener("click", () => {
      openSheet({
        title: `${v.name}`,
        config: v.config
      });
    });

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "10px";
    right.appendChild(badge);
    right.appendChild(btn);

    row.appendChild(left);
    row.appendChild(right);

    vpnList.appendChild(row);
  });
}

function renderTariffs(tariffs) {
  if (!tariffCardsWrap) return;
  tariffCardsWrap.innerHTML = "";

  (tariffs || []).forEach(t => {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.type = "button";
    btn.innerHTML = `
      <div class="cardTitle">${t.months} ${pluralMonths(t.months)}</div>
      <div class="cardValue">${t.price_rub} ₽</div>
    `;
    btn.addEventListener("click", () => {
      if (t.months === 1) setTariffUI("Basic", "150 ₽/мес", "01.01.2026");
      if (t.months === 6) setTariffUI("Half-year", "700 ₽/6 мес", "01.01.2026");
      if (t.months === 12) setTariffUI("Year", "1200 ₽/12 мес", "01.01.2026");
      showPage("home");
      toast("Готово");
    });
    tariffCardsWrap.appendChild(btn);
  });
}

function pluralMonths(n) {
  if (n % 10 === 1 && n % 100 !== 11) return "месяц";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "месяца";
  return "месяцев";
}

// ---------- Boot ----------
async function run() {
  mustBeInTelegram();
  setAvatarLetterFromTelegram();

  // AUTH
  try {
    await apiPost("/api/auth");
  } catch (err) {
    if (err.httpStatus === 403) {
      showBlockingMessage("У вас отсутствует доступ.");
      return;
    }
    showBlockingMessage("Ошибка запуска. Перейдите в Telegram.");
    console.error(err);
    return;
  }

  // USER
  const user = await apiPost("/api/user");
  if (balanceEl) balanceEl.textContent = formatRub(user.balance_rub);
  setTariffUI(user.tariff_name, user.tariff_price_text, user.next_charge);

  // LIST (пока те же данные, позже переименуем endpoint/поля)
  const items = await apiPost("/api/vpn");
  renderList(items);

  // TARIFFS
  const tariffs = await apiPost("/api/tariffs");
  renderTariffs(tariffs);

  showPage("home");
}

run().catch((e) => {
  console.error(e);
  showBlockingMessage("Ошибка запуска. Перейдите в Telegram.");
});
