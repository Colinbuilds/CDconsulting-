/* Procedural + photo textures for the 3D house.
   Procedural maps are near-white albedo so a material's .color = the product color. */
import * as THREE from "three";

const cache = new Map();
let anisotropy = 4;
export const setAnisotropy = (a) => { anisotropy = a; };

function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")];
}

function tex(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  return t;
}

function grain(ctx, w, h, rnd, amount, alpha = 0.06) {
  for (let i = 0; i < amount; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rnd()})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
}

const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

/* ---------- photo textures (CC0, Poly Haven) ---------- */
const loader = new THREE.TextureLoader();
const listeners = new Set();
let pending = 0, total = 0;
/* subscribe to "a texture finished loading" so each 3D view can re-render */
export const onTextureLoad = (fn) => { listeners.add(fn); if (pending === 0) fn(0, total); };
/* count any other async asset (the HDR sky) toward "everything loaded" */
export function trackLoad() {
  pending++; total++;
  let once = false;
  return () => { if (once) return; once = true; pending--; listeners.forEach((f) => f(pending, total)); };
}
export function photo(name, { srgb = true, repeat = 1, repeatY } = {}) {
  return memo(`photo:${name}:${srgb}:${repeat}:${repeatY}`, () => {
    pending++; total++;
    const done = () => { pending--; listeners.forEach((f) => f(pending, total)); };
    const t = loader.load(`images/tex/${name}.webp`, done, undefined, done);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = anisotropy;
    t.repeat.set(repeat, repeatY ?? repeat);
    return t;
  });
}

/* ---------- shingles ----------
   Architectural shingle strip: 3ft × 1ft face, two laminated layers. */
export function shingleStrip() {
  return memo("shingleStrip", () => {
    const W = 384, H = 128, rnd = seeded(7);
    const [c, x] = canvas(W, H);
    const [b, y] = canvas(W, H);
    x.fillStyle = "#d8d8d8"; x.fillRect(0, 0, W, H);
    y.fillStyle = "#808080"; y.fillRect(0, 0, W, H);
    // top (hidden) half lighter, exposed bottom has laminated tabs
    let px = 0;
    while (px < W) {
      const tw = 22 + rnd() * 46;
      const v = 200 + rnd() * 45;
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(px, H * 0.42, tw, H * 0.58);
      // laminate dragon-tooth shadow (subtle in color; the bump map carries the depth)
      if (rnd() < 0.7) {
        const sv = v * (0.8 + rnd() * 0.08);
        x.fillStyle = `rgb(${sv},${sv},${sv})`;
        const top = H * (0.62 + rnd() * 0.15);
        x.fillRect(px + tw * rnd() * 0.3, top, tw * (0.5 + rnd() * 0.5), H - top);
        y.fillStyle = "#606060";
        y.fillRect(px, top, tw, H - top);
      }
      y.fillStyle = "#3a3a3a"; y.fillRect(px, H * 0.42, 1.5, H * 0.58);
      px += tw;
    }
    grain(x, W, H, rnd, 9000, 0.18);
    grain(y, W, H, rnd, 6000, 0.25);
    y.fillStyle = "#202020"; y.fillRect(0, H - 3, W, 3);
    const map = tex(c), bump = tex(b, { srgb: false });
    return { map, bump };
  });
}

/* Tiled roof surface (for the old roof + far LOD): 6ft × 6ft, 5" courses */
export function shingleTile(seed = 3) {
  return memo("shingleTile" + seed, () => {
    const S = 1024, rnd = seeded(seed);
    const [c, x] = canvas(S, S);
    const [b, y] = canvas(S, S);
    const course = S / 14.4;
    for (let r = 0; r < 15; r++) {
      const y0 = S - (r + 1) * course;
      let px = -rnd() * 60;
      while (px < S) {
        const tw = 40 + rnd() * 70;
        const v = 165 + rnd() * 80;
        x.fillStyle = `rgb(${v},${v * 0.97},${v * 0.94})`;
        x.fillRect(px, y0, tw, course);
        y.fillStyle = "#909090"; y.fillRect(px, y0, tw, course);
        if (rnd() < 0.55) {
          const sv = v * 0.62;
          x.fillStyle = `rgb(${sv},${sv},${sv})`;
          x.fillRect(px, y0 + course * 0.55, tw * 0.8, course * 0.45);
        }
        y.fillStyle = "#505050"; y.fillRect(px, y0, 2, course);
        px += tw;
      }
      x.fillStyle = "rgba(0,0,0,.5)"; x.fillRect(0, y0 + course - 3, S, 3);
      y.fillStyle = "#1a1a1a"; y.fillRect(0, y0 + course - 3, S, 3);
    }
    grain(x, S, S, rnd, 60000, 0.2);
    // weathering streaks
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(30,25,20,${0.04 + rnd() * 0.06})`;
      x.fillRect(rnd() * S, rnd() * S, 6 + rnd() * 30, 60 + rnd() * 300);
    }
    return { map: tex(c), bump: tex(b, { srgb: false }), size: 6 };
  });
}

export function metalSeam() {
  return memo("metal", () => {
    const W = 256, H = 64, rnd = seeded(5);
    const [c, x] = canvas(W, H);
    const [b, y] = canvas(W, H);
    x.fillStyle = "#e6e6e6"; x.fillRect(0, 0, W, H);
    const g = y.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.03, "#7a7a7a"); g.addColorStop(0.97, "#808080"); g.addColorStop(1, "#ffffff");
    y.fillStyle = g; y.fillRect(0, 0, W, H);
    // stiffening ribs
    y.fillStyle = "#8a8a8a"; y.fillRect(W * 0.33, 0, 2, H); y.fillRect(W * 0.66, 0, 2, H);
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, 4, H);
    x.fillStyle = "#bdbdbd"; x.fillRect(5, 0, 2, H);
    grain(x, W, H, rnd, 1500, 0.05);
    return { map: tex(c), bump: tex(b, { srgb: false }), size: 16 / 12 };
  });
}

/* ---------- siding ---------- */
export function siding(profile) {
  return memo("siding:" + profile, () => {
    const S = 1024, rnd = seeded(profile.length * 13);
    const [c, x] = canvas(S, S);
    const [b, y] = canvas(S, S);
    x.fillStyle = "#e9e9e9"; x.fillRect(0, 0, S, S);
    let size;
    if (profile === "lap") {
      size = 7; // 7ft tile, 7" exposure = 12 courses
      const n = 12, h = S / n;
      for (let i = 0; i < n; i++) {
        const y0 = i * h;
        const g = y.createLinearGradient(0, y0, 0, y0 + h);
        g.addColorStop(0, "#202020"); g.addColorStop(0.06, "#9a9a9a"); g.addColorStop(1, "#d0d0d0");
        y.fillStyle = g; y.fillRect(0, y0, S, h);
        const gx = x.createLinearGradient(0, y0, 0, y0 + h);
        gx.addColorStop(0, "rgba(0,0,0,.42)"); gx.addColorStop(0.08, "rgba(0,0,0,.1)"); gx.addColorStop(1, "rgba(255,255,255,.06)");
        x.fillStyle = gx; x.fillRect(0, y0, S, h);
        // butt joints
        if (rnd() < 0.6) { const jx = rnd() * S; x.fillStyle = "rgba(0,0,0,.18)"; x.fillRect(jx, y0, 2, h); }
      }
      // cedarmill grain
      for (let i = 0; i < 1800; i++) {
        x.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.04})`;
        x.fillRect(rnd() * S, rnd() * S, 30 + rnd() * 140, 1);
      }
    } else if (profile === "batten") {
      size = 8; // 8 boards of 12"
      const n = 8, w = S / n;
      y.fillStyle = "#909090"; y.fillRect(0, 0, S, S);
      for (let i = 0; i < n; i++) {
        const x0 = i * w;
        const bw = w * 0.17;
        const g = x.createLinearGradient(x0 - bw / 2, 0, x0 + bw / 2 + 6, 0);
        g.addColorStop(0, "rgba(255,255,255,.08)"); g.addColorStop(0.8, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.35)");
        x.fillStyle = g; x.fillRect(x0 - bw / 2, 0, bw + 6, S);
        y.fillStyle = "#f0f0f0"; y.fillRect(x0 - bw / 2, 0, bw, S);
        y.fillStyle = "#505050"; y.fillRect(x0 + bw / 2, 0, 3, S);
      }
      for (let i = 0; i < 1500; i++) {
        x.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.04})`;
        x.fillRect(rnd() * S, rnd() * S, 1, 30 + rnd() * 140);
      }
    } else {
      size = 7; // shake: 7" exposure, random widths
      const n = 12, h = S / n;
      for (let i = 0; i < n; i++) {
        const y0 = i * h;
        let px = -rnd() * 40;
        while (px < S) {
          const tw = 30 + rnd() * 80;
          const v = 205 + rnd() * 40;
          x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(px, y0, tw, h);
          for (let k = 0; k < 8; k++) { x.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; x.fillRect(px + rnd() * tw, y0, 1, h); }
          x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(px, y0, 2, h);
          const g = y.createLinearGradient(0, y0, 0, y0 + h);
          g.addColorStop(0, "#303030"); g.addColorStop(0.1, "#909090"); g.addColorStop(1, "#c8c8c8");
          y.fillStyle = g; y.fillRect(px, y0, tw, h);
          y.fillStyle = "#404040"; y.fillRect(px, y0, 2, h);
          px += tw + 2;
        }
        x.fillStyle = "rgba(0,0,0,.4)"; x.fillRect(0, y0, S, 4);
      }
    }
    grain(x, S, S, rnd, 30000, 0.05);
    return { map: tex(c), bump: tex(b, { srgb: false }), size };
  });
}

/* ---------- substrates ---------- */
export function osb() {
  return memo("osb", () => {
    const S = 1024, rnd = seeded(21);
    const [c, x] = canvas(S, S);
    x.fillStyle = "#b8976a"; x.fillRect(0, 0, S, S);
    const pal = ["#9b7a4f", "#cfb184", "#a8865a", "#8a6a43", "#d9c09a", "#bc9a6c", "#7d5f3c"];
    for (let i = 0; i < 26000; i++) {
      x.strokeStyle = pal[(rnd() * pal.length) | 0];
      x.lineWidth = 1 + rnd() * 2.5;
      const px = rnd() * S, py = rnd() * S, a = rnd() * Math.PI, l = 6 + rnd() * 16;
      x.beginPath(); x.moveTo(px - Math.cos(a) * l, py - Math.sin(a) * l); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
    // 4×8 sheet seams (tile = 8ft × 8ft, two 4ft rows)
    x.fillStyle = "rgba(60,40,20,.55)";
    x.fillRect(0, S / 2 - 2, S, 3); x.fillRect(0, S - 3, S, 3);
    x.fillRect(S - 3, 0, 3, S / 2); x.fillRect(S / 2 - 1, S / 2, 3, S / 2);
    // nail lines
    x.fillStyle = "rgba(40,30,20,.5)";
    for (let k = 1; k < 4; k++) for (let j = 0; j < 40; j++) x.fillRect(j * (S / 40) + 6, k * S / 4 - 12, 3, 3);
    return { map: tex(c), size: 8 };
  });
}

function printed(base, ink, text, rows, font, seed) {
  const S = 1024, rnd = seeded(seed);
  const [c, x] = canvas(S, S);
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  grain(x, S, S, rnd, 40000, 0.07);
  const h = S / rows;
  x.font = font;
  for (let r = 0; r < rows; r++) {
    const y0 = r * h;
    x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(0, y0, S, 3);
    x.fillStyle = ink;
    x.fillRect(0, y0 + h * 0.18, S, 2); x.fillRect(0, y0 + h * 0.82, S, 2);
    for (let i = 0; i < 4; i++) x.fillText(text, i * 256 + (r % 2) * 128 + 10, y0 + h * 0.58);
  }
  return tex(c);
}
export function underlayment() {
  return memo("under", () => ({ map: printed("#4a4e55", "rgba(110,150,235,.85)", "CD//SHIELD", 4, "700 26px monospace", 31), size: 12 }));
}
export function houseWrap() {
  return memo("wrap", () => ({ map: printed("#e9ecf0", "rgba(40,95,225,.85)", "CD//WRAP", 3, "800 44px monospace", 41), size: 9 }));
}

/* ---------- foliage ---------- */
export function leaves(kind = "tree") {
  return memo("leaves:" + kind, () => {
    const S = 512, rnd = seeded(kind === "tree" ? 51 : 61);
    const [c, x] = canvas(S, S);
    const greens = kind === "tree"
      ? ["#3f5f2a", "#4d7031", "#5c7f38", "#36521f", "#6b8b3d", "#2f4a1c", "#55762f"]
      : ["#2c4a22", "#355a28", "#3f652d", "#264019", "#4a6e33"];
    const n = kind === "tree" ? 520 : 900;
    for (let i = 0; i < n; i++) {
      // clump toward the center so card edges stay ragged
      const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.65) * S * 0.46;
      const px = S / 2 + Math.cos(a) * r, py = S / 2 + Math.sin(a) * r;
      const L = kind === "tree" ? 14 + rnd() * 16 : 7 + rnd() * 8;
      x.save();
      x.translate(px, py);
      x.rotate(rnd() * Math.PI * 2);
      x.fillStyle = greens[(rnd() * greens.length) | 0];
      x.beginPath();
      x.moveTo(-L, 0);
      x.quadraticCurveTo(0, -L * 0.45, L, 0);
      x.quadraticCurveTo(0, L * 0.45, -L, 0);
      x.fill();
      x.strokeStyle = "rgba(0,0,0,.18)"; x.lineWidth = 1;
      x.beginPath(); x.moveTo(-L * 0.9, 0); x.lineTo(L * 0.9, 0); x.stroke();
      x.restore();
    }
    const t = tex(c, { repeat: false });
    return t;
  });
}

/* ---------- details ---------- */
export function garageDoor() {
  return memo("garage", () => {
    const W = 1024, H = 512, rnd = seeded(71);
    const [c, x] = canvas(W, H);
    const [b, y] = canvas(W, H);
    x.fillStyle = "#e8e8e8"; x.fillRect(0, 0, W, H);
    y.fillStyle = "#808080"; y.fillRect(0, 0, W, H);
    const rows = 4, cols = 8;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const pw = W / cols, ph = H / rows;
      const x0 = k * pw + 12, y0 = r * ph + 12;
      if (r === 0) { x.fillStyle = "#1d2632"; x.fillRect(x0 + 6, y0 + 10, pw - 36, ph - 44); continue; }
      y.fillStyle = "#b0b0b0"; y.fillRect(x0, y0, pw - 24, ph - 24);
      y.fillStyle = "#505050"; y.fillRect(x0, y0 + ph - 26, pw - 24, 3);
      x.fillStyle = "rgba(0,0,0,.08)"; x.fillRect(x0, y0 + ph - 28, pw - 24, 4);
    }
    x.fillStyle = "rgba(0,0,0,.35)";
    for (let r = 1; r < rows; r++) x.fillRect(0, r * (H / rows) - 2, W, 3);
    grain(x, W, H, rnd, 8000, 0.05);
    return { map: tex(c, { repeat: false }), bump: tex(b, { srgb: false, repeat: false }) };
  });
}

export function boards(color = "#8d8a84", seed = 81) {
  return memo("boards" + color, () => {
    const S = 512, rnd = seeded(seed);
    const [c, x] = canvas(S, S);
    x.fillStyle = color; x.fillRect(0, 0, S, S);
    const n = 10, h = S / n;
    for (let i = 0; i < n; i++) {
      x.fillStyle = `rgba(${rnd() < 0.5 ? 0 : 255},${0},${0},0)`;
      const v = (rnd() - 0.5) * 0.12;
      x.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      x.fillRect(0, i * h, S, h);
      x.fillStyle = "rgba(0,0,0,.4)"; x.fillRect(0, i * h, S, 2);
      x.fillRect(rnd() * S, i * h, 2, h);
    }
    grain(x, S, S, rnd, 8000, 0.08);
    return { map: tex(c), size: 5 };
  });
}
