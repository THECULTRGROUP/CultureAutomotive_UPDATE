// Page Code: /engine-build/build-confirm
import wixLocation from "wix-location";
import { initCultrFrameController } from "public/cultrEngineFrameController";
import { getBuildConfirmedBundle } from "backend/buildConfirmedBundler";

const HTML_ID = "#buildConfirmHtml"; // ✅ confirmed

async function getPayload() {
  return getBuildConfirmedBundle({ ...(wixLocation.query || {}) });
}

const frame = initCultrFrameController({
  htmlId: HTML_ID,
  getPayload,
  payloadType: "CULTR_ENGINE_BUILD_CONFIRMED",
  readyType: "CULTR_ENGINE_BUILD_CONFIRMED_READY",
  minH: 900,
  maxH: 120000,
  initialH: 2100,
  heightPollMs: 650,
  payloadRetryMs: 650,
  payloadRetryMax: 12,
});

$w.onReady(async () => {
  await frame.mount($w);
});