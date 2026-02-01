import wixData from 'wix-data';

$w.onReady(async () => {
  const frame = $w('#parentFrame');
  if (!frame || typeof frame.postMessage !== 'function') return;

  const [vehiclesRes, travelRes] = await Promise.all([
    wixData.query('Vehicles').limit(1000).find(),
    wixData.query('TravelPackages').limit(1000).find()
  ]);

  const vehicles = (vehiclesRes.items || []).map(it => {
    if (!it.heroImage && it.herolmage) it.heroImage = it.herolmage;
    if (!Array.isArray(it.images) && it.gallery) it.images = it.gallery;
    it.bookingType = 'vehicle';
    return it;
  });

  const travel = (travelRes.items || []).map(it => {
    if (!it.heroImage && it.herolmage) it.heroImage = it.herolmage;
    if (!Array.isArray(it.images) && it.gallery) it.images = it.gallery;
    it.bookingType = 'experience';
    return it;
  });

  frame.postMessage({ type: 'SET_DATA', vehicles, travel });
});
