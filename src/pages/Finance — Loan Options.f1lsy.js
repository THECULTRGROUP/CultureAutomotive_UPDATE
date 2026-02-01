// FILE: /loan-options (Wix Velo page code)
import wixLocation from 'wix-location';
import { local } from 'wix-storage';

// ID of the HtmlComponent in your page
const FRAME_ID = '#loanOptionsFrame';

// Known loan IDs present in the iframe (keeps parent <-> iframe consistent)
const AVAILABLE_LOANS = [
  'automotive',
  'vehicle-equipment',
  'business',
  'personal',
  'investment',
  'refinance',
  'express-cash',
  'payment-plan'
];

$w.onReady(() => {
  const frame = $w(FRAME_ID);
  if (!frame) {
    console.warn('loan-options: HtmlComponent not found:', FRAME_ID);
    return;
  }

  // Safe post helper (wraps frame.postMessage)
  function postToFrame(payload) {
    if (!payload) return;
    try {
      frame.postMessage(payload);
    } catch (err) {
      console.error('loan-options: failed to postMessage to iframe', err, payload);
    }
  }

  // Handle messages coming FROM the iframe
  frame.onMessage((event) => {
    const data = event && event.data;
    if (!data) return;

    // 1) DEEPLINK messages (primary navigation / UX actions)
    if (data.type === 'CULTR_FINANCE_DEEPLINK') {
      const route = String(data.route || '');
      const meta = data.meta || {};

      // store finder preset (for UX continuity)
      if (route.startsWith('/interactive-finder') && route.includes('preset=')) {
        try {
          const u = new URL(route, 'https://x/');
          const p = u.searchParams.get('preset');
          if (p) local.setItem('finderPreset', p);
        } catch (e) {
          console.warn('loan-options: malformed finder route', route);
        }
      }

      // special non-navigational ping from iframe — acknowledge but do not navigate
      if (route === 'iframe-ready' || route === 'iframe-loaded' || route === '') {
        // send an ACK back (parent -> iframe)
        postToFrame({
          type: 'PARENT_ACK',
          status: 'ok',
          ts: Date.now(),
          preset: local.getItem('finderPreset') || null
        });
        // On ready, proactively send available loans and preset (if present)
        if (route === 'iframe-loaded' || route === 'iframe-ready') {
          postToFrame({ type: 'AVAILABLE_LOANS', loans: AVAILABLE_LOANS });
          const preset = local.getItem('finderPreset');
          if (preset) postToFrame({ type: 'SET_FINDER_PRESET', preset });
        }
        return;
      }

      // navigate for routes that are app/internal paths or full urls
      try {
        if (route.startsWith('/')) {
          wixLocation.to(route);
        } else if (route.startsWith('http')) {
          // external link: still navigate via wixLocation.to (Wix allows absolute URLs)
          wixLocation.to(route);
        } else {
          // If it's a hash or other, optionally ignore or handle differently
          console.log('loan-options: received non-navigational route', route, meta);
        }
      } catch (e) {
        console.error('loan-options: navigation error for route', route, e);
      }

      return;
    }

    // 2) Lifecycle / control messages from iframe
    if (data.type === 'CULTR_FINANCE_IFRAME') {
      // Example: { type: 'CULTR_FINANCE_IFRAME', name: 'iframe-loaded', details: { ... } }
      console.log('loan-options: iframe lifecycle:', data.name, data.details || {});
      // ACK back
      postToFrame({ type: 'PARENT_ACK', status: 'received', name: data.name, ts: Date.now() });

      // If iframe says it's loaded, ensure preset + available loans are sent
      if (data.name === 'iframe-loaded') {
        postToFrame({ type: 'AVAILABLE_LOANS', loans: AVAILABLE_LOANS });
        const preset = local.getItem('finderPreset');
        if (preset) postToFrame({ type: 'SET_FINDER_PRESET', preset });
      }
      return;
    }

    // 3) iframe requests available loans explicitly
    if (data.type === 'GET_AVAILABLE_LOANS') {
      postToFrame({ type: 'AVAILABLE_LOANS', loans: AVAILABLE_LOANS });
      return;
    }

    // 4) iframe returned available loans (if it computed them)
    if (data.type === 'AVAILABLE_LOANS') {
      // optional: record or log what the iframe claims
      console.log('loan-options: iframe says available loans:', data.loans);
      return;
    }

    // Unknown/unhandled message
    console.debug('loan-options: unhandled iframe message:', data);
  });

  // Public helpers (use in console or other page code to command iframe)
  // Example usage from page console: highlightLoanInIframe('automotive')
  window.highlightLoanInIframe = function (loanId) {
    if (!loanId) return;
    postToFrame({ type: 'HIGHLIGHT_LOAN', loanId });
  };

  // Save preset and notify iframe
  window.setFinderPresetInIframe = function (preset) {
    if (!preset) return;
    try { local.setItem('finderPreset', preset); } catch (e) {}
    postToFrame({ type: 'SET_FINDER_PRESET', preset });
  };

  // On page load, if we already have a preset, notify the iframe (small delay to let iframe listener bind)
  const initialPreset = local.getItem('finderPreset');
  if (initialPreset) {
    setTimeout(() => {
      postToFrame({ type: 'SET_FINDER_PRESET', preset: initialPreset });
      postToFrame({ type: 'AVAILABLE_LOANS', loans: AVAILABLE_LOANS });
    }, 250);
  }

  // Optional: expose a function to clear preset
  window.clearFinderPreset = function () {
    try { local.removeItem('finderPreset'); } catch (e) {}
    postToFrame({ type: 'SET_FINDER_PRESET', preset: null });
  };

  // All done: log ready
  console.info('loan-options: parent frame listeners initialized for', FRAME_ID);
});