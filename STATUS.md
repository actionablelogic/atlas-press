# Atlas Press — Status

Tracking implementation progress against the milestones in `PRD.md`.

**All milestones complete: M1, M2, M3, M3b, M4a, M4b, M5, M6, M7.** Atlas Press
is a working v1 — 9 projections, region search, style presets + a full
customize panel, equirectangular + Mercator-tile raster warping, decor overlays
with transform handles, high-DPI streaming export (PNG/JPEG/SVG), poster aspect
presets, and URL/file sharing. See per-milestone sections below and `NOTES.md`.

## Scope expansion (post-v1): more styles + city-level detail

- **13 styles now**, grouped Vector / Raster in the picker:
  - Vector presets: Classic Atlas, Minimal, **Antique Atlas, Blueprint, Vintage,
    Noir, Bold Political**.
  - Raster: Terrain, Satellite, **Street, Light, Dark, Topographic**.
- **City-level detail** via raster basemap tiles (CARTO Voyager/Positron/Dark
  Matter, Esri World Topo — all CORS-open, free w/ attribution), warped through
  the existing Mercator mosaic. Basemap styles are **two-tier**: a vector world
  base at world scale, warped street tiles at region/city scale. Esri satellite
  already reached z19; basemaps go to z20.
- Per-source attribution surfaced in the map credit; picker grouped by kind.

### Bug fixed during expansion
- `applyOverrides` rebuilt layers into a fixed order that placed the **raster
  layer before the `land` fill** — fine for satellite/terrain (borders/labels
  overlay imagery) but the basemap `land` fill then **covered the tiles**
  (blank map). Fix: texture rasters draw before the vector layers; **basemap
  rasters draw after** them (tiles on top of the vector base). Also added a
  `RasterWarper.commit()` 2D snapshot + `preserveDrawingBuffer` so the GL warp
  is a stable `drawImage` source across rAF cycles.

### Follow-ups
- Basemap world scale shows the vector base (not global low-zoom tiles) — a true
  global mosaic (antimeridian wrap) is a later nicety.
- Vector tiles (Protomaps) for infinite-zoom vector city detail remain a future
  phase (this expansion chose raster street tiles).

## Batch 1 additions (styles + reference overlays)

- **5 more styles** (18 total): vector **Ink** (pen-and-ink) + **Midnight** (dark
  vector globe); raster basemaps **NatGeo**, **Ocean**, **Streets (Esri)** — all
  free Esri services (CORS-verified), classified "OK with attribution".
- **Reference lines** overlay: equator (solid) + tropics + polar circles
  (dashed), labelled, reproject with the map, colour adapts to light/dark bg.
- **Scale bar** overlay with a "scale true here" caveat — computes local
  metres/pixel at its position (scale is only locally exact on most projections),
  rounds to a nice 1/2/5 value, bottom-left.
- Both are geographic overlays drawn in `render/referenceOverlays.ts`, toggled in
  the Overlays panel (`GeoOverlayConfig.referenceLines` / `.scaleBar`), threaded
  through export + URL/file sharing, and scaled for high-DPI export.

## Licence notice badge

Live licence-notice badge (topbar + export dialog) stating the terms of use of
the data on the current poster (PRD.md §8):
- **✓ Public domain data** (green) — Natural Earth (PD) / NASA Blue Marble (world
  satellite) / all vector + terrain styles.
- **⚠ Attribution required** (amber) — Esri imagery/topo, CARTO basemaps
  (provider terms of use apply).
- **⚠ Non-commercial licence** (red) — EOX Sentinel-2 region satellite (CC BY-NC-SA 4.0).
- **⚠ Check source terms** (amber) — user's custom tile source.

It's **view-aware**: `MapCanvas` reports which tile source is actually painting
the current frame (`onActiveTileSource`), so world-scale Satellite (Blue Marble)
reads "Public domain data" while zooming to region (Sentinel-2) flips to
"Non-commercial licence". Sources classified via `TileSource.terms` + `usageNote`;
computed by `doc/usage.ts:posterUsage`. Detail text appears next to the Export button.

## Current milestone: M7 — Polish

> Poster aspect presets, URL sharing, keyboard a11y, mobile-usable preview,
> attribution footer.

### Task breakdown

- [x] 1. Poster aspect presets (`poster/aspects.ts` + `CanvasPanel`): 2:3, 3:4,
      1:1, ISO A (1:√2) × portrait/landscape. Poster is now a letterboxed
      fixed-aspect box (MapCanvas contain-fits it to the stage) — **also resolves
      the M6 export-aspect note** (export dims follow the poster aspect)
- [x] 2. URL sharing + save/load (`doc/serialize.ts`): full `PosterDoc`
      (projection, style, overrides, tile source, overlays, graticule labels,
      aspect/orientation, region id, camera view) → URL hash + JSON file. API key
      is intentionally not serialized. Restores on load incl. exact camera via
      `MapCanvas.setView`
- [x] 3. SearchBox syncs its label to a restored/programmatic selection
- [x] 4. Keyboard a11y: canvas is focusable with arrow-key pan + ± zoom;
      focus-visible outlines on all controls
- [x] 5. Mobile: responsive layout stacks (wrapped topbar, full-width search,
      scrollable panels, letterboxed poster) — usable on a 390px viewport
- [x] 6. Attribution: persistent map-corner credit + toggleable export footer

**M7 status: COMPLETE.** `tsc -b` + `vite build` clean; verified headless (zero
errors): aspect ratios exact (2:3→0.666, landscape→1.5, 1:1→1.0); Share→reload
round-trip restores projection + style + aspect + region + camera (Japan in
Winkel/Minimal/ISO-A); search label restores; mobile layout stacks.

### New/changed files
- `src/poster/aspects.ts`, `src/doc/serialize.ts`
- `src/components/CanvasPanel.tsx`, `SearchBox.tsx` (label sync)
- `src/components/MapCanvas.tsx` (aspect box sizing, setView handle, keyboard)
- `src/App.tsx` (aspect/orientation state, share/save/load, load-on-mount, toast)
- `src/App.css` (aspect/toast/focus/responsive)

### Follow-ups (post-v1)
- Full read-only mobile mode (currently responsive-editable)
- Custom aspect entry; per-print-size true aspect lock in the export dialog
- JPEG streaming for very large sizes; SVG capital/city labels; tile-cache eviction
- Compass auto-north; tropics/Tissot/scale-bar overlays; projection thumbnails

---

## M6 — Export

> Tiled high-DPI rendering with streaming PNG/JPEG encode in a worker; SVG export
> for vector styles; size/DPI dialog with A0+ presets. Overlays finally
> rasterized into exports. **Exit test (from M4b): crisp A0 country in
> Orthographic from Sentinel-2 tiles.**

### Task breakdown

- [x] 1. Print-size math (`export/sizes.ts`): presets (24×36, 50×70cm, A1, A0,
      2×A0, custom) × DPI (150/200/300, A0+ default 200); live px + est-size
- [x] 2. `renderScale` threaded through renderMap / labels / graticuleLabels so
      strokes + fonts scale for high-DPI (export = same view at higher resolution)
- [x] 3. Strip rendering (`export/renderExport.ts`): export projection + per-strip
      offset; bounded memory (one 1024px strip at a time)
- [x] 4. Streaming PNG encoder in a Worker (`pngStream.worker.ts`, pako): filter-0
      scanlines → incremental deflate → one IDAT per block; handles A0+ (140 MP)
- [x] 5. Raster export: fresh export warper + mosaic (`assemble`/`loadEquirect`
      awaited) → **satellite re-fetches tiles at export zoom** (spec §5.4)
- [x] 6. Overlays rasterized into raster export (`render/drawOverlays.ts`:
      compass/cartouche/text/frame) + graticule labels + attribution footer
- [x] 7. SVG export for vector styles (`export/svgExport.ts`): geoPath→`d`,
      labels + overlays as SVG, clipped to sphere; disabled for raster styles
- [x] 8. JPEG (single-canvas `toBlob`, size-capped ≤100 MP) for satellite
- [x] 9. Export dialog (`ExportDialog.tsx`) + progress bar; `MapCanvas` exposes
      the current view via `forwardRef`/`useImperativeHandle`

**M6 status: COMPLETE.** `tsc -b` + `vite build` clean (worker bundles). Verified
headless (downloads inspected): **vector PNG A1@150 = 4967×3855 (19 MP), valid
PNG, crisp with cartouche/frame/graticule-labels/footer baked in**; **satellite
PNG (Switzerland, Orthographic) = 4967×3855, valid, crisp Sentinel-2**; SVG =
valid vector (248 paths + 101 texts). Zero console/page errors.

### New/changed files
- `src/export/` — sizes.ts, renderExport.ts, svgExport.ts, pngStream.ts,
  pngStream.worker.ts
- `src/render/drawOverlays.ts`; `render/renderMap.ts` + `labels.ts` +
  `graticuleLabels.ts` (renderScale); `RasterWarper.ts` (loadEquirect),
  `MercatorMosaic.ts` (assemble)
- `src/components/ExportDialog.tsx`, `MapCanvas.tsx` (forwardRef handle), `App.tsx`

### Follow-ups carried forward
- JPEG only for sizes that fit one canvas (large → PNG); JPEG streaming later
- SVG labels are country+ocean only (no capitals/cities), simple declutter
- IndexedDB tile cache has no eviction; export refetches export-zoom tiles

---

## M5 — Overlays

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

> Spec expanded (PRD.md): styles are **presets + a user diff**, not fixed. Layer
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
- Curved/area ocean labels + multilingual = v2 (per PRD.md §5.5)

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
- Ocean/sea list is a starter set (PRD.md open question #4)

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
  (`PRD.md` §5.3 — currently text-only cards); lazy-load the 50m/10m TopoJSON
  out of the JS bundle (Vite chunk-size warning); ⅙-rule Albers standard
  parallels (needs M2 region bbox).

## Upcoming milestones

None — all milestones (M1–M7) are complete. (This section previously listed
every milestone as "upcoming" despite the summary above showing them all
done — stale leftover from the initial template, removed during the
context-file standardization pass.)
