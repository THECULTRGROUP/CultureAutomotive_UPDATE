// Velo page code — replace existing
import wixData from 'wix-data';
import wixLocation from 'wix-location';

$w.onReady(async () => {
  const frame = $w('#vehicleHireFrame');
  if (!frame) {
    console.warn('Vehicles: iframe not found (vehicleHireFrame).');
    return;
  }

  // listen for messages from the embed (optional)
  frame.onMessage((event) => {
    const d = event && event.data ? event.data : event;
    if (!d) return;

    if (d.type === 'EMBED_HEIGHT' && typeof d.h === 'number') {
      const h = Math.max(600, Math.ceil(d.h)); // prefer a larger min height
      try {
        // Try both methods for robustness in Wix
        try { frame.height = h; } catch (err) { /* ignore */ }
        try { $w('#vehicleHireFrame').height = h; } catch (err) { /* ignore */ }
      } catch (e) {
        console.warn('Could not set frame height', e);
      }
      // safety retry
      setTimeout(() => { try { frame.postMessage({ type: 'REQUEST_HEIGHT' }); } catch (e){} }, 200);
    }

    if (d.type === 'NAVIGATE' && typeof d.url === 'string') {
      const url = d.url.trim();
      if (!url) return;
      try {
        // prefer wixLocation.to for internal routes, absolute urls also ok
        wixLocation.to(url);
      } catch (err) {
        console.error('Navigation failed', err, url);
        // fallback to window open for external links (safe)
        try { wixLocation.to(url); } catch (e) { window.open(url, '_blank'); }
      }
    }

    if (d.type === 'REQUEST_HEIGHT') {
      try { frame.postMessage({ type: 'REQUEST_HEIGHT' }); } catch (e) {}
    }
  });

  try {
    // fetch vehicles and travel packages
    const [vRes, tRes] = await Promise.all([
      wixData.query('Vehicles').limit(1000).find(),
      wixData.query('TravelPackages').limit(1000).find()
    ]);

    const travelMap = {};
    (tRes.items || []).forEach(t => {
      const id = t._id || t.id;
      if (id) travelMap[id] = t;
    });

    // normalize and enrich vehicles
    const enriched = await Promise.all((vRes.items || []).map(async (it) => {
      const v = { ...it };

      // ensure slug
      if (!v.slug && v.title) v.slug = (v.title||'').toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

      // Prefer bookingDeepLink (absolute). If missing, construct booking URL from slug.
      // Many booking references are stored as Wix reference objects; build a usable string.
      const pickBooking = () => {
        // direct absolute fields (strings)
        const candidates = [v.bookingDeepLink, v.bookingDeep, v.bookingUrl, v.bookingLink, v.booking];
        for (const c of candidates) {
          if (!c) continue;
          if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c;   // absolute
          if (typeof c === 'string' && c.startsWith('/')) return c;        // internal
          // sometimes booking reference is an object with url/href
          if (typeof c === 'object' && (c.url || c.href || c.bookingUrl)) {
            return c.url || c.href || c.bookingUrl;
          }
        }
        // fallback: build booking-calendar path from bookingSlug or slug
        const slug = v.bookingSlug || v.slug || (v.title || '').toString().toLowerCase().replace(/[^a-z0-9]+/g,'-');
        if (slug) return `/booking-calendar/${slug}?referral=service_list_widget`;
        return '';
      };

      v._resolvedBookingUrl = pickBooking();

      // Resolve travelExperienceId(s) into pairedExperiences array
      v.pairedExperiences = [];
      const ids = Array.isArray(v.travelExperienceId) ? v.travelExperienceId : (v.travelExperienceId ? [v.travelExperienceId] : []);
      const normalized = ids.map(x => (typeof x === 'object' && x._id) ? x._id : x).filter(Boolean);
      v.pairedExperiences = normalized.map(id => travelMap[id]).filter(Boolean);

      // other normalizations (images)
      if (!v.heroImage && v.herolmage) v.heroImage = v.herolmage;
      if (!Array.isArray(v.images) && v.gallery) v.images = v.gallery;

      // availabilityStatus boolean -> availabilityBadge text
      if (typeof v.availabilityStatus !== 'undefined') {
        v.availabilityBadge = v.availabilityStatus ? 'Available' : 'Unavailable';
      } else if (v.status) {
        v.availabilityBadge = v.status;
      }

      // photos count fallback
      v.photosCount = v.photosCount || (Array.isArray(v.images) ? v.images.length : (Array.isArray(v.gallery) ? v.gallery.length : 0));

      return v;
    }));

    // Post to embed
    frame.postMessage({ type: 'SET_DATA', vehicles: enriched, travel: Object.values(travelMap) }, '*');

    // request height back a few times
    const requestHeight = () => frame.postMessage({ type: 'REQUEST_HEIGHT' }, '*');
    requestHeight(); setTimeout(requestHeight, 250); setTimeout(requestHeight, 900);
  } catch (err) {
    console.error('Vehicles load failed', err);
    try { frame.postMessage({ type: 'REQUEST_HEIGHT' }); } catch (e) {}
  }
});
