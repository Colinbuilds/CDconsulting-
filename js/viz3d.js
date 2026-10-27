/* Exterior visualizer: product catalog UI + live 3D home + paint-your-photo.
   Modeled on how pro visualizers work: pick a surface, pick a manufacturer line,
   pick a named color, see it instantly; compare against the original; save/share. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { createStage } from "./3d/stage.js";
import { buildHouse } from "./3d/house.js";
import { buildSite } from "./3d/site.js";
import { CATALOG, ORIGINAL, PRESETS, lineOf, hexOf, describe } from "./3d/catalog.js";
import { onTextureLoad } from "./3d/textures.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clone = (o) => JSON.parse(JSON.stringify(o));
const PHOTO_CATS = ["roof", "siding", "trim", "door"];

let design = loadFromHash() || clone(PRESETS.find((p) => p.name === "Navy Luxe").design);
let presetName = loadFromHash() ? null : "Navy Luxe";
let cat = "roof";
let mode = "model";
let comparing = false, dusk = false, touched = false;

/* ---------------------------------------------------------------- helpers */
function resolve(d) {
  const r = {};
  for (const c of Object.keys(CATALOG)) {
    const sel = d[c], line = lineOf(c, sel.line);
    r[c] = { ...sel, hex: hexOf(c, sel), type: line.type, name: sel.color };
  }
  return r;
}
function loadFromHash() {
  const m = location.hash.match(/design=([^&]+)/);
  if (!m) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch { return null; }
}
function hashFor(d) { return "#design=" + btoa(unescape(encodeURIComponent(JSON.stringify(d)))); }
function toast(msg) {
  let t = $(".vz-toast");
  if (!t) { t = document.createElement("div"); t.className = "vz-toast mono"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("is-on");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("is-on"), 2200);
}

/* ---------------------------------------------------------------- UI: rail + panel */
const ICONS = {
  roof: '<path d="M3 13 12 5l9 8M6 11v8h12v-8"/>',
  siding: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
  trim: '<rect x="5" y="4" width="14" height="16"/><rect x="8" y="7" width="8" height="10"/>',
  windows: '<rect x="5" y="4" width="14" height="16"/><path d="M12 4v16M5 12h14"/>',
  door: '<rect x="7" y="3" width="10" height="18"/><circle cx="14.5" cy="12" r="1"/>',
  gutters: '<path d="M3 7h18v3H3zM18 10v10"/>',
  accents: '<path d="M3 20h18M4 20v-5h6v5M10 20v-8h7v8M14 12V7h6v13"/>',
};
const rail = $("#vzRail"), panel = $("#vzPanel");

function drawRail() {
  rail.innerHTML = "";
  for (const c of Object.keys(CATALOG)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "vz-cat" + (c === cat ? " is-on" : "");
    b.disabled = mode === "photo" && !PHOTO_CATS.includes(c);
    const hex = hexOf(c, design[c]);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[c]}</svg><span>${CATALOG[c].label}</span><i style="background:${hex || "transparent"}"></i>`;
    b.addEventListener("click", () => { cat = c; drawRail(); drawPanel(); });
    rail.appendChild(b);
  }
}

function seg(label, options, current, onPick) {
  return `<div class="vz-opt"><span class="mono">${label}</span><div class="seg mono">${options.map(([v, l]) =>
    `<button type="button" data-v="${v}" class="${v === current ? "is-on" : ""}">${l.toUpperCase()}</button>`).join("")}</div></div>`;
}

function drawPanel() {
  const C = CATALOG[cat], sel = design[cat], line = lineOf(cat, sel.line);
  let html = `<div class="panel-head mono"><span>${C.label.toUpperCase()}</span><span>${C.lines.length} LINE${C.lines.length > 1 ? "S" : ""}</span></div><div class="vz-panel-body">`;
  if (C.lines.length > 1) {
    html += `<div class="vz-lines">${C.lines.map((l) =>
      `<button type="button" class="vz-line ${l.id === line.id ? "is-on" : ""}" data-line="${l.id}"><small class="mono">${l.brand}</small><b>${l.name}</b></button>`).join("")}</div>`;
  }
  if (cat === "siding" && mode === "model") html += seg("PROFILE", C.profiles, sel.profile, "profile");
  if (cat === "windows") html += seg("GRIDS", C.grids, sel.grid, "grid");
  if (cat === "door" && mode === "model") html += seg("STYLE", C.styles, sel.style, "style");
  html += `<div class="vz-sw-head mono"><span>${line.brand} ${line.name}</span><span>${line.colors.length} COLORS</span></div><div class="vz-swatches">`;
  html += line.colors.map(([name, hex]) =>
    `<button type="button" class="vz-sw ${name === sel.color ? "is-on" : ""}" data-color="${name}" title="${name}">
      <i style="background:${hex || "repeating-linear-gradient(45deg,#222 0 4px,#333 4px 8px)"}"></i><span>${name}</span></button>`).join("");
  html += `</div></div>`;
  panel.innerHTML = html;

  $$(".vz-line", panel).forEach((b) => b.addEventListener("click", () => {
    const l = lineOf(cat, b.dataset.line);
    const keep = l.colors.find(([n]) => n === design[cat].color);
    update({ [cat]: { ...design[cat], line: l.id, color: keep ? keep[0] : l.colors[0][0] } });
  }));
  $$(".vz-opt", panel).forEach((o) => {
    const key = { PROFILE: "profile", GRIDS: "grid", STYLE: "style" }[o.querySelector("span").textContent];
    $$("button", o).forEach((b) => b.addEventListener("click", () => update({ [cat]: { ...design[cat], [key]: b.dataset.v } })));
  });
  $$(".vz-sw", panel).forEach((b) => b.addEventListener("click", () => update({ [cat]: { ...design[cat], color: b.dataset.color } })));
}

/* presets */
const presetRow = $("#presetRow");
PRESETS.forEach((p) => {
  const r = resolve(p.design);
  const b = document.createElement("button");
  b.type = "button"; b.className = "preset"; b.dataset.name = p.name;
  b.innerHTML = `<span class="mini"><i style="background:${r.roof.hex}"></i><i style="background:${r.siding.hex}"></i><i style="background:${r.trim.hex}"></i><i style="background:${r.door.hex}"></i></span>${p.name.toUpperCase()}`;
  b.addEventListener("click", () => { touched = true; design = clone(p.design); presetName = p.name; refresh(); });
  presetRow.appendChild(b);
});

function update(patch) {
  touched = true;
  Object.assign(design, patch);
  presetName = null;
  refresh();
}

function refresh() {
  drawRail(); drawPanel();
  $$(".preset").forEach((b) => b.classList.toggle("is-on", b.dataset.name === presetName));
  $("#vzTitle").textContent = (presetName || "Custom build").toUpperCase();
  $("#vzSummary").innerHTML = describe(design).map((s) => `<li>${s}</li>`).join("");
  if (touched) history.replaceState(null, "", location.pathname + location.search + hashFor(design));
  if (comparing) { comparing = false; $("#vzCompare").setAttribute("aria-pressed", "false"); }
  View.apply();
  Photo.render();
}

/* ---------------------------------------------------------------- 3D */
const View = (() => {
  const canvas = $("#vzCanvas");
  let stage, house, controls, ready = false, queued = false, tween = null;
  const VIEWS = {
    front: [[12, 14, 98], [10, 11, 4]],
    left: [[-66, 24, 76], [4, 12, 4]],
    right: [[82, 22, 66], [14, 10, 2]],
    aerial: [[18, 110, 92], [10, 6, 0]],
  };

  function init() {
    const mobile = matchMedia("(max-width: 999px)").matches;
    stage = createStage(canvas, { mobile });
    house = buildHouse({ mode: "viz" });
    stage.scene.add(house.root, buildSite());
    stage.setSun(34, -62, "day");
    controls = new OrbitControls(stage.camera, canvas);
    controls.enablePan = false;
    controls.minDistance = 45; controls.maxDistance = 230;
    controls.maxPolarAngle = 1.48; controls.minPolarAngle = 0.2;
    stage.resize();
    controls.addEventListener("change", request);
    controls.addEventListener("start", () => { tween = null; $$("[data-view]").forEach((b) => b.classList.remove("is-on")); });
    jump("front");
    onTextureLoad((left) => { if (left === 0) $("#vzLoading").classList.add("is-gone"); request(); });
    new ResizeObserver(() => { stage.resize(); request(); }).observe(canvas);
    ready = true;
    apply();
  }

  // portrait screens need the camera further back to fit the house
  const fit = (p, t) => {
    const k = Math.max(1, 1.35 / Math.max(0.5, stage.camera.aspect));
    return p.map((v, i) => t[i] + (v - t[i]) * k);
  };
  function jump(name) {
    const [p0, t] = VIEWS[name], p = fit(p0, t);
    stage.camera.position.set(...p); controls.target.set(...t); controls.update();
  }
  function fly(name) {
    const [p0, t] = VIEWS[name], p = fit(p0, t);
    const from = [stage.camera.position.clone(), controls.target.clone()];
    const to = [new THREE.Vector3(...p), new THREE.Vector3(...t)];
    const t0 = performance.now();
    tween = (now) => {
      const k = Math.min(1, (now - t0) / 900), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      stage.camera.position.lerpVectors(from[0], to[0], e);
      controls.target.lerpVectors(from[1], to[1], e);
      controls.update();
      return k < 1;
    };
    loop();
  }
  function loop() {
    requestAnimationFrame((now) => {
      if (tween && tween(now)) loop(); else tween = null;
      draw();
    });
  }
  function request() { if (!queued && ready) { queued = true; requestAnimationFrame(() => { queued = false; draw(); }); } }
  function draw() { if (ready) stage.render(); }

  function apply() {
    if (!ready) return;
    house.setDesign(resolve(comparing ? ORIGINAL : design));
    stage.setSun(dusk ? 4 : 34, dusk ? -76 : -62, dusk ? "dusk" : "day");
    house.setDusk(dusk ? 1 : 0);
    request();
  }

  async function snapshot(type = "image/jpeg") {
    if (!ready) return null;
    stage.render();
    return new Promise((res) => canvas.toBlob(res, type, 0.9));
  }

  $$("[data-view]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-view]").forEach((x) => x.classList.toggle("is-on", x === b));
    if (ready) fly(b.dataset.view);
  }));
  $("#vzCompare").addEventListener("click", (e) => {
    comparing = !comparing;
    e.currentTarget.setAttribute("aria-pressed", comparing);
    $("#vzMode").textContent = comparing ? "BEFORE (ORIGINAL)" : "LIVE 3D";
    apply();
  });
  $("#vzDusk").addEventListener("click", (e) => { dusk = !dusk; e.currentTarget.setAttribute("aria-pressed", dusk); apply(); });

  // build the 3D scene only when the visualizer gets close
  const io = new IntersectionObserver((ents) => {
    if (ents.some((e) => e.isIntersecting)) { io.disconnect(); try { init(); } catch (err) { console.error(err); $("#vzLoading").textContent = "3D NOT SUPPORTED ON THIS DEVICE"; } }
  }, { rootMargin: "800px 0px" });
  io.observe(canvas);

  return { apply, snapshot, isReady: () => ready };
})();

/* ---------------------------------------------------------------- PHOTO MODE */
const Photo = (() => {
  const canvas = $("#photoCanvas");
  const ctx = canvas.getContext("2d");
  const stageEl = $("#photoStage"), cursor = $("#brushCursor"), input = $("#photoInput"), drop = $("#dropzone");
  const ZONES = ["roof", "siding", "trim", "door"];
  const TINT = { roof: "47,107,255", siding: "0,220,170", trim: "255,200,0", door: "255,70,140" };
  let base = null, masks = {}, painted = {}, tmp = null;
  let zone = "roof", erasing = false, showMask = false, original = false;
  let brush = 40, strength = 0.8, drawing = false, last = null, queued = false;
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const colorFor = (z) => hexOf(z, design[z]) || "#888888";

  async function load(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file), img = new Image();
    img.src = url;
    try { await img.decode(); } catch { toast("Couldn't read that image. Try a JPG or PNG."); return; }
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    base = mk(w, h); base.getContext("2d").drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    canvas.width = w; canvas.height = h; tmp = mk(w, h);
    ZONES.forEach((z) => { masks[z] = mk(w, h); painted[z] = false; });
    drop.hidden = true; canvas.hidden = false; $("#photoTools").hidden = false;
    $("#vzMode").textContent = `PHOTO ${w}×${h}`;
    render();
  }
  input.addEventListener("change", () => load(input.files[0]));
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
  drop.addEventListener("drop", (e) => load(e.dataTransfer.files[0]));

  $$("[data-zone]").forEach((b) => b.addEventListener("click", () => {
    zone = b.dataset.zone; erasing = false;
    $$("[data-zone]").forEach((x) => x.classList.toggle("is-on", x === b));
    $("#eraserBtn").classList.remove("is-on");
    cat = zone; drawRail(); drawPanel();
    render();
  }));
  $("#eraserBtn").addEventListener("click", (e) => { erasing = !erasing; e.currentTarget.classList.toggle("is-on", erasing); });
  $("#brushSize").addEventListener("input", (e) => { brush = +e.target.value; });
  $("#strength").addEventListener("input", (e) => { strength = e.target.value / 100; render(); });
  $("#maskBtn").addEventListener("click", (e) => { showMask = !showMask; e.currentTarget.classList.toggle("is-on", showMask); render(); });
  $("#clearZoneBtn").addEventListener("click", () => { if (!base) return; masks[zone].getContext("2d").clearRect(0, 0, base.width, base.height); painted[zone] = false; render(); });
  const cmp = $("#compareBtn");
  cmp.addEventListener("pointerdown", (e) => { e.preventDefault(); original = true; render(); });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => cmp.addEventListener(ev, () => { if (original) { original = false; render(); } }));
  $("#newPhotoBtn").addEventListener("click", () => { input.value = ""; input.click(); });

  const toImg = (e) => { const r = canvas.getBoundingClientRect(), k = canvas.width / r.width; return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k }; };
  function stroke(a, b) {
    const m = masks[zone].getContext("2d");
    m.save();
    m.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    m.strokeStyle = m.fillStyle = "#fff"; m.lineCap = m.lineJoin = "round"; m.lineWidth = brush * b.k;
    m.beginPath(); m.moveTo(a.x, a.y); m.lineTo(b.x, b.y); m.stroke();
    m.beginPath(); m.arc(b.x, b.y, (brush * b.k) / 2, 0, Math.PI * 2); m.fill();
    m.restore();
    if (!erasing) painted[zone] = true;
    render();
  }
  canvas.addEventListener("pointerdown", (e) => { if (!base) return; drawing = true; canvas.setPointerCapture(e.pointerId); last = toImg(e); stroke(last, last); });
  canvas.addEventListener("pointermove", (e) => {
    const sr = stageEl.getBoundingClientRect();
    cursor.style.left = e.clientX - sr.left + "px"; cursor.style.top = e.clientY - sr.top + "px";
    cursor.style.width = cursor.style.height = brush + "px";
    cursor.style.borderColor = erasing ? "#ff8a7a" : `rgb(${TINT[zone]})`;
    if (!drawing) return;
    const p = toImg(e); stroke(last, p); last = p;
  });
  ["pointerup", "pointercancel"].forEach((ev) => canvas.addEventListener(ev, () => { drawing = false; }));
  canvas.addEventListener("pointerenter", () => { cursor.hidden = false; });
  canvas.addEventListener("pointerleave", () => { cursor.hidden = true; });

  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
  function tint(z) {
    const color = colorFor(z), t = tmp.getContext("2d");
    t.globalCompositeOperation = "source-over"; t.clearRect(0, 0, tmp.width, tmp.height);
    t.fillStyle = color; t.fillRect(0, 0, tmp.width, tmp.height);
    t.globalCompositeOperation = "destination-in"; t.drawImage(masks[z], 0, 0);
    ctx.globalAlpha = strength; ctx.globalCompositeOperation = "color"; ctx.drawImage(tmp, 0, 0);
    const L = lum(color);
    if (L < 0.42) { ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = strength * Math.min(1, (0.42 - L) / 0.42 + 0.15); ctx.drawImage(tmp, 0, 0); }
    else if (L > 0.6) { ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = strength * ((L - 0.6) / 0.4) * 0.85; ctx.drawImage(tmp, 0, 0); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  function draw() {
    queued = false;
    if (!base) return;
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    ctx.drawImage(base, 0, 0);
    if (original) return;
    ZONES.forEach((z) => { if (painted[z]) tint(z); });
    if (showMask) ZONES.forEach((z) => {
      if (!painted[z]) return;
      const t = tmp.getContext("2d");
      t.globalCompositeOperation = "source-over"; t.clearRect(0, 0, tmp.width, tmp.height);
      t.fillStyle = `rgba(${TINT[z]},${z === zone ? 0.55 : 0.25})`; t.fillRect(0, 0, tmp.width, tmp.height);
      t.globalCompositeOperation = "destination-in"; t.drawImage(masks[z], 0, 0);
      ctx.drawImage(tmp, 0, 0);
    });
  }
  function render() { if (!queued && mode === "photo") { queued = true; requestAnimationFrame(draw); } }
  return {
    render,
    hasImage: () => !!base,
    snapshot: () => new Promise((res) => { draw(); canvas.toBlob(res, "image/jpeg", 0.88); }),
  };
})();

/* ---------------------------------------------------------------- tabs */
$$(".viz-tabs [data-tab]").forEach((tab) => tab.addEventListener("click", () => {
  mode = tab.dataset.tab;
  $$(".viz-tabs [data-tab]").forEach((t) => t.setAttribute("aria-selected", t === tab));
  $$("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== mode));
  $("#vzMode").textContent = mode === "photo" ? (Photo.hasImage() ? "PHOTO" : "NO PHOTO YET") : "LIVE 3D";
  if (mode === "photo" && !PHOTO_CATS.includes(cat)) cat = "roof";
  drawRail(); drawPanel(); Photo.render();
}));

/* ---------------------------------------------------------------- save / share / send */
const SAVE_KEY = "cd-designs";
const saved = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || []; } catch { return []; } };
function drawSaved() {
  const list = saved();
  $("#vzSaved").innerHTML = list.length ? `<span>SAVED</span>` + list.map((s, i) =>
    `<span class="vz-chip"><button type="button" data-load="${i}">${s.name}</button><button type="button" data-del="${i}" aria-label="Delete ${s.name}">✕</button></span>`).join("") : "";
  $$("[data-load]").forEach((b) => b.addEventListener("click", () => { design = clone(saved()[+b.dataset.load].design); presetName = null; refresh(); }));
  $$("[data-del]").forEach((b) => b.addEventListener("click", () => {
    const l = saved(); l.splice(+b.dataset.del, 1);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(l)); } catch {}
    drawSaved();
  }));
}
$("#vzSave").addEventListener("click", () => {
  const l = saved();
  const r = resolve(design);
  l.unshift({ name: presetName || `${r.siding.name} / ${r.roof.name}`, design: clone(design) });
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(l.slice(0, 8))); toast("Design saved on this device"); } catch { toast("Couldn't save in this browser"); }
  drawSaved();
});
$("#vzShare").addEventListener("click", async () => {
  const url = location.origin + location.pathname + hashFor(design);
  try { await navigator.clipboard.writeText(url); toast("Link copied: send it to anyone"); }
  catch { prompt("Copy this link:", url); }
});
$("#vzDownload").addEventListener("click", async () => {
  const blob = mode === "photo" && Photo.hasImage() ? await Photo.snapshot() : await View.snapshot();
  if (!blob) return toast("Still loading, try again in a second");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "cd-consulting-design.jpg"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});
$("#vzEstimate").addEventListener("click", () => {
  document.dispatchEvent(new CustomEvent("cd:estimate-prefill", { detail: resolve(design) }));
  window.CD.goTo("estimate");
});
$("#sendBuild").addEventListener("click", async () => {
  window.CD.attach("build", `Build: ${presetName || "Custom"} | ` + describe(design).join(" | "));
  const blob = mode === "photo" && Photo.hasImage() ? await Photo.snapshot() : await View.snapshot();
  if (blob) window.CD.attach("render", blob);
  window.CD.goTo("contact");
});

refresh();
drawSaved();
