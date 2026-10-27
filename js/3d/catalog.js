/* Product catalog for the visualizer.
   Colors are on-screen approximations of each manufacturer's published color
   names. Always confirm with physical samples before ordering.
   Add or remove lines here; the visualizer UI builds itself from this file. */

export const CATALOG = {
  roof: {
    label: "Roofing",
    lines: [
      { id: "gaf-hdz", brand: "GAF", name: "Timberline HDZ", type: "shingle", colors: [
        ["Charcoal", "#3a3b3e"], ["Pewter Gray", "#66676a"], ["Weathered Wood", "#6c6253"], ["Barkwood", "#594538"],
        ["Slate", "#4b5159"], ["Hickory", "#6a4e37"], ["Shakewood", "#8a6f4f"], ["Oyster Gray", "#8d8b85"],
        ["Hunter Green", "#3c4a3e"], ["Fox Hollow Gray", "#77746e"],
      ] },
      { id: "ct-landmark", brand: "CertainTeed", name: "Landmark", type: "shingle", colors: [
        ["Moire Black", "#2a2b2e"], ["Georgetown Gray", "#5d6064"], ["Driftwood", "#7a7064"], ["Weathered Wood", "#6c6253"],
        ["Colonial Slate", "#575c63"], ["Heather Blend", "#6b5a55"], ["Resawn Shake", "#7c6249"], ["Burnt Sienna", "#6e4a3a"],
      ] },
      { id: "oc-duration", brand: "Owens Corning", name: "Duration", type: "shingle", colors: [
        ["Onyx Black", "#232427"], ["Estate Gray", "#5f6265"], ["Driftwood", "#7c7366"], ["Teak", "#6b5543"],
        ["Brownwood", "#57463a"], ["Sierra Gray", "#75767a"], ["Quarry Gray", "#68696b"], ["Harbor Blue", "#4a5563"],
      ] },
      { id: "metal-ss", brand: "Standing Seam", name: "24ga Metal", type: "metal", colors: [
        ["Matte Black", "#1f2022"], ["Charcoal Gray", "#45484c"], ["Dark Bronze", "#3e3128"], ["Galvalume", "#a9adb1"],
        ["Slate Gray", "#5d646b"], ["Colonial Red", "#7a2e27"], ["Evergreen", "#2e4537"], ["Copper Penny", "#9a5b36"],
      ] },
    ],
  },
  siding: {
    label: "Siding",
    profiles: [["lap", "Lap"], ["batten", "Board & Batten"], ["shake", "Shake"]],
    lines: [
      { id: "hardie", brand: "James Hardie", name: "ColorPlus", colors: [
        ["Arctic White", "#efeee8"], ["Light Mist", "#d6d7cf"], ["Pearl Gray", "#a9aba7"], ["Gray Slate", "#7c8082"],
        ["Aged Pewter", "#6e6c64"], ["Iron Gray", "#50545a"], ["Night Gray", "#2d3134"], ["Boothbay Blue", "#6d8496"],
        ["Evening Blue", "#3c4c5f"], ["Deep Ocean", "#2f4a5c"], ["Mountain Sage", "#8b9480"], ["Cobble Stone", "#a39a86"],
        ["Monterey Taupe", "#8c8270"], ["Khaki Brown", "#8b7b62"], ["Timber Bark", "#6b5848"], ["Countrylane Red", "#6e2f2a"],
      ] },
      { id: "vinyl", brand: "Premium", name: "Insulated Vinyl", colors: [
        ["Snow White", "#f1f0eb"], ["Linen", "#e3dccb"], ["Harbor Gray", "#8c9093"], ["Charcoal", "#47494d"],
        ["Sandstone", "#c9b996"], ["Coastal Blue", "#7b90a3"], ["Sage", "#9aa189"], ["Ebony", "#2a2a2c"],
      ] },
      { id: "cedar", brand: "Natural", name: "Cedar / Wood-Look", colors: [
        ["Natural Cedar", "#a8774d"], ["Honey Oak", "#b48a58"], ["Weathered Teak", "#8c7a63"], ["Smoked Walnut", "#5b4332"],
      ] },
    ],
  },
  trim: {
    label: "Trim",
    lines: [
      { id: "trim", brand: "James Hardie", name: "Trim & Fascia", colors: [
        ["Arctic White", "#f4f3ee"], ["Light Mist", "#d6d7cf"], ["Iron Gray", "#50545a"], ["Night Gray", "#2d3134"],
        ["Matte Black", "#17181a"], ["Khaki Brown", "#8b7b62"],
      ] },
    ],
  },
  windows: {
    label: "Windows",
    grids: [["none", "No Grids"], ["colonial", "Colonial"], ["prairie", "Prairie"], ["craftsman", "Craftsman"]],
    lines: [
      { id: "win", brand: "Fiberglass", name: "Exterior Frame", colors: [
        ["White", "#f2f2ee"], ["Black", "#16171a"], ["Dark Bronze", "#3a2e25"], ["Ebony", "#22201e"], ["Pebble Gray", "#9b9890"],
      ] },
    ],
  },
  door: {
    label: "Front Door",
    styles: [["craftsman", "Craftsman"], ["modern", "Modern Glass"], ["panel", "Six Panel"]],
    lines: [
      { id: "door", brand: "Fiberglass", name: "Entry Door", colors: [
        ["Electric Blue", "#2552c9"], ["Matte Black", "#141518"], ["Navy", "#1c2d55"], ["Oxblood", "#6e1e21"],
        ["Natural Oak", "#8a5a34"], ["Iron Gray", "#4a4f57"], ["Sage", "#7d8b74"], ["White", "#f2f2ee"],
      ] },
    ],
  },
  gutters: {
    label: "Gutters",
    lines: [
      { id: "gut", brand: "Seamless", name: "6\" K-Style", colors: [
        ["White", "#f2f2ee"], ["Black", "#16171a"], ["Musket Brown", "#4a3a2c"], ["Clay", "#b5a68a"], ["Copper", "#b06a3c"],
      ] },
    ],
  },
  accents: {
    label: "Stone",
    lines: [
      { id: "stone", brand: "Stone Veneer", name: "Wainscot & Piers", colors: [
        ["None", null], ["Gray Ledgestone", "#bfbfbb"], ["Fieldstone", "#cdb79a"], ["Charcoal Ledge", "#7d7d7c"],
      ] },
    ],
  },
};

// Starting point = a tired builder-grade house. "Before" in compare mode.
export const ORIGINAL = {
  roof: { line: "ct-landmark", color: "Resawn Shake" },
  siding: { line: "vinyl", color: "Linen", profile: "lap" },
  trim: { line: "trim", color: "Arctic White" },
  windows: { line: "win", color: "White", grid: "colonial" },
  door: { line: "door", color: "Oxblood", style: "panel" },
  gutters: { line: "gut", color: "White" },
  accents: { line: "stone", color: "None" },
};

export const PRESETS = [
  { name: "Builder Original", design: ORIGINAL },
  { name: "Midnight Slate", design: {
    roof: { line: "gaf-hdz", color: "Charcoal" }, siding: { line: "hardie", color: "Iron Gray", profile: "lap" },
    trim: { line: "trim", color: "Matte Black" }, windows: { line: "win", color: "Black", grid: "none" },
    door: { line: "door", color: "Electric Blue", style: "modern" }, gutters: { line: "gut", color: "Black" },
    accents: { line: "stone", color: "Charcoal Ledge" } } },
  { name: "Modern Farmhouse", design: {
    roof: { line: "metal-ss", color: "Matte Black" }, siding: { line: "hardie", color: "Arctic White", profile: "batten" },
    trim: { line: "trim", color: "Arctic White" }, windows: { line: "win", color: "Black", grid: "none" },
    door: { line: "door", color: "Natural Oak", style: "craftsman" }, gutters: { line: "gut", color: "Black" },
    accents: { line: "stone", color: "None" } } },
  { name: "Coastal Blue", design: {
    roof: { line: "oc-duration", color: "Estate Gray" }, siding: { line: "hardie", color: "Boothbay Blue", profile: "shake" },
    trim: { line: "trim", color: "Arctic White" }, windows: { line: "win", color: "White", grid: "colonial" },
    door: { line: "door", color: "Matte Black", style: "craftsman" }, gutters: { line: "gut", color: "White" },
    accents: { line: "stone", color: "Gray Ledgestone" } } },
  { name: "Navy Luxe", design: {
    roof: { line: "ct-landmark", color: "Moire Black" }, siding: { line: "hardie", color: "Evening Blue", profile: "lap" },
    trim: { line: "trim", color: "Arctic White" }, windows: { line: "win", color: "Black", grid: "prairie" },
    door: { line: "door", color: "Natural Oak", style: "craftsman" }, gutters: { line: "gut", color: "Black" },
    accents: { line: "stone", color: "Gray Ledgestone" } } },
  { name: "Steel Punk", design: {
    roof: { line: "metal-ss", color: "Charcoal Gray" }, siding: { line: "hardie", color: "Night Gray", profile: "batten" },
    trim: { line: "trim", color: "Matte Black" }, windows: { line: "win", color: "Black", grid: "none" },
    door: { line: "door", color: "Electric Blue", style: "modern" }, gutters: { line: "gut", color: "Black" },
    accents: { line: "stone", color: "Charcoal Ledge" } } },
  { name: "Warm Craftsman", design: {
    roof: { line: "gaf-hdz", color: "Weathered Wood" }, siding: { line: "hardie", color: "Mountain Sage", profile: "shake" },
    trim: { line: "trim", color: "Arctic White" }, windows: { line: "win", color: "Dark Bronze", grid: "craftsman" },
    door: { line: "door", color: "Natural Oak", style: "craftsman" }, gutters: { line: "gut", color: "Musket Brown" },
    accents: { line: "stone", color: "Fieldstone" } } },
];

export function lineOf(cat, id) {
  return CATALOG[cat].lines.find((l) => l.id === id) || CATALOG[cat].lines[0];
}
export function hexOf(cat, sel) {
  const line = lineOf(cat, sel.line);
  const c = line.colors.find(([n]) => n === sel.color) || line.colors[0];
  return c[1];
}
export function describe(design) {
  const out = [];
  for (const cat of Object.keys(CATALOG)) {
    const sel = design[cat];
    if (!sel) continue;
    const line = lineOf(cat, sel.line);
    let s = `${CATALOG[cat].label}: ${line.brand} ${line.name} — ${sel.color}`;
    if (sel.profile) s += ` (${(CATALOG.siding.profiles.find((p) => p[0] === sel.profile) || [])[1]})`;
    if (sel.grid) s += ` (${(CATALOG.windows.grids.find((p) => p[0] === sel.grid) || [])[1]})`;
    if (sel.style) s += ` (${(CATALOG.door.styles.find((p) => p[0] === sel.style) || [])[1]})`;
    out.push(s);
  }
  return out;
}
