// categories.js — van life category taxonomy
// Each category maps to Google Places types (preferred) or text-search queries (fallback)

export const CATEGORIES = [
  {
    id: 'sleep',
    label: 'Sleep',
    icon: '◐',
    blurb: 'Overnight parking, campgrounds, RV parks',
    color: '#7aa7c7', // cool blue — night
    googleTypes: ['rv_park', 'campground'],
    extraQueries: ['free camping', 'BLM dispersed camping', 'overnight parking']
  },
  {
    id: 'water',
    label: 'Water',
    icon: '◇',
    blurb: 'Fresh water fills, dump stations',
    color: '#5fb3d4',
    googleTypes: [],
    extraQueries: ['RV dump station', 'potable water fill', 'RV water fill']
  },
  {
    id: 'food',
    label: 'Food',
    icon: '◆',
    blurb: 'Diners, restaurants, big-lot-friendly',
    color: '#f4a948', // amber — diner sign
    googleTypes: ['restaurant', 'meal_takeaway'],
    extraQueries: ['diner', '24 hour diner']
  },
  {
    id: 'coffee',
    label: 'Coffee',
    icon: '○',
    blurb: 'Cafes, work-friendly spots, libraries',
    color: '#c9844a',
    googleTypes: ['cafe', 'library'],
    extraQueries: ['coffee shop wifi', 'cafe with outlets']
  },
  {
    id: 'wash',
    label: 'Wash',
    icon: '◯',
    blurb: 'Showers, laundromats, gyms',
    color: '#a8d4c9',
    googleTypes: ['laundry', 'gym'],
    extraQueries: ['Planet Fitness', 'public shower', 'truck stop shower']
  },
  {
    id: 'fuel',
    label: 'Fuel',
    icon: '◉',
    blurb: 'Gas, diesel, propane refills',
    color: '#f4a948',
    googleTypes: ['gas_station'],
    extraQueries: ['propane refill', 'diesel fuel']
  },
  {
    id: 'fix',
    label: 'Fix',
    icon: '✕',
    blurb: 'Mechanics, RV repair, parts',
    color: '#d97f3d',
    googleTypes: ['car_repair'],
    extraQueries: ['RV repair', 'van repair', 'auto parts']
  },
  {
    id: 'see',
    label: 'See',
    icon: '△',
    blurb: 'Viewpoints, trailheads, parks',
    color: '#9ec47a',
    googleTypes: ['tourist_attraction', 'park', 'national_park'],
    extraQueries: ['scenic viewpoint', 'trailhead', 'overlook']
  }
];

export function getCategoryById(id) {
  return CATEGORIES.find(c => c.id === id);
}
