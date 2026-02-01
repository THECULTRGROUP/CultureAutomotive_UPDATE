// ===== Events Hub — Host bridge (Wix Studio / Velo) =====
// Collections:
// - Events:   "Import976"
// - Features: "features"
// - My Scene: "MyScene"
// HTML Component (iframe) id: #eventsHubFrame

import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import wixUsers from 'wix-users';
import { currentMember } from 'wix-members'; // <-- Studio-safe import

const EVENTS   = 'Import976';
const FEATURES = 'features';
const MYSCENE  = 'MyScene';
const IFRAME   = '#eventsHubFrame';

const PHONE_E164    = '+61861616266';
const SUPPORT_EMAIL = 'info@culture-automotive.com';

// ---------- utils ----------
const $frame = () => $w(IFRAME);
const toNum = v => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };
const fromCsv = v => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s=>s.trim()).filter(Boolean) : []);
const cleanUrl = raw => {
  const s = String(raw || '').trim();
  if (!s || /^javascript:/i.test(s)) return '#';
  if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s;
  return 'https://' + s.replace(/^\/+/, '');
};

async function getMember() {
  try { const m = await currentMember.getMember(); return m || null; }
  catch { return null; }
}
async function getMemberName() {
  const m = await getMember();
  if (!m) return '';
  const name = [m.contactDetails?.firstName, m.contactDetails?.lastName].filter(Boolean).join(' ');
  return name || m.loginEmail || '';
}

// ---------- mappers ----------
function mapEvent(i){
  return {
    id: i._id,
    title: i.title || 'Event',
    venue: i.venue || '',
    lat: toNum(i.lat),
    lon: toNum(i.lon),
    start: i.start,
    end: i.end || i.start,
    price: toNum(i.price),
    infoUrl: i.infoUrl || '',
    ticketUrl: i.ticketUrl || '',
    img: i.img || '',
    scene: fromCsv(i.scene),
    featured: !!(i.featured || i.featuredMonthly),
    featuredMonthly: !!i.featuredMonthly
  };
}
function mapFeature(i){
  return { id:i._id, title:i.title||'Feature', img:i.img||'', ctaUrl:i.ctaUrl||'', areaTag:i.areaTag||'', tagline:i.tagline||'' };
}

// ---------- data ----------
async function fetchEvents(){
  try{
    const res = await wixData.query(EVENTS).ascending('start').limit(400).find();
    return (res.items||[]).map(mapEvent);
  }catch(e){
    console.error('[EventsHub] events query failed:', e);
    return [];
  }
}
async function fetchFeatures(filter = {}){
  try{
    let q = wixData.query(FEATURES).limit(50);
    if (filter?.areaTag) q = q.eq('areaTag', String(filter.areaTag));
    const res = await q.find();
    return (res.items||[]).map(mapFeature);
  }catch(e){
    console.warn('[EventsHub] features query failed:', e);
    return [];
  }
}

async function addToMyScene(payload){
  const member = await getMember();
  if (!member) return { ok:false, reason:'signin' };

  const memberId = member._id;
  const { eventId, title, start, end, venue, lat, lon, ticketUrl, infoUrl, scene, price } = payload || {};
  if (!eventId) return { ok:false, reason:'bad-payload' };

  try{
    const existing = await wixData.query(MYSCENE)
      .eq('memberId', memberId).eq('eventId', eventId).limit(1).find();
    if (existing.items?.length) return { ok:true, already:true };

    await wixData.insert(MYSCENE, {
      memberId, eventId, title: title || '',
      savedAt: new Date(),
      start, end,
      venue: venue || '',
      lat: toNum(lat), lon: toNum(lon),
      ticketUrl: ticketUrl || '', infoUrl: infoUrl || '',
      scene: fromCsv(scene), status:'saved', price: toNum(price)
    });
    return { ok:true };
  }catch(e){
    console.error('[EventsHub] addToMyScene failed:', e);
    return { ok:false, reason:'error' };
  }
}

// ---------- bridge ----------
$w.onReady(async ()=>{
  const frame = $frame();
  if (!frame) { console.error('[EventsHub] HTML component not found:', IFRAME); return; }

  frame.onMessage(async (event)=>{
    const d = event?.data || {};
    switch (d.type) {

      case 'eventsHubHeight': {
        const h = Math.max(320, Math.ceil(Number(d.height) || 0));
        frame.height = h;
        break;
      }

      case 'openExternal': {
        const u = cleanUrl(d.url || '');
        if (u && u !== '#') wixLocation.to(u);
        break;
      }

      // Contact actions (no direct Chatbox API calls)
      case 'openChat': {
        // Try a custom Chat lightbox if you’ve created one; otherwise fallback to contact page
        try { await wixWindow.openLightbox('Chat'); }
        catch { wixLocation.to('/contact'); }
        break;
      }
      case 'openPhone': {
        wixLocation.to(`tel:${PHONE_E164}`);
        break;
      }
      case 'openEmail': {
        const who = await getMemberName();
        const subject = encodeURIComponent(`ENQUIRY/Website — Events Hub${who ? ' — ' + who : ''}`);
        wixLocation.to(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
        break;
      }

      case 'wazeNavigate': {
        const { lat, lon } = d || {};
        if (isFinite(lat) && isFinite(lon)) {
          wixLocation.to(`https://waze.com/ul?ll=${lat},${lon}&navigate=yes`);
        }
        break;
      }

      case 'requestEvents': {
        frame.postMessage({ type:'events', payload: await fetchEvents() });
        break;
      }
      case 'requestFeatures': {
        frame.postMessage({ type:'features', payload: await fetchFeatures(d.filter || {}) });
        break;
      }
      case 'requestUserMeta': {
        const name = await getMemberName();
        frame.postMessage({ type:'userMeta', payload:{ displayName: name } });
        break;
      }

      case 'addToMyScene': {
        const res = await addToMyScene(d.payload || {});
        if (res.ok)              frame.postMessage({ type:'savedToMyScene', payload:{ already: !!res.already } });
        else if (res.reason==='signin') frame.postMessage({ type:'signinRequired' });
        break;
      }

      default: break;
    }
  });

  // Tell iframe host is ready
  setTimeout(()=>{ try { frame.postMessage({ type:'hostPing' }); } catch(_) {} }, 250);
});
