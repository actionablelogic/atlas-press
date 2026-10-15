# Atlas Press

Design printable world and region map posters in real cartographic projections,
not just Web Mercator, in the browser.

Pick a region (country, continent, ocean), a projection and a style, rotate the
globe to frame it, decorate it with overlays, and export a print-ready image up
to 2 × A0.

## Features

- **9 projections**: Equal Earth, Robinson, Winkel Tripel, Mollweide, Hobo–Dyer,
  Orthographic, Azimuthal Equidistant, Albers Equal-Area Conic, Stereographic.
  Drag to rotate the sphere, scroll to zoom.
- **18 styles**: Classic Atlas, Antique Atlas, Vintage, Minimal, Blueprint, Noir,
  Ink, Midnight, Bold Political, Terrain, Satellite, plus city-level raster
  basemaps (street, light, dark, topographic, NatGeo, ocean). Every style is
  customisable (colours, line weights, fonts, layer toggles).
- **Raster warping**: satellite and terrain imagery is reprojected per pixel in a
  WebGL2 shader, from a world texture or Web-Mercator tiles for region detail.
- **Overlays**: labelled graticule, reference lines (equator, tropics, polar
  circles), scale bar, compass rose, frame, title cartouche.
- **Export**: high-DPI PNG/JPEG (streamed in a worker) and SVG, poster aspect
  ratios (2:3, 3:4, 1:1, ISO A), print sizes from 50 × 70 cm to 2 × A0.
- **Sharing**: the full poster state round-trips through the URL or a saved file.
- **Licence notice**: a live badge states the terms of use of the data on the
  current poster (public domain, attribution required, non-commercial).

## Getting started

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build
npm run lint      # oxlint
```

The app is a fully static site with no backend; `dist/` can be deployed to any
static host.

## Stack

React 19 + TypeScript + Vite, `d3-geo` and `d3-geo-projection` for
projections, `versor` + `d3-drag`/`d3-zoom` for spherical rotation, Natural
Earth (TopoJSON) for vector data, and a WebGL2 fragment shader for raster
warping.

## Documentation

- [`PRD.md`](PRD.md): vision, tech-stack rationale, data model, feature spec
- [`STATUS.md`](STATUS.md): per-milestone task breakdown and progress
- [`NOTES.md`](NOTES.md): rendering and architecture decisions

## Licence

Source code: [MIT](LICENSE).

Bundled data, imagery and fonts keep their own licences (Natural Earth public
domain, NASA Blue Marble, SIL OFL 1.1 and Apache 2.0 fonts). Tile services loaded
at runtime (EOX, Esri, CARTO) have their own terms, including a non-commercial
licence for EOX Sentinel-2. See
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
