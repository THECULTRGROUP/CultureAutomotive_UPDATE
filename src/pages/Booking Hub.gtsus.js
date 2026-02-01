// ===== Booking Centre – Parent <-> HTML bridge (Velo) =====
import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';

const HTML_ID = '#bookingCentreFrame';
const CONTACT_LIGHTBOX = 'ContactPanel';
const MIN_HTML_HEIGHT = 720;
const MAX_HTML_HEIGHT = 10000; // safety cap

function debounce(fn, wait = 120) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
}

$w.onReady(async () => {
  const hub = $w(HTML_ID);
  if (!hub) {
    console.warn(`HTML element ${HTML_ID} not found.`);
    return;
  }

  // Baseline height
  try { hub.height = MIN_HTML_HEIGHT; } catch (e) { /* ignore */ }

  // Tell child our origin
  try {
    const base = wixLocation.baseUrl || '*';
    hub.postMessage({ type: 'SET_PARENT_ORIGIN', origin: base });
  } catch (e) { /* ignore */ }

  // Send CMS payload into HTML
  try {
    const payload = await fetchCmsPayload();
    hub.postMessage({ type: 'CMS_DATA', payload });
  } catch (e) {
    console.warn('CMS payload error:', e);
  }

  // Messages coming back from HTML
  const handleMsg = debounce((event) => {
    try {
      const msg = event && event.data ? event.data : {};
      if (!msg || typeof msg !== 'object') return;

      switch (msg.type) {
        case 'EMBED_SIZE': {
          const h = Number(msg.height || 0);
          if (Number.isFinite(h) && h > 0) {
            const next = Math.min(
              MAX_HTML_HEIGHT,
              Math.max(MIN_HTML_HEIGHT, Math.floor(h))
            );
            try {
              if (hub.height !== next) hub.height = next;
            } catch (e) { /* ignore */ }
          }
          break;
        }

        case 'DEEPLINK': {
          // Still supported for hero / pillar CTAs that open booking-calendar
          try { hub.postMessage(msg); } catch (e) {}
          break;
        }

        case 'NAVIGATE': {
          // Deep link out of iframe to a real page
          const href = msg.href || '/';
          try {
            const safeHref =
              (typeof href === 'string' && href.startsWith('http')) ? href
              : (typeof href === 'string' && href.startsWith('/')) ? href
              : ('/' + String(href).replace(/^\/+/, ''));
            wixLocation.to(safeHref);
          } catch (e) {
            console.warn('NAVIGATE failed', e);
          }
          break;
        }

        case 'OPEN_CONTACT_PANEL': {
          wixWindow.openLightbox(CONTACT_LIGHTBOX)
            .catch(() => {
              try { wixLocation.to('/contact'); } catch (e) {}
            });
          break;
        }

        case 'TRACK': {
          try {
            if (typeof window !== 'undefined' && window.dataLayer) {
              window.dataLayer.push({ event: msg.name, ...(msg.params || {}) });
            }
          } catch (e) {}
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.warn('handleMsg error', err);
    }
  }, 60);

  try {
    hub.onMessage((event) => {
      handleMsg(event);
    });
  } catch (e) {
    // Fallback if onMessage not available
    try {
      const el = document.querySelector(HTML_ID);
      if (el && el.contentWindow) {
        window.addEventListener('message', handleMsg);
      }
    } catch (err) { /* ignore */ }
  }

  const ping = () => { try { hub.postMessage({ type: 'REQUEST_SIZE' }); } catch (e) {} };
  ping(); setTimeout(ping, 250); setTimeout(ping, 800); setTimeout(ping, 1600);
});

/**
 * Build normalized payloads for the HTML.
 * Collections used:
 *  - Vehicles         -> "Vehicles"
 *  - Travel Packages  -> "TravelPackages"
 *  - Vendors          -> "Vendors"
 *  - Locations        -> "Locations"
 */
async function fetchCmsPayload() {
  function pickImage(field) {
    if (!field) return '';
    try {
      if (typeof field === 'string') return field;
      if (field.fileUrl) return field.fileUrl;
      if (field.src) return field.src;
      if (field.url) return field.url;
      if (Array.isArray(field) && field.length) {
        return pickImage(field[0]);
      }
      if (typeof field === 'object') {
        for (const k of ['uri', 'file', 'image', 'media', 'srcSet']) {
          if (field[k]) return pickImage(field[k]);
        }
        const s = JSON.stringify(field);
        const m = s && s.match(/https?:\/\/[^"']+/);
        if (m) return m[0];
      }
      return '';
    } catch (e) {
      return '';
    }
  }

  // Vehicles
  const vehicles = [];
  try {
    const vRes = await wixData.query('Vehicles').limit(1000).find();
    (vRes.items || []).forEach(v => {
      const title = v.title || v.name || '';
      const bookingCentralHero = pickImage(v.bookingCentralHeroImage) || '';

      vehicles.push({
        title,
        displayTitle: v.bookingCentralDisplayTitle || v.displayTitle || title,
        slug: v.slug || v._id || '',
        image: pickImage(v.heroImage || v.cover || v.image) || bookingCentralHero || '',
        bookingCentralFeatured: !!v.bookingCentralFeatured,
        bookingCentralHeroImage: bookingCentralHero,
        powerOutputHp: v.powerOutputHp || v.hp || '',
        key1: v.keySpec1 || v.spec1 || '',
        key2: v.keySpec2 || v.spec2 || '',
        summary: v.summary || v.shortSummary || ''
      });
    });
  } catch (e) {
    console.warn('Vehicles fetch failed:', e);
  }

  // Travel Packages
  let packages = [];
  try {
    const pRes = await wixData.query('TravelPackages').limit(1000).find();
    packages = pRes.items || [];
  } catch (e) {
    console.warn('TravelPackages fetch failed:', e);
  }

  // Vendors (only if needed)
  const neededVendorIds = [...new Set(
    packages
      .filter(p => !p.vendorLogo && p.vendorId)
      .map(p => (typeof p.vendorId === 'string' ? p.vendorId : (p.vendorId && p.vendorId._id)))
      .filter(Boolean)
  )];

  let vendorLogoMap = {};
  if (neededVendorIds.length) {
    try {
      const vendRes = await wixData.query('Vendors').hasSome('_id', neededVendorIds).find();
      (vendRes.items || []).forEach(v => {
        vendorLogoMap[v._id] = pickImage(v.logo || v.image) || '';
      });
    } catch (e) {
      console.warn('Vendors fetch failed:', e);
    }
  }

  // Locations
  const neededLocationIds = [...new Set(
    packages
      .filter(p => p.locationId)
      .map(p => (typeof p.locationId === 'string' ? p.locationId : (p.locationId && p.locationId._id)))
      .filter(Boolean)
  )];

  let locationLabelMap = {};
  if (neededLocationIds.length) {
    try {
      const locRes = await wixData.query('Locations').hasSome('_id', neededLocationIds).find();
      (locRes.items || []).forEach(loc => {
        const label = loc.locationLabel || loc.title || loc.name || loc.city || '';
        locationLabelMap[loc._id] = label;
      });
    } catch (e) {
      console.warn('Locations fetch failed:', e);
    }
  }

  // Promotions list
  const promotions = packages.map(p => {
    const vendorId = typeof p.vendorId === 'string' ? p.vendorId : (p.vendorId && p.vendorId._id);
    const locId    = typeof p.locationId === 'string' ? p.locationId : (p.locationId && p.locationId._id);

    return {
      title: p.title || '',
      description: p.summery || p.summary || p.description || '',
      statusText: p.statusText || p.badgeText || '',
      image: pickImage(p.bookingCentralHeroImage) || pickImage(p.heroImage || p.cover || p.image),
      slug: p.slug || p._id || '',
      vendorLogo: pickImage(p.vendorLogo) || (vendorId ? vendorLogoMap[vendorId] : ''),
      bookingCentralFeatured: !!p.bookingCentralFeatured,
      bookingCentralHeroImage: pickImage(p.bookingCentralHeroImage) || '',
      bookingCentralFeaturedTitle: p.bookingCentralFeaturedTitle || '',
      location: locId ? (locationLabelMap[locId] || '') : ''
    };
  });

  return { vehicles, promotions };
}