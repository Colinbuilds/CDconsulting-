/* The scroll-through walkthroughs. Each process sets:
   T      — build timeline (fractions of the scroll); steps it leaves out show as finished
   keys   — camera path [P, position, target]
   steps  — materials that get a label + teaching card, in order: [materialId, [from, to]]
   phases — tab labels along the top
   look   — catalog design before / after (from catalog.js presets)            */
import { MATERIALS, EXTRA, GROUPS } from "./materials.js";
import { PRESETS, ORIGINAL } from "./catalog.js";

export { GROUPS };
export const LIB = Object.fromEntries([...MATERIALS, ...EXTRA].map((m) => [m.id, m]));

const FINAL = PRESETS.find((p) => p.name === "Navy Luxe").design;
const CURB = [0, [-62, 24, 104], [8, 12, 4]];
const DUSK_HERO = [1, [42, 11, 94], [12, 11, 6]];

export const PROCESSES = {
  full: {
    title: "The full job",
    headline: "Tear it off. <em>Build it right.</em>",
    kicker: "A real job, start to finish",
    T: {
      scan: [0.015, 0.1], roofOff: [0.12, 0.28], sidingOff: [0.16, 0.32], drip: [0.36, 0.38], ice: [0.39, 0.41],
      valley: [0.42, 0.43], under: [0.45, 0.52], wrap: [0.47, 0.54], tape: [0.52, 0.54], starter: [0.56, 0.57],
      roofOn: [0.58, 0.74], step: [0.64, 0.65], pipe: [0.68, 0.69], sidingOn: [0.7, 0.8], ridgeVent: [0.75, 0.76],
      ridgeCap: [0.78, 0.79], finish: [0.82, 0.84], dusk: [0.9, 0.99],
    },
    keys: [
      CURB, [0.12, [-44, 52, 74], [2, 18, 2]], [0.3, [-8, 56, 62], [4, 18, 2]], [0.42, [-26, 36, 48], [-4, 19, 10]],
      [0.53, [18, 26, 52], [10, 15, 12]], [0.66, [52, 32, 54], [14, 16, 4]], [0.8, [-30, 30, 66], [-4, 16, 6]],
      [0.9, [44, 14, 70], [8, 9, 10]], DUSK_HERO,
    ],
    steps: MATERIALS.map((m) => [m.id, m.at]),
    phases: [["Inspect", 0], ["Tear-off", 0.12], ["Dry-in", 0.35], ["Rebuild", 0.555], ["Finish", 0.815]],
    look: { during: { ...ORIGINAL, roof: FINAL.roof, siding: FINAL.siding }, after: FINAL },
    readouts: [["Roof squares", "roof"], ["Siding", "siding"]],
    days: [[0, "00"], [0.12, "01"], [0.35, "02"], [0.66, "03"]],
  },

  roofing: {
    title: "Roof replacement",
    headline: "A roof, <em>layer by layer.</em>",
    kicker: "Roofing walkthrough",
    T: {
      scan: [0.015, 0.08], roofOff: [0.1, 0.28], deckFix: [0.32, 0.38], drip: [0.4, 0.42], ice: [0.43, 0.46],
      valley: [0.47, 0.49], under: [0.5, 0.6], starter: [0.61, 0.63], roofOn: [0.64, 0.82], step: [0.7, 0.71],
      pipe: [0.76, 0.77], ridgeVent: [0.83, 0.85], ridgeCap: [0.86, 0.88], finish: [0.9, 0.92], dusk: [0.93, 0.99],
    },
    keys: [
      CURB, [0.1, [-40, 50, 70], [2, 18, 2]], [0.3, [-6, 48, 50], [6, 20, 6]], [0.42, [-26, 36, 48], [-4, 19, 10]],
      [0.6, [16, 42, 60], [6, 19, 6]], [0.72, [50, 32, 50], [16, 15, 4]], [0.85, [8, 46, 50], [6, 24, 2]],
      [0.93, [40, 18, 80], [10, 12, 6]], DUSK_HERO,
    ],
    steps: [
      ["old-shingle", [0.02, 0.11]], ["decking", [0.28, 0.33]], ["rot-deck", [0.33, 0.39]], ["drip-edge", [0.4, 0.44]],
      ["ice-water", [0.44, 0.48]], ["valley", [0.47, 0.51]], ["underlayment", [0.51, 0.6]], ["starter", [0.6, 0.65]],
      ["shingles", [0.65, 0.71]], ["step-flashing", [0.7, 0.76]], ["pipe-boot", [0.76, 0.82]], ["ridge-vent", [0.83, 0.87]],
      ["ridge-cap", [0.87, 0.91]], ["cleanup", [0.92, 0.99]],
    ],
    phases: [["Inspect", 0], ["Tear-off", 0.1], ["Repair", 0.3], ["Dry-in", 0.4], ["Shingle", 0.61], ["Finish", 0.83]],
    look: { during: { ...ORIGINAL, roof: FINAL.roof }, after: { ...ORIGINAL, roof: FINAL.roof } },
    readouts: [["Roof squares", "roof"]],
    days: [[0, "00"], [0.1, "01"], [0.6, "02"]],
  },

  siding: {
    title: "Siding replacement",
    headline: "Siding, <em>done right.</em>",
    kicker: "Siding walkthrough",
    T: {
      scan: [0.015, 0.08], sidingOff: [0.1, 0.3], wrap: [0.34, 0.46], tape: [0.47, 0.49], wallStarter: [0.5, 0.52],
      sidingOn: [0.54, 0.82], finish: [0.85, 0.87], dusk: [0.92, 0.99],
    },
    keys: [
      CURB, [0.12, [-42, 20, 72], [-6, 10, 10]], [0.32, [8, 16, 62], [6, 11, 12]], [0.48, [18, 15, 40], [6, 13, 13]],
      [0.55, [-30, 8, 50], [-12, 4, 16]], [0.7, [-36, 16, 64], [-6, 10, 12]], [0.86, [48, 16, 70], [12, 9, 6]], DUSK_HERO,
    ],
    steps: [
      ["old-siding", [0.03, 0.12]], ["wall-sheathing", [0.28, 0.36]], ["house-wrap", [0.36, 0.47]], ["window-tape", [0.47, 0.52]],
      ["wall-starter", [0.5, 0.56]], ["siding", [0.58, 0.8]], ["trim", [0.84, 0.9]], ["stone", [0.9, 0.97]],
    ],
    phases: [["Inspect", 0], ["Strip", 0.1], ["Wrap", 0.33], ["Side", 0.5], ["Trim", 0.84]],
    look: { during: { ...ORIGINAL, siding: FINAL.siding }, after: { ...ORIGINAL, siding: FINAL.siding, trim: FINAL.trim, accents: FINAL.accents } },
    readouts: [["Siding", "siding"]],
    days: [[0, "00"], [0.1, "01"], [0.5, "02"]],
  },

  windows: {
    title: "Window replacement",
    headline: "A window, <em>sealed for good.</em>",
    kicker: "Window walkthrough",
    T: {
      winOut: [0.1, 0.22], sillPan: [0.3, 0.32], winIn: [0.38, 0.5], winTape: [0.55, 0.57], winTrim: [0.65, 0.75],
      finish: [0.84, 0.86], dusk: [0.92, 0.99],
    },
    keys: [
      [0, [-30, 22, 90], [6, 12, 8]], [0.12, [14, 17, 46], [3.3, 13.6, 14]], [0.35, [9, 15.5, 36], [3.3, 13.8, 14]],
      [0.55, [6, 15, 32], [3.3, 14, 14]], [0.72, [14, 16, 42], [3.3, 13.8, 14]], [0.86, [36, 16, 76], [8, 11, 6]], DUSK_HERO,
    ],
    steps: [
      ["old-window", [0.03, 0.2]], ["rough-opening", [0.22, 0.3]], ["sill-pan", [0.3, 0.38]], ["new-window", [0.4, 0.53]],
      ["win-flash", [0.55, 0.64]], ["win-trim", [0.66, 0.82]],
    ],
    phases: [["Remove", 0], ["Prep", 0.22], ["Set", 0.38], ["Flash", 0.55], ["Trim", 0.65], ["Every window", 0.84]],
    // light house + black frames, so the new window reads clearly against the old ones
    look: { during: ORIGINAL, after: { ...ORIGINAL, windows: FINAL.windows }, focus: FINAL.windows },
    readouts: [],
    days: [[0, "01"]],
  },

  gutters: {
    title: "Gutter replacement",
    headline: "Water, <em>handled.</em>",
    kicker: "Gutter walkthrough",
    T: { gutterOff: [0.1, 0.22], hangers: [0.3, 0.33], gutterOn: [0.36, 0.6], spouts: [0.62, 0.72], guards: [0.76, 0.8], dusk: [0.92, 0.99] },
    keys: [
      [0, [-40, 20, 90], [8, 12, 6]], [0.12, [30, 18, 58], [8, 14, 14]], [0.3, [24, 17, 42], [10, 15.5, 15]],
      [0.45, [-10, 19, 56], [4, 14, 14]], [0.64, [36, 10, 50], [18, 8, 14]], [0.78, [16, 24, 46], [6, 15, 14]],
      [0.9, [44, 14, 80], [10, 10, 6]], DUSK_HERO,
    ],
    steps: [
      ["old-gutters", [0.03, 0.2]], ["fascia-check", [0.22, 0.3]], ["hangers", [0.3, 0.36]], ["seamless-gutter", [0.38, 0.6]],
      ["downspouts", [0.62, 0.74]], ["guards", [0.76, 0.88]],
    ],
    phases: [["Remove", 0], ["Prep", 0.22], ["Hang", 0.36], ["Downspouts", 0.62], ["Guards", 0.76]],
    look: { during: { ...ORIGINAL, gutters: FINAL.gutters }, after: { ...ORIGINAL, gutters: FINAL.gutters } }, // black seamless vs. the old white
    readouts: [],
    days: [[0, "01"]],
  },
};
