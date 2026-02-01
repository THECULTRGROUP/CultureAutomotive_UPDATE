// ===== Live Map — Host Bridge (stable) =====
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import wixData from 'wix-data';
import wixUsers from 'wix-users';
import { currentMember } from 'wix-members';

const MAP_IFRAME_ID       = '#liveMapFrame';
const EVENTS_COLLECTION   = 'Import976';
const PARTNERS_COLLECTION = 'Import611';
const JOIN_COLLECTION     = 'MyScene';
const BRAND_URL           = 'https://static.wixstatic.com/media/44d808_08edb1081b6f4758b1ec0eb02664dd67~mv2.jpg';

let frame;
let acked = false;        // iframe handshake
let lastSent = { events: 0, partners: 0 };

$w.onReady(async () => {
  frame = $w(MAP_IFRAME_ID);

  // Listen to messages from the iframe
  frame.onMessage(async (evt) => {
    const d = evt?.data || {};
    if (!d || !d.type) return;

    // --- Navigation / Actions ---
    if (d.type === 'openMyScene') {
      // Use relative path to avoid protocol differences.
      return wixLocation.to('/myscene');
    }

    if (d.type === 'openChat') {
      try {
        if ($w('#wixChat1')?.expand) {
          $w('#wixChat1').expand();
          return;
        }
        await wixWindow.openLightbox('ChatLightbox');
      } catch (e) {
        try {
          await ensureLoggedIn();
          if ($w('#wixChat1')?.expand) $w('#wixChat1').expand();
        } catch (e2) {
          safePost({ type: 'toast', level: 'warn', text: 'Please log in to use chat.' });
        }
      }
      return;
    }

    if (d.type === 'openLightboxById') {
      const raw = String(d.id || '').trim();
      if (!raw) return;
      const name = raw.replace(/^#/, '');
      try {
        await wixWindow.openLightbox(name);
      } catch (e) {
        if (name.toLowerCase() === 'eventsubmitpopup') {
          safePost({ type: 'toast', level: 'info', text: 'Opening web form…' });
          return wixLocation.to('/event-form');
        }
        safePost({ type: 'toast', level: 'warn', text: 'Unable to open that popup.' });
      }
      return;
    }

    // --- Handshake / Data requests ---
    if (d.type === 'hostPing') {
      acked = true;
      safePost({ type: 'hostReady' });
      safePost({ type: 'brandLogo', url: BRAND_URL });
      // Push fresh data immediately
      safePost({ type: 'partners', payload: await fetchPartners() });
      safePost({ type: 'events',   payload: await fetchEvents() });
      return;
    }

    if (d.type === 'requestEvents')   return safePost({ type: 'events',   payload: await fetchEvents() });
    if (d.type === 'requestPartners') return safePost({ type: 'partners', payload: await fetchPartners() });

    if (d.type === 'addToMyScene') {
      const eventId = d.payload?.eventId || d.eventId;
      if (!eventId) return;
      let memberId = await getMemberId();
      if (!memberId) {
        try { await ensureLoggedIn(); } catch(_) {}
        memberId = await getMemberId();
        if (!memberId) return;
      }
      try {
        const existing = await wixData.query(JOIN_COLLECTION)
          .eq('memberId', memberId).eq('eventId', eventId).find();
        const ev = await wixData.get(EVENTS_COLLECTION, eventId).catch(() => ({}));
        const name = ev?.title || 'Event';
        if (existing.items?.length) {
          safePost({ type: 'toast', level: 'info', text: `“${name}” is already saved.` });
        } else {
          await wixData.insert(JOIN_COLLECTION, { memberId, eventId, savedAt: new Date(), status: 'active' });
          safePost({ type: 'toast', level: 'success', text: `Saved “${name}” to My Scene.` });
        }
      } catch (e) {
        safePost({ type: 'toast', level: 'warn', text: 'Unable to save event.' });
      }
    }
  });

  // Initial hello & brand
  safePost({ type: 'brandLogo', url: BRAND_URL });
  safePost({ type: 'hostReady' });

  // Preload both datasets once; the iframe can also request again
  try {
    const [partners, events] = await Promise.all([fetchPartners(), fetchEvents()]);
    safePost({ type: 'partners', payload: partners });
    safePost({ type: 'events',   payload: events });
  } catch (_) {}

  // Small watchdog: if the iframe never acked, re-notify & re-send once
  setTimeout(async () => {
    if (!acked) {
      safePost({ type: 'hostReady' });
      safePost({ type: 'brandLogo', url: BRAND_URL });
      const [partners, events] = await Promise.all([fetchPartners(), fetchEvents()]);
      safePost({ type: 'partners', payload: partners });
      safePost({ type: 'events',   payload: events });
    }
  }, 1500);
});

/* ---------- helpers ---------- */
function safePost(payload) { try { frame?.postMessage(payload); } catch (_) {} }

async function ensureLoggedIn() {
  if (wixUsers.currentUser.loggedIn) return true;
  const res = await wixUsers.promptLogin({ mode: 'login' });
  if (!res?.user?.loggedIn) throw new Error('login-cancelled');
  return true;
}

const toNum = (v) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'string' ? Number(v.replace(/[, ]+/g, '')) : Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const toDate = (v) => {
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string' && v.trim()) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(v) : undefined;
  }
  return undefined;
};
const toArr = (raw) => Array.isArray(raw)
  ? raw.filter(Boolean)
  : (typeof raw === 'string' ? raw.split(',').map(s => s.trim()).filter(Boolean) : []);

/* ---------- mapping ---------- */
function mapEvent(i) {
  return {
    id: i._id,
    title: i.title || 'Event',
    venue: i.venue || i.locationName || '',
    lat: toNum(i.lat ?? i.latitude),
    lon: toNum(i.lon ?? i.lng ?? i.longitude),
    start: toDate(i.start),
    end: toDate(i.end) || toDate(i.start),
    url: i.url || i.ticketUrl || '',
    infoUrl: i.infoUrl || i.url || '',
    ticketUrl: i.ticketUrl || i.url || '',
    img: i.img || i.image || i.cover || '',
    scene: toArr(i.scene),
    featured: !!(i.featured || i.featuredMonthly),
    featuredMonthly: !!i.featuredMonthly
  };
}

function mapPartner(i) {
  // Socials: gather typical fields if present
  const socials = [
    i.facebook, i.instagram, i.tiktok, i.youtube, i.twitter, i.linkedin, i.website
  ].filter(Boolean);

  return {
    id: i._id,
    name: i.name || '',
    locationName: i.locationName || '',
    lat: toNum(i.lat ?? i.latitude),
    lon: toNum(i.lon ?? i.lng ?? i.longitude),
    businessLogo: i.businessLogo || i.logo || i.image || i.cover || i.img || '',
    contactUrl: i.contactUrl || i.website || i.infoUrl || '',
    specialOffers: !!(i.specialOffers || i.specialOffer || i['#specialOffer']),
    specialOfferItem: i.specialOfferItem || i['#specialOfferItem'] || '',
    buyNow: i.buyNow || i['#buyNow'] || '',
    mainPhone: i.mainPhone || i.phone || '',
    contactEmail: i.contactEmail || i.email || '',
    socials,
    tags: toArr(i.tags || i.services)
  };
}

/* ---------- data ---------- */
async function fetchEvents() {
  try {
    const r = await wixData.query(EVENTS_COLLECTION)
      .gt('start', new Date())
      .ascending('start')
      .limit(1000).find();
    const list = (r.items || []).map(mapEvent)
      .filter(x => x.lat !== undefined && x.lon !== undefined);
    lastSent.events = Date.now();
    if (list.length) return list;
  } catch (_) {}
  try {
    const r2 = await wixData.query(EVENTS_COLLECTION).ascending('start').limit(1000).find();
    const list = (r2.items || []).map(mapEvent)
      .filter(x => x.lat !== undefined && x.lon !== undefined);
    lastSent.events = Date.now();
    return list;
  } catch (_) { return []; }
}

async function fetchPartners() {
  try {
    const r = await wixData.query(PARTNERS_COLLECTION).limit(1000).find();
    const list = (r.items || []).map(mapPartner)
      .filter(x => x.lat !== undefined && x.lon !== undefined);
    lastSent.partners = Date.now();
    return list;
  } catch (_) { return []; }
}

/* ---------- my scene ---------- */
async function getMemberId() {
  try {
    const { member } = await currentMember.getMember({ fieldsets: ['FULL'] });
    return member?._id || null;
  } catch (_) { return null; }
}