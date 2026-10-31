/* Building designer: app shell. Tools, catalog, inspector, levels, views, files, prints, send. */
import * as C from "./core.js";
import { ASSEMBLIES, OPENINGS, ITEMS, GROUP_ORDER, RUNS, FLOORS, ROOF_MATERIALS, ROOF_COLORS, SIDING_COLORS } from "./catalog.js";
import { PlanEditor } from "./plan.js";
import { createViewer } from "./scene.js";
import { buildPrintSet } from "./prints.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const KEY = "cd-builder-doc";
const mobile = matchMedia("(max-width: 899px)").matches;

function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.v === 1) return d; } catch {}
  const kind = new URLSearchParams(location.search).get("start");
  return (C.TEMPLATES[kind] || C.TEMPLATES.ranch).make();
}

const app = {
  doc: load(), level: 0, tool: "select", sel: null, grid: 0.5, free: false, spaceDown: false, rot: 0,
  asm: "ext-2x6-vinyl", item: "sofa", run: "supply", style: { door: "interior", window: "double-hung", opening: "cased" },
  layers: { furniture: true, plumbing: true, hvac: true, electrical: true, roof: true, dims: true },
  view: mobile ? "3d" : "split", xray: false,
};
window.cdBuilder = app; // handy for debugging in the console

const hist = C.history(app.doc, (restored) => { if (restored) { app.sel = null; app.level = Math.min(app.level, app.doc.levels.length - 1); } refresh(); save(); });
app.commit = () => hist.commit();
app.select = (s) => { app.sel = s; inspector(); editor.render(); };
app.toast = (t) => { const el = $("#bdToast"); el.textContent = t; el.classList.add("is-on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("is-on"), 2600); };
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(app.doc)); $("#bdSaved").textContent = "Saved"; } catch { $("#bdSaved").textContent = "Not saved (storage full)"; } }, 400); }

/* ---------- views ---------- */
const editor = new PlanEditor($("#bdPlan"), app);
const viewer = createViewer($("#bd3d"), { hd: !mobile, mobile });
app.viewer = viewer;
let sync3d;
function update3d(now) {
  clearTimeout(sync3d);
  // "See systems" lifts the roof off and turns the walls to glass so pipes, ducts and wiring show
  const go = () => { const layers = { ...app.layers, roof: app.xray ? false : app.layers.roof }; viewer.layers = layers; viewer.setDoc(app.doc, { layers, systems: app.xray }); };
  if (now) go(); else sync3d = setTimeout(go, 180);
}
function setView(v) {
  app.view = v;
  $("#builder").dataset.view = v;
  $$("[data-view]").forEach((b) => b.classList.toggle("is-on", b.dataset.view === v));
  requestAnimationFrame(() => { editor.applyView(); viewer.resize(); });
}
function refresh() { levels(); editor.render(); inspector(); update3d(); $("#bdUndo").disabled = !hist.canUndo; $("#bdRedo").disabled = !hist.canRedo; $("#bdName").value = app.doc.name; }

/* ---------- tools + catalog ---------- */
const TOOLS = [
  ["select", "Select", "V", '<path d="M5 3l12 9-5 1 3 6-2 1-3-6-4 4z"/>'],
  ["wall", "Wall", "W", '<path d="M3 8h18v4H3z"/><path d="M3 16h18"/>'],
  ["room", "Room (box)", "B", '<rect x="4" y="5" width="16" height="14"/>'],
  ["door", "Door", "D", '<path d="M5 20V4h9v16M14 4a9 9 0 0 1 0 16"/>'],
  ["window", "Window", "N", '<rect x="4" y="9" width="16" height="6"/><path d="M4 12h16"/>'],
  ["opening", "Opening", "O", '<path d="M4 19V6h4M20 19V6h-4"/>'],
  ["roof", "Roof", "F", '<path d="M3 13 12 5l9 8"/><path d="M6 11v7h12v-7"/>'],
  ["run", "Pipe / duct / wire", "P", '<path d="M4 18V9h8v6h8V5"/>'],
];
function toolbar() {
  $("#bdTools").innerHTML = TOOLS.map(([id, name, key, icon]) => `<button type="button" class="bd-tool" data-tool="${id}" title="${name} (${key})"><svg viewBox="0 0 24 24">${icon}</svg><span>${name}</span><kbd>${key}</kbd></button>`).join("");
  const groups = {};
  Object.entries(ITEMS).forEach(([id, s]) => (groups[s.group] ||= []).push([id, s]));
  $("#bdCatalog").innerHTML = GROUP_ORDER.filter((g) => groups[g]).map((g) => `<details class="bd-cat"${g === "Structure" || g === "Exterior" ? " open" : ""}><summary>${g}</summary><div>${groups[g].map(([id, s]) => `<button type="button" class="bd-item" data-item="${id}">${esc(s.name)}</button>`).join("")}</div></details>`).join("");
}
function setTool(t) {
  app.tool = t; editor.temp = null;
  $$("[data-tool]").forEach((b) => b.classList.toggle("is-on", b.dataset.tool === t));
  $$("[data-item]").forEach((b) => b.classList.toggle("is-on", t === "item" && b.dataset.item === app.item));
  $("#bdPlan").dataset.tool = t;
  toolOptions();
  editor.render();
}
const HINT = {
  select: "Click to select · drag to move · drag empty space to pan · scroll to zoom · Delete removes",
  wall: "Click to start, click each corner · double-click or Esc to stop · click the first corner to close a room · Shift-free angles: hold Alt",
  room: "Drag a box to draw four walls at once",
  door: "Click a wall to add a door (it swings toward the side you click)", window: "Click a wall to add a window", opening: "Click a wall to add a cased opening",
  roof: "Drag a box over the walls to add a roof · set type and pitch on the right",
  run: "Click to add points · double-click or right-click to finish",
  item: "Click to place · R rotates · drag a box for decks, porches and slabs",
};
function toolOptions() {
  const t = app.tool, el = $("#bdToolOpts");
  let h = "";
  if (t === "wall" || t === "room") h = `<label>Wall type <select id="optAsm">${groupOpts(ASSEMBLIES, app.asm)}</select></label>`;
  if (t === "door" || t === "window" || t === "opening") h = `<label>${OPENINGS[t].name} style <select id="optStyle">${Object.entries(OPENINGS[t].styles).map(([k, s]) => `<option value="${k}"${app.style[t] === k ? " selected" : ""}>${s.name} · ${C.fmtFtIn(s.w)} × ${C.fmtFtIn(s.h)}</option>`).join("")}</select></label>`;
  if (t === "run") h = `<label>System <select id="optRun">${Object.entries(RUNS).map(([k, r]) => `<option value="${k}"${app.run === k ? " selected" : ""}>${r.name}</option>`).join("")}</select></label>`;
  if (t === "item") h = `<b>${esc(ITEMS[app.item]?.name)}</b>`;
  el.innerHTML = h + `<span class="bd-hint">${HINT[t] || ""}</span>`;
  $("#optAsm")?.addEventListener("change", (e) => { app.asm = e.target.value; });
  $("#optStyle")?.addEventListener("change", (e) => { app.style[t] = e.target.value; });
  $("#optRun")?.addEventListener("change", (e) => { app.run = e.target.value; });
}
function groupOpts(obj, cur) {
  const g = {}; Object.entries(obj).forEach(([k, v]) => (g[v.group] ||= []).push([k, v]));
  return Object.entries(g).map(([name, list]) => `<optgroup label="${name}">${list.map(([k, v]) => `<option value="${k}"${k === cur ? " selected" : ""}>${esc(v.name)}</option>`).join("")}</optgroup>`).join("");
}
$("#bdTools").addEventListener("click", (e) => { const b = e.target.closest("[data-tool]"); if (b) setTool(b.dataset.tool); });
$("#bdCatalog").addEventListener("click", (e) => { const b = e.target.closest("[data-item]"); if (b) { app.item = b.dataset.item; app.rot = 0; setTool("item"); } });

/* ---------- levels ---------- */
function levels() {
  $("#bdLevels").innerHTML = app.doc.levels.map((lv, i) => `<button type="button" class="bd-level${i === app.level ? " is-on" : ""}" data-level="${i}">${esc(lv.name)}</button>`).join("") + `<button type="button" class="bd-level add" id="bdAddLevel" title="Add a floor">+ Floor</button>`;
}
$("#bdLevels").addEventListener("click", (e) => {
  const b = e.target.closest("[data-level]");
  if (b) { app.level = +b.dataset.level; app.sel = null; refresh(); editor.fit(); return; }
  if (e.target.closest("#bdAddLevel")) {
    const top = app.doc.levels[app.doc.levels.length - 1];
    const names = ["First floor", "Second floor", "Third floor", "Fourth floor"];
    app.doc.levels.push({ id: C.uid("L"), name: names[app.doc.levels.length] || `Floor ${app.doc.levels.length + 1}`, elev: C.r2(top.elev + top.height + 1.25), height: 8.5 });
    // copy the outside walls up so the new floor starts with the same footprint
    const L = app.doc.levels.length - 1, map = {};
    for (const w of app.doc.walls.filter((x) => x.level === L - 1 && ASSEMBLIES[x.asm]?.ext)) {
      const [a, b] = C.ends(app.doc, w);
      for (const [k, n] of [[w.a, a], [w.b, b]]) if (!map[k]) map[k] = { x: n.x, y: n.y };
      C.addWall(app.doc, L, map[w.a], map[w.b], w.asm);
    }
    // the roof moves up to the new top floor
    for (const r of app.doc.roofs) if (r.level === L - 1) r.level = L;
    app.level = L; app.commit(); editor.fit();
  }
});

/* ---------- inspector ---------- */
const num = (id, label, v, step = 0.25, min = 0, unit = "ft") => `<label class="bd-f"><span>${label}</span><span class="bd-num"><input type="number" id="${id}" value="${C.r2(v)}" step="${step}" min="${min}"/><i>${unit}</i></span></label>`;
const sel = (id, label, opts, v) => `<label class="bd-f"><span>${label}</span><select id="${id}">${Object.entries(opts).map(([k, n]) => `<option value="${k}"${k === v ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>`;
const swatches = (id, label, opts, v) => `<div class="bd-f"><span>${label}</span><div class="bd-sw" id="${id}">${Object.entries(opts).map(([hex, n]) => `<button type="button" title="${esc(n)}" data-hex="${hex}" style="background:${hex}" class="${hex === v ? "is-on" : ""}"></button>`).join("")}</div></div>`;
function layerDiagram(asm) {
  const A = ASSEMBLIES[asm];
  return `<div class="bd-layers"><div class="bd-layer-bar">${A.layers.map(([n, t, c]) => `<i style="flex:${Math.max(0.35, t)};background:${c}" title="${esc(n)}"></i>`).join("")}</div><ol>${A.layers.map(([n, t]) => `<li>${esc(n)}${t >= 0.1 ? ` <small>${t}"</small>` : ""}</li>`).join("")}</ol><p>Outside ← → inside · ${(A.thick * 12).toFixed(1)}" overall</p></div>`;
}
function inspector() {
  const d = app.doc, s = app.sel, el = $("#bdInspect");
  let h = "";
  const on = (id, ev, fn) => { const x = $("#" + id); if (x) x.addEventListener(ev, fn); };
  if (!s) {
    const area = d.levels.reduce((a, _, L) => a + C.rooms(d, L).reduce((t, r) => t + Math.abs(r.area), 0), 0);
    const lv = d.levels[app.level];
    h = `<h3>Project</h3>
      <dl class="bd-stats"><div><dt>Finished area</dt><dd>${Math.round(area).toLocaleString()} sq ft</dd></div><div><dt>Floors</dt><dd>${d.levels.length}</dd></div><div><dt>Walls</dt><dd>${d.walls.length}</dd></div><div><dt>Doors & windows</dt><dd>${d.openings.length}</dd></div></dl>
      ${sel("pKind", "Building type", { home: "Home", commercial: "Commercial" }, d.kind)}
      <h3>${esc(lv.name)}</h3>
      <label class="bd-f"><span>Name</span><input id="lvName" value="${esc(lv.name)}"/></label>
      ${num("lvH", "Ceiling height", lv.height, 0.25, 7)}${num("lvE", "Floor elevation", lv.elev, 0.25, 0)}
      ${d.levels.length > 1 ? `<button type="button" class="btn btn-ghost btn-sm" id="lvDel">Delete this floor</button>` : ""}
      <h3>Exterior look</h3>
      ${swatches("pSiding", "Siding color", SIDING_COLORS, d.settings.sidingColor)}
      ${swatches("pTrim", "Trim color", { "#f4f3ef": "White", "#1f2124": "Black", "#3b4a5a": "Navy", "#7a6a58": "Bronze" }, d.settings.trimColor)}
      ${swatches("pBrick", "Brick color", { "#8a4a3a": "Red", "#a36a4f": "Tan", "#6b5e57": "Charcoal", "#d4c7b4": "Cream" }, d.settings.brickColor)}
      <h3>Roofing</h3>
      ${sel("pRoofMat", "Material", ROOF_MATERIALS, d.settings.roofMaterial)}
      ${swatches("pRoofCol", "Color", ROOF_COLORS, d.settings.roofColor)}
      <button type="button" class="btn btn-ghost btn-sm" id="pAutoRoof">${d.roofs.length ? "Rebuild roof over top floor" : "Add a roof over top floor"}</button>`;
    el.innerHTML = h;
    on("pKind", "change", (e) => { d.kind = e.target.value; app.commit(); });
    on("lvName", "change", (e) => { lv.name = e.target.value || lv.name; app.commit(); });
    on("lvH", "change", (e) => { lv.height = Math.max(7, +e.target.value || lv.height); app.commit(); });
    on("lvE", "change", (e) => { lv.elev = Math.max(0, +e.target.value || 0); app.commit(); });
    on("lvDel", "click", () => {
      if (!confirm(`Delete ${lv.name} and everything on it?`)) return;
      const L = app.level;
      d.walls = d.walls.filter((w) => w.level !== L); d.objects = d.objects.filter((o) => o.level !== L); d.runs = d.runs.filter((r) => r.level !== L);
      for (const [k, n] of Object.entries(d.nodes)) if (n.level === L) delete d.nodes[k];
      d.roofs = d.roofs.filter((r) => r.level !== L);
      const shift = (o) => { if (o.level > L) o.level--; };
      d.walls.forEach(shift); d.objects.forEach(shift); d.runs.forEach(shift); d.roofs.forEach(shift); Object.values(d.nodes).forEach(shift);
      d.openings = d.openings.filter((o) => d.walls.some((w) => w.id === o.wall));
      d.levels.splice(L, 1); app.level = Math.max(0, L - 1); app.commit();
    });
    const sw = (id, key) => on(id, "click", (e) => { const b = e.target.closest("[data-hex]"); if (b) { d.settings[key] = b.dataset.hex; app.commit(); } });
    sw("pSiding", "sidingColor"); sw("pTrim", "trimColor"); sw("pBrick", "brickColor"); sw("pRoofCol", "roofColor");
    on("pRoofMat", "change", (e) => { d.settings.roofMaterial = e.target.value; if (e.target.value === "tpo" || e.target.value === "epdm") d.roofs.forEach((r) => (r.type = "flat")); app.commit(); });
    on("pAutoRoof", "click", () => { const r = C.autoRoof(d); if (r) { app.commit(); app.select({ kind: "roof", id: r.id }); } else app.toast("Draw some walls first."); });
    return;
  }
  const del = `<button type="button" class="btn btn-ghost btn-sm bd-del" id="iDel">Delete</button>`;
  if (s.kind === "wall") {
    const w = d.walls.find((x) => x.id === s.id); if (!w) return app.select(null);
    const len = C.wallLength(d, w);
    h = `<h3>Wall</h3>${sel("wAsm", "Assembly", Object.fromEntries(Object.entries(ASSEMBLIES).map(([k, v]) => [k, v.name])), w.asm)}${layerDiagram(w.asm)}
      ${num("wLen", "Length", len, 0.25, 1)}${num("wH", "Height", w.h || d.levels[w.level].height, 0.25, 1)}
      <p class="bd-tip">Drag the round handles on the plan to move the corners.</p>${del}`;
    el.innerHTML = h;
    on("wAsm", "change", (e) => { w.asm = e.target.value; app.commit(); });
    on("wLen", "change", (e) => { const L2 = Math.max(1, +e.target.value), [a, b] = C.ends(d, w); b.x = C.r2(a.x + (b.x - a.x) / len * L2); b.y = C.r2(a.y + (b.y - a.y) / len * L2); app.commit(); });
    on("wH", "change", (e) => { const v = +e.target.value; w.h = v && v !== d.levels[w.level].height ? v : undefined; app.commit(); });
    on("iDel", "click", () => { C.deleteWall(d, w); app.sel = null; app.commit(); });
  } else if (s.kind === "opening") {
    const o = d.openings.find((x) => x.id === s.id); if (!o) return app.select(null);
    const styles = Object.fromEntries(Object.entries(OPENINGS[o.type].styles).map(([k, v]) => [k, v.name]));
    h = `<h3>${OPENINGS[o.type].name}</h3>${sel("oStyle", "Style", styles, o.style)}${num("oW", "Width", o.w, 0.25, 1)}${num("oH", "Height", o.h, 0.25, 1)}${o.type === "window" ? num("oSill", "Sill height", o.sill, 0.25, 0) : ""}${num("oT", "From wall start", o.t, 0.25, 0)}
      ${o.type === "door" ? `<div class="bd-row"><button type="button" class="btn btn-ghost btn-sm" id="oSwing">Flip swing</button><button type="button" class="btn btn-ghost btn-sm" id="oHinge">Flip hinge</button></div>` : ""}${del}`;
    el.innerHTML = h;
    on("oStyle", "change", (e) => { const st = OPENINGS[o.type].styles[e.target.value]; o.style = e.target.value; o.w = st.w; o.h = st.h; if (st.sill != null) o.sill = st.sill; C.clampOpening(d, o); app.commit(); });
    for (const [id, k] of [["oW", "w"], ["oH", "h"], ["oSill", "sill"], ["oT", "t"]]) on(id, "change", (e) => { o[k] = Math.max(0, +e.target.value); C.clampOpening(d, o); app.commit(); });
    on("oSwing", "click", () => { o.swing = -(o.swing || 1); app.commit(); });
    on("oHinge", "click", () => { o.hinge = o.hinge ? 0 : 1; app.commit(); });
    on("iDel", "click", () => { d.openings = d.openings.filter((x) => x !== o); app.sel = null; app.commit(); });
  } else if (s.kind === "item") {
    const o = d.objects.find((x) => x.id === s.id); if (!o) return app.select(null);
    const spec = ITEMS[o.type];
    h = `<h3>${esc(spec.name)}</h3><p class="bd-tip">${esc(spec.group)} · ${spec.mount === "roof" ? "sits on the roof" : spec.mount === "wall" ? "mounted on the wall" : spec.mount === "ceiling" ? "on the ceiling" : "on the floor"}</p>
      ${spec.sized || o.w ? num("iW", "Width", o.w || spec.w, 0.5, 1) + num("iD", "Depth", o.d || spec.d, 0.5, 1) : ""}
      ${o.type === "deck" ? num("iHt", "Deck height", o.h || 2.5, 0.25, 0.5) : ""}
      <div class="bd-row"><button type="button" class="btn btn-ghost btn-sm" id="iRot">Rotate (R)</button><button type="button" class="btn btn-ghost btn-sm" id="iDup">Duplicate</button></div>${del}`;
    el.innerHTML = h;
    on("iW", "change", (e) => { o.w = Math.max(1, +e.target.value); app.commit(); });
    on("iD", "change", (e) => { o.d = Math.max(1, +e.target.value); app.commit(); });
    on("iHt", "change", (e) => { o.h = Math.max(0.5, +e.target.value); app.commit(); });
    on("iRot", "click", () => { o.rot = ((o.rot || 0) + 1) % 4; app.commit(); });
    on("iDup", "click", () => { const c = { ...C.clone(o), id: C.uid("i"), x: o.x + 2, y: o.y + 2 }; d.objects.push(c); app.commit(); app.select({ kind: "item", id: c.id }); });
    on("iDel", "click", () => { d.objects = d.objects.filter((x) => x !== o); app.sel = null; app.commit(); });
  } else if (s.kind === "room") {
    const r = C.rooms(d, app.level).find((x) => x.key === s.key); if (!r) return app.select(null);
    h = `<h3>Room</h3><label class="bd-f"><span>Name</span><input id="rName" value="${esc(r.name)}" placeholder="e.g. Kitchen"/></label>
      ${sel("rFloor", "Floor finish", Object.fromEntries(Object.entries(FLOORS).map(([k, v]) => [k, v.name])), r.floor)}
      <dl class="bd-stats"><div><dt>Area</dt><dd>${Math.round(Math.abs(r.area))} sq ft</dd></div><div><dt>Perimeter</dt><dd>${Math.round(r.pts.reduce((t, p, i) => t + C.dist(p, r.pts[(i + 1) % r.pts.length]), 0))} ft</dd></div></dl>`;
    el.innerHTML = h;
    const set = () => { d.rooms[r.key] = { name: $("#rName").value, floor: $("#rFloor").value }; app.commit(); };
    on("rName", "change", set); on("rFloor", "change", set);
  } else if (s.kind === "roof") {
    const r = d.roofs.find((x) => x.id === s.id); if (!r) return app.select(null);
    const st = C.roofStats(r);
    h = `<h3>Roof</h3>${sel("fType", "Type", { gable: "Gable", hip: "Hip", shed: "Shed", flat: "Flat" }, r.type)}
      ${r.type !== "flat" ? sel("fPitch", "Pitch", Object.fromEntries([3, 4, 5, 6, 7, 8, 9, 10, 12].map((p) => [p, `${p}/12`])), String(r.pitch)) + sel("fRidge", "Ridge runs", { x: "Left to right", y: "Front to back" }, r.ridge) : num("fPar", "Parapet height", r.parapet || 0, 0.5, 0)}
      ${num("fO", "Overhang", r.overhang, 0.25, 0)}${num("fW", "Width", r.w, 0.5, 4)}${num("fD", "Depth", r.d, 0.5, 4)}
      <dl class="bd-stats"><div><dt>Roof area</dt><dd>${Math.round(st.sloped).toLocaleString()} sq ft</dd></div><div><dt>Squares (+8%)</dt><dd>${(Math.ceil(st.sloped * 1.08 / 100 * 3) / 3).toFixed(1)}</dd></div></dl>${del}`;
    el.innerHTML = h;
    on("fType", "change", (e) => { r.type = e.target.value; app.commit(); });
    on("fPitch", "change", (e) => { r.pitch = +e.target.value; app.commit(); });
    on("fRidge", "change", (e) => { r.ridge = e.target.value; app.commit(); });
    for (const [id, k] of [["fPar", "parapet"], ["fO", "overhang"], ["fW", "w"], ["fD", "d"]]) on(id, "change", (e) => { r[k] = Math.max(0, +e.target.value); app.commit(); });
    on("iDel", "click", () => { d.roofs = d.roofs.filter((x) => x !== r); app.sel = null; app.commit(); });
  } else if (s.kind === "run") {
    const r = d.runs.find((x) => x.id === s.id); if (!r) return app.select(null);
    const L = r.pts.reduce((t, p, i) => (i ? t + Math.hypot(p[0] - r.pts[i - 1][0], p[1] - r.pts[i - 1][1]) : 0), 0);
    h = `<h3>${esc(RUNS[r.system].name)}</h3>${sel("uSys", "System", Object.fromEntries(Object.entries(RUNS).map(([k, v]) => [k, v.name])), r.system)}<dl class="bd-stats"><div><dt>Length</dt><dd>${Math.round(L)} ft</dd></div></dl>${del}`;
    el.innerHTML = h;
    on("uSys", "change", (e) => { r.system = e.target.value; app.commit(); });
    on("iDel", "click", () => { d.runs = d.runs.filter((x) => x !== r); app.sel = null; app.commit(); });
  }
}

/* ---------- top bar ---------- */
$("#bdName").addEventListener("change", (e) => { app.doc.name = e.target.value || "Untitled design"; app.commit(); });
$("#bdUndo").addEventListener("click", () => hist.undo());
$("#bdRedo").addEventListener("click", () => hist.redo());
$$("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
$("#bdNew").addEventListener("click", () => $("#bdNewDlg").showModal());
$("#bdNewDlg").addEventListener("click", (e) => {
  const b = e.target.closest("[data-template]");
  if (b) {
    const fresh = C.TEMPLATES[b.dataset.template].make();
    for (const k of Object.keys(app.doc)) delete app.doc[k];
    Object.assign(app.doc, fresh);
    app.level = 0; app.sel = null; hist.reset(); refresh(); save(); editor.fit(); update3d(true); setTimeout(() => viewer.frameAll(), 400);
    $("#bdNewDlg").close();
  } else if (e.target === e.currentTarget || e.target.closest("[data-close]")) $("#bdNewDlg").close();
});
$("#bdExport").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(app.doc, null, 1)], { type: "application/json" }));
  a.download = `${app.doc.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "design"}.cdplan.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
});
$("#bdOpen").addEventListener("click", () => $("#bdFile").click());
$("#bdFile").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.v !== 1 || !Array.isArray(d.walls)) throw new Error();
    for (const k of Object.keys(app.doc)) delete app.doc[k];
    Object.assign(app.doc, d); app.level = 0; app.sel = null; hist.reset(); refresh(); save(); editor.fit(); update3d(true);
  } catch { app.toast("That file isn't a design from this tool."); }
  e.target.value = "";
});
$$("[data-layer]").forEach((b) => b.addEventListener("change", () => { app.layers[b.dataset.layer] = b.checked; editor.render(); update3d(); }));
$("#bdGrid").addEventListener("change", (e) => { app.grid = +e.target.value; editor.render(); });
$("#bdXray").addEventListener("click", (e) => { app.xray = !app.xray; e.currentTarget.classList.toggle("is-on", app.xray); update3d(true); });
$$("[data-cam]").forEach((b) => b.addEventListener("click", () => viewer.frameAll(b.dataset.cam)));

/* ---------- walk-through ---------- */
$("#bdWalk").addEventListener("click", () => {
  if (mobile) { app.toast("Walk-through needs a keyboard and mouse."); return; }
  if (app.view === "plan") setView("split");
  const r = C.rooms(app.doc, 0).sort((a, b) => Math.abs(b.area) - Math.abs(a.area))[0];
  const start = r ? { x: r.c.x, y: r.c.y, level: 0 } : { x: 0, y: 20, level: 0 };
  $("#builder").classList.add("is-walking");
  viewer.walkMode(true, start);
});
function exitWalk() { if (viewer.mode === "walk") { viewer.walkMode(false); $("#builder").classList.remove("is-walking"); } }
$("#bdWalkHelp").addEventListener("click", (e) => { if (e.target.closest("#bdWalkExit")) exitWalk(); else viewer.lock(); });
// Esc frees the mouse; the help card stays so you can click back in or exit
viewer.onUnlock(() => $("#builder").classList.add("is-paused"));

/* 3D click selects what's under the cursor */
let downAt = null;
$("#bd3d").addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
$("#bd3d").addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4 || viewer.mode === "walk") return;
  const p = viewer.pick(e);
  if (!p) return app.select(null);
  if (p.kind === "room") { app.level = p.level; levels(); return app.select({ kind: "room", key: p.key, id: p.key }); }
  const lvOf = p.kind === "wall" ? app.doc.walls.find((w) => w.id === p.id)?.level : p.kind === "item" ? app.doc.objects.find((o) => o.id === p.id)?.level : p.kind === "roof" ? app.doc.roofs.find((r) => r.id === p.id)?.level : null;
  if (lvOf != null && lvOf !== app.level) { app.level = lvOf; levels(); }
  app.select(p);
});

/* ---------- keyboard ---------- */
addEventListener("keydown", (e) => {
  if (/input|select|textarea/i.test(e.target.tagName) || viewer.mode === "walk" || $("#bdPrints").open) return;
  const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
  if (mod && k === "z") { e.preventDefault(); e.shiftKey ? hist.redo() : hist.undo(); return; }
  if (mod && k === "y") { e.preventDefault(); hist.redo(); return; }
  if (e.key === " ") { app.spaceDown = true; e.preventDefault(); return; }
  if (e.key === "Alt") app.free = true;
  if (e.key === "Escape") { editor.temp ? editor.cancel() : (app.sel ? app.select(null) : setTool("select")); return; }
  if (e.key === "Enter") { editor.finish(); return; }
  if ((e.key === "Delete" || e.key === "Backspace") && app.sel) { e.preventDefault(); $("#iDel")?.click(); return; }
  if (k === "r") {
    if (app.tool === "item") { app.rot = (app.rot + 1) % 4; editor.render(); }
    else if (app.sel?.kind === "item") { const o = app.doc.objects.find((x) => x.id === app.sel.id); if (o) { o.rot = ((o.rot || 0) + 1) % 4; app.commit(); } }
    return;
  }
  const t = TOOLS.find((x) => x[2].toLowerCase() === k);
  if (t && !mod) setTool(t[0]);
});
addEventListener("keyup", (e) => { if (e.key === " ") app.spaceDown = false; if (e.key === "Alt") app.free = false; });

/* ---------- prints ---------- */
$("#bdPrintBtn").addEventListener("click", async () => {
  const dlg = $("#bdPrints"), box = $("#bdSheets");
  box.innerHTML = `<p class="bd-gen">Drawing your print set…</p>`;
  dlg.showModal();
  update3d(true);
  await new Promise((r) => setTimeout(r, 350));
  try { box.innerHTML = await buildPrintSet(app.doc, viewer); }
  catch (err) { console.error(err); box.innerHTML = `<p class="bd-gen">Couldn't draw the print set: ${esc(err.message)}</p>`; }
});
// prints go through a top-level copy of the sheets so nothing else on the page prints
$("#bdDoPrint").addEventListener("click", () => {
  let root = $("#printRoot");
  if (!root) { root = document.createElement("div"); root.id = "printRoot"; document.body.appendChild(root); }
  root.innerHTML = $("#bdSheets").innerHTML;
  window.print();
});
addEventListener("afterprint", () => { const r = $("#printRoot"); if (r) r.innerHTML = ""; });
$("#bdClosePrints").addEventListener("click", () => $("#bdPrints").close());

/* ---------- send to Colin ---------- */
$("#bdSend").addEventListener("click", async () => {
  const d = app.doc, area = d.levels.reduce((a, _, L) => a + C.rooms(d, L).reduce((t, r) => t + Math.abs(r.area), 0), 0);
  const tk = C.takeoff(d).filter((r) => ["Roofing", "Cladding", "Doors & windows"].includes(r[0])).slice(0, 8).map((r) => `${r[1]}: ${r[2]} ${r[3]}`);
  window.CD?.attach("build", [`Designer plan: ${d.name} (${d.kind})`, `${Math.round(area).toLocaleString()} sq ft, ${d.levels.length} floor(s), ${d.walls.length} walls, ${d.openings.length} doors/windows`, ...tk].join(" | "));
  const blob = await viewer.snapshot(1600);
  if (blob) window.CD?.attach("render", blob);
  window.CD?.goTo("contact");
});

/* ---------- start ---------- */
toolbar();
setTool("select");
setView(app.view);
refresh();
requestAnimationFrame(() => { editor.fit(); update3d(true); setTimeout(() => viewer.frameAll(), 500); });
if (mobile) $("#bdMobile").hidden = false;
