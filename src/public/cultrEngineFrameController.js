// public/cultrEngineFrameController.js
// Culture Automotive — HTML Component (iframe) controller
//
// Drop-in controller for all Engine Build pages.
// ✅ Reliable payload delivery + iframe height autosizing
// ✅ Handles NAV + POPUP messages from iframe
// ✅ Popup: supports anchored "scroll-to-button" best-effort + autofocus support
//
// Message protocol (from iframe -> Wix):
//  - { type:"<readyType>" }                          // iframe ready
//  - { type:"CULTR_HEIGHT", height:number }          // height update
//  - { type:"CULTR_NAVIGATE", url:string }           // navigate
//  - { type:"CULTR_OPEN_POPUP", id:string, data?:{}, anchor?:{x,y} } // open lightbox
//
// Message protocol (Wix -> iframe):
//  - { type:"<payloadType>", payload:any }           // data payload
//  - { type:"CULTR_REQ_HEIGHT" }                     // request height
//  - { type:"CULTR_PING", ts:number }                // ping
//  - { type:"CULTR_ACK", ackType:"<payloadType>" }   // optional ACK

import wixLocation from "wix-location";
import wixWindow from "wix-window";
import wixWindowFrontend from "wix-window-frontend";
import wixUsers from "wix-users";

function safeParse(data) {
  try {
    if (typeof data === "string") return JSON.parse(data);
    if (typeof data === "object" && data) return data;
  } catch (_) {}
  return null;
}

function clampNumber(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.max(Number(min), Math.min(Number(max), Math.round(x)));
}

export function initCultrFrameController({
  htmlId,
  getPayload,
  payloadType,
  readyType,
  logPrefix = "CULTR_FRAME",
  debug = false,

  // height behaviour
  minH = 900,
  maxH = 120000,
  initialH = 1400,
  heightPollMs = 700,

  // payload reliability
  payloadRetryMs = 700,
  payloadRetryMax = 10,
} = {}) {
  let payloadCache = null;
  let htmlComp = null;

  let disposed = false;
  let sending = false;
  let acked = false;

  let heightTimer = null;
  let payloadTimer = null;

  function log(...args) {
    if (debug) console.log(`[${logPrefix}]`, ...args);
  }

  async function buildPayload() {
    if (payloadCache) return payloadCache;

    const ctx = {
      query: wixLocation.query,
      path: wixLocation.path,
      url: wixLocation.url,
      referrer: wixLocation.referrer,
    };

    payloadCache = await (typeof getPayload === "function"
      ? getPayload(ctx)
      : Promise.resolve({ ctx })
    );

    return payloadCache;
  }

  function post(msgObj) {
    try {
      if (!htmlComp) return;
      htmlComp.postMessage(msgObj);
    } catch (e) {
      // ignore
    }
  }

  async function sendPayloadOnce() {
    if (disposed || !htmlComp || sending) return;
    sending = true;

    try {
      const payload = await buildPayload();
      post({ type: payloadType, payload });
      log("sent payload", payloadType);
    } finally {
      sending = false;
    }
  }

  async function ensurePayloadDelivery() {
    if (disposed) return;
    acked = false;

    // immediate send
    await sendPayloadOnce();

    // retry window
    let tries = 0;
    clearInterval(payloadTimer);
    payloadTimer = setInterval(async () => {
      tries += 1;
      if (disposed) return;
      if (acked) {
        clearInterval(payloadTimer);
        payloadTimer = null;
        return;
      }
      if (tries >= payloadRetryMax) {
        clearInterval(payloadTimer);
        payloadTimer = null;
        return;
      }
      await sendPayloadOnce();
    }, payloadRetryMs);
  }

  function applyHeight(h) {
    if (!htmlComp) return;
    const clamped = clampNumber(h, minH, maxH);
    if (clamped == null) return;
    try {
      htmlComp.height = clamped;
    } catch (e) {
      // ignore
    }
  }

  function startHeightPolling() {
    if (!heightPollMs || heightPollMs < 150) return;

    clearInterval(heightTimer);
    heightTimer = setInterval(() => {
      if (disposed) return;
      post({ type: "CULTR_REQ_HEIGHT" });
    }, heightPollMs);
  }

  function stopTimers() {
    clearInterval(heightTimer);
    clearInterval(payloadTimer);
    heightTimer = null;
    payloadTimer = null;
  }

  async function handlePopup(idRaw, data = {}, anchor = null) {
    const raw = String(idRaw || "");
    const cleaned = raw.replace(/^#/, "").trim();
    if (!cleaned) return;

    // Legacy mapping: older pages used this placeholder id.
    const popupId = (cleaned === "globalContactAuto") ? "contactCultureAutomotivePopup" : cleaned;

    // Wix Members shortcut (optional)
    if (popupId === "wixMembersLogin" || popupId === "wixMembersSignup") {
      try { await wixUsers.promptLogin(); } catch (e) {}
      return;
    }

    const ctx = { ...(data || {}) };

    // Autofocus (no prefill)
    if (popupId === "contactCultureAutomotivePopup") {
      if (ctx.autoFocus === undefined) ctx.autoFocus = true;
      if (!ctx.focusId) ctx.focusId = "contactCultureAutomotiveForm";
    }

    // Best-effort: scroll so the clicked button TOP sits near the center of the visible viewport.
    if (anchor && typeof anchor.y === "number" && htmlComp) {
      try {
        const [win, rect] = await Promise.all([
          wixWindowFrontend.getBoundingRect(),
          Promise.resolve(htmlComp.getBoundingRect())
        ]);

        const viewportH = win?.window?.height || 0;
        const viewportW = win?.window?.width || 0;
        const docH = win?.document?.height || 0;
        const docW = win?.document?.width || 0;
        const scrollX = win?.scroll?.x || 0;
        const scrollY = win?.scroll?.y || 0;

        const anchorYViewport = (rect?.top || 0) + anchor.y;
        const anchorXViewport = (rect?.left || 0) + (typeof anchor.x === "number" ? anchor.x : 0);

        const targetY = Math.max(0, Math.min(docH - viewportH, scrollY + anchorYViewport - (viewportH / 2)));
        const targetX = Math.max(0, Math.min(docW - viewportW, scrollX + anchorXViewport - (viewportW / 2)));

        await wixWindowFrontend.scrollTo(targetX, targetY);
      } catch (e) {
        // ignore
      }
    }

    try {
      await wixWindow.openLightbox(popupId, ctx);
    } catch (e) {
      // ignore
    }
  }

  function onMessage(event) {
    const msg = safeParse(event?.data);
    if (!msg || typeof msg !== "object") return;

    // iframe ready -> send payload (and start height loop)
    if (msg.type === readyType) {
      log("ready received", readyType);
      ensurePayloadDelivery();
      startHeightPolling();
      return;
    }

    // payload ACK (optional)
    if (msg.type === "CULTR_ACK" && msg.ackType === payloadType) {
      acked = true;
      log("ack received", payloadType);
      return;
    }

    if (msg.type === "CULTR_HEIGHT" && msg.height != null) {
      applyHeight(msg.height);
      return;
    }

    if (msg.type === "CULTR_NAVIGATE" && msg.url) {
      try { wixLocation.to(String(msg.url)); } catch (e) {}
      return;
    }

    if (msg.type === "CULTR_OPEN_POPUP" && msg.id) {
      handlePopup(msg.id, msg.data || {}, msg.anchor || null);
      return;
    }

    if (msg.type === "CULTR_PING") {
      post({ type: "CULTR_PING", ts: Date.now() });
      return;
    }
  }

  async function mount($w) {
    if (disposed) return;
    if (!$w) throw new Error("initCultrFrameController.mount($w) requires $w");

    htmlComp = $w(htmlId);
    if (!htmlComp) throw new Error(`HTML Component not found: ${htmlId}`);

    // default height so there is no crop before first measurement
    applyHeight(initialH);

    htmlComp.onMessage(onMessage);

    // send payload once in case iframe is already listening
    await ensurePayloadDelivery();
    startHeightPolling();
  }

  function unmount() {
    disposed = true;
    stopTimers();
    htmlComp = null;
  }

  return { mount, unmount };
}