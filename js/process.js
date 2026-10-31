/* Full-screen scroll walkthrough of a job (js/3d/processes.js picks which one).
   The section is tall; its stage pins to the viewport (JS-driven, so no ancestor
   overflow can break it) while scroll progress P (0 → 1) drives the build in
   js/3d/house.js, flies the camera, and labels + explains every material. */
import * as THREE from "three";
import { createStage } from "./3d/stage.js";
import { buildHouse } from "./3d/house.js";
import { buildSite } from "./3d/site.js";
import { CATALOG, lineOf, hexOf } from "./3d/catalog.js";
import { PROCESSES, LIB, GROUPS } from "./3d/processes.js";
import { onTextureLoad } from "./3d/textures.js";

const section = document.querySelector("[data-process]");
const key = section.dataset.process;
const cfg = PROCESSES[key];
const gated = section.hasAttribute("data-gate");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = matchMedia("(max-width: 899px)").matches;
const root = document.documentElement;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (P, r) => (r ? clamp((P - r[0]) / (r[1] - r[0])) : 1);
const smooth = (t) => t * t * (3 - 2 * t);
const pad = (n) => String(n).padStart(2, "0");

function resolve(d) {
  const r = {};
  for (const cat of Object.keys(CATALOG)) {
    const sel = d[cat], line = lineOf(cat, sel.line);
    r[cat] = { ...sel, hex: hexOf(cat, sel), type: line.type, name: sel.color };
  }
  return r;
}
const DURING = resolve(cfg.look.during), AFTER = resolve(cfg.look.after);
const FOCUS = cfg.look.focus && resolve({ ...cfg.look.after, windows: cfg.look.focus }).windows;
const T = cfg.T;
const STEPS = cfg.steps.map(([id, at], i) => ({ m: LIB[id], at, n: i + 1 }));

/* ---------- markup ---------- */
const next = section.dataset.next, nextName = section.dataset.nextName;
section.style.setProperty("--len", (mobile ? 0.86 : 1) * (cfg.vh || 120 * STEPS.length ** 0.5 + 300) + "vh");
section.innerHTML = `
  <div class="pr-pin">
    <canvas class="pr-canvas" role="img" aria-label="${cfg.title}: a 3D house shown step by step as you scroll"></canvas>
    <div class="pr-labels"></div>
    <div class="pr-shade" aria-hidden="true"></div>
    <header class="pr-head">
      <p class="label"><span class="dot"></span>${cfg.kicker}</p>
      <h1>${cfg.headline}</h1>
    </header>
    <dl class="pr-read">
      <div><dt>Day</dt><dd data-r="day">00</dd></div>
      ${cfg.readouts.map(([label, k]) => `<div><dt>${label}</dt><dd data-r="${k}">0</dd></div>`).join("")}
    </dl>
    <aside class="pr-panel">
      <article class="pr-card" aria-live="polite"></article>
      <div class="pr-nav">
        <button type="button" class="btn btn-ghost btn-sm" data-step="-1" aria-label="Previous step">← Back</button>
        <button type="button" class="btn btn-blue btn-sm" data-step="1">Next step →</button>
      </div>
      <div class="pr-cta">
        ${gated
          ? `<a href="#home" class="btn btn-blue btn-sm" data-unlock="home">Enter the site</a><a href="#trades" class="btn btn-ghost btn-sm" data-unlock="trades">Pick a trade</a>`
          : `<a href="index.html#contact" class="btn btn-blue btn-sm">Start my project</a>${next ? `<a href="${next}" class="btn btn-ghost btn-sm">Next: ${nextName} →</a>` : ""}`}
      </div>
    </aside>
    <div class="pr-foot">
      <ol class="pr-phases">${cfg.phases.map(([n], i) => `<li><button type="button" data-phase="${i}">${n}</button></li>`).join("")}</ol>
      <div class="pr-progress"><span class="pr-phase-label"></span><i role="slider" tabindex="0" aria-label="Jump to any point in the job" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><b></b></i><span class="pr-pct">0%</span></div>
      <input type="range" class="pr-range" min="0" max="1000" value="0" aria-label="Walkthrough progress" hidden />
    </div>
    <div class="pr-loading"><span>Building the 3D house</span><i><b></b></i></div>
    <div class="pr-hint">Click <b>Next step</b> or scroll <span>↓</span></div>
  </div>`;
const $ = (s) => section.querySelector(s);
const canvas = $(".pr-canvas"), labels = $(".pr-labels"), card = $(".pr-card");
const ui = {
  phases: [...section.querySelectorAll(".pr-phases li")], label: $(".pr-phase-label"), pct: $(".pr-pct"),
  bar: $(".pr-progress b"), track: $(".pr-progress i"), back: $('[data-step="-1"]'), fwd: $('[data-step="1"]'), hint: $(".pr-hint"), load: $(".pr-loading b"),
  read: Object.fromEntries([...section.querySelectorAll("[data-r]")].map((el) => [el.dataset.r, el])),
};

/* ---------- camera path ---------- */
// phones are portrait: pull every stop back from its target so the house still fits
const keysFor = (k) => (mobile ? k.map(([p, pos, t]) => [p, pos.map((v, i) => t[i] + (v - t[i]) * (i === 1 ? 1.25 : 1.6)), t]) : k);
const KEYS = keysFor(cfg.keys);
const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[1])));
const tgtCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[2])));
function camAt(P) {
  let i = 0;
  while (i < KEYS.length - 2 && P > KEYS[i + 1][0]) i++;
  const local = smooth(clamp((P - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0])));
  const u = (i + local) / (KEYS.length - 1);
  return [posCurve.getPoint(u), tgtCurve.getPoint(u)];
}

/* ---------- 3D ---------- */
let stage, house, ready = false, P = 0, look = null;

function init() {
  stage = createStage(canvas, { mobile, hd: true, dpr: mobile ? 1.5 : 1.6 });
  house = buildHouse({ mode: "build" });
  stage.scene.add(house.root, buildSite());
  stage.setSun(34, -62, "day");
  onTextureLoad((left, total) => {
    if (total) ui.load.style.width = (1 - left / total) * 100 + "%";
    if (left === 0) section.classList.add("is-ready");
    request();
  });
  stage.usePhotoSky().then(request).catch((e) => console.warn("HDR sky unavailable", e));
  addEventListener("resize", () => { layout(); request(); });
  ready = true;
  layout();
}

// on wide screens the teaching panel covers the left; shift the picture right so the house sits in the open space
function layout() {
  if (!stage) return;
  stage.resize();
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const panel = $(".pr-panel").getBoundingClientRect();
  const shift = !mobile && w > 900 ? Math.min(panel.right, w * 0.4) * 0.5 : 0;
  if (shift) stage.camera.setViewOffset(w, h, -shift, 0, w, h);
  else stage.camera.clearViewOffset();
}

function draw() {
  if (!ready) return;
  const want = T.finish && P >= T.finish[0] ? "after" : "during";
  if (want !== look) {
    look = want;
    house.setDesign(want === "after" ? AFTER : DURING);
    if (FOCUS) house.setFocusStyle(FOCUS.hex, FOCUS.grid);
  }
  house.setBuild(T, P);
  const d = smooth(seg(P, T.dusk));
  if (stage.isPhotoSky()) stage.setPhotoDusk(d);
  else stage.setSun(34 - d * 31, -62 - d * 14, d > 0.5 ? "dusk" : "day");
  house.setDusk(d);
  const [pos, tgt] = camAt(P);
  stage.camera.position.copy(pos);
  stage.camera.lookAt(tgt);
  stage.render();
  overlay();
}
let queued = false;
function request() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; draw(); });
}

/* ---------- labels pinned to the 3D house ---------- */
const pins = STEPS.map((s, i) => {
  const el = document.createElement("div");
  el.className = "td-pin" + (i % 2 ? " below" : ""); // alternate above / below so neighbors don't collide
  el.innerHTML = `<i></i><span><b>${s.m.name}</b><small class="mono">${pad(s.n)} · ${s.m.spec}</small></span>`;
  labels.appendChild(el);
  return { s, el, v: new THREE.Vector3(...s.m.anchor) };
});
const tmp = new THREE.Vector3();

function current() {
  let pick = null;
  for (const s of STEPS) if (P >= s.at[0] - 0.005) pick = s;
  return pick;
}
function overlay() {
  const w = canvas.clientWidth, h = canvas.clientHeight, cur = current();
  const panel = mobile ? null : $(".pr-panel").getBoundingClientRect();
  for (const p of pins) {
    // phones have room for one label: the material on the card
    const on = P >= p.s.at[0] && P <= p.s.at[1] && (!mobile || p.s === cur);
    let show = false;
    if (on) {
      tmp.copy(p.v).project(stage.camera);
      const x = ((tmp.x + 1) / 2) * w, y = ((1 - tmp.y) / 2) * h;
      show = tmp.z < 1 && x > 12 && x < w - 12 && y > 80 && y < h - 90 && !(panel && x < panel.right + 12 && y > panel.top);
      if (show) {
        p.el.style.transform = `translate(${x}px, ${y}px)`;
        p.el.classList.toggle("flip", x > w * 0.66);
      }
    }
    p.el.classList.toggle("is-on", show);
  }
}

/* ---------- HUD + teaching card ---------- */
let lastPhase = -1, lastCard;
function hud() {
  let ph = 0;
  cfg.phases.forEach(([, at], i) => { if (P >= at) ph = i; });
  if (ph !== lastPhase) {
    lastPhase = ph;
    ui.phases.forEach((li, i) => { li.classList.toggle("is-on", i === ph); li.classList.toggle("is-done", i < ph); });
    ui.label.textContent = `Phase ${pad(ph + 1)} · ${cfg.phases[ph][0]}`;
  }
  const s = current();
  if (s !== lastCard) {
    lastCard = s;
    if (!s) {
      card.innerHTML = `<p class="pr-k mono">${cfg.title} · ${STEPS.length} steps</p><h3>Click Next to start the job.</h3><p>Every material is labeled as it goes on, in the order a pro installs it. You can also scroll, or click anywhere on the bar below to jump.</p>`;
    } else {
      const m = s.m;
      card.innerHTML = `
        <p class="pr-k mono">Step ${pad(s.n)} of ${pad(STEPS.length)} · ${GROUPS[m.group]}</p>
        <h3>${m.name}</h3>
        <p class="pr-spec mono">${m.spec}</p>
        <p class="pr-what">${m.what}</p>
        <p class="pr-why"><b>Why it matters:</b> ${m.why}</p>
        <p class="pr-tip mono"><b>Pro tip</b> ${m.tip}</p>`;
      card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
    }
  }
  ui.pct.textContent = Math.round(P * 100) + "%";
  ui.track.setAttribute("aria-valuenow", Math.round(P * 100));
  ui.back.disabled = P < 0.005;
  ui.fwd.textContent = !nextStop() ? "Finished ✓" : s ? "Next step →" : "Start →";
  ui.fwd.disabled = !nextStop();
  ui.bar.style.width = P * 100 + "%";
  let day = cfg.days[0][1];
  for (const [at, d] of cfg.days) if (P >= at) day = d;
  ui.read.day.textContent = day;
  if (ui.read.roof) {
    const off = seg(P, T.roofOff), on = seg(P, T.roofOn);
    ui.read.roof.textContent = P < T.roofOn[0] ? `${Math.round(off * 34)} / 34 off` : `${Math.round(on * 34)} / 34 on`;
  }
  if (ui.read.siding) {
    const so = seg(P, T.sidingOff), sn = seg(P, T.sidingOn);
    ui.read.siding.textContent = P < T.sidingOn[0] ? `${Math.round(so * 100)}% off` : `${Math.round(sn * 100)}% on`;
  }
  section.classList.toggle("is-started", P > 0.02);
  section.classList.toggle("is-done", P > 0.95);
  ui.hint.classList.toggle("is-gone", P > 0.02);
  if (gated && P > 0.97) unlock();
}

/* ---------- intro gate (home page): the rest of the site unlocks once the build is done ---------- */
function unlock(scrollTo) {
  if (!root.classList.contains("intro-locked")) return;
  root.classList.remove("intro-locked");
  root.classList.add("site-unlocking");
  try { sessionStorage.setItem("cd-intro-done", "1"); } catch (e) {}
  setTimeout(() => root.classList.remove("site-unlocking"), 1200);
  // the page just grew by the whole site; jump once layout has settled
  if (scrollTo) requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.getElementById(scrollTo);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY, behavior: "instant" });
  }));
}
if (gated) {
  document.getElementById("introSkip")?.addEventListener("click", () => unlock("home"));
  section.querySelectorAll("[data-unlock]").forEach((a) => a.addEventListener("click", (e) => {
    if (!root.classList.contains("intro-locked")) return;
    e.preventDefault();
    unlock(a.dataset.unlock);
  }));
}

/* ---------- glossary for this trade ---------- */
const list = document.getElementById("materialsList");
if (list) {
  list.innerHTML = STEPS.map(({ m, n }) => `
    <details class="mat-item">
      <summary><span class="mat-n">${pad(n)}</span><span class="mat-name">${m.name}<small>${m.spec}</small></span></summary>
      <div class="mat-body">
        <p>${m.what} ${m.why}</p>
        <p class="mat-tip"><b>PRO TIP</b>${m.tip}</p>
      </div>
    </details>`).join("");
}

/* ---------- click-through: Next / Back, phase tabs, a clickable progress bar, arrow keys ---------- */
// each step's resting point: partway into it, before the next one starts
const STOPS = STEPS.map((st, i) => {
  const end = Math.min(st.at[1], STEPS[i + 1]?.at[0] ?? 1);
  return clamp(st.at[0] + Math.max(0.006, (end - st.at[0]) * 0.55));
});
STOPS.push(1); // the finished house
// while a move is still animating, step from where it's headed, so quick clicks don't skip or stall
let tween = 0, aim = null;
const at = () => aim ?? P;
const nextStop = () => STOPS.find((p) => p > at() + 0.004);
const prevStop = () => [0, ...STOPS].reverse().find((p) => p < at() - 0.004) ?? 0;

// move through the job: the page scrolls, so the build animates exactly as it does when scrolling
function goTo(target) {
  target = clamp(target);
  if (reduced) { P = target; hud(); request(); return; }
  const span = section.offsetHeight - innerHeight, top = section.getBoundingClientRect().top + scrollY;
  const from = scrollY, to = top + target * span, dur = Math.min(1400, 450 + Math.abs(to - from) / span * 2600);
  const t0 = performance.now(), id = ++tween;
  aim = target;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const step = (now) => {
    if (id !== tween) return;
    const k = Math.min(1, (now - t0) / dur);
    window.scrollTo({ top: from + (to - from) * ease(k), behavior: "instant" });
    if (k < 1) requestAnimationFrame(step); else aim = null;
  };
  requestAnimationFrame(step);
}
// the visitor took over with the wheel or a finger
addEventListener("wheel", () => { tween++; aim = null; }, { passive: true });
addEventListener("touchstart", () => { tween++; aim = null; }, { passive: true });

section.addEventListener("click", (e) => {
  const b = e.target.closest("[data-step],[data-phase]");
  if (!b) return;
  if (b.dataset.step) goTo(b.dataset.step === "1" ? nextStop() ?? 1 : prevStop());
  else goTo(cfg.phases[+b.dataset.phase][1] + 0.004);
});
// the progress bar: click or drag anywhere to jump
let dragging = false;
const seek = (e) => {
  const r = ui.track.getBoundingClientRect();
  const k = clamp((e.clientX - r.left) / r.width);
  if (dragging === "drag") { const span = section.offsetHeight - innerHeight; tween++; aim = null; window.scrollTo({ top: section.getBoundingClientRect().top + scrollY + k * span, behavior: "instant" }); }
  else goTo(k);
};
ui.track.addEventListener("pointerdown", (e) => { dragging = "down"; ui.track.setPointerCapture(e.pointerId); seek(e); });
ui.track.addEventListener("pointermove", (e) => { if (dragging) { dragging = "drag"; seek(e); } });
ui.track.addEventListener("pointerup", () => { dragging = false; });
ui.track.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") { e.preventDefault(); goTo(P + 0.02); }
  if (e.key === "ArrowLeft") { e.preventDefault(); goTo(P - 0.02); }
});
addEventListener("keydown", (e) => {
  if (section.dataset.pin !== "on" || /input|select|textarea/i.test(e.target.tagName) || e.target === ui.track) return;
  if (e.key === "ArrowRight") { e.preventDefault(); goTo(nextStop() ?? 1); }
  if (e.key === "ArrowLeft") { e.preventDefault(); goTo(prevStop()); }
});

/* ---------- pin + drive ---------- */
const nav = document.querySelector(".nav");
function onScroll() {
  const r = section.getBoundingClientRect(), H = innerHeight;
  section.dataset.pin = r.top > 0 ? "pre" : r.bottom <= H ? "post" : "on";
  nav?.classList.toggle("is-over", r.bottom > 90);
  if (r.bottom < -H || r.top > H) return;
  P = clamp(-r.top / (r.height - H));
  hud();
  request();
}
if (reduced) {
  section.classList.add("is-static");
  const range = $(".pr-range");
  range.hidden = false;
  range.addEventListener("input", () => { P = range.value / 1000; hud(); request(); });
} else {
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();
}

try { init(); } catch (e) { console.error(e); section.classList.add("is-error"); }
hud();
request();
