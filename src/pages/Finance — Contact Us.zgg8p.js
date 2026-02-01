// Page Code (Wix)
// IDs: #contactFrame (HTML component)
import wixLocation from 'wix-location';

$w.onReady(() => {
  if ($w('#financeContactUs')) {
    $w('#financeContactUs').onMessage((event) => {
      const data = event.data || {};
      if (data.type !== 'CULTR_FINANCE_DEEPLINK') return;
      const to = String(data.route || '');
      if (to.startsWith('/')) wixLocation.to(to);
    });
  }
});
