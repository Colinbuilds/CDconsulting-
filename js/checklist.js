/* Homeowner checklist: get the house ready so nothing gets broken, then keep it protected.
   Ticks are saved in this browser (localStorage) so people can work through it over a few days. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const root = $("#checklist");
  if (!root) return;

  const LISTS = [
    { id: "prep", title: "Before install day", sub: "Do these in the week before the crew shows up.", groups: [
      { trade: "all", name: "Every job", items: [
        ["Move cars out of the garage and driveway the night before.", "Trucks, the dumpster and falling debris need the space, and a blocked-in car is stuck until the end of the day."],
        ["Move patio furniture, grills, planters and toys at least 15 ft from the house.", "Anything near the walls is in the drop zone for old materials."],
        ["Mark sprinkler heads, septic lids, dog-fence lines and low-voltage lights.", "Flags keep the dumpster, ladders and wheelbarrows off them."],
        ["Take photos of the driveway, lawn, landscaping and walls.", "A dated record of how things looked before, for everyone's protection."],
        ["Ask for plywood under the dumpster or trailer.", "It spreads the load so it doesn't crack or rut your driveway."],
        ["Unlock gates and clear a path to every side of the house.", "Crews need to reach every wall and an exterior outlet."],
        ["Keep pets and kids inside or away from the work area.", "Ladders, nail guns and falling debris. Dogs also get stressed by the noise."],
        ["Give the neighbors a heads-up.", "Noise starts early, and their cars may be close to the drop zone."],
      ] },
      { trade: "roofing", name: "Roofing", items: [
        ["Cover stored items in the attic with old sheets or tarps.", "Tear-off shakes dust, granules and the odd nail tip through the decking."],
        ["Take down wall hangings, mirrors and shelves on top-floor walls.", "Hammering and nail guns vibrate through the framing and can knock them off."],
        ["Check that chandeliers and ceiling fixtures upstairs are secure.", "Same vibration, overhead."],
        ["Decide who removes and reinstalls the satellite dish, antenna or solar panels.", "Solar usually needs its own installer. Book it early."],
        ["Cover the pool, hot tub and AC condenser.", "Granules and nails end up in filters and fan fins."],
        ["Trim branches hanging over the roof.", "Crews need clear access, and it keeps new shingles from being scraped."],
      ] },
      { trade: "siding", name: "Siding", items: [
        ["Take down pictures, mirrors and shelves on the inside of exterior walls.", "Removing old siding and nailing new siding shakes those walls hardest."],
        ["Remove shutters, hose reels, mailbox, house numbers and lights you want to keep.", "Or tag them so the crew knows to save and reinstall them."],
        ["Pull window AC units.", "Siding and trim can't be finished around them."],
        ["Trim bushes and trees back 2 ft from the walls.", "Room for ladders and staging without breaking plants."],
        ["Point out delicate plants and garden beds.", "They get covered or tied back before work starts."],
      ] },
      { trade: "windows", name: "Windows", items: [
        ["Clear 3 ft inside every window being replaced.", "Furniture, plants and anything on the sill."],
        ["Take down blinds, curtains and rods.", "Brackets often sit in the trim being removed."],
        ["Call your alarm company about window sensors.", "Sensors need to be removed and reinstalled or replaced."],
        ["Cover nearby furniture and electronics with sheets.", "Cutting out old windows and caulk makes fine dust."],
        ["Plan where the kids and pets go while openings are open.", "Each opening is open to the outside for a short time."],
      ] },
      { trade: "gutters", name: "Gutters", items: [
        ["Clear the area under every eave.", "Old gutters come down in long sections."],
        ["Move rain barrels and splash blocks.", "Downspouts may move to better spots."],
        ["Mark underground drain pipes where downspouts tie in.", "So new downspouts reconnect to them instead of dumping at the wall."],
        ["Take down hanging baskets, string lights and holiday clips on the fascia.", "They're in the way of hangers and seams."],
      ] },
    ] },
    { id: "during", title: "While the crew is there", sub: "Small things that prevent big problems.", groups: [
      { trade: "all", name: "Every job", items: [
        ["Use another door if one is under the work area.", "Debris falls fastest at the eaves and over entries."],
        ["Leave a working outlet and a bathroom plan with your project manager.", "Saves cords run through windows and awkward knocks."],
        ["Walk the job with your project manager at the end of each day if you can.", "Questions get answered while the crew is still there."],
        ["Speak up about anything that worries you, right away.", "A loose flower bed tarp is a two-minute fix in the moment."],
      ] },
    ] },
    { id: "after", title: "After the job, and every season", sub: "Keep the new work protected and your warranty valid.", groups: [
      { trade: "all", name: "Right after", items: [
        ["Do a final walk-through and get photos of the finished work.", "Your record of what was installed, for warranty and insurance."],
        ["Register manufacturer warranties and keep the final invoice.", "Some enhanced warranties have to be registered within a set time."],
        ["Run a magnet over the lawn and driveway a week later.", "Rain and mowing bring up the odd nail the sweep missed."],
      ] },
      { trade: "roofing", name: "Roof", items: [
        ["Look over the roof from the ground after every big storm.", "Missing shingles, lifted ridge cap or dents in vents. Photograph and date anything you see."],
        ["Keep branches 6–10 ft back from the roof.", "Rubbing branches wear shingles and give critters a path in."],
        ["Never pressure wash shingles.", "It strips granules. Use a soft wash for algae."],
        ["Rake heavy snow from the ground; never chip at ice dams.", "Chipping tears shingles. Persistent ice dams point to an attic air-sealing or ventilation problem."],
        ["Check the attic once a year.", "Look for stains, daylight, or insulation blocking the soffit vents."],
      ] },
      { trade: "siding", name: "Siding & trim", items: [
        ["Keep mulch and soil 6 in. below the bottom of the siding.", "Wet soil against siding invites rot and insects."],
        ["Aim sprinklers away from the walls.", "Constant spray stains siding and gets behind trim."],
        ["Check caulk at trim, windows and penetrations every spring.", "Re-seal gaps before they let water behind the wall."],
        ["Wash with a garden hose and soft brush, not a pressure washer.", "High pressure drives water behind laps."],
      ] },
      { trade: "windows", name: "Windows", items: [
        ["Clean weep holes at the bottom of the frames.", "They let water that gets in drain back out."],
        ["Look for fog between the panes.", "It means a failed seal. Most are covered under the glass warranty."],
      ] },
      { trade: "gutters", name: "Gutters", items: [
        ["Clean gutters in spring and late fall, even with guards.", "Guards keep leaves out; fine debris still needs a rinse."],
        ["Keep downspout extensions on, discharging 4–6 ft from the house.", "Water dumped at the wall ends up in the basement."],
        ["Watch them in a heavy rain once a year.", "Overflow at a corner or a drip at a seam is easy to fix early."],
      ] },
    ] },
  ];

  const KEY = "cd-checklist";
  let done = {};
  try { done = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {} };
  let filter = (location.hash.slice(1) || "all");
  if (!["all", "roofing", "siding", "windows", "gutters"].includes(filter)) filter = "all";

  const idOf = (l, g, i) => `${l.id}-${g.trade}-${i}`;
  function render() {
    const S = window.SITE || {};
    root.innerHTML = `<div class="cl-print-head"><b>${S.brand || "CD Consulting"} · Homeowner checklist${filter === "all" ? "" : " · " + filter}</b>
      <span>Name ______________________ Install day __________</span>
      <span>When it's done, text a photo of this sheet to ${S.phone || "your consultant"} or upload it at ${location.host}/checklist.html</span></div>` + LISTS.map((l) => {
      const groups = l.groups.filter((g) => filter === "all" || g.trade === "all" || g.trade === filter);
      if (!groups.length) return "";
      return `
      <section class="cl-list" aria-labelledby="cl-${l.id}">
        <header><h2 id="cl-${l.id}">${l.title}</h2><p>${l.sub}</p></header>
        ${groups.map((g) => `
          <div class="cl-group">
            <h3>${g.name}</h3>
            <ul>${g.items.map(([t, why], i) => {
              const id = idOf(l, g, i);
              return `<li><label class="cl-item"><input type="checkbox" data-id="${id}"${done[id] ? " checked" : ""} /><span class="cl-box" aria-hidden="true"></span><span><b>${t}</b><small>${why}</small></span></label></li>`;
            }).join("")}</ul>
          </div>`).join("")}
      </section>`;
    }).join("");
    progress();
  }
  function progress() {
    const boxes = [...root.querySelectorAll("input[type=checkbox]")];
    const n = boxes.filter((b) => b.checked).length;
    $("#clCount").textContent = `${n} of ${boxes.length} done`;
    $("#clBar").style.width = (boxes.length ? (n / boxes.length) * 100 : 0) + "%";
  }
  root.addEventListener("change", (e) => {
    const b = e.target.closest("input[data-id]");
    if (!b) return;
    if (b.checked) done[b.dataset.id] = 1; else delete done[b.dataset.id];
    save();
    progress();
  });
  const chips = $("#clFilter");
  const syncChips = () => chips.querySelectorAll("[data-f]").forEach((c) => c.classList.toggle("is-on", c.dataset.f === filter));
  chips.addEventListener("click", (e) => {
    const c = e.target.closest("[data-f]");
    if (!c) return;
    filter = c.dataset.f;
    history.replaceState(null, "", filter === "all" ? location.pathname : "#" + filter);
    syncChips();
    render();
  });
  $("#clReset").addEventListener("click", () => { done = {}; save(); render(); });

  /* ---------- send it to a to-do app ---------- */
  const SITE = window.SITE || {};
  const visible = () => LISTS.flatMap((l) => l.groups
    .filter((g) => filter === "all" || g.trade === "all" || g.trade === filter)
    .flatMap((g) => g.items.map(([t, why], i) => ({ list: l.title, group: g.name, t, why, id: idOf(l, g, i) }))))
    .filter((x) => !done[x.id]);
  const title = () => `${filter === "all" ? "Project" : filter[0].toUpperCase() + filter.slice(1)} prep · ${SITE.brand || "CD Consulting"}`;
  const say = (t) => { $("#clAddMsg").textContent = t; };
  function download(name, type, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  $("#clAdd").addEventListener("click", (e) => {
    const p = $("#clAddPanel"), open = p.hidden;
    p.hidden = !open;
    e.currentTarget.setAttribute("aria-expanded", open);
    if (open) p.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  // one task per line: pasting this into Apple Reminders makes one reminder per line
  $("#clCopy").addEventListener("click", async () => {
    const text = visible().map((x) => x.t).join("\n");
    try { await navigator.clipboard.writeText(text); say(`Copied ${visible().length} tasks. Now paste them into a Reminders list.`); }
    catch { prompt("Copy these tasks:", text); }
  });
  $("#clShare").addEventListener("click", async () => {
    const text = visible().map((x) => "☐ " + x.t).join("\n");
    if (navigator.share) { try { await navigator.share({ title: title(), text }); } catch {} }
    else { try { await navigator.clipboard.writeText(text); say("Sharing isn't available here, so the list was copied instead."); } catch { prompt("Copy these tasks:", text); } }
  });
  // Todoist's CSV template import (Settings → Import from template)
  $("#clCsv").addEventListener("click", () => {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["TYPE", "CONTENT", "DESCRIPTION", "PRIORITY", "INDENT"].join(",")];
    let section = "";
    for (const x of visible()) {
      if (x.list !== section) { section = x.list; rows.push(["section", q(section), "", "", ""].join(",")); }
      rows.push(["task", q(x.t), q(x.why), 4, 1].join(","));
    }
    download("checklist-todoist.csv", "text/csv", rows.join("\r\n"));
    say("Saved. In Todoist: open a project → ⋯ → Import from template → choose this file.");
  });
  // calendar file: prep the week before, cars out the night before, walk-through the day after
  $("#clIcs").addEventListener("click", () => {
    const v = $("#clDate").value;
    if (!v) { say("Pick your install day first."); $("#clDate").focus(); return; }
    const day = new Date(v + "T12:00:00");
    const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
    const shift = (n) => { const d = new Date(day); d.setDate(d.getDate() + n); return d; };
    const esc = (t) => t.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const items = visible();
    const prep = items.filter((x) => x.list === "Before install day").map((x) => "• " + x.t).join("\n");
    const after = items.filter((x) => /After/.test(x.list)).slice(0, 8).map((x) => "• " + x.t).join("\n");
    const ev = (n, summary, desc, alarm) => [
      "BEGIN:VEVENT", `UID:${ymd(shift(n))}-${n}@cdconsulting`, `DTSTAMP:${ymd(new Date())}T000000Z`,
      `DTSTART;VALUE=DATE:${ymd(shift(n))}`, `DTEND;VALUE=DATE:${ymd(shift(n + 1))}`,
      `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(desc)}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(summary)}`, `TRIGGER:${alarm}`, "END:VALARM", "END:VEVENT"];
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CD Consulting//Homeowner checklist//EN", "CALSCALE:GREGORIAN",
      ...ev(-7, "Start your project prep checklist", prep || "Open the checklist on the website.", "PT9H"),
      ...ev(-1, "Install tomorrow: cars out of the garage and driveway tonight", "Move cars, pets inside in the morning, gates unlocked.\n\n" + prep, "PT17H"),
      ...ev(0, "Install day", "Crew arrives today. Use another door if one is under the work area.", "PT7H"),
      ...ev(1, "Walk-through, then send a photo of your finished checklist", after + "\n\nSend your photo: " + location.origin + "/checklist.html#clDone", "PT10H"),
      "END:VCALENDAR"];
    download("project-checklist.ics", "text/calendar", lines.join("\r\n"));
    say("Saved. Open the file to add the reminders to your calendar.");
  });

  /* ---------- done: send a photo ---------- */
  const form = $("#clForm"), msg = $("#clMsg");
  const photos = [];
  const sayForm = (t, kind = "") => { msg.textContent = t; msg.className = "form-msg mono " + kind; };
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
    } catch { return null; } finally { URL.revokeObjectURL(url); }
  }
  function thumbs() {
    $("#clThumbs").innerHTML = photos.map((p, i) => `<div class="thumb"><img src="${p.url}" alt="Photo ${i + 1}"><button type="button" data-i="${i}" aria-label="Remove photo ${i + 1}">✕</button></div>`).join("");
  }
  $("#clPhotos").addEventListener("change", async (e) => {
    for (const f of [...e.target.files].filter((f) => f.type.startsWith("image/"))) {
      if (photos.length >= 6) break;
      const blob = await shrink(f);
      if (blob) photos.push({ blob, url: URL.createObjectURL(blob) });
    }
    e.target.value = "";
    thumbs();
  });
  $("#clThumbs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    URL.revokeObjectURL(photos[+b.dataset.i].url);
    photos.splice(+b.dataset.i, 1);
    thumbs();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = form.elements;
    const bad = ["name", "phone", "email"].filter((n) => !f[n].value.trim() || (n === "email" && !/^\S+@\S+\.\S+$/.test(f[n].value)));
    ["name", "phone", "email"].forEach((n) => f[n].closest(".field").classList.toggle("invalid", bad.includes(n)));
    if (bad.length) return sayForm("Name, phone and a valid email are required.", "err");
    if (!photos.length) return sayForm("Add at least one photo.", "err");
    const all = [...root.querySelectorAll("input[data-id]")], n = all.filter((b) => b.checked).length;
    const fd = new FormData(form);
    fd.set("interest", "Checklist complete");
    fd.set("message", `Homeowner checklist: ${n} of ${all.length} done (${filter === "all" ? "everything" : filter}).` +
      (n < all.length ? ` Still open: ${visible().slice(0, 12).map((x) => x.t).join(" / ")}` : ""));
    photos.forEach((p, i) => fd.append(`photo${i + 1}`, p.blob, `checklist${i + 1}.jpg`));
    $("#clSend").disabled = true;
    sayForm("Sending…");
    try {
      const r = await fetch(SITE.formEndpoint || "/api/lead", { method: "POST", body: fd, headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(r.status);
      form.innerHTML = `<div class="sent"><div class="ok-mark">✓</div><h3>Got it, thanks!</h3><p>I'll look over your photos before the crew arrives.</p></div>`;
    } catch {
      $("#clSend").disabled = false;
      sayForm(`Couldn't send right now. Please text your photo to ${SITE.phone || "me"}.`, "err");
    }
  });
  $("#clPrint").addEventListener("click", () => print());
  syncChips();
  render();
})();
