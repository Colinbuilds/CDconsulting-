"""Generate the photo layers for the scroll-build section.

Takes one straight-on house photo (images/build/source.jpg) plus hand-traced
roof / siding regions, and writes cut-out layers that keep the photo's own
lighting:

  roof-deck   bare OSB decking          (tear-off)
  roof-under  synthetic underlayment    (dry-in)
  roof-new    new architectural shingle (rebuild)
  wall-sheath bare wall sheathing       (tear-off)
  wall-wrap   house wrap                (dry-in)
  wall-new    new siding color          (rebuild)

Run:  python3 tools/build_stages.py
Requires: Pillow, numpy.  Coordinates below are in source-photo pixels; to use
a different photo, retrace ROOF / ROOF_HOLES / WALL_* for it.
"""
import json
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..", "images", "build")
OUT_W = 1600
rng = np.random.default_rng(14)

# ---------------------------------------------------------------- regions
ROOF = [(478, 309), (1302, 309), (1492, 724), (298, 731), (394, 446), (408, 441), (466, 441), (478, 422)]
ROOF_HOLES = [
    [(503, 407), (1270, 407), (1270, 433), (1213, 433), (1213, 569), (556, 569), (556, 433), (503, 433)],  # dormer
]
DOWNSPOUT_BAND = (512, 430, 572, 740)  # bright pipe on the roof stays visible
EAVE_Y, RIDGE_Y = 731, 309

WALL_DORMER = [
    [(564, 434), (723, 434), (723, 566), (564, 566)],
    [(1044, 434), (1211, 434), (1211, 566), (1044, 566)],
    [(723, 434), (1044, 434), (1044, 443), (723, 443)],
]
WALL_FRONT = [(476, 762), (1360, 762), (1360, 1008), (476, 1008)]
WALL_FRONT_HOLES = [
    [(630, 762), (840, 762), (840, 930), (630, 930)],      # windows
    [(1031, 762), (1154, 762), (1154, 1010), (1031, 1010)],  # door
    [(876, 762), (914, 762), (914, 1010), (876, 1010)],      # porch post
]

NEW_ROOF = (44, 44, 47)
NEW_SIDING = (62, 78, 104)   # deep navy
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
if not os.path.exists(FONT):
    FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def poly_mask(size, polys, holes=(), blur=0.7):
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    for p in polys:
        d.polygon(p, fill=255)
    for p in holes:
        d.polygon(p, fill=0)
    return m.filter(ImageFilter.GaussianBlur(blur)) if blur else m


def lum(a):
    return a[..., :3].mean(2)


def blur_arr(a, r):
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.GaussianBlur(r))).astype(float)


def noise(h, w, scale, amp):
    """Smooth value noise: random grid upscaled."""
    gh, gw = max(2, h // scale + 2), max(2, w // scale + 2)
    g = rng.normal(0, 1, (gh, gw))
    img = Image.fromarray(((g - g.min()) / (np.ptp(g) + 1e-6) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    a = np.asarray(img).astype(float) / 255 - 0.5
    return a * 2 * amp


# ---------------------------------------------------------------- textures
def osb(w, h, sheet_w=320, sheet_h=118, origin_y=0):
    img = Image.new("RGB", (w, h), (176, 150, 114))
    d = ImageDraw.Draw(img)
    palette = [(158, 130, 96), (196, 172, 134), (170, 142, 106), (140, 114, 82), (206, 186, 152), (186, 160, 122), (124, 100, 72)]
    n = int(w * h / 9)
    xs, ys = rng.integers(0, w, n), rng.integers(0, h, n)
    ang = rng.uniform(0, np.pi, n)
    ln = rng.uniform(3, 9, n)
    cols = rng.integers(0, len(palette), n)
    for x, y, a, l, c in zip(xs, ys, ang, ln, cols):
        dx, dy = np.cos(a) * l / 2, np.sin(a) * l / 2 * 0.8
        d.line([(x - dx, y - dy), (x + dx, y + dy)], fill=palette[c], width=int(rng.integers(1, 3)))
    img = img.filter(ImageFilter.GaussianBlur(0.5))
    a = np.asarray(img).astype(float)
    a *= (1 + noise(h, w, 60, 0.07) + rng.normal(0, 0.04, (h, w)))[..., None]
    # sheet seams, staggered by course
    seam = np.ones((h, w))
    for row_y in range(origin_y % sheet_h - sheet_h, h, sheet_h):
        y = int(row_y)
        if 0 <= y < h:
            seam[max(0, y - 1):y + 1, :] = 0.55
            seam[y + 1:y + 2, :] = 1.12
        course = (row_y - origin_y) // sheet_h
        off = (sheet_w // 2) * (course % 2)
        for x in range(int(off) - sheet_w, w, sheet_w):
            if 0 <= x < w:
                seam[max(0, y):min(h, y + sheet_h), max(0, x - 1):x + 1] = 0.6
    return a * seam[..., None]


def shingles(w, h, eave_y, ridge_y):
    """Architectural (laminated) shingle courses, eave → ridge, in local coords."""
    a = np.zeros((h, w, 3))
    y = eave_y
    course = 0
    while y > -20:
        t = (eave_y - y) / max(1, eave_y - ridge_y)
        exp = 14.2 - 2.4 * t  # slight foreshortening toward the ridge
        y0 = y - exp
        x = -rng.integers(0, 60)
        while x < w:
            tw = int(rng.integers(18, 52))
            k = rng.uniform(0.82, 1.2)
            tint = np.array(NEW_ROOF) * k + rng.normal(0, 1.4, 3)
            ya, yb = int(max(0, np.floor(y0))), int(min(h, np.ceil(y)))
            xa, xb = int(max(0, x)), int(min(w, x + tw))
            if yb > ya and xb > xa:
                a[ya:yb, xa:xb] = tint
                # laminate shadow band on lower part of some tabs
                if rng.random() < 0.6:
                    yl = int(ya + (yb - ya) * rng.uniform(0.4, 0.7))
                    xs = int(xa + rng.integers(0, max(1, (xb - xa) // 2)))
                    a[yl:yb, xs:xb] *= rng.uniform(0.66, 0.84)
                # keyway gap
                a[ya + (yb - ya) // 2:yb, xa:min(w, xa + 1)] *= 0.45
            x += tw
        # course shadow line under the butt edge + slight highlight above
        yi = int(round(y))
        if 0 <= yi < h:
            a[yi:min(h, yi + 2)] *= 0.45
        if 0 <= yi - 1 < h:
            a[yi - 1] *= 1.25
        y = y0
        course += 1
    # granules
    a *= (1 + rng.normal(0, 0.16, (h, w)))[..., None]
    a = blur_arr(a, 0.35)
    a *= (1 + noise(h, w, 90, 0.05))[..., None]
    return a


def printed(w, h, base, line_col, text, band_h, text_size, text_every, wrinkle=0.0, origin_y=0, seam_shadow=0.8):
    a = np.ones((h, w, 3)) * np.array(base, float)
    a *= (1 + rng.normal(0, 0.035, (h, w)))[..., None]
    if wrinkle:
        a *= (1 + noise(h, w, 28, wrinkle) + noise(h, w, 9, wrinkle * 0.4))[..., None]
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, text_size)
    for top in range(origin_y % band_h - band_h, h, band_h):
        for frac in (0.18, 0.82):
            yy = top + band_h * frac
            d.line([(0, yy), (w, yy)], fill=line_col, width=1)
        off = (text_every // 2) * ((top // band_h) % 2)
        for x in range(-text_every + off, w, text_every):
            d.text((x, top + band_h * 0.5 - text_size * 0.6), text, font=font, fill=line_col)
    a = np.asarray(img).astype(float)
    for top in range(origin_y % band_h - band_h, h, band_h):
        if 0 <= top < h:
            a[top:top + 2] *= seam_shadow
            a[max(0, top - 1):top] *= 1.08
    return a


# ---------------------------------------------------------------- build
def main():
    src = Image.open(os.path.join(ROOT, "source.jpg")).convert("RGB")
    W, H = src.size
    A = np.asarray(src).astype(float)
    L = lum(A)

    # roof mask (minus the bright downspout crossing it)
    roof_m = np.asarray(poly_mask((W, H), [ROOF], ROOF_HOLES)).astype(float) / 255
    x0, y0, x1, y1 = DOWNSPOUT_BAND
    band = np.zeros((H, W), bool)
    band[y0:y1, x0:x1] = True
    pipe = band & (L > 150)
    pipe_m = np.asarray(Image.fromarray((pipe * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))).astype(float) / 255
    roof_m = roof_m * (1 - pipe_m)

    # lighting on the roof plane (stains/debris blurred away)
    roof_L = np.where(roof_m > 0.5, L, np.nan)
    fill = np.nanmedian(roof_L)
    light = blur_arr(np.nan_to_num(roof_L, nan=fill), 26) / fill
    light = np.clip(light, 0.7, 1.25)

    # wall masks
    wall_dormer = np.asarray(poly_mask((W, H), WALL_DORMER, blur=0.6)).astype(float) / 255
    wall_front_poly = np.asarray(poly_mask((W, H), [WALL_FRONT], WALL_FRONT_HOLES, blur=0)).astype(float) / 255
    mx, mn = A.max(2), A.min(2)
    sat = (mx - mn) / (mx + 1)
    yy, xx = np.mgrid[0:H, 0:W]
    hi = np.where((xx > 1150) & (yy < 925), 240, 206)  # sunlit right wall is brighter than the trim elsewhere
    siding_px = (L > 38) & (L < hi) & (sat < 0.32)
    sp = Image.fromarray((siding_px * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    wall_front = (np.asarray(sp).astype(float) / 255) * wall_front_poly
    wall_front = np.asarray(Image.fromarray((wall_front * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(float) / 255
    wall_m = np.clip(wall_dormer + wall_front, 0, 1)

    # light on the walls = blurred brightness of white siding
    wall_L = np.where(wall_m > 0.5, L, np.nan)
    wl_fill = np.nanmedian(wall_L)
    wall_light = blur_arr(np.nan_to_num(wall_L, nan=wl_fill), 14) / 222.0
    wall_light = np.clip(wall_light, 0.2, 1.12)

    layers = {}

    # --- roof layers (computed on the roof bbox)
    rb = (290, 300, 1500, 740)
    bw, bh = rb[2] - rb[0], rb[3] - rb[1]
    lt = light[rb[1]:rb[3], rb[0]:rb[2]][..., None]
    eave_local, ridge_local = EAVE_Y - rb[1], RIDGE_Y - rb[1]

    deck = osb(bw, bh, origin_y=eave_local) * lt ** 0.9
    # grime + nail lines
    deck *= (1 - 0.18 * np.clip((np.arange(bh)[:, None] - (eave_local - 60)) / 60, 0, 1))[..., None]
    for y in range(eave_local, 0, -59):
        deck[max(0, y - 1):y] *= 0.9
    layers["roof-deck"] = (deck, rb, roof_m)

    under = printed(bw, bh, (66, 69, 75), (84, 112, 170), "CD//SHIELD", band_h=90, text_size=10, text_every=260,
                    wrinkle=0.04, origin_y=eave_local) * lt ** 0.9
    under[eave_local - 5:eave_local] = np.array((176, 182, 190)) * lt[eave_local - 5:eave_local]  # drip edge
    layers["roof-under"] = (under, rb, roof_m)

    new_roof = shingles(bw, bh, eave_local, ridge_local) * lt ** 0.75
    new_roof *= (1 + 0.08 * (1 - np.arange(bh) / bh))[:, None, None]  # a touch of sky sheen up top
    layers["roof-new"] = (new_roof, rb, roof_m)

    # --- wall layers
    wb = (470, 425, 1365, 1012)
    ww, wh = wb[2] - wb[0], wb[3] - wb[1]
    wl = wall_light[wb[1]:wb[3], wb[0]:wb[2]][..., None]
    sheath = osb(ww, wh, sheet_w=170, sheet_h=230, origin_y=10) * wl
    layers["wall-sheath"] = (sheath, wb, wall_m)
    wrap = printed(ww, wh, (232, 235, 239), (70, 110, 200), "CD//WRAP", band_h=118, text_size=15, text_every=210,
                   wrinkle=0.07, origin_y=8, seam_shadow=0.86) * wl
    layers["wall-wrap"] = (wrap, wb, wall_m)
    Lw = L[wb[1]:wb[3], wb[0]:wb[2]][..., None]
    new_side = np.array(NEW_SIDING, float) * (Lw / 205.0) ** 1.08 * 1.05
    layers["wall-new"] = (new_side, wb, wall_m)

    # --- write (scaled to OUT_W)
    k = OUT_W / W
    meta = {"width": OUT_W, "height": round(H * k), "layers": {}}
    src.resize((OUT_W, round(H * k)), Image.LANCZOS).save(os.path.join(ROOT, "before.jpg"), quality=78, optimize=True, progressive=True)
    for name, (arr, box, mask) in layers.items():
        m = mask[box[1]:box[3], box[0]:box[2]]
        rgba = np.dstack([np.clip(arr, 0, 255), m * 255]).astype(np.uint8)
        img = Image.fromarray(rgba, "RGBA")
        out = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
        out.save(os.path.join(ROOT, f"{name}.webp"), quality=82, method=6)
        meta["layers"][name] = [round(box[0] * k), round(box[1] * k), out.width, out.height]
    meta["roof"] = {"ridge": round(RIDGE_Y * k), "eave": round(EAVE_Y * k), "x0": round(298 * k), "x1": round(1492 * k)}
    meta["wall"] = {"top": round(434 * k), "bottom": round(1008 * k)}
    with open(os.path.join(ROOT, "layers.json"), "w") as f:
        json.dump(meta, f, indent=1)

    # preview composites for checking
    prev = os.environ.get("PREVIEW_DIR")
    if prev:
        for stage, names in {"stripped": ["roof-deck", "wall-sheath"], "dryin": ["roof-under", "wall-wrap"], "after": ["roof-new", "wall-new"]}.items():
            c = src.copy().convert("RGBA")
            for n in names:
                arr, box, mask = layers[n]
                m = mask[box[1]:box[3], box[0]:box[2]]
                c.alpha_composite(Image.fromarray(np.dstack([np.clip(arr, 0, 255), m * 255]).astype(np.uint8), "RGBA"), (box[0], box[1]))
            c.convert("RGB").save(os.path.join(prev, f"stage-{stage}.jpg"), quality=88)
    print(json.dumps(meta))


if __name__ == "__main__":
    main()
