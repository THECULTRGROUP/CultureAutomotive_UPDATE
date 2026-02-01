// Page: /engine-build/build-details
import { initCultrFrameController } from "public/cultrEngineFrameController";
import { getEngineLandingPayload } from "backend/engineLanding";

$w.onReady(async () => {
  const ctl = initCultrFrameController({
    htmlId: "#buildSelectPackHtml",
    getPayload: getEngineLandingPayload,
    payloadType: "CULTR_ENGINE_LANDING",
    readyType: "CULTR_ENGINE_LANDING_READY",
    minH: 900,
    maxH: 26000,
    initialH: 1600,
    heightPollMs: 650
  });

  await ctl.mount($w);
});