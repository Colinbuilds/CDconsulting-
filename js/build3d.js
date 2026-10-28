/* Scroll-driven 3D tear-off & rebuild that teaches as it builds.
   Scroll progress P (0 → 1 through the pinned section) drives the layers in
   js/3d/house.js, flies the camera to each component as it goes on, and pins a
   label + explainer card (js/3d/materials.js) to every material. */
import * as THREE from "three";
import { createStage } from "./3d/stage.js";
import { buildHouse } from "./3d/house.js";
import { buildSite } from "./3d/site.js";
import { PRESETS, ORIGINAL, CATALOG, lineOf, hexOf } from "./3d/catalog.js";
import { MATERIALS, GROUPS } from "./3d/materials.js";
import { onTextureLoad } from "./3d/textures.js";

const section = document.getElementById("build");
const canvas = document.getElementById("tdCanvas");
const $ = (s, el = document) => el.querySelector(s);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = matchMedia("(max-width: 999px)").matches;

/* build timeline, in real install order */
const T = {
  scan: [0.015, 0.1],
  roofOff: [0.12, 0.28],
  sidingOff: [0.16, 0.32],
  drip: [0.36, 0.38],
  ice: [0.39, 0.41],
  valley: [0.42, 0.43],
  under: [0.45, 0.52],
  wrap: [0.47, 0.54],
  tape: [0.52, 0.54],
  starter: [0.56, 0.57],
  roofOn: [0.58, 0.74],
  step: [0.64, 0.65],
  pipe: [0.68, 0.69],
  sidingOn: [0.7, 0.8],
  ridgeVent: [0.75, 0.76],
  ridgeCap: [0.78, 0.79],
  finish: [0.82, 0.84],
  dusk: [0.9, 0.99],
};
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (P, a, b) => clamp((P - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);

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

/* camera keyframes [P, position, target]: each stop frames the parts being installed */
const KEYS = [
  [0.0, [-62, 24, 104], [8, 12, 4]],      // curb view
  [0.12, [-44, 52, 74], [2, 18, 2]],      // up over the roof for tear-off
  [0.3, [-8, 56, 62], [4, 18, 2]],        // bare deck
  [0.42, [-26, 36, 48], [-4, 19, 10]],    // eave, ice & water, valleys
  [0.53, [18, 26, 52], [10, 15, 12]],     // house wrap + window flashing
  [0.66, [52, 32, 54], [14, 16, 4]],      // shingles, step flashing, pipe boot
  [0.8, [-30, 30, 66], [-4, 16, 6]],      // siding + ridge
  [0.9, [44, 14, 70], [8, 9, 10]],        // gutters, trim, stone
  [1.0, [42, 11, 94], [12, 11, 6]],       // dusk hero shot
];
const KEYS_M = KEYS.map(([p, pos, t]) => [p, pos.map((v, i) => t[i] + (v - t[i]) * (i === 1 ? 1.2 : 1.5)), t]);
const posCurve = new THREE.CatmullRomCurve3((mobile ? KEYS_M : KEYS).map((k) => new THREE.Vector3(...k[1])));
const tgtCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[2])));
function camAt(P) {
  let i = 0;
  while (i < KEYS.length - 2 && P > KEYS[i + 1][0]) i++;
  const local = smooth(clamp((P - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0])));
  const u = (i + local) / (KEYS.length - 1);
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
  const want = P >= T.finish[0] ? "after" : "during";
  if (want !== phaseDesign) { phaseDesign = want; house.setDesign(want === "after" ? AFTER : DURING); }
  house.setBuild(T, P);
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

/* ---------- material labels pinned to the 3D house ---------- */
const wrap = $(".td-svg-wrap");
const pins = MATERIALS.map((m, i) => {
  const el = document.createElement("div");
  el.className = "td-pin" + (i % 2 ? " below" : ""); // alternate above/below so neighbors don't collide
  el.innerHTML = `<i></i><span><b>${m.name}</b><small class="mono">${String(i + 1).padStart(2, "0")} · ${m.spec}</small></span>`;
  wrap.appendChild(el);
  return { m, el, v: new THREE.Vector3(...m.anchor) };
});
const scanEl = document.createElement("i");
scanEl.className = "td-scan";
wrap.appendChild(scanEl);
const tmp = new THREE.Vector3();

function overlay(P) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  for (const p of pins) {
    // phones have room for one label: the material on the card
    const on = P >= p.m.at[0] && P <= p.m.at[1] && (!mobile || p.m === currentMaterial(P));
    let show = false;
    if (on && stage) {
      tmp.copy(p.v).project(stage.camera);
      const x = ((tmp.x + 1) / 2) * w, y = ((1 - tmp.y) / 2) * h;
      show = tmp.z < 1 && x > 8 && x < w - 8 && y > 8 && y < h - 8;
      if (show) {
        p.el.style.transform = `translate(${x}px, ${y}px)`;
        p.el.classList.toggle("flip", x > w * 0.62);
      }
    }
    p.el.classList.toggle("is-on", show);
  }
  const s = seg(P, ...T.scan);
  scanEl.style.opacity = s > 0 && s < 1 ? 1 : 0;
  scanEl.style.top = s * 100 + "%";
}

/* ---------- HUD + teaching card ---------- */
const PHASES = [
  { at: 0, id: "INSPECT" }, { at: 0.12, id: "TEAR-OFF" }, { at: 0.35, id: "DRY-IN" }, { at: 0.555, id: "REBUILD" }, { at: 0.815, id: "FINISH" },
];
const h = {
  phases: [...section.querySelectorAll(".td-phases li")],
  label: $("#tdPhaseLabel"), pct: $("#tdPct"), bar: $("#tdBar"), card: $("#tdCard"),
  day: $("#tdDay"), roof: $("#tdRoof"), siding: $("#tdSiding"), hint: $("#tdHint"),
};
let lastPhase = -1, lastCard = null;
function currentMaterial(P) {
  let pick = null;
  for (const m of MATERIALS) if (P >= m.at[0] - 0.005) pick = m;
  return pick;
}
function hud(P) {
  let ph = 0;
  PHASES.forEach((x, i) => { if (P >= x.at) ph = i; });
  if (ph !== lastPhase) {
    lastPhase = ph;
    h.phases.forEach((li, i) => { li.classList.toggle("is-on", i === ph); li.classList.toggle("is-done", i < ph); });
    h.label.textContent = `PHASE 0${ph + 1} // ${PHASES[ph].id}`;
  }
  const m = currentMaterial(P);
  if (m !== lastCard) {
    lastCard = m;
    if (!m) {
      h.card.innerHTML = `<p class="td-card-k mono">HOW A ROOF & SIDING JOB REALLY GOES</p><h3>Scroll to start the job.</h3><p>Every material gets labeled as it goes on, in the order a pro installs it.</p>`;
    } else {
      const n = MATERIALS.indexOf(m) + 1;
      h.card.innerHTML = `
        <p class="td-card-k mono">LAYER ${String(n).padStart(2, "0")} / ${MATERIALS.length} · ${GROUPS[m.group].toUpperCase()}</p>
        <h3>${m.name}</h3>
        <p class="td-card-spec mono">${m.spec}</p>
        <p class="td-card-what">${m.what}</p>
        <p class="td-card-why"><b>Why it matters:</b> ${m.why}</p>
        <p class="td-card-tip mono"><b>PRO TIP</b> ${m.tip}</p>`;
      h.card.classList.remove("pop"); void h.card.offsetWidth; h.card.classList.add("pop");
    }
  }
  h.pct.textContent = Math.round(P * 100) + "%";
  h.bar.style.width = P * 100 + "%";
  h.day.textContent = P < 0.12 ? "00" : P < 0.35 ? "01" : P < 0.66 ? "02" : "03";
  const off = seg(P, ...T.roofOff), on = seg(P, ...T.roofOn);
  h.roof.textContent = P < 0.45 ? `${Math.round(off * 34)} / 34 OFF` : `${Math.round(on * 34)} / 34 ON`;
  const so = seg(P, ...T.sidingOff), sn = seg(P, ...T.sidingOn);
  h.siding.textContent = P < 0.5 ? `${Math.round(so * 100)}% OFF` : `${Math.round(sn * 100)}% ON`;
  section.classList.toggle("is-done", P > 0.95);
  h.hint.classList.toggle("is-gone", P > 0.03);
}

/* ---------- glossary under the build ---------- */
const list = document.getElementById("materialsList");
if (list) {
  list.innerHTML = Object.entries(GROUPS).map(([g, label]) => `
    <div class="mat-group">
      <h3 class="mono">${label.toUpperCase()}</h3>
      <ol>${MATERIALS.map((m, i) => m.group !== g ? "" : `
        <li>
          <span class="mat-n mono">${String(i + 1).padStart(2, "0")}</span>
          <div>
            <h4>${m.name}</h4>
            <p class="mat-spec mono">${m.spec}</p>
            <p>${m.what} ${m.why}</p>
            <p class="mat-tip mono"><b>PRO TIP</b> ${m.tip}</p>
          </div>
        </li>`).join("")}</ol>
    </div>`).join("");
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
