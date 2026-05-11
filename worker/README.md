# vanlife Worker

This is the backend that proxies Google Places + Geocoding API calls so the API key never touches the frontend.

## Setup (one time)

### 1. Get a Google Maps Platform API key

1. Go to <https://console.cloud.google.com/google/maps-apis/start>
2. Create a project (or use existing). Enable billing — you get **$200/month free credit** so you won't pay anything unless usage is heavy.
3. Enable these APIs on the project:
   - **Places API (New)**
   - **Geocoding API**
4. Create credentials → API key. Copy it.
5. **Important:** in the key's restrictions, choose **"None"** for application restrictions (this is a server-side key). Under API restrictions, restrict to just Places API (New) + Geocoding API.

### 2. Install Wrangler and deploy

From the `worker/` directory:

```bash
# install wrangler if you don't have it
npm install -g wrangler

# log in to Cloudflare
wrangler login

# store the Google API key as a secret (NOT in code)
wrangler secret put GOOGLE_API_KEY
# paste the key when prompted

# optional but recommended: create a KV namespace for caching
wrangler kv:namespace create CACHE
# copy the id from the output, paste it into wrangler.toml under [[kv_namespaces]]
# then uncomment those three lines in wrangler.toml

# deploy
wrangler deploy
```

After deploy, Wrangler will print your Worker URL, something like:
`https://jereme-vans.your-subdomain.workers.dev`

### 3. Tell the frontend about the Worker

In the frontend's `index.html`, find this line near the top:

```js
window.VANLIFE_WORKER_URL = 'http://localhost:8787';
```

Change it to your deployed Worker URL.

## Local development

```bash
cd worker
wrangler dev
# Worker runs at http://localhost:8787
# In another terminal, serve the frontend:
cd ..
python3 -m http.server 8000
# Open http://localhost:8000
```

## Endpoints

- `GET /health` — health check
- `GET /search?lat=X&lng=Y&radius=METERS&category=ID` — find places near a location
- `GET /geocode?q=QUERY` — convert text query to lat/lng
- `GET /place?id=PLACE_ID` — full place details (hours, phone, website)

## Tightening security before going public

Right now CORS is `*` (anyone can call the Worker). Once you know the production frontend URL, lock it down:

In `worker.js`, change:
```js
'Access-Control-Allow-Origin': '*'
```
to:
```js
'Access-Control-Allow-Origin': 'https://jeremedotxyz.github.io'
```
(or whatever your final frontend domain is).

## Cost expectations

Google Maps Platform free credit is $200/month. Approximate costs per 1,000 calls:
- Places Nearby Search: ~$32
- Places Text Search: ~$32
- Geocoding: ~$5
- Place Details: ~$17

With aggressive caching (which this Worker does), a personal app for daily use should comfortably stay under the free tier. Each search hits the cache for 30 minutes, geocoding for a week, place details for a day.

If usage exceeds the free tier, the Worker will start returning errors when Google's quota fills. You can set hard quotas in the Google Cloud console to cap spend.
