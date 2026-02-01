import wixLocation from 'wix-location';
import wixData from 'wix-data';
import { local } from 'wix-storage';   // ✅ use wix-storage

$w.onReady(async function () {
  const frame = $w('#finderFrame');             // HtmlComponent ID
  if (!frame) return;

  // --- 1) Read preset from URL or stored preference
  const preset = wixLocation.query.preset || local.getItem('finderPreset') || null;
  let presetItem = null;

  if (preset) {
    try {
      const { items } = await wixData.query('loanOptions')
        .eq('loanId', preset)        // field in your collection
        .limit(1)
        .find();
      if (items.length) presetItem = items[0];
    } catch (e) {
      console.warn('Finder preset query failed:', e);
    }
  }

  // --- 2) Listen to messages from the iframe (ready + deeplinks)
  frame.onMessage((event) => {
    const data = event.data || {};
    if (data.type !== 'CULTR_FINANCE_DEEPLINK') return;

    const route = String(data.route || '');

    // a) Iframe is ready – push the preset if we have one
    if (route === 'iframe-ready') {
      if (presetItem) {
        frame.postMessage({ type: 'PRESET_LOAD', item: presetItem });
      }
      return;
    }

    // b) Normal site navigation triggered inside iframe
    if (route.startsWith('/')) {
      // Remember last-picked preset for UX continuity
      if (route.startsWith('/interactive-finder')) {
        const url = new URL(route, 'https://example.com');
        const p = url.searchParams.get('preset');
        if (p) local.setItem('finderPreset', p);
      }
      wixLocation.to(route);
    }
  });
});