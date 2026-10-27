/* CD Consulting — scroll-driven tear-off & rebuild.
   Scroll position (0 → 1 through the pinned section) drives every piece:
   old shingles strip ridge-down, old siding drops, the house dries in,
   new shingles go on eave-up, new siding goes on bottom-up, then dusk reveal. */
(function () {
  const section = document.getElementById("build");
  if (!section) return;
  const svg = document.getElementById("tdSvg");
  const $ = (s, el = document) => el.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- helpers ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (P, a, b) => clamp((P - a) / (b - a));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`; };
  const vary = (h, amt) => { const k = 1 + (rand() - 0.5) * amt; return `rgb(${hex(h).map((v) => clamp(Math.round(v * k), 0, 255)).join(",")})`; };
  const pts = (a) => a.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ");

  const OLD = { roof: "#6e6153", siding: "#cdbf9f", trim: "#f1efe8", door: "#7a1f22", gutter: "#e9e7e1" };
  const NEW = { roof: "#1e1f23", siding: "#eeede8", trim: "#141518", door: "#2552c9", gutter: "#141518" };

  // ---------- geometry (same house as the visualizer) ----------
  const ROOFS = [
    { top: 88, bot: 214, left: (y) => 196 - (y - 88) * 100 / 126, right: (y) => 444 + (y - 88) * 100 / 126, delay: 0 },
    { top: 252, bot: 304, left: (y) => 548 - (y - 252) * 42 / 52, right: (y) => 698 + (y - 252) * 42 / 52, delay: 0.05 },
    { top: 298, bot: 340, left: (y) => 320 - (y - 298) * 54 / 42, right: (y) => 320 + (y - 298) * 54 / 42, delay: 0.07 },
  ];
  const WALLS = [
    { x: 120, y: 214, w: 400, h: 226, delay: 0 },
    { x: 520, y: 304, w: 200, h: 136, delay: 0.03 },
  ];

  function shingles(roof, rowH, tabW) {
    const pieces = [];
    const rows = Math.ceil((roof.bot - roof.top) / rowH);
    for (let r = 0; r < rows; r++) {
      const y0 = roof.top + r * rowH, y1 = Math.min(roof.bot, y0 + rowH) + 0.6;
      const l0 = roof.left(y0), l1 = roof.left(Math.min(y1, roof.bot)), r0 = roof.right(y0), r1 = roof.right(Math.min(y1, roof.bot));
      const inner = [Math.max(l0, l1), Math.min(r0, r1)];
      const cuts = [];
      for (let x = Math.floor(inner[0] / tabW) * tabW + (r % 2) * tabW / 2; x < inner[1]; x += tabW) if (x > inner[0] + 4 && x < inner[1] - 4) cuts.push(x);
      const edges = [[l0, l1], ...cuts.map((x) => [x, x]), [r0, r1]];
      for (let i = 0; i < edges.length - 1; i++) {
        const [a0, a1] = edges[i], [b0, b1] = edges[i + 1];
        if (Math.max(b0 - a0, b1 - a1) < 2) continue;
        pieces.push({ poly: [[a0, y0], [b0 + 0.4, y0], [b1 + 0.4, y1], [a1, y1]], row: r, rows, cx: (a0 + b1) / 2, cy: (y0 + y1) / 2 });
      }
    }
    return pieces;
  }

  function planks(wall, rowH) {
    const pieces = [];
    const rows = Math.ceil(wall.h / rowH);
    for (let r = 0; r < rows; r++) {
      const y = wall.y + r * rowH, h = Math.min(rowH, wall.y + wall.h - y) + 0.5;
      const n = wall.w > 300 ? 3 : 2;
      let x = wall.x;
      for (let i = 0; i < n; i++) {
        const w = i === n - 1 ? wall.x + wall.w - x : wall.w / n + (rand() - 0.5) * 50;
        pieces.push({ x, y, w, h, row: r, rows, cx: x + w / 2, cy: y + h / 2 });
        x += w;
      }
    }
    return pieces;
  }

  // ---------- static scene ----------
  svg.innerHTML = `
    <defs>
      <pattern id="td-osb" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#b99a66"/>
        <path d="M2 4h6M12 2h5M5 11h7M15 9h6M1 18h5M10 16h7M17 21h5M7 22h3" stroke="#8a6d42" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
        <path d="M4 7h4M14 13h5M3 14h3M19 4h3" stroke="#d6bb86" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>
      </pattern>
      <pattern id="td-osb-seams" width="96" height="48" patternUnits="userSpaceOnUse">
        <path d="M0 47.5H96M95.5 0V48" stroke="#5a4528" stroke-width="1.2" opacity=".6"/>
      </pattern>
      <pattern id="td-pat-under" width="120" height="30" patternUnits="userSpaceOnUse">
        <rect width="120" height="30" fill="#2a2e35"/>
        <path d="M0 14H120" stroke="#2f6bff" stroke-width="1" opacity=".55"/>
        <text x="6" y="11" font-family="JetBrains Mono, monospace" font-size="6" fill="#6f9bff" opacity=".7" letter-spacing="1">CD//SHIELD</text>
        <text x="66" y="26" font-family="JetBrains Mono, monospace" font-size="6" fill="#6f9bff" opacity=".5" letter-spacing="1">CD//SHIELD</text>
      </pattern>
      <pattern id="td-pat-wrap" width="140" height="40" patternUnits="userSpaceOnUse">
        <rect width="140" height="40" fill="#e9edf3"/>
        <text x="8" y="16" font-family="JetBrains Mono, monospace" font-size="8" font-weight="700" fill="#2f6bff" opacity=".75" letter-spacing="1.5">CD//WRAP</text>
        <text x="78" y="36" font-family="JetBrains Mono, monospace" font-size="8" font-weight="700" fill="#2f6bff" opacity=".45" letter-spacing="1.5">CD//WRAP</text>
      </pattern>
      <linearGradient id="td-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c2638"/><stop offset="1" stop-color="#4a5f82"/></linearGradient>
      <radialGradient id="td-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd58a" stop-opacity=".6"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/></radialGradient>
      <radialGradient id="td-under-glow" cx=".5" cy="1" r=".6"><stop offset="0" stop-color="#2f6bff" stop-opacity=".35"/><stop offset="1" stop-color="#2f6bff" stop-opacity="0"/></radialGradient>
      <filter id="td-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <rect width="800" height="480" fill="#090b10"/>
    <g stroke="#2f6bff" stroke-opacity=".09"><path d="M0 40H800M0 80H800M0 120H800M0 160H800M0 200H800M0 240H800M0 280H800M0 320H800M0 360H800M0 400H800M40 0V480M80 0V480M120 0V480M160 0V480M200 0V480M240 0V480M280 0V480M320 0V480M360 0V480M400 0V480M440 0V480M480 0V480M520 0V480M560 0V480M600 0V480M640 0V480M680 0V480M720 0V480M760 0V480"/></g>
    <g id="td-stars" fill="#fff" opacity="0"><circle cx="60" cy="40" r="1"/><circle cx="160" cy="62" r="1.2"/><circle cx="640" cy="44" r="1"/><circle cx="740" cy="120" r="1.3"/><circle cx="560" cy="26" r=".8"/><circle cx="270" cy="30" r="1"/><circle cx="90" cy="150" r=".8"/></g>
    <rect id="td-underglow" x="40" y="250" width="720" height="230" fill="url(#td-under-glow)" opacity="0"/>
    <rect y="440" width="800" height="40" fill="#11141a"/>
    <path d="M0 440.5H800" stroke="#2f6bff" stroke-opacity=".5"/>

    <g id="td-house">
      <g class="td-chimney"><rect x="400" y="50" width="36" height="80" fill="#5d4a40"/><path d="M400 62h36M400 74h36M400 86h36M418 50v12M409 62v12M427 62v12M418 74v12" stroke="#000" stroke-opacity=".3"/><rect x="395" y="44" width="46" height="8" class="td-trim"/></g>

      <!-- substrates -->
      ${WALLS.map((w) => `<rect x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" fill="url(#td-osb)"/><rect x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" fill="url(#td-osb-seams)"/>`).join("")}
      ${ROOFS.map((r) => { const p = pts([[r.left(r.top), r.top], [r.right(r.top), r.top], [r.right(r.bot), r.bot], [r.left(r.bot), r.bot]]); return `<polygon points="${p}" fill="url(#td-osb)"/><polygon points="${p}" fill="url(#td-osb-seams)"/>`; }).join("")}
      <g id="td-wrap"></g>
      <g id="td-under"></g>
      <g id="td-old-siding"></g>
      <g id="td-new-siding"></g>

      <!-- corner + band trim -->
      <g class="td-trim-g">
        <rect x="120" y="214" width="8" height="226"/><rect x="512" y="214" width="8" height="226"/><rect x="712" y="304" width="8" height="136"/>
        <rect x="120" y="318" width="400" height="5"/>
      </g>

      <g id="td-old-roof"></g>
      <g id="td-new-roof"></g>
      <path d="M196 88H444" id="td-ridge" stroke-width="5"/>
      <g class="td-trim-g"><rect x="92" y="212" width="456" height="7"/><rect x="502" y="302" width="242" height="6"/><rect x="262" y="338" width="116" height="6"/></g>

      <!-- windows -->
      <g id="td-windows">
        ${[[160, 236, 64], [288, 236, 64], [416, 236, 64], [150, 344, 96], [396, 344, 96]].map(([x, y, w]) => `
          <g transform="translate(${x} ${y})"><rect class="td-trim" width="${w}" height="70"/><rect x="5" y="5" width="${w - 10}" height="60" fill="url(#td-glass)"/>
          <rect class="td-lit" x="5" y="5" width="${w - 10}" height="60" fill="#ffc96b" opacity="0"/>
          <path class="td-muntin" d="M${w / 2} 5V65M5 35H${w - 5}" stroke-width="2.5"/><rect class="td-trim" x="-4" y="68" width="${w + 8}" height="5"/></g>`).join("")}
      </g>

      <!-- porch + door -->
      <rect x="272" y="344" width="6" height="96" class="td-trim"/><rect x="362" y="344" width="6" height="96" class="td-trim"/>
      <rect x="294" y="352" width="52" height="88" class="td-trim"/>
      <rect x="299" y="357" width="42" height="83" id="td-door"/>
      <g stroke="#000" stroke-opacity=".35" fill="none"><rect x="305" y="364" width="30" height="30"/><rect x="305" y="400" width="30" height="32"/></g>
      <circle cx="334" cy="400" r="2.4" fill="#c9a75a"/>
      <circle cx="286" cy="368" r="4" fill="#f6e7c4"/>

      <!-- garage -->
      <rect x="552" y="330" width="136" height="110" class="td-trim"/>
      <rect x="557" y="335" width="126" height="105" id="td-garage"/>
      <path d="M557 361H683M557 387H683M557 413H683" stroke="#000" stroke-opacity=".3"/>
      <g fill="url(#td-glass)"><rect x="565" y="341" width="24" height="14"/><rect x="597" y="341" width="24" height="14"/><rect x="629" y="341" width="24" height="14"/><rect x="661" y="341" width="16" height="14"/></g>
    </g>

    <!-- gutters -->
    <g id="td-gutter-old"><rect x="90" y="218" width="460" height="6" rx="2"/><rect x="500" y="307" width="246" height="5" rx="2"/><rect x="100" y="222" width="6" height="218"/><rect x="736" y="310" width="6" height="130"/></g>
    <g id="td-gutter-new"><rect x="90" y="218" width="460" height="6" rx="2"/><rect x="500" y="307" width="246" height="5" rx="2"/><rect x="100" y="222" width="6" height="218"/><rect x="736" y="310" width="6" height="130"/></g>

    <g id="td-glows" filter="url(#td-blur)" opacity="0">
      <rect x="166" y="242" width="52" height="58" fill="#ffcf7a"/><rect x="294" y="242" width="52" height="58" fill="#ffcf7a"/><rect x="422" y="242" width="52" height="58" fill="#ffcf7a"/>
      <rect x="156" y="350" width="84" height="58" fill="#ffcf7a"/><rect x="402" y="350" width="84" height="58" fill="#ffcf7a"/>
    </g>
    <circle id="td-porch" cx="286" cy="368" r="46" fill="url(#td-glow)" opacity="0"/>

    <!-- inspection scan -->
    <g id="td-scan" opacity="0">
      <rect x="80" y="0" width="680" height="2" fill="#6f9bff"/>
      <rect x="80" y="-24" width="680" height="24" fill="#2f6bff" opacity=".12"/>
    </g>
    <g id="td-flags" font-family="JetBrains Mono, monospace" font-size="9" letter-spacing="1"></g>

    <!-- blueprint callouts -->
    <g id="td-dims" opacity="0" font-family="JetBrains Mono, monospace" font-size="10" letter-spacing="1" fill="#6f9bff">
      <path d="M96 462H544M96 456v12M544 456v12" stroke="#2f6bff"/>
      <text x="320" y="476" text-anchor="middle">MAIN // 44'-0"</text>
      <path d="M770 88V440M764 88h12M764 440h12" stroke="#2f6bff" stroke-dasharray="3 4"/>
      <text x="0" y="0" transform="translate(786 264) rotate(90)" text-anchor="middle">RIDGE 26'-6"</text>
      <path d="M196 80H444" stroke="#2f6bff" stroke-dasharray="2 3"/>
      <text x="320" y="74" text-anchor="middle">PITCH 8/12 // 28 SQ</text>
    </g>`;

  // ---------- generated layers ----------
  const groups = {
    oldRoof: $("#td-old-roof", svg), newRoof: $("#td-new-roof", svg),
    oldSiding: $("#td-old-siding", svg), newSiding: $("#td-new-siding", svg),
    under: $("#td-under", svg), wrap: $("#td-wrap", svg),
  };
  const parts = []; // { node, start, dur, kind, ... , last }

  ROOFS.forEach((roof, ri) => {
    const old = shingles(roof, 9, 34);
    old.forEach((p) => {
      const node = el("polygon", { points: pts(p.poly), fill: vary(OLD.roof, 0.22), stroke: "rgba(0,0,0,.35)", "stroke-width": ".6" }, groups.oldRoof);
      // tear-off: ridge → eave
      parts.push({ node, kind: "fall", cx: p.cx, cy: p.cy, start: 0.13 + roof.delay + (p.row / p.rows) * 0.15 + rand() * 0.025, dur: 0.05,
        dx: (rand() - 0.5) * 2, spin: (rand() - 0.5) * 2 });
    });
    seed += 11;
    const neu = shingles(roof, 9, 30);
    neu.forEach((p) => {
      const node = el("polygon", { points: pts(p.poly), fill: vary(NEW.roof, 0.35), stroke: "rgba(0,0,0,.55)", "stroke-width": ".6" }, groups.newRoof);
      // install: eave → ridge
      parts.push({ node, kind: "lay", start: 0.53 + roof.delay * 0.6 + ((p.rows - 1 - p.row) / p.rows) * 0.15 + rand() * 0.012, dur: 0.03 });
    });
    // underlayment: 3 courses rolled left → right, eave first
    const courses = 3, h = (roof.bot - roof.top) / courses;
    for (let c = 0; c < courses; c++) {
      const y1 = roof.bot - c * h, y0 = y1 - h - 0.5;
      const id = `td-uc-${ri}-${c}`;
      const cp = el("clipPath", { id }, svg.querySelector("defs"));
      const rect = el("rect", { x: roof.left(y1) - 2, y: y0, width: 0, height: h + 1 }, cp);
      el("polygon", { points: pts([[roof.left(y0), y0], [roof.right(y0), y0], [roof.right(y1), y1], [roof.left(y1), y1]]), fill: "url(#td-pat-under)", "clip-path": `url(#${id})` }, groups.under);
      parts.push({ node: rect, kind: "roll", full: roof.right(y1) - roof.left(y1) + 4, start: 0.42 + c * 0.025 + roof.delay * 0.3, dur: 0.045 });
    }
  });

  WALLS.forEach((wall, wi) => {
    planks(wall, 11).forEach((p) => {
      const node = el("rect", { x: p.x, y: p.y, width: p.w, height: p.h, fill: vary(OLD.siding, 0.1), stroke: "rgba(0,0,0,.22)", "stroke-width": ".6" }, groups.oldSiding);
      parts.push({ node, kind: "fall", cx: p.cx, cy: p.cy, start: 0.22 + wall.delay + (p.row / p.rows) * 0.12 + rand() * 0.03, dur: 0.06,
        dx: (rand() - 0.5) * 2, spin: (rand() - 0.5) * 0.6 });
    });
    planks(wall, 10).forEach((p) => {
      const node = el("rect", { x: p.x, y: p.y, width: p.w, height: p.h, fill: vary(NEW.siding, 0.04), stroke: "rgba(0,0,0,.16)", "stroke-width": ".6" }, groups.newSiding);
      parts.push({ node, kind: "slide", start: 0.64 + wall.delay + ((p.rows - 1 - p.row) / p.rows) * 0.13 + rand() * 0.01, dur: 0.03 });
    });
    // house wrap: two courses per wall, bottom first
    const courses = 2, h = wall.h / courses;
    for (let c = 0; c < courses; c++) {
      const y = wall.y + wall.h - (c + 1) * h;
      const id = `td-wc-${wi}-${c}`;
      const cp = el("clipPath", { id }, svg.querySelector("defs"));
      const rect = el("rect", { x: wall.x, y: y - 0.5, width: 0, height: h + 1 }, cp);
      el("rect", { x: wall.x, y: y - 0.5, width: wall.w, height: h + 1, fill: "url(#td-pat-wrap)", "clip-path": `url(#${id})` }, groups.wrap);
      parts.push({ node: rect, kind: "roll", full: wall.w, start: 0.46 + c * 0.03 + wall.delay, dur: 0.05 });
    }
  });

  // inspection flags
  const FLAGS = [[250, 130, "LIFTED TABS"], [380, 170, "GRANULE LOSS"], [600, 272, "SOFT DECK"], [170, 280, "FADED SIDING"]];
  const flagNodes = FLAGS.map(([x, y, t], i) => {
    const g = el("g", { opacity: 0 }, $("#td-flags", svg));
    el("circle", { cx: x, cy: y, r: 9, fill: "none", stroke: "#ff5a4a", "stroke-width": 1.6 }, g);
    el("path", { d: `M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8`, stroke: "#ff5a4a", "stroke-width": 1.6 }, g);
    el("rect", { x: x + 13, y: y - 8, width: t.length * 6.4 + 10, height: 15, fill: "#090b10", stroke: "#ff5a4a", "stroke-width": ".8" }, g);
    el("text", { x: x + 18, y: y + 3, fill: "#ff8a7a" }, g).textContent = t;
    return { g, at: 0.035 + i * 0.012 };
  });

  // ---------- HUD ----------
  const PHASES = [
    { at: 0, id: "INSPECT", msg: "Scanning the roof: lifted tabs, granule loss, a soft spot in the deck. It's time." },
    { at: 0.12, id: "TEAR-OFF", msg: "Stripping it to the deck, ridge down. Old siding comes off with it. Every nail pulled." },
    { at: 0.38, id: "DRY-IN", msg: "Deck inspected. Ice & water shield, synthetic underlayment, and the house gets wrapped and taped." },
    { at: 0.52, id: "REBUILD", msg: "New shingles go on from the eave up. Siding goes on bottom-up, every course level." },
    { at: 0.84, id: "REVEAL", msg: "Same house. New everything. Trim, gutters, door, done, and managed start to finish." },
  ];
  const hud = {
    phases: [...section.querySelectorAll(".td-phases li")],
    label: $("#tdPhaseLabel"), pct: $("#tdPct"), bar: $("#tdBar"), status: $("#tdStatus"),
    day: $("#tdDay"), roof: $("#tdRoof"), siding: $("#tdSiding"), cta: $("#tdCta"), hint: $("#tdHint"),
  };
  let lastPhase = -1;

  const byId = (id) => $("#" + id, svg);
  const n = {
    gOld: byId("td-gutter-old"), gNew: byId("td-gutter-new"), ridge: byId("td-ridge"), door: byId("td-door"), garage: byId("td-garage"),
    scan: byId("td-scan"), dims: byId("td-dims"), glows: byId("td-glows"), porch: byId("td-porch"), stars: byId("td-stars"), under: byId("td-underglow"),
    lit: [...svg.querySelectorAll(".td-lit")],
  };

  function render(P) {
    // pieces
    for (const p of parts) {
      const t = seg(P, p.start, p.start + p.dur);
      if (t === p.last) continue;
      p.last = t;
      if (p.kind === "fall") {
        if (t === 0) { p.node.removeAttribute("transform"); p.node.setAttribute("opacity", 1); continue; }
        if (t === 1) { p.node.setAttribute("opacity", 0); continue; }
        const e = easeIn(t);
        p.node.setAttribute("transform", `translate(${(p.dx * 70 * t).toFixed(1)} ${(e * 320 - Math.sin(t * Math.PI) * 14).toFixed(1)}) rotate(${(p.spin * 120 * t).toFixed(1)} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)})`);
        p.node.setAttribute("opacity", (1 - Math.pow(t, 4)).toFixed(2));
      } else if (p.kind === "lay") {
        const e = easeOut(t);
        p.node.setAttribute("opacity", e.toFixed(2));
        p.node.setAttribute("transform", t === 1 ? "" : `translate(0 ${(-(1 - e) * 22).toFixed(1)})`);
      } else if (p.kind === "slide") {
        const e = easeOut(t);
        p.node.setAttribute("opacity", e.toFixed(2));
        p.node.setAttribute("transform", t === 1 ? "" : `translate(${(-(1 - e) * 30).toFixed(1)} 0)`);
      } else if (p.kind === "roll") {
        p.node.setAttribute("width", (easeOut(t) * p.full).toFixed(1));
      }
    }

    // colors: trim + door swap during rebuild
    const swap = easeOut(seg(P, 0.78, 0.86));
    const trim = mix(OLD.trim, NEW.trim, swap);
    svg.style.setProperty("--td-trim", trim);
    n.door.setAttribute("fill", mix(OLD.door, NEW.door, easeOut(seg(P, 0.8, 0.86))));
    n.garage.setAttribute("fill", trim);
    n.ridge.setAttribute("stroke", P < 0.4 ? "#4e4439" : mix("#4e4439", "#0c0d0f", seg(P, 0.66, 0.7)));
    n.ridge.setAttribute("opacity", P > 0.16 && P < 0.66 ? 0 : 1);

    // gutters: old ones drop first, new ones lock in last
    const go = seg(P, 0.11, 0.17);
    n.gOld.setAttribute("fill", OLD.gutter);
    n.gOld.setAttribute("transform", `translate(${go * -20} ${easeIn(go) * 240}) rotate(${go * -8} 320 220)`);
    n.gOld.setAttribute("opacity", 1 - go);
    const gn = easeOut(seg(P, 0.82, 0.87));
    n.gNew.setAttribute("fill", NEW.gutter);
    n.gNew.setAttribute("transform", `translate(0 ${(-(1 - gn) * 16).toFixed(1)})`);
    n.gNew.setAttribute("opacity", gn);

    // inspection scan + flags
    const s = seg(P, 0.015, 0.1);
    n.scan.setAttribute("opacity", s > 0 && s < 1 ? 1 : 0);
    n.scan.setAttribute("transform", `translate(0 ${60 + s * 380})`);
    flagNodes.forEach((f) => f.g.setAttribute("opacity", P > f.at && P < 0.14 ? 1 : 0));

    // blueprint callouts while the house is bare
    n.dims.setAttribute("opacity", (seg(P, 0.34, 0.4) * (1 - seg(P, 0.76, 0.82))).toFixed(2));

    // dusk reveal
    const d = easeOut(seg(P, 0.86, 0.96));
    n.glows.setAttribute("opacity", (d * 0.9).toFixed(2));
    n.lit.forEach((l) => l.setAttribute("opacity", (d * 0.85).toFixed(2)));
    n.porch.setAttribute("opacity", d.toFixed(2));
    n.stars.setAttribute("opacity", d.toFixed(2));
    n.under.setAttribute("opacity", d.toFixed(2));

    // HUD
    let ph = 0;
    PHASES.forEach((x, i) => { if (P >= x.at) ph = i; });
    if (ph !== lastPhase) {
      lastPhase = ph;
      hud.phases.forEach((li, i) => { li.classList.toggle("is-on", i === ph); li.classList.toggle("is-done", i < ph); });
      hud.label.textContent = `PHASE 0${ph + 1} // ${PHASES[ph].id}`;
      hud.status.textContent = PHASES[ph].msg;
    }
    hud.pct.textContent = Math.round(P * 100) + "%";
    hud.bar.style.width = P * 100 + "%";
    hud.day.textContent = P < 0.12 ? "00" : P < 0.38 ? "01" : P < 0.66 ? "02" : "03";
    const removed = seg(P, 0.13, 0.4), installed = seg(P, 0.53, 0.76);
    hud.roof.textContent = P < 0.45 ? `${Math.round(removed * 28)} / 28 OFF` : `${Math.round(installed * 28)} / 28 ON`;
    const sidingOff = seg(P, 0.22, 0.4), sidingOn = seg(P, 0.64, 0.82);
    hud.siding.textContent = P < 0.5 ? `${Math.round(sidingOff * 100)}% OFF` : `${Math.round(sidingOn * 100)}% ON`;
    section.classList.toggle("is-done", P > 0.95);
    hud.hint.classList.toggle("is-gone", P > 0.03);
  }

  // ---------- drive ----------
  if (reduced) {
    // No pinned scroll: let the visitor scrub with a slider instead.
    section.classList.add("is-static");
    const range = $("#tdRange");
    range.hidden = false;
    range.addEventListener("input", () => render(range.value / 1000));
    render(1);
    range.value = 1000;
    return;
  }

  let ticking = false;
  const update = () => {
    ticking = false;
    const r = section.getBoundingClientRect();
    const total = r.height - innerHeight;
    render(clamp(-r.top / total));
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  update();
})();
