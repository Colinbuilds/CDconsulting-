/* CD Consulting — shared site behavior */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const SITE = window.SITE || {};

  // ---- footer (layout.js holds the markup shared by every page) ----
  const footer = $("footer.footer");
  if (footer && window.CDLayout) window.CDLayout.footer(footer);

  // Shared bus so the visualizer / estimator / insurance pages can hand things to the lead form.
  // Everything attached is kept in sessionStorage, so it survives moving between pages.
  const store = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const toBlob = (url) => {
    const [head, b64] = url.split(","), bin = atob(b64), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return new Blob([buf], { type: head.slice(5, head.indexOf(";")) });
  };
  const saved = store.get("cd-attach") || {};
  let renderURL = saved.render || null;
  const persist = () => store.set("cd-attach", { ...window.CD.attachments, render: renderURL });
  const PAGES = { contact: "index.html#contact", about: "index.html#about", estimate: "estimate.html", visualizer: "design.html", insurance: "insurance.html", work: "work.html" };

  window.CD = {
    attachments: { build: null, estimate: null, render: null, claim: null, interests: [], ...saved, render: saved.render ? toBlob(saved.render) : null },
    listeners: [],
    attach(key, value) {
      this.attachments[key] = value;
      this.listeners.forEach((fn) => fn(this.attachments));
      if (key === "render") {
        renderURL = null;
        if (value) { const r = new FileReader(); r.onload = () => { renderURL = r.result; persist(); }; r.readAsDataURL(value); }
      }
      persist();
    },
    onAttach(fn) { this.listeners.push(fn); fn(this.attachments); },
    // scroll there if it's on this page, otherwise open the page that has it
    goTo(id) {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else location.href = PAGES[id] || "index.html#" + id;
    },
    // fire an event for a tool that may live on another page (e.g. visualizer → estimator)
    handoff(type, detail, id) {
      if (document.getElementById(id)) { document.dispatchEvent(new CustomEvent(type, { detail })); this.goTo(id); }
      else { store.set("cd-handoff", { type, detail }); this.goTo(id); }
    },
    get estimate() { return store.get("cd-estimate"); },
    set estimate(v) { store.set("cd-estimate", v); },
    money(n) { return "$" + Math.round(n).toLocaleString("en-US"); },
  };
  // deliver a handoff once this page's scripts have registered their listeners
  addEventListener("DOMContentLoaded", () => {
    const h = store.get("cd-handoff");
    if (h) { store.set("cd-handoff", null); document.dispatchEvent(new CustomEvent(h.type, { detail: h.detail })); }
  });

  // ---- fill config values ----
  $$("[data-site]").forEach((el) => {
    const v = SITE[el.dataset.site];
    if (v) el.textContent = v;
  });
  $$("[data-site-href]").forEach((el) => {
    const kind = el.dataset.siteHref;
    const v = SITE[el.dataset.site] || "";
    el.href = kind === "tel" ? "tel:" + v.replace(/[^\d+]/g, "") : "mailto:" + v;
  });
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  // ---- mobile nav ----
  const nav = $(".nav");
  const toggle = $(".nav-toggle");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });
  // "How it's built" menu: hover on desktop, tap anywhere
  const drop = $(".nav-drop"), dropBtn = $(".nav-drop-btn");
  dropBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = drop.classList.toggle("open");
    dropBtn.setAttribute("aria-expanded", open);
  });
  document.addEventListener("click", (e) => { if (!drop.contains(e.target)) { drop.classList.remove("open"); dropBtn.setAttribute("aria-expanded", "false"); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { drop.classList.remove("open"); dropBtn.setAttribute("aria-expanded", "false"); } });
  $$(".nav-links a").forEach((a) => a.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }));

  // ---- readout typewriter ----
  const typeEl = $(".type");
  if (typeEl && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const words = typeEl.dataset.words.split("|");
    let w = 0, i = words[0].length, deleting = true;
    const tick = () => {
      const word = words[w];
      i += deleting ? -1 : 1;
      typeEl.textContent = word.slice(0, i);
      let delay = deleting ? 45 : 85;
      if (!deleting && i === word.length) { deleting = true; delay = 2200; }
      else if (deleting && i === 0) { deleting = false; w = (w + 1) % words.length; delay = 300; }
      setTimeout(tick, delay);
    };
    setTimeout(tick, 2500);
  }

  // ---- reveal on scroll + counters ----
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { threshold: 0.12 });
  $$(".sec-head, .svc, .about-photo, .about-copy, .contact-copy, .lead-form").forEach((el) => {
    el.classList.add("reveal");
    io.observe(el);
  });

  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target, target = +el.dataset.count, suffix = el.dataset.suffix || "+";
      const t0 = performance.now(), dur = 1400;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString() + (p === 1 ? suffix : "");
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  // ---- portfolio ----
  const projects = window.PROJECTS || [];
  const grid = $("#workGrid");
  if (!grid) return;
  const CAT = { roofing: "Roofing", siding: "Siding", windows: "Windows", additions: "Addition", exterior: "Full exterior" };
  const phSVG = (cat) => {
    const art = {
      roofing: '<path d="M10 70 60 25l50 45M22 60v35h76V60"/><path d="M35 50l25-22 25 22" stroke-dasharray="3 4"/>',
      siding: '<rect x="20" y="30" width="80" height="60"/><path d="M20 42h80M20 54h80M20 66h80M20 78h80"/>',
      windows: '<rect x="25" y="20" width="70" height="75"/><path d="M60 20v75M25 57h70"/><rect x="32" y="27" width="21" height="23"/>',
      additions: '<path d="M10 95V55l30-25 30 25v40z"/><path d="M70 95V65h40v30" stroke-dasharray="4 3"/><path d="M70 65l20-15 20 15" stroke-dasharray="4 3"/>',
      exterior: '<path d="M10 95V50l50-35 50 35v45z"/><rect x="50" y="65" width="20" height="30"/><rect x="22" y="58" width="18" height="16"/><rect x="80" y="58" width="18" height="16"/>',
    };
    return `<div class="ph"><svg viewBox="0 0 120 110">${art[cat] || art.exterior}</svg><span>Photo coming soon</span></div>`;
  };
  const media = (src, cat, alt) =>
    src ? `<img src="${src}" alt="${alt}" loading="lazy" />` : phSVG(cat);

  function renderWork(filter = "all") {
    grid.innerHTML = "";
    projects.forEach((p, idx) => {
      if (filter !== "all" && p.category !== filter) return;
      const card = document.createElement("button");
      card.className = "card";
      card.type = "button";
      card.style.animationDelay = grid.children.length * 60 + "ms";
      card.innerHTML = `
        <div class="card-media">${media(p.after || p.before, p.category, p.title)}
          <span class="card-tag">${CAT[p.category] || p.category}</span>
        </div>
        <div class="card-body">
          <span class="meta">${p.location} · ${p.year}</span>
          <h3>${p.title}</h3>
          <p>${p.description}</p>
        </div>`;
      card.addEventListener("click", () => openProject(p, idx));
      grid.appendChild(card);
    });
  }
  $("#workFilter").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    $$("#workFilter .chip").forEach((c) => c.classList.toggle("is-on", c === b));
    renderWork(b.dataset.f);
  });
  renderWork();

  const modal = $("#projectModal");
  function openProject(p, idx) {
    $("#modalId").textContent = `Project ${String(idx + 1).padStart(2, "0")} · ${CAT[p.category] || ""}`;
    const hasBA = p.before && p.after;
    $("#modalBody").innerHTML = `
      ${hasBA ? `
        <div class="ba" style="--pos:50%">
          <div class="layer">${media(p.before, p.category, p.title + " before")}</div>
          <div class="layer after-layer">${media(p.after, p.category, p.title + " after")}</div>
          <span class="lbl l">BEFORE</span><span class="lbl r">AFTER</span>
          <div class="handle"></div>
          <input type="range" min="0" max="100" value="50" aria-label="Before / after slider" />
        </div>` : `<div class="ba">${media(p.after || p.before, p.category, p.title)}</div>`}
      <div class="modal-copy">
        <span class="meta">${p.location} · ${p.year}</span>
        <h3>${p.title}</h3>
        <p>${p.description}</p>
        <ul class="scope">${(p.scope || []).map((s) => `<li>${s}</li>`).join("")}</ul>
      </div>
      <a href="index.html#contact" class="btn btn-blue" data-close>Want this on your house?</a>`;
    const range = $(".ba input", modal);
    if (range) range.addEventListener("input", () => $(".ba", modal).style.setProperty("--pos", range.value + "%"));
    modal.showModal();
  }
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest(".modal-x") || e.target.closest("[data-close]")) modal.close();
  });
})();
