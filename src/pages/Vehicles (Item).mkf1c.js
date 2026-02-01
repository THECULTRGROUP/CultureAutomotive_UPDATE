// Page code (Front-end)
// File: pages/vehicles/[dynamic].js

import wixData from 'wix-data';
import wixLocation from 'wix-location';

$w.onReady(async () => {
  const html = $w('#vehHtml');

  // Load the current vehicle – prefer dataset if present, else query by slug
  const item = await getCurrentVehicle();
  if (!item) {
    console.warn('Vehicle not found for path:', wixLocation.path);
    return;
  }

  // Resolve references in parallel (best-effort, each safely falls back)
  const [locs, tags, feats, policies] = await Promise.all([
    queryRef(item, 'locationId'),
    queryRef(item, 'tagIds'),
    queryRef(item, 'featureId'),
    queryRef(item, 'policyId')
  ]);

  const location = (locs && locs[0]) || null;
  const tagNames = (tags || []).map(n => n.title || n.name || n.label).filter(Boolean);
  const featNames = (feats || []).map(n => n.title || n.name || n.label).filter(Boolean);

  // Build image list: hero + gallery
  const hero = asHttps(item.heroImage);
  const gallery = extractGallery(item.gallery).map(asHttps);
  const images = dedupe([hero, ...gallery]).filter(Boolean).slice(0, 6);

  // Subtitle = year • transmission • driveType
  const subtitle = [item.year, item.transmission, item.driveType]
    .map(v => (v == null ? '' : String(v).trim()))
    .filter(Boolean)
    .join(' • ');

  // Location label
  const locationLabel =
    (location && (location.city && location.region
      ? `${location.city} / ${location.region}`
      : (location.city || location.title || location.name))) || '';

  // Highlights / tags row – add derived chips
  const derivedChips = dedupe([
    item.transmission,
    item.driveType,
    item.seats ? `${item.seats} Seats` : null,
    ...splitByDot(item.badgeText) // e.g., "Auto • RWD • 5 • 242hp"
  ]).filter(Boolean);

  // Specs
  const specs = {
    engine: stripHtml(item.engineSpecs || ''),
    power: item.powerOutputHp ? `${Math.round(item.powerOutputHp)} hp` : '',
    trans: item.transmission || '',
    drive: item.driveType || '',
    chassis: stripHtml(item.driverFeature || '')
    // Other spec fields (dyno, boost, tyres, etc.) are not in the current collection;
    // add fields later and they'll plug in easily here.
  };

  // About section – prefer full HTML description
  const aboutHtml = item.description || item.summary || '';

  // Availability
  const available = item.availabilityStatus === true;

  // Build CTA link; preserve incoming query params (start, end, days, rate, location)
  const ctaHref = buildBookingUrl(item, locationLabel);
  const ctaText = item.ctaText || 'Request Booking';

  // Compose payload for the HTML component
  const payload = {
    title: item.Title || `${(item.manufacturer || '')} ${(item.model || '')}`.trim(),
    subtitle,
    location: locationLabel,
    pricePerDay: item.dailyRateAud || '',
    tags: dedupe([...tagNames, ...featNames, ...derivedChips]),
    images,
    specs,
    aboutHtml,
    available,
    heroAlt: item.heroAlt || 'Vehicle image',
    cta: { href: ctaHref, text: ctaText }
  };

  // Ship to iframe
  html.postMessage({ type: 'vehicle-data', payload });

  // If you navigate via dataset (next/prev), update on item change
  const ds = $w('#vehiclesDataset');
  if (ds && ds.onCurrentIndexChanged) {
    ds.onCurrentIndexChanged(async () => {
      const fresh = await getCurrentVehicle();
      // …repeat the same flow or factor into a function if you want
      // (omitted here to keep this snippet focused)
    });
  }
});

/** -----------------------
 *  Helpers
 *  ---------------------*/

// Prefer dataset when available; fallback to slug query
async function getCurrentVehicle() {
  const ds = $w('#vehiclesDataset');
  try {
    if (ds && ds.onReady) {
      await ds.onReady();
      const curr = ds.getCurrentItem();
      if (curr && curr._id) return curr;
    }
  } catch (_) { /* ignore */ }

  // Fallback by slug (last path segment)
  const segments = wixLocation.path || [];
  const slug = segments[segments.length - 1];
  if (!slug) return null;

  const res = await wixData.query('Vehicles').eq('slug', slug).limit(1).find();
  return res.items[0] || null;
}

// Query a referenced field (works for single or multi)
function queryRef(item, fieldKey) {
  if (!item || !item._id) return Promise.resolve([]);
  return wixData
    .queryReferenced('Vehicles', item._id, fieldKey)
    .then(res => (res && res.items) || [])
    .catch(() => []);
}

// Convert wix:image://v1/... → https://static.wixstatic.com/media/...
function asHttps(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('wix:image://v1/')) {
    const m = url.match(/^wix:image:\/\/v1\/([^/]+)/);
    if (m && m[1]) return `https://static.wixstatic.com/media/${m[1]}`;
  }
  return url;
}

// Gallery can be array or JSON string
function extractGallery(g) {
  if (!g) return [];
  if (Array.isArray(g)) return g.map(oneGallerySrc).filter(Boolean);
  if (typeof g === 'string') {
    try { return JSON.parse(g).map(oneGallerySrc).filter(Boolean); }
    catch { return []; }
  }
  return [];
}

function oneGallerySrc(obj) {
  if (!obj) return null;
  // Common gallery shapes: {src}, {url}, {image}, {mediaUrl}, {mediaId}
  if (obj.src) return obj.src;
  if (obj.url) return obj.url;
  if (obj.image) return obj.image;
  if (obj.mediaUrl) return obj.mediaUrl;
  if (obj.mediaId) return `wix:image://v1/${obj.mediaId}`;
  return null;
}

function splitByDot(s) {
  return String(s || '')
    .split('•')
    .map(x => x.trim())
    .filter(Boolean);
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, '').trim();
}

function dedupe(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

// Build booking URL preserving incoming query (start, end, days, rate, location)
function buildBookingUrl(item, locationLabel) {
  const incoming = wixLocation.query || {};
  const base =
    item.bookingDeepLink ||
    item.bookingUrl ||
    '/build-form';

  // Support relative paths by anchoring to site base
  const absolute = base.startsWith('http')
    ? base
    : `${wixLocation.baseUrl}${base.startsWith('/') ? '' : '/'}${base}`;

  const u = new URL(absolute);
  const p = new URLSearchParams(u.search); // keep any existing params on bookingDeepLink

  // Append/override prefill params to match your HTML prefill contract
  // ?vehicle=slug&start=YYYY-MM-DD&end=YYYY-MM-DD&days=N&rate=price&location=City
  p.set('vehicle', item.slug || '');
  if (incoming.start) p.set('start', incoming.start);
  if (incoming.end) p.set('end', incoming.end);
  if (incoming.days) p.set('days', incoming.days);
  p.set('rate', String(item.dailyRateAud || incoming.rate || ''));
  if (locationLabel) p.set('location', locationLabel);

  u.search = p.toString();

  return u.href;
}