const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const el = (id) => document.getElementById(id);

const avatarEl = el("avatar");
const balanceEl = el("balance");
const balanceBtn = el("balanceBtn");

const burger = el("burger");
const dropdown = el("dropdown");
const btnRefresh = el("btnRefresh");

const tariffNameEl = el("tariffName");
const tariffPriceEl = el("tariffPrice");
const nextPayEl = el("nextPay");

const vpnList = el("vpnList");

// Pages
const pageHome = el("pageHome");
const pageTariffs = el("pageTariffs");
const pageTopup = el("pageTopup");

el("backFromTariffs").addEventListener("click", () => showPage("home"));
el("backFromTopup").addEventListener("click", () => showPage("home"));

btnRefresh.addEventListener("click", () => {
  dropdown.style.display = "none";
  showPage("tariffs");
});

balanceBtn.addEventListener("click", () => {
  dropdown.style.display = "none";
  showPage("topup");
});

el("payStars").addEventListener("click", () => toast("Оплата звездами — заглушка"));
el("payCrypto").addEventListener("click", () => toast("Крипта — заглушка"));
el("payTransfer").addEventListener("click", () => toast("Перевод — заглушка"));

// Menu
burger.addEventListener("click", () => {
  dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu")) dropdown.style.display = "none";
});

// Bottom sheet
const sheet = el("sheet");
const sheetOverlay = el("sheetOverlay");
const sheetTitle = el("sheetTitle");
const sheetClose = el("sheetClose");
const configBox = el("configBox");
const configText = el("configText");

let currentConfig = "";

sheetOverlay.addEventListener("click", closeSheet);
sheetClose.addEventListener("click", closeSheet);

configBox.addEventListener("click", async () => {
  if (!currentConfig) return;
  await copyToClipboard(currentConfig);
  toast("Скопировано");
});

function openSheet({ title, config }) {
  sheetTitle.textContent = title || "Подключение";
  currentConfig = config || "";
  configText.textContent = currentConfig || "—";
  renderQR(currentConfig);

  sheet.classList.add("open");
  sheetOverlay.classList.add("open");
}

function closeSheet() {
  sheet.classList.remove("open");
  sheetOverlay.classList.remove("open");
}

function renderQR(text) {
  const qrWrap = document.getElementById("qr");
  qrWrap.innerHTML = "";
  if (!window.QRCode) {
    const d = document.createElement("div");
    d.style.color = "#000";
    d.style.fontFamily = "monospace";
    d.textContent = "QR lib не загрузилась";
    qrWrap.appendChild(d);
    return;
  }
  new QRCode(qrWrap, { text: text || "empty", width: 180, height: 180 });
}

function showPage(name) {
  pageHome.classList.remove("page-active");
  pageTariffs.classList.remove("page-active");
  pageTopup.classList.remove("page-active");

  if (name === "home") pageHome.classList.add("page-active");
  if (name === "tariffs") pageTariffs.classList.add("page-active");
  if (name === "topup") pageTopup.classList.add("page-active");
}

function setTariffUI(name, priceText, nextDate) {
  tariffNameEl.textContent = name;
  tariffPriceEl.textContent = priceText;
  nextPayEl.textContent = `Следующее списание: ${nextDate}`;
}

function setAvatarLetterFromTelegram() {
  const user = tg?.initDataUnsafe?.user;
  const firstName = user?.first_name || "";
  const letter = (firstName.trim()[0] || "U").toUpperCase();
  avatarEl.textContent = letter;
}

function formatRub(amount) {
  const n = Number(amount || 0);
  return `${n.toFixed(2)} ₽`;
}

async function apiGet(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.json();
}

async function loadAll() {
  setAvatarLetterFromTelegram();

  const user = await apiGet("/api/user");
  balanceEl.textContent = formatRub(user.balance_rub);
  setTariffUI(user.tariff_name, user.tariff_price_text, user.next_charge);

  const vpns = await apiGet("/api/vpn");
  renderVpnList(vpns);

  const tariffs = await apiGet("/api/tariffs");
  renderTariffs(tariffs);
}

function renderTariffs(tariffs) {
  const wrap = document.getElementById("tariffCards");
  wrap.innerHTML = "";

  tariffs.forEach(t => {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.type = "button";
    btn.innerHTML = `
      <div class="cardTitle">${t.months} ${pluralMonths(t.months)}</div>
      <div class="cardValue">${t.price_rub} ₽</div>
    `;
    btn.addEventListener("click", () => {
      // заглушка: просто отражаем в меню выбранное
      if (t.months === 1) setTariffUI("Basic", "150 ₽/мес", "01.01.2026");
      if (t.months === 6) setTariffUI("Half-year", "700 ₽/6 мес", "01.01.2026");
      if (t.months === 12) setTariffUI("Year", "1200 ₽/12 мес", "01.01.2026");
      showPage("home");
      toast("Тариф выбран (заглушка)");
    });

    wrap.appendChild(btn);
  });
}

function pluralMonths(n) {
  // 1 месяц, 6 месяцев, 12 месяцев
  if (n % 10 === 1 && n % 100 !== 11) return "месяц";
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return "месяца";
  return "месяцев";
}

function renderVpnList(vpns) {
  vpnList.innerHTML = "";
  vpns.forEach(v => {
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
      openSheet({ title: `Подключение: ${v.name}`, config: v.config });
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

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  }
}

function toast(text) {
  if (tg?.showToast) tg.showToast({ message: text });
  else console.log("[toast]", text);
}

loadAll().catch(err => {
  console.error(err);
  toast("Ошибка загрузки данных");
});
