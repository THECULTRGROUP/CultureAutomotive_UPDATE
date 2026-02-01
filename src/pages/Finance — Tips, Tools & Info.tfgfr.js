// FILE: /information (page code)
import wixWindow from 'wix-window';

$w.onReady(() => {
  const frame = $w('#financeInformationFrame');
  if (!frame) return;

  frame.onMessage(({ data }) => {
    if (!data || data.type !== 'CULTR_FINANCE_DEEPLINK') return;
    const route = String(data.route || '');

    if (!route.startsWith('tool:')) return;

    const key = route.split(':')[1];
    switch (key) {
      case 'buffer-check':
        wixWindow.openLightbox('CashflowBufferChecker', data.meta || {});
        break;
      case 'repayment-estimator':
        wixWindow.openLightbox('RepaymentEstimator', data.meta || {});
        break;
      case 'build-planner':
        wixWindow.openLightbox('BuildBudgetPlanner', data.meta || {});
        break;
      default:
        console.warn('Unknown tool:', key);
    }
  });
});
