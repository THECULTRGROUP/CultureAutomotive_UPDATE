import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixUsers from 'wix-users';
import wixWindow from "@wix/site-window";

const IFRAME_ID = '#homeLandingZoneFrame';

/**
 * IMPORTANT:
 * These must be your COLLECTION IDs (not display names).
 * If yours differ, update here.
 */
const COLLECTION_IDS = {
  featured: 'FeaturedAccess',
  services: 'CoreServices',
  finance:  'loanOptions' // ✅ your confirmed Loan Options ID
};

function mapItem(item){
  return {
    title: item.title || '',
    description: item.description || '',
    image_url: item.image_url || '',     // ✅ baseline field
    ctaLink: item.ctaLink || '',         // ✅ baseline field
    ctaLabel: item.ctaLabel || '',       // ✅ baseline field
    showOnHomepage: item.showOnHomepage, // ✅ baseline field
    isMembersOnly: item.isMembersOnly,   // ✅ baseline field
    priority: Number(item.priority || 0)
  };
}

async function getItems(collectionId, limit){
  const res = await wixData.query(collectionId)
    .eq('showOnHomepage', true)      // ✅ STRICT (fixes unticked still showing)
    .descending('priority')
    .limit(limit)
    .find();

  return (res.items || []).map(mapItem).slice(0, limit);
}

async function buildPayload(){
  const viewer = { loggedIn: wixUsers.currentUser.loggedIn };

  const [featured, services, finance] = await Promise.all([
    getItems(COLLECTION_IDS.featured, 6),
    getItems(COLLECTION_IDS.services, 9),
    getItems(COLLECTION_IDS.finance,  12)
  ]);

  return { viewer, featured, services, finance };
}

function postDataToIframe(frame, payload){
  frame.postMessage({ type:'CULTR_DATA', payload });
}

async function openContactPopup(popupId = 'globalContactAuto', formId = 'globalContactForm'){
  // 1) Try to open on-page popup element
  try{
    const popup = $w(`#${popupId}`);
    if(popup){
      if (popup.collapsed) popup.expand();
      if (typeof popup.show === 'function') popup.show();
      if (typeof popup.scrollTo === 'function') popup.scrollTo();
    }

    const form = $w(`#${formId}`);
    if(form && typeof form.scrollTo === 'function'){
      await form.scrollTo();
    }
    return;
  }catch(e){
    // keep going
  }

  // 2) Fallback: if it's actually a Lightbox
  try{
    await wixWindow.openLightbox(popupId);
  }catch(e){
    console.warn('[VELO] Could not open popup/lightbox:', e);
  }
}

$w.onReady(() => {
  const frame = $w(IFRAME_ID);

  frame.onMessage(async (event) => {
    const msg = event.data;
    if(!msg) return;

    if(msg.type === 'CULTR_LOG'){
      console.log('[IFRAME]', msg.payload);
      return;
    }

    if(msg.type === 'CULTR_HEIGHT' && typeof msg.height === 'number'){
      // ✅ auto-fit height -> removes bottom gap + iframe scrollbar
      frame.height = Math.max(320, Math.ceil(msg.height + 8));
      return;
    }

    if(msg.type === 'CULTR_POPUP'){
      await openContactPopup(msg.popupId, msg.formId);
      return;
    }

    if(msg.type === 'CULTR_NAVIGATE' && msg.url){
      wixLocation.to(msg.url);
      return;
    }

    if(msg.type === 'CULTR_READY'){
      console.log('[VELO] CULTR_READY received — building payload...');
      try{
        const payload = await buildPayload();
        postDataToIframe(frame, payload);

        // ✅ Retry sends (Preview sometimes drops first postMessage)
        setTimeout(()=>postDataToIframe(frame, payload), 700);
        setTimeout(()=>postDataToIframe(frame, payload), 1600);

        console.log('[VELO] Payload posted ✅', payload);
      }catch(e){
        console.error('[VELO] buildPayload failed ❌', e);
      }
    }
  });
});
