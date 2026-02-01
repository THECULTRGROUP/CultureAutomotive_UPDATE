// RepaymentEstimator lightbox page code
import wixWindow from 'wix-window';
import wixLocation from 'wix-location';

$w.onReady(() => {
  const ctx = wixWindow.lightbox.getContext() || {};
  // Send both READY and INIT_META to the iframe
  $w('#toolFrame').onMessage(({ data }) => {
    if (data && data.type === 'IFRAME_READY') {
      $w('#toolFrame').postMessage({ type:'INIT_META', meta: ctx });
    }
    if (data && data.type === 'CULTR_FINANCE_DEEPLINK') {
      const route = String(data.route || '');
      if (route.startsWith('/')) wixLocation.to(route);
      if (route === 'lightbox:close') wixWindow.close();
    }
  });
});
