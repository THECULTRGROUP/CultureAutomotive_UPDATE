// Page Code: /engine-build
import wixLocation from "wix-location";
import wixWindow from "wix-window";
import wixLocationFrontend from "wix-location";
import { initCultrFrameController } from "public/cultrEngineFrameController";
import { getEngineLandingPayload } from "backend/engineLanding";

const HTML_ID = "#buildLandPageHtml";
const PAYLOAD_TYPE = "CULTR_ENGINE_LANDING";
const READY_TYPE = "CULTR_ENGINE_LANDING_READY";

async function getPayload() {
  const q = wixLocation.query || {};
  const packRef = q.packRef || q.packKey || q.pack || q.id || q.detailsSlug || q.slug || "";
  const stage = q.stage || q.packageTier || q.tier || "";

  try {
    return await getEngineLandingPayload({ packRef, stage });
  } catch (e) {
    return {
      ctx: { viewMode: "page", initialFilters: { packRef, stage } },
      links: {},
      packs: [],
      featured: null,
      promos: [],
      benefits: [],
      meta: {},
      detailMeta: { weeklySpecials: [], featureSegments: [], cta: null },
      debug: { ok: false, errors: [String(e?.message || e)] },
    };
  }
}

$w.onReady(() => {
  const iframe = $w("#buildLandPageHtml");

  iframe.onMessage((event) => {
    const data = event.data;

    if (!data || data.type !== "CULTR_HEIGHT") return;

    const height = Number(data.height);
    if (!height || height < 300) return;

    iframe.height = Math.min(height, 20000); // Wix safety cap
  });
});


  await controller.mount($w);

  const html = $w(HTML_ID);

  html.onMessage((event) => {
    let data = event?.data;

    // ✅ tolerate JSON string messages as well as objects
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (e) { data = {}; }
    }
    data = data || {};

    // ✅ NAVIGATION BRIDGE
    if (data.type === "CULTR_NAVIGATE") {
      const target = data.url || data.abs || data.path || "";
      if (target) wixLocationFrontend.to(target);
      return;
    }

    // ✅ LIGHTBOX OPEN BRIDGE
    if (data.type === "CULTR_OPEN_POPUP" && data.id) {
      wixWindow.openLightbox(data.id, data.data || {});
      return;
    }

    // optional log
    if (data.type === "CULTR_LOG") {
      console.log("[ENGINE LANDING IFRAME]", data.level || "info", data.message || data);
    }
  }

);