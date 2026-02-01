// Page Code: /engine-build/engine-details
import wixLocation from "wix-location";
import wixWindow from "wix-window";
import wixLocationFrontend from "wix-location";
import { initCultrFrameController } from "public/cultrEngineFrameController";
import { getEnginePackDetailsPayload } from "backend/enginePackDetails"; // ✅ make sure filename matches

const HTML_ID = "#engineDetailsHtml";
const PAYLOAD_TYPE = "CULTR_ENGINE_DETAILS";
const READY_TYPE = "CULTR_ENGINE_DETAILS_READY";

async function getPayload() {
  const q = wixLocation.query || {};

  // ✅ PRIORITY FIX:
  // detailsSlug is most stable for Details lookups.
  // packKey can be missing / wrong depending on which page produced the link.
  const packRef =
    q.packRef ||
    q.detailsSlug ||          // ✅ moved up
    q.packKey ||
    q.pack ||                 // engineKey fallback
    q.id ||
    q.slug ||
    "";

  const stage =
    q.stage ||
    q.packageTier ||
    q.tier ||
    "";

  try {
    return await getEnginePackDetailsPayload({ packRef, stage });
  } catch (e) {
    return {
      ok: false,
      error: "DETAILS_PAYLOAD_THROWN",
      ctx: { packRef, stage },
      links: {},
      pack: null,
      stageCompare: [],
      tiers: [],
      punch: { partsList: [], blockSpecs: [], headSpecs: [], other: [] },
      timeline: [],
      gallery: [],
      meta: null,
      debug: { ok: false, errors: [String(e?.message || e)] },
    };
  }
}

$w.onReady(async () => {
  const controller = initCultrFrameController({
    htmlId: HTML_ID,
    getPayload,
    payloadType: PAYLOAD_TYPE,
    readyType: READY_TYPE,
    minH: 900,
    maxH: 120000,
    initialH: 7200,
    heightPollMs: 350,
  });

  await controller.mount($w);

  const html = $w(HTML_ID);

  html.onMessage((event) => {
    let data = event?.data;

    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (_) { data = {}; }
    }
    data = data || {};

    if (data.type === "CULTR_NAVIGATE") {
      const target = data.url || data.abs || data.path || "";
      if (target) wixLocationFrontend.to(target);
      return;
    }

    if (data.type === "CULTR_OPEN_POPUP" && data.id) {
      wixWindow.openLightbox(data.id, data.data || {});
      return;
    }

    if (data.type === "CULTR_LOG") {
      console.log("[ENGINE DETAILS IFRAME]", data.level || "info", data.message || data);
    }
  });
});
