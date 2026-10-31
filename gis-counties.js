/* County GIS building-footprint layers, checked before the nationwide fallbacks.
   Each is a public ArcGIS REST polygon layer. `box` is a generous [south, west, north, east]
   around the county; where boxes overlap at county lines, each match is tried in order.
   To add a county: find its open-data hub or ArcGIS REST services directory, locate a building
   footprint layer, and confirm `<url>/query?where=1=1&returnCountOnly=true&f=json` returns a count. */
export const COUNTIES = [
  {
    name: "Douglas County, NE", short: "Douglas County GIS (DOGIS)", year: 2022, buildings: 268909,
    box: [41.18, -96.48, 41.41, -95.90],
    url: "https://dcgis.org/server/rest/services/Hosted/2022_Building_Footprints/FeatureServer/0",
    source: "https://data.dogis.org",
  },
  {
    name: "Sarpy County, NE", short: "Sarpy County GIS", year: null, buildings: 79348,
    box: [40.98, -96.48, 41.25, -95.83],
    url: "https://geodata.sarpy.gov/arcgis/rest/services/Cadastral/LandRecordsDynamic/MapServer/42",
    source: "https://data2-sarpy.opendata.arcgis.com",
  },
  {
    name: "Lancaster County, NE", short: "Lincoln–Lancaster County GIS", year: 2026, buildings: 160473,
    box: [40.51, -96.93, 41.06, -96.45],
    url: "https://gis.lincoln.ne.gov/public/rest/services/BuildingSafety/BuildingFootprints/MapServer/8",
    source: "https://gis.lincoln.ne.gov/public/rest/services/BuildingSafety/BuildingFootprints/MapServer",
  },
  {
    name: "Pottawattamie County, IA", short: "Pottawattamie County GIS (Council Bluffs)", year: 2024, buildings: 74960,
    box: [41.14, -96.02, 41.52, -95.14],
    url: "https://gis.pottcounty-ia.gov/arcgis/rest/services/Hosted/Building_Footprints_2024/FeatureServer/0",
    source: "https://gis.pottcounty-ia.gov/arcgis/rest/services/Hosted",
  },
  // Cass County, NE publishes parcels and address points (gis-cass.hub.arcgis.com) but no building
  // footprints, so Cass addresses fall through to FEMA USA Structures.
  { name: "Cass County, NE", short: "Cass County GIS", box: [40.68, -96.48, 41.06, -95.81], url: null, source: "https://gis-cass.hub.arcgis.com" },
];

export const countiesAt = (lat, lon) => COUNTIES.filter(({ box: [s, w, n, e] }) => lat >= s && lat <= n && lon >= w && lon <= e);
