// ── App Notification ──────────────────────────────────────────────────────────
let _notif = null;
let _notifOverlay = null;
let _notifTimer = null;

function _ensureNotif() {
  if (_notif) return;
  _notifOverlay = document.createElement('div');
  _notifOverlay.className = 'app-notif-overlay';
  _notifOverlay.addEventListener('click', hideNotification);
  document.body.appendChild(_notifOverlay);

  _notif = document.createElement('div');
  _notif.className = 'app-notif';
  _notif.innerHTML =
    '<div class="app-notif-icon"></div>' +
    '<div class="app-notif-text"></div>' +
    '<button class="app-notif-close hidden" aria-label="Закрыть">✕</button>';
  _notif.querySelector('.app-notif-close').addEventListener('click', hideNotification);
  document.body.appendChild(_notif);
}

export function showNotification(state, message) {
  _ensureNotif();
  if (_notifTimer) { clearTimeout(_notifTimer); _notifTimer = null; }

  _notif.dataset.state = state;
  _notif.querySelector('.app-notif-text').textContent = message;

  const iconEl  = _notif.querySelector('.app-notif-icon');
  const closeBtn = _notif.querySelector('.app-notif-close');

  if (state === 'loading') {
    iconEl.innerHTML = '<div class="notif-spinner"></div>';
    closeBtn.classList.add('hidden');
    _notifOverlay.classList.remove('show');
    _notifTimer = setTimeout(hideNotification, 30000); // safety timeout
  } else if (state === 'success') {
    iconEl.innerHTML = '✅';
    closeBtn.classList.add('hidden');
    _notifOverlay.classList.remove('show');
    _notifTimer = setTimeout(hideNotification, 2500);
  } else {
    iconEl.innerHTML = '❌';
    closeBtn.classList.remove('hidden');
    _notifOverlay.classList.add('show'); // click-outside overlay
  }

  _notif.classList.add('show');
}

export function hideNotification() {
  if (!_notif) return;
  _notif.classList.remove('show');
  _notifOverlay?.classList.remove('show');
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
