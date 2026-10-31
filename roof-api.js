/* Roof quote APIs used by the estimate page: find the address, show the house from above,
   and measure the roof outline.

   Railway → service → Variables (all optional; the free sources work without them):
     GOOGLE_MAPS_API_KEY → rooftop-accurate geocoding, sharp Google satellite + Street View photos,
                           and Google's Solar API roof measurement (real roof area and pitch).
                           Enable "Geocoding", "Maps Static", "Street View Static" and "Solar" APIs on the key.
     COUNTY_GIS_URL      → your county's building-footprint layer (an ArcGIS REST FeatureServer or MapServer layer,
                           e.g. https://gis.yourcounty.gov/arcgis/rest/services/Buildings/FeatureServer/0).
                           Checked before OpenStreetMap when set.
   Without a key: addresses come from OpenStreetMap / the US Census geocoder, the photo from Esri World Imagery,
   and the outline from the county's own GIS (built in for the Omaha / Lincoln / Council Bluffs area, see
   gis-counties.js), then FEMA's nationwide USA Structures footprints, then OpenStreetMap. */

import { countiesAt } from "./gis-counties.js";

const KEY = () => process.env.GOOGLE_MAPS_API_KEY || "";
const UA = "CDConsulting-site/1.0 (roof quote)";
// small payloads; asking for them uncompressed also avoids stalls behind some proxies
const R = 6378137;

async function getJSON(url, opts = {}, ms = 15000) {
  const r = await fetch(url, { ...opts, headers: { "User-Agent": UA, "Accept-Encoding": "identity", ...(opts.headers || {}) }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json();
}

/* ---------- geometry ---------- */
// ring: [[lat, lon], ...] → area (m²) and perimeter (m), using a local flat projection (fine at house scale)
function measure(ring) {
  const lat0 = (ring.reduce((s, p) => s + p[0], 0) / ring.length) * Math.PI / 180;
  const xy = ring.map(([la, lo]) => [R * lo * Math.PI / 180 * Math.cos(lat0), R * la * Math.PI / 180]);
  let a = 0, per = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % xy.length];
    a += x1 * y2 - x2 * y1;
    per += Math.hypot(x2 - x1, y2 - y1);
  }
  return { area: Math.abs(a) / 2, perimeter: per };
}
function inside([la, lo], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ai, oi] = ring[i], [aj, oj] = ring[j];
    if ((oi > lo) !== (oj > lo) && la < ((aj - ai) * (lo - oi)) / (oj - oi) + ai) hit = !hit;
  }
  return hit;
}
function distM([la, lo], ring) { // distance from point to the nearest vertex/edge midpoint, meters (approx.)
  const k = Math.cos(la * Math.PI / 180);
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [a1, o1] = ring[i], [a2, o2] = ring[(i + 1) % ring.length];
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const dy = (a1 + (a2 - a1) * t - la) * 111320, dx = (o1 + (o2 - o1) * t - lo) * 111320 * k;
      best = Math.min(best, Math.hypot(dx, dy));
    }
  }
  return best;
}
// the building at the point, or the nearest real-sized one (skips sheds)
function pick(pt, rings, maxD = 45) {
  const sized = rings.map((ring) => ({ ring, ...measure(ring) })).filter((b) => b.area > 45);
  return sized.find((b) => inside(pt, b.ring)) || sized.map((b) => ({ ...b, d: distM(pt, b.ring) })).filter((b) => b.d < maxD).sort((a, b) => a.d - b.d)[0] || null;
}
const ftOf = (b) => ({ footprintSqFt: Math.round(b.area * 10.7639), perimeterFt: Math.round(b.perimeter * 3.28084) });

/* ---------- geocoding ---------- */
async function geocode(q) {
  if (KEY()) {
    const d = await getJSON(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&components=country:US&key=${KEY()}`);
    const r = d.results?.[0];
    if (r) return { lat: r.geometry.location.lat, lon: r.geometry.location.lng, address: r.formatted_address, source: "Google" };
  }
  try {
    const d = await getJSON(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=us&limit=1&q=${encodeURIComponent(q)}`);
    const a = d[0]?.address;
    if (a?.house_number && d[0].category !== "highway") {
      const town = a.city || a.town || a.village || a.hamlet || a.suburb || a.county || "";
      return { lat: +d[0].lat, lon: +d[0].lon, county: a.county && `${a.county}, ${a["ISO3166-2-lvl4"]?.slice(3) || a.state}`, address: `${a.house_number} ${a.road || ""}, ${town}, ${a.state || ""} ${a.postcode || ""}`.replace(/\s+,/g, ",").trim(), source: "OpenStreetMap" };
    }
  } catch (e) { console.warn("nominatim", e.message); }
  const d = await getJSON(`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=${encodeURIComponent(q)}`);
  const m = d.result?.addressMatches?.[0];
  if (m) return { lat: m.coordinates.y, lon: m.coordinates.x, address: m.matchedAddress, source: "US Census", street: true };
  return null;
}

/* ---------- roof outline + measurement ---------- */
async function fromGoogleSolar(lat, lon) {
  const d = await getJSON(`https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lon}&requiredQuality=LOW&key=${KEY()}`);
  const segs = d.solarPotential?.roofSegmentStats;
  if (!segs?.length) return null;
  const ground = segs.reduce((s, x) => s + (x.stats.groundAreaMeters2 || 0), 0);
  const sloped = segs.reduce((s, x) => s + x.stats.areaMeters2, 0);
  const deg = segs.reduce((s, x) => s + x.pitchDegrees * x.stats.areaMeters2, 0) / sloped;
  const b = d.boundingBox;
  const ring = b ? [[b.sw.latitude, b.sw.longitude], [b.sw.latitude, b.ne.longitude], [b.ne.latitude, b.ne.longitude], [b.ne.latitude, b.sw.longitude]] : null;
  return {
    source: "Google Solar roof scan", outline: ring, box: true, center: [d.center.latitude, d.center.longitude],
    planSqFt: Math.round(ground * 10.7639), roofSqFt: Math.round(sloped * 10.7639), pitch: Math.round(Math.tan(deg * Math.PI / 180) * 12 * 10) / 10,
    facets: segs.length, imageryDate: d.imageryDate && `${d.imageryDate.month}/${d.imageryDate.year}`,
  };
}

// any ArcGIS REST polygon layer of building footprints (county GIS, or FEMA's nationwide USA Structures)
async function fromArcGIS(base, label, lat, lon, maxD) {
  base = base.replace(/\/+$/, "");
  // one box query ~45 m around the point; pick() takes the building at the point or the nearest house-sized one
  const dLat = 45 / 111320, dLon = 45 / (111320 * Math.cos((lat * Math.PI) / 180));
  const d = await getJSON(`${base}/query?f=json&geometry=${lon - dLon},${lat - dLat},${lon + dLon},${lat + dLat}&geometryType=esriGeometryEnvelope` +
    `&inSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=true&outSR=4326`, {}, 20000);
  if (d.error) throw new Error(d.error.message || "arcgis error");
  const rings = (d.features || []).map((f) => f.geometry?.rings?.[0]?.map(([x, y]) => [y, x])).filter(Boolean);
  const b = pick([lat, lon], rings, maxD);
  return b && { source: label, outline: b.ring, ...ftOf(b) };
}
// FEMA / Oak Ridge National Lab "USA Structures": public-domain footprints for every US building
const FEMA = "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/USA_Structures_View/FeatureServer/0";
const fromFEMA = (lat, lon, maxD) => fromArcGIS(FEMA, "FEMA USA Structures building footprint", lat, lon, maxD);

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
async function fromOSM(lat, lon, maxD) {
  const body = "data=" + encodeURIComponent(`[out:json][timeout:20];way(around:45,${lat},${lon})["building"];out geom;`);
  for (const url of OVERPASS) {
    try {
      const d = await getJSON(url, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } }, 12000);
      const rings = d.elements.filter((e) => e.geometry?.length > 3).map((e) => e.geometry.map((g) => [g.lat, g.lon]));
      const b = pick([lat, lon], rings, maxD);
      return b && { source: "OpenStreetMap building footprint", outline: b.ring, ...ftOf(b) };
    } catch (e) { console.warn("overpass", url, e.message); }
  }
  throw new Error("footprint services unavailable");
}

// log(text, state): narrates each lookup for the search window on the estimate page
async function footprint(lat, lon, maxD, log) {
  const tries = [];
  for (const c of countiesAt(lat, lon)) {
    if (!c.url) { log(`${c.name} doesn't publish building footprints; checking neighbors and the national dataset`, "info"); continue; }
    tries.push({ label: `${c.short}${c.year ? ` · ${c.year} footprints` : ""}`, run: () => fromArcGIS(c.url, `${c.name} GIS building footprint${c.year ? ` (${c.year})` : ""}`, lat, lon, maxD), county: c.name });
  }
  if (process.env.COUNTY_GIS_URL) tries.push({ label: "County GIS layer", run: () => fromArcGIS(process.env.COUNTY_GIS_URL, "County GIS building footprint", lat, lon, maxD) });
  tries.push({ label: "FEMA USA Structures (national)", run: () => fromFEMA(lat, lon, maxD) });
  tries.push({ label: "OpenStreetMap buildings", run: () => fromOSM(lat, lon, maxD) });
  let answered = false;
  for (const t of tries) {
    log(`Searching ${t.label}…`, "run");
    try {
      const r = await t.run();
      answered = true;
      if (r) { log(`Found the building: ${r.footprintSqFt.toLocaleString("en-US")} sq ft footprint, ${new Set(r.outline.map(String)).size} corners`, "ok"); return { ...r, county: t.county }; }
      log(`No building at that spot in ${t.label}`, "miss");
    } catch (e) {
      console.warn("roof", t.label, e.message);
      log(`${t.label} didn't answer`, "miss");
    }
  }
  if (!answered) throw new Error("footprint services unavailable");
  return null;
}
// maxD: how far from the point a building may be (a homeowner's tap lands on the roof itself)
async function roof(lat, lon, maxD, log = () => {}) {
  let solar = null;
  if (KEY()) {
    log("Running Google's roof scan…", "run");
    try { solar = await fromGoogleSolar(lat, lon); } catch (e) { console.warn("roof solar", e.message); }
    log(solar ? `Roof scan: ${solar.facets} roof planes, about ${solar.pitch}/12 pitch` : "No roof scan for this address", solar ? "ok" : "miss");
  }
  let fp = null;
  try { fp = await footprint(lat, lon, maxD, log); } catch (e) { if (!solar) throw e; }
  if (!solar) return fp;
  // measured by Google's roof scan; draw the real outline when we have one
  return fp ? { ...fp, ...solar, outline: fp.outline, box: false, source: solar.source } : solar;
}

/* ---------- photos ---------- */
const MPP0 = 156543.03392804097; // web-mercator meters per pixel at zoom 0
function mercator(lat, lon) {
  return [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
}
async function aerial(lat, lon, z, w, h) {
  if (KEY()) {
    const u = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=${z}&size=${w}x${h}&scale=2&maptype=satellite&key=${KEY()}`;
    return { url: u, credit: "Imagery © Google" };
  }
  const [x, y] = mercator(lat, lon), mpp = MPP0 / 2 ** z;
  const k = Math.min(2, 2 ** (19 - z)); // Esri's export stops at ~0.3 m/pixel (zoom 19); the browser scales up past that
  const bbox = [x - (w / 2) * mpp, y - (h / 2) * mpp, x + (w / 2) * mpp, y + (h / 2) * mpp].join(",");
  return {
    url: `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=${Math.round(w * k)},${Math.round(h * k)}&format=jpg&f=image`,
    credit: "Imagery: Esri, Vantor, Earthstar Geographics",
  };
}
async function street(lat, lon) {
  if (!KEY()) return null;
  const meta = await getJSON(`https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lon}&radius=60&source=outdoor&key=${KEY()}`);
  if (meta.status !== "OK") return null;
  // face the house: heading from the camera to the house
  const [cl, co] = [meta.location.lat, meta.location.lng];
  const heading = (Math.atan2((lon - co) * Math.cos(lat * Math.PI / 180), lat - cl) * 180) / Math.PI;
  return { url: `https://maps.googleapis.com/maps/api/streetview?size=640x400&location=${cl},${co}&heading=${heading.toFixed(0)}&fov=70&pitch=8&source=outdoor&key=${KEY()}`, credit: `Street View © Google ${meta.date || ""}`.trim() };
}

/* ---------- http ---------- */
const hits = new Map();
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  list.push(now);
  hits.set(ip, list);
  return list.length > 120;
}
const num = (v, lo, hi) => { const n = +v; return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };

export async function handleRoofApi(req, res, json) {
  const u = new URL(req.url, "http://x"), p = u.searchParams;
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  if (limited(ip)) return json(res, 429, { ok: false, error: "Too many lookups. Try again later." });
  try {
    if (u.pathname === "/api/geocode") {
      const q = (p.get("q") || "").trim().slice(0, 200);
      if (q.length < 6) return json(res, 400, { ok: false, error: "Enter a full street address" });
      const g = await geocode(q);
      if (g && !g.county) g.county = countiesAt(g.lat, g.lon)[0]?.name;
      return g ? json(res, 200, { ok: true, ...g, imagery: KEY() ? "google" : "esri" }) : json(res, 404, { ok: false, error: "Couldn't find that address" });
    }
    const lat = num(p.get("lat"), 17, 72), lon = num(p.get("lon"), -180, -60);
    if (lat == null || lon == null) return json(res, 400, { ok: false, error: "Bad location" });
    if (u.pathname === "/api/roof") {
      // streamed as one JSON object per line, so the page can show each lookup as it happens
      res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
      const send = (o) => res.write(JSON.stringify(o) + "\n");
      try {
        const r = await roof(lat, lon, p.get("tap") ? 12 : 45, (text, state) => send({ step: text, state }));
        send(r ? { ok: true, ...r } : { ok: false, status: 404, error: "No building outline found there" });
      } catch (e) {
        console.error("roof api", e.message);
        send({ ok: false, status: 502, error: "Lookup service is busy. Try again in a minute." });
      }
      return res.end();
    }
    if (u.pathname === "/api/aerial" || u.pathname === "/api/street") {
      const shot = u.pathname === "/api/aerial"
        ? await aerial(lat, lon, Math.round(num(p.get("z"), 16, 21) ?? 19), Math.round(num(p.get("w"), 200, 640) ?? 640), Math.round(num(p.get("h"), 200, 640) ?? 420))
        : await street(lat, lon);
      if (!shot) { res.writeHead(404); return res.end(); }
      // proxy the image so the API key never reaches the browser
      const r = await fetch(shot.url, { headers: { "User-Agent": UA, "Accept-Encoding": "identity" }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`image ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(200, { "Content-Type": r.headers.get("content-type") || "image/jpeg", "Content-Length": buf.length, "Cache-Control": "public, max-age=86400", "X-Credit": shot.credit });
      return res.end(buf);
    }
    json(res, 404, { ok: false });
  } catch (e) {
    console.error("roof api", u.pathname, e.message);
    json(res, 502, { ok: false, error: "Lookup service is busy. Try again in a minute." });
  }
}

export const hasGoogle = () => !!KEY();
