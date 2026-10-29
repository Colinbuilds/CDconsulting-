/* Insurance section: "Should I file?" quick check + booking a storm inspection.
   The math is a rough illustration (deductible, depreciation, net payout),
   never a coverage decision. That's the adjuster's call. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const money = (n) => window.CD.money(Math.max(0, n));
  const form = $("#insForm");
  if (!form) return;
  const out = $("#insResult");
  let lastSummary = "";

  $("#insDedType").addEventListener("change", (e) => {
    const pct = e.target.value === "pct";
    $("#insFlatWrap").hidden = pct;
    $("#insPctWrap").hidden = !pct;
    calc();
  });
  form.addEventListener("input", calc);
  $("#insUseEstimate").addEventListener("click", () => {
    const est = window.CD.estimate;
    if (!est) { window.CD.goTo("estimate"); return; } // no ballpark yet: send them to build one
    $("#insCost").value = Math.round((est.lo + est.hi) / 2 / 100) * 100;
    calc();
  });

  function calc() {
    const cause = $("#insCause").value;
    const cost = Math.max(0, +$("#insCost").value || 0);
    const ded = $("#insDedType").value === "pct"
      ? (+$("#insPct").value) * Math.max(0, +$("#insCovA").value || 0)
      : Math.max(0, +$("#insDed").value || 0);
    const age = Math.max(0, +$("#insAge").value || 0);
    const policy = $("#insPolicy").value;
    const prior = +$("#insPrior").value;

    // straight-line depreciation on a ~25-year asphalt roof, capped (carriers vary)
    const depRate = Math.min(age / 25, 0.8);
    const dep = cost * depRate;
    const acvNet = cost - dep - ded;
    const rcvNet = cost - ded;
    const net = policy === "rcv" ? rcvNet : acvNet;

    const reasons = [];
    let level; // 3 likely, 2 borderline, 1 probably not, 0 not a claim
    if (cause === "age") {
      level = 0;
      reasons.push("Normal wear and age aren't covered by homeowner's insurance. Plan the replacement instead, and I can help you budget it.");
    } else if (net <= 0) {
      level = 1;
      reasons.push(`Your deductible (${money(ded)}) is about as much as the payout would be, so a claim likely pays nothing.`);
    } else if (net < 1000) {
      level = 1;
      reasons.push(`It would pay only about ${money(net)} after your deductible. Paying for the repair yourself keeps the claim off your record.`);
    } else if (net < Math.max(2500, ded * 0.5)) {
      level = 2;
      reasons.push(`It would pay roughly ${money(net)} after your deductible. That's small enough that paying out of pocket may protect your claims history.`);
    } else {
      level = 3;
      reasons.push(`Storm damage of this size is well above your ${money(ded)} deductible. Worth a professional inspection, and likely worth filing if damage is confirmed.`);
    }
    if (level >= 2 && prior >= 2) { level -= 1; reasons.push("Two or more recent claims can affect your premium or renewal. Talk to your agent before filing."); }
    else if (level >= 2 && prior === 1) reasons.push("You've had a recent claim. Ask your agent how another one affects your policy.");
    if (cause !== "age" && age >= 18) reasons.push("Older roofs are sometimes paid at actual cash value or on a roof payment schedule. Check your declarations page.");
    if (cause === "hail") reasons.push("Dented gutters, vents and downspouts are strong evidence for hail. Photograph them before they're repaired.");
    if (cause === "tree") reasons.push("Tree removal from the house is usually covered up to a set limit. Don't cut it off the roof yourself.");
    if (cause === "leak") reasons.push("Interior damage from a sudden storm leak may be covered. A leak from a worn-out roof usually isn't.");
    if (policy === "unsure") reasons.push("Not sure of your policy? Your declarations page says RCV or ACV. The numbers above assume ACV to be safe.");
    if ($("#insDedType").value === "pct") reasons.push(`A ${(+$("#insPct").value * 100).toFixed(0)}% wind/hail deductible on ${money(+$("#insCovA").value)} of coverage is ${money(ded)}.`);

    const V = [
      ["NOT A CLAIM", "no"],
      ["PROBABLY NOT WORTH FILING", "no"],
      ["BORDERLINE: GET AN INSPECTION FIRST", "mid"],
      ["LIKELY WORTH FILING", "ok"],
    ][level];

    out.innerHTML = `
      <p class="ins-verdict ${V[1]} mono">${V[0]}</p>
      <dl class="ins-nums mono">
        <div><dt>DEDUCTIBLE</dt><dd>${money(ded)}</dd></div>
        <div><dt>FIRST CHECK (ACV − DED.)</dt><dd>${money(acvNet)}</dd></div>
        <div><dt>HELD-BACK DEPRECIATION</dt><dd>${policy === "acv" ? "Not recoverable" : money(dep)}</dd></div>
        <div><dt>EST. TOTAL TO YOU</dt><dd>${money(cause === "age" ? 0 : net)}</dd></div>
      </dl>
      <ul class="ins-reasons">${reasons.map((r) => `<li>${r}</li>`).join("")}</ul>
      <p class="fine mono">Illustration only, assuming straight-line depreciation over 25 years. Your adjuster and policy decide coverage.</p>
      <button type="button" class="btn btn-ghost btn-sm" id="insSend">Send this to Colin with my inspection request →</button>`;
    $("#insSend").addEventListener("click", () => book(true));

    lastSummary = `${V[0]} | cause: ${$("#insCause").selectedOptions[0].text}, est. ${money(cost)}, deductible ${money(ded)}, roof ${age} yrs, ${$("#insPolicy").selectedOptions[0].text}, prior claims: ${$("#insPrior").selectedOptions[0].text}`;
  }

  /* booking: tick Storm / Insurance on the lead form and carry the quick check over */
  function book(withCheck) {
    if (withCheck) window.CD.attach("claim", lastSummary);
    const list = window.CD.attachments.interests || [];
    if (!list.includes("Storm / Insurance")) window.CD.attach("interests", [...list, "Storm / Insurance"]);
    window.CD.goTo("contact");
  }
  $("#insBook").addEventListener("click", () => book(false));

  calc();
})();
