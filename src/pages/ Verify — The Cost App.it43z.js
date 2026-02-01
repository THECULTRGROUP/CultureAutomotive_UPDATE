// /verify/app page code (Wix Velo)
// Tracking handled ONLY via GTM (no manual tracking)

import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import { parseAndScore } from 'backend/verify.jsw';

// Edge suggest functions
import {
  edgePostcodeSuggest,
  edgeVehicleSuggest
} from 'backend/cultrEdge.jsw';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB max
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 6;

const rate = new Map(); // MVP in-memory limiter

const ALLOWED_ORIGINS = new Set([
  'https://www.culture-automotive.com',
  'https://culture-automotive.com',
  'https://www.culture-automotive.com.au',
  'https://culture-automotive.com.au'
]);

function now() { return Date.now(); }

function rateKey() {
  return `${wixWindow.rendering.env || 'web'}:${wixLocation.path.join('/')}`;
}

function hitRateLimit() {
  const k = rateKey();
  const t = now();
  const rec = rate.get(k) || { ts: t, count: 0 };

  if (t - rec.ts > RATE_WINDOW_MS) {
    rec.ts = t;
    rec.count = 0;
  }

  rec.count += 1;
  rate.set(k, rec);
  return rec.count > RATE_MAX;
}

function safeString(v, max = 140) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function safeUpper(v, max = 12) {
  return safeString(v, max).toUpperCase();
}

function sanitizePostcode(v) {
  const s = safeString(v, 10).replace(/[^\d]/g, '').slice(0, 4);
  return /^\d{4}$/.test(s) ? s : '';
}

function base64ByteLength(b64) {
  if (!b64) return 0;
  const len = b64.length;
  const pad = b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0);
  return Math.floor((len * 3) / 4) - pad;
}

function makeNonce() {
  try {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (_) {
    return `${now()}_${Math.random().toString(16).slice(2)}_${Math.random().toString(16).slice(2)}`;
  }
}

function post(type, payload) {
  try { $w('#verifyAppHtml').postMessage({ type, payload }); } catch (_) {}
}

function sendError(message) {
  post('verify_error', { message });
  try { $w('#verifyAppHtml').postMessage({ type: 'verify_error', message }); } catch (_) {}
}

function sendResult(payload) {
  post('verify_result', payload);
  try { $w('#verifyAppHtml').postMessage({ type: 'verify_result', payload }); } catch (_) {}
}

function setHtmlHeight(px) {
  try {
    // Wix expects numbers (px). Guard for extremes.
    const minH = 720;
    const maxH = 2200;
    const h = Math.max(minH, Math.min(maxH, Math.floor(px)));
    $w('#verifyAppHtml').height = h;
  } catch (_) {}
}

$w.onReady(() => {
  const sessionNonce = makeNonce();

  // Initial best height = viewport
  try {
    const vp = wixWindow.viewportSize?.height || 900;
    setHtmlHeight(vp);
  } catch (_) {}

  // Handshake
  $w('#verifyAppHtml').postMessage({
    type: 'verify_handshake',
    payload: { nonce: sessionNonce }
  });

  // Resize on viewport change (desktop/tablet rotate)
  wixWindow.onResize(() => {
    const vp = wixWindow.viewportSize?.height || 900;
    // keep it at least viewport height (prevents dead space weirdness)
    setHtmlHeight(vp);
  });

  $w('#verifyAppHtml').onMessage(async (event) => {
    const msg = event.data;

    // Origin check only if Wix provides origin
    try {
      if (event?.origin && !ALLOWED_ORIGINS.has(event.origin)) return;
    } catch (_) {}

    const nonce = msg?.nonce || msg?.payload?.nonce;
    const hasNonce = typeof nonce === 'string' && nonce === sessionNonce;

    if (!msg?.type) return;

    // HTML height pings
    if (msg.type === 'verify_height') {
      if (!hasNonce) return;
      const h = Number(msg?.payload?.h || 0);
      if (h > 0) {
        const vp = wixWindow.viewportSize?.height || 900;
        // use whichever is larger so it always feels “full”
        setHtmlHeight(Math.max(h, vp));
      }
      return;
    }

    // Ignore tracking events (GTM handles)
    if (msg.type === 'verify_event') return;

    /* =========================
       A) EDGE: Vehicle suggest
    ========================= */
    if (msg.type === 'edge_vehicle_suggest') {
      if (!hasNonce) return;

      const q = safeString(msg?.payload?.q, 80);
      const requestId = safeString(String(msg?.payload?.requestId ?? ''), 30);

      if (!q) {
        $w('#verifyAppHtml').postMessage({
          type: 'edge_vehicle_suggest_result',
          payload: { requestId, results: [] }
        });
        return;
      }

      try {
        const results = await edgeVehicleSuggest(q);
        $w('#verifyAppHtml').postMessage({
          type: 'edge_vehicle_suggest_result',
          payload: { requestId, results: Array.isArray(results) ? results : [] }
        });
      } catch (_) {
        $w('#verifyAppHtml').postMessage({
          type: 'edge_vehicle_suggest_result',
          payload: { requestId, results: [] }
        });
      }
      return;
    }

    /* =========================
       B) EDGE: Postcode suggest
    ========================= */
    if (msg.type === 'edge_postcode_suggest') {
      if (!hasNonce) return;

      const q = safeString(msg?.payload?.q, 20);
      const requestId = safeString(String(msg?.payload?.requestId ?? ''), 30);

      if (!q) {
        $w('#verifyAppHtml').postMessage({
          type: 'edge_postcode_suggest_result',
          payload: { requestId, results: [] }
        });
        return;
      }

      try {
        const results = await edgePostcodeSuggest(q);
        $w('#verifyAppHtml').postMessage({
          type: 'edge_postcode_suggest_result',
          payload: { requestId, results: Array.isArray(results) ? results : [] }
        });
      } catch (_) {
        $w('#verifyAppHtml').postMessage({
          type: 'edge_postcode_suggest_result',
          payload: { requestId, results: [] }
        });
      }
      return;
    }

    /* =========================
       C) MAIN: Parse + score
    ========================= */
    if (msg.type === 'verify_run') {
      if (!hasNonce) {
        sendError('Session validation failed. Refresh the page and try again.');
        return;
      }

      if (hitRateLimit()) {
        sendError('Too many attempts. Please wait a moment and try again.');
        return;
      }

      try {
        const p = msg.payload || {};

        const mimeType = safeString(p.mimeType, 80);
        const fileName = safeString(p.fileName, 140);

        const dataUrl = typeof p.dataUrl === 'string' ? p.dataUrl : '';
        const base64 = dataUrl.includes('base64,')
          ? (dataUrl.split('base64,')[1] || '')
          : '';

        if (!ALLOWED_MIME.has(mimeType)) {
          sendError('Unsupported file type. Please upload a PDF, JPG, PNG, or WEBP.');
          return;
        }

        const bytes = base64ByteLength(base64);
        if (!bytes || bytes > MAX_BYTES) {
          sendError('File too large. Please upload a smaller PDF/image (max 8MB).');
          return;
        }

        const vehicle = safeString(p.vehicle, 160);
        const state = safeUpper(p.state, 12);
        const postcode = sanitizePostcode(p.postcode);

        if (!postcode) {
          sendError('Please enter a valid 4-digit Australian postcode.');
          return;
        }

        const apiPayload = {
          fileName: fileName || 'upload',
          mimeType,
          base64,
          vehicle,
          state,
          postcode
        };

        const result = await parseAndScore(apiPayload);

        const meterPos =
          typeof result?.meter_position === 'number'
            ? Math.max(0, Math.min(100, result.meter_position))
            : 50;

        const safeResult = {
          audit_state: result?.audit_state || 'REVIEW_RECOMMENDED',
          meter_label: result?.meter_label || 'Worth Reviewing',
          meter_position: meterPos,
          meter_band: result?.meter_band || '',
          explanation:
            result?.explanation ||
            'Based on available data, you may wish to confirm scope and parts selection.',
          parse_confidence: result?.parse_confidence || 'med',
          benchmark_confidence: result?.benchmark_confidence || 'med',
          call_to_action: result?.call_to_action || 'CONFIRM',
          audit_badge_text: result?.audit_badge_text || ''
        };

        // guard: no retender if benchmark confidence is low
        if (safeResult.call_to_action === 'RETENDER') {
          const bc = String(safeResult.benchmark_confidence || '').toLowerCase();
          if (bc === 'low') safeResult.call_to_action = 'CONFIRM';
        }

        sendResult(safeResult);
        return;

      } catch (_) {
        sendError('We couldn’t process that file. Try another image/PDF or request manual review.');
        return;
      }
    }

    // CTA actions reserved for later routing
    if (msg.type === 'verify_action') {
      if (!hasNonce) return;
      return;
    }
  });
});