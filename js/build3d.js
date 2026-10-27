/* Scroll-driven 3D tear-off & rebuild.
   Scroll progress P (0 → 1 through the pinned section) drives the build
   layers in js/3d/house.js and flies the camera around the lot. */
import * as THREE from "three";
import { createStage } from "./3d/stage.js";
import { buildHouse } from "./3d/house.js";
import { buildSite } from "./3d/site.js";
import { PRESETS, ORIGINAL, CATALOG, lineOf, hexOf } from "./3d/catalog.js";
import { onTextureLoad } from "./3d/textures.js";

const section = document.getElementById("build");
const canvas = document.getElementById("tdCanvas");
const $ = (s, el = document) => el.querySelector(s);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = matchMedia("(max-width: 999px)").matches;

const T = {
  scan: [0.015, 0.1],
  roofOff: [0.12, 0.34],
  sidingOff: [0.2, 0.4],
  under: [0.4, 0.52],
  wrap: [0.44, 0.55],
  roofOn: [0.55, 0.76],
  sidingOn: [0.66, 0.84],
  finish: [0.83, 0.86],
  dusk: [0.87, 0.98],
};
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (P, a, b) => clamp((P - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);

/* resolve a catalog design into the colors/options the house needs */
function resolve(d) {
  const r = {};
  for (const cat of Object.keys(CATALOG)) {
    const sel = d[cat], line = lineOf(cat, sel.line);
    r[cat] = { ...sel, hex: hexOf(cat, sel), type: line.type, name: sel.color };
  }
  return r;
}
const FINAL = PRESETS.find((p) => p.name === "Navy Luxe").design;
const AFTER = resolve(FINAL);
const DURING = resolve({ ...ORIGINAL, roof: FINAL.roof, siding: FINAL.siding });

/* camera keyframes: [P, position, target] */
const KEYS = [
  [0.0, [-62, 24, 104], [8, 12, 4]],
  [0.12, [-44, 52, 74], [2, 18, 2]],
  [0.36, [-6, 58, 66], [4, 17, 0]],
  [0.55, [34, 44, 72], [8, 15, 2]],
  [0.78, [70, 26, 78], [12, 12, 3]],
  [1.0, [46, 12, 96], [12, 11, 6]],
];
// phones are portrait: pull the camera back from its target so the whole house fits
const KEYS_M = KEYS.map(([p, pos, t]) => [p, pos.map((v, i) => t[i] + (v - t[i]) * (i === 1 ? 1.25 : 1.55)), t]);
const posCurve = new THREE.CatmullRomCurve3((mobile ? KEYS_M : KEYS).map((k) => new THREE.Vector3(...k[1])));
const tgtCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[2])));
function camAt(P) {
  // map P onto curve parameter by keyframe spacing
  const ks = KEYS;
  let i = 0;
  while (i < ks.length - 2 && P > ks[i + 1][0]) i++;
  const local = smooth(clamp((P - ks[i][0]) / (ks[i + 1][0] - ks[i][0])));
  const u = (i + local) / (ks.length - 1);
  return [posCurve.getPoint(u), tgtCurve.getPoint(u)];
}

let stage, house, ready = false, P = reduced ? 1 : 0, phaseDesign = null;

function init() {
  stage = createStage(canvas, { mobile });
  house = buildHouse({ mode: "build" });
  stage.scene.add(house.root, buildSite());
  stage.setSun(34, -62, "day");
  onTextureLoad((left) => { if (left === 0) section.classList.add("is-ready"); draw(); });
  stage.resize();
  addEventListener("resize", () => { stage.resize(); draw(); });
  ready = true;
  draw();
}

function draw() {
  if (!ready) return;
  // materials for this phase
  const want = P >= T.finish[0] ? "after" : "during";
  if (want !== phaseDesign) { phaseDesign = want; house.setDesign(want === "after" ? AFTER : DURING); }
  house.setBuild(T, P);

  // sun sinks into dusk at the end
  const d = smooth(seg(P, ...T.dusk));
  stage.setSun(34 - d * 31, -62 - d * 14, d > 0.5 ? "dusk" : "day");
  house.setDusk(d);

  const [pos, tgt] = camAt(P);
  stage.camera.position.copy(pos);
  stage.camera.lookAt(tgt);
  stage.render();
  overlay(P);
  hud(P);
}

/* ---------- inspection overlay (HTML flags pinned to 3D points) ---------- */
const FLAGS = [
  [V3(-6, 24.5, 5.5), "GRANULE LOSS"],
  [V3(10, 20, 11), "LIFTED TABS"],
  [V3(28, 12, 4), "SOFT DECK"],
  [V3(-10, 6, 18.2), "DATED SIDING"],
];
function V3(x, y, z) { return new THREE.Vector3(x, y, z); }
const flagEls = FLAGS.map(([, t]) => {
  const el = document.createElement("span");
  el.className = "td-flag mono";
  el.textContent = t;
  $(".td-svg-wrap").appendChild(el);
  return el;
});
const scanEl = document.createElement("i");
scanEl.className = "td-scan";
$(".td-svg-wrap").appendChild(scanEl);

function overlay(P) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  FLAGS.forEach(([p], i) => {
    const on = P > 0.03 + i * 0.014 && P < 0.13;
    const el = flagEls[i];
    el.classList.toggle("is-on", on);
    if (!on) return;
    const v = p.clone().project(stage.camera);
    el.style.left = ((v.x + 1) / 2) * w + "px";
    el.style.top = ((1 - v.y) / 2) * h + "px";
  });
  const s = seg(P, ...T.scan);
  scanEl.style.opacity = s > 0 && s < 1 ? 1 : 0;
  scanEl.style.top = s * 100 + "%";
}

/* ---------- HUD ---------- */
const PHASES = [
  { at: 0, id: "INSPECT", msg: "Walking the roof: granule loss, lifted tabs, a soft spot in the deck. It's time." },
  { at: 0.12, id: "TEAR-OFF", msg: "Stripping it to the deck, ridge down. Old siding comes off with it. Every nail pulled." },
  { at: 0.4, id: "DRY-IN", msg: "Deck inspected. Synthetic underlayment rolled eave-up, and the walls wrapped and taped." },
  { at: 0.55, id: "REBUILD", msg: "New architectural shingles from the eave up. New siding bottom-up, every course level." },
  { at: 0.86, id: "REVEAL", msg: "Same house. New everything: managed start to finish." },
];
const h = {
  phases: [...section.querySelectorAll(".td-phases li")],
  label: $("#tdPhaseLabel"), pct: $("#tdPct"), bar: $("#tdBar"), status: $("#tdStatus"),
  day: $("#tdDay"), roof: $("#tdRoof"), siding: $("#tdSiding"), hint: $("#tdHint"),
};
let lastPhase = -1;
function hud(P) {
  let ph = 0;
  PHASES.forEach((x, i) => { if (P >= x.at) ph = i; });
  if (ph !== lastPhase) {
    lastPhase = ph;
    h.phases.forEach((li, i) => { li.classList.toggle("is-on", i === ph); li.classList.toggle("is-done", i < ph); });
    h.label.textContent = `PHASE 0${ph + 1} // ${PHASES[ph].id}`;
    h.status.textContent = PHASES[ph].msg;
  }
  h.pct.textContent = Math.round(P * 100) + "%";
  h.bar.style.width = P * 100 + "%";
  h.day.textContent = P < 0.12 ? "00" : P < 0.4 ? "01" : P < 0.66 ? "02" : "03";
  const off = seg(P, ...T.roofOff), on = seg(P, ...T.roofOn);
  h.roof.textContent = P < 0.45 ? `${Math.round(off * 34)} / 34 OFF` : `${Math.round(on * 34)} / 34 ON`;
  const so = seg(P, ...T.sidingOff), sn = seg(P, ...T.sidingOn);
  h.siding.textContent = P < 0.5 ? `${Math.round(so * 100)}% OFF` : `${Math.round(sn * 100)}% ON`;
  section.classList.toggle("is-done", P > 0.95);
  h.hint.classList.toggle("is-gone", P > 0.03);
}

/* ---------- drive ---------- */
if (reduced) {
  section.classList.add("is-static");
  const range = $("#tdRange");
  range.hidden = false;
  range.addEventListener("input", () => { P = range.value / 1000; draw(); });
} else {
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = section.getBoundingClientRect();
    if (r.bottom < -200 || r.top > innerHeight + 200) return;
    P = clamp(-r.top / (r.height - innerHeight));
    draw();
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  requestAnimationFrame(update);
}

try { init(); } catch (e) { console.error(e); section.classList.add("is-error"); }
hud(P);
