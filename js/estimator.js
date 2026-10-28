/* CD Consulting — ballpark estimator
   Prices are installed ranges (materials + labor) for an average US market.
   Tune them here to match your area and suppliers. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = (n) => window.CD.money(n);

  const ITEMS = [
    { id: "roof", name: "Roof Replacement", unit: "squares", unitLabel: "PER SQUARE (100 SQ FT)", on: true, heightSensitive: true,
      tiers: [["Architectural shingle", 450, 650], ["Designer shingle", 650, 950], ["Standing seam metal", 1000, 1600], ["Slate / synthetic slate", 1200, 2100]],
      auto: (h) => Math.round((h.footprint * 1.12 * h.pitchFactor * 1.1) / 100) },
    { id: "siding", name: "Siding", unit: "sq ft", unitLabel: "PER SQ FT OF WALL", heightSensitive: true,
      tiers: [["Vinyl", 6, 10], ["Engineered wood", 9, 14], ["Fiber cement", 10, 16], ["Steel / metal panel", 12, 20], ["Stone veneer", 28, 48]],
      auto: (h) => Math.round((h.perimeter * 9.5 * h.stories * 0.82 * 1.1) / 10) * 10 },
    { id: "windows", name: "Windows", unit: "windows", unitLabel: "PER WINDOW, INSTALLED", heightSensitive: true,
      tiers: [["Vinyl", 650, 1100], ["Fiberglass", 1000, 1700], ["Wood-clad", 1300, 2300], ["Black-frame aluminum", 1700, 3200]],
      auto: (h) => Math.max(6, Math.min(60, Math.round((h.footprint * h.stories) / 150))) },
    { id: "gutters", name: "Gutters", unit: "lin ft", unitLabel: "PER LINEAR FOOT", heightSensitive: true,
      tiers: [["5\" seamless aluminum", 9, 15], ["6\" oversized aluminum", 12, 20], ["Aluminum + leaf guards", 18, 30], ["Copper half-round", 30, 48]],
      auto: (h) => Math.round(h.perimeter * 1.05) },
    { id: "door", name: "Entry Door", unit: "doors", unitLabel: "PER DOOR, INSTALLED",
      tiers: [["Fiberglass", 2500, 4500], ["Steel", 2000, 4000], ["Custom wood", 6000, 12000], ["Modern pivot", 9000, 20000]],
      auto: () => 1 },
    { id: "garage", name: "Garage Door", unit: "doors", unitLabel: "PER DOOR (2-CAR)",
      tiers: [["Insulated steel", 2500, 4500], ["Carriage style", 4000, 7500], ["Modern glass / aluminum", 6000, 12000]],
      auto: () => 1 },
    { id: "deck", name: "Deck", unit: "sq ft", unitLabel: "PER SQ FT",
      tiers: [["Pressure treated", 35, 55], ["Composite", 55, 85], ["Premium PVC", 70, 110]],
      auto: () => 300 },
    { id: "addition", name: "Addition", unit: "sq ft", unitLabel: "PER SQ FT, FINISHED",
      tiers: [["Basic / bump-out", 250, 380], ["Mid-range finish", 350, 500], ["Luxury finish", 480, 700]],
      auto: () => 400 },
  ];

  const host = $("#estItems");
  const manual = {};

  ITEMS.forEach((it) => {
    const el = document.createElement("div");
    el.className = "est-item" + (it.on ? " is-on" : "");
    el.dataset.id = it.id;
    el.innerHTML = `
      <label class="est-item-head">
        <input type="checkbox" ${it.on ? "checked" : ""} aria-label="Include ${it.name}">
        <span class="tog"></span>
        <h4>${it.name}</h4>
        <span class="unit">${it.unitLabel}</span>
      </label>
      <div class="est-item-body">
        <label class="field"><span class="mono">MATERIAL</span>
          <select data-k="tier">${it.tiers.map((t, i) => `<option value="${i}">${t[0]}</option>`).join("")}</select>
        </label>
        <label class="field"><span class="mono">${it.unit.toUpperCase()} <i class="auto">AUTO</i></span>
          <input type="number" data-k="qty" min="0" step="1" inputmode="numeric">
        </label>
      </div>`;
    host.appendChild(el);
    const cb = $("input[type=checkbox]", el);
    cb.addEventListener("change", () => { el.classList.toggle("is-on", cb.checked); calc(); });
    $("[data-k=tier]", el).addEventListener("change", calc);
    const qty = $("[data-k=qty]", el);
    qty.addEventListener("input", () => {
      manual[it.id] = qty.value !== "";
      $(".auto", el).hidden = manual[it.id];
      calc();
    });
  });

  const house = () => {
    const footprint = Math.max(300, +$("#footprint").value || 1600);
    const stories = +$("#stories").value;
    const pitchFactor = { low: 1.06, med: 1.18, steep: 1.42 }[$("#pitch").value];
    const w = Math.sqrt(footprint / 1.5);
    const perimeter = 2 * (w + 1.5 * w) * 1.1;
    return { footprint, stories, pitchFactor, perimeter, market: +$("#market").value };
  };

  ["#footprint", "#stories", "#pitch", "#market"].forEach((s) => $(s).addEventListener("input", calc));

  let lastSummary = "";
  function calc() {
    const h = house();
    const heightK = { 1: 1, 2: 1.06, 3: 1.14 }[h.stories];
    let lo = 0, hi = 0;
    const lines = [];
    ITEMS.forEach((it) => {
      const el = $(`.est-item[data-id="${it.id}"]`);
      const qtyEl = $("[data-k=qty]", el);
      if (!manual[it.id]) qtyEl.value = it.auto(h);
      if (!$("input[type=checkbox]", el).checked) return;
      const q = Math.max(0, +qtyEl.value || 0);
      const [label, a, b] = it.tiers[+$("[data-k=tier]", el).value];
      const k = h.market * (it.heightSensitive ? heightK : 1);
      const l = q * a * k, u = q * b * k;
      lo += l; hi += u;
      lines.push({ name: it.name, label, q, unit: it.unit, l, u });
    });
    lo = Math.round(lo / 100) * 100;
    hi = Math.round(hi / 100) * 100;

    animateTo($("#estLow"), lo);
    animateTo($("#estHigh"), hi);
    const scale = Math.max(hi * 1.2, 1);
    $("#estBar").style.left = (lo / scale) * 100 + "%";
    $("#estBar").style.width = ((hi - lo) / scale) * 100 + "%";

    const ul = $("#estBreakdown");
    ul.innerHTML = lines.length
      ? lines.map((x) => `<li><span>${x.name} · ${x.label}</span><span>${money(x.l)}–${money(x.u)}</span></li>`).join("")
      : `<li class="empty">Select at least one job →</li>`;

    window.CD.estimate = lines.length ? { lo, hi } : null;
    lastSummary = lines.length
      ? `${money(lo)} – ${money(hi)} | ` + lines.map((x) => `${x.name}: ${x.label}, ${x.q} ${x.unit}`).join("; ") +
        ` | ${h.footprint} sq ft footprint, ${h.stories} story, ${$("#pitch").selectedOptions[0].text} pitch`
      : "";
  }

  const shown = new WeakMap();
  function animateTo(el, target) {
    const from = shown.get(el) || 0;
    shown.set(el, target);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = money(target); return; }
    const t0 = performance.now(), dur = 500;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = money(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  $("#sendEstimate").addEventListener("click", () => {
    if (lastSummary) window.CD.attach("estimate", lastSummary);
    window.CD.goTo("contact");
  });

  // "Price this" from the visualizer: switch on the matching jobs and materials
  document.addEventListener("cd:estimate-prefill", (e) => {
    const d = e.detail;
    const pick = {
      roof: d.roof.type === "metal" ? 2 : 0,
      siding: d.siding.line === "hardie" ? 2 : d.siding.line === "cedar" ? 1 : 0,
      windows: d.windows.color === "Black" ? 3 : 1,
      gutters: d.gutters.name === "Copper" ? 3 : 0,
      door: d.door.style === "modern" ? 3 : 0,
    };
    ITEMS.forEach((it) => {
      const el = $(`.est-item[data-id="${it.id}"]`);
      const on = it.id in pick;
      $("input[type=checkbox]", el).checked = on;
      el.classList.toggle("is-on", on);
      if (on) $("[data-k=tier]", el).value = pick[it.id];
    });
    calc();
  });

  calc();
})();
