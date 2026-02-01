/***************************************
 * Velo Page Code (FRONT-END)
 * Engine Build Package Home (/engine-build)
 *
 * FIXES:
 * ✅ Correct HTML Component ID: #buildLandPageHtml
 * ✅ Robust iframe height autosize (prevents cropping)
 * ✅ Sends payload reliably (immediate + on READY)
 * ✅ Periodically requests height (late images / lazy sections)
 * ✅ Handles iframe navigation + optional popup trigger
 ***************************************/

import wixLocation from "wix-location";
import wixWindow from "wix-window";
import { getEngineLandingPayload } from "backend/engineLanding";

/* ========= CONFIG ========= */
const HTML_ID = "#buildLandPageHtml"; // ✅ CONFIRMED (your new landing iframe ID)

// Height clamp
const MIN_IFRAME_H = 900;
const MAX_IFRAME_H = 26000;

// Keep requesting height while content loads (images, reveal animations, etc.)
const HEIGHT_POLL_MS = 700;

/* ========= MESSAGE TYPES ========= */
const MSG = {
  READY: "CULTR_ENGINE_LANDING_READY",
  PING: "CULTR_PING",
  REQ_HEIGHT: "CULTR_REQ_HEIGHT",
  HEIGHT: "CULTR_HEIGHT",
  NAV: "CULTR_NAVIGATE",
  POPUP: "CULTR_OPEN_POPUP",
  LOG: "CULTR_LOG",
  PAYLOAD: "CULTR_ENGINE_LANDING",
  ACK: "CULTR_ACK",
};

/* ========= STATE ========= */
let htmlComp;
let payloadCache = null;
let payloadSent = false;
let heightTimer = null;

$w.onReady(async () => {
  htmlComp = $w(HTML_ID);

  // ✅ safe initial height so it never starts cropped
  try { htmlComp.height = 1400; } catch (e) {}

  // ✅ listen for iframe -> wix messages
  htmlComp.onMessage((event) => {
    handleIframeMessage(event.data);
  });

  // ✅ fetch payload FIRST
  payloadCache = await safeGetPayload();

  // ✅ send immediately (works even if READY arrives late)
  trySendPayload(false);

  // ✅ ping iframe (helps Wix timing quirks)
  safePost({ type: MSG.PING });

  // ✅ keep asking iframe for height while content loads
  startHeightPolling();

  // ✅ request height on resize (breakpoints)
  wixWindow.onResize(() => requestHeight(true));
});

/* ========= DATA ========= */
async function safeGetPayload() {
  try {
    const data = await getEngineLandingPayload();
    return data || {};
  } catch (e) {
    return {
      ctx: { viewMode: "page" },
      links: {},
      meta: { heroSubtitle: "Payload failed. Check backend/engineLanding.jsw." },
      promos: [],
      benefits: [],
      packs: [],
      featured: null,
      debug: { ok: false, errors: ["backend error: " + (e?.message || String(e))] },
    };
  }
}

/* ========= HELPERS ========= */
function safePost(msg) {
  try { if (htmlComp) htmlComp.postMessage(msg); } catch (e) {}
}

function clampHeight(h) {
  const n = Number(h);
  if (!Number.isFinite(n)) return null;
  return Math.max(MIN_IFRAME_H, Math.min(MAX_IFRAME_H, Math.round(n)));
}

/* ========= MESSAGE HANDLER ========= */
function handleIframeMessage(msg) {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === MSG.READY) {
    // ✅ resend on READY (guarantees delivery)
    trySendPayload(true);
    // ✅ request height now
    requestHeight(true);
    return;
  }

  if (msg.type === MSG.HEIGHT) {
    const h = clampHeight(msg.height);
    if (!h) return;

    try {
      if (htmlComp.height !== h) htmlComp.height = h;
    } catch (e) {}
    return;
  }

  if (msg.type === MSG.NAV && msg.url) {
    wixLocation.to(String(msg.url));
    return;
  }

  if (msg.type === MSG.POPUP && msg.id) {
    // fallback behavior if you use popup ids from iframe
    if (String(msg.id) === "globalContactAuto") wixLocation.to("/contact");
    return;
  }

  // Optional debug channel
  // if (msg.type === MSG.LOG) console.log("[IFRAME]", msg.level, msg.message);
}

/* ========= SEND PAYLOAD ========= */
function trySendPayload(force = false) {
  if (!htmlComp || !payloadCache) return;
  if (payloadSent && !force) return;

  safePost({ type: MSG.PAYLOAD, payload: payloadCache });
  payloadSent = true;

  // height sync bursts after payload lands
  setTimeout(() => requestHeight(true), 200);
  setTimeout(() => requestHeight(true), 700);
  setTimeout(() => requestHeight(true), 1400);
}

/* ========= HEIGHT CONTROL ========= */
function requestHeight(force = false) {
  safePost({ type: MSG.REQ_HEIGHT, force: !!force });
}

function startHeightPolling() {
  stopHeightPolling();
  heightTimer = setInterval(() => requestHeight(false), HEIGHT_POLL_MS);
}

function stopHeightPolling() {
  if (heightTimer) clearInterval(heightTimer);
  heightTimer = null;
}