const tg = window.Telegram.WebApp;
tg.expand();

const avatar = document.getElementById("avatar");
const balance = document.getElementById("balance");
const tariff = document.getElementById("tariff");
const vpnList = document.getElementById("vpnList");

const burger = document.getElementById("burger");
const dropdown = document.getElementById("dropdown");

burger.onclick = () => {
  dropdown.style.display = dropdown.style.display === "block"
    ? "none"
    : "block";
};

document.getElementById("reload").onclick = loadData;

async function loadData() {
  const user = await fetch("/api/user").then(r => r.json());
  balance.textContent = `${user.balance} €`;
  tariff.textContent = user.tariff;
  avatar.textContent = user.avatar_letter;

  const vpns = await fetch("/api/vpn").then(r => r.json());
  vpnList.innerHTML = "";

  vpns.forEach(v => {
    const el = document.createElement("div");
    el.className = `vpn ${v.status}`;
    el.innerHTML = `
      <b>${v.name}</b><br>
      <small>${v.status} · до ${v.expires}</small>
    `;
    vpnList.appendChild(el);
  });
}

loadData();
