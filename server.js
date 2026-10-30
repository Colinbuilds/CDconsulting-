/* CD Consulting — tiny production server for Railway.
   Serves the static site and receives lead-form submissions (with photos).

   Lead delivery (set in Railway → service → Variables):
     RESEND_API_KEY   + LEAD_TO_EMAIL   → email each lead with photos attached (resend.com, free tier)
     LEAD_FROM_EMAIL  (optional)        → sender, e.g. "CD Consulting <leads@yourdomain.com>"
     LEADS_DIR        (optional)        → also save leads to disk, e.g. a Railway volume at /data
   Every lead is also written to the deploy logs, so nothing is lost before email is set up. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import busboy from "busboy";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PAGES = ["index.html", "roofing.html", "siding.html", "windows.html", "gutters.html", "design.html", "estimate.html", "insurance.html", "work.html", "checklist.html"];
const PUBLIC = [...PAGES, "css", "js", "images"];
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
};

/* ---------- static files ---------- */
function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
  if (rel === "") rel = "index.html";
  if (PAGES.includes(rel + ".html")) rel += ".html"; // /roofing → roofing.html
  const file = path.normalize(path.join(ROOT, rel));
  const top = rel.split("/")[0];
  if (!file.startsWith(ROOT + path.sep) || !PUBLIC.includes(top)) return notFound(res);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    const ext = path.extname(file).toLowerCase();
    const longCache = top === "images" || rel.startsWith("js/vendor/");
    res.writeHead(200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": longCache ? "public, max-age=604800" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
}
function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/* ---------- leads ---------- */
const hits = new Map(); // ip -> [timestamps]
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  list.push(now);
  hits.set(ip, list);
  return list.length > 12;
}

function parseLead(req) {
  return new Promise((resolve, reject) => {
    const fields = {}, files = [];
    let tooBig = false;
    const bb = busboy({ headers: req.headers, limits: { fileSize: 8 * 1024 * 1024, files: 8, fields: 40, fieldSize: 20000 } });
    bb.on("field", (name, val) => { fields[name] = val; });
    bb.on("file", (name, stream, info) => {
      const chunks = [];
      stream.on("data", (c) => chunks.push(c));
      stream.on("limit", () => { tooBig = true; });
      stream.on("end", () => {
        const buf = Buffer.concat(chunks);
        if (buf.length && /^image\//.test(info.mimeType)) files.push({ field: name, filename: `${name}.jpg`, type: info.mimeType, buf });
      });
    });
    bb.on("close", () => (tooBig ? reject(new Error("too_big")) : resolve({ fields, files })));
    bb.on("error", reject);
    req.pipe(bb);
  });
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function emailLead(f, files) {
  const key = process.env.RESEND_API_KEY, to = process.env.LEAD_TO_EMAIL;
  if (!key || !to) return false;
  const rows = [["Name", f.name], ["Phone", f.phone], ["Email", f.email], ["Address", f.address], ["Interested in", f.interest],
    ["Timeline", f.timeline], ["Budget", f.budget], ["Message", f.message], ["Design build", f.build], ["Ballpark", f.estimate],
    ["Date of loss", f.loss_date], ["Insurance company", f.carrier], ["Claim #", f.claim_no], ["Claim status", f.claim_status], ["Claim check", f.claim_check]];
  const html = `<h2>New lead: ${esc(f.name)}</h2><table cellpadding="6" style="border-collapse:collapse">${rows
    .filter(([, v]) => v).map(([k, v]) => `<tr><td style="color:#666;vertical-align:top"><b>${k}</b></td><td>${esc(v).replace(/ \| /g, "<br>")}</td></tr>`).join("")}</table>
    <p>${files.length} photo(s) attached.</p>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.LEAD_FROM_EMAIL || "CD Consulting <onboarding@resend.dev>",
      to: to.split(",").map((s) => s.trim()),
      reply_to: f.email,
      subject: `New lead: ${f.name} (${f.interest || "project"})`,
      html,
      attachments: files.map((x) => ({ filename: x.filename, content: x.buf.toString("base64") })),
    }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
  return true;
}

function saveLead(f, files) {
  const dir = process.env.LEADS_DIR;
  if (!dir) return;
  const id = new Date().toISOString().replace(/[:.]/g, "-") + "-" + (f.name || "lead").replace(/[^a-z0-9]+/gi, "-").slice(0, 30);
  const d = path.join(dir, id);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "lead.json"), JSON.stringify(f, null, 2));
  files.forEach((x) => fs.writeFileSync(path.join(d, x.filename), x.buf));
}

async function handleLead(req, res) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  if (limited(ip)) return json(res, 429, { ok: false, error: "Too many requests" });
  let lead;
  try { lead = await parseLead(req); } catch (e) { return json(res, 413, { ok: false, error: "Upload too large" }); }
  const f = lead.fields;
  if (f.company_url) return json(res, 200, { ok: true }); // honeypot: bots fill hidden fields
  if (!f.name || !f.phone || !/^\S+@\S+\.\S+$/.test(f.email || "")) return json(res, 400, { ok: false, error: "Name, phone and email are required" });

  console.log("NEW LEAD", JSON.stringify({ ...f, photos: lead.files.length }));
  let delivered = false;
  try { saveLead(f, lead.files); delivered = !!process.env.LEADS_DIR; } catch (e) { console.error("save failed", e); }
  try { delivered = (await emailLead(f, lead.files)) || delivered; } catch (e) { console.error("email failed", e.message); }
  if (!delivered) console.warn("Lead only in logs: set RESEND_API_KEY + LEAD_TO_EMAIL (or LEADS_DIR) in Railway variables.");
  json(res, 200, { ok: true });
}

/* ---------- server ---------- */
http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url === "/healthz") return json(res, 200, { ok: true });
  if (url === "/api/lead" && req.method === "POST") return handleLead(req, res).catch((e) => { console.error(e); json(res, 500, { ok: false }); });
  if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
  res.writeHead(405); res.end();
}).listen(PORT, () => console.log(`CD Consulting listening on :${PORT}`));
