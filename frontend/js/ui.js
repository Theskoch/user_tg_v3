// ── App Notification ──────────────────────────────────────────────────────────
let _notifTimer = null;

export function showNotification(state, message) {
  const notif   = document.getElementById('app-notif');
  const overlay = document.getElementById('app-notif-overlay');
  const iconEl  = document.getElementById('app-notif-icon');
  const textEl  = document.getElementById('app-notif-text');
  const closeBtn = document.getElementById('app-notif-close');
  if (!notif) return;

  if (_notifTimer) { clearTimeout(_notifTimer); _notifTimer = null; }

  notif.dataset.state = state;
  textEl.textContent = message;

  if (state === 'loading') {
    iconEl.innerHTML = '<div class="notif-spinner"></div>';
    closeBtn.classList.add('hidden');
    overlay?.classList.remove('show');
    _notifTimer = setTimeout(hideNotification, 30000);
  } else if (state === 'success') {
    iconEl.innerHTML = '✅';
    closeBtn.classList.add('hidden');
    overlay?.classList.remove('show');
    _notifTimer = setTimeout(hideNotification, 2500);
  } else {
    iconEl.innerHTML = '❌';
    closeBtn.classList.remove('hidden');
    overlay?.classList.add('show');
  }

  notif.classList.add('show');
}

export function hideNotification() {
  const notif   = document.getElementById('app-notif');
  const overlay = document.getElementById('app-notif-overlay');
  notif?.classList.remove('show');
  overlay?.classList.remove('show');
  if (_notifTimer) { clearTimeout(_notifTimer); _notifTimer = null; }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function showToast(el, duration = 1800) {
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

export function openBottomSheet(overlay, sheet) {
  overlay?.classList.remove('hidden');
  sheet?.classList.remove('hidden');
  requestAnimationFrame(() => sheet?.classList.add('show'));
}

export function closeBottomSheet(overlay, sheet) {
  sheet?.classList.remove('show');
  overlay?.classList.add('hidden');
  setTimeout(() => sheet?.classList.add('hidden'), 250);
}
