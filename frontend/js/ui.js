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
