/* What you can build with: wall assemblies (layer by layer), door/window styles, and placeable items.
   Plan symbols are SVG drawn in item-local feet, centered on the item, +y toward its front. */

const IN = 1 / 12;

// layers listed outside → inside; thickness in inches
export const ASSEMBLIES = {
  "ext-2x6-vinyl": {
    name: "2×6 wood frame · vinyl siding", group: "Exterior walls", ext: true, stud: "2×6", oc: 16, sheathing: true,
    wrb: "House wrap (WRB)", cladding: "Vinyl lap siding", insulation: "R-21 fiberglass batts", finish: "siding", profile: "lap",
    layers: [["Vinyl lap siding", 0.5, "#cfcbc2"], ["House wrap (WRB)", 0.05, "#e9eef5"], ['7/16" OSB sheathing', 0.44, "#c9a46a"], ["2×6 studs @ 16\" + R-21 batts", 5.5, "#e8c98f"], ['1/2" drywall', 0.5, "#f1f1ef"]],
  },
  "ext-2x6-lp": {
    name: "2×6 wood frame · fiber cement lap", group: "Exterior walls", ext: true, stud: "2×6", oc: 16, sheathing: true,
    wrb: "House wrap (WRB)", cladding: "Fiber cement lap siding", insulation: "R-21 fiberglass batts", finish: "siding", profile: "lap",
    layers: [["Fiber cement lap siding", 0.31, "#b9b4aa"], ["Rainscreen furring", 0.375, "#8b6e45"], ["House wrap (WRB)", 0.05, "#e9eef5"], ['7/16" OSB sheathing', 0.44, "#c9a46a"], ["2×6 studs @ 16\" + R-21 batts", 5.5, "#e8c98f"], ['1/2" drywall', 0.5, "#f1f1ef"]],
  },
  "ext-2x6-board": {
    name: "2×6 wood frame · board & batten", group: "Exterior walls", ext: true, stud: "2×6", oc: 16, sheathing: true,
    wrb: "House wrap (WRB)", cladding: "Board & batten siding", insulation: "R-21 fiberglass batts", finish: "siding", profile: "board",
    layers: [["Board & batten", 0.75, "#b9b4aa"], ["House wrap (WRB)", 0.05, "#e9eef5"], ['7/16" OSB sheathing', 0.44, "#c9a46a"], ["2×6 studs @ 16\" + R-21 batts", 5.5, "#e8c98f"], ['1/2" drywall', 0.5, "#f1f1ef"]],
  },
  "ext-brick": {
    name: "Brick veneer on 2×4 frame", group: "Exterior walls", ext: true, stud: "2×4", oc: 16, sheathing: true,
    wrb: "House wrap (WRB)", cladding: "Brick veneer", claddingUnit: "squares (×675 brick)", insulation: "R-15 batts", finish: "brick",
    layers: [["Brick veneer", 3.625, "#9a5a46"], ["1\" air space + ties", 1, "#ffffff"], ["House wrap (WRB)", 0.05, "#e9eef5"], ['7/16" OSB sheathing', 0.44, "#c9a46a"], ["2×4 studs @ 16\" + R-15 batts", 3.5, "#e8c98f"], ['1/2" drywall', 0.5, "#f1f1ef"]],
  },
  "ext-stone": {
    name: "Stone veneer on 2×6 frame", group: "Exterior walls", ext: true, stud: "2×6", oc: 16, sheathing: true,
    wrb: "Two layers WRB + lath", cladding: "Manufactured stone veneer", insulation: "R-21 fiberglass batts", finish: "stone",
    layers: [["Stone veneer + mortar", 2.5, "#8d877d"], ["Metal lath + scratch coat", 0.5, "#9ea3a8"], ["Two layers WRB", 0.1, "#e9eef5"], ['7/16" OSB sheathing', 0.44, "#c9a46a"], ["2×6 studs @ 16\" + R-21 batts", 5.5, "#e8c98f"], ['1/2" drywall', 0.5, "#f1f1ef"]],
  },
  "ext-steel": {
    name: "6\" steel stud · metal panel", group: "Exterior walls", ext: true, stud: "6\" 18-ga steel", oc: 16, sheathing: false,
    wrb: "Fluid-applied air & water barrier", cladding: "Insulated metal panel", claddingUnit: "squares", insulation: "2\" rigid continuous insulation", finish: "metal",
    layers: [["Metal wall panel", 0.75, "#8b929a"], ["2\" rigid insulation", 2, "#d9c4e0"], ["Air & water barrier", 0.05, "#3d5c86"], ['5/8" exterior gypsum sheathing', 0.625, "#dcd7cc"], ['6" steel studs @ 16"', 6, "#b8bec5"], ['5/8" drywall', 0.625, "#f1f1ef"]],
  },
  "ext-cmu": {
    name: "8\" CMU block · painted", group: "Exterior walls", ext: true, cmu: true, drywall: false,
    wrb: null, cladding: "Elastomeric masonry coating", claddingUnit: "squares", insulation: "Foam-filled cores", finish: "cmu",
    layers: [["Elastomeric coating", 0.05, "#e2ded6"], ["8\" CMU, foam-filled cores", 7.625, "#b9b6b0"], ["Furring + drywall (where finished)", 1.5, "#f1f1ef"]],
  },
  "ext-storefront": {
    name: "Aluminum storefront wall", group: "Exterior walls", ext: true, drywall: false, cladding: "Storefront framing", claddingUnit: "sq ft", finish: "storefront",
    layers: [["Thermally broken aluminum + insulated glass", 4.5, "#2b2e33"]],
  },
  "int-2x4": {
    name: "2×4 interior partition", group: "Interior walls", stud: "2×4", oc: 16,
    layers: [['1/2" drywall', 0.5, "#f1f1ef"], ['2×4 studs @ 16"', 3.5, "#e8c98f"], ['1/2" drywall', 0.5, "#f1f1ef"]],
  },
  "int-2x6-wet": {
    name: "2×6 plumbing wall", group: "Interior walls", stud: "2×6", oc: 16,
    layers: [['1/2" moisture-resistant drywall', 0.5, "#e6efe6"], ['2×6 studs @ 16"', 5.5, "#e8c98f"], ['1/2" drywall', 0.5, "#f1f1ef"]],
  },
  "int-steel": {
    name: "3-5/8\" steel stud partition", group: "Interior walls", stud: "3-5/8\" 25-ga steel", oc: 16,
    layers: [['5/8" drywall', 0.625, "#f1f1ef"], ['3-5/8" steel studs + sound batts', 3.625, "#b8bec5"], ['5/8" drywall', 0.625, "#f1f1ef"]],
  },
};
for (const a of Object.values(ASSEMBLIES)) a.thick = a.layers.reduce((s, l) => s + l[1], 0) * IN;

export const OPENINGS = {
  door: {
    name: "Door", w: 3, h: 6.67, sill: 0,
    styles: {
      entry: { name: "Entry door", w: 3, h: 6.67 }, interior: { name: "Interior door", w: 2.67, h: 6.67 },
      patio: { name: "Sliding patio door", w: 6, h: 6.67 }, french: { name: "French doors", w: 5, h: 6.67 },
      garage: { name: "Garage door", w: 16, h: 7 }, overhead: { name: "Overhead dock door", w: 10, h: 10 },
      storefront: { name: "Storefront door pair", w: 6, h: 7 }, pocket: { name: "Pocket door", w: 2.67, h: 6.67 },
    },
  },
  window: {
    name: "Window", w: 3, h: 4.5, sill: 2.5,
    styles: {
      "double-hung": { name: "Double-hung", w: 3, h: 4.5, sill: 2.5 }, casement: { name: "Casement", w: 2.5, h: 4, sill: 3 },
      slider: { name: "Slider", w: 5, h: 3.5, sill: 3.5 }, picture: { name: "Picture", w: 5, h: 5, sill: 2 },
      awning: { name: "Awning", w: 3, h: 2, sill: 5 }, egress: { name: "Egress casement", w: 3, h: 4, sill: 2 },
      storefront: { name: "Storefront glazing", w: 12, h: 9, sill: 1 },
    },
  },
  opening: { name: "Cased opening", w: 6, h: 7, sill: 0, styles: { cased: { name: "Cased opening", w: 6, h: 7 }, arch: { name: "Archway", w: 5, h: 7.5 } } },
};

/* ---------- items ---------- */
// mount: floor | wall (snaps to walls) | ceiling | roof (sits on the roof) | ground (outdoors)
const R = (w, d, extra = "") => `<rect x="${-w / 2}" y="${-d / 2}" width="${w}" height="${d}" ${extra}/>`;
const T = (s, size = 0.9, y = 0.3) => `<text x="0" y="${y}" font-size="${size}" text-anchor="middle">${s}</text>`;
const C = (r, x = 0, y = 0, extra = "") => `<circle cx="${x}" cy="${y}" r="${r}" ${extra}/>`;

export const ITEMS = {
  // kitchen & laundry
  fridge: { name: "Refrigerator", group: "Kitchen & laundry", w: 3, d: 2.6, h: 5.8, mount: "floor", plan: (w, d) => R(w, d) + T("REF", 0.7) },
  range: { name: "Range / oven", group: "Kitchen & laundry", w: 2.5, d: 2.2, h: 3, mount: "floor", plan: (w, d) => R(w, d) + C(0.35, -0.55, -0.4) + C(0.35, 0.55, -0.4) + C(0.35, -0.55, 0.4) + C(0.35, 0.55, 0.4) },
  "sink-kitchen": { name: "Kitchen sink + base", group: "Kitchen & laundry", w: 3, d: 2, h: 3, mount: "floor", plan: (w, d) => R(w, d) + `<rect x="-1.2" y="-0.6" width="1.1" height="1.2" rx=".2"/><rect x="0.1" y="-0.6" width="1.1" height="1.2" rx=".2"/>` },
  dishwasher: { name: "Dishwasher", group: "Kitchen & laundry", w: 2, d: 2, h: 3, mount: "floor", plan: (w, d) => R(w, d) + T("DW", 0.6) },
  cabinets: { name: "Base cabinets (6 ft)", group: "Kitchen & laundry", w: 6, d: 2, h: 3, mount: "floor", plan: (w, d) => R(w, d) + `<path d="M${-w / 2} ${d / 2 - 0.2}H${w / 2}"/>` },
  island: { name: "Kitchen island", group: "Kitchen & laundry", w: 6, d: 3, h: 3, mount: "floor", plan: (w, d) => R(w, d, 'rx=".2"') },
  washer: { name: "Washer", group: "Kitchen & laundry", w: 2.25, d: 2.25, h: 3.2, mount: "floor", plan: (w, d) => R(w, d) + T("W", 0.8) },
  dryer: { name: "Dryer", group: "Kitchen & laundry", w: 2.25, d: 2.25, h: 3.2, mount: "floor", plan: (w, d) => R(w, d) + T("D", 0.8) },
  // bath & plumbing
  toilet: { name: "Toilet", group: "Plumbing", w: 1.6, d: 2.4, h: 2.6, mount: "floor", plan: () => `<rect x="-.8" y="-1.2" width="1.6" height=".7" rx=".1"/><ellipse cx="0" cy=".3" rx=".65" ry=".85"/>` },
  "sink-bath": { name: "Lavatory sink", group: "Plumbing", w: 1.8, d: 1.4, h: 2.8, mount: "floor", plan: (w, d) => R(w, d) + `<ellipse cx="0" cy=".05" rx=".55" ry=".4"/>` },
  vanity: { name: "Vanity (4 ft)", group: "Plumbing", w: 4, d: 1.8, h: 2.8, mount: "floor", plan: (w, d) => R(w, d) + `<ellipse cx="0" cy=".05" rx=".6" ry=".45"/>` },
  tub: { name: "Bathtub", group: "Plumbing", w: 5, d: 2.6, h: 1.7, mount: "floor", plan: (w, d) => R(w, d) + `<rect x="-2.2" y="-1" width="4.4" height="2" rx=".8"/>` },
  shower: { name: "Shower (3×4)", group: "Plumbing", w: 4, d: 3, h: 7, mount: "floor", plan: (w, d) => R(w, d) + `<path d="M${-w / 2} ${-d / 2}L${w / 2} ${d / 2}M${w / 2} ${-d / 2}L${-w / 2} ${d / 2}"/>` },
  "water-heater": { name: "Water heater", group: "Plumbing", w: 2, d: 2, h: 5, mount: "floor", plan: () => C(0.95) + T("WH", 0.6) },
  "hose-bib": { name: "Hose bib", group: "Plumbing", w: 0.5, d: 0.5, h: 0.5, mount: "wall", z: 1.5, plan: () => C(0.25) + `<path d="M0 0L0 .45"/>` },
  // HVAC
  furnace: { name: "Furnace / air handler", group: "HVAC", w: 2, d: 2.5, h: 4.5, mount: "floor", plan: (w, d) => R(w, d) + T("FAU", 0.55) },
  condenser: { name: "AC condenser / heat pump", group: "HVAC", w: 3, d: 3, h: 3, mount: "ground", plan: (w, d) => R(w, d) + C(1.1) + T("AC", 0.6) },
  register: { name: "Supply register", group: "HVAC", w: 1, d: 0.5, h: 0.1, mount: "floor", plan: (w, d) => R(w, d) + `<path d="M-.35 -.25V.25M0 -.25V.25M.35 -.25V.25"/>` },
  return: { name: "Return grille", group: "HVAC", w: 2, d: 1, h: 0.1, mount: "floor", plan: (w, d) => R(w, d) + `<path d="M-1 -.5L1 .5M-1 .5L1 -.5"/>` },
  "minisplit": { name: "Ductless mini-split head", group: "HVAC", w: 3, d: 0.7, h: 1, mount: "wall", z: 7, plan: (w, d) => R(w, d) + T("MS", 0.5, 0.2) },
  rtu: { name: "Rooftop unit (RTU)", group: "Roof equipment", w: 8, d: 4.5, h: 4.5, mount: "roof", plan: (w, d) => R(w, d, 'stroke-dasharray=".4 .3"') + T("RTU", 0.9) },
  "exhaust-fan": { name: "Exhaust fan", group: "Roof equipment", w: 3, d: 3, h: 3, mount: "roof", plan: () => C(1.3, 0, 0, 'stroke-dasharray=".3 .2"') + T("EF", 0.6) },
  "roof-hatch": { name: "Roof hatch", group: "Roof equipment", w: 3, d: 3, h: 1.2, mount: "roof", plan: (w, d) => R(w, d, 'stroke-dasharray=".3 .2"') + T("RH", 0.6) },
  // electrical
  outlet: { name: "Outlet (duplex)", group: "Electrical", w: 0.6, d: 0.3, h: 0.4, mount: "wall", z: 1.2, plan: () => C(0.28) + `<path d="M-.12 -.28V.28M.12 -.28V.28"/>` },
  switch: { name: "Light switch", group: "Electrical", w: 0.5, d: 0.3, h: 0.4, mount: "wall", z: 4, plan: () => T("S", 0.8) },
  light: { name: "Ceiling light", group: "Electrical", w: 1.2, d: 1.2, h: 0.5, mount: "ceiling", plan: () => C(0.5) + `<path d="M-.35 -.35L.35 .35M.35 -.35L-.35 .35"/>` },
  "can-light": { name: "Recessed can light", group: "Electrical", w: 0.6, d: 0.6, h: 0.2, mount: "ceiling", plan: () => C(0.3) + C(0.1) },
  fan: { name: "Ceiling fan", group: "Electrical", w: 4.4, d: 4.4, h: 1, mount: "ceiling", plan: () => C(0.4) + `<path d="M0 -.4V-2.2M0 .4V2.2M-.4 0H-2.2M.4 0H2.2"/>` },
  panel: { name: "Electrical panel", group: "Electrical", w: 1.4, d: 0.5, h: 2.5, mount: "wall", z: 4.5, plan: (w, d) => R(w, d, 'class="fill"') },
  smoke: { name: "Smoke / CO detector", group: "Electrical", w: 0.6, d: 0.6, h: 0.2, mount: "ceiling", plan: () => C(0.3) + T("SD", 0.3, 0.1) },
  // furniture
  "bed-king": { name: "King bed", group: "Furniture", w: 6.33, d: 7, h: 2, mount: "floor", plan: (w, d) => R(w, d) + `<rect x="${-w / 2 + 0.3}" y="${-d / 2 + 0.3}" width="${w / 2 - 0.45}" height="1.3" rx=".3"/><rect x=".15" y="${-d / 2 + 0.3}" width="${w / 2 - 0.45}" height="1.3" rx=".3"/>` },
  "bed-queen": { name: "Queen bed", group: "Furniture", w: 5, d: 6.67, h: 2, mount: "floor", plan: (w, d) => R(w, d) + `<rect x="${-w / 2 + 0.3}" y="${-d / 2 + 0.3}" width="${w / 2 - 0.45}" height="1.2" rx=".3"/><rect x=".15" y="${-d / 2 + 0.3}" width="${w / 2 - 0.45}" height="1.2" rx=".3"/>` },
  "bed-twin": { name: "Twin bed", group: "Furniture", w: 3.25, d: 6.25, h: 2, mount: "floor", plan: (w, d) => R(w, d) + `<rect x="${-w / 2 + 0.3}" y="${-d / 2 + 0.3}" width="${w - 0.6}" height="1.1" rx=".3"/>` },
  sofa: { name: "Sofa", group: "Furniture", w: 7, d: 3, h: 2.8, mount: "floor", plan: (w, d) => R(w, d, 'rx=".3"') + `<path d="M${-w / 2} ${-d / 2 + 0.8}H${w / 2}"/>` },
  chair: { name: "Armchair", group: "Furniture", w: 2.8, d: 2.8, h: 2.8, mount: "floor", plan: (w, d) => R(w, d, 'rx=".3"') + `<path d="M${-w / 2} ${-d / 2 + 0.7}H${w / 2}"/>` },
  "dining-table": { name: "Dining table + 6 chairs", group: "Furniture", w: 6, d: 3.5, h: 2.5, mount: "floor", plan: (w, d) => R(w, d) + [-1.8, 0, 1.8].map((x) => `<rect x="${x - 0.6}" y="${-d / 2 - 1.1}" width="1.2" height="1"/><rect x="${x - 0.6}" y="${d / 2 + 0.1}" width="1.2" height="1"/>`).join("") },
  desk: { name: "Desk + chair", group: "Furniture", w: 5, d: 2.5, h: 2.5, mount: "floor", plan: (w, d) => R(w, d) + C(0.7, 0, d / 2 + 0.9) },
  dresser: { name: "Dresser", group: "Furniture", w: 5, d: 1.7, h: 3, mount: "floor", plan: (w, d) => R(w, d) },
  tv: { name: "TV console", group: "Furniture", w: 6, d: 1.5, h: 2, mount: "floor", plan: (w, d) => R(w, d) + `<path d="M-2.5 .5H2.5"/>` },
  bookshelf: { name: "Bookshelf", group: "Furniture", w: 3, d: 1.2, h: 6, mount: "floor", plan: (w, d) => R(w, d) + `<path d="M-1.5 0H1.5"/>` },
  stairs: { name: "Stairs (to next floor)", group: "Structure", w: 3.5, d: 13, h: 9, mount: "floor", plan: (w, d) => R(w, d) + Array.from({ length: 12 }, (_, i) => `<path d="M${-w / 2} ${-d / 2 + (i + 1) * d / 13}H${w / 2}"/>`).join("") + `<path d="M0 ${d / 2 - 0.6}V${-d / 2 + 1}M-.5 ${-d / 2 + 1.8}L0 ${-d / 2 + 1}L.5 ${-d / 2 + 1.8}" class="accent"/>` },
  column: { name: "Column / post", group: "Structure", w: 0.8, d: 0.8, h: 9, mount: "floor", plan: (w, d) => R(w, d, 'class="fill"') },
  // exterior
  deck: { name: "Deck", group: "Exterior", w: 16, d: 12, h: 2.5, mount: "ground", sized: true, plan: (w, d) => R(w, d) + Array.from({ length: Math.floor(d / 1.5) }, (_, i) => `<path d="M${-w / 2} ${-d / 2 + (i + 1) * 1.5}H${w / 2}" class="thin"/>`).join("") },
  porch: { name: "Covered entry / porch", group: "Exterior", w: 10, d: 6, h: 1, mount: "ground", sized: true, plan: (w, d) => R(w, d) + C(0.4, -w / 2 + 0.6, d / 2 - 0.6) + C(0.4, w / 2 - 0.6, d / 2 - 0.6) },
  chimney: { name: "Chimney", group: "Exterior", w: 3, d: 2.5, h: 30, mount: "floor", plan: (w, d) => R(w, d, 'class="hatch"') },
  "pipe-boot": { name: "Pipe boot (plumbing vent)", group: "Roof items", w: 0.6, d: 0.6, h: 1.5, mount: "roof", plan: () => C(0.3, 0, 0, 'stroke-dasharray=".15 .1"') },
  "roof-vent": { name: "Box roof vent", group: "Roof items", w: 1.5, d: 1.5, h: 0.6, mount: "roof", plan: (w, d) => R(w, d, 'stroke-dasharray=".2 .15"') },
  skylight: { name: "Skylight", group: "Roof items", w: 2.5, d: 4, h: 0.6, mount: "roof", plan: (w, d) => R(w, d, 'stroke-dasharray=".3 .2"') + `<path d="M${-w / 2} ${-d / 2}L${w / 2} ${d / 2}" class="thin"/>` },
  "garage-slab": { name: "Driveway / slab", group: "Exterior", w: 18, d: 20, h: 0.3, mount: "ground", sized: true, plan: (w, d) => R(w, d, 'class="thin"') },
};
export const GROUP_ORDER = ["Structure", "Exterior", "Roof items", "Kitchen & laundry", "Plumbing", "HVAC", "Electrical", "Furniture", "Roof equipment"];

export const RUNS = {
  supply: { name: "Water supply (PEX)", color: "#2f6bff", layer: "plumbing" },
  drain: { name: "Drain / vent (PVC)", color: "#6b7280", layer: "plumbing" },
  gas: { name: "Gas line", color: "#e6a700", layer: "plumbing" },
  duct: { name: "Supply duct", color: "#9aa3ad", layer: "hvac", width: 0.9 },
  return: { name: "Return duct", color: "#6f7b88", layer: "hvac", width: 1.2 },
  wire: { name: "Electrical circuit", color: "#d64545", layer: "electrical", dash: true },
};
export const LAYER_OF = (spec) => ({ Plumbing: "plumbing", HVAC: "hvac", Electrical: "electrical", Furniture: "furniture", "Kitchen & laundry": "furniture", "Roof items": "roof", "Roof equipment": "roof" }[spec.group] || "structure");

export const FLOORS = { wood: { name: "Hardwood", hex: "#b58a5c" }, lvp: { name: "Luxury vinyl plank", hex: "#a99a86" }, tile: { name: "Tile", hex: "#d9d4ca" }, carpet: { name: "Carpet", hex: "#9c9a93" }, concrete: { name: "Sealed concrete", hex: "#b4b2ad" } };
export const ROOF_MATERIALS = { shingle: "Architectural shingles", metal: "Standing-seam metal", tpo: "TPO membrane (flat)", epdm: "EPDM membrane (flat)" };
export const ROOF_COLORS = { "#3c3e42": "Charcoal", "#5b4a3d": "Weathered wood", "#26282c": "Black", "#6c6f73": "Slate grey", "#7a3b2e": "Barn red", "#e9ebea": "White (TPO)" };
export const SIDING_COLORS = { "#c9c6bd": "Pewter", "#e9e6dd": "Arctic white", "#2c3e55": "Navy", "#4b5a4a": "Sage", "#7e6a55": "Clay", "#2a2c2f": "Black", "#9aa3a8": "Light mist" };
