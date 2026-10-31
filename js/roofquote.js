/* Roof price by address: the address opens a movable aerial map, the homeowner clicks their house,
   the county GIS outline of that building is loaded as a polygon they can trace and adjust, and the
   traced footprint is priced per square for each shingle line in ROOF_PRICING (7/12 pitch, 8% waste), with tax. */
(function () {
  const $ = (s) => document.querySelector(s);
  const form = $("#rqFind");
  if (!form) return;
  const CFG = window.ROOF_PRICING;
  const money = (n) => window.CD.money(n);
  const money2 = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // squares are priced in thirds (3 bundles to a square): 19.67 → "19⅔"
  const sq = (n) => { const w = Math.floor(n + 1e-6), t = Math.round((n - w) * 3); return t === 3 ? `${w + 1}` : `${w || (t ? "" : 0)}${["", "⅓", "⅔"][t]}`; };
  const R = 6378137;

  let place = null;   // { lat, lon, address, imagery }
  let roof = null;    // measurement from /api/roof (or manual)
  let pick = null;    // chosen product id

  const msg = (t, kind = "") => { const m = $("#rqMsg"); m.textContent = t; m.className = "form-msg mono " + kind; };
  const api = async (path) => {
    const r = await fetch(path, { headers: { Accept: "application/json" } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw Object.assign(new Error(d.error || "Lookup failed"), { status: r.status });
    return d;
  };

  /* ---------- search window: narrates each lookup as it happens ---------- */
  const logEl = $("#rqLog"), logList = $("#rqLogList");
  let logQueue = Promise.resolve();
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const ICON = { run: "", ok: "✓", miss: "–", info: "i", err: "!" };
  const log = {
    reset(title) {
      logQueue = Promise.resolve();
      logList.innerHTML = "";
      $("#rqLogTitle").textContent = title;
      logEl.hidden = false;
      logEl.classList.add("is-busy");
    },
    // steps are real; they're paced a little so each one can be read
    add(text, state) {
      logQueue = logQueue.then(async () => {
        const open = logList.querySelector("li.is-run:last-child");
        if (open && state !== "run" && state !== "info") {
          open.className = "is-" + state;
          open.querySelector("i").textContent = ICON[state];
          open.insertAdjacentHTML("beforeend", `<small>${esc(text)}</small>`);
        } else {
          if (open) { open.className = "is-ok"; open.querySelector("i").textContent = ICON.ok; }
          logList.insertAdjacentHTML("beforeend", `<li class="is-${state}"><i>${ICON[state]}</i><span>${esc(text)}</span></li>`);
        }
        logList.scrollTop = logList.scrollHeight;
        await pause(state === "run" ? 260 : 160);
      });
      return logQueue;
    },
    done(title) { return (logQueue = logQueue.then(() => { logEl.classList.remove("is-busy"); if (title) $("#rqLogTitle").textContent = title; })); },
  };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // /api/roof streams one JSON object per line: progress steps, then the result
  async function streamRoof(path) {
    const r = await fetch(path, { headers: { Accept: "application/x-ndjson" } });
    if (!r.ok || !r.body) throw Object.assign(new Error("Lookup failed"), { status: r.status });
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "", last = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        const o = JSON.parse(line);
        if (o.step) log.add(o.step, o.state); else last = o;
      }
    }
    if (!last?.ok) throw Object.assign(new Error(last?.error || "Lookup failed"), { status: last?.status || 502 });
    return last;
  }

  /* ---------- geometry ---------- */
  // ring of L.LatLng → area (sq ft) and perimeter (ft), on a local flat projection (fine at house scale)
  function measure(pts) {
    if (pts.length < 3) return { area: 0, perimeter: 0 };
    const lat0 = (pts.reduce((s, p) => s + p.lat, 0) / pts.length) * Math.PI / 180;
    const xy = pts.map((p) => [R * p.lng * Math.PI / 180 * Math.cos(lat0), R * p.lat * Math.PI / 180]);
    let a = 0, per = 0;
    for (let i = 0; i < xy.length; i++) {
      const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % xy.length];
      a += x1 * y2 - x2 * y1;
      per += Math.hypot(x2 - x1, y2 - y1);
    }
    return { area: Math.abs(a) / 2 * 10.7639, perimeter: per * 3.28084 };
  }
  const feet = (a, b) => a.distanceTo(b) * 3.28084;

  /* ---------- step 1: find the address, then the homeowner marks the house on a movable map ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("#rqAddr").value.trim();
    if (q.length < 6) return msg("Enter your full street address, city and state.", "err");
    $("#rqGo").disabled = true;
    msg("");
    log.reset("Pulling up your property");
    try {
      log.add(`Looking up “${q}”…`, "run");
      place = await api(`/api/geocode?q=${encodeURIComponent(q)}`);
      log.add(`${place.address}${place.county ? ` · ${place.county}` : ""}`, "ok");
      log.add("Loading the county map…", "run");
      openMap();
      await log.done("Click your house on the map");
    } catch (err) {
      log.add(err.status === 404 ? "Address not found" : "Lookup failed", "err");
      log.done("Search stopped");
      msg(err.status === 404 ? "I couldn't find that address. Check the spelling and include the city and state." : err.message, "err");
    } finally {
      $("#rqGo").disabled = false;
    }
  });

  let map = null, houseMark = null, stage = "mark";
  const shape = { pts: [], closed: false, layer: null, handles: L.layerGroup(), from: null };

  function openMap() {
    $("#rqConfirm").hidden = false;
    $("#rqFound").textContent = place.address;
    if (!map) {
      map = L.map("rqMap", { zoomControl: true, maxZoom: 21, tap: true, doubleClickZoom: false });
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxNativeZoom: 19, maxZoom: 21, attribution: "Imagery: Esri, Vantor, Earthstar Geographics",
      }).on("load", () => log.add("Aerial map ready", "ok")).addTo(map);
      // street names on top of the photo
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", { maxNativeZoom: 19, maxZoom: 21, opacity: 0.8 }).addTo(map);
      shape.handles.addTo(map);
      map.on("click", onMapClick);
    }
    map.setView([place.lat, place.lon], 19);
    setTimeout(() => map.invalidateSize(), 50);
    restart();
    const a = place.address;
    $("#rqEarth").href = `https://earth.google.com/web/search/${encodeURIComponent(a)}`;
    $("#rqZillow").href = `https://www.zillow.com/homes/${encodeURIComponent(a.replace(/,/g, "").replace(/\s+/g, "-"))}_rb/`;
    $("#rqSV").href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${place.lat},${place.lon}`;
    $("#rqStreetFig").hidden = true;
    if (place.imagery === "google") {
      const sv = $("#rqStreet");
      sv.onload = () => { $("#rqStreetFig").hidden = false; };
      sv.src = `/api/street?lat=${place.lat.toFixed(7)}&lon=${place.lon.toFixed(7)}`;
    }
    $("#rqConfirm").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setStage(s) {
    stage = s;
    $("#rqStep1").className = s === "mark" ? "is-on" : "is-done";
    $("#rqStep2").className = s === "mark" ? "" : "is-on";
    $("#rqTools").hidden = s === "mark";
    $("#rqUndo").hidden = s !== "draw";
    $("#rqRedraw").hidden = s !== "draw";
    $("#rqTools").hidden = s === "mark" || s === "lookup" || s === "tracing";
    $("#rqMap").classList.toggle("is-marking", s === "mark" || s === "draw");
    read();
  }

  function restart() {
    if (houseMark) { houseMark.remove(); houseMark = null; }
    clearShape();
    setStage("mark");
  }

  async function onMapClick(e) {
    if (stage === "mark") {
      // the homeowner's click marks the house; look up the building right under it
      houseMark = L.marker(e.latlng, { icon: L.divIcon({ className: "rq-house", html: "<span></span>", iconSize: [30, 30], iconAnchor: [15, 30] }) }).addTo(map);
      setStage("lookup");
      log.reset("Finding the building you marked");
      try {
        roof = await streamRoof(`/api/roof?lat=${e.latlng.lat}&lon=${e.latlng.lng}&tap=1`);
      } catch (err) {
        if (err.status !== 404) log.add(err.message, "err");
        roof = null;
      }
      if (roof?.outline && !roof.box) {
        const pts = roof.outline.map(([la, lo]) => L.latLng(la, lo));
        if (pts.length > 1 && pts[0].equals(pts[pts.length - 1])) pts.pop();
        map.fitBounds(L.latLngBounds(pts), { padding: innerWidth < 640 ? [36, 36] : [70, 70], maxZoom: 21, animate: false });
        log.add("Tracing the roof outline…", "run");
        await autoTrace(pts);
        log.add(`Traced ${pts.length} corners`, "ok");
        await log.done("Your roof is traced");
        loadShape(pts, roof.source);
      } else {
        await log.done("No outline on record here");
        clearShape();
        setStage("draw");
      }
    } else if (stage === "draw") {
      shape.pts.push(e.latlng);
      redraw();
    }
  }

  /* ---------- step 2: the cursor traces the roof on its own ---------- */
  // a pointer glides corner to corner, drawing the outline and its edge lengths as it goes
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function autoTrace(pts) {
    clearShape();
    setStage("tracing");
    const cursor = L.marker(pts[0], { interactive: false, zIndexOffset: 1000, icon: L.divIcon({ className: "rq-cursor", iconSize: [26, 26], iconAnchor: [3, 2],
      html: '<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M3 2 21 13l-8 1.6L9.5 23z"/></svg><span>Tracing</span>' }) }).addTo(map);
    const line = L.polyline([pts[0]], { className: "rq-poly is-open is-tracing" }).addTo(map);
    const dots = L.layerGroup().addTo(map);
    const dot = (p) => dots.addLayer(L.marker(p, { interactive: false, icon: L.divIcon({ className: "rq-v is-new", iconSize: [14, 14] }) }));
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    dot(pts[0]);
    await wait(reduce ? 0 : 350);
    const total = pts.reduce((s, p, i) => s + feet(p, pts[(i + 1) % pts.length]), 0);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      // whole trace takes about 3-4 s; every edge gets at least a short glide
      const ms = reduce ? 0 : Math.max(140, (feet(a, b) / total) * 3200);
      const t0 = performance.now();
      const done = line.getLatLngs().slice();
      await new Promise((res) => {
        const step = (now) => {
          const k = ms ? Math.min(1, (now - t0) / ms) : 1, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
          const p = L.latLng(a.lat + (b.lat - a.lat) * e, a.lng + (b.lng - a.lng) * e);
          cursor.setLatLng(p);
          line.setLatLngs([...done, p]);
          if (k < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
      const len = Math.round(feet(a, b));
      if (len >= 8) dots.addLayer(L.marker(L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2), { interactive: false, icon: L.divIcon({ className: "rq-len is-new", html: `<span>${len} ft</span>`, iconSize: null }) }));
      if (i < pts.length - 1) dot(b);
    }
    cursor.getElement()?.classList.add("is-done");
    await wait(reduce ? 0 : 600);
    cursor.remove(); line.remove(); dots.remove();
  }

  /* ---------- the traced outline: corners can still be nudged if one is off ---------- */
  function clearShape() {
    shape.pts = []; shape.closed = false; shape.from = null;
    if (shape.layer) { shape.layer.remove(); shape.layer = null; }
    shape.handles.clearLayers();
  }
  function loadShape(pts, from) {
    clearShape();
    // county rings repeat the first corner at the end
    if (pts.length > 1 && pts[0].equals(pts[pts.length - 1])) pts.pop();
    shape.pts = pts; shape.closed = true; shape.from = from;
    setStage("edit");
    redraw();
  }

  function redraw() {
    const { pts, closed } = shape;
    if (shape.layer) shape.layer.remove();
    shape.layer = (closed ? L.polygon(pts, { className: "rq-poly" }) : L.polyline(pts, { className: "rq-poly is-open" })).addTo(map);
    shape.handles.clearLayers();
    const n = pts.length;
    // edge lengths: drag one to add a corner there
    const edges = closed ? n : n - 1;
    for (let i = 0; i < edges; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const mid = L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
      const len = Math.round(feet(a, b));
      // short jogs get a small dot instead of a label so they don't crowd the corners
      const m = L.marker(mid, { draggable: closed, icon: L.divIcon({ className: "rq-len", html: len < 8 ? "<i></i>" : `<span>${len} ft</span>`, iconSize: null }) });
      if (closed) {
        let at = -1;
        m.on("dragstart", () => { at = i + 1; pts.splice(at, 0, m.getLatLng()); });
        m.on("drag", () => { pts[at] = m.getLatLng(); shape.layer.setLatLngs(pts); read(); });
        m.on("dragend", () => { shape.from = null; redraw(); });
      }
      shape.handles.addLayer(m);
    }
    pts.forEach((p, i) => {
      const v = L.marker(p, { draggable: true, icon: L.divIcon({ className: "rq-v" + (i === 0 && !closed ? " is-first" : ""), iconSize: [18, 18] }) });
      v.on("drag", () => { pts[i] = v.getLatLng(); shape.layer.setLatLngs(pts); read(); });
      v.on("dragend", () => { shape.from = null; redraw(); });
      v.on("click", () => {
        // clicking the first corner closes the outline
        if (!closed && i === 0 && n >= 3) { shape.closed = true; setStage("edit"); redraw(); }
      });
      v.on("contextmenu", (ev) => {
        L.DomEvent.preventDefault(ev.originalEvent);
        if (n > 3 || !closed) { pts.splice(i, 1); shape.from = null; redraw(); }
      });
      shape.handles.addLayer(v);
    });
    read();
  }

  function read() {
    const m = measure(shape.pts);
    const ready = shape.closed && shape.pts.length >= 3;
    $("#rqUse").disabled = !ready;
    $("#rqRead").innerHTML =
      stage === "mark" ? "Click on your house" :
      stage === "lookup" ? "Looking up the building…" :
      stage === "tracing" ? "Tracing your roof…" :
      !ready ? `Click each corner of your roof · ${shape.pts.length} placed${shape.pts.length >= 3 ? " · click the first corner to finish" : ""}` :
      `<b>${Math.round(m.area).toLocaleString()} sq ft</b> footprint · ${Math.round(m.perimeter)} ft around`;
    $("#rqStep2Text").textContent =
      stage === "draw" ? "This building isn't in the county records, so click each corner of your roof, then the first corner to close it. Or enter the size by hand."
      : stage === "edit" ? "Done. Your roof was traced from county building records. If a corner looks off, drag it."
      : "Your roof is traced automatically from county building records.";
  }

  $("#rqRedraw").addEventListener("click", () => { clearShape(); setStage("draw"); });
  $("#rqUndo").addEventListener("click", () => { shape.pts.pop(); redraw(); });
  $("#rqRestart").addEventListener("click", restart);
  $("#rqUse").addEventListener("click", () => {
    const m = measure(shape.pts);
    const traced = shape.from == null;
    roof = {
      source: traced ? (roof?.source ? `Traced on the aerial map (started from ${roof.source})` : "Traced on the aerial map") : roof.source,
      footprintSqFt: Math.round(m.area), perimeterFt: Math.round(m.perimeter),
      outline: shape.pts.map((p) => [p.lat, p.lng]),
    };
    $("#rqStep2").className = "is-done";
    $("#rqStep3").className = "is-on";
    startQuote();
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
      `Source: ${roof.source}${roof.outline ? ` · map: https://www.google.com/maps/@${roof.outline[0][0].toFixed(6)},${roof.outline[0][1].toFixed(6)},40m/data=!3m1!1e3` : ""}`,
      ...(roof.outline ? [`Outline (lat,lon): ${roof.outline.map((p) => p.map((v) => v.toFixed(6)).join(",")).join(" ")}`] : []),
    ];
    window.CD.attach("roofQuote", lines.join(" | "));
    window.CD.attach("address", place.address);
    const list = window.CD.attachments.interests || [];
    if (!list.includes("Roof")) window.CD.attach("interests", [...list, "Roof"]);
    window.CD.goTo("contact");
  }
})();
