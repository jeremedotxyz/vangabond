// api.js — frontend client for the vanlife Cloudflare Worker
// The Worker handles Google Places API calls and key hiding.

// CHANGE THIS to your deployed Worker URL after running `wrangler deploy`
// e.g. 'https://jereme-vans.your-subdomain.workers.dev'
const WORKER_URL = window.VANLIFE_WORKER_URL || 'http://localhost:8787';

/**
 * Search for places near a location.
 * @param {Object} params
 * @param {number} params.lat
 * @param {number} params.lng
 * @param {number} params.radiusMeters
 * @param {string} params.categoryId
 * @returns {Promise<Array>}
 */
export async function searchPlaces({ lat, lng, radiusMeters = 8000, categoryId }) {
  const url = new URL('/search', WORKER_URL);
  url.searchParams.set('lat', lat);
  url.searchParams.set('lng', lng);
  url.searchParams.set('radius', radiusMeters);
  url.searchParams.set('category', categoryId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Worker error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Get full place details (hours, photos, reviews) by place ID.
 */
export async function getPlaceDetails(placeId) {
  const url = new URL('/place', WORKER_URL);
  url.searchParams.set('id', placeId);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Worker error ${res.status}`);
  return res.json();
}

/**
 * Geocode a text query (e.g. "Bend, OR" or "Yosemite National Park")
 * to lat/lng using the Worker's geocode endpoint.
 */
export async function geocode(query) {
  const url = new URL('/geocode', WORKER_URL);
  url.searchParams.set('q', query);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Worker error ${res.status}`);
  return res.json();
}
