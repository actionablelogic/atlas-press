# status.md — Progress Tracker

Tracking implementation progress against the milestones in `prj.md`.

## Current milestone: M5 — Overlays

> Graticule edge degree-labels; compass, frame, cartouche, text with transform
> handles (drag/resize/rotate), stored poster-relative so they survive
> reprojection and export.

### Task breakdown

- [x] 1. Graticule edge degree-labels (`render/graticuleLabels.ts`) — meridians
      at topmost visible point, parallels at leftmost; reprojects with the map;
      light/dark auto per background; drawn on canvas
- [x] 2. Overlay model (`overlays/types.ts`) — poster-relative (0..1) transforms;
      compass / cartouche / text / frame
- [x] 3. Decor overlay layer (`OverlayLayer.tsx`) — DOM/SVG over the canvas;
      move + corner-resize + rotate (Shift = 15° snap) + center snapping; the
      layer is pointer-events-none so the map stays draggable underneath
- [x] 4. Compass rose (star / simple SVG), decorative frame (thin/double/woven),
      title cartouche (title+subtitle, boxed), user text (font/color)
- [x] 5. Overlays panel (`OverlaysPanel.tsx`) — add / list / select / delete /
      edit props + graticule-labels toggle
- [x] 6. Poster-locked behavior: overlays stay put while the map reprojects

**M5 status: COMPLETE.** `tsc -b` + `vite build` clean; verified headless (zero
console/page errors): graticule labels render; all 4 overlay types add; compass
drag + resize confirmed; overlays stay in poster space when switching to
Orthographic. Reproduces the reference wall-map look (cartouche + compass +
frame + labelled graticule).

### New/changed files
- `src/overlays/types.ts`, `src/render/graticuleLabels.ts`
- `src/components/OverlayLayer.tsx`, `src/components/OverlaysPanel.tsx`
- `src/render/renderMap.ts` (graticule labels), `src/components/MapCanvas.tsx`
  (children slot + graticule flag + background-click deselect), `src/App.tsx`

### Follow-ups carried forward
- Compass "auto-rotate to true north" (needs the projection's north bearing at
  the compass position — deferred)
- Tropics / equator / polar-circle dashed lines; Tissot indicatrices; scale bar
- Overlays are DOM in preview; M6 export must rasterize them onto the canvas
- Inline text editing (currently edited via the panel)

---

## M4b — Raster warping, Mercator tiles

> Region-scale crisp satellite from Web-Mercator XYZ tiles: fetch → mosaic →
> warp in the mesh; pluggable source + key + attribution. Third risky milestone.
> **Exit test: crisp region-scale country in Orthographic from Sentinel-2 tiles**
> (the A0 *export* itself lands in M6).

### Task breakdown

- [x] 1. Mercator math (`geo/mercator.ts`): lon/lat → fractional tile, m/px
- [x] 2. Pluggable tile sources (`render/tileSources.ts`): EOX Sentinel-2
      cloudless (default, CC-BY-NC-SA), Esri World Imagery, Custom (URL+{key}).
      Both defaults verified to send CORS.
- [x] 3. Tile cache + fetch (`render/tileCache.ts`): IndexedDB store +
      concurrency-limited (6) CORS fetch → ImageBitmap; AbortSignal for staleness
- [x] 4. Mosaic (`render/MercatorMosaic.ts`): visible-bbox from inverse grid,
      zoom selection from bbox+canvas (capped ≤144 tiles / 4096px), fetch +
      assemble into a canvas → GL texture; provides the Mercator uvFn
- [x] 5. Generalized warper: `drawMesh(projection, …, tex, uvFn, {wrap,clear})`
      — same mesh path warps equirect (wrap+seam-unwrap) and mosaic (cull off-[0,1])
- [x] 6. Two-tier Satellite: world → Blue Marble equirect; region → Blue Marble
      base + Mercator tiles composited on top (fills mosaic gaps). Threshold =
      BM would upscale. Tiles refetched only on idle (not mid-drag).
- [x] 7. Settings UI (`SatelliteSettings`): source dropdown, custom URL + API key
      (local only), attribution + license display; map-corner credit
- [x] 8. renderMap decoupled via a `renderRaster` host callback

**M4b status: COMPLETE.** `tsc -b` + `vite build` clean; verified headless
(WebGL2/SwiftShader): **0 tiles at world scale (Blue Marble), 72 tiles fetched
when zoomed to Italy, 97 after warping to Orthographic**, crisp imagery
(colorfulness 0.95), correct credit chain, zero console/page errors. Exit test
(crisp country in Orthographic from Sentinel-2) met on-screen; A0 export = M6.

### New/changed files
- `src/geo/mercator.ts`, `src/render/tileSources.ts`, `src/render/tileCache.ts`,
  `src/render/MercatorMosaic.ts`, `src/components/SatelliteSettings.tsx`
- `src/render/RasterWarper.ts` — generalized to `drawMesh` + texture upload
- `src/render/renderMap.ts` — `renderRaster` callback
- `src/components/MapCanvas.tsx` — mosaic + two-tier `renderRaster` + tileConfig
- `src/App.tsx` — tileConfig state, satellite settings, credit

### Follow-ups carried forward
- Progressive mosaic upload (currently uploads once all tiles in a view arrive)
- Tiles refetch per projection change even for the same region (acceptable)
- IndexedDB cache has no eviction/size cap yet
- Region satellite is non-commercial with EOX default (surface near Export in M6)

---

## M3b — Customize panel (+ Hobo–Dyer)

> Spec expanded (prj.md): styles are **presets + a user diff**, not fixed. Layer
> toggles, per-layer color/width, per-class typography, background & ocean colors.
> Plus a 9th projection (Hobo–Dyer). **Exit test: recreate a passable Minimal
> look starting from the Classic Atlas preset using only panel controls.**

### Task breakdown

- [x] 1. Hobo–Dyer projection (9th card) — `geoCylindricalEqualArea().parallel(37.5)`,
      rotates-λ capability. (Gall–Peters/Behrmann/south-up variants = noted follow-up.)
- [x] 2. `StyleOverrides` model + `applyOverrides(preset, diff) → StyleDef`
      (`styles/overrides.ts`); renderer only sees the resolved style
- [x] 3. Layer toggles: borders, fills, coastline, rivers, lakes, roads, graticule,
      + label classes (country/capital/city/ocean). Toggling ON a layer absent from
      the preset adds it from a catalog default; toggling OFF removes it
- [x] 4. Per-layer color + stroke width; flat land-fill override; background & ocean
- [x] 5. Per-class typography: font family, size scale, color, halo, small-caps;
      "font for all classes" link control
- [x] 6. Roads layer: NE **10m** major highways, filtered to 9,752 + quantized
      (2.3 MB), served from /public, **lazy-loaded on first toggle**
- [x] 7. ~8 bundled OFL fonts (EB Garamond, Playfair, Inter, Archivo, Roboto Slab,
      JetBrains Mono) via /public/fonts/fonts.css; force-loaded then redraw
- [x] 8. Customize panel UI (collapsible, two-tier disclosure); reset-on-preset-
      change with confirm

**M3b status: COMPLETE.** `tsc -b` + `vite build` clean; verified headless (zero
console/page errors): Hobo–Dyer renders; the exit test (Classic Atlas → Minimal-ish
via toggles) works; roads lazy-load + render (confirmed via magenta pixel probe);
fonts load. Small-caps/halo/size/color controls resolve through `applyOverrides`.

### New/changed files
- `src/styles/overrides.ts` — StyleOverrides + applyOverrides + resolve helpers
- `src/styles/fonts.ts` — curated font list + bundled families
- `src/components/CustomizePanel.tsx` — the panel
- `src/data/roads.ts` + `public/data/roads.json` — lazy roads
- `public/fonts/*` — bundled OFL woff2 + fonts.css
- `src/geo/projections.ts` (+shim) — Hobo–Dyer
- `src/styles/styles.ts` — `roads` layer, LabelClass smallCaps/haloWidth
- `src/render/renderMap.ts` — roads + flat-fill; `src/render/labels.ts` — small-caps
- `src/components/MapCanvas.tsx`, `src/App.tsx` — resolved-style prop, overrides state

### Follow-ups carried forward
- coastVignette isn't a toggle → turning fills off exposes its interior fill as
  muddy grey land (still "passable"); consider glow-only vignette or a toggle
- Hobo–Dyer variants (Gall–Peters 45°, Behrmann 30°, south-up γ=180°)
- Color inputs are hex-only (drop rgba alpha on edit)
- Fonts/roads add to bundle/assets; still no lazy-loading of core TopoJSON

---

## M4a — Raster warping (equirectangular)

> WebGL inverse-projection shader sampling a single equirectangular texture;
> Terrain style + world-scale Satellite; interactive-quality degradation.
> Second risky milestone. **Exit test: Blue Marble warps onto the Orthographic
> globe, draggable, near-side-only labels.**

### Task breakdown

- [x] 1. Equirectangular textures prepped → `public/textures/` (Blue Marble
      satellite + Natural Earth II shaded-relief terrain, both 5400×2700)
- [x] 2. WebGL2 raster warper (`render/RasterWarper.ts`): **mesh reprojection** —
      invert a coarse screen grid on CPU, GPU bilinearly interpolates the texture
      across triangles. One code path for all 8 projections (no per-projection
      GLSL). Antimeridian seam unwrap + off-globe cell culling.
- [x] 3. `raster` layer type + Terrain & Satellite styles (raster underlay +
      vector overlays: graticule, borders, rivers, labels)
- [x] 4. renderMap integration: warp on GPU, composite clipped to sphere; flat
      ocean fill shows while texture loads / if WebGL unavailable
- [x] 5. Interactive degradation: coarse mesh (32) during drag, fine (110) idle
- [x] 6. MapCanvas: warper lifecycle + redraw-on-texture-load

**M4a status: COMPLETE.** `tsc -b` + `vite build` clean; verified headless with
WebGL2 (SwiftShader): satellite→Robinson/Orthographic, terrain→world/Africa,
and **dragging the warped Orthographic globe** all render correctly with
near-side-only labels and zero console/page errors.

### New/changed files
- `src/render/RasterWarper.ts` — WebGL2 mesh reprojection warper
- `src/styles/styles.ts` — `raster` layer + Terrain/Satellite styles
- `src/render/renderMap.ts` — raster layer compositing + mesh-density knob
- `src/components/MapCanvas.tsx` — warper instance, sizing, load redraw
- `public/textures/satellite.jpg`, `public/textures/terrain.jpg`

### Follow-ups carried forward
- Region-scale crisp satellite = **M4b** (Mercator tile warping; licensing §8)
- Higher-res world textures available (Blue Marble 21600×10800) if wanted
- Textures bundled in `public/` (lazy-loaded on style select — good); consider
  a lower-res placeholder swapped for full-res on idle
- Projection thumbnail previews; lazy-load vector TopoJSON out of JS bundle

---

## M3 — Styles (Classic Atlas + Minimal)

> Vector-only styles incl. political coloring, coast vignette, basic labels
> with decluttering. Style spec is declarative (layer list + paint props).

### Task breakdown

- [x] 1. Declarative style system (`StyleDef` = ordered `LayerSpec[]`; renderer
      interprets a fixed layer vocabulary → new style = data, not code)
- [x] 2. Greedy graph-coloring of countries (topojson `neighbors`, palette-agnostic
      index, neighbors always differ) stored on `WorldData.countryColor`
- [x] 3. Classic Atlas: paper bg + speckle texture, ocean fill, faint graticule,
      coast vignette (blurred land-shadow glow), political fills, coastline,
      rivers, lakes, serif labels
- [x] 4. Minimal: flat ground, single-line coastlines + faint borders, sans labels
- [x] 5. Labels (`render/labels.ts`): oceans/seas, countries, capitals, cities;
      per-class `minScale` thresholds; project + visibility test (off-canvas +
      far-side-of-globe for clipping projections); greedy priority decluttering
      with halos; labels skipped during active drag/zoom
- [x] 6. Natural Earth 110m data added (lakes, major rivers, populated places)
- [x] 7. Style picker UI

**M3 status: COMPLETE.** `tsc -b` + `vite build` clean; verified headless (zero
console/page errors): Classic Atlas world + Europe + Japan (capitals/cities
decluttered), Minimal, and ocean/antimeridian framing all render correctly.

**Bug fixed during M3 (latent since M2):** the continent/ocean framing rectangle
was wound so `d3.geoArea` read it as ~4π (the whole sphere *minus* the box) and
`geoBounds` returned the whole world → `fitExtent` fit the complement, so
continent/ocean selections only rotated but never zoomed. (The M2 "Pacific"
screenshot looked world-scale for exactly this reason, not correct framing.)
Fixed by reversing the ring when `geoArea > 2π`. Continents/oceans now fit ~70%.

### New/changed files
- `src/styles/styles.ts` — StyleDef/LayerSpec + Classic Atlas & Minimal
- `src/render/renderMap.ts` — rewritten as a style-driven layer pipeline
- `src/render/labels.ts` — candidate gathering, visibility, decluttering
- `src/data/physical.ts` + `src/data/ne_110m_*.json` — lakes/rivers/places
- `src/geo/data.ts` — greedy political coloring
- `src/geo/gazetteer.ts` — rectangle winding fix
- `src/components/StylePicker.tsx`, `MapCanvas.tsx`, `App.tsx`

### Follow-ups carried forward
- Rivers are sparse at 110m (13 major rivers) — add 50m rivers/lakes for detail
- Projection thumbnail mini-previews (still text cards)
- Lazy-load bundled TopoJSON/GeoJSON out of the JS chunk (size warning)
- Curved/area ocean labels + multilingual = v2 (per prj.md §5.5)

---

## M2 — Region search

> Gazetteer JSON (countries + continents + oceans), combobox, fit-to-region
> incl. antimeridian cases.

### Task breakdown

- [x] 1. Gazetteer: 241 countries (derived from Natural Earth 50m), 7 continents,
      20 oceans/seas (hand-curated centroid + framing bbox)
- [x] 2. Fuzzy-search combobox (substring + prefix + subsequence scoring,
      keyboard nav, kind chips, clear button)
- [x] 3. Fit-to-region: rotate-to-centroid per projection capability
      (azimuthal λφ, conic λ+center+⅙-rule parallels, world-cyl λ-only) +
      `fitExtent` to ~70% of the canvas
- [x] 4. Antimeridian cases: Pacific centered on 180°, Fiji framed correctly
      (fold >2π `geoArea` to complement so the real largest island wins)
- [x] 5. Largest-landmass fit (drops far-flung territories → France frames
      metropolitan France, not the globe)
- [x] 6. Polar auto-suggest: Antarctica / Arctic Ocean / Southern Ocean switch
      to Azimuthal Equidistant unless already on an azimuthal
- [x] 7. Reset re-fits the selected region (world if none)

**M2 status: COMPLETE.** `tsc -b` + `vite build` clean; verified headless:
search ranking, antimeridian framing (Pacific/Fiji), polar auto-suggest, and
per-projection region fits all correct with zero console/page errors.

**Bug fixed during M2 (latent since M1):** `data.ts` double-wrapped the land
FeatureCollection, so `geoPath` silently rendered **no land fill** — every
prior map showed only interior borders. Now continents fill correctly
(world land coverage ~15%, France/Fiji land visible).

### New/changed files
- `src/geo/gazetteer.ts` — entries + curated continents/oceans + fuzzy search
- `src/geo/view.ts` — shared `buildProjection` / `fitWorld` / `fitRegion`
- `src/components/SearchBox.tsx` — combobox
- `src/geo/data.ts` — land FeatureCollection normalization fix
- `src/components/MapCanvas.tsx` — region prop + region-aware refit
- `src/App.tsx` — selection state + polar auto-suggest wiring

### Follow-ups carried forward
- Projection thumbnail mini-previews (still text cards)
- Lazy-load 50m/10m TopoJSON out of the JS bundle (chunk-size warning)
- France-type centroid: fine now via largest-landmass, but selecting "France"
  drops overseas territories from the initial frame (by design; user can pan)
- Ocean/sea list is a starter set (prj.md open question #4)

---

## M1 — Projection core

> Blank page → Natural Earth land + borders rendered via d3-geo canvas; projection
> switcher (all 8); versor drag + zoom + fitExtent; per-projection capability
> descriptors. **Exit test:** drag Antarctica to center in Orthographic without
> visual glitches.

### Task breakdown

- [x] 1. Scaffold Vite + React + TypeScript project
- [x] 2. Install deps (d3-geo, d3-geo-projection, versor, topojson-client, world-atlas data)
- [x] 3. Load Natural Earth land + country borders (TopoJSON → GeoJSON)
- [x] 4. Projection registry: all 8 projections + capability descriptors
- [x] 5. Canvas renderer via d3-geo path (sphere outline + graticule + land + borders, clipped)
- [x] 6. Projection switcher UI (8 cards/buttons)
- [x] 7. versor drag (rotation) respecting per-projection `rotates` capability
- [x] 8. Scroll/pinch zoom (projection scale)
- [x] 9. fitExtent-based initial fit + reset
- [x] 10. Interaction-quality degradation (110m during drag, 50m on idle)
- [x] 11. Exit test: drag Antarctica to center in Orthographic, no glitches

**M1 status: COMPLETE.** `tsc -b` + `vite build` clean; all 8 projections
render with zero console/page errors; versor drag rotates the globe to a
south-polar view without glitches (verified headless via playwright-core).

### Files
- `src/geo/projections.ts` — 8-projection registry + capability descriptors
- `src/geo/data.ts` — TopoJSON → GeoJSON (land, countries, interior borders)
- `src/render/renderMap.ts` — clipped d3-geo canvas renderer + theme
- `src/components/MapCanvas.tsx` — fit / versor drag / λ-pan / zoom / dblclick
- `src/components/ProjectionPicker.tsx` — sidebar projection cards
- `src/App.tsx` — shell (topbar + sidebar + stage), Reset view
- `src/types/shims.d.ts` — ambient types for versor / d3-geo-projection / world-atlas

### Notes / decisions
- See `NOTES.md` for rendering & interaction decisions.
- **Follow-ups (not blocking M1):** projection thumbnail mini-previews per card
  (`prj.md` §5.3 — currently text-only cards); lazy-load the 50m/10m TopoJSON
  out of the JS bundle (Vite chunk-size warning); ⅙-rule Albers standard
  parallels (needs M2 region bbox).

## Upcoming milestones

- M2 — Region search
- M3 — Styles: Classic Atlas + Minimal
- M4a — Raster warping (equirectangular)
- M4b — Raster warping (Mercator tiles)
- M5 — Overlays
- M6 — Export
- M7 — Polish
