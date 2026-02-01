// Static page that hosts travel-landing.html in an HTML iframe component
import wixData from 'wix-data';

$w.onReady(async () => {
  const frame = $w('#travelExperiencesFrame'); // e.g. '#html1' if that's your element ID
  if (!frame || typeof frame.postMessage !== 'function') {
    console.warn('Experiences: iframe not found or wrong ID.');
    return;
  }

  // 1) Auto-resize: page scrolls, not the iframe
  if (typeof window !== 'undefined') {
    window.addEventListener('message', (evt) => {
      if (evt?.data?.type === 'EMBED_HEIGHT' && typeof evt.data.h === 'number') {
        const h = Math.max(400, evt.data.h + 20); // breathing room for shadows
        frame.height = h;                 // works in Editor
        frame.style.height = `${h}px`;    // works when published
      }
    });
  }

  // 2) Load TravelPackages and post to iframe
  try {
    const results = await wixData.query('TravelPackages').limit(1000).find();
    const items = (results.items || []).map(it => {
      const out = { ...it };
      if (!out.heroImage && out.herolmage) out.heroImage = out.herolmage; // typo fallback
      if (!Array.isArray(out.images) && out.gallery) out.images = out.gallery;
      return out;
    });

    frame.postMessage({ type: 'TRAVEL_DATA', items });
  } catch (err) {
    console.error('Experiences: data load failed', err);
  }

  // 2) Load TravelPackages and post to iframe
  try {
    const results = await wixData.query('Vehicles').limit(1000).find();
    const items = (results.items || []).map(it => {
      const out = { ...it };
      if (!out.heroImage && out.herolmage) out.heroImage = out.herolmage; // typo fallback
      if (!Array.isArray(out.images) && out.gallery) out.images = out.gallery;
      return out;
    });

    frame.postMessage({ type: 'SET_DATA', items });
  } catch (err) {
    console.error('Experiences: data load failed', err);
  }
});
