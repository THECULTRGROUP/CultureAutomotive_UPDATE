// site / page code (Velo)
// Handles messages from all CULTR Finance iframes

import wixLocation from 'wix-location';

const DEEPLINK_EVENT = 'CULTR_FINANCE_DEEPLINK';
const SCROLL_EVENT   = 'CULTR_FINANCE_SCROLL_TO';

// Main finance / home iframe selector – used for scroll commands
const HOME_IFRAME_SELECTOR = '#cultrFinanceFrame';

/**
 * Handle a finance deeplink message coming from an iframe.
 * @param {Object} message - event.data from the iframe
 * @param {string} sourceSelector - the selector of the iframe that sent the message
 */
function handleFinanceDeeplink(message, sourceSelector) {
  if (!message || message.type !== DEEPLINK_EVENT) {
    return;
  }

  const route = message.route;
  const meta  = message.meta || {};

  if (!route) {
    return;
  }

  // 1. Iframe handshake / analytics hook
  if (route === 'iframe-ready') {
    console.log('Finance iframe ready:', sourceSelector, meta);
    // Optional: track analytics, resize iframe etc.
    return;
  }

  // 2. Site-level navigation (pages)
  if (route.startsWith('/')) {
    wixLocation.to(route);
    return;
  }

  // 3. Finder / product selections
  if (route.startsWith('finder:')) {
    const key = route.split(':')[1];
    console.log('Open finance finder:', key, 'meta:', meta, 'from:', sourceSelector);
    // TODO: open a lightbox or navigate to a finder page and set state
    return;
  }

  // 4. Tools (calculators, planners, etc.)
  if (route.startsWith('tool:')) {
    const key = route.split(':')[1];
    console.log('Open finance tool:', key, 'meta:', meta, 'from:', sourceSelector);
    // TODO: open a calculator lightbox or scroll to a tool on this page
    return;
  }

  // 5. Scroll commands (page -> iframe)
  if (route.startsWith('scroll:')) {
    const sectionId = route.split(':')[1];
    if (!sectionId) {
      return;
    }

    // Send a scroll command into the home finance iframe
    const homeIframe = $w(HOME_IFRAME_SELECTOR);
    if (homeIframe && homeIframe.postMessage) {
      homeIframe.postMessage({
        type: SCROLL_EVENT,
        sectionId
      });
    }

    return;
  }

  // Fallback for anything unexpected
  console.log('Unhandled finance deeplink route:', route, 'meta:', meta, 'from:', sourceSelector);
}

/**
 * Attach a message listener to an HTML iframe component, if it exists.
 * @param {string} selector - e.g. "#cultrFinanceFrame"
 */
function wireFinanceIframe(selector) {
  let comp;

  try {
    comp = $w(selector);
  } catch (err) {
    // Selector not on this page; safely ignore
    return;
  }

  if (!comp || !comp.onMessage) {
    return;
  }

  comp.onMessage((event) => {
    handleFinanceDeeplink(event.data, selector);
  });
}

$w.onReady(() => {
  // Wire up all current finance iframes on this page.
  // Add extra selectors here if you create more HTML components later
  [
    '#cultrFinanceFrame', // Finance home
    '#loanOptionsFrame',   // Loans & Options
    '#infoFrame'           // Tools & Tips
    // '#financeApplicationHtml', // example of another iframe you might add later
  ].forEach(wireFinanceIframe);
});
