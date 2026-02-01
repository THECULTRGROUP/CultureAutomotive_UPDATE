// Page Code: /engine-build/build-catalogue
import wixLocation from "wix-location";
import { initCultrFrameController } from "public/cultrEngineFrameController";
import { getEngineCataloguePayload } from "backend/engineCatalogue";

const HTML_ID = "#buildCatalogueHtml";
const PAYLOAD_TYPE = "CULTR_ENGINE_CATALOGUE";
const READY_TYPE = "CULTR_ENGINE_CATALOGUE_READY";

async function getPayload() {
  const q = wixLocation.query || {};
  const packRef =
    q.packRef || q.packKey || q.pack || q.id || q.detailsSlug || q.slug || "";
  const stage = q.stage || q.packageTier || q.tier || "";

  try {
    return await getEngineCataloguePayload({ packRef, stage });
  } catch (e) {
    return {
      ctx: { viewMode: "page", initialFilters: { packRef, stage } },
      links: {},
      filterOptions: { platforms: [], tiers: [], hpBands: [] },
      packs: [],
      compare: { max: 3, lightboxId: "lightbox1" },
      ui: { title: "Engine Build Catalogue", subtitle: "Payload failed to load." },
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
    initialH: 9000,
    heightPollMs: 350,
  });

  await controller.mount($w);

  const html = $w(HTML_ID);
  html.onMessage((event) => {
    const data = event?.data || {};

    if (data.type === "CULTR_NAVIGATE") {
      const target = data.url || data.abs || data.path || "";
      if (target) wixLocation.to(target);
      return;
    }

    if (data.type === "CULTR_LOG") {
      console.log("[CATALOGUE IFRAME]", data.level || "info", data.message || data);
    }
  });
});