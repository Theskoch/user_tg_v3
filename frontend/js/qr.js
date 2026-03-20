let qrStream    = null;
let qrScanTimer = null;
let qrScanned   = false;

const qrVideo  = document.getElementById('qr-video');
const qrCanvas = document.getElementById('qr-canvas');
const qrRescan = document.getElementById('qr-rescan');
const addText  = document.getElementById('add-text');

export async function startQr() {
  try {
    if (!qrVideo) return;
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    qrVideo.srcObject = qrStream;
    await qrVideo.play();
    qrScanned = false;
    scanQrLoop();
  } catch {
    // No camera available — user can paste manually
  }
}

export function stopQr() {
  if (qrScanTimer) cancelAnimationFrame(qrScanTimer);
  if (qrStream) {
    qrStream.getTracks().forEach(t => t.stop());
    qrStream = null;
  }
  qrScanned = false;
}

function scanQrLoop() {
  if (!qrVideo || !qrCanvas || qrScanned) return;
  const ctx = qrCanvas.getContext('2d');
  qrCanvas.width  = qrVideo.videoWidth  || 320;
  qrCanvas.height = qrVideo.videoHeight || 240;
  ctx.drawImage(qrVideo, 0, 0, qrCanvas.width, qrCanvas.height);
  const img  = ctx.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
  const code = window.jsQR ? window.jsQR(img.data, img.width, img.height) : null;
  if (code?.data) {
    const cleaned = String(code.data).replace(/\u0000/g, '').trim();
    if (cleaned && addText) addText.value = cleaned;
    qrScanned = true;
    stopQr();
    return;
  }
  qrScanTimer = requestAnimationFrame(scanQrLoop);
}

qrRescan?.addEventListener('click', startQr);
