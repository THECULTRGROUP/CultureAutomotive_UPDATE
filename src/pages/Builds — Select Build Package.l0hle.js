// Page: /engine-build/select-package
import { initCultrFrameController } from "public/cultrEngineFrameController";
import { getEngineCataloguePayload } from "backend/engineCatalogue";

let controller;

$w.onReady(async () => {
  controller = initCultrFrameController({
    htmlId: "#buildSelectPackHtml",            // ✅ MUST match your HTML Component ID on this page
    getPayload: getEngineCataloguePayload,
    payloadType: "CULTR_ENGINE_SELECT_PACKAGE",
    readyType: "CULTR_ENGINE_SELECT_PACKAGE_READY",

    minH: 900,
    maxH: 120000,
    initialH: 1600,

    heightPollMs: 650,
    payloadRetryMs: 700,
    payloadRetryMax: 12,
  });

  await controller.mount($w);
});

export function onUnload() {
  try { controller?.unmount(); } catch(e) {}
}
