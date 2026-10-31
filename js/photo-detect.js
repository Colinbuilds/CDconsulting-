/* Finds the roof, siding, trim and doors in a photo of a house, all in the browser.
   1. A scene-segmentation model (SegFormer trained on ADE20K, run with transformers.js and cached
      by the browser after the first visit) marks house / building, windows, doors, sky, trees.
   2. The photo is cut into superpixels: small patches that follow real edges, so the final areas
      have clean outlines.
   3. Inside the house, roof and siding are split by growing from seeds: patches along the top edge
      of the house seed "roof", patches around windows and doors seed "siding", and each grows into
      the neighbors that look most like it (color + texture) until they meet at the eave line.
   Labels: 0 none, 1 roof, 2 siding, 3 trim, 4 door, 5 window and 6 brick / stone (both kept as is). */

export const ZONE = { none: 0, roof: 1, siding: 2, trim: 3, door: 4, window: 5, masonry: 6 };
const MODEL = "Xenova/segformer-b2-finetuned-ade-512-512";
const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2";

let segmenter = null;
async function loadModel(onProgress) {
  if (segmenter) return segmenter;
  const { pipeline, env } = await import(LIB);
  env.allowLocalModels = false;
  const files = {};
  const opts = {
    dtype: "q8",
    progress_callback: (p) => {
      if (p.status === "progress" && p.total) { files[p.file] = [p.loaded, p.total]; const v = Object.values(files); onProgress?.(v.reduce((s, x) => s + x[0], 0) / v.reduce((s, x) => s + x[1], 0)); }
    },
  };
  // WebGPU when the device really has it (much faster), otherwise WebAssembly
  let gpu = null;
  try { gpu = navigator.gpu && (await navigator.gpu.requestAdapter()); } catch { gpu = null; }
  if (gpu) try { segmenter = await pipeline("image-segmentation", MODEL, { ...opts, device: "webgpu", dtype: "fp32" }); } catch { segmenter = null; }
  if (!segmenter) segmenter = await pipeline("image-segmentation", MODEL, opts);
  return segmenter;
}

const HOUSE = new Set(["house", "building", "skyscraper", "hovel", "wall", "tower", "awning", "canopy", "column", "roof"]);
const WINDOW = new Set(["windowpane", "window", "glass", "screen", "blind"]);
const DOOR = new Set(["door", "screen door", "double door"]);

/* ---------- color ---------- */
function toLab(r, g, b) {
  const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const R = f(r), G = f(g), B = f(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = h(x); y = h(y); z = h(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/* ---------- SLIC superpixels ---------- */
function slic(rgba, W, H, K = 1400, m = 12) {
  const N = W * H, L = new Float32Array(N), A = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0; i < N; i++) { const [l, a, b] = toLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]); L[i] = l; A[i] = a; B[i] = b; }
  const S = Math.max(4, Math.round(Math.sqrt(N / K)));
  const cs = [];
  for (let y = S / 2; y < H; y += S) for (let x = S / 2; x < W; x += S) { const i = (y | 0) * W + (x | 0); cs.push([L[i], A[i], B[i], x, y]); }
  const lab = new Int32Array(N).fill(-1), dist = new Float32Array(N);
  const mS = (m / S) ** 2;
  for (let it = 0; it < 8; it++) {
    dist.fill(Infinity);
    cs.forEach((c, k) => {
      const x0 = Math.max(0, (c[3] - S) | 0), x1 = Math.min(W - 1, (c[3] + S) | 0), y0 = Math.max(0, (c[4] - S) | 0), y1 = Math.min(H - 1, (c[4] + S) | 0);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * W + x, dl = L[i] - c[0], da = A[i] - c[1], db = B[i] - c[2], dx = x - c[3], dy = y - c[4];
        const d = dl * dl + da * da + db * db + mS * (dx * dx + dy * dy);
        if (d < dist[i]) { dist[i] = d; lab[i] = k; }
      }
    });
    const acc = cs.map(() => [0, 0, 0, 0, 0, 0]);
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) { const a = acc[lab[i]]; if (!a) continue; a[0] += L[i]; a[1] += A[i]; a[2] += B[i]; a[3] += x; a[4] += y; a[5]++; }
    acc.forEach((a, k) => { if (a[5]) cs[k] = [a[0] / a[5], a[1] / a[5], a[2] / a[5], a[3] / a[5], a[4] / a[5]]; });
  }
  // connectivity: relabel fragments into fresh ids, then merge tiny ones into a neighbor
  const out = new Int32Array(N).fill(-1), sizes = [];
  let n = 0;
  const stack = [];
  for (let s = 0; s < N; s++) {
    if (out[s] !== -1) continue;
    const want = lab[s]; out[s] = n; stack.push(s); let size = 0;
    while (stack.length) {
      const i = stack.pop(); size++;
      const x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && out[j] === -1 && lab[j] === want) { out[j] = n; stack.push(j); }
    }
    sizes.push(size); n++;
  }
  const minSize = (S * S) / 4, remap = new Int32Array(n).map((_, i) => i);
  for (let i = 0; i < N; i++) {
    const k = out[i];
    if (sizes[k] >= minSize || remap[k] !== k) continue;
    const x = i % W;
    const nb = x > 0 ? out[i - 1] : i >= W ? out[i - W] : -1;
    if (nb >= 0 && nb !== k) remap[k] = remap[nb];
  }
  for (let i = 0; i < N; i++) out[i] = remap[out[i]];
  return { seg: out, L, A, B, S };
}

/* ---------- the detector ---------- */
export async function detect(source, { onStep, onProgress } = {}) {
  onStep?.("Loading the house detector…");
  const model = await loadModel(onProgress);
  // work at ~640 px on the long side: plenty for areas, fast enough for a phone
  const k = Math.min(1, 640 / Math.max(source.width, source.height));
  const W = Math.round(source.width * k), H = Math.round(source.height * k);
  const work = document.createElement("canvas"); work.width = W; work.height = H;
  const wctx = work.getContext("2d", { willReadFrequently: true });
  wctx.drawImage(source, 0, 0, W, H);
  const rgba = wctx.getImageData(0, 0, W, H).data;

  onStep?.("Finding the house, windows and doors…");
  const url = work.toDataURL("image/jpeg", 0.92);
  const parts = await model(url);
  const N = W * H, cls = new Uint8Array(N); // 0 other, 1 house, 2 window, 3 door, 4 sky, 5 plant
  const found = [];
  for (const p of parts) {
    const t = HOUSE.has(p.label) ? 1 : WINDOW.has(p.label) ? 2 : DOOR.has(p.label) ? 3 : p.label === "sky" ? 4 : /tree|plant|grass|palm|flower/.test(p.label) ? 5 : 0;
    if (!t) continue;
    found.push(p.label);
    const m = p.mask, mw = m.width, mh = m.height, md = m.data, ch = m.channels || 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = md[(((y * mh) / H | 0) * mw + ((x * mw) / W | 0)) * ch];
      if (v > 127 && (cls[y * W + x] === 0 || t === 2 || t === 3)) cls[y * W + x] = t;
    }
  }

  onStep?.("Tracing roof lines and siding…");
  const { seg, L, A, B, S } = slic(rgba, W, H);
  const n = seg.reduce((m, v) => Math.max(m, v), 0) + 1;
  // per-superpixel features
  const F = Array.from({ length: n }, () => ({ n: 0, L: 0, L2: 0, A: 0, B: 0, x: 0, y: 0, gx: 0, gy: 0, c: [0, 0, 0, 0, 0, 0], nb: new Set() }));
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const f = F[seg[i]];
    f.n++; f.L += L[i]; f.L2 += L[i] * L[i]; f.A += A[i]; f.B += B[i]; f.x += x; f.y += y; f.c[cls[i]]++;
    if (x < W - 1) { f.gx += Math.abs(L[i + 1] - L[i]); if (seg[i + 1] !== seg[i]) { f.nb.add(seg[i + 1]); F[seg[i + 1]].nb.add(seg[i]); } }
    if (y < H - 1) { f.gy += Math.abs(L[i + W] - L[i]); if (seg[i + W] !== seg[i]) { f.nb.add(seg[i + W]); F[seg[i + W]].nb.add(seg[i]); } }
  }
  for (const f of F) {
    if (!f.n) continue;
    for (const k2 of ["L", "L2", "A", "B", "x", "y", "gx", "gy"]) f[k2] /= f.n;
    f.std = Math.sqrt(Math.max(0, f.L2 - f.L * f.L));
    let best = 0; for (let c = 1; c < 6; c++) if (f.c[c] > f.c[best]) best = c;
    // a patch counts as house when the model says so for most of it
    f.cls = best === 0 && f.c[1] > f.n * 0.35 ? 1 : best;
    f.chroma = Math.hypot(f.A, f.B);
  }
  const house = F.map((f, i) => (f.n && f.cls === 1 ? i : -1)).filter((i) => i >= 0);
  if (!house.length) return { W, H, seg, labels: new Uint8Array(n), F, found, ok: false };

  // house extent + its top edge per column
  let hy0 = H, hy1 = 0;
  const top = new Float32Array(W).fill(H);
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) if (F[seg[i]].cls === 1 || F[seg[i]].cls === 2 || F[seg[i]].cls === 3) { if (y < top[x]) top[x] = y; hy0 = Math.min(hy0, y); hy1 = Math.max(hy1, y); }
  const Hh = Math.max(1, hy1 - hy0);

  const label = new Uint8Array(n); // zone per superpixel
  for (let i = 0; i < n; i++) { const c = F[i].cls; if (c === 2) label[i] = ZONE.window; if (c === 3) label[i] = ZONE.door; }

  // seeds
  const roofSeed = new Set(), sidingSeed = new Set();
  for (const i of house) {
    const f = F[i], tx = top[Math.min(W - 1, Math.round(f.x))];
    const aboveOutside = [...f.nb].some((j) => F[j].y < f.y - S * 0.3 && (F[j].cls === 4 || F[j].cls === 5 || F[j].cls === 0));
    if (f.y <= tx + Math.max(S * 1.6, Hh * 0.06) && aboveOutside) roofSeed.add(i);
    const nearOpening = [...f.nb].some((j) => F[j].cls === 2 || F[j].cls === 3);
    if (nearOpening && f.y > tx + Hh * 0.12) sidingSeed.add(i);
  }
  for (const i of roofSeed) sidingSeed.delete(i);
  if (!sidingSeed.size) for (const i of house) if (F[i].y > hy0 + Hh * 0.7) sidingSeed.add(i);

  // classify every house patch by its nearest look-alike: a few color/texture prototypes for roof
  // (from the seeds along the top edge) and for siding (from the lower walls), then smooth with neighbors
  const isHouse = new Uint8Array(n); house.forEach((i) => (isHouse[i] = 1));
  const feat = (f) => [f.L, 1.4 * f.A, 1.4 * f.B, 2.2 * (f.gx + f.gy), 0.8 * (f.gy - f.gx)];
  const fd = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2], u[3] - v[3], u[4] - v[4]);
  function protos(ids, k) {
    const pts = [...ids].map((i) => ({ v: feat(F[i]), w: F[i].n }));
    if (!pts.length) return [];
    const cs = [pts[0].v.slice()];
    while (cs.length < Math.min(k, pts.length)) { // farthest-point init, then a few k-means rounds
      let best = null, bd = -1;
      for (const p2 of pts) { const d2 = Math.min(...cs.map((c) => fd(p2.v, c))); if (d2 > bd) { bd = d2; best = p2; } }
      if (bd < 8) break;
      cs.push(best.v.slice());
    }
    for (let it = 0; it < 6; it++) {
      const acc = cs.map(() => [0, 0, 0, 0, 0, 0]);
      for (const p2 of pts) { let bi = 0, bd = Infinity; cs.forEach((c, ci) => { const d2 = fd(p2.v, c); if (d2 < bd) { bd = d2; bi = ci; } }); const a2 = acc[bi]; for (let q = 0; q < 5; q++) a2[q] += p2.v[q] * p2.w; a2[5] += p2.w; }
      acc.forEach((a2, ci) => { if (a2[5]) cs[ci] = a2.slice(0, 5).map((v) => v / a2[5]); });
    }
    return cs;
  }
  // siding seeds: the lower walls, unless a patch there looks just like the roof seeds
  const roofP0 = protos(roofSeed, 3);
  for (const i of house) {
    const f = F[i];
    if (roofSeed.has(i) || sidingSeed.has(i)) continue;
    if ((f.y - hy0) / Hh > 0.62 && Math.min(...roofP0.map((c) => fd(feat(f), c))) > 14) sidingSeed.add(i);
  }
  const roofP = protos(roofSeed, 3), sideP = protos(sidingSeed, 4);
  const touchesSky = (i) => [...F[i].nb].some((j) => (F[j].cls === 4 || F[j].cls === 5 || F[j].cls === 0) && F[j].y < F[i].y);
  const relY = (f) => (f.y - hy0) / Hh;
  const cost = house.map((i) => {
    const f = F[i], v = feat(f);
    const dr = roofP.length ? Math.min(...roofP.map((c) => fd(v, c))) : 99, ds = sideP.length ? Math.min(...sideP.map((c) => fd(v, c))) : 99;
    return [dr + relY(f) * 7 - (touchesSky(i) ? 5 : 0), ds + (1 - relY(f)) * 3];
  });
  const idx = new Map(house.map((i, k2) => [i, k2]));
  const zone = new Uint8Array(n);
  house.forEach((i, k2) => (zone[i] = cost[k2][0] < cost[k2][1] ? 1 : 2));
  roofSeed.forEach((i) => (zone[i] = 1));
  // neighbor smoothing: similar-looking neighbors pull a patch toward their label
  for (let it = 0; it < 5; it++) {
    for (const i of house) {
      const f = F[i], c = cost[idx.get(i)], vote = [0, 0, 0];
      for (const j of f.nb) if (isHouse[j]) vote[zone[j]] += Math.exp(-fd(feat(f), feat(F[j])) / 10);
      const s1 = c[0] - 5 * vote[1], s2 = c[1] - 5 * vote[2];
      zone[i] = s1 < s2 ? 1 : 2;
    }
  }
  const mean = { 2: [0, 0, 0, 0, 0] };
  for (const i of house) if (zone[i] === 2) { const f = F[i], m2 = mean[2]; m2[0] += f.L * f.n; m2[4] += f.n; }

  // trim: light, neutral patches that are clearly lighter than the siding (fascia, corner boards, casings, columns)
  const sm = mean[2], sL = sm[4] ? sm[0] / sm[4] : 50;
  for (const i of house) {
    const f = F[i];
    if (zone[i] === 2 && f.L > Math.max(sL + 12, 72) && f.chroma < 14) zone[i] = 3;
    if (zone[i] === 1 && f.L > 82 && f.chroma < 10 && [...f.nb].some((j) => zone[j] === 2)) zone[i] = 3; // white fascia at the eave
  }
  // windows: the model rarely marks glass on exteriors, so siding patches that look nothing like
  // any siding sample (dark glass, lit windows, reflections) are left as they are
  for (const i of house) {
    if (zone[i] !== 2) continue;
    const f = F[i], v = feat(f), d = sideP.length ? Math.min(...sideP.map((c) => fd(v, c))) : 0;
    if (d > 24 && (f.L < sL - 16 || f.chroma > 28 || f.L > sL + 30)) zone[i] = ZONE.window;
  }
  // brick and stone: busy texture that runs every direction (lap and board siding run one way) — kept as is
  const masonry = (f) => f.std > 6.5 && (f.gx + f.gy) > 7.5 && Math.abs(f.gy - f.gx) / (f.gx + f.gy + 1e-6) < 0.25;
  const masonSeed = house.filter((i) => zone[i] === 2 && masonry(F[i]));
  for (const i of masonSeed) {
    // only where it's a real area of masonry (a few neighbors agree), not a single busy patch
    const agree = [...F[i].nb].filter((j) => isHouse[j] && masonry(F[j])).length;
    if (agree >= 2) zone[i] = ZONE.masonry;
  }
  for (const i of house) label[i] = zone[i] || ZONE.siding;

  return { W, H, seg, labels: label, F, found: [...new Set(found)], ok: true, S };
}

/* one click: move the clicked patch, and the connected look-alike patches with the same label, to a new zone */
export function reassign(d, x, y, toZone) {
  const i0 = d.seg[Math.min(d.H - 1, Math.max(0, y | 0)) * d.W + Math.min(d.W - 1, Math.max(0, x | 0))];
  const from = d.labels[i0], f0 = d.F[i0], seen = new Set([i0]), st = [i0];
  const close = (f) => Math.hypot(f.L - f0.L, f.A - f0.A, f.B - f0.B) < 16;
  while (st.length) {
    const a = st.pop();
    d.labels[a] = toZone;
    for (const b of d.F[a].nb) if (!seen.has(b) && d.labels[b] === from && close(d.F[b])) { seen.add(b); st.push(b); }
  }
  return seen.size;
}

/* the label map as a small canvas per zone (alpha = 255 inside); the caller scales them up smoothly */
export function zoneMasks(d) {
  const out = {};
  for (const [name, z] of Object.entries(ZONE)) {
    if (!z || z === ZONE.window || z === ZONE.masonry) continue;
    const c = document.createElement("canvas"); c.width = d.W; c.height = d.H;
    const g = c.getContext("2d"), img = g.createImageData(d.W, d.H);
    let any = 0;
    for (let i = 0; i < d.W * d.H; i++) if (d.labels[d.seg[i]] === z) { img.data[i * 4 + 3] = 255; any++; }
    g.putImageData(img, 0, 0);
    out[name] = { canvas: c, pixels: any };
  }
  return out;
}
