/* CD Consulting — lead form: photo uploads, attachments from the tools, submit */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const SITE = window.SITE || {};
  const MAX_PHOTOS = 6;

  const form = $("#leadForm");
  const picker = $("#leadPhotos");
  const zone = $("#uploadZone");
  const thumbs = $("#thumbs");
  const msg = $("#formMsg");
  let photos = []; // { blob, url }

  // ---------- photos ----------
  async function compress(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function addFiles(files) {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    for (const f of list) {
      if (photos.length >= MAX_PHOTOS) { say(`Max ${MAX_PHOTOS} photos — text me the rest after.`, "err"); break; }
      const blob = await compress(f);
      if (!blob) { say(`Couldn't read ${f.name}. Try a JPG or PNG.`, "err"); continue; }
      photos.push({ blob, url: URL.createObjectURL(blob) });
    }
    drawThumbs();
  }

  function drawThumbs() {
    thumbs.innerHTML = "";
    photos.forEach((p, i) => {
      const d = document.createElement("div");
      d.className = "thumb";
      d.innerHTML = `<img src="${p.url}" alt="Upload ${i + 1}"><button type="button" aria-label="Remove photo ${i + 1}">✕</button>`;
      d.querySelector("button").addEventListener("click", () => {
        URL.revokeObjectURL(p.url);
        photos.splice(i, 1);
        drawThumbs();
      });
      thumbs.appendChild(d);
    });
    const r = window.CD.attachments.render;
    if (r) {
      const d = document.createElement("div");
      d.className = "thumb";
      d.innerHTML = `<img src="${URL.createObjectURL(r)}" alt="Visualizer render"><span class="tag">RENDER</span><button type="button" aria-label="Remove render">✕</button>`;
      d.querySelector("button").addEventListener("click", () => window.CD.attach("render", null));
      thumbs.appendChild(d);
    }
  }

  picker.addEventListener("change", () => { addFiles(picker.files); picker.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("drag"); }));
  zone.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

  // ---------- attachments from visualizer / estimator ----------
  window.CD.onAttach((a) => {
    $("#buildField").value = a.build || "";
    $("#estimateField").value = a.estimate || "";
    const items = [];
    if (a.build) items.push(`<li><b>Design build</b> — ${a.build.split(" | ")[0].replace("Build: ", "")}</li>`);
    if (a.render) items.push(`<li><b>Your rendered photo</b></li>`);
    if (a.estimate) items.push(`<li><b>Ballpark</b> — ${a.estimate.split(" | ")[0]}</li>`);
    $("#attachedList").innerHTML = items.join("");
    $("#attached").hidden = !items.length;
    if (a.build) check("AI Render");
    if (a.estimate) {
      if (/Roof/.test(a.estimate)) check("Roof");
      if (/Siding/.test(a.estimate)) check("Siding");
      if (/Windows/.test(a.estimate)) check("Windows");
      if (/Gutters/.test(a.estimate)) check("Gutters");
      if (/Addition/.test(a.estimate)) check("Addition");
      if (/Door/.test(a.estimate)) check("Doors");
    }
    drawThumbs();
  });
  const check = (v) => { const el = form.querySelector(`input[name=interest][value="${v}"]`); if (el) el.checked = true; };

  // ---------- submit ----------
  function say(text, kind = "") { msg.textContent = text; msg.className = "form-msg mono " + kind; }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let ok = true;
    ["name", "phone", "email"].forEach((n) => {
      const input = form.elements[n];
      const bad = !input.value.trim() || (n === "email" && !/^\S+@\S+\.\S+$/.test(input.value));
      input.closest(".field").classList.toggle("invalid", bad);
      if (bad) ok = false;
    });
    if (!ok) { say("Name, phone and a valid email are required.", "err"); return; }

    const fd = new FormData(form);
    ["render", "photo1", "photo2", "photo3", "photo4", "photo5", "photo6"].forEach((k) => fd.delete(k));
    fd.set("interest", fd.getAll("interest").join(", "));
    photos.forEach((p, i) => fd.append(`photo${i + 1}`, p.blob, `photo${i + 1}.jpg`));
    if (window.CD.attachments.render) fd.append("render", window.CD.attachments.render, "render.jpg");

    const btn = $("#submitBtn");
    btn.disabled = true;
    say("TRANSMITTING…");
    try {
      const endpoint = SITE.formEndpoint || "/";
      const res = await fetch(endpoint, { method: "POST", body: fd, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(res.status);
      form.innerHTML = `
        <div class="panel-head mono"><span>FORM // NEW-LEAD</span><span>RECEIVED</span></div>
        <div class="sent">
          <div class="ok-mark">✓</div>
          <h3>Request received</h3>
          <p>Thanks, ${escapeHTML(fd.get("name").split(" ")[0])}. I'll look over everything and reach out soon — usually same day.</p>
          <p class="mono fine">Need me now? ${escapeHTML(SITE.phone || "")}</p>
        </div>`;
    } catch (err) {
      btn.disabled = false;
      say(`Couldn't send right now. Please call ${SITE.phone || ""} or email ${SITE.email || ""}.`, "err");
    }
  });

  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
})();
