import { apiGet, apiPost, API_URL } from './api.js?v=6';
import { openBottomSheet, closeBottomSheet, copyText, showToast } from './ui.js?v=6';
import { setAdminSelected, setAdminUsers, setAdminTariffs, adminSelected, adminTariffs } from './state.js?v=6';
import { handleConfigOpen, openConfigSheet } from './configs.js?v=6';
import { renderTopupCard, formatTopupMethod } from './topup.js?v=6';
import { startQr, stopQr } from './qr.js?v=6';

// DOM refs — admin panel
const adminPage        = document.getElementById('admin-page');
const adminBack        = document.getElementById('admin-back');
const adminUsersBox    = document.getElementById('admin-users');
const inviteAdminBtn   = document.getElementById('invite-admin');
const inviteUserBtn    = document.getElementById('invite-user');
const inviteCodeBox    = document.getElementById('invite-code');
const inviteCopyBtn    = document.getElementById('invite-copy');
const inviteCopyToast  = document.getElementById('invite-copy-toast');
const adminInitial     = document.getElementById('user-initial-admin');
const adminPendingCard = document.getElementById('admin-pending-card');
const adminPendingOpen = document.getElementById('admin-pending-open');
const adminPendingPage = document.getElementById('admin-pending-page');
const adminPendingBack = document.getElementById('admin-pending-back');
const adminPendingList = document.getElementById('admin-pending-list');
const adminInitialPending = document.getElementById('user-initial-admin-pending');

// DOM refs — admin user page
const adminUserPage    = document.getElementById('admin-user-page');
const adminUserBack    = document.getElementById('admin-user-back');
const adminUserTitle   = document.getElementById('admin-user-title');
const adminTariffSelect = document.getElementById('admin-tariff');
const adminTariffSave  = document.getElementById('admin-tariff-save');
const adminBalanceInput = document.getElementById('admin-balance');
const adminBalanceSave = document.getElementById('admin-balance-save');
const adminBalanceCurrent = document.getElementById('admin-balance-current');
const adminTariffUntil = document.getElementById('admin-tariff-until');
const adminTariffUntilSave = document.getElementById('admin-tariff-until-save');
const adminConfigsBox  = document.getElementById('admin-configs');
const adminConfigAdd   = document.getElementById('admin-config-add');
const adminUserDelete  = document.getElementById('admin-user-delete');
const adminInitialUser = document.getElementById('user-initial-admin-user');

// DOM refs — topup admin
const adminTopupOverlay = document.getElementById('admin-topup-overlay');
const adminTopupSheet   = document.getElementById('admin-topup-sheet');
const adminTopupText    = document.getElementById('admin-topup-text');
const adminTopupApprove = document.getElementById('admin-topup-approve');
const adminTopupReject  = document.getElementById('admin-topup-reject');
const adminTopupClose   = document.getElementById('admin-topup-close');
const adminTopupHistory = document.getElementById('admin-topup-history');
const adminTopupHistoryMore = document.getElementById('admin-topup-history-more');
const adminTopupAllPage = document.getElementById('admin-topup-all-page');
const adminTopupAllBack = document.getElementById('admin-topup-all-back');
const adminTopupHistoryAll = document.getElementById('admin-topup-history-all');
const adminInitialTopupAll = document.getElementById('user-initial-admin-topup-all');

// DOM refs — add config sheet
const addOverlay = document.getElementById('add-overlay');
const addSheet   = document.getElementById('add-sheet');
const addText    = document.getElementById('add-text');
const addType    = document.getElementById('add-type');
const addName    = document.getElementById('add-name');
const addSave    = document.getElementById('add-save');
const addCancel  = document.getElementById('add-cancel');

const userPage   = document.getElementById('user-page');
const userInitial = document.getElementById('user-initial');

let ADMIN_TOPUP_SELECTED = null;

// ─── Users ───────────────────────────────────────────────────────────────────

export async function loadAdminUsers() {
  if (!adminUsersBox) return;
  adminUsersBox.innerHTML = '';
  try {
    const users = await apiGet(`${API_URL}/api/admin/users`);
    setAdminUsers(users);
    users.forEach(u => {
      const card = document.createElement('div');
      card.className = 'conn-card';
      card.innerHTML = `
        <div class="user-row">
          <div>
            <div class="conn-title">${u.first_name || ''} @${u.username || ''}</div>
            <div class="conn-sub">${Number(u.balance || 0).toFixed(2)} ₽ • ${u.tariff_name || '—'}</div>
          </div>
          <span class="tag">${u.role}</span>
        </div>
      `;
      card.addEventListener('click', () => openAdminUser(u));
      adminUsersBox.appendChild(card);
    });
    // Refresh ADMIN_SELECTED with fresh data
    if (adminSelected) {
      const fresh = users.find(x => x.id === adminSelected.id);
      if (fresh) setAdminSelected(fresh);
    }
  } catch {
    adminUsersBox.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
  }
}

export async function loadTariffs() {
  try {
    const r = await apiGet(`${API_URL}/api/tariffs`);
    const tariffs = r.tariffs || [];
    setAdminTariffs(tariffs);
    if (adminTariffSelect) {
      adminTariffSelect.innerHTML = tariffs
        .map(t => `<option value="${t.id}">${t.name} — ${t.price_rub} ₽ / ${t.period_months} мес</option>`)
        .join('');
    }
  } catch {}
}

export async function updatePendingBadge() {
  try {
    const items = await apiGet(`${API_URL}/api/admin/topup/pending`);
    const count = items.length;

    // Card inside admin panel
    if (adminPendingCard) adminPendingCard.classList.toggle('hidden', !count);

    // Badge on the "Администратор" button in side menu
    const adminBtnBadge   = document.getElementById('admin-btn-badge');
    const menuPendingBadge = document.getElementById('menu-pending-badge');
    const label = count > 99 ? '99+' : String(count);
    [adminBtnBadge, menuPendingBadge].forEach(el => {
      if (!el) return;
      el.textContent = label;
      el.classList.toggle('hidden', !count);
    });

    // Telegram Mini App badge on app icon (supported in newer clients)
    try {
      if (window.Telegram?.WebApp?.setBadge) window.Telegram.WebApp.setBadge(count);
    } catch {}
  } catch {
    adminPendingCard?.classList.add('hidden');
  }
}

// ─── Admin user page ─────────────────────────────────────────────────────────

export async function openAdminUser(u) {
  setAdminSelected(u);
  userPage?.classList.add('hidden');
  adminPage?.classList.add('hidden');
  adminUserPage?.classList.remove('hidden');

  if (adminInitialUser) adminInitialUser.textContent = (u.first_name || 'U')[0].toUpperCase();
  if (adminUserTitle) adminUserTitle.textContent = `${u.first_name || ''} @${u.username || ''}`;
  if (adminTariffSelect) adminTariffSelect.value = u.tariff_id ? String(u.tariff_id) : '';
  if (adminBalanceInput) {
    const cur = Number(u.balance || 0).toFixed(2);
    adminBalanceInput.value = cur;
    if (adminBalanceCurrent) adminBalanceCurrent.textContent = `Текущий: ${cur} ₽`;
  }
  if (adminTariffUntil) {
    adminTariffUntil.value = u.tariff_paid_until
      ? new Date(u.tariff_paid_until).toISOString().slice(0, 10)
      : '';
  }

  await loadAdminConfigs();
  await loadAdminTopupHistory();
  await autoOpenFromQuery();
}

// ─── Admin configs ────────────────────────────────────────────────────────────

export async function loadAdminConfigs() {
  if (!adminSelected || !adminConfigsBox) return;
  adminConfigsBox.innerHTML = '';
  try {
    const configs = await apiPost(`${API_URL}/api/admin/configs/list`, { target_user_id: adminSelected.id });
    configs.forEach(c => {
      const card = document.createElement('div');
      card.className = 'conn-card';
      card.innerHTML = `
        <div class="conn-title">${c.name || c.title || 'Config'}</div>
        <div class="conn-sub">${c.protocol || '—'} • ${String(c.config_text || '').slice(0, 18)}...</div>
        <div class="row" style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn ghost" type="button">Открыть</button>
          <button class="btn ghost" type="button">Удалить</button>
        </div>
      `;
      const [openBtn, delBtn] = card.querySelectorAll('button');
      openBtn.addEventListener('click', () => handleConfigOpen(c, { ignoreUsedWarning: true, markUsed: false }));
      delBtn.addEventListener('click', async () => {
        await apiPost(`${API_URL}/api/admin/configs/delete`, { config_id: c.id });
        await loadAdminConfigs();
      });
      adminConfigsBox.appendChild(card);
    });
  } catch {}
}

// ─── Add config sheet ─────────────────────────────────────────────────────────

async function loadConnectionTypes() {
  try {
    const r = await fetch(`${API_URL}/connection_types.json`, { cache: 'no-store' });
    const data = await r.json();
    const types = data.types || [];
    if (addType) {
      addType.innerHTML = `<option value="">—</option>` +
        types.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }
  } catch {}
}

function openAddSheet() {
  if (addText)  addText.value  = '';
  if (addName)  addName.value  = 'Config';
  if (addType)  addType.value  = '';
  openBottomSheet(addOverlay, addSheet);
  startQr();
  loadConnectionTypes();
}

function closeAddSheet() {
  closeBottomSheet(addOverlay, addSheet);
  stopQr();
}

// ─── Topup admin ──────────────────────────────────────────────────────────────

function openAdminTopupSheet(ticket) {
  ADMIN_TOPUP_SELECTED = ticket;
  if (adminTopupText) {
    const date = ticket.created_at ? new Date(ticket.created_at).toLocaleString('ru-RU') : '—';
    const { text } = ticket.status === 'approved'
      ? { text: 'Подтвержден' }
      : ticket.status === 'rejected'
        ? { text: 'Отклонён' }
        : { text: 'На подтверждении' };
    let extra = '';
    if (ticket.status === 'approved') {
      extra = `\nПодтвердил: ${ticket.approved_by_name || '—'}\nДата: ${ticket.approved_at ? new Date(ticket.approved_at).toLocaleString('ru-RU') : '—'}`;
    } else if (ticket.status === 'rejected') {
      extra = `\nОтклонил: ${ticket.rejected_by_name || '—'}\nДата: ${ticket.rejected_at ? new Date(ticket.rejected_at).toLocaleString('ru-RU') : '—'}`;
    }
    adminTopupText.textContent =
      `Платёж ${Number(ticket.amount || 0).toFixed(2)} ₽ • ${formatTopupMethod(ticket.method)} • ${date}\nСтатус: ${text}${extra}`;
  }
  const canAct = ticket.status === 'pending';
  if (adminTopupApprove) {
    adminTopupApprove.disabled = !canAct;
    adminTopupApprove.classList.toggle('hidden', !canAct);
  }
  if (adminTopupReject) {
    adminTopupReject.disabled = !canAct;
    adminTopupReject.classList.toggle('hidden', !canAct);
  }
  openBottomSheet(adminTopupOverlay, adminTopupSheet);
}

function closeAdminTopupSheet() {
  closeBottomSheet(adminTopupOverlay, adminTopupSheet);
  ADMIN_TOPUP_SELECTED = null;
}

export async function loadAdminTopupHistory() {
  if (!adminSelected || !adminTopupHistory) return;
  adminTopupHistory.innerHTML = '';
  try {
    const items = await apiPost(`${API_URL}/api/admin/topup/history`, { target_user_id: adminSelected.id });
    if (!items.length) {
      adminTopupHistory.innerHTML = '<div class="conn-sub">Нет пополнений</div>';
      adminTopupHistoryMore?.classList.add('hidden');
      return;
    }
    items.slice(0, 3).forEach(t => {
      const card = renderTopupCard(t);
      card.addEventListener('click', () => openAdminTopupSheet(t));
      adminTopupHistory.appendChild(card);
    });
    adminTopupHistoryMore?.classList.toggle('hidden', items.length <= 3);
  } catch {
    adminTopupHistory.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
    adminTopupHistoryMore?.classList.add('hidden');
  }
}

async function loadAdminTopupHistoryAll() {
  if (!adminSelected || !adminTopupHistoryAll) return;
  adminTopupHistoryAll.innerHTML = '';
  try {
    const items = await apiPost(`${API_URL}/api/admin/topup/history`, { target_user_id: adminSelected.id });
    if (!items.length) {
      adminTopupHistoryAll.innerHTML = '<div class="conn-sub">Нет пополнений</div>';
      return;
    }
    items.forEach(t => {
      const card = renderTopupCard(t);
      card.addEventListener('click', () => openAdminTopupSheet(t));
      adminTopupHistoryAll.appendChild(card);
    });
  } catch {
    adminTopupHistoryAll.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
  }
}

export async function loadAdminPendingTopups() {
  if (!adminPendingList) return;
  adminPendingList.innerHTML = '';
  try {
    const items = await apiGet(`${API_URL}/api/admin/topup/pending`);
    if (!items.length) {
      adminPendingList.innerHTML = '<div class="conn-sub">Нет платежей на подтверждение</div>';
      return;
    }
    items.forEach(t => {
      const card = renderTopupCard(t);
      card.addEventListener('click', () => openAdminTopupSheet(t));
      adminPendingList.appendChild(card);
    });
  } catch {
    adminPendingList.innerHTML = '<div class="conn-sub">Ошибка загрузки</div>';
  }
}

// ─── Deep-link from query params ─────────────────────────────────────────────

async function autoOpenFromQuery() {
  const q = Object.fromEntries(new URLSearchParams(window.location.search));
  if (!q.admin || !q.user_id || !adminSelected) return;
  if (String(adminSelected.id) !== String(q.user_id)) return;
  if (q.ticket_id) {
    try {
      const items = await apiPost(`${API_URL}/api/admin/topup/history`, { target_user_id: adminSelected.id });
      const ticket = items.find(t => String(t.id) === String(q.ticket_id));
      if (ticket) openAdminTopupSheet(ticket);
    } catch {}
  }
}

export async function autoOpenAdminFromQuery() {
  const q = Object.fromEntries(new URLSearchParams(window.location.search));
  if (!q.admin || !q.user_id) return;
  const users = (await apiGet(`${API_URL}/api/admin/users`).catch(() => [])) || [];
  setAdminUsers(users);
  const user = users.find(u => String(u.id) === String(q.user_id));
  if (user) await openAdminUser(user);
}

// ─── Event listeners ─────────────────────────────────────────────────────────

adminPendingOpen?.addEventListener('click', async () => {
  adminPage?.classList.add('hidden');
  adminPendingPage?.classList.remove('hidden');
  if (adminInitialPending) adminInitialPending.textContent = userInitial?.textContent || 'A';
  await loadAdminPendingTopups();
});

adminPendingBack?.addEventListener('click', () => {
  adminPendingPage?.classList.add('hidden');
  adminPage?.classList.remove('hidden');
});

adminUserBack?.addEventListener('click', () => {
  adminUserPage?.classList.add('hidden');
  adminPage?.classList.remove('hidden');
});

adminTariffSave?.addEventListener('click', async () => {
  if (!adminSelected) return;
  await apiPost(`${API_URL}/api/admin/user/set_tariff`, {
    target_user_id: adminSelected.id,
    tariff_id: Number(adminTariffSelect.value)
  });
  await loadAdminUsers();
});

adminBalanceSave?.addEventListener('click', async () => {
  if (!adminSelected) return;
  await apiPost(`${API_URL}/api/admin/user/set_balance`, {
    target_user_id: adminSelected.id,
    balance: adminBalanceInput.value
  });
  const cur = Number(adminBalanceInput.value || 0).toFixed(2);
  if (adminBalanceCurrent) adminBalanceCurrent.textContent = `Текущий: ${cur} ₽`;
  await loadAdminUsers();
});

adminTariffUntilSave?.addEventListener('click', async () => {
  if (!adminSelected) return;
  await apiPost(`${API_URL}/api/admin/user/set_tariff_until`, {
    target_user_id: adminSelected.id,
    tariff_paid_until: adminTariffUntil?.value || null
  });
  await loadAdminUsers();
});

adminConfigAdd?.addEventListener('click', () => {
  if (!adminSelected) return;
  openAddSheet();
});

addCancel?.addEventListener('click', closeAddSheet);
addOverlay?.addEventListener('click', closeAddSheet);

addSave?.addEventListener('click', async () => {
  if (!adminSelected) return;
  const txt = (addText?.value || '').replace(/\u0000/g, '').trim();
  if (!txt) return;
  await apiPost(`${API_URL}/api/admin/configs/add`, {
    target_user_id: adminSelected.id,
    title: 'Config',
    name: addName?.value?.trim() || 'Config',
    config_text: txt,
    protocol: addType?.value || null
  });
  closeAddSheet();
  await loadAdminConfigs();
});

// ─── Delete-user confirmation sheet ──────────────────────────────────────────

const deleteUserOverlay  = document.getElementById('delete-user-overlay');
const deleteUserSheet    = document.getElementById('delete-user-sheet');
const deleteUserConfirm  = document.getElementById('delete-user-confirm');
const deleteUserCancel   = document.getElementById('delete-user-cancel');
const deleteCountdown    = document.getElementById('delete-countdown');
const deleteCountdownWrap = document.getElementById('delete-countdown-wrap');

let _deleteTimer = null;

function openDeleteSheet() {
  deleteUserOverlay?.classList.remove('hidden');
  deleteUserSheet?.classList.remove('hidden');
  requestAnimationFrame(() => deleteUserSheet?.classList.add('show'));

  // reset state
  let seconds = 10;
  if (deleteCountdown) deleteCountdown.textContent = seconds;
  if (deleteCountdownWrap) deleteCountdownWrap.style.display = '';
  if (deleteUserConfirm) {
    deleteUserConfirm.disabled = true;
    deleteUserConfirm.textContent = 'Удалить';
  }

  clearInterval(_deleteTimer);
  _deleteTimer = setInterval(() => {
    seconds -= 1;
    if (deleteCountdown) deleteCountdown.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(_deleteTimer);
      if (deleteCountdownWrap) deleteCountdownWrap.style.display = 'none';
      if (deleteUserConfirm) deleteUserConfirm.disabled = false;
    }
  }, 1000);
}

function closeDeleteSheet() {
  clearInterval(_deleteTimer);
  deleteUserSheet?.classList.remove('show');
  setTimeout(() => {
    deleteUserOverlay?.classList.add('hidden');
    deleteUserSheet?.classList.add('hidden');
  }, 250);
}

adminUserDelete?.addEventListener('click', () => {
  if (!adminSelected) return;
  openDeleteSheet();
});

deleteUserCancel?.addEventListener('click', closeDeleteSheet);
deleteUserOverlay?.addEventListener('click', closeDeleteSheet);

deleteUserConfirm?.addEventListener('click', async () => {
  if (!adminSelected) return;
  closeDeleteSheet();
  await apiPost(`${API_URL}/api/admin/user/delete`, { target_user_id: adminSelected.id });
  setAdminSelected(null);
  adminUserPage?.classList.add('hidden');
  adminPage?.classList.remove('hidden');
  await loadAdminUsers();
});

inviteAdminBtn?.addEventListener('click', async () => {
  try {
    const r = await apiPost(`${API_URL}/generate_code`, { role: 'admin' });
    if (inviteCodeBox) inviteCodeBox.textContent = r.code;
  } catch {}
});

inviteUserBtn?.addEventListener('click', async () => {
  try {
    const r = await apiPost(`${API_URL}/generate_code`, { role: 'user' });
    if (inviteCodeBox) inviteCodeBox.textContent = r.code;
  } catch {}
});

inviteCopyBtn?.addEventListener('click', async () => {
  const code = inviteCodeBox?.textContent?.trim();
  if (!code || code === '—') return;
  const ok = await copyText(code);
  if (ok) {
    inviteCopyBtn.classList.add('copy-pressed');
    setTimeout(() => inviteCopyBtn.classList.remove('copy-pressed'), 180);
    showToast(inviteCopyToast);
  }
});

adminTopupApprove?.addEventListener('click', async () => {
  if (!ADMIN_TOPUP_SELECTED) return;
  await apiPost(`${API_URL}/api/admin/topup/act`, { ticket_id: ADMIN_TOPUP_SELECTED.id, action: 'approve' });
  closeAdminTopupSheet();
  await loadAdminTopupHistory();
  await loadAdminPendingTopups();
  await updatePendingBadge();
  await loadAdminUsers();
});

adminTopupReject?.addEventListener('click', async () => {
  if (!ADMIN_TOPUP_SELECTED) return;
  await apiPost(`${API_URL}/api/admin/topup/act`, { ticket_id: ADMIN_TOPUP_SELECTED.id, action: 'reject' });
  closeAdminTopupSheet();
  await loadAdminTopupHistory();
  await loadAdminPendingTopups();
  await updatePendingBadge();
  await loadAdminUsers();
});

adminTopupClose?.addEventListener('click', closeAdminTopupSheet);
adminTopupOverlay?.addEventListener('click', closeAdminTopupSheet);

adminTopupHistoryMore?.addEventListener('click', async () => {
  adminUserPage?.classList.add('hidden');
  adminTopupAllPage?.classList.remove('hidden');
  if (adminInitialTopupAll && adminSelected) {
    adminInitialTopupAll.textContent = (adminSelected.first_name || 'A')[0].toUpperCase();
  }
  await loadAdminTopupHistoryAll();
});

adminTopupAllBack?.addEventListener('click', () => {
  adminTopupAllPage?.classList.add('hidden');
  adminUserPage?.classList.remove('hidden');
});

// Refresh admin configs after name update
document.addEventListener('config-name-updated', async (e) => {
  if (e.detail?.adminMode) await loadAdminConfigs();
});
