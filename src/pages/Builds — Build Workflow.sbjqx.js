// Page Code: /engine-build/build-workflow
import wixLocation from "wix-location";
import { initCultrFrameController } from "public/cultrEngineFrameController";
import { getBuildWorkflowBundle } from "backend/buildWorkflowBundler";

const HTML_ID = "#buildWorkflowHtml"; // ✅ confirmed

async function getPayload() {
  return getBuildWorkflowBundle({ ...(wixLocation.query || {}) });
}

const frame = initCultrFrameController({
  htmlId: HTML_ID,
  getPayload,
  payloadType: "CULTR_ENGINE_BUILD_WORKFLOW",
  readyType: "CULTR_ENGINE_BUILD_WORKFLOW_READY",
  minH: 900,
  maxH: 120000,
  initialH: 2600,
  heightPollMs: 650,
  payloadRetryMs: 650,
  payloadRetryMax: 12,
});

$w.onReady(async () => {
  await frame.mount($w);
});