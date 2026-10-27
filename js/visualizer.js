/* CD Consulting — exterior visualizer
   Demo house: live SVG recolor.  Your house: paint zones on a photo, recolor
   with luminance-preserving blend modes so shadows and texture survive. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const PALETTE = {
    roof: [
      ["Onyx Black", "#1b1c1f"], ["Charcoal", "#34373c"], ["Pewter", "#5b6067"], ["Slate Blue", "#3b4a5e"],
      ["Weathered Wood", "#6b5e52"], ["Driftwood", "#8b8578"], ["Galvalume", "#a3a9b0"], ["Terracotta", "#9c4f36"],
    ],
    siding: [
      ["Arctic White", "#f1f0ec"], ["Pearl Grey", "#c9ccd0"], ["Iron Grey", "#5a5f66"], ["Midnight", "#1f2328"],
      ["Navy", "#22324f"], ["Harbor Blue", "#6e88a8"], ["Sage", "#8f9b88"], ["Khaki", "#cdbf9f"], ["Brick Red", "#7d4a3a"],
    ],
    trim: [
      ["White", "#ffffff"], ["Matte Black", "#141518"], ["Bronze", "#4b3b2f"], ["Silver Grey", "#9aa0a8"], ["Cobalt", "#2f5bd1"],
    ],
    door: [
      ["Electric Blue", "#2552c9"], ["Matte Black", "#121316"], ["Navy", "#1b2c55"], ["Oxblood", "#7a1f22"],
      ["Natural Oak", "#8a5a34"], ["Iron Grey", "#4a4f57"], ["White", "#f4f4f2"],
    ],
  };

  const PRESETS = [
    { name: "Builder Original", roof: "#6b5e52", siding: "#cdbf9f", trim: "#ffffff", door: "#7a1f22", shutter: "#2f4535",
      roofMat: "shingle", sidingStyle: "lap", windowStyle: "grid", shutters: true },
    { name: "Midnight Slate", roof: "#1b1c1f", siding: "#5a5f66", trim: "#141518", door: "#2552c9",
      roofMat: "shingle", sidingStyle: "lap", windowStyle: "clean", shutters: false },
    { name: "Modern Farmhouse", roof: "#1b1c1f", siding: "#f1f0ec", trim: "#141518", door: "#8a5a34",
      roofMat: "metal", sidingStyle: "batten", windowStyle: "clean", shutters: false },
    { name: "Steel Punk", roof: "#5b6067", siding: "#1f2328", trim: "#141518", door: "#2f6bff",
      roofMat: "metal", sidingStyle: "panel", windowStyle: "prairie", shutters: false },
    { name: "Coastal Blue", roof: "#a3a9b0", siding: "#6e88a8", trim: "#ffffff", door: "#121316", shutter: "#ffffff",
      roofMat: "metal", sidingStyle: "shake", windowStyle: "grid", shutters: true },
    { name: "Classic Colonial", roof: "#34373c", siding: "#f1f0ec", trim: "#ffffff", door: "#1b2c55", shutter: "#141518",
      roofMat: "shingle", sidingStyle: "lap", windowStyle: "grid", shutters: true },
    { name: "Brick Noir", roof: "#3b4a5e", siding: "#7d4a3a", trim: "#141518", door: "#121316",
      roofMat: "slate", sidingStyle: "brick", windowStyle: "clean", shutters: false },
    { name: "Navy Luxe", roof: "#1b1c1f", siding: "#22324f", trim: "#ffffff", door: "#8a5a34",
      roofMat: "slate", sidingStyle: "batten", windowStyle: "prairie", shutters: false },
  ];

  const LABELS = {
    roofMat: { shingle: "Shingle", metal: "Standing Seam", slate: "Slate", tile: "Tile" },
    sidingStyle: { lap: "Lap", batten: "Board & Batten", shake: "Shake", brick: "Brick", panel: "Panel" },
    windowStyle: { grid: "Grids", clean: "Clean", prairie: "Prairie" },
  };

  const state = { ...PRESETS[0], gutters: true, callouts: true, preset: PRESETS[0].name };
  let mode = "demo";

  const house = $("#house");
  const controls = $(".viz-controls");

  const colorName = (zone, hex) => (PALETTE[zone].find(([, h]) => h.toLowerCase() === hex.toLowerCase()) || ["Custom " + hex.toUpperCase()])[0];
  const darken = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 - amt))));
    return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, "0")).join("");
  };

  // ---------- build controls ----------
  Object.keys(PALETTE).forEach((zone) => {
    const wrap = $(`.swatches[data-target="${zone}"]`);
    PALETTE[zone].forEach(([name, hex]) => {
      const b = document.createElement("button");
      b.className = "sw"; b.type = "button";
      b.style.background = hex; b.dataset.hex = hex; b.title = name;
      b.setAttribute("aria-label", `${zone} ${name}`);
      wrap.appendChild(b);
    });
    const custom = document.createElement("label");
    custom.className = "sw sw-custom"; custom.title = "Custom color";
    custom.innerHTML = `<input type="color" aria-label="Custom ${zone} color" value="#2f6bff">`;
    wrap.appendChild(custom);
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest(".sw:not(.sw-custom)");
      if (!b) return;
      set({ [zone]: b.dataset.hex });
    });
    $("input", custom).addEventListener("input", (e) => set({ [zone]: e.target.value }));
  });

  $$(".seg[data-target]").forEach((seg) => {
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) set({ [seg.dataset.target]: b.dataset.v });
    });
  });
  $$("[data-toggle]").forEach((b) => b.addEventListener("click", () => set({ [b.dataset.toggle]: !state[b.dataset.toggle] })));

  const presetRow = $("#presetRow");
  PRESETS.forEach((p) => {
    const b = document.createElement("button");
    b.className = "preset"; b.type = "button"; b.dataset.name = p.name;
    b.innerHTML = `<span class="mini"><i style="background:${p.roof}"></i><i style="background:${p.siding}"></i><i style="background:${p.trim}"></i><i style="background:${p.door}"></i></span>${p.name.toUpperCase()}`;
    b.addEventListener("click", () => set({ shutter: undefined, ...p, preset: p.name }));
    presetRow.appendChild(b);
  });

  $("#duskToggle").addEventListener("change", (e) => house.classList.toggle("is-dusk", e.target.checked));

  // ---------- state + render ----------
  function set(patch) {
    const keys = Object.keys(patch);
    const fromPreset = "preset" in patch;
    Object.assign(state, patch);
    if (!fromPreset && keys.some((k) => k !== "gutters" && k !== "callouts")) state.preset = null;
    renderDemo();
    renderControls();
    Photo.render();
  }

  function renderControls() {
    Object.keys(PALETTE).forEach((zone) => {
      $$(`.swatches[data-target="${zone}"] .sw:not(.sw-custom)`).forEach((b) =>
        b.classList.toggle("is-on", b.dataset.hex.toLowerCase() === state[zone].toLowerCase()));
      const isCustom = !PALETTE[zone].some(([, h]) => h.toLowerCase() === state[zone].toLowerCase());
      $(`.swatches[data-target="${zone}"] .sw-custom`).classList.toggle("is-on", isCustom);
    });
    $$(".seg[data-target]").forEach((seg) =>
      $$("button", seg).forEach((b) => b.classList.toggle("is-on", state[seg.dataset.target] === b.dataset.v)));
    $$("[data-toggle]").forEach((b) => b.classList.toggle("is-on", !!state[b.dataset.toggle]));
    $$(".preset").forEach((b) => b.classList.toggle("is-on", b.dataset.name === state.preset));
    $("#buildName").textContent = (state.preset || "Custom build").toUpperCase();
  }

  function renderDemo() {
    const s = house.style;
    s.setProperty("--roof", state.roof);
    s.setProperty("--siding", state.siding);
    s.setProperty("--trim", state.trim);
    s.setProperty("--door", state.door);
    s.setProperty("--gutter", state.trim);
    s.setProperty("--shutter", state.shutter || (state.trim === "#ffffff" ? darken(state.siding, 0.65) : state.trim));
    $$(".tex-roof", house).forEach((el) => el.setAttribute("fill", `url(#pat-${state.roofMat})`));
    $$(".tex-siding", house).forEach((el) => el.setAttribute("fill", `url(#pat-${state.sidingStyle})`));
    house.classList.toggle("no-shutters", !state.shutters);
    house.classList.toggle("no-gutters", !state.gutters);
    house.classList.toggle("no-callouts", !state.callouts);
    house.classList.toggle("win-clean", state.windowStyle === "clean");
    $$(".win", house).forEach((w) => {
      const path = $(".muntins path", w);
      if (!path.dataset.d) path.dataset.d = path.getAttribute("d");
      const W = +$(".z-frame", w).getAttribute("width");
      path.setAttribute("d", state.windowStyle === "prairie"
        ? `M14 5V65M${W - 14} 5V65M5 14H${W - 5}`
        : path.dataset.d);
    });
    $("#specLine").textContent =
      `ROOF ${colorName("roof", state.roof)} / ${LABELS.roofMat[state.roofMat]}  ·  SIDING ${colorName("siding", state.siding)} / ${LABELS.sidingStyle[state.sidingStyle]}  ·  TRIM ${colorName("trim", state.trim)}`.toUpperCase();
  }

  function describe() {
    const parts = [
      `Build: ${state.preset || "Custom"}`,
      `Roof: ${colorName("roof", state.roof)}${mode === "demo" ? " " + LABELS.roofMat[state.roofMat] : ""}`,
      `Siding: ${colorName("siding", state.siding)}${mode === "demo" ? " " + LABELS.sidingStyle[state.sidingStyle] : ""}`,
      `Trim/Windows: ${colorName("trim", state.trim)}${mode === "demo" ? " (" + LABELS.windowStyle[state.windowStyle] + ")" : ""}`,
      `Door: ${colorName("door", state.door)}`,
    ];
    if (mode === "demo") parts.push(`Shutters: ${state.shutters ? "yes" : "no"}`);
    return parts.join(" | ");
  }

  // ---------- tabs ----------
  $$(".viz-tabs [data-tab]").forEach((tab) => tab.addEventListener("click", () => {
    mode = tab.dataset.tab;
    $$(".viz-tabs [data-tab]").forEach((t) => t.setAttribute("aria-selected", t === tab));
    $$("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== mode));
    controls.classList.toggle("photo-mode", mode === "photo");
    Photo.render();
  }));

  // ---------- send to lead form ----------
  $("#sendBuild").addEventListener("click", async () => {
    window.CD.attach("build", describe());
    if (mode === "photo" && Photo.hasImage()) {
      const blob = await Photo.toBlob();
      if (blob) window.CD.attach("render", blob);
    }
    window.CD.goTo("contact");
  });

  // =====================================================================
  // PHOTO MODE
  // =====================================================================
  const Photo = (() => {
    const canvas = $("#photoCanvas");
    const ctx = canvas.getContext("2d");
    const stage = $("#photoStage");
    const cursor = $("#brushCursor");
    const input = $("#photoInput");
    const drop = $("#dropzone");
    const ZONES = ["roof", "siding", "trim", "door"];
    const MASK_TINT = { roof: "47,107,255", siding: "0,220,170", trim: "255,200,0", door: "255,70,140" };
    let base = null, masks = {}, painted = {}, tmp = null;
    let zone = "roof", erasing = false, showMask = false, comparing = false;
    let brush = 40, strength = 0.8, drawing = false, last = null, queued = false;

    const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

    async function load(file) {
      if (!file || !file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      try { await img.decode(); } catch { alert("Couldn't read that image. Try a JPG or PNG."); return; }
      const max = 1600, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      base = mk(w, h); base.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.width = w; canvas.height = h;
      tmp = mk(w, h);
      ZONES.forEach((z) => { masks[z] = mk(w, h); painted[z] = false; });
      drop.hidden = true; canvas.hidden = false;
      $("#photoTools").hidden = false;
      $("#photoStatus").textContent = `${w}×${h} // PAINT ${zone.toUpperCase()}`;
      render();
    }

    input.addEventListener("change", () => load(input.files[0]));
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
    drop.addEventListener("drop", (e) => load(e.dataTransfer.files[0]));

    // tools
    $$("[data-zone]").forEach((b) => b.addEventListener("click", () => {
      zone = b.dataset.zone; erasing = false;
      $$("[data-zone]").forEach((x) => x.classList.toggle("is-on", x === b));
      $("#eraserBtn").classList.remove("is-on");
      $("#photoStatus").textContent = `PAINT ${zone.toUpperCase()}`;
      render();
    }));
    $("#eraserBtn").addEventListener("click", (e) => { erasing = !erasing; e.currentTarget.classList.toggle("is-on", erasing); });
    $("#brushSize").addEventListener("input", (e) => { brush = +e.target.value; });
    $("#strength").addEventListener("input", (e) => { strength = e.target.value / 100; render(); });
    $("#maskBtn").addEventListener("click", (e) => { showMask = !showMask; e.currentTarget.classList.toggle("is-on", showMask); render(); });
    $("#clearZoneBtn").addEventListener("click", () => {
      if (!base) return;
      masks[zone].getContext("2d").clearRect(0, 0, base.width, base.height);
      painted[zone] = false; render();
    });
    const cmp = $("#compareBtn");
    const startCmp = (e) => { e.preventDefault(); comparing = true; render(); };
    const endCmp = () => { if (comparing) { comparing = false; render(); } };
    cmp.addEventListener("pointerdown", startCmp);
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => cmp.addEventListener(ev, endCmp));
    $("#downloadBtn").addEventListener("click", () => {
      const a = document.createElement("a");
      a.download = "cd-consulting-render.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    });
    $("#newPhotoBtn").addEventListener("click", () => { input.value = ""; input.click(); });

    // painting
    const toImg = (e) => {
      const r = canvas.getBoundingClientRect();
      const k = canvas.width / r.width;
      return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k };
    };
    function stroke(a, b) {
      const m = masks[zone].getContext("2d");
      m.save();
      m.globalCompositeOperation = erasing ? "destination-out" : "source-over";
      m.strokeStyle = m.fillStyle = "#fff";
      m.lineCap = m.lineJoin = "round";
      m.lineWidth = brush * b.k;
      m.beginPath(); m.moveTo(a.x, a.y); m.lineTo(b.x, b.y); m.stroke();
      m.beginPath(); m.arc(b.x, b.y, (brush * b.k) / 2, 0, Math.PI * 2); m.fill();
      m.restore();
      if (!erasing) painted[zone] = true;
      render();
    }
    canvas.addEventListener("pointerdown", (e) => {
      if (!base) return;
      drawing = true; canvas.setPointerCapture(e.pointerId);
      last = toImg(e); stroke(last, last);
    });
    canvas.addEventListener("pointermove", (e) => {
      moveCursor(e);
      if (!drawing) return;
      const p = toImg(e); stroke(last, p); last = p;
    });
    ["pointerup", "pointercancel"].forEach((ev) => canvas.addEventListener(ev, () => { drawing = false; }));
    canvas.addEventListener("pointerenter", () => { cursor.hidden = false; });
    canvas.addEventListener("pointerleave", () => { cursor.hidden = true; });
    function moveCursor(e) {
      const sr = stage.getBoundingClientRect();
      cursor.style.left = e.clientX - sr.left + "px";
      cursor.style.top = e.clientY - sr.top + "px";
      cursor.style.width = cursor.style.height = brush + "px";
      cursor.style.borderColor = erasing ? "#ff8a7a" : `rgb(${MASK_TINT[zone]})`;
    }

    const lightness = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    function tint(z, color) {
      const t = tmp.getContext("2d");
      t.globalCompositeOperation = "source-over";
      t.clearRect(0, 0, tmp.width, tmp.height);
      t.fillStyle = color; t.fillRect(0, 0, tmp.width, tmp.height);
      t.globalCompositeOperation = "destination-in";
      t.drawImage(masks[z], 0, 0);

      // hue + saturation from the target color, luminance from the photo
      ctx.globalAlpha = strength;
      ctx.globalCompositeOperation = "color";
      ctx.drawImage(tmp, 0, 0);
      // then push brightness toward the target
      const L = lightness(color);
      if (L < 0.42) {
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = strength * Math.min(1, (0.42 - L) / 0.42 + 0.15);
        ctx.drawImage(tmp, 0, 0);
      } else if (L > 0.6) {
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = strength * ((L - 0.6) / 0.4) * 0.85;
        ctx.drawImage(tmp, 0, 0);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    function draw() {
      queued = false;
      if (!base) return;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.drawImage(base, 0, 0);
      if (comparing) return;
      ZONES.forEach((z) => { if (painted[z]) tint(z, state[z]); });
      if (showMask) {
        ZONES.forEach((z) => {
          if (!painted[z]) return;
          const t = tmp.getContext("2d");
          t.globalCompositeOperation = "source-over";
          t.clearRect(0, 0, tmp.width, tmp.height);
          t.fillStyle = `rgba(${MASK_TINT[z]},${z === zone ? 0.55 : 0.25})`;
          t.fillRect(0, 0, tmp.width, tmp.height);
          t.globalCompositeOperation = "destination-in";
          t.drawImage(masks[z], 0, 0);
          ctx.drawImage(tmp, 0, 0);
        });
      }
    }
    function render() { if (!queued && mode === "photo") { queued = true; requestAnimationFrame(draw); } }

    return {
      render,
      hasImage: () => !!base,
      toBlob: () => new Promise((res) => { draw(); canvas.toBlob(res, "image/jpeg", 0.88); }),
    };
  })();

  renderDemo();
  renderControls();
})();
