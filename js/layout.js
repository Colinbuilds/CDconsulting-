/* Shared nav + footer for every page. Load right after <body>; set <body data-page="…">. */
(function () {
  const page = document.body.dataset.page || "";
  const gated = document.body.hasAttribute("data-gate");
  const PROCESS = [
    ["full", "index.html#build", "The full job", "Roof + siding, start to finish"],
    ["roofing", "roofing.html", "Roofing", "Tear-off to ridge cap"],
    ["siding", "siding.html", "Siding", "Wrap, flash, side, trim"],
    ["windows", "windows.html", "Windows", "Out, pan, set, seal"],
    ["gutters", "gutters.html", "Gutters", "Hangers, seams, downspouts"],
  ];
  const LINKS = [
    ["design", "design.html", "Design"],
    ["estimate", "estimate.html", "Estimate"],
    ["commercial", "commercial.html", "Commercial"],
    ["insurance", "insurance.html", "Insurance"],
    ["checklist", "checklist.html", "Checklist"],
    ["work", "work.html", "Work"],
  ];
  const inProcess = PROCESS.some(([id]) => id === page);
  const cur = (id) => (id === page ? ' aria-current="page"' : "");

  document.currentScript.insertAdjacentHTML("beforebegin", `
  <header class="nav" id="top">
    <a href="index.html" class="logo" aria-label="CD Consulting home">
      <svg viewBox="0 0 40 40" class="logo-mark" aria-hidden="true">
        <rect x="1" y="1" width="38" height="38" rx="9" fill="none" stroke="currentColor" stroke-opacity=".35"/>
        <path d="M9 19 20 10l11 9" fill="none" stroke="var(--blue)" stroke-width="2"/>
        <path d="M13 17v12h14V17" fill="none" stroke="currentColor" stroke-width="1.4"/>
      </svg>
      <span class="logo-text">CD <i>Consulting</i></span>
    </a>
    <nav class="nav-links" aria-label="Main">
      <div class="nav-drop">
        <button type="button" class="nav-drop-btn${inProcess ? " is-current" : ""}" aria-expanded="false" aria-haspopup="true">How it's built <span aria-hidden="true">▾</span></button>
        <div class="nav-drop-menu">
          ${PROCESS.map(([id, href, name, sub]) => `<a href="${href}"${cur(id)}><b>${name}</b><small>${sub}</small></a>`).join("")}
        </div>
      </div>
      ${LINKS.map(([id, href, name]) => `<a href="${href}"${cur(id)}>${name}</a>`).join("")}
      <a href="index.html#about"${cur("about")}>About</a>
      <a href="index.html#contact" class="btn btn-sm btn-blue">Start a project</a>
    </nav>
    <button class="nav-toggle" aria-label="Open menu" aria-expanded="false"><span></span><span></span></button>
    ${gated ? '<button class="btn btn-ghost btn-sm intro-skip" id="introSkip" type="button">Skip intro</button>' : ""}
  </header>`);

  window.CDLayout = {
    footer(el) {
      el.innerHTML = `
      <div class="wrap footer-inner">
        <div class="footer-brand">
          <span class="footer-big">CD <em>Consulting</em></span>
          <span class="label">Construction consultant · Roofing · Siding · Windows · Gutters</span>
        </div>
        <nav class="footer-links" aria-label="Footer">
          ${PROCESS.slice(1).map(([, href, name]) => `<a href="${href}">${name}</a>`).join("")}
          ${LINKS.map(([, href, name]) => `<a href="${href}">${name}</a>`).join("")}
          <a href="index.html#contact">Contact</a>
        </nav>
        <div class="footer-meta">
          <span>© <span id="year"></span> <span data-site="brand">CD Consulting</span></span>
          <a href="#top">Back to top ↑</a>
        </div>
      </div>`;
    },
  };
})();
