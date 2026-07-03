# NOTES.md — rendering & architecture decisions

Running log of tuning decisions (stroke widths, palettes, projection quirks)
that will be revisited repeatedly, per the suggestion in `prj.md` §7.

## M4a — Raster warping (equirectangular)

### Why mesh reprojection, not a per-pixel inverse shader
- A per-pixel fragment shader would need every projection's **inverse** written in
  GLSL (8 of them; Winkel Tripel/Robinson have only numeric inverses). Instead we
  invert a **coarse screen grid** on the CPU (`projection.invert` at a few thousand
  nodes — cheap even for numeric inverses) and let the GPU **bilinearly interpolate**
  the equirectangular texture across the resulting triangles. One code path covers
  all 8 projections and any future one automatically.
- Trade-off: piecewise-linear approximation of the warp. Invisible at grid density
  110 (idle); a bit looser at 32 (during drag). Density is the quality/perf knob.

### RasterWarper (`render/RasterWarper.ts`)
- **WebGL2** (not WebGL1) so non-power-of-two textures get `REPEAT` wrap + mipmaps
  for free — no need to resize the 5400×2700 sources to POT.
- Equirectangular → uv is linear: `u=(lon+180)/360`, `v=(90-lat)/180`. Upload with
  `UNPACK_FLIP_Y_WEBGL=0` so texture row 0 = image top = lat +90 (verified upright).
- Per cell: emit 2 triangles only if all 4 corners inverted to valid lon/lat
  (off-globe corners → skip → ocean fill shows through, clean sphere edge).
- **Antimeridian seam:** if a cell's 4 u's straddle the 0/1 boundary (range > 0.5),
  lift the small ones by +1; `REPEAT` wrap then samples across the seam without a
  smear or gap.
- Renders into its own offscreen canvas (transparent clear); renderMap composites
  it with `ctx.drawImage(...)` **inside the sphere clip**. GL canvas is dpr-scaled;
  drawImage into the dpr-scaled 2D ctx maps 1:1.
- Textures load async (`Image`); `onTextureLoad` → host redraw. GL-unsupported or
  still-loading → `render` returns false → flat ocean fill.

### Styles
- New `raster` layer type carries `texture: "satellite" | "terrain"`. Raster styles
  drop political fills/vignette; keep graticule + borders (+ rivers for terrain) +
  labels. Label color/halo flip per underlay lightness (light text on satellite,
  dark on terrain) via a shared `rasterLabels()` helper.

### Texture prep (one-time; sharp was uninstalled afterward)
- Satellite: NASA Blue Marble Next Generation, `world.topo.bathy.200412.3x5400x2700.jpg`
  (eoimages.gsfc.nasa.gov) → `public/textures/satellite.jpg`.
- Terrain: Natural Earth II shaded relief + water `NE2_50M_SR_W` (naciscdn.org zip,
  88 MB TIF) → resized to 5400×2700 JPEG via `sharp` → `public/textures/terrain.jpg`.
  Regenerate: unzip TIF, then `sharp(tif,{limitInputPixels:false}).resize(5400,2700)
  .jpeg({quality:82})`.
- Both public-domain / free-to-use → these raster posters are freely sellable
  (unlike M4b's licensed Mercator tiles, prj.md §8).

### Headless verification
- WebGL2 needs SwiftShader flags in headless Chromium:
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.

## M3 — Styles (Classic Atlas + Minimal)

### Declarative style system (`src/styles/styles.ts`)
- `StyleDef = { id, label, character, layers: LayerSpec[] }`. `LayerSpec` has a
  `type` from a fixed vocabulary (background, sphere, graticule, coastVignette,
  countries, land, borders, rivers, lakes, labels) plus optional paint fields.
- Renderer (`render/renderMap.ts`) pipeline: background(s) → ocean fill → clip to
  sphere → content layers **in listed order** → sphere outline → labels. A new
  style is just a new `StyleDef` (data), not renderer code — the layer vocabulary
  is the contract.

### Political coloring (`geo/data.ts`)
- topojson `neighbors(geometries)` → adjacency; greedy color each country with
  the lowest index not used by a colored neighbor. Index is **palette-agnostic**
  (stored as `WorldData.countryColor: Map<id, number>`); the style's `palette`
  array maps index→color (cycled if the palette is shorter). Planar maps need ≤4;
  islands/enclaves push to 5–6.

### Coast vignette
- Soft glow into the ocean = cast a **blurred shadow** from the land silhouette
  (`ctx.shadowBlur`, fill land in the glow color), drawn *before* the political
  fills so the fills cover the land and only the outward glow remains. Clipped to
  the sphere so it doesn't bleed past the map edge.

### Labels (`render/labels.ts`, prj.md §5.5)
- Sources: gazetteer (oceans, countries) + NE populated places (capitals via
  `adm0cap`, cities by `pop_max`). Per-class `minScale` gates density by zoom
  (capitals appear ~scale 260, cities ~700).
- Visibility: project the anchor; drop if null, off-canvas, or — for clipping
  projections (orthographic/stereographic) — if `geoDistance(anchor, center) >
  clipAngle` (far side of the globe). `center = [-rotate[0], -rotate[1]]`.
- Declutter: sort by `(priority, importance)` (oceans→countries→capitals→cities;
  importance = population), place greedily rejecting AABB overlaps. Halo stroke
  behind text for legibility. Area labels centered; point labels get a dot +
  right-offset text. Skipped entirely during active drag/zoom (perf).

### Data
- Added NE **110m** lakes (25), rivers (13 — only major ones at this scale),
  populated places (243; 199 capitals). Bundled as JSON imports. Rivers look
  sparse → 50m upgrade is a follow-up.

### ⚠️ Rectangle-winding bug fixed (regression surfaced from M2)
- The continent/ocean framing rectangle (`gazetteer.rectFeature`) was wound such
  that `d3.geoArea` reported ~4π (whole sphere minus the box) and `geoBounds`
  returned the whole world. `fitExtent` then fit the *complement* → continent/
  ocean selections rotated but never zoomed. (This is why the M2 Pacific view
  looked world-scale.) Fix: reverse the ring when `geoArea(feature) > 2π`.

## M2 — Region search

### Gazetteer (`src/geo/gazetteer.ts`)
- **Countries** are derived at runtime from the 50m `countries` FeatureCollection
  (241 entries): name from `properties.name`, centroid + fit-geometry from the
  **largest-area landmass** (see below). No hand-curation.
- **Continents (7)** and **oceans/seas (20)** are hand-curated `{centroid, bbox}`.
  bbox = `[west, south, east, north]`; west/east may exceed ±180 to express
  antimeridian framing (Pacific = `[120,-60,290,60]`, Oceania = `[110,-50,190,0]`).
  Each becomes a **densified rectangle** Feature (16 pts/edge) so `fitExtent`
  bounds stay accurate on curved projections.

### Largest-landmass fit
- Fitting a country to its *entire* MultiPolygon over-zooms out for nations with
  far-flung territories (France → French Guiana + Pacific islands → whole globe).
  Fix: fit to the single largest-area polygon (`geoArea`), and take the centroid
  from that piece → France frames metropolitan France.
- **Antimeridian gotcha:** `geoArea` returns the area to a ring's *left*; an
  antimeridian-crossing ring with reversed winding reports ≈ the whole sphere.
  No real country landmass exceeds half the sphere, so fold any area > 2π to
  `4π − area`. Without this, Fiji picked a degenerate ring and rendered as open
  ocean.

### Rotation strategy per capability (`fitRegion` in `src/geo/view.ts`)
- `lambdaPhiGamma` (azimuthal): `rotate([-lon,-lat,0])` — centroid to center.
- `supportsStandardParallels` (conic): `rotate([-lon,0,0])`, `center([0,lat])`,
  and standard parallels via the **⅙ rule** from the region's lat bounds.
- else (world pseudo-cylindrical): `rotate([-lon,0,0])` only.
- Then `fitExtent` into the middle **70%** (15% inset) of the canvas. Degenerate
  fits (NaN / scale ≤ 0) fall back to a world fit.

### Search ranking
- Score = exact (1000) > prefix (600−len) > substring (300−idx) > subsequence
  (40−len·0.1). Small `KIND_BOOST` lifts continents/oceans above same-scoring
  countries. Subsequence fallback tolerates typos ("gemny" → Germany).

### Auto-suggest projection
- Polar entries (Antarctica, Arctic Ocean, Southern Ocean) carry
  `suggestProjection: "azimuthalEquidistant"`. On select, App switches to it
  **unless** the current projection is already azimuthal (`rotates ===
  "lambdaPhiGamma"`), so a deliberate Orthographic/Stereographic choice sticks.

### ⚠️ Land-fill bug fixed (regression from M1)
- `topojson.feature(topo, objects.land)` already returns a **FeatureCollection**
  (the land object is a GeometryCollection). `data.ts` was re-wrapping it as
  `{type:"FeatureCollection", features:[thatFC]}`, and `geoPath` renders a
  Feature whose `type` is `"FeatureCollection"` as **nothing** (0 draw ops).
  Result: no land fill ever drew — earlier maps showed only interior borders.
  Fixed by normalizing: use the FC directly if already one.

## M1 — Projection core

### Data
- Using the `world-atlas` npm package (Natural Earth via TopoJSON). It ships
  `countries-{110m,50m,10m}.json`, each containing both a `countries` and a
  `land` object, plus `land-*.json`. We derive: land fill (dissolved `land`
  object), per-country polygons, and **interior borders** via
  `topojson.mesh(..., (a,b) => a !== b)` so shared edges draw once (crisp).
- Detail levels wired: **110m during interaction**, **50m on idle** (160 ms
  debounce). 10m exists in the package for later lazy-loading; not bundled use
  yet. Note: 50m (756 KB) + 110m (108 KB) are currently **bundled** into the JS
  chunk (~1 MB / 357 KB gzip) → flagged by Vite's chunk-size warning. Move to
  lazy `fetch` from `public/` or dynamic import in a later pass.

### Projection registry (`src/geo/projections.ts`)
- 8 projections, each with a `capability` descriptor:
  `{ rotates: "lambda" | "lambdaPhi" | "lambdaPhiGamma", supportsStandardParallels, clipsToSphere, clipAngle? }`.
- `factory()` returns a **fresh** projection each call (never mutate a shared
  instance across React renders).
- Orthographic: `clipAngle(90)` (visible hemisphere). Stereographic:
  `clipAngle(150)` (can't show the antipode). Albers: `geoConicEqualArea`
  with placeholder parallels `[20, 50]`; the ⅙-rule auto-parallels from a
  region bbox land in M2 (needs a selected region first).

### Interaction (`src/components/MapCanvas.tsx`)
- View state = `{ rotation:[λ,φ,γ], scale, translate:[x,y] }` held in **refs**,
  not React state, so drag/zoom never trigger re-renders. Draw is imperative
  via `requestAnimationFrame`.
- Drag dispatches on capability:
  - `lambdaPhiGamma` (azimuthals) → **versor** drag (Bostock pattern:
    `cartesian`/`delta`/`multiply`/`rotation`). Free spherical rotation.
  - `lambda` / `lambdaPhi` (world pseudo-cylindricals, conics) → horizontal
    drag spins **longitude only** (`DEG_PER_PX / scale` sensitivity); vertical
    drag pans the poster via `translate.y`. Avoids the "wrong when rotated in φ"
    look called out in `prj.md` §5.3.
- Wheel zoom keeps the point under the cursor fixed (linear scale+translate
  adjust). `scale` floored at 1.
- Double-click re-centers on the clicked lon/lat — **azimuthals only** for now.
- Fit: `projection.fitExtent` to `{type:"Sphere"}` with 24 px padding, on mount
  / projection change / resize / Reset.

### Rendering (`src/render/renderMap.ts`)
- Everything (graticule, land, borders) is **clipped to the sphere path** so
  azimuthal boundaries stay clean. Sphere outline stroked on top.
- Line widths in CSS px (ctx pre-scaled by devicePixelRatio): graticule 0.5,
  borders 0.6, sphere outline 1.0. Palette is a placeholder "workshop desk"
  cream/blue (`DEFAULT_THEME`); real styles arrive in M3.

### Exit test — PASSED
Dragging in Orthographic rotates the globe to a south-polar view (Antarctica
toward center) with no visual glitches; no console/page errors across all 8
projections (verified headless via playwright-core).
