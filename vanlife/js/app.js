// app.js — orchestrator

import { CATEGORIES, getCategoryById } from './categories.js';
import { searchPlaces, geocode } from './api.js';
import { initMap, setUserLocation, showResults, focusPlace, clearResults } from './map.js';

// ---------- state ----------
const state = {
  location: null,        // { lat, lng, label }
  category: null,        // category object
  radius: 8000,          // meters
  results: [],
  loading: false
};

// ---------- formatting ----------
const fmtDistance = (meters) => {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round(meters * 3.28084)} ft`;
  return `${miles.toFixed(1)} mi`;
};

const fmtRating = (rating, count) => {
  if (!rating) return '';
  return `${rating.toFixed(1)}★ <span class="count">(${count || '?'})</span>`;
};

// haversine for client-side distance calc
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------- UI rendering ----------

function renderCategoryStrip() {
  const strip = document.getElementById('category-strip');
  strip.innerHTML = CATEGORIES.map(c => `
    <button class="cat-btn" data-cat="${c.id}" style="--cat-color: ${c.color};">
      <span class="cat-icon">${c.icon}</span>
      <span class="cat-label">${c.label}</span>
    </button>
  `).join('');

  strip.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => selectCategory(btn.dataset.cat));
  });
}

function renderResults() {
  const list = document.getElementById('results-list');

  if (state.loading) {
    list.innerHTML = '<li class="empty">Scanning for stops...</li>';
    return;
  }

  if (!state.category) {
    list.innerHTML = '<li class="empty">Pick a category above to find nearby stops.</li>';
    return;
  }

  if (state.results.length === 0) {
    list.innerHTML = `<li class="empty">No ${state.category.label.toLowerCase()} stops found within ${(state.radius/1609.344).toFixed(0)} miles. Try widening the radius.</li>`;
    return;
  }

  // sort by distance
  const sorted = [...state.results].sort((a, b) => a.distance - b.distance);

  list.innerHTML = sorted.map(p => `
    <li class="result" data-id="${p.id}">
      <div class="result-header">
        <span class="result-name">${escapeHtml(p.name)}</span>
        <span class="result-distance">${fmtDistance(p.distance)}</span>
      </div>
      <div class="result-meta">
        ${p.rating ? `<span class="result-rating">${fmtRating(p.rating, p.userRatingCount)}</span>` : ''}
        ${p.address ? `<span class="result-address">${escapeHtml(p.address)}</span>` : ''}
      </div>
      ${p.types ? `<div class="result-tags">${p.types.slice(0, 3).map(t => `<span class="tag">${t.replace(/_/g, ' ')}</span>`).join('')}</div>` : ''}
      <div class="result-actions">
        <a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}&query_place_id=${p.id}" target="_blank" rel="noopener" class="action">Maps ↗</a>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&destination_place_id=${p.id}" target="_blank" rel="noopener" class="action">Directions ↗</a>
      </div>
    </li>
  `).join('');

  // click on result focuses map
  list.querySelectorAll('.result').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') return;
      const place = state.results.find(p => p.id === el.dataset.id);
      if (place) focusPlace(place);
    });
  });
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

function updateLocationDisplay() {
  const el = document.getElementById('current-location');
  if (state.location) {
    el.innerHTML = `<span class="loc-label">Currently scanning near</span> <span class="loc-name">${escapeHtml(state.location.label)}</span>`;
  } else {
    el.innerHTML = '<span class="loc-label">Tap "Use my location" or search a place</span>';
  }
}

function updateActiveCategory() {
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.toggle('active', state.category && btn.dataset.cat === state.category.id);
  });
}

// ---------- actions ----------

async function useMyLocation() {
  if (!navigator.geolocation) {
    setStatus('Geolocation not supported by this browser.', true);
    return;
  }

  setStatus('Locating...');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      state.location = {
        lat: latitude,
        lng: longitude,
        label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
      };
      setUserLocation(latitude, longitude, 11);
      updateLocationDisplay();
      setStatus('Location locked.');
      if (state.category) await runSearch();
    },
    (err) => {
      setStatus(`Location denied or unavailable: ${err.message}`, true);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function searchLocation(query) {
  if (!query.trim()) return;
  setStatus(`Looking up "${query}"...`);

  try {
    const result = await geocode(query);
    if (!result || !result.lat) {
      setStatus(`Could not find "${query}".`, true);
      return;
    }
    state.location = {
      lat: result.lat,
      lng: result.lng,
      label: result.formatted || query
    };
    setUserLocation(result.lat, result.lng, 11);
    updateLocationDisplay();
    setStatus('Location set.');
    if (state.category) await runSearch();
  } catch (err) {
    setStatus(`Search failed: ${err.message}`, true);
  }
}

async function selectCategory(catId) {
  state.category = getCategoryById(catId);
  updateActiveCategory();

  if (!state.location) {
    setStatus('Set a location first — tap "Use my location" or search a place.');
    return;
  }

  await runSearch();
}

async function runSearch() {
  if (!state.location || !state.category) return;

  state.loading = true;
  state.results = [];
  renderResults();
  clearResults();
  setStatus(`Scanning for ${state.category.label.toLowerCase()}...`);

  try {
    const results = await searchPlaces({
      lat: state.location.lat,
      lng: state.location.lng,
      radiusMeters: state.radius,
      categoryId: state.category.id
    });

    // compute distance to each
    const enriched = results.map(r => ({
      ...r,
      distance: haversine(state.location.lat, state.location.lng, r.lat, r.lng)
    }));

    state.results = enriched;
    state.loading = false;
    renderResults();
    showResults(enriched, state.category, (place) => {
      // could highlight in list later
      console.log('marker tapped:', place.name);
    });
    setStatus(`Found ${enriched.length} ${state.category.label.toLowerCase()} stops within ${(state.radius/1609.344).toFixed(0)} miles.`);
  } catch (err) {
    state.loading = false;
    setStatus(`Search failed: ${err.message}`, true);
    renderResults();
  }
}

function setRadius(meters) {
  state.radius = meters;
  document.getElementById('radius-value').textContent = `${(meters/1609.344).toFixed(0)} mi`;
  if (state.location && state.category) runSearch();
}

// ---------- init ----------

function init() {
  initMap('map');
  renderCategoryStrip();
  renderResults();
  updateLocationDisplay();

  document.getElementById('btn-location').addEventListener('click', useMyLocation);

  const searchInput = document.getElementById('search-input');
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    searchLocation(searchInput.value);
  });

  const radiusSlider = document.getElementById('radius-slider');
  radiusSlider.addEventListener('input', (e) => {
    setRadius(parseInt(e.target.value, 10));
  });
  // initialize display
  document.getElementById('radius-value').textContent = `${(state.radius/1609.344).toFixed(0)} mi`;
}

document.addEventListener('DOMContentLoaded', init);
