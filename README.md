# CD Consulting — Construction Consultant site

Static site plus a tiny Node server (`server.js`) for the lead form. No build step.

## Make it yours
| What | Where |
|---|---|
| Name, phone, email, service area | `js/config.js` → `SITE` |
| Past work (photos + descriptions) | `js/config.js` → `PROJECTS`; drop images in `images/projects/` |
| Your portrait | save as `images/colin.jpg`, then swap the placeholder in the About section of `index.html` |
| Track-record numbers (roofs, renders) | `data-count` values in the About section of `index.html` |
| Estimator pricing | `ITEMS` at the top of `js/estimator.js` (installed $ ranges per unit) |
| Visualizer colors & preset builds | `PALETTE` and `PRESETS` at the top of `js/visualizer.js` |

## Deploy on Railway
1. railway.com → **New Project → Deploy from GitHub repo** → `CDconsulting-` (branch `main`). Railway runs `node server.js` (see `railway.json`).
2. Service → **Settings → Networking → Generate Domain** (or add your own domain).
3. Service → **Variables** to receive leads by email (free at resend.com):
   - `RESEND_API_KEY` = your Resend API key
   - `LEAD_TO_EMAIL` = where leads go (comma-separate for several)
   - `LEAD_FROM_EMAIL` (optional) = e.g. `CD Consulting <leads@yourdomain.com>` once your domain is verified in Resend
   - `LEADS_DIR` (optional) = `/data` if you attach a Railway volume there, to also keep every lead + photos on disk

Every lead also prints to the deploy logs (`NEW LEAD …`), so none are lost before email is set up.

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
| Scroll timeline + camera path | `T` and `KEYS` in `js/build3d.js` |
| Visualizer UI (save, share link, download, "Price this", send to lead form) | `js/viz3d.js` |

Shingles, siding profiles, decking, underlayment and house wrap are generated in code (`js/3d/textures.js`) so any product color can tint them. Lawn, concrete, pavers, stone, bark and mulch are CC0 photo textures from [Poly Haven](https://polyhaven.com) in `images/tex/`.

**HD visualizer:** the visualizer runs in HD mode (`createStage(canvas, { hd: true })`): it lights the house with a real HDR sky (`images/tex/sky.hdr`, Poly Haven "Kloofendal 48d Partly Cloudy", CC0) with a 4K backdrop (`sky.webp`), the sun placed where it sits in the photo, ground-contact ambient occlusion, multisampled anti-aliasing and up to 2× pixel density. "Download 4K image" renders a 3840px still.

Colors are on-screen approximations of each manufacturer's published colors; keep the "confirm with physical samples" note.
