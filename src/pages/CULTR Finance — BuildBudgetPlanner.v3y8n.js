// Lightbox Page Code (same for all three)
import wixWindow from 'wix-window';
import wixLocation from 'wix-location';

$w.onReady(() => {
  $w('#toolFrame').onMessage((event) => {
    const data = event.data || {};
    if (data.type !== 'CULTR_FINANCE_DEEPLINK') return;

    const route = String(data.route || '');

    // Close request from the iframe
    if (route === 'lightbox:close') {
      wixWindow.close();
      return;
    }

    // Open another tool from inside a tool (optional)
    if (route.startsWith('tool:')) {
      const key = route.split(':')[1];
      switch (key) {
        case 'repayment-estimator': wixWindow.openLightbox('RepaymentEstimator'); break;
        case 'buffer-checker':      wixWindow.openLightbox('CashflowBufferChecker'); break;
        case 'build-planner':       wixWindow.openLightbox('BuildBudgetPlanner'); break;
        default: console.warn('Unknown tool:', key);
      }
      return;
    }

    // Site navigation
    if (route.startsWith('/')) {
      wixLocation.to(route);
      // Optionally: wixWindow.close();
    }
  });
});