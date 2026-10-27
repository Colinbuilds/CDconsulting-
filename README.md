# CD Consulting — Construction Consultant site

Static site, no build step. Open `index.html` through any web server, or deploy the folder to Netlify.

## Make it yours
| What | Where |
|---|---|
| Name, phone, email, service area | `js/config.js` → `SITE` |
| Past work (photos + descriptions) | `js/config.js` → `PROJECTS`; drop images in `images/projects/` |
| Your portrait | save as `images/colin.jpg`, then swap the placeholder in the About section of `index.html` |
| Track-record numbers (roofs, renders) | `data-count` values in the About section of `index.html` |
| Estimator pricing | `ITEMS` at the top of `js/estimator.js` (installed $ ranges per unit) |
| Visualizer colors & preset builds | `PALETTE` and `PRESETS` at the top of `js/visualizer.js` |

## Lead form
- **On Netlify:** works automatically (Netlify Forms). Submissions, photos and visualizer renders show up under *Site → Forms*; turn on email notifications there.
- **Elsewhere:** create a free Formspree form and paste its URL into `formEndpoint` in `js/config.js`.

Photos are resized in the browser (max 1600px) before upload, up to 6 per lead.

## Preview locally
```
python3 -m http.server 8000
# open http://localhost:8000
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

Colors are on-screen approximations of each manufacturer's published colors; keep the "confirm with physical samples" note.
