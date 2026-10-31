/* Building designer: the print set. Each sheet is an 11×17-style landscape page laid out for letter
   (11 × 8.5 in) with a title block. Plans print at a true architectural scale. */
import * as C from "./core.js";
import { ASSEMBLIES, ITEMS, OPENINGS, RUNS, FLOORS, LAYER_OF } from "./catalog.js";
import { renderPlan } from "./plan.js";
import { lineDrawing } from "./scene.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const DRAW_W = 8.1, DRAW_H = 7.1; // inches available for a drawing on a sheet
const SCALES = [[4, '1/4" = 1\'-0"'], [8, '1/8" = 1\'-0"'], [16, '1/16" = 1\'-0"'], [32, '1/32" = 1\'-0"']];
const pickScale = (wFt, hFt, availW = DRAW_W, availH = DRAW_H) => SCALES.find(([f]) => wFt / f <= availW && hFt / f <= availH) || SCALES[SCALES.length - 1];

function sheet(doc, num, title, body, scale) {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const brand = window.SITE?.brand || "CD Consulting";
  return `<section class="sheet">
    <div class="sheet-body">${body}</div>
    <aside class="title-block">
      <div class="tb-brand">${esc(brand)}<small>Construction consultant</small></div>
      <div class="tb-row"><span>Project</span><b>${esc(doc.name)}</b></div>
      <div class="tb-row"><span>Sheet</span><b>${esc(title)}</b></div>
      ${scale ? `<div class="tb-row"><span>Scale</span><b>${scale}</b></div>` : ""}
      <div class="tb-row"><span>Date</span><b>${date}</b></div>
      <div class="tb-note">For design and estimating only. Not for construction. Structural members, loads and code compliance to be verified by a licensed professional.</div>
      <div class="tb-num">${num}</div>
    </aside>
  </section>`;
}
const table = (head, rows, cls = "") => `<table class="sched ${cls}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

function planSvg(doc, L, layers, extraOpts = {}) {
  const b = C.bounds(doc, L) || { x0: 0, y0: 0, x1: 40, y1: 30 };
  // include items, decks and roof overhangs around the walls
  for (const o of doc.objects.filter((x) => x.level === L)) { const s = ITEMS[o.type], w = (o.w || s?.w || 1) / 2 + 1, d = (o.d || s?.d || 1) / 2 + 1; b.x0 = Math.min(b.x0, o.x - w); b.x1 = Math.max(b.x1, o.x + w); b.y0 = Math.min(b.y0, o.y - d); b.y1 = Math.max(b.y1, o.y + d); }
  const pad = 9, x = b.x0 - pad, y = b.y0 - pad, w = b.x1 - b.x0 + 2 * pad, h = b.y1 - b.y0 + 2 * pad;
  const [f, label] = pickScale(w, h);
  const r = renderPlan(doc, L, { print: true, layers, ...extraOpts });
  return { html: `<svg class="print-plan" width="${(w / f).toFixed(3)}in" height="${(h / f).toFixed(3)}in" viewBox="${x} ${y} ${w} ${h}"><g class="plan">${r.svg}</g></svg>`, scale: label, tags: r.tags };
}
function northArrow() { return `<svg class="north" viewBox="-12 -14 24 30" width="0.45in"><path d="M0 -12 L7 10 L0 5 L-7 10 Z"/><text x="0" y="15.5" text-anchor="middle" font-size="7">N</text></svg>`; }

function assemblyDiagram(id) {
  const A = ASSEMBLIES[id], total = A.layers.reduce((s, l) => s + l[1], 0), W = 300, H = 120, k = (W * 0.6) / Math.max(total, 4);
  let x = 20, rects = "", labels = "";
  A.layers.forEach(([name, t, color], i) => {
    const w = Math.max(3, t * k);
    rects += `<rect x="${x}" y="10" width="${w}" height="${H - 20}" fill="${color}" stroke="#111" stroke-width=".6"/>`;
    const ly = 18 + i * ((H - 16) / A.layers.length);
    labels += `<line x1="${x + w / 2}" y1="${ly}" x2="${W * 0.66}" y2="${ly}" stroke="#111" stroke-width=".4"/><text x="${W * 0.67}" y="${ly + 3}" font-size="7.5">${esc(name)}${t >= 0.1 ? ` · ${t}"` : ""}</text>`;
    x += w;
  });
  return `<figure class="assembly"><figcaption>${esc(A.name)}</figcaption><svg viewBox="0 0 ${W * 1.6} ${H}" width="4.8in">${rects}${labels}<text x="20" y="${H - 1}" font-size="6.5" fill="#555">OUTSIDE</text><text x="${x - 2}" y="${H - 1}" font-size="6.5" fill="#555" text-anchor="end">INSIDE</text></svg><p>Overall ${(A.thick * 12).toFixed(2)}" thick</p></figure>`;
}

export async function buildPrintSet(doc0, viewer) {
  const doc = C.clone(doc0), sheets = [], index = [];
  const add = (num, title, body, scale) => { sheets.push(sheet(doc, num, title, body, scale)); index.push([num, title]); };
  const total = doc.levels.reduce((s, _, L) => s + C.rooms(doc, L).reduce((a, r) => a + Math.abs(r.area), 0), 0);
  const b0 = C.bounds(doc, 0);

  // floor plans (also assigns D#/W# tags used by the schedules)
  const plans = [];
  let tags = { D: 0, W: 0 };
  doc.levels.forEach((lv, L) => {
    if (!C.wallsOn(doc, L).length) return;
    const p = planSvg(doc, L, { plumbing: false, hvac: false, electrical: false, roof: false }, { tags });
    tags = p.tags;
    plans.push([L, p]);
  });
  // cover
  let hero = "";
  try { const blob = await viewer.snapshot(1600); hero = blob ? URL.createObjectURL(blob) : ""; } catch { /* no 3D */ }
  const coverBody = `<div class="cover">
      <div><p class="cover-k">${doc.kind === "commercial" ? "Commercial building" : "Residence"}</p><h1>${esc(doc.name)}</h1>
      <dl class="cover-dl">
        <div><dt>Floors</dt><dd>${doc.levels.filter((_, L) => C.wallsOn(doc, L).length).length}</dd></div>
        <div><dt>Finished area</dt><dd>${Math.round(total).toLocaleString()} sq ft</dd></div>
        ${b0 ? `<div><dt>Footprint</dt><dd>${C.fmtFtIn(b0.x1 - b0.x0)} × ${C.fmtFtIn(b0.y1 - b0.y0)}</dd></div>` : ""}
        <div><dt>Roof</dt><dd>${doc.roofs.map((r) => (r.type === "flat" ? "Flat" : `${r.pitch}/12 ${r.type}`)).join(", ") || "None"}</dd></div>
      </dl>
      <h2>Sheet index</h2><ol class="sheet-index" id="sheetIndex"></ol></div>
      ${hero ? `<img src="${hero}" alt="3D view of the design" class="cover-img"/>` : ""}
    </div>`;
  const coverAt = sheets.length;
  sheets.push(""); index.push(["A0", "Cover & sheet index"]);

  plans.forEach(([L, p], i) => add(`A1.${i + 1}`, `${doc.levels[L].name} plan`, `<div class="draw">${p.html}</div><div class="legend">${northArrow()}<span>${esc(doc.levels[L].name)} · ${Math.round(C.rooms(doc, L).reduce((a, r) => a + Math.abs(r.area), 0)).toLocaleString()} sq ft</span></div>`, p.scale));

  // elevations: two per sheet, stacked, at the largest scale that fits
  const views = [["front", "Front elevation"], ["back", "Rear elevation"], ["right", "Right elevation"], ["left", "Left elevation"]];
  const elev = views.map(([v, name]) => ({ v, name, ...lineDrawing(doc, v, 1600, 640) }));
  const wFt = Math.max(...elev.map((e) => e.ftPerPx * 1600)), hFt = wFt * 640 / 1600;
  const [ef, elabel] = pickScale(wFt, hFt, DRAW_W, DRAW_H / 2 - 0.25);
  for (const [i, pair] of [[1, elev.slice(0, 2)], [2, elev.slice(2)]]) {
    add(`A2.${i}`, pair.map((e) => e.name.replace(" elevation", "")).join(" & ") + " elevations", `<div class="elev-stack">${pair.map((e) => `<figure><img src="${e.url}" style="width:${((e.ftPerPx * 1600) / ef).toFixed(3)}in"/><figcaption>${e.name} · ${elabel}</figcaption></figure>`).join("")}</div>`, elabel);
  }

  // roof plan
  const top = lineDrawing(doc, "top", 1100, 760);
  const [rf, rlabel] = pickScale(top.ftPerPx * 1100, top.ftPerPx * 760, 5.4, DRAW_H);
  const roofRows = doc.roofs.map((r, i) => { const s = C.roofStats(r); return [`R${i + 1}`, r.type === "flat" ? "flat" : `${r.pitch}/12 ${r.type}`, `${Math.round(s.sloped).toLocaleString()}`, `${(Math.ceil(s.sloped * 1.08 / 100 * 3) / 3).toFixed(1)}`]; });
  const roofItems = {}; doc.objects.forEach((o) => { const sp = ITEMS[o.type]; if (sp && (sp.mount === "roof" || o.type === "chimney")) roofItems[sp.name] = (roofItems[sp.name] || 0) + 1; });
  add("A3.1", "Roof plan", `<div class="split-sheet"><div class="draw"><img src="${top.url}" style="width:${((top.ftPerPx * 1100) / rf).toFixed(3)}in"/></div><div class="notes">
    <h3>Roofs</h3>${table(["Roof", "Type", "Sq ft", "Squares +8%"], roofRows, "small")}
    <h3>On the roof</h3>${table(["Item", "Qty"], Object.entries(roofItems), "small")}
    <h3>Roofing notes</h3><ol class="notes-list"><li>${esc(doc.settings.roofMaterial === "metal" ? "Standing-seam metal panels over synthetic underlayment." : doc.settings.roofMaterial === "shingle" ? "Architectural shingles over synthetic underlayment; ice & water shield at eaves and valleys." : "Fully adhered single-ply membrane over polyiso; tapered insulation to drains.")}</li><li>Drip edge at eaves and rakes; starter strip at all edges.</li><li>Flash every penetration: pipe boots, chimney step + counter flashing, curbs.</li><li>Balanced intake (soffit) and exhaust (ridge) ventilation where applicable.</li></ol>
  </div></div>`, rlabel);

  // systems plans
  doc.levels.forEach((lv, L) => {
    if (!C.wallsOn(doc, L).length) return;
    const has = doc.runs.some((r) => r.level === L) || doc.objects.some((o) => o.level === L && ["plumbing", "hvac", "electrical"].includes(LAYER_OF(ITEMS[o.type] || {})));
    if (!has) return;
    const p = planSvg(doc, L, { furniture: false, roof: false, dims: false });
    const legend = Object.entries(RUNS).map(([k, r]) => `<li><i style="background:${r.color}"></i>${esc(r.name)}</li>`).join("");
    const counts = {}; doc.objects.filter((o) => o.level === L).forEach((o) => { const s = ITEMS[o.type]; if (s && ["Plumbing", "HVAC", "Electrical"].includes(s.group)) counts[`${s.group}: ${s.name}`] = (counts[`${s.group}: ${s.name}`] || 0) + 1; });
    add(`M${L + 1}.1`, `${lv.name} plumbing / HVAC / electrical`, `<div class="split-sheet"><div class="draw">${p.html}</div><div class="notes"><h3>Legend</h3><ul class="run-legend">${legend}</ul><h3>Fixtures & devices</h3>${table(["Item", "Qty"], Object.entries(counts).sort())}</div></div>`, p.scale);
  });

  // wall assemblies
  const used = [...new Set(doc.walls.map((w) => w.asm))].filter((id) => ASSEMBLIES[id]);
  add("A4.1", "Wall assemblies", `<div class="assemblies">${used.map(assemblyDiagram).join("")}</div>`, "NTS");

  // schedules
  const opRows = (type) => doc.openings.filter((o) => o.type === type).map((o) => {
    const w = doc.walls.find((x) => x.id === o.wall), lv = doc.levels[w?.level ?? 0];
    return [o._tag || "", lv?.name || "", OPENINGS[type]?.styles[o.style]?.name || o.style, C.fmtFtIn(o.w), C.fmtFtIn(o.h), type === "window" ? C.fmtFtIn(o.sill) : (o.swing > 0 ? "In" : "Out"), ASSEMBLIES[w?.asm]?.ext ? "Exterior" : "Interior"];
  }).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  const roomRows = []; doc.levels.forEach((lv, L) => C.rooms(doc, L).forEach((r) => roomRows.push([r.name || "Room", lv.name, `${Math.round(Math.abs(r.area))} sq ft`, FLOORS[r.floor]?.name || r.floor, `${C.fmtFtIn(lv.height)}`])));
  add("A5.1", "Door, window & room schedules", `<div class="sched-grid"><div><h3>Doors</h3>${table(["Tag", "Floor", "Type", "Width", "Height", "Swing", "Wall"], opRows("door"), "small")}</div><div><h3>Windows</h3>${table(["Tag", "Floor", "Type", "Width", "Height", "Sill", "Wall"], opRows("window"), "small")}</div><div><h3>Rooms & finishes</h3>${table(["Room", "Floor", "Area", "Floor finish", "Ceiling"], roomRows, "small")}</div></div>`);

  // materials takeoff, as many sheets as it needs
  const rows = C.takeoff(doc0);
  const per = 30;
  for (let i = 0; i < Math.max(1, Math.ceil(rows.length / per)); i++) {
    add(`T${i + 1}`, `Materials takeoff${rows.length > per ? ` (${i + 1})` : ""}`, `<h3>Materials takeoff</h3>${table(["Section", "Item", "Qty", "Unit", "Notes"], rows.slice(i * per, (i + 1) * per).map((r) => [r[0], r[1], typeof r[2] === "number" ? r[2].toLocaleString() : r[2], r[3], r[4]]), "takeoff")}<p class="fine-print">Quantities are calculated from the model and include the waste factors noted. Verify on site before ordering.</p>`);
  }

  sheets[coverAt] = sheet(doc, "A0", "Cover", coverBody.replace('<ol class="sheet-index" id="sheetIndex"></ol>', `<ol class="sheet-index">${index.map(([n, t]) => `<li><b>${n}</b>${esc(t)}</li>`).join("")}</ol>`));
  return sheets.join("");
}
