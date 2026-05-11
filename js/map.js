// map.js — Leaflet map with dark tiles and category-colored markers

let map = null;
let userMarker = null;
let resultMarkers = [];

export function initMap(elementId, initialCenter = [40.0, -100.0], initialZoom = 4) {
  // L is global, loaded from CDN
  map = L.map(elementId, {
    zoomControl: false,
    attributionControl: false
  }).setView(initialCenter, initialZoom);

  // CARTO Dark Matter — the canonical "headlights on asphalt" tile set
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(map);

  // Labels go on top, slightly muted
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    opacity: 0.8
  }).addTo(map);

  // Zoom control in top-right
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Attribution
  L.control.attribution({
    position: 'bottomright',
    prefix: false
  }).addAttribution('© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">CARTO</a>')
    .addTo(map);

  return map;
}

export function setUserLocation(lat, lng, zoom = 11) {
  if (!map) return;
  if (userMarker) {
    map.removeLayer(userMarker);
  }

  // Animated pulsing dot for user
  const pulseIcon = L.divIcon({
    className: 'user-marker',
    html: '<div class="user-marker-pulse"></div><div class="user-marker-dot"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  userMarker = L.marker([lat, lng], { icon: pulseIcon, zIndexOffset: 1000 }).addTo(map);
  map.setView([lat, lng], zoom);
}

export function clearResults() {
  resultMarkers.forEach(m => map.removeLayer(m));
  resultMarkers = [];
}

export function showResults(results, category, onMarkerClick) {
  clearResults();
  if (!results || results.length === 0) return;

  const bounds = L.latLngBounds([]);

  results.forEach(place => {
    const icon = L.divIcon({
      className: 'result-marker',
      html: `<div class="result-marker-inner" style="--marker-color: ${category.color};">${category.icon}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([place.lat, place.lng], { icon })
      .on('click', () => onMarkerClick && onMarkerClick(place));

    marker.bindTooltip(place.name, {
      direction: 'top',
      offset: [0, -10],
      className: 'result-tooltip'
    });

    marker.addTo(map);
    resultMarkers.push(marker);
    bounds.extend([place.lat, place.lng]);
  });

  // Include user location in fit-bounds if set
  if (userMarker) {
    bounds.extend(userMarker.getLatLng());
  }

  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
  }
}

export function focusPlace(place) {
  if (!map) return;
  map.setView([place.lat, place.lng], 15, { animate: true });
}

export function getMap() {
  return map;
}
