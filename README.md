# Vanlife — Find Your Next Stop

A van-life atlas for finding overnight parking, water, food, coffee, and services along your route.

Working title — name TBD.

---

## What it does

Tap a category (sleep, water, food, coffee, wash, fuel, fix, see), set your location, and get nearby van-life-relevant stops on a dark map with a categorized list. Each result has distance, rating, and direct-to-Maps and directions links.

**The "van life rated" angle** in v1 is algorithmic — categories are tuned around what van lifers actually need (gyms for showers, libraries for work, RV parks AND campgrounds AND text-search for dispersed camping). Community ratings are a v2 feature.

## Architecture

```
[ Mobile Safari, mobile, or desktop ]
              ↓
[ GitHub Pages — static frontend ]
              ↓ fetch
[ Cloudflare Worker (jereme-vans) ]
              ↓
[ Google Maps Platform — Places API + Geocoding ]
```

Same Worker-plus-GitHub-Pages pattern as `jereme-signal` and `jereme-now-playing`.

## File structure

```
vanlife/
├── index.html              Main page
├── styles.css              Nightdrive aesthetic
├── js/
│   ├── app.js              Orchestrator
│   ├── map.js              Leaflet map + markers
│   ├── api.js              Worker client
│   └── categories.js       Van-life category taxonomy
├── worker/
│   ├── worker.js           Cloudflare Worker source
│   ├── wrangler.toml       Worker config
│   └── README.md           Worker deploy instructions
└── README.md               This file
```

## Deploy in two steps

### Step 1: Deploy the Worker (one time, ~10 min)

See `worker/README.md` for full walkthrough. The short version:

1. Get a Google Maps Platform API key (enable Places API New + Geocoding API)
2. `cd worker && wrangler secret put GOOGLE_API_KEY`
3. `wrangler deploy`
4. Note the Worker URL it gives you

### Step 2: Deploy the Frontend

1. In `index.html`, change `window.VANLIFE_WORKER_URL` to your deployed Worker URL
2. Create empty repo on github.com
3. Upload everything *except* the `worker/` folder via drag-and-drop (or include it, doesn't matter — Pages will ignore it)
4. Settings → Pages → Source: Deploy from branch → main → Save
5. Live in ~30 seconds at `https://jeremedotxyz.github.io/vanlife/` (or whatever you name the repo)

### Step 3 (optional): Custom domain

Point a Cloudflare DNS record at the github.io URL and you're done.

## Local development

```bash
# Terminal 1 — Worker
cd worker
wrangler dev

# Terminal 2 — Frontend
cd ..
python3 -m http.server 8000

# Open http://localhost:8000
```

## What's in v1

- 8 categories: Sleep, Water, Food, Coffee, Wash, Fuel, Fix, See
- Geolocation (uses your phone's GPS) or text search ("Moab UT", "Yosemite", etc.)
- Adjustable radius (1–50 miles)
- Dark CARTO map tiles
- Result list with distance, rating, address, tags
- One-tap Google Maps + Directions links
- Mobile-friendly (works as a PWA on iOS — Add to Home Screen)

## What's in v2 (someday)

- Community ratings ("stayed here, no knock, 4 bars Verizon")
- Save favorites (will need auth + a tiny database)
- Trip planning — view all stops along a route
- iOverlander data integration (no public API, may require partnership)
- Real-time cell signal data overlay
- OSM Overpass integration for actual dump-station tagging (more reliable than Google text search)

## Costs

The frontend hosting is free (GitHub Pages). The Worker is free up to 100K requests/day. Google Maps Platform gives $200/month free credit, which (with the Worker's aggressive caching) easily covers a personal app. If it ever takes off, monitor usage in the Google Cloud console.

## Customization

- **Add a category:** edit `js/categories.js` and `worker/worker.js` (the `CATEGORY_TYPES` and `CATEGORY_TEXT_FALLBACKS` maps in the Worker need the same key)
- **Change colors:** all in CSS variables at the top of `styles.css`
- **Change fonts:** the `@import` line at the top of `styles.css`
- **Rename the app:** edit `<title>` in `index.html` and the `.brand-mark` text. The internal directory name doesn't matter.

## Privacy

Your location is only sent to the Worker (and from there to Google) when you actively request a search. Nothing is stored or logged on the frontend or Worker beyond the in-memory cache.
