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
