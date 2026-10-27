/* CD Consulting — scroll-driven tear-off & rebuild on a real photo.
   Layers come from tools/build_stages.py (images/build/). Scroll position
   (0 → 1 through the pinned section) decides how much of each layer shows:
   old roof strips ridge-down with real shingle chunks falling, siding comes
   off top-down, the house dries in, new shingles go on eave-up, new siding
   bottom-up. */
(function () {
  const section = document.getElementById("build");
  if (!section) return;
  const canvas = document.getElementById("tdCanvas");
  const ctx = canvas.getContext("2d");
  const $ = (s, el = document) => el.querySelector(s);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BASE = "images/build/";
  const CROP = [170, 130, 1260, 938]; // x, y, w, h of the photo shown (house framed tight)

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (P, a, b) => clamp((P - a) / (b - a));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---------- timeline (fractions of the scroll) ----------
  const T = {
    scan: [0.015, 0.1],
    roofOff: [0.12, 0.34],
    sidingOff: [0.2, 0.4],
    under: [0.4, 0.52],
    wrap: [0.44, 0.55],
    roofOn: [0.55, 0.75],
    sidingOn: [0.66, 0.84],
    glint: [0.87, 0.97],
  };

  let M, img = {}, ready = false;
  let roofCols = [], parts = [];

  // Roof outline in output pixels (source coords × 1600/1800), for glint + particle spawn.
  const K = 1600 / 1800;
  const ROOF = [[478, 309], [1302, 309], [1492, 724], [298, 731]].map(([x, y]) => [x * K, y * K]);
  const DORMER = [503 * K, 407 * K, 1270 * K, 569 * K];
  const roofLeft = (y) => ROOF[0][0] + (ROOF[3][0] - ROOF[0][0]) * ((y - ROOF[0][1]) / (ROOF[3][1] - ROOF[0][1]));
  const roofRight = (y) => ROOF[1][0] + (ROOF[2][0] - ROOF[1][0]) * ((y - ROOF[1][1]) / (ROOF[2][1] - ROOF[1][1]));
  const SIDING_ZONES = [[501, 386, 643, 503], [928, 386, 1076, 503], [423, 677, 560, 826], [747, 677, 918, 826], [1026, 677, 1209, 826]];

  async function load() {
    M = await (await fetch(BASE + "layers.json")).json();
    canvas.width = CROP[2];
    canvas.height = CROP[3];
    const names = ["before", ...Object.keys(M.layers)];
    await Promise.all(names.map((n) => new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res();
      i.onerror = rej;
      i.src = BASE + n + (n === "before" ? ".jpg" : ".webp");
      img[n] = i;
    })));
    setup();
    ready = true;
    section.classList.add("is-ready");
  }

  function setup() {
    // ragged tear line: one random offset per 34px column
    for (let x = 0; x < M.width; x += 34) roofCols.push({ x, o: rand() });

    const { ridge, eave } = M.roof;
    // shingle chunks: spawn where the tear line passes them, cut from the real photo
    for (let i = 0; i < 300; i++) {
      const y = ridge + 6 + rand() * (eave - ridge - 12);
      const x = roofLeft(y) + 10 + rand() * (roofRight(y) - roofLeft(y) - 20);
      if (x > DORMER[0] && x < DORMER[2] && y > DORMER[1] && y < DORMER[3]) continue;
      const ts = T.roofOff[0] + ((y - ridge) / (eave - ridge)) * (T.roofOff[1] - T.roofOff[0]);
      parts.push({ x, y, ts, life: 0.05 + rand() * 0.03, w: 18 + rand() * 30, h: 9 + rand() * 8, vx: (rand() - 0.5) * 160, spin: (rand() - 0.5) * 7 });
    }
    // siding planks
    const top = M.wall.top, bot = M.wall.bottom;
    for (let i = 0; i < 45; i++) {
      const z = SIDING_ZONES[Math.floor(rand() * SIDING_ZONES.length)];
      const y = z[1] + rand() * (z[3] - z[1]), x = z[0] + rand() * (z[2] - z[0] - 40);
      const ts = T.sidingOff[0] + ((y - top) / (bot - top)) * (T.sidingOff[1] - T.sidingOff[0]);
      parts.push({ x, y, ts, life: 0.05 + rand() * 0.02, w: 50 + rand() * 90, h: 10, vx: (rand() - 0.5) * 90, spin: (rand() - 0.5) * 1.6, plank: true });
    }
  }

  // ---------- drawing helpers ----------
  function layer(name, clipFn) {
    const [x, y, w, h] = M.layers[name];
    ctx.save();
    if (clipFn) { ctx.beginPath(); clipFn(); ctx.clip(); }
    ctx.drawImage(img[name], x, y, w, h);
    ctx.restore();
  }

  // everything above a ragged line at height `edge`
  const tornAbove = (edge) => () => {
    ctx.moveTo(0, 0);
    ctx.lineTo(M.width, 0);
    for (let i = roofCols.length - 1; i >= 0; i--) {
      const c = roofCols[i], yy = edge + (c.o - 0.5) * 30;
      ctx.lineTo(c.x + 34, yy);
      ctx.lineTo(c.x, yy);
    }
    ctx.closePath();
  };

  // everything below a racked (stair-stepped) shingle line at height `edge`
  const rackedBelow = (edge) => () => {
    const course = 12.5, step = 118;
    ctx.moveTo(0, M.height);
    for (let x = 0, i = 0; x < M.width; x += step, i++) {
      const yy = edge + (i % 4) * course;
      ctx.lineTo(x, yy);
      ctx.lineTo(x + step, yy);
    }
    ctx.lineTo(M.width, M.height);
    ctx.closePath();
  };

  // horizontal courses rolled left → right, bottom course first
  const rolled = (top, bot, n, t) => () => {
    const h = (bot - top) / n;
    for (let i = 0; i < n; i++) {
      const p = easeOut(clamp(t * n - i));
      if (p <= 0) continue;
      const y1 = bot - i * h;
      ctx.rect(0, y1 - h - 1, M.width * p, h + 2);
    }
  };

  function drawParts(P) {
    for (const p of parts) {
      const a = (P - p.ts) / p.life;
      if (a <= 0 || a >= 1) continue;
      const x = p.x + p.vx * a, y = p.y + a * a * 560 - Math.sin(a * Math.PI) * 18;
      ctx.save();
      ctx.globalAlpha = a > 0.75 ? (1 - a) / 0.25 : 1;
      ctx.translate(x + p.w / 2, y + p.h / 2);
      ctx.rotate(p.spin * a);
      ctx.shadowColor = "rgba(0,0,0,.45)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      ctx.drawImage(img.before, p.x * (img.before.naturalWidth / M.width), p.y * (img.before.naturalHeight / M.height),
        p.w * (img.before.naturalWidth / M.width), p.h * (img.before.naturalHeight / M.height), -p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
  }

  const FLAGS = [[690, 330, "GRANULE LOSS"], [1040, 560, "LIFTED TABS"], [560, 600, "DEBRIS / ROT RISK"], [1160, 700, "DATED SIDING"]];

  function render(P) {
    if (!ready) return;
    const { ridge, eave } = M.roof;
    ctx.setTransform(1, 0, 0, 1, -CROP[0], -CROP[1]);
    ctx.drawImage(img.before, 0, 0, M.width, M.height);

    // --- roof
    const off = seg(P, ...T.roofOff);
    if (off > 0) layer("roof-deck", off >= 1 ? null : tornAbove(ridge - 20 + off * (eave - ridge + 50)));
    const un = seg(P, ...T.under);
    if (un > 0) layer("roof-under", un >= 1 ? null : rolled(ridge - 6, eave + 6, 5, un));
    const on = seg(P, ...T.roofOn);
    if (on > 0) layer("roof-new", on >= 1 ? null : rackedBelow(eave + 10 - easeOut(on) * (eave - ridge + 60)));

    // --- walls
    const top = M.wall.top, bot = M.wall.bottom;
    const so = seg(P, ...T.sidingOff);
    if (so > 0) layer("wall-sheath", so >= 1 ? null : () => ctx.rect(0, 0, M.width, top + so * (bot - top + 10)));
    const wr = seg(P, ...T.wrap);
    if (wr > 0) layer("wall-wrap", wr >= 1 ? null : rolled(top - 4, bot + 4, 4, wr));
    const sn = seg(P, ...T.sidingOn);
    if (sn > 0) {
      const edge = bot + 6 - Math.floor((sn * (bot - top + 12)) / 11) * 11; // snaps to lap courses
      layer("wall-new", sn >= 1 ? null : () => ctx.rect(0, edge, M.width, M.height));
    }

    drawParts(P);

    // --- inspection scan + flags
    const s = seg(P, ...T.scan);
    if (s > 0 && s < 1) {
      const y = 250 + s * 680;
      const g = ctx.createLinearGradient(0, y - 60, 0, y);
      g.addColorStop(0, "rgba(47,107,255,0)");
      g.addColorStop(1, "rgba(47,107,255,.28)");
      ctx.fillStyle = g;
      ctx.fillRect(220, y - 60, 1160, 60);
      ctx.fillStyle = "#7fa8ff";
      ctx.fillRect(220, y - 2, 1160, 3);
    }
    if (P > 0.03 && P < 0.13) {
      ctx.font = '700 17px "JetBrains Mono", monospace';
      FLAGS.forEach(([x, y, t], i) => {
        if (P < 0.035 + i * 0.012) return;
        ctx.strokeStyle = "#ff5a4a";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7); ctx.moveTo(x + 7, y - 7); ctx.lineTo(x - 7, y + 7); ctx.stroke();
        const w = ctx.measureText(t).width + 20;
        ctx.fillStyle = "rgba(7,8,10,.85)";
        ctx.fillRect(x + 24, y - 15, w, 30);
        ctx.strokeRect(x + 24, y - 15, w, 30);
        ctx.fillStyle = "#ffb2a8";
        ctx.fillText(t, x + 34, y + 6);
      });
    }

    // --- finish: light glint across the new roof
    const gl = seg(P, ...T.glint);
    if (gl > 0 && gl < 1) {
      ctx.save();
      ctx.beginPath();
      ROOF.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.clip();
      const gx = 100 + gl * 1500;
      const g = ctx.createLinearGradient(gx - 160, 0, gx + 160, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(190,210,255,.22)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, M.width, M.height);
      ctx.restore();
    }

    hud(P);
  }

  // ---------- HUD ----------
  const PHASES = [
    { at: 0, id: "INSPECT", msg: "Walking the roof: granule loss, lifted tabs, debris holding water. It's time." },
    { at: 0.12, id: "TEAR-OFF", msg: "Stripping it to the deck, ridge down. Old siding comes off with it. Every nail pulled." },
    { at: 0.4, id: "DRY-IN", msg: "Deck inspected. Synthetic underlayment rolled eave-up, and the walls wrapped and taped." },
    { at: 0.55, id: "REBUILD", msg: "New architectural shingles from the eave up. New siding bottom-up, every course level." },
    { at: 0.86, id: "REVEAL", msg: "Same house. New everything, managed start to finish." },
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
    const roofOff = seg(P, ...T.roofOff), roofOn = seg(P, ...T.roofOn);
    h.roof.textContent = P < 0.45 ? `${Math.round(roofOff * 22)} / 22 OFF` : `${Math.round(roofOn * 22)} / 22 ON`;
    const sOff = seg(P, ...T.sidingOff), sOn = seg(P, ...T.sidingOn);
    h.siding.textContent = P < 0.5 ? `${Math.round(sOff * 100)}% OFF` : `${Math.round(sOn * 100)}% ON`;
    section.classList.toggle("is-done", P > 0.95);
    h.hint.classList.toggle("is-gone", P > 0.03);
  }

  // ---------- drive ----------
  let P = reduced ? 1 : 0;
  const draw = () => render(P);

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
      P = clamp(-r.top / (r.height - innerHeight));
      draw();
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    onScroll();
  }

  load().then(draw).catch(() => section.classList.add("is-error"));
  hud(P);
})();
