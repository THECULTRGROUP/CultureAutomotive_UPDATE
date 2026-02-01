// ===============================================
// Page Code: /engine-build/engine-pack-builder
// Culture Automotive — Engine Pack Builder
// ===============================================

import wixLocation from "wix-location";
import { initCultrFrameController } from "public/cultrEngineFrameController";
import { getEnginePackBuilderBundle } from "backend/enginePackBuilderBundler";

// 🔒 HTML Component ID (iframe)
const HTML_ID = "#enginePackBuilderHtml";

/**
 * Payload resolver
 * Passes ALL query params through so backend can resolve:
 * - engineKey
 * - packKey
 * - detailsSlug
 * - initialTier
 */
async function getPayload() {
  const query = wixLocation.query || {};
  return await getEnginePackBuilderBundle({ ...query });
}

/**
 * Initialise iframe controller
 */
const frame = initCultrFrameController({
  htmlId: HTML_ID,

  // Payload wiring
  getPayload,
  payloadType: "CULTR_ENGINE_PACK_BUILDER",
  readyType: "CULTR_ENGINE_PACK_BUILDER_READY",

  // Height behaviour (safe for long punchlists & timelines)
  minH: 900,
  maxH: 120000,
  initialH: 1600,

  // Polling + reliability
  heightPollMs: 650,
  payloadRetryMs: 650,
  payloadRetryMax: 12,

  // Optional debug
  debug: false,
});

$w.onReady(async () => {
  try {
    await frame.mount($w);
  } catch (err) {
    console.error("[ENGINE PACK BUILDER] Failed to mount iframe", err);
  }
});
