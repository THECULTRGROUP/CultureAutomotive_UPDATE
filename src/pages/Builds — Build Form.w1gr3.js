// File: Page Code for Build Form page
import wixLocation from 'wix-location';

$w.onReady(() => {
  // Read URL params
  const query = wixLocation.query;
  const initialConfig = {
    engine: query.engine || 'Custom Engine Build',
    tier: query.tier || '',
    power: query.power || '',
    category: query.category || '',
    notes: query.notes || '',
    addons: query.addons || '',
    source: query.source || 'direct'
  };

  // Push into iframe
  $w('#htmlBuildForm').postMessage({
    type: 'buildFormInit',
    source: 'build-form',
    config: initialConfig
  });

  // Listen for submit event from iframe
  $w('#htmlBuildForm').onMessage(async (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'cultrEngine') return;

    if (msg.action === 'submitBuildForm') {
      const { formData, meta } = msg.payload;

      // 1) Save to collection (optional)
      try {
        // Save to dataset if present
        if ($w('#datasetBuildRequests')) {
          const item = {
            engineTitle: meta.engine,
            tier: meta.tier,
            powerWindow: meta.power,
            category: meta.category,
            addons: meta.addons,
            source: meta.source,
            ...formData
          };
          await $w('#datasetBuildRequests').setFieldValues(item);
          await $w('#datasetBuildRequests').save();
        }
      } catch (err) {
        console.error('Error saving build request:', err);
      }

      // 2) Redirect or show a thank-you page
      wixLocation.to('/build-confirm');
    }
  });
});
