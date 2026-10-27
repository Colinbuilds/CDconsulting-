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

## Scroll build (tear-off → rebuild)
The section under the headline runs on a real photo (`images/build/source.jpg`, a free Unsplash photo).
`tools/build_stages.py` cuts it into stage layers (decking, underlayment, new shingles, sheathing, house wrap, new siding) that keep the photo's own lighting; `js/teardown.js` reveals them as you scroll.

**Use your own job instead:** shoot the house straight-on, save it as `images/build/source.jpg`, retrace the roof and wall regions at the top of `tools/build_stages.py` (pixel coordinates), then run:
```
python3 tools/build_stages.py
```
New roof and siding colors are `NEW_ROOF` / `NEW_SIDING` in the same file.
