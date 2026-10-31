# CD Consulting — Construction Consultant site

Static site plus a tiny Node server (`server.js`) for the lead form. No build step.

## Pages
| Page | What's on it |
|---|---|
| `index.html` | Full-screen 3D walkthrough of a full roof + siding job (the rest of the page unlocks once it's scrolled through), then who I am + what I do, About, and the lead form |
| `roofing.html`, `siding.html`, `windows.html`, `gutters.html` | A full-screen 3D walkthrough of that trade, every step explained, then a checklist link and CTA |
| `design.html` | 3D exterior designer + paint-your-photo |
| `estimate.html` | Roof price by address: the address opens a movable aerial map, the homeowner clicks their house, the county GIS outline loads as a polygon they can trace and adjust, priced at 7/12 pitch + 8% waste for three shingle lines with tax. Plus the ballpark estimator for other work |
| `insurance.html` | Insurance claims guide + "Should I file?" check |
| `checklist.html` | Homeowner checklist (before / during / after, filter by trade, saves ticks on the device). Adds to Apple Reminders / to-do apps / calendar, prints on one page, and has a "send me a photo when done" form |
| `commercial.html` | Commercial flat-roof planner: membrane, parapet, walls; place RTUs, exhaust fans, skylights, solar, hatches, vents, walkway pads and drains in 3D, with live checks for edge clearance, curb spacing and drains |
| `work.html` | Past projects |

Nav + footer are shared from `js/layout.js`. Anything attached on one page (a design, render, ballpark, claim check) is carried to the lead form on the home page through `sessionStorage`.

## Make it yours
| What | Where |
|---|---|
| Name, phone, email, service area | `js/config.js` → `SITE` |
| Past work (photos + descriptions) | `js/config.js` → `PROJECTS`; drop images in `images/projects/` |
| Your portrait | save as `images/colin.jpg`, then swap the placeholder in the About section of `index.html` |
| Homeowner checklist items | `LISTS` in `js/checklist.js` |
| Roof prices per square, sales tax, waste, overhang, default pitch | `ROOF_PRICING` in `js/config.js` |
| Track-record numbers (roofs, renders) | `data-count` values in the About section of `index.html` |
| Estimator pricing | `ITEMS` at the top of `js/estimator.js` (installed $ ranges per unit) |

## Deploy on Railway
1. railway.com → **New Project → Deploy from GitHub repo** → `CDconsulting-` (branch `main`). Railway runs `node server.js` (see `railway.json`).
2. Service → **Settings → Networking → Generate Domain** (or add your own domain).
3. Service → **Variables** to receive leads by email (free at resend.com):
   - `RESEND_API_KEY` = your Resend API key
   - `LEAD_TO_EMAIL` = where leads go (comma-separate for several)
   - `LEAD_FROM_EMAIL` (optional) = e.g. `CD Consulting <leads@yourdomain.com>` once your domain is verified in Resend
   - `LEADS_DIR` (optional) = `/data` if you attach a Railway volume there, to also keep every lead + photos on disk

Every lead also prints to the deploy logs (`NEW LEAD …`), so none are lost before email is set up.

## Roof price by address
`js/roofquote.js` (estimate page) calls these server routes in `roof-api.js`:

| Route | What it does | Free source | With `GOOGLE_MAPS_API_KEY` |
|---|---|---|---|
| `/api/geocode` | Address → location | OpenStreetMap, then the US Census geocoder | Google Geocoding (rooftop accurate) |
| `/api/roof` | Roof outline + footprint size, streamed step by step to the search window | The county's own GIS (see below), `COUNTY_GIS_URL` if set, then FEMA USA Structures (every US building, public domain), then OpenStreetMap | Google Solar API roof scan: measured roof area and pitch |
| `/api/aerial` | Photo from above | Esri World Imagery | Google satellite |
| `/api/street` | Photo from the street | (none; a Street View link is shown) | Google Street View |

**County GIS built in** (`gis-counties.js`):

| County | Layer | Buildings |
|---|---|---|
| Douglas, NE (Omaha) | [DOGIS 2022 Building Footprints](https://dcgis.org/server/rest/services/Hosted/2022_Building_Footprints/FeatureServer/0) | 268,909 |
| Sarpy, NE | [Sarpy County Building Footprints](https://geodata.sarpy.gov/arcgis/rest/services/Cadastral/LandRecordsDynamic/MapServer/42) | 79,348 |
| Lancaster, NE (Lincoln) | [Lincoln–Lancaster 2026 Footprints](https://gis.lincoln.ne.gov/public/rest/services/BuildingSafety/BuildingFootprints/MapServer/8) | 160,473 |
| Pottawattamie, IA (Council Bluffs) | [Pottawattamie 2024 Building Footprints](https://gis.pottcounty-ia.gov/arcgis/rest/services/Hosted/Building_Footprints_2024/FeatureServer/0) | 74,960 |
| Cass, NE | No public footprints ([open data](https://gis-cass.hub.arcgis.com) has parcels only), so FEMA USA Structures is used | — |

To add a county, add an entry with its layer URL and a rough bounding box to `gis-counties.js`.

The math: footprint + 1 ft overhang all around → × pitch factor (√(1 + (pitch/12)²); 7/12 by default, the homeowner can change it) → + 8% waste → rounded up to the next ⅓ square → × price per square → + sales tax.

Railway variables (all optional):
- `GOOGLE_MAPS_API_KEY`: turn on Geocoding, Maps Static, Street View Static and Solar APIs for the key in Google Cloud. It stays on the server; images are proxied.
- `COUNTY_GIS_URL`: your county's building-footprint layer, an ArcGIS REST URL ending in `/FeatureServer/<n>` or `/MapServer/<n>`. Most county GIS portals publish one.

Esri World Imagery is shown with attribution. For heavy commercial use, create a free ArcGIS Location Platform account, or set the Google key to use Google imagery instead.

## CAD builder
The plan for the building designer / blueprint maker is in [`docs/cad-builder-plan.md`](docs/cad-builder-plan.md).

## Lead form
`js/lead.js` posts to `/api/lead` (`server.js`), which accepts up to 8 photos (resized in the browser first), checks a spam honeypot and rate-limits by IP.

## Preview locally
```
npm install
npm start
# open http://localhost:3000
```

## 3D house (scroll build + visualizer)
Both the scroll-through tear-off and the visualizer use one real-time 3D model (three.js, vendored in `js/vendor/three`, no build step).

| What | Where |
|---|---|
| Product lines + named colors (roof, siding, trim, windows, door, gutters, stone) | `js/3d/catalog.js` → `CATALOG` |
| Style presets / the "before" house | `PRESETS` and `ORIGINAL` in `js/3d/catalog.js` |
| House shape (walls, windows, roofs, porch, garage) | `js/3d/house.js` |
| Lawn, driveway, trees, shrubs | `js/3d/site.js` |
| Walkthroughs (build timeline, camera path, steps, phases, before/after look) | `PROCESSES` in `js/3d/processes.js` |
| Teaching text for every material | `MATERIALS` and `EXTRA` in `js/3d/materials.js` |
| Full-screen scroll player (pinning, labels, cards) | `js/process.js` |
| Visualizer UI (save, share link, download, "Price this", send to lead form) | `js/viz3d.js` |

Shingles, siding profiles, decking, underlayment and house wrap are generated in code (`js/3d/textures.js`) so any product color can tint them. Lawn, concrete, pavers, stone, bark and mulch are CC0 photo textures from [Poly Haven](https://polyhaven.com) in `images/tex/`.

**HD:** the walkthroughs and the visualizer run in HD mode (`createStage(canvas, { hd: true })`): it lights the house with a real HDR sky (`images/tex/sky.hdr`, Poly Haven "Kloofendal 48d Partly Cloudy", CC0) with a 4K backdrop (`sky.webp`), the sun placed where it sits in the photo, ground-contact ambient occlusion, multisampled anti-aliasing and up to 2× pixel density. "Download 4K image" renders a 3840px still.

Colors are on-screen approximations of each manufacturer's published colors; keep the "confirm with physical samples" note.
