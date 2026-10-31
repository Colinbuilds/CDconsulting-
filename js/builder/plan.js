/* Building designer: the 2D plan. One SVG renderer serves the editor and the printed floor plans
   (units are feet; 1 SVG unit = 1 ft). The editor turns clicks and drags into document edits. */
import * as C from "./core.js";
import { ASSEMBLIES, ITEMS, RUNS, FLOORS, OPENINGS, LAYER_OF } from "./catalog.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f2 = (v) => Math.round(v * 100) / 100;

/* ---------- rendering ---------- */
export function renderPlan(doc, L, o = {}) {
  const lay = o.layers || {}, print = !!o.print, sel = o.sel || {}, out = [];
  const rl = C.rooms(doc, L);
  // floor below, faint, so upper floors line up
  if (!print && L > 0) for (const w of C.wallsOn(doc, L - 1)) { const [a, b] = C.ends(doc, w); out.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="ghost" stroke-width="${C.thick(w)}"/>`); }
  // rooms
  for (const r of rl) {
    const pts = r.pts.map((p) => `${p.x},${p.y}`).join(" ");
    const on = sel.kind === "room" && sel.key === r.key;
    out.push(`<polygon points="${pts}" class="room floor-${r.floor}${on ? " is-sel" : ""}" data-kind="room" data-id="${r.key}"/>`);
  }
  // roofs (outline + ridge / hip lines)
  if (lay.roof !== false) for (const rf of doc.roofs.filter((x) => x.level === L || print)) {
    if (print && rf.level !== L && !o.roofPlan) continue;
    const ov = rf.overhang, x0 = rf.x - ov, y0 = rf.y - ov, x1 = rf.x + rf.w + ov, y1 = rf.y + rf.d + ov, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const lines = [];
    if (rf.type === "gable") lines.push(rf.ridge === "x" ? [x0, cy, x1, cy] : [cx, y0, cx, y1]);
    if (rf.type === "hip") { const s = Math.min(x1 - x0, y1 - y0) / 2; if (x1 - x0 >= y1 - y0) lines.push([x0 + s, cy, x1 - s, cy], [x0, y0, x0 + s, cy], [x0, y1, x0 + s, cy], [x1, y0, x1 - s, cy], [x1, y1, x1 - s, cy]); else lines.push([cx, y0 + s, cx, y1 - s], [x0, y0, cx, y0 + s], [x1, y0, cx, y0 + s], [x0, y1, cx, y1 - s], [x1, y1, cx, y1 - s]); }
    const on = sel.kind === "roof" && sel.id === rf.id;
    out.push(`<g class="roof${on ? " is-sel" : ""}" data-kind="roof" data-id="${rf.id}"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/>${lines.map((l) => `<line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}"/>`).join("")}${o.roofPlan ? `<text x="${cx}" y="${cy - 1}" class="roof-note">${rf.type === "flat" ? "FLAT · TAPERED INSULATION TO DRAINS" : `${rf.pitch}/12 ${rf.type.toUpperCase()}`}</text>` : ""}</g>`);
  }
  // walls, split around openings; doors and windows in the gaps
  let tagD = o.tags?.D || 0, tagW = o.tags?.W || 0;
  for (const w of C.wallsOn(doc, L)) {
    const [a, b] = C.ends(doc, w), len = C.dist(a, b);
    if (len < 0.05) continue;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len, nx = -uy, ny = ux, t = C.thick(w);
    const side = C.outsideSide(doc, w, rl), ext = !!ASSEMBLIES[w.asm]?.ext;
    const at = (s, k = 0) => [f2(a.x + ux * s + nx * k), f2(a.y + uy * s + ny * k)];
    const ops = doc.openings.filter((x) => x.wall === w.id).sort((m, n) => m.t - n.t);
    const on = sel.kind === "wall" && sel.id === w.id;
    let s = 0;
    const seg = (s0, s1) => { if (s1 - s0 > 0.01) { const [x0, y0] = at(s0), [x1, y1] = at(s1); out.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" class="wall${ext ? " ext" : ""}${on ? " is-sel" : ""}" stroke-width="${t}" data-kind="wall" data-id="${w.id}"/>`); } };
    for (const op of ops) {
      seg(s, op.t);
      const os = sel.kind === "opening" && sel.id === op.id ? " is-sel" : "";
      const [p0x, p0y] = at(op.t), [p1x, p1y] = at(op.t + op.w);
      const sw = op.swing || 1, hingeEnd = op.hinge ? op.t + op.w : op.t, freeEnd = op.hinge ? op.t : op.t + op.w;
      let g = "";
      if (op.type === "window") {
        const [ax, ay] = at(op.t, t / 2), [bx, by] = at(op.t + op.w, t / 2), [cx, cy] = at(op.t + op.w, -t / 2), [dx, dy] = at(op.t, -t / 2);
        g = `<polygon points="${ax},${ay} ${bx},${by} ${cx},${cy} ${dx},${dy}" class="win"/><line x1="${p0x}" y1="${p0y}" x2="${p1x}" y2="${p1y}" class="win-line"/>`;
        if (o.print) { tagW++; const [tx, ty] = at(op.t + op.w / 2, (side === 1 ? 1 : -1) * (t / 2 + 1.1)); g += `<text x="${tx}" y="${ty + 0.3}" class="tag">W${tagW}</text>`; op._tag = "W" + tagW; }
      } else if (op.type === "door") {
        if (["patio", "storefront", "garage", "overhead", "pocket"].includes(op.style)) {
          const [ax, ay] = at(op.t, t * 0.2), [bx, by] = at(op.t + op.w * 0.55, t * 0.2), [cx, cy] = at(op.t + op.w * 0.45, -t * 0.2), [dx, dy] = at(op.t + op.w, -t * 0.2);
          g = op.style === "garage" || op.style === "overhead" ? `<line x1="${p0x}" y1="${p0y}" x2="${p1x}" y2="${p1y}" class="door-line dashed"/>`
            : `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" class="door-line"/><line x1="${cx}" y1="${cy}" x2="${dx}" y2="${dy}" class="door-line"/>`;
        } else {
          // leaf drawn open 90° with its swing arc
          const r = op.w, [hx, hy] = at(hingeEnd), [ex, ey] = at(hingeEnd, sw * r * (op.hinge ? 1 : 1)), [fx, fy] = at(freeEnd);
          const leafEnd = [f2(hx + nx * sw * r), f2(hy + ny * sw * r)];
          void ex; void ey;
          const sweep = (op.hinge ? 1 : 0) ^ (sw > 0 ? 0 : 1);
          g = `<line x1="${hx}" y1="${hy}" x2="${leafEnd[0]}" y2="${leafEnd[1]}" class="door-line"/><path d="M${leafEnd[0]} ${leafEnd[1]} A${r} ${r} 0 0 ${sweep} ${fx} ${fy}" class="door-arc"/>`;
        }
        if (o.print) { tagD++; const [tx, ty] = at(op.t + op.w / 2, (side === 1 ? 1 : -1) * (t / 2 + 1.1)); g += `<text x="${tx}" y="${ty + 0.3}" class="tag">D${tagD}</text>`; op._tag = "D" + tagD; }
      }
      out.push(`<g class="opening${os}" data-kind="opening" data-id="${op.id}"><line x1="${p0x}" y1="${p0y}" x2="${p1x}" y2="${p1y}" class="op-hit" stroke-width="${t + 0.6}"/>${g}</g>`);
      s = op.t + op.w;
    }
    seg(s, len);
    // dimension along the wall
    if (lay.dims !== false) {
      const off = side === 1 ? t / 2 + 2 : side === -1 ? -(t / 2 + 2) : 0;
      if (len > 1.5) {
        const [x0, y0] = at(0, off), [x1, y1] = at(len, off), [mx, my] = at(len / 2, off + (off ? Math.sign(off) * 0.55 : 0.55));
        let ang = (Math.atan2(uy, ux) * 180) / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        if (off) out.push(`<g class="dim"><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/><line x1="${x0 - nx * 0.4}" y1="${y0 - ny * 0.4}" x2="${x0 + nx * 0.4}" y2="${y0 + ny * 0.4}"/><line x1="${x1 - nx * 0.4}" y1="${y1 - ny * 0.4}" x2="${x1 + nx * 0.4}" y2="${y1 + ny * 0.4}"/>`
          + `<text transform="translate(${mx} ${my}) rotate(${f2(ang)})" y="0.3">${C.fmtFtIn(len)}</text></g>`);
        else out.push(`<g class="dim inner"><text transform="translate(${mx} ${my}) rotate(${f2(ang)})" y="0.3">${C.fmtFtIn(len)}</text></g>`);
      }
    }
  }
  // runs
  for (const run of doc.runs.filter((r) => r.level === L)) {
    const spec = RUNS[run.system];
    if (!spec || lay[spec.layer] === false) continue;
    const on = sel.kind === "run" && sel.id === run.id;
    out.push(`<polyline points="${run.pts.map((p) => p.join(",")).join(" ")}" class="run run-${run.system}${on ? " is-sel" : ""}" stroke="${spec.color}" ${spec.dash ? 'stroke-dasharray=".6 .4"' : ""} stroke-width="${spec.width ? spec.width : 0.25}" data-kind="run" data-id="${run.id}"/>`);
  }
  // items
  for (const it of doc.objects.filter((x) => x.level === L)) {
    const spec = ITEMS[it.type];
    if (!spec) continue;
    const layer = LAYER_OF(spec);
    if (lay[layer] === false) continue;
    const w = it.w || spec.w, d = it.d || spec.d, on = sel.kind === "item" && sel.id === it.id;
    out.push(`<g transform="translate(${f2(it.x)} ${f2(it.y)}) rotate(${(it.rot || 0) * 90})" class="item g-${layer}${on ? " is-sel" : ""}" data-kind="item" data-id="${it.id}"><rect x="${-w / 2}" y="${-d / 2}" width="${w}" height="${d}" class="item-hit"/>${spec.plan(w, d)}</g>`);
  }
  // room labels last, on top
  for (const r of rl) {
    const A = Math.abs(r.area);
    out.push(`<g class="room-label"><text x="${f2(r.c.x)}" y="${f2(r.c.y)}">${esc(r.name || (print ? "" : "Room"))}</text><text x="${f2(r.c.x)}" y="${f2(r.c.y + 1.3)}" class="area">${Math.round(A)} sq ft${print ? ` · ${FLOORS[r.floor]?.name || ""}` : ""}</text></g>`);
  }
  // overall dimensions on prints
  if (print) {
    const b = C.bounds(doc, L);
    if (b) {
      const W = b.x1 - b.x0, D = b.y1 - b.y0, y = b.y0 - 6, x = b.x0 - 6;
      out.push(`<g class="dim overall"><line x1="${b.x0}" y1="${y}" x2="${b.x1}" y2="${y}"/><line x1="${b.x0}" y1="${y - 0.5}" x2="${b.x0}" y2="${y + 0.5}"/><line x1="${b.x1}" y1="${y - 0.5}" x2="${b.x1}" y2="${y + 0.5}"/><text x="${(b.x0 + b.x1) / 2}" y="${y - 0.6}">${C.fmtFtIn(W)}</text>`
        + `<line x1="${x}" y1="${b.y0}" x2="${x}" y2="${b.y1}"/><line x1="${x - 0.5}" y1="${b.y0}" x2="${x + 0.5}" y2="${b.y0}"/><line x1="${x - 0.5}" y1="${b.y1}" x2="${x + 0.5}" y2="${b.y1}"/><text transform="translate(${x - 0.7} ${(b.y0 + b.y1) / 2}) rotate(-90)">${C.fmtFtIn(D)}</text></g>`);
    }
  }
  return { svg: out.join(""), tags: { D: tagD, W: tagW } };
}

/* ---------- the editor ---------- */
export class PlanEditor {
  constructor(svg, app) {
    this.svg = svg; this.app = app;
    this.view = { x: -10, y: -10, w: 80, h: 50 };
    this.temp = null; // in-progress drawing
    this.drag = null;
    svg.addEventListener("pointerdown", (e) => this.down(e));
    svg.addEventListener("pointermove", (e) => this.move(e));
    svg.addEventListener("pointerup", (e) => this.up(e));
    svg.addEventListener("dblclick", () => this.finish());
    svg.addEventListener("wheel", (e) => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, this.pt(e)); }, { passive: false });
    svg.addEventListener("contextmenu", (e) => { e.preventDefault(); this.cancel(); });
    new ResizeObserver(() => this.applyView()).observe(svg);
  }
  get doc() { return this.app.doc; }
  get L() { return this.app.level; }
  pt(e) {
    const p = this.svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(this.svg.getScreenCTM().inverse());
    return { x: q.x, y: q.y };
  }
  ftPerPx() { const r = this.svg.getBoundingClientRect(); return Math.max(this.view.w / r.width, this.view.h / r.height); }
  applyView() {
    const r = this.svg.getBoundingClientRect();
    if (!r.width) return;
    // keep the aspect of the element; svg viewBox is the visible window
    const k = r.width / r.height, v = this.view;
    if (v.w / v.h > k) { const nh = v.w / k; v.y -= (nh - v.h) / 2; v.h = nh; } else { const nw = v.h * k; v.x -= (nw - v.w) / 2; v.w = nw; }
    this.svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
    this.render();
  }
  fit() {
    const b = C.bounds(this.doc, this.L) || C.bounds(this.doc) || { x0: 0, y0: 0, x1: 40, y1: 30 };
    const pad = 12;
    this.view = { x: b.x0 - pad, y: b.y0 - pad, w: b.x1 - b.x0 + 2 * pad, h: b.y1 - b.y0 + 2 * pad };
    this.applyView();
  }
  zoom(k, at) {
    const v = this.view, nw = Math.min(800, Math.max(8, v.w * k)), s = nw / v.w;
    v.x = at.x - (at.x - v.x) * s; v.y = at.y - (at.y - v.y) * s; v.w = nw; v.h *= s;
    this.applyView();
  }

  /* snapping: existing corners → points on walls → grid (+ 45° when drawing from a point) */
  snap(p, from, { walls = true } = {}) {
    const tol = 12 * this.ftPerPx(), grid = this.app.grid;
    let best = null, bd = tol;
    for (const n of Object.values(this.doc.nodes)) if (n.level === this.L) { const d = C.dist(n, p); if (d < bd) { bd = d; best = { x: n.x, y: n.y, kind: "node" }; } }
    if (best) return best;
    if (from && !this.app.free) {
      const dx = p.x - from.x, dy = p.y - from.y, L = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), step = Math.PI / 4, a2 = Math.round(ang / step) * step;
      if (Math.abs(ang - a2) < 0.14) { const Lr = Math.round(L / grid) * grid; return { x: C.r2(from.x + Math.cos(a2) * Lr), y: C.r2(from.y + Math.sin(a2) * Lr), kind: "angle" }; }
    }
    if (walls) for (const w of C.wallsOn(this.doc, this.L)) { const [a, b] = C.ends(this.doc, w), q = C.project(p, a, b); if (C.dist(q, p) < bd) { bd = C.dist(q, p); best = { x: C.r2(q.x), y: C.r2(q.y), kind: "wall" }; } }
    if (best) return best;
    return { x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid, kind: "grid" };
  }
  nearestWall(p, max = 3) {
    let best = null, bd = max;
    for (const w of C.wallsOn(this.doc, this.L)) {
      const [a, b] = C.ends(this.doc, w), q = C.project(p, a, b), d = C.dist(q, p);
      if (d < bd) { bd = d; best = { w, q, a, b, d }; }
    }
    return best;
  }

  down(e) {
    if (e.button === 1 || (e.button === 0 && this.app.spaceDown)) { this.drag = { pan: true, sx: e.clientX, sy: e.clientY, v: { ...this.view } }; this.svg.setPointerCapture(e.pointerId); return; }
    if (e.button !== 0) return;
    const p = this.pt(e), tool = this.app.tool, doc = this.doc;
    if (tool === "select") {
      const hit = e.target.closest("[data-kind]"), handle = e.target.closest("[data-node]");
      if (handle) { this.drag = { node: handle.dataset.node }; }
      else if (hit) {
        const kind = hit.dataset.kind, id = hit.dataset.id;
        this.app.select({ kind, id, key: kind === "room" ? id : undefined });
        if (kind === "item") { const it = doc.objects.find((x) => x.id === id); this.drag = { item: it, dx: it.x - p.x, dy: it.y - p.y }; }
        if (kind === "opening") this.drag = { opening: doc.openings.find((x) => x.id === id) };
        if (kind === "wall") { const w = doc.walls.find((x) => x.id === id); this.drag = { wall: w, p0: p, a0: { ...doc.nodes[w.a] }, b0: { ...doc.nodes[w.b] } }; }
        if (kind === "roof") { const r = doc.roofs.find((x) => x.id === id); this.drag = { roof: r, dx: r.x - p.x, dy: r.y - p.y }; }
        if (kind === "run") this.drag = null;
      } else {
        this.app.select(null);
        this.drag = { pan: true, sx: e.clientX, sy: e.clientY, v: { ...this.view } };
      }
      this.svg.setPointerCapture(e.pointerId);
      return;
    }
    const s = this.snap(p, this.temp?.last);
    if (tool === "wall") {
      if (!this.temp) this.temp = { start: s, last: s, first: s };
      else {
        C.addWall(doc, this.L, this.temp.last, s, this.app.asm);
        this.app.commit();
        if (C.dist(s, this.temp.first) < 0.05) { this.temp = null; this.render(); return; } // closed the loop
        this.temp.last = s;
      }
    } else if (tool === "room" || tool === "roof" || (tool === "item" && ITEMS[this.app.item]?.sized)) {
      this.temp = { rect: true, a: s, b: s };
      this.svg.setPointerCapture(e.pointerId);
    } else if (tool === "door" || tool === "window" || tool === "opening") {
      const nw = this.nearestWall(p);
      if (!nw) { this.app.toast("Click on a wall to place it."); return; }
      const style = OPENINGS[tool].styles[this.app.style[tool]] || Object.values(OPENINGS[tool].styles)[0];
      const L = C.dist(nw.a, nw.b), along = C.dist(nw.a, nw.q);
      const op = { id: C.uid("o"), wall: nw.w.id, type: tool, style: this.app.style[tool], w: Math.min(style.w, L - 0.5), h: style.h, sill: style.sill ?? OPENINGS[tool].sill, swing: 1, hinge: 0, t: 0 };
      op.t = along - op.w / 2;
      C.clampOpening(doc, op);
      // swing into the room the click was on
      const nx = -(nw.b.y - nw.a.y) / L, ny = (nw.b.x - nw.a.x) / L;
      op.swing = (p.x - nw.q.x) * nx + (p.y - nw.q.y) * ny >= 0 ? 1 : -1;
      doc.openings.push(op);
      this.app.commit(); this.app.select({ kind: "opening", id: op.id });
    } else if (tool === "item") {
      const it = this.placeItem(p);
      if (it) { doc.objects.push(it); this.app.commit(); this.app.select({ kind: "item", id: it.id }); }
    } else if (tool === "run") {
      const q = this.snap(p, this.temp?.last, { walls: false });
      if (!this.temp) this.temp = { run: true, pts: [[q.x, q.y]], last: q };
      else { this.temp.pts.push([q.x, q.y]); this.temp.last = q; }
    }
    this.render();
  }
  placeItem(p) {
    const spec = ITEMS[this.app.item];
    if (!spec) return null;
    const it = { id: C.uid("i"), type: this.app.item, level: this.L, x: C.r2(p.x), y: C.r2(p.y), rot: this.app.rot || 0 };
    if (spec.mount === "wall") {
      const nw = this.nearestWall(p, 4);
      if (!nw) { this.app.toast("Wall-mounted: click near a wall."); return null; }
      const L = C.dist(nw.a, nw.b), nx = -(nw.b.y - nw.a.y) / L, ny = (nw.b.x - nw.a.x) / L;
      const sgn = (p.x - nw.q.x) * nx + (p.y - nw.q.y) * ny >= 0 ? 1 : -1, off = C.thick(nw.w) / 2 + spec.d / 2;
      it.x = C.r2(nw.q.x + nx * sgn * off); it.y = C.r2(nw.q.y + ny * sgn * off);
      // face away from the wall: item -y (its back) toward the wall
      const ang = Math.atan2(ny * sgn, nx * sgn);
      it.rot = ((Math.round((ang - Math.PI / 2) / (Math.PI / 2)) % 4) + 4) % 4;
    } else {
      const g = this.app.grid;
      it.x = Math.round(p.x / g) * g; it.y = Math.round(p.y / g) * g;
    }
    return it;
  }
  move(e) {
    const p = this.pt(e), doc = this.doc;
    this.cursor = p;
    if (this.drag?.pan) {
      const k = this.ftPerPx();
      this.view.x = this.drag.v.x - (e.clientX - this.drag.sx) * k; this.view.y = this.drag.v.y - (e.clientY - this.drag.sy) * k;
      this.svg.setAttribute("viewBox", `${this.view.x} ${this.view.y} ${this.view.w} ${this.view.h}`);
      return;
    }
    if (this.drag?.node) { const n = doc.nodes[this.drag.node], s = this.snap(p, null, { walls: false }); if (!(s.kind === "node" && (s.x !== n.x || s.y !== n.y))) { n.x = s.x; n.y = s.y; } this.dirty = true; this.render(); return; }
    if (this.drag?.item) { const g = this.app.grid; this.drag.item.x = C.r2(Math.round((p.x + this.drag.dx) / g) * g); this.drag.item.y = C.r2(Math.round((p.y + this.drag.dy) / g) * g); this.dirty = true; this.render(); return; }
    if (this.drag?.roof) { const g = this.app.grid; this.drag.roof.x = Math.round((p.x + this.drag.dx) / g) * g; this.drag.roof.y = Math.round((p.y + this.drag.dy) / g) * g; this.dirty = true; this.render(); return; }
    if (this.drag?.opening) {
      const o = this.drag.opening, pos = C.openingPos(doc, o);
      if (pos) { const q = C.project(p, pos.a, pos.b); o.t = C.r2(Math.round((q.t * pos.L - o.w / 2) * 4) / 4); C.clampOpening(doc, o); this.dirty = true; this.render(); }
      return;
    }
    if (this.drag?.wall) {
      const g = this.app.grid, dx = Math.round((p.x - this.drag.p0.x) / g) * g, dy = Math.round((p.y - this.drag.p0.y) / g) * g;
      Object.assign(doc.nodes[this.drag.wall.a], { x: C.r2(this.drag.a0.x + dx), y: C.r2(this.drag.a0.y + dy) });
      Object.assign(doc.nodes[this.drag.wall.b], { x: C.r2(this.drag.b0.x + dx), y: C.r2(this.drag.b0.y + dy) });
      this.dirty = true; this.render(); return;
    }
    if (this.temp?.rect) this.temp.b = this.snap(p, null, { walls: false });
    this.render();
  }
  up() {
    if (this.drag) { if (this.dirty) this.app.commit(); this.drag = null; this.dirty = false; this.render(); return; }
    const t = this.temp;
    if (t?.rect) {
      const x0 = Math.min(t.a.x, t.b.x), y0 = Math.min(t.a.y, t.b.y), x1 = Math.max(t.a.x, t.b.x), y1 = Math.max(t.a.y, t.b.y);
      this.temp = null;
      if (x1 - x0 < 2 || y1 - y0 < 2) { this.render(); return; }
      const tool = this.app.tool;
      if (tool === "room") C.rectWalls(this.doc, this.L, x0, y0, x1, y1, this.app.asm);
      if (tool === "roof") { const r = { id: C.uid("r"), level: this.L, x: x0, y: y0, w: x1 - x0, d: y1 - y0, type: this.doc.kind === "commercial" ? "flat" : "gable", pitch: 7, overhang: this.doc.kind === "commercial" ? 0 : 1.5, ridge: x1 - x0 >= y1 - y0 ? "x" : "y", parapet: this.doc.kind === "commercial" ? 3 : 0 }; this.doc.roofs.push(r); this.app.select({ kind: "roof", id: r.id }); }
      if (tool === "item") { const it = { id: C.uid("i"), type: this.app.item, level: this.L, x: (x0 + x1) / 2, y: (y0 + y1) / 2, rot: 0, w: x1 - x0, d: y1 - y0 }; this.doc.objects.push(it); this.app.select({ kind: "item", id: it.id }); }
      this.app.commit();
    }
    this.render();
  }
  finish() {
    if (this.temp?.run && this.temp.pts.length > 1) {
      const run = { id: C.uid("p"), level: this.L, system: this.app.run, pts: this.temp.pts };
      this.doc.runs.push(run); this.app.commit(); this.app.select({ kind: "run", id: run.id });
    }
    this.temp = null; this.render();
  }
  cancel() { if (this.temp?.run) return this.finish(); this.temp = null; this.render(); }

  render() {
    const app = this.app, sel = app.sel || {};
    const { svg } = renderPlan(this.doc, this.L, { layers: app.layers, sel });
    const k = this.ftPerPx(), grid = app.grid;
    let extra = "";
    // corner handles for the selected wall
    if (sel.kind === "wall") { const w = this.doc.walls.find((x) => x.id === sel.id); if (w) for (const id of [w.a, w.b]) { const n = this.doc.nodes[id]; extra += `<circle cx="${n.x}" cy="${n.y}" r="${7 * k}" class="handle" data-node="${id}"/>`; } }
    const t = this.temp, c = this.cursor;
    if (t && c) {
      if (t.rect) extra += `<rect x="${Math.min(t.a.x, t.b.x)}" y="${Math.min(t.a.y, t.b.y)}" width="${Math.abs(t.b.x - t.a.x)}" height="${Math.abs(t.b.y - t.a.y)}" class="preview"/><text x="${(t.a.x + t.b.x) / 2}" y="${(t.a.y + t.b.y) / 2}" class="preview-label" font-size="${14 * k}">${C.fmtFtIn(Math.abs(t.b.x - t.a.x))} × ${C.fmtFtIn(Math.abs(t.b.y - t.a.y))}</text>`;
      if (t.last && !t.rect) {
        const s = this.snap(c, t.last, { walls: !t.run });
        const pts = t.run ? [...t.pts, [s.x, s.y]] : [[t.last.x, t.last.y], [s.x, s.y]];
        extra += `<polyline points="${pts.map((q) => q.join(",")).join(" ")}" class="preview-line" stroke-width="${t.run ? 0.25 : C.thick({ asm: app.asm })}"/>`;
        extra += `<text x="${(t.last.x + s.x) / 2}" y="${(t.last.y + s.y) / 2 - 10 * k}" class="preview-label" font-size="${14 * k}">${C.fmtFtIn(C.dist(t.last, s))}</text><circle cx="${s.x}" cy="${s.y}" r="${4 * k}" class="snap snap-${s.kind}"/>`;
      }
    } else if (c && ["wall", "room", "roof", "run"].includes(app.tool)) {
      const s = this.snap(c, null, { walls: app.tool !== "run" });
      extra += `<circle cx="${s.x}" cy="${s.y}" r="${4 * k}" class="snap snap-${s.kind}"/>`;
    } else if (c && app.tool === "item") {
      const it = this.placeItem(c);
      const spec = ITEMS[app.item];
      if (it && spec && !spec.sized) extra += `<g transform="translate(${it.x} ${it.y}) rotate(${it.rot * 90})" class="item ghost-item">${spec.plan(spec.w, spec.d)}</g>`;
    } else if (c && (app.tool === "door" || app.tool === "window" || app.tool === "opening")) {
      const nw = this.nearestWall(c);
      if (nw) extra += `<circle cx="${nw.q.x}" cy="${nw.q.y}" r="${6 * k}" class="snap snap-wall"/>`;
    }
    this.svg.innerHTML = `<defs><pattern id="grid" width="${grid * (grid < 1 ? 2 : 1)}" height="${grid * (grid < 1 ? 2 : 1)}" patternUnits="userSpaceOnUse"><path d="M ${grid * 2} 0 L 0 0 0 ${grid * 2}" class="grid-line"/></pattern><pattern id="grid10" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" class="grid-line major"/></pattern></defs>`
      + `<rect x="${this.view.x}" y="${this.view.y}" width="${this.view.w}" height="${this.view.h}" fill="url(#grid)"/><rect x="${this.view.x}" y="${this.view.y}" width="${this.view.w}" height="${this.view.h}" fill="url(#grid10)"/>`
      + `<g class="plan" style="--k:${k}">${svg}${extra}</g>`;
  }
}
