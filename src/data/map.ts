// Where the map tool gets its pictures. Change the sources here and every map on the site and in the app follows.
//
// Plain version: the map is three pictures stacked on each other.
//   1. far   - satellite picture with roads and town names already on it, used while zoomed out (finding the place).
//   2. close - a sharper aerial photo, used once you are zoomed in on one property.
//   3. names - road names laid over the close-up photo, so it still reads like a road map.
//
// All three are free public U.S. government maps (USGS and the Census Bureau). No account, no key, no bill,
// and no limit on business use. The trade-off is sharpness: the close-up photo is roughly 2 feet per dot.
// Google and Esri are sharper, but both need an account in CGH's name before a business site may use them.
// To switch, replace `close` (and usually `far`) with that provider's addresses and credit line.
export const MAP = {
  // Where the map opens before an address is found: Longview, TX.
  start: { lat: 32.5007, lng: -94.7405, zoom: 11 },
  // How close the map has to be before taps drop dots. Further out, a tap just zooms in.
  drawZoom: 17,
  maxZoom: 21,
  far: {
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}',
    maxNativeZoom: 16,
    credit: 'USGS The National Map',
  },
  close: {
    // An "image server": it is asked for one square of ground at a time (see ArcImageLayer in mapdraw.ts).
    url: 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage',
    minZoom: 17,
    credit: 'USDA',
  },
  names: {
    // Road-name labels only (layers 2, 4 and 6 are the label layers for main, secondary and local roads).
    url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_PhysicalFeatures/MapServer/export',
    layers: 'show:2,4,6',
    minZoom: 16,
    credit: 'U.S. Census Bureau',
  },
};
