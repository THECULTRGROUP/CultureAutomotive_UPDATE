// FILE: /loan-options (page code)
import wixLocation from 'wix-location';
import wixData from 'wix-data';
import { local } from 'wix-storage';

const FRAME_ID = '#loanOptionsFrame';
const COLLECTION = 'loanOptions';

let frameReady = false;

function getFrame(){ try { return $w(FRAME_ID); } catch(_) { return null; } }
function postToFrame(payload){ const f=getFrame(); if(f) try{ f.postMessage(payload); }catch(_){} }

async function fetchLoans(){
  // Pull Visible items only; adjust field names if your status flag differs
  const res = await wixData.query(COLLECTION)
    .eq('status','Visible')
    .limit(100)
    .find();
  return res.items || [];
}

$w.onReady(async ()=>{
  const frame = getFrame(); if(!frame) return;

  // receive deeplinks + ready from iframe
  frame.onMessage(({ data })=>{
    if(!data) return;
    if(data.type==='CULTR_FINANCE_DEEPLINK'){
      const route = String(data.route||'');
      if (route.startsWith('/interactive-finder') && route.includes('preset=')) {
        try{ const u=new URL(route,'https://x/'); const p=u.searchParams.get('preset'); if(p) local.setItem('finderPreset',p); }catch(_){}
      }
      if(route.startsWith('/')) wixLocation.to(route);
    }
    if(data.type==='IFRAME_READY'){
      frameReady = true;
      // send fresh CMS payload on ready
      fetchLoans().then(items=>postToFrame({ type:'LOAD_LOANS', items }));
    }
  });

  // also push once on page load in case the ready message was missed
  const items = await fetchLoans();
  postToFrame({ type:'LOAD_LOONS', items }); // typo-proof resend is below
  // Correct idempotent send
  postToFrame({ type:'LOAD_LOANS', items });
});