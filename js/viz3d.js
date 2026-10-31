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
    stage = createStage(canvas, { mobile, hd: true });
    house = buildHouse({ mode: "viz" });
    stage.scene.add(house.root, buildSite());
    stage.setSun(34, -62, "day");
    stage.usePhotoSky().then(() => { if (!dusk) request(); }).catch((e) => console.warn("HDR sky unavailable", e));
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
    if (dusk) stage.setSun(4, -76, "dusk");
    else stage.usePhotoSky().then(request).catch(() => stage.setSun(34, -62, "day"));
    house.setDusk(dusk ? 1 : 0);
    request();
  }

  // full 4K render for downloads; a lighter 1600px one to attach to a lead
  async function snapshot(width = 3840) {
    if (!ready) return null;
    const blob = await stage.snapshot(width);
    request();
    return blob;
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

/* ---------------------------------------------------------------- PHOTO MODE
   The roof, siding, trim and doors are found automatically (js/photo-detect.js); the colors chosen
   in the panel recolor them while keeping the photo's own light, shadow and texture. If an area is
   wrong, click it and pick what it really is. */
const Photo = (() => {
  const canvas = $("#photoCanvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const input = $("#photoInput"), drop = $("#dropzone");
  const ZONES = ["roof", "siding", "trim", "door"];
  const TINT = { roof: [47, 107, 255], siding: [0, 200, 150], trim: [255, 196, 0], door: [255, 70, 140] };
  let base = null, basePx = null, det = null, alpha = {}, meanLum = {}, showMask = false, original = false, queued = false, busy = false, fixAt = null;
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const colorFor = (z) => hexOf(z, design[z]) || "#888888";
  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lumOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  async function load(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file), img = new Image();
    img.src = url;
    try { await img.decode(); } catch { toast("Couldn't read that image. Try a JPG or PNG."); return; }
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    base = mk(w, h);
    const bctx = base.getContext("2d", { willReadFrequently: true });
    bctx.drawImage(img, 0, 0, w, h);
    basePx = bctx.getImageData(0, 0, w, h).data;
    URL.revokeObjectURL(url);
    canvas.width = w; canvas.height = h;
    det = null; alpha = {};
    drop.hidden = true; canvas.hidden = false; $("#photoTools").hidden = false; $("#photoFix").hidden = true;
    $("#vzMode").textContent = `PHOTO ${w}×${h}`;
    render();
    await runDetect();
  }

  async function runDetect() {
    busy = true;
    const box = $("#photoBusy"), step = $("#photoBusyStep"), bar = $("#photoBusyBar");
    box.hidden = false; bar.style.width = "4%"; step.textContent = "Finding your roof and siding…";
    $("#photoFound").innerHTML = "";
    try {
      const D = await import("./photo-detect.js");
      det = await D.detect(base, {
        onStep: (t) => { step.textContent = t; if (!/Loading/.test(t)) $("#photoBusyNote").hidden = true; },
        onProgress: (k) => { bar.style.width = Math.max(4, Math.round(k * 100)) + "%"; },
      });
      Photo._D = D;
      if (!det.ok) { toast("I couldn't find a house in this photo. Try one taken from the street, in daylight."); }
      buildMasks();
    } catch (err) {
      console.error(err);
      toast("The detector couldn't load. Check your connection and try again.");
    } finally {
      busy = false; box.hidden = true; render();
    }
  }

  // label map (work size) → soft full-size alpha per zone, plus the zone's average brightness
  function buildMasks() {
    const masks = Photo._D.zoneMasks(det), w = base.width, h = base.height, tmp = mk(w, h), t = tmp.getContext("2d", { willReadFrequently: true });
    alpha = {}; meanLum = {};
    const found = [];
    for (const z of ZONES) {
      const m = masks[z];
      if (!m || !m.pixels) continue;
      t.clearRect(0, 0, w, h); t.imageSmoothingEnabled = true; t.imageSmoothingQuality = "high";
      t.filter = "blur(1.2px)"; t.drawImage(m.canvas, 0, 0, w, h); t.filter = "none";
      const d = t.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
      let sum = 0, cnt = 0;
      for (let i = 0; i < w * h; i++) { a[i] = d[i * 4 + 3]; if (a[i] > 200) { sum += lumOf(basePx[i * 4], basePx[i * 4 + 1], basePx[i * 4 + 2]); cnt++; } }
      alpha[z] = a; meanLum[z] = cnt ? sum / cnt : 128;
      found.push(z);
    }
    $("#photoFound").innerHTML = found.length ? `<span>Found:</span>${found.map((z) => `<button type="button" class="chip is-on" data-zone="${z}">${z[0].toUpperCase() + z.slice(1)} ✓</button>`).join("")}` : "<span>No roof or siding found. Click the photo to mark areas.</span>";
  }

  function draw() {
    queued = false;
    if (!base) return;
    if (original || !det) { ctx.drawImage(base, 0, 0); return; }
    const w = base.width, h = base.height, out = ctx.createImageData(w, h), o = out.data;
    o.set(basePx);
    for (const z of ZONES) {
      const a = alpha[z];
      if (!a) continue;
      const [tr, tg, tb] = rgb(colorFor(z)), tl = Math.max(8, lumOf(tr, tg, tb)), mL = Math.max(8, meanLum[z]);
      // keep the photo's shading: each pixel's brightness relative to the area's average scales the new color
      for (let i = 0, p = 0; i < w * h; i++, p += 4) {
        const k = a[i];
        if (!k) continue;
        const L = lumOf(basePx[p], basePx[p + 1], basePx[p + 2]);
        let r = Math.pow(L / mL, 0.9);
        if (tl > 200) r = 1 - (1 - r) * 0.6; // white products: soften dark texture so they still read as white
        const f = (k / 255) * 0.94;
        o[p] = o[p] + (Math.min(255, tr * r) - o[p]) * f;
        o[p + 1] = o[p + 1] + (Math.min(255, tg * r) - o[p + 1]) * f;
        o[p + 2] = o[p + 2] + (Math.min(255, tb * r) - o[p + 2]) * f;
      }
    }
    if (showMask) for (const z of ZONES) {
      const a = alpha[z], c = TINT[z];
      if (!a) continue;
      for (let i = 0, p = 0; i < w * h; i++, p += 4) if (a[i] > 128) { o[p] = o[p] * 0.45 + c[0] * 0.55; o[p + 1] = o[p + 1] * 0.45 + c[1] * 0.55; o[p + 2] = o[p + 2] * 0.45 + c[2] * 0.55; }
    }
    ctx.putImageData(out, 0, 0);
  }
  function render() { if (!queued && mode === "photo") { queued = true; requestAnimationFrame(draw); } }

  input.addEventListener("change", () => load(input.files[0]));
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
  drop.addEventListener("drop", (e) => load(e.dataTransfer.files[0]));
  $("#maskBtn").addEventListener("click", (e) => { showMask = !showMask; e.currentTarget.classList.toggle("is-on", showMask); e.currentTarget.setAttribute("aria-pressed", showMask); render(); });
  const cmp = $("#compareBtn");
  cmp.addEventListener("pointerdown", (e) => { e.preventDefault(); original = true; render(); });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => cmp.addEventListener(ev, () => { if (original) { original = false; render(); } }));
  $("#newPhotoBtn").addEventListener("click", () => { input.value = ""; input.click(); });
  // the "Found" chips jump the color panel to that surface
  $("#photoFound").addEventListener("click", (e) => { const b = e.target.closest("[data-zone]"); if (b) { cat = b.dataset.zone; drawRail(); drawPanel(); } });

  // click to fix: pick what the clicked area really is; similar connected patches change with it
  canvas.addEventListener("click", (e) => {
    if (!det || busy) return;
    const r = canvas.getBoundingClientRect();
    fixAt = { x: ((e.clientX - r.left) / r.width) * det.W, y: ((e.clientY - r.top) / r.height) * det.H };
    const pop = $("#photoFix"), sr = $("#photoStage").getBoundingClientRect();
    pop.hidden = false;
    pop.style.left = Math.min(sr.width - 330, Math.max(8, e.clientX - sr.left - 160)) + "px";
    pop.style.top = Math.min(sr.height - 56, e.clientY - sr.top + 14) + "px";
    const cur = det.labels[det.seg[Math.min(det.H - 1, fixAt.y | 0) * det.W + Math.min(det.W - 1, fixAt.x | 0)]];
    const name = ["none", "roof", "siding", "trim", "door", "none", "none"][cur];
    $$("#photoFix [data-fix]").forEach((b) => b.classList.toggle("is-on", b.dataset.fix === name));
  });
  $("#photoFix").addEventListener("click", (e) => {
    const b = e.target.closest("[data-fix]");
    if (!b || !fixAt) return;
    const Z = Photo._D.ZONE;
    Photo._D.reassign(det, fixAt.x, fixAt.y, b.dataset.fix === "none" ? Z.window : Z[b.dataset.fix]);
    $("#photoFix").hidden = true; fixAt = null;
    buildMasks(); render();
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape") $("#photoFix").hidden = true; });

  return {
    render,
    hasImage: () => !!base,
    snapshot: () => new Promise((res) => { draw(); canvas.toBlob(res, "image/jpeg", 0.9); }),
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
  a.href = URL.createObjectURL(blob); a.download = mode === "photo" ? "cd-consulting-design.jpg" : "cd-consulting-design-4k.jpg"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});
$("#vzEstimate").addEventListener("click", () => {
  window.CD.handoff("cd:estimate-prefill", resolve(design), "estimate");
});
$("#sendBuild").addEventListener("click", async () => {
  window.CD.attach("build", `Build: ${presetName || "Custom"} | ` + describe(design).join(" | "));
  const blob = mode === "photo" && Photo.hasImage() ? await Photo.snapshot() : await View.snapshot(1600);
  if (blob) window.CD.attach("render", blob);
  window.CD.goTo("contact");
});

refresh();
drawSaved();
