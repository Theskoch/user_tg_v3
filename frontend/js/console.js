import { apiGet, API_URL } from './api.js?v=9';

const consolePage      = document.getElementById('console-page');
const consoleBack      = document.getElementById('console-back');
const consoleOpenBtn   = document.getElementById('console-open-btn');

const metricCpu    = document.querySelector('#metric-cpu .metric-value');
const metricRam    = document.querySelector('#metric-ram .metric-value');
const metricDisk   = document.querySelector('#metric-disk .metric-value');
const metricUptime = document.getElementById('metric-uptime');
const barCpu       = document.getElementById('bar-cpu');
const barRam       = document.getElementById('bar-ram');
const barDisk      = document.getElementById('bar-disk');

const statUsers   = document.getElementById('stat-users');
const statConfigs = document.getElementById('stat-configs');
const statPending = document.getElementById('stat-pending');

const consoleTopups = document.getElementById('console-topups');
const consoleLog    = document.getElementById('console-log');

let _consoleInterval = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

function setBar(el, pct) {
  if (!el) return;
  el.style.width = `${pct}%`;
  el.dataset.level = pct < 60 ? 'ok' : pct < 85 ? 'warn' : 'crit';
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
       + ' ' + d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const d = await apiGet(`${API_URL}/api/admin/console/stats`);
    const s = d.server;
    const a = d.app;

    if (metricCpu)    metricCpu.textContent    = `${s.cpu_percent}%`;
    if (metricRam)    metricRam.textContent    = `${s.ram_percent}%`;
    if (metricDisk)   metricDisk.textContent   = `${s.disk_percent}%`;
    if (metricUptime) metricUptime.textContent = fmtUptime(s.uptime_sec);
    setBar(barCpu,  s.cpu_percent);
    setBar(barRam,  s.ram_percent);
    setBar(barDisk, s.disk_percent);

    if (statUsers)   statUsers.textContent   = a.users_total;
    if (statConfigs) statConfigs.textContent = a.configs_total;
    if (statPending) {
      statPending.textContent = a.pending_count;
      statPending.style.color = a.pending_count > 0 ? '#f5a623' : '';
    }

    if (consoleTopups) {
      consoleTopups.innerHTML = '';
      if (!d.recent_topups.length) {
        consoleTopups.innerHTML = '<div class="conn-sub">Нет пополнений</div>';
      } else {
        d.recent_topups.forEach(t => {
          const row = document.createElement('div');
          row.className = 'console-topup-row';
          const statusLabel = { pending: 'ожидает', approved: 'принят', rejected: 'отклонён' }[t.status] || t.status;
          row.innerHTML = `
            <span class="topup-status ${t.status}">${statusLabel}</span>
            <span class="topup-amount">${Number(t.amount).toFixed(2)} ₽</span>
            <span class="topup-user">${t.user_name || '—'}</span>
            <span class="topup-time">${fmtTime(t.created_at)}</span>
          `;
          consoleTopups.appendChild(row);
        });
      }
    }
  } catch {}
}

async function loadLogs() {
  try {
    const d = await apiGet(`${API_URL}/api/admin/console/logs`);
    if (!consoleLog) return;
    const wasAtBottom = consoleLog.scrollHeight - consoleLog.scrollTop <= consoleLog.clientHeight + 40;
    consoleLog.innerHTML = d.lines.map(line => {
      const lower = line.toLowerCase();
      let cls = 'log-line-info';
      if (lower.includes('error') || lower.includes('fail') || lower.includes('exception')) cls = 'log-line-error';
      else if (lower.includes('warn') || lower.includes('hmac_failed')) cls = 'log-line-warn';
      return `<div class="${cls}">${escHtml(line)}</div>`;
    }).join('');
    if (wasAtBottom) consoleLog.scrollTop = consoleLog.scrollHeight;
  } catch {}
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function refreshConsole() {
  await Promise.all([loadStats(), loadLogs()]);
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export function openConsolePage(adminPage, userInitialAdmin) {
  adminPage?.classList.add('hidden');
  consolePage?.classList.remove('hidden');

  const ini = document.getElementById('user-initial-console');
  if (ini && userInitialAdmin) ini.textContent = userInitialAdmin.textContent || 'A';

  refreshConsole();
  _consoleInterval = setInterval(refreshConsole, 10000);
}

export function closeConsolePage(adminPage) {
  clearInterval(_consoleInterval);
  consolePage?.classList.add('hidden');
  adminPage?.classList.remove('hidden');
}
