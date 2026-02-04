const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

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

const backFromTariffs = el("backFromTariffs");
const backFromTopup = el("backFromTopup");

// Tariff cards
document.querySelectorAll("[data-tariff]").forEach(btn => {
  btn.addEventListener("click", () => {
    const m = btn.getAttribute("data-tariff");
    // Заглушка: меняем тариф в UI
    if (m === "1") setTariffUI("Basic", "150 ₽/мес", "01.01.2026");
    if (m === "6") setTariffUI("Half-year", "700 ₽/6 мес", "01.01.2026");
    if (m === "12") setTariffUI("Year", "1200 ₽/12 мес", "01.01.2026");
    showPage("home");
    toast("Тариф выбран (заглушка)");
  });
});

// Topup buttons (заглушки)
el("payStars").addEventListener("click", () => toast("Оплата звездами — заглушка"));
el("payCrypto").addEventListener("click", () => toast("Крипта — заглушка"));
el("payTransfer").addEventListener("click", () => toast("Перевод — заглушка"));

// Bottom sheet
const sheet = el("sheet");
const sheetOverlay = el("sheetOverlay");
const sheetTitle = el("sheetTitle");
const sheetClose = el("sheetClose");
const configBox = el("configBox");
const configText = el("configText");
const copyHint = el("copyHint");

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

  // Если CDN не загрузился — покажем текст
  if (!window.QRCode) {
    const fallback = document.createElement("div");
    fallback.style.color = "#000";
    fallback.style.fontFamily = "monospace";
    fallback.style.fontSize = "12px";
    fallback.textContent = "QR lib не загрузилась";
    qrWrap.appendChild(fallback);
    return;
  }

  // QRCode.js рисует в контейнер
  new QRCode(qrWrap, {
    text: text || "empty",
    width: 180,
    height: 180,
    correctLevel: QRCode.CorrectLevel.M
  });
}

// Menu
burger.addEventListener("click", () => {
  dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
});

// Закрытие меню по тапу вне
document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu")) dropdown.style.display = "none";
});

// Navigation
btnRefresh.addEventListener("click", () => {
  dropdown.style.display = "none";
  showPage("tariffs");
});

balanceBtn.addEventListener("click", () => {
  dropdown.style.display = "none";
  showPage("topup");
});

backFromTariffs.addEventListener("click", () => showPage("home"));
backFromTopup.addEventListener("click", () => showPage("home"));

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
  // Простая заглушка форматтера ₽
  const n = Number(amount || 0);
  return `${n.toFixed(2)} ₽`;
}

// Заглушки данных
async function loadMockData() {
  // Можно заменить на fetch("/api/user") — пока просто UI-заглушка.
  const balance = 325.50; // ₽
  balanceEl.textContent = formatRub(balance);

  // Тариф с ценой и датой списания
  setTariffUI("Basic", "150 ₽/мес", "01.01.2026");

  // VPN подключения (с конфигом для QR/копирования)
  const vpns = [
    {
      name: "Germany #1",
      status: "online",
      expires: "2026-03-01",
      config: "vless://TEST-UUID@de1.example.com:443?encryption=none&security=tls&type=ws#Germany%20%231"
    },
    {
      name: "Netherlands #2",
      status: "offline",
      expires: "2026-02-15",
      config: "vless://TEST-UUID@nl2.example.com:443?encryption=none&security=tls&type=ws#Netherlands%20%232"
    },
    {
      name: "Finland #1",
      status: "online",
      expires: "2026-04-10",
      config: "vless://TEST-UUID@fi1.example.com:443?encryption=none&security=tls&type=ws#Finland%20%231"
    }
  ];

  renderVpnList(vpns);
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
      openSheet({
        title: `Подключение: ${v.name}`,
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

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function copyToClipboard(text) {
  // В Telegram Mini App часто работает navigator.clipboard, но добавим fallback
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

function toast(text) {
  if (tg?.showToast) {
    tg.showToast({ message: text });
    return;
  }
  // простой fallback
  console.log("[toast]", text);
}

// Init
setAvatarLetterFromTelegram();
loadMockData();
