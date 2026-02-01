// /verify page code — Verify landing (hardened + sandbox-safe navigation)
import wixLocation from "wix-location";
import { getVerifyLandingPayload } from "backend/verifyLanding";

const HTML_ID = "verifyLandingFrame";
const POPUP_ID = "globalContactAuto";

const MSG = {
  READY: "CULTR_VERIFY_LANDING_READY",
  ACK: "CULTR_ACK",
  PING: "CULTR_PING",
  REQ_HEIGHT: "CULTR_REQ_HEIGHT",
  HEIGHT: "CULTR_HEIGHT",
  NAV: "CULTR_NAVIGATE",
  POPUP: "CULTR_OPEN_POPUP",
  LOG: "CULTR_LOG",
  PAYLOAD: "CULTR_VERIFY_LANDING",
};

let payloadCache = null;
let htmlReady = false;
let acked = false;
let payloadPostedOnce = false;

let pingTimer = null;
let resendTimer = null;
let safetyTimeout = null;

function safeNum(n, fallback = 1100) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function setFrameHeight(h) {
  try {
    const el = $w(`#${HTML_ID}`);
    const next = safeNum(h, el.height || 1100);
    const clamped = Math.max(900, Math.min(24000, next));
    if (Math.abs((el.height || 0) - clamped) > 10) el.height = clamped;
  } catch (e) {}
}

function post(type, data = {}) {
  try {
    $w(`#${HTML_ID}`).postMessage({ type, ...data });
  } catch (e) {}
}

function postPayload() {
  if (!payloadCache) return;
  payloadPostedOnce = true;
  post(MSG.PAYLOAD, { payload: payloadCache });
  post(MSG.REQ_HEIGHT);
}

function stopTimers() {
  if (pingTimer) clearInterval(pingTimer);
  if (resendTimer) clearInterval(resendTimer);
  if (safetyTimeout) clearTimeout(safetyTimeout);
  pingTimer = resendTimer = safetyTimeout = null;
}

$w.onReady(async function () {
  // set a reasonable default height before the iframe measures itself
  setFrameHeight(1800);

  // Optional popup exists on some pages
  try { $w(`#${POPUP_ID}`).hide(); } catch (e) {}

  $w(`#${HTML_ID}`).onMessage((event) => {
    const msg = event.data || {};
    if (!msg || typeof msg !== "object") return;

    if (msg.type === MSG.HEIGHT && msg.height) {
      setFrameHeight(msg.height);
      return;
    }

    if (msg.type === MSG.NAV && msg.url) {
      wixLocation.to(String(msg.url));
      return;
    }

    if (msg.type === MSG.POPUP && msg.id) {
      const id = String(msg.id);
      try { $w(`#${id}`).show(); } catch (e) {}
      return;
    }

    if (msg.type === MSG.LOG) {
      console.log("VerifyLanding HTML:", msg.level || "log", msg.message || msg);
      return;
    }

    if (msg.type === MSG.READY) {
      htmlReady = true;
      post(MSG.ACK, { phase: "ready" });
      post(MSG.REQ_HEIGHT);
      if (payloadCache) postPayload();
      return;
    }

    if (msg.type === MSG.ACK) {
      acked = true;

      post(MSG.REQ_HEIGHT);
      setTimeout(() => post(MSG.REQ_HEIGHT), 450);
      setTimeout(() => post(MSG.REQ_HEIGHT), 1200);
      setTimeout(() => post(MSG.REQ_HEIGHT), 2000);

      if (payloadPostedOnce) stopTimers();
      return;
    }
  });

  // Keep pinging until iframe is ready
  pingTimer = setInterval(() => {
    if (!htmlReady) post(MSG.PING);
  }, 500);

  // Load payload
  try {
    payloadCache = await getVerifyLandingPayload();
    console.log("Verify landing payload loaded:", payloadCache);
  } catch (e) {
    payloadCache = {
      ctx: { viewMode: "error" },
      links: {
        verifyHome: "/verify",
        verifyTool: "/verify/application",
        trust: "/verify/trust",
        forWorkshops: "/verify/for-workshop/",
        financeHome: "/cultr-finance",
        financeOptions: "/cultr-finance/loan-options",
        membership: "/membership-rewards",
        contact: "/contact",
      },
      meta: {
        heroSubtitle: "Payload failed. Check backend/verifyLanding.jsw."
      },
      governanceItems: [],
      governanceChips: [],
      scenarios: [],
      debug: { ok: false, errors: [String(e?.message || e)] },
    };
  }

  // If iframe already ready, post immediately
  if (htmlReady) postPayload();

  // Resend until ACK received (prevents Wix timing drops)
  resendTimer = setInterval(() => {
    if (htmlReady && !acked) postPayload();
  }, 900);

  // Safety cutoff
  safetyTimeout = setTimeout(() => {
    if (!acked) {
      console.warn("No payload ACK from iframe — stopping resend to avoid loops.");
      stopTimers();
      post(MSG.REQ_HEIGHT);
    }
  }, 16000);

  // Kick off readiness handshake
  post(MSG.PING);
});