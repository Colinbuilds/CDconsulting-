/* ==========================================================================
   SITE CONFIG — edit this file to make the site yours.
   Everything here is plain text; no build step needed.
   ========================================================================== */

window.SITE = {
  brand: "CD Consulting",
  name: "Colin",                       // TODO: your full name
  title: "Construction Consultant",
  phone: "(555) 555-0100",             // TODO: your phone
  email: "hello@example.com",          // TODO: your public email
  serviceArea: "Your City & Surrounding Counties", // TODO

  // Lead form delivery.
  // Leave empty to use Netlify Forms (works automatically when hosted on Netlify).
  // Or paste a Formspree / Basin / Getform endpoint URL here, e.g.
  // "https://formspree.io/f/abcdwxyz"
  formEndpoint: "",
};

/* --------------------------------------------------------------------------
   PAST WORK — add your projects here.
   Put photos in /images/projects/ and reference them by path.
   Leave `before`/`after` empty ("") to show a styled placeholder.
   category: roofing | siding | windows | additions | exterior
   -------------------------------------------------------------------------- */
window.PROJECTS = [
  {
    title: "Midnight Slate Re-Roof",
    location: "Sample Project",
    category: "roofing",
    year: 2026,
    scope: ["Full tear-off", "Designer shingle", "Ridge vent", "Seamless gutters"],
    description:
      "Swapped a tired brown 3-tab for a charcoal designer shingle with matte black gutters. Rendered three color options with the homeowner before ordering a single bundle.",
    before: "",
    after: "",
  },
  {
    title: "Board & Batten Transformation",
    location: "Sample Project",
    category: "siding",
    year: 2026,
    scope: ["Fiber cement", "Board & batten", "Black trim package"],
    description:
      "Dated beige vinyl to crisp white board & batten with black window trim. AI renders locked the look in on the first meeting.",
    before: "",
    after: "",
  },
  {
    title: "Black Frame Window Package",
    location: "Sample Project",
    category: "windows",
    year: 2025,
    scope: ["14 windows", "Fiberglass", "Black exterior / white interior"],
    description:
      "Full window swap to black-frame fiberglass. Managed ordering, lead times and install crew scheduling end to end.",
    before: "",
    after: "",
  },
  {
    title: "Standing Seam Metal Roof",
    location: "Sample Project",
    category: "roofing",
    year: 2025,
    scope: ["24-gauge standing seam", "Snow guards", "Custom flashing"],
    description:
      "Matte graphite standing seam on a modern farmhouse. Inspection, insurance coordination and project management through final walk.",
    before: "",
    after: "",
  },
  {
    title: "Primary Suite Addition",
    location: "Sample Project",
    category: "additions",
    year: 2025,
    scope: ["420 sq ft", "Tie-in roof", "Matched siding"],
    description:
      "Second-story primary suite tied seamlessly into the existing roofline. Rendered massing options so the owners could see scale before drawings.",
    before: "",
    after: "",
  },
  {
    title: "Full Exterior Refresh",
    location: "Sample Project",
    category: "exterior",
    year: 2024,
    scope: ["Roof", "Siding", "Windows", "Entry door"],
    description:
      "One consultant, one schedule, four trades. Roof, siding, windows and a steel-blue entry door delivered as a single coordinated build.",
    before: "",
    after: "",
  },
];
