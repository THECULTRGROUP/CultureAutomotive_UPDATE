import wixData from "wix-data";
import wixLocation from "wix-location";

$w.onReady(async () => {
  const packKey = wixLocation.query.packKey;
  if (!packKey) {
    $w("#buildWorkflowHtml").postMessage({
      type: "ERROR",
      message: "Missing packKey in URL. Add ?packKey=your-pack-key"
    });
    return;
  }

  try {
    // 1) Parent pack (3rd collection)
    const packRes = await wixData.query("EnginePacks")
      .eq("packKey", packKey)
      .limit(1)
      .find();

    const pack = packRes.items?.[0] || { packKey };

    // 2) Timeline steps
    const timelineRes = await wixData.query("EnginePackTimelineSteps")
      .eq("packKey", packKey)
      .eq("Status", "PUBLISHED")
      .ascending("order")
      .find();

    // 3) Tier/Add-on cards
    const tiersRes = await wixData.query("EnginePackTiers")
      .eq("packKey", packKey)
      .eq("Status", "PUBLISHED")
      .ascending("order")
      .find();

    const payload = {
      packKey,
      pack: {
        // map these to your real EnginePacks fields
        name: pack.title || pack.name || pack.packName || "Engine Package",
        subtitle: pack.subtitle || pack.tagline || "",
        buildId: pack.buildId || packKey,
        tier: pack.tierLabel || pack.tier || "",
        heroNotes: pack.heroNotes || pack.description || ""
      },
      timelineSteps: timelineRes.items.map(x => ({
        id: x._id,
        title: x.Title,
        weekLabel: x.weekLabel,
        text: x.text,
        stepKey: x.stepKey,
        order: x.order,
        complexityTier: x.complexityTier || null
      })),
      tierCards: tiersRes.items.map(x => ({
        id: x._id,
        stageKey: x.stageKey,
        cardName: x.cardName,
        tag: x.tag,
        description: x.description,
        includes: x.includes,
        baseAUD: x.baseAUD,
        installRequired: x.installRequired,
        locked: x.locked,
        defaultChecked: x.defaultChecked,
        contributes: x.contributes,
        order: x.order
      }))
    };

    // Send to HTML
    $w("#buildWorkflowHtml").postMessage({
      type: "INIT_PAYLOAD",
      payload
    });

  } catch (err) {
    $w("#buildWorkflowHtml").postMessage({
      type: "ERROR",
      message: "Failed to load workflow data.",
      detail: String(err)
    });
  }
});
