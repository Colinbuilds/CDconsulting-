/* Roof price by address: find the house, show it from above to confirm, measure the roof outline
   (county GIS / OpenStreetMap footprint, or Google's roof scan when a key is set on the server),
   then price it per square for each shingle line in ROOF_PRICING, with tax. */
(function () {
  const $ = (s) => document.querySelector(s);
  const form = $("#rqFind");
  if (!form) return;
  const CFG = window.ROOF_PRICING;
  const money = (n) => window.CD.money(n);
  const money2 = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // squares are priced in thirds (3 bundles to a square): 19.67 → "19⅔"
  const sq = (n) => { const w = Math.floor(n + 1e-6), t = Math.round((n - w) * 3); return t === 3 ? `${w + 1}` : `${w || (t ? "" : 0)}${["", "⅓", "⅔"][t]}`; };
  const W = 640, H = 420; // photo size in CSS px (requested at 2×)
  const R = 6378137, MPP0 = 156543.03392804097;

  let place = null;   // { lat, lon, address, imagery }
  let view = null;    // { lat, lon, z } of the photo on screen
  let roof = null;    // measurement from /api/roof (or manual)
  let pick = null;    // chosen product id

  const msg = (t, kind = "") => { const m = $("#rqMsg"); m.textContent = t; m.className = "form-msg mono " + kind; };
  const api = async (path) => {
    const r = await fetch(path, { headers: { Accept: "application/json" } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw Object.assign(new Error(d.error || "Lookup failed"), { status: r.status });
    return d;
  };

  /* ---------- web-mercator helpers for drawing on the photo ---------- */
  const merc = (lat, lon) => [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
  const unmerc = (x, y) => [(2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI, (x / R) * 180 / Math.PI];
  function toPx(lat, lon) {
    const [cx, cy] = merc(view.lat, view.lon), [x, y] = merc(lat, lon), mpp = MPP0 / 2 ** view.z;
    return [W / 2 + (x - cx) / mpp, H / 2 - (y - cy) / mpp];
  }
  function toLatLon(px, py) {
    const [cx, cy] = merc(view.lat, view.lon), mpp = MPP0 / 2 ** view.z;
    return unmerc(cx + (px - W / 2) * mpp, cy - (py - H / 2) * mpp);
  }
  // highest zoom that fits the outline comfortably
  function fit(ring) {
    if (!ring) return 19;
    const xs = ring.map((p) => merc(...p)[0]), ys = ring.map((p) => merc(...p)[1]);
    const span = Math.max((Math.max(...xs) - Math.min(...xs)) / (W * 0.6), (Math.max(...ys) - Math.min(...ys)) / (H * 0.6));
    return Math.max(17, Math.min(20, Math.floor(Math.log2(MPP0 / Math.max(span, 1e-6)))));
  }
  const centroid = (ring) => [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];

  /* ---------- step 1: find + confirm ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("#rqAddr").value.trim();
    if (q.length < 6) return msg("Enter your full street address, city and state.", "err");
    $("#rqGo").disabled = true;
    msg("Finding your house…");
    try {
      place = await api(`/api/geocode?q=${encodeURIComponent(q)}`);
      msg("Measuring the roof outline…");
      await measureAt(place.lat, place.lon, true);
      msg("");
    } catch (err) {
      msg(err.status === 404 ? "I couldn't find that address. Check the spelling and include the city and state." : err.message, "err");
    } finally {
      $("#rqGo").disabled = false;
    }
  });

  async function measureAt(lat, lon, recenter) {
    try { roof = await api(`/api/roof?lat=${lat}&lon=${lon}${recenter ? "" : "&tap=1"}`); }
    catch (err) { if (err.status !== 404) throw err; roof = null; }
    if (recenter || !view) {
      const c = roof?.outline ? centroid(roof.outline) : [lat, lon];
      view = { lat: c[0], lon: c[1], z: fit(roof?.outline) };
      loadPhotos();
    }
    draw(lat, lon);
    showConfirm();
  }

  function loadPhotos() {
    const img = $("#rqImg");
    $("#rqMap").classList.add("is-loading");
    img.onload = () => $("#rqMap").classList.remove("is-loading");
    img.onerror = () => { $("#rqMap").classList.remove("is-loading"); $("#rqMapErr").hidden = false; };
    $("#rqMapErr").hidden = true;
    img.src = `/api/aerial?lat=${view.lat.toFixed(7)}&lon=${view.lon.toFixed(7)}&z=${view.z}&w=${W}&h=${H}`;
    $("#rqCredit").textContent = place.imagery === "google" ? "Imagery © Google" : "Imagery: Esri, Vantor, Earthstar Geographics";
    const sv = $("#rqStreet");
    $("#rqStreetFig").hidden = true;
    if (place.imagery === "google") {
      sv.onload = () => { $("#rqStreetFig").hidden = false; };
      sv.src = `/api/street?lat=${view.lat.toFixed(7)}&lon=${view.lon.toFixed(7)}`;
    }
    const a = place.address;
    $("#rqEarth").href = `https://earth.google.com/web/search/${encodeURIComponent(a)}`;
    $("#rqZillow").href = `https://www.zillow.com/homes/${encodeURIComponent(a.replace(/,/g, "").replace(/\s+/g, "-"))}_rb/`;
    $("#rqSV").href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${view.lat},${view.lon}`;
  }

  function draw(lat, lon) {
    const svg = $("#rqSvg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    if (roof?.outline) {
      const pts = roof.outline.map((p) => toPx(...p).map((v) => v.toFixed(1)).join(",")).join(" ");
      svg.innerHTML = `<polygon points="${pts}" class="rq-outline${roof.box ? " is-box" : ""}"/>`;
    } else {
      const [x, y] = toPx(lat, lon);
      svg.innerHTML = `<circle cx="${x}" cy="${y}" r="9" class="rq-dot"/>`;
    }
  }

  function showConfirm() {
    $("#rqConfirm").hidden = false;
    $("#rqFound").textContent = place.address;
    $("#rqNoRoof").hidden = !!roof;
    $("#rqYes").hidden = !roof;
    $("#rqConfirm").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("#rqYes").addEventListener("click", () => startQuote());
  $("#rqNo").addEventListener("click", () => {
    $("#rqMap").classList.add("is-tapping");
    $("#rqTapHint").hidden = false;
  });
  $("#rqMap").addEventListener("click", async (e) => {
    if (!view || !$("#rqMap").classList.contains("is-tapping") && roof) return;
    const box = e.currentTarget.getBoundingClientRect();
    const [lat, lon] = toLatLon(((e.clientX - box.left) / box.width) * W, ((e.clientY - box.top) / box.height) * H);
    $("#rqMap").classList.remove("is-tapping");
    $("#rqTapHint").hidden = true;
    msg("Measuring that roof…");
    try { await measureAt(lat, lon, false); msg(""); }
    catch (err) { msg(err.message, "err"); }
  });
  $("#rqManualBtn").addEventListener("click", () => {
    roof = { source: "Entered by homeowner", footprintSqFt: 0, perimeterFt: 0, manual: true };
    startQuote();
    $("#rqFoot").focus();
  });

  /* ---------- step 2: measure + price ---------- */
  const pitchSel = $("#rqPitch");
  pitchSel.innerHTML = CFG.pitches.map((p) => `<option value="${p}">${p}/12${p >= 6 && p <= 9 ? "" : ""}</option>`).join("");

  function startQuote() {
    const solar = roof.planSqFt != null;
    $("#rqFoot").value = solar ? roof.planSqFt : roof.footprintSqFt || "";
    $("#rqFootLabel").textContent = solar ? "Roof plan area (from roof scan)" : "Footprint (sq ft)";
    const measured = roof.pitch && CFG.pitches.reduce((a, b) => (Math.abs(b - roof.pitch) < Math.abs(a - roof.pitch) ? b : a));
    pitchSel.value = measured || CFG.defaultPitch;
    $("#rqPitchNote").textContent = measured ? `Measured about ${roof.pitch}/12` : "Most roofs are 6/12 to 9/12";
    $("#rqSource").textContent = sourceNote();
    $("#rqQuote").hidden = false;
    if (!pick) pick = CFG.products[0].id;
    calc();
    $("#rqQuote").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function sourceNote() {
    if (roof.manual) return "Footprint entered by hand. I'll confirm the measurement on site.";
    const extra = roof.planSqFt != null ? ` (${roof.facets} roof planes${roof.imageryDate ? `, imagery ${roof.imageryDate}` : ""})` : "";
    return `Measured from: ${roof.source}${extra}. Final measurements are confirmed on inspection.`;
  }

  function numbers() {
    const solar = roof.planSqFt != null;
    const foot = Math.max(0, +$("#rqFoot").value || 0);
    const o = CFG.overhangFt, edited = !solar && foot !== roof.footprintSqFt;
    // overhang: add a strip around the measured outline (perimeter scaled if the homeowner changed the size)
    const per = roof.perimeterFt ? roof.perimeterFt * (edited && roof.footprintSqFt ? Math.sqrt(foot / roof.footprintSqFt) : 1) : 4 * Math.sqrt(foot) * 1.15;
    const plan = solar ? foot : foot + per * o + 4 * o * o;
    const p = +pitchSel.value, factor = Math.sqrt(1 + (p / 12) ** 2);
    const surface = plan * factor;
    const squares = Math.ceil(((surface * (1 + CFG.waste)) / 100) * 3) / 3; // shingles come 3 bundles to a square
    return { foot, plan, p, factor, surface, squares };
  }

  function calc() {
    const n = numbers();
    $("#rqPlan").textContent = n.plan ? `${Math.round(n.plan).toLocaleString()} sq ft` : "—";
    $("#rqFactor").textContent = `× ${n.factor.toFixed(3)}`;
    $("#rqArea").textContent = n.surface ? `${Math.round(n.surface).toLocaleString()} sq ft` : "—";
    $("#rqSq").textContent = n.squares ? `${sq(n.squares)} squares` : "—";
    $("#rqPlanLabel").textContent = roof.planSqFt != null ? "Roof plan" : `With ${CFG.overhangFt} ft overhang`;
    $("#rqWasteLabel").textContent = `+ ${Math.round(CFG.waste * 100)}% waste`;

    $("#rqProducts").innerHTML = CFG.products.map((pr) => {
      const sub = n.squares * pr.perSquare, total = sub * (1 + CFG.taxRate);
      return `<button type="button" class="rq-product${pr.id === pick ? " is-on" : ""}" data-id="${pr.id}" aria-pressed="${pr.id === pick}">
        <span class="rq-brand">${pr.brand}</span>
        <b>${pr.name}</b>
        <span class="rq-rate">${money(pr.perSquare)} / square</span>
        <span class="rq-price">${n.squares ? money(total) : "—"}</span>
        <small>with ${CFG.taxLabel.toLowerCase()}</small>
      </button>`;
    }).join("");

    const pr = CFG.products.find((x) => x.id === pick);
    const sub = n.squares * pr.perSquare, tax = sub * CFG.taxRate, total = sub + tax;
    $("#rqTotal").innerHTML = n.squares ? `
      <p class="label">${pr.brand} ${pr.name}</p>
      <p class="rq-note">${pr.note}</p>
      <dl>
        <div><dt>${sq(n.squares)} squares × ${money(pr.perSquare)}</dt><dd>${money2(sub)}</dd></div>
        <div><dt>${CFG.taxLabel} (${(CFG.taxRate * 100).toFixed(CFG.taxRate * 100 % 1 ? 2 : 0)}%)</dt><dd>${money2(tax)}</dd></div>
        <div class="rq-grand"><dt>Total</dt><dd>${money2(total)}</dd></div>
      </dl>
      <button type="button" class="btn btn-blue btn-block" id="rqSend">Send me this quote &amp; book an inspection</button>
      <p class="fine">Installed price for a standard tear-off and replacement. Rotten decking, extra layers, very steep or complex roofs and code items are confirmed on inspection.</p>`
      : `<p class="rq-note">Enter the footprint to see pricing.</p>`;
    $("#rqSend")?.addEventListener("click", () => send(n, pr, sub, tax, total));
  }
  $("#rqProducts").addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]");
    if (!b) return;
    pick = b.dataset.id;
    calc();
  });
  $("#rqFoot").addEventListener("input", calc);
  pitchSel.addEventListener("change", calc);

  function send(n, pr, sub, tax, total) {
    const lines = [
      `${pr.brand} ${pr.name}: ${money2(total)} incl. ${CFG.taxLabel.toLowerCase()} (${sq(n.squares)} sq × ${money(pr.perSquare)} = ${money2(sub)} + ${money2(tax)})`,
      `Address: ${place.address}`,
      `Roof: ${Math.round(n.foot)} sq ft ${roof.planSqFt != null ? "plan" : "footprint"}, ${n.p}/12 pitch, ${Math.round(n.surface)} sq ft surface, +${Math.round(CFG.waste * 100)}% waste`,
      `Source: ${roof.source}${roof.manual ? "" : ` · map: https://www.google.com/maps/@${view.lat.toFixed(6)},${view.lon.toFixed(6)},40m/data=!3m1!1e3`}`,
    ];
    window.CD.attach("roofQuote", lines.join(" | "));
    window.CD.attach("address", place.address);
    const list = window.CD.attachments.interests || [];
    if (!list.includes("Roof")) window.CD.attach("interests", [...list, "Roof"]);
    window.CD.goTo("contact");
  }
})();
