// worker.js — vanlife Cloudflare Worker
// Proxies Google Places API (New) and Geocoding API. Hides the API key.
//
// Required secrets (set via `wrangler secret put`):
//   GOOGLE_API_KEY    — your Google Maps Platform API key (server-side, no referrer restriction)
//
// Optional KV namespace (for caching):
//   bind name: CACHE  — see wrangler.toml

// Category → Google Places type mapping (mirrors frontend categories.js)
const CATEGORY_TYPES = {
  sleep:  ['rv_park', 'campground'],
  water:  [], // text-search only — Google Places doesn't have a dump-station type
  food:   ['restaurant', 'meal_takeaway'],
  coffee: ['cafe', 'library'],
  wash:   ['laundry', 'gym'],
  fuel:   ['gas_station'],
  fix:    ['car_repair'],
  see:    ['tourist_attraction', 'park']
};

const CATEGORY_TEXT_FALLBACKS = {
  sleep:  ['free camping', 'BLM dispersed camping'],
  water:  ['RV dump station', 'potable water fill'],
  food:   [],
  coffee: [],
  wash:   ['public shower', 'truck stop shower'],
  fuel:   ['propane refill'],
  fix:    ['RV repair'],
  see:    ['scenic viewpoint', 'overlook']
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // tighten this to your GitHub Pages domain in production
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/search') return await handleSearch(url, env, ctx);
      if (url.pathname === '/geocode') return await handleGeocode(url, env, ctx);
      if (url.pathname === '/place') return await handlePlaceDetails(url, env, ctx);
      if (url.pathname === '/health') return json({ ok: true, version: '1.0.0' });
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: String(err.message || err) }, 500);
    }
  }
};

// ──────────────────────── handlers ────────────────────────

async function handleSearch(url, env, ctx) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radius = parseInt(url.searchParams.get('radius') || '8000', 10);
  const category = url.searchParams.get('category');

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return json({ error: 'Missing or invalid lat/lng' }, 400);
  }
  if (!category || !(category in CATEGORY_TYPES)) {
    return json({ error: 'Invalid category' }, 400);
  }

  const cacheKey = `search:${category}:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`;
  const cached = await getCached(env, cacheKey);
  if (cached) return json(cached);

  const types = CATEGORY_TYPES[category];
  const textQueries = CATEGORY_TEXT_FALLBACKS[category] || [];
  const allResults = new Map(); // dedupe by place id

  // Nearby search by types
  if (types.length > 0) {
    const nearbyResults = await placesNearby(env, lat, lng, radius, types);
    nearbyResults.forEach(p => allResults.set(p.id, p));
  }

  // Text search for items not covered by types
  for (const q of textQueries) {
    const textResults = await placesTextSearch(env, q, lat, lng, radius);
    textResults.forEach(p => {
      if (!allResults.has(p.id)) allResults.set(p.id, p);
    });
  }

  const merged = Array.from(allResults.values());
  await setCached(env, cacheKey, merged, 60 * 30); // 30 min cache
  return json(merged);
}

async function handleGeocode(url, env, ctx) {
  const q = url.searchParams.get('q');
  if (!q) return json({ error: 'Missing q' }, 400);

  const cacheKey = `geocode:${q.toLowerCase()}`;
  const cached = await getCached(env, cacheKey);
  if (cached) return json(cached);

  const apiUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${env.GOOGLE_API_KEY}`;
  const res = await fetch(apiUrl);
  const data = await res.json();

  if (data.status !== 'OK' || !data.results.length) {
    return json({ error: 'No results' }, 404);
  }

  const r = data.results[0];
  const result = {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted: r.formatted_address
  };

  await setCached(env, cacheKey, result, 60 * 60 * 24 * 7); // 1 week
  return json(result);
}

async function handlePlaceDetails(url, env, ctx) {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Missing id' }, 400);

  const cacheKey = `place:${id}`;
  const cached = await getCached(env, cacheKey);
  if (cached) return json(cached);

  const fields = [
    'id', 'displayName', 'formattedAddress', 'location',
    'rating', 'userRatingCount', 'types', 'websiteUri',
    'nationalPhoneNumber', 'regularOpeningHours', 'priceLevel'
  ].join(',');

  const apiUrl = `https://places.googleapis.com/v1/places/${id}`;
  const res = await fetch(apiUrl, {
    headers: {
      'X-Goog-Api-Key': env.GOOGLE_API_KEY,
      'X-Goog-FieldMask': fields
    }
  });
  if (!res.ok) {
    return json({ error: `Google ${res.status}` }, res.status);
  }
  const data = await res.json();
  const normalized = normalizePlace(data);

  await setCached(env, cacheKey, normalized, 60 * 60 * 24); // 24h
  return json(normalized);
}

// ──────────────────────── google places helpers ────────────────────────

async function placesNearby(env, lat, lng, radius, types) {
  const body = {
    includedTypes: types,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(radius, 50000) // Places API max
      }
    }
  };

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Places nearby failed:', res.status, text);
    return [];
  }
  const data = await res.json();
  return (data.places || []).map(normalizePlace);
}

async function placesTextSearch(env, query, lat, lng, radius) {
  const body = {
    textQuery: query,
    maxResultCount: 10,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(radius, 50000)
      }
    }
  };

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Places text search failed:', res.status, text);
    return [];
  }
  const data = await res.json();
  return (data.places || []).map(normalizePlace);
}

function normalizePlace(p) {
  return {
    id: p.id,
    name: p.displayName?.text || 'Unnamed',
    address: p.formattedAddress || '',
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    rating: p.rating || null,
    userRatingCount: p.userRatingCount || null,
    types: p.types || [],
    website: p.websiteUri || null,
    phone: p.nationalPhoneNumber || null,
    priceLevel: p.priceLevel || null,
    hours: p.regularOpeningHours?.weekdayDescriptions || null
  };
}

// ──────────────────────── caching ────────────────────────

async function getCached(env, key) {
  if (!env.CACHE) return null;
  try {
    const data = await env.CACHE.get(key, 'json');
    return data;
  } catch { return null; }
}

async function setCached(env, key, value, ttlSeconds) {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch (e) {
    console.error('Cache write failed:', e);
  }
}

// ──────────────────────── utilities ────────────────────────

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}
