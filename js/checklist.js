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
    root.innerHTML = LISTS.map((l) => {
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
  $("#clPrint").addEventListener("click", () => print());
  syncChips();
  render();
})();
