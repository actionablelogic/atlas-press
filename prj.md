# prj.md — "Atlas Press" : Custom Map Poster Builder

## 1. Vision

A browser-based tool for designing printable world/region maps that escape the Web-Mercator monoculture. The user picks a region (country, continent, ocean), a visual style (classic atlas, satellite, terrain, minimal…), and a cartographic projection, decorates the map with overlays (graticule, compass rose, frame, title cartouche), then exports a print-ready, high-resolution image suitable for poster printing.

The reference aesthetic is a classic Rand McNally-style wall map: antique paper tones, decorative border, labeled graticule, compass rose.

## 2. Why this is not "just use Leaflet/Mapbox"

This is the single most important technical framing for the project:

- Mainstream web map libraries (Leaflet, Mapbox GL, Google Maps) are built around **Web Mercator raster/vector tiles**. Arbitrary projections are either impossible or second-class.
- Supporting arbitrary projections means rendering the map **ourselves from geographic data**, using **d3-geo** (and d3-geo-projection for the exotic ones), which can project any GeoJSON into any projection on Canvas or SVG.
- Consequence: **vector-based styles (atlas, minimal, political) are easy; raster styles (satellite, shaded terrain) are the hard part**, because raster imagery must be *warped* (re-projected pixel-by-pixel) from its source projection into the chosen one.

The architecture below embraces this split.

## 3. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React + Vite + TypeScript | Fast iteration, typed geo code |
| Projection engine | `d3-geo` + `d3-geo-projection` | Industry standard, 100+ projections, canvas + SVG rendering |
| Interaction (drag/rotate) | `versor` + d3 drag/zoom | Correct spherical rotation for globe-like projections |
| Vector data | Natural Earth (110m / 50m / 10m) as TopoJSON | Public domain, three detail levels, includes countries, coastlines, rivers, lakes, populated places, ocean labels |
| Raster basemaps (world scale) | Pre-rendered **equirectangular (plate carrée)** world images: NASA Blue Marble (satellite), Natural Earth I/II hypsometric + shaded relief (terrain) | Equirectangular sources make inverse-projection sampling trivial: `(lon, lat) → (x, y)` is linear |
| Raster basemaps (region scale, crisp satellite) | **XYZ Web-Mercator tile sources**, pluggable: EOX Sentinel-2 cloudless (default, free w/ attribution, non-commercial), user-supplied Mapbox or Esri key for commercial/highest quality | Per output pixel: inverse-project → (lon, lat) → Mercator tile coords → sample from a stitched tile mosaic texture. Tile zoom level chosen from target output resolution |
| Raster warping | WebGL fragment shader (preferred) or CPU canvas fallback | For each output pixel, run the projection's **inverse** to get (lon, lat), sample source image. WebGL keeps this interactive |
| Export | Offscreen canvas rendering at target DPI, tiled if needed; `canvas.toBlob` PNG; optional SVG export for vector styles | Print sizes exceed browser canvas limits → render in tiles and stitch |
| State | Zustand (or plain React context) | Simple single-document state |
| Hosting | Fully static site (no backend for v1) | All data is public files; ship on GitHub Pages / Netlify |

No backend, no API keys, no tile servers in v1. All assets (TopoJSON + a few large basemap images) are static files bundled or lazy-loaded.

## 4. Core data model

```ts
interface MapDocument {
  region: RegionSelection;        // what was searched/selected
  view: {
    rotation: [number, number, number]; // λ, φ, γ — projection rotation
    scale: number;                       // zoom
    translateOffset: [number, number];   // pan for non-rotating projections
  };
  projectionId: ProjectionId;
  styleId: StyleId;
  styleOverrides: StyleDiff;       // user customizations on top of the preset:
                                   // layer toggles, per-layer colors/widths,
                                   // per-class typography, background/ocean colors
  overlays: OverlayConfig[];      // graticule, compass, frame, title…
  canvas: {
    aspect: PosterAspect;         // e.g. "2:3", "3:2", "1:1", "ISO A"
    orientation: "landscape" | "portrait";
  };
  export: { widthPx: number; heightPx: number; dpi: number; format: "png" | "svg" | "jpeg" };
}
```

## 5. Features (detailed)

### 5.1 Region search & centering

- **Searchable combobox** with fuzzy matching over a curated gazetteer:
  - ~250 countries/territories (from Natural Earth admin-0 attributes: name, ISO code, centroid, bounding box).
  - 7 continents (hand-curated centroids + bboxes).
  - Oceans & major seas (~15 entries — **hand-curated**, since oceans have no crisp official polygons; store centroid + a "framing bbox" per entry, e.g. Pacific centered at 160°W needs an antimeridian-aware bbox).
- On selection:
  1. Set projection **rotation** so the region centroid sits at the projection center (for azimuthal/world projections) or set the appropriate standard parallels (for conics — see §5.3).
  2. Fit scale so the region bbox fills ~70% of the poster canvas (use `projection.fitExtent` on the region geometry).
- Selection is a *starting point only* — user can then freely pan/rotate/zoom.
- Edge cases to handle: antimeridian-spanning regions (Pacific, Fiji, Russia), polar regions (Antarctica, Arctic Ocean → auto-suggest azimuthal projection).

### 5.2 Navigation

- **Drag** = rotate the projection sphere (versor-based, so dragging feels natural on any projection, including near poles).
- **Scroll / pinch** = zoom (projection scale).
- **Double-click** = re-center on clicked point.
- Modifier-drag (or a toggle) = γ-rotation (tilt the north direction) — useful for artistic posters.
- Reset button → return to the fitted view of the selected region.
- Render at reduced detail (110m data, half-res raster) *during* interaction; re-render full quality on idle (debounced). This is essential to keep raster warping smooth.

### 5.3 Projections (curated set of 9, visually distinct)

Presented as thumbnail cards (each thumbnail = mini render of the current region in that projection).

| Projection | Character | Best for |
|---|---|---|
| Equal Earth | Modern equal-area world map | Whole-world posters |
| Robinson | The classic "atlas look" (the attached poster's family) | Whole-world posters |
| Winkel Tripel | National Geographic's choice, balanced distortion | Whole-world |
| Mollweide | Elliptical, equal-area, "scientific" look | World, thematic |
| **Hobo–Dyer** | Rectangular equal-area, "fair to all areas" — the anti-Mercator statement map | Whole-world posters |
| Orthographic | The globe-from-space view | Hero shots of one hemisphere/continent |
| Azimuthal Equidistant | Polar/radial "UN logo" look | Poles, distance-from-a-point art |
| Albers Equal-Area Conic | Curved parallels, the "USGS look" | Countries & continents at mid-latitudes; **auto-set standard parallels from region bbox (⅙ rule)** |
| Stereographic | Conformal, dramatic edge stretch | Poles, artistic hemispheres |

Hobo–Dyer implementation note: it's the Lambert cylindrical equal-area family with standard parallels at **37.5°** — in d3, `geoCylindricalEqualArea().parallel(37.5)`. Since the whole family is one parameter, expose sibling presets cheaply as variants on the same card: Gall–Peters (45°), Behrmann (30°), and optionally a "south-up" toggle (γ = 180°), which is historically part of the Hobo–Dyer's identity. Capability descriptor: rotates λ only.

(Stretch: Waterman Butterfly or Dymaxion-like `airocean` as a "wow" option — note these have interrupted geometry and complicate raster warping and dragging; explicitly out of v1 scope.)

Projection-specific behavior:
- World pseudo-cylindricals (Robinson, Equal Earth, Winkel, Mollweide) look wrong when rotated in φ (latitude); for these, "centering" only rotates λ and pans vertically. Azimuthals rotate freely in all axes. Conics expose standard-parallel handling automatically. Encode this per-projection as a capability descriptor: `{ rotates: "λ" | "λφ" | "λφγ", supportsStandardParallels: boolean, clipsToSphere: boolean }`.
- Always draw the **projection outline (sphere boundary)** and clip everything to it.

### 5.4 Styles (v1: 4 presets over a customizable layer system)

A style is a **preset, not a straitjacket**: it's a saved combination of (a) layer toggles, (b) paint rules, (c) optional raster underlay, (d) typography — all of which the user can then override in a **Customize panel**. Picking a new style preset resets customizations (with a confirm).

**Presets:**

1. **Classic Atlas** (the attached-poster look) — vector.
   - Cream/aged-paper background with subtle noise texture; countries in a muted 5–6 color political palette (use a greedy graph-coloring so neighbors differ); coastline vignette (soft outer glow into the ocean); rivers + lakes; graticule in faint brown; serif labels.
2. **Satellite** — raster, two-tier source selection (automatic, based on the map's ground resolution vs. output pixels):
   - **World scale** (whole world / continents): pre-rendered NASA Blue Marble Next Generation equirectangular image (ship 21600×10800; the full 86400×43200 exists if ever needed).
   - **Region scale** (country and below): fetch **Web-Mercator XYZ tiles** at the zoom level matching the *export* resolution, stitch into a mosaic texture, warp in the WebGL inverse-projection shader. Zoom-level math: required ground resolution (m/px) = region width (m) ÷ output width (px); pick the Mercator zoom whose resolution at the region's latitude is ≤ that. Example: France (~1000 km) across an A0 portrait width (9933 px @300 DPI) ≈ 100 m/px → zoom 11 → on the order of a few thousand 256px tiles. Fetch with concurrency limits, cache in IndexedDB, respect provider rate limits.
   - Tile source is a **pluggable config** `{urlTemplate, maxZoom, attribution, license}`. Default: EOX Sentinel-2 cloudless (10 m imagery, free with attribution, **CC-BY-NC-SA — non-commercial**). Optional: user pastes their own Mapbox/Esri API key in settings for commercial use or different imagery; key stored locally only.
   - Preview renders from a low zoom (fast); the export pipeline re-fetches at full zoom.
   - Plus optional vector coastline/border overlay + labels on top.
3. **Terrain** — raster (Natural Earth II with shaded relief & water) + vector borders/rivers/labels.
4. **Minimal / Blueprint** — vector. Single-line coastlines and borders on a flat background, 2–3 configurable colors. Cheap to build, looks great, popular for posters.

Style presets and user overrides both live in the same declarative spec (layer list + paint props + typography), so adding preset #5+ is data, not code, and "user customizations" are just a diff on top of the preset stored in `MapDocument`.

**Customize panel — layer toggles** (each on/off, honoring per-style defaults):

| Layer | Data source | Notes |
|---|---|---|
| Country borders | NE admin-0 boundary lines | incl. disputed-boundary styling (dashed) |
| Country fills / political colors | NE admin-0 polygons | vector styles only |
| Country names | NE admin-0 labels | |
| Capitals | NE populated places (`featurecla = Admin-0 capital`) | dot + label, independently toggleable from other cities |
| Major cities | NE populated places, rank-filtered | |
| Ocean/sea names | NE marine label points | |
| Rivers | NE `rivers_lake_centerlines` (110/50/10m) | |
| Lakes | NE `lakes` | |
| **Roads** | NE `roads` (**10m only** — major highways; lazy-loaded, ~heavier asset) | Set expectations in the UI: these are intercity major roads, not street networks (street-level is v2). Hidden by default on world-scale views (illegible noise at that scale) |
| Graticule | generated | also configurable in overlays §5.6 |

Each vector line/fill layer additionally exposes **color** and **stroke width** (in poster-relative units).

**Customize panel — typography**, configurable **per label class** (country names / capitals / cities / ocean names / graticule degree labels), with a "link all" toggle:
- **Font family**: curated list of ~8 bundled OFL fonts spanning classic-serif (EB Garamond, Playfair), clean-sans (Inter, Archivo), slab, and mono — bundled (not Google-CDN-loaded) so export in a worker is reliable and offline works.
- **Font size**: a scale multiplier per class (base sizes remain poster-relative so they survive export at any DPI).
- **Font color**, plus **halo/outline color & width** — essential for legibility on satellite imagery.
- Letter-spacing and small-caps toggles for that classic-atlas look (country names in the reference poster are tracked-out small caps).

**Customize panel — background & water:**
- **Background color** = everything outside the projection's sphere/outline. Defaults: paper-cream (Classic), **black (Satellite)** — user-overridable to any color (white, navy, transparent-PNG…). Transparent background is an export option (PNG only).
- **Ocean color** (vector styles) — distinct from background: on a Robinson map the ellipse interior ocean and the page around the ellipse are different surfaces; both configurable.
- Raster styles: background color applies outside the sphere; optionally tint/desaturate controls for the raster itself (v1.5, cheap in the shader: brightness/saturation/sepia uniforms).

### 5.5 Labels (scoped, see Open Questions)

- v1: country names, ocean names, capital cities + optionally largest cities — from Natural Earth attributes.
- Rendered *after* projection: project label anchor, draw text on canvas; skip labels whose anchor is clipped or off-sphere.
- Collision handling: simple greedy priority-based decluttering (country > capital > city), with per-zoom visibility thresholds.
- Curved/area labels ("PACIFIC OCEAN" arcing across the water, as in the reference poster) are a **v2** feature — genuinely hard.
- Language: English (Natural Earth ships `name_en`); multilingual is v2.

### 5.6 Overlays / "stickers"

Two categories with different behavior:

**Geographic overlays** (locked to the map, re-project with it):
- **Graticule**: step (5/10/15/30°), line style, optional degree labels along the frame edge (like the reference poster).
- Tropics / polar circles / equator as distinct dashed lines.
- Tissot indicatrices (distortion circles) — nerd candy, trivial with d3.

**Decor overlays** (locked to the poster canvas, drag/resize/rotate freely):
- **Compass rose** (3–4 SVG designs; optionally auto-rotates to true north at its map position — on many projections north varies across the map).
- **Decorative frame/border** (the woven border of the reference poster; 3–4 patterns, drawn as a canvas-edge band).
- **Title cartouche**: editable title/subtitle text block with a few classic frame styles ("The World — Classic Edition").
- **Scale bar** — *with a caveat badge*: scale is only locally true on most projections; place it and it shows scale at its own location, plus a small disclaimer in the UI.
- Simple text labels (user-typed, font/size/color).

Implementation: decor overlays are SVG/canvas sprites in *poster space*; a lightweight transform-handles UI (drag, corner-resize, rotate) with snapping to edges/center. Stored as `{type, x, y, scale, rotation, props}` in poster-relative coordinates so they survive export at any resolution.

### 5.7 Poster canvas & export

- Canvas aspect presets: 2:3, 3:4, 1:1, ISO A-series (1:√2), plus custom; portrait/landscape toggle. The on-screen editor is a scaled preview of this fixed poster geometry — **WYSIWYG**: export = same render function at higher resolution.
- Export dialog: choose print size (e.g. 24×36″, 50×70 cm, A1, **A0, 2A0/custom**) × DPI (150/200/300) → shows resulting pixel dimensions and estimated file size.
  - 24×36″ @300 DPI = 7200×10800 px (~78 MP)
  - **A0 @300 DPI = 9933×14043 px (~140 MP)**; A0 @150 DPI = ~35 MP
  - The UI should explain that large posters are viewed from a distance: **150–200 DPI is visually indistinguishable from 300 DPI at A0+**, and cuts render time and file size by 2–4×. Default A0+ exports to 200 DPI, overridable.
- Rendering pipeline for export:
  1. Compute full pixel size; browsers cap canvas dimensions/area (Safari is the binding constraint) → render in **tiles** (e.g. 2048² each). At A0+ sizes (140 MP ≈ 560 MB of RGBA) a single stitched canvas + `toBlob` is unreliable across browsers → encode with a **row-streaming PNG encoder in a worker** (e.g. `fast-png`-style scanline writing, or WASM libvips) fed tile-row by tile-row, keeping peak memory to one tile row. JPEG (for satellite) can stream the same way.
  2. Vector layers: re-render at export scale (crisp lines, properly scaled stroke widths & font sizes — define all sizes in poster-relative units, never raw px).
  3. Raster layers: sample from the highest-res source; accept that satellite/terrain caps effective sharpness (see Open Questions re: zoom depth).
  4. Run export in a Web Worker with a progress bar (a 300-DPI export can take 10–60 s).
- Formats: PNG (default), JPEG (smaller, for satellite), and **SVG export for pure-vector styles** (infinite resolution — a killer feature for print shops).
- Optional: embed a small metadata footer (projection name, date, attribution "Made with Natural Earth / NASA") — toggleable.

### 5.8 Persistence & sharing (light v1)

- Serialize `MapDocument` to JSON; save/load as file, plus encode into URL hash for shareable links. No accounts, no server.

## 6. Non-goals (v1)

- Street-level detail / zooming into cities (data + tiling architecture would change completely).
- Interrupted projections (Dymaxion, Goode Homolosine butterfly variants).
- Curved area labels, multilingual labels.
- User-uploaded GeoJSON layers (nice v2).
- Server-side rendering, accounts, payments, print fulfillment.

## 7. Milestones

1. **M1 — Projection core (the risky part first).** Blank page → Natural Earth land + borders rendered via d3-geo canvas; projection switcher (all 9, incl. Hobo–Dyer via `geoCylindricalEqualArea().parallel(37.5)`); versor drag + zoom + fitExtent; per-projection capability descriptors. *Exit test: drag Antarctica to center in Orthographic without visual glitches.*
2. **M2 — Region search.** Gazetteer JSON (countries + continents + oceans), combobox, fit-to-region incl. antimeridian cases.
3. **M3 — Styles: Classic Atlas + Minimal** (vector-only), incl. political coloring, coast vignette, basic labels with decluttering. Style spec must be the declarative preset+diff format from day one.
4. **M3b — Customize panel.** Layer toggles (borders, fills, names, capitals, cities, rivers, lakes, roads), per-layer color/width, per-class typography (family/size/color/halo), background & ocean colors. Roads = lazy-loaded NE 10m asset. *Exit test: recreate a passable "Minimal" look starting from the Classic Atlas preset using only panel controls.*
5. **M4a — Raster warping, equirectangular.** WebGL inverse-projection shader sampling a single equirectangular texture; Terrain style + world-scale Satellite; interactive-quality degradation strategy; background-color-outside-sphere plumbed through the raster path. *Second risky milestone — prototype early.*
6. **M4b — Raster warping, Mercator tiles.** Tile fetcher (zoom selection, concurrency, IndexedDB cache, attribution plumbing), mosaic texture assembly, Mercator→lon/lat conversion in the shader; pluggable source config + API-key settings UI. *Third risky milestone.* Exit test: crisp A0 export of a single mid-size country in Orthographic from Sentinel-2 tiles.
7. **M5 — Overlays.** Graticule + edge degree labels; compass, frame, cartouche, text with transform handles.
8. **M6 — Export.** Tiled high-DPI rendering with streaming PNG/JPEG encode in a worker; SVG export for vector styles; size/DPI dialog with A0+ presets.
9. **M7 — Polish.** Poster aspect presets, URL sharing, keyboard a11y, mobile-usable read-only preview, attribution footer.

Suggested Claude Code approach: one milestone per session/PR; keep a `NOTES.md` of rendering decisions (stroke widths, palettes) since they'll be tuned repeatedly.

## 8. Data & licensing

- **Natural Earth**: public domain. Ship 110m + 50m always; 10m coastline/borders lazy-loaded (~several MB as TopoJSON, quantized). **Roads layer exists only at 10m** (`ne_10m_roads`, major intercity routes) — lazy-loaded on toggle.
- **NASA Blue Marble / visible Earth**: generally free to use incl. commercially, attribution appreciated — verify the exact product page terms.
- **Natural Earth I/II raster**: public domain.
- Fonts: curated set of ~8 **OFL-licensed** families (e.g. EB Garamond, Playfair Display, Inter, Archivo, a slab, a mono) bundled locally via `@font-face`; make sure export waits for `document.fonts.ready` (and that worker-side rendering has font access — if using OffscreenCanvas in a worker, load fonts via `FontFace` in the worker too).
- **High-res satellite tiles are the licensing exception**: EOX Sentinel-2 cloudless is CC-BY-NC-SA (attribution required, **no commercial resale of prints**); Mapbox/Google satellite generally require a specific license for print products; Esri World Imagery requires attribution and has its own terms. The raw Copernicus Sentinel-2 data itself is free for any use — building your own cloudless mosaic from it is a possible (large) future project that would remove all restrictions.
- Consequence: vector styles, terrain, and Blue Marble world-satellite posters are freely sellable; **region-scale high-res satellite posters are personal-use unless the user brings a commercially-licensed tile source**. Show the active source's license next to the export button.

## 9. UI layout sketch

```
┌────────────────────────────────────────────────────────────┐
│  ⌕ [ Search: "Pacific Ocean"        ▾ ]        [Export ⭳]  │
├───────────────┬────────────────────────────────────────────┤
│  PROJECTION   │                                            │
│  [9 thumbnail │                                            │
│   cards]      │                                            │
│  ───────────  │            POSTER PREVIEW                  │
│  STYLE        │     (fixed aspect, drop-shadowed,          │
│  [4 preset    │      drag to rotate, scroll to zoom)       │
│   cards]      │                                            │
│  ───────────  │                                            │
│  CUSTOMIZE ▸  │                                            │
│  Layers       │                                            │
│   ☑ borders   │                                            │
│   ☑ names ☑ ⚑ │  (capitals)                                │
│   ☐ roads …   │                                            │
│  Type  [Aa ▾] │  size / color / halo per class             │
│  Colors       │  background / ocean / per-layer            │
│  ───────────  │                                            │
│  OVERLAYS     │                                            │
│  ☑ Graticule  │                                            │
│  ☐ Compass    │                                            │
│  ☐ Frame      │                                            │
│  ☐ Title      │                                            │
│  ───────────  │                                            │
│  CANVAS       │                                            │
│  aspect/orient│                                            │
└───────────────┴────────────────────────────────────────────┘
```

The Customize panel is collapsed by default so casual users see a simple three-choice tool (region / projection / style) while tinkerers can go deep — this two-tier disclosure is important; don't flatten every option into one wall of controls.

Design direction: the tool itself should feel like a cartographer's workshop desk, not a SaaS dashboard — but keep the chrome quiet so the poster is the hero. Selected projection/style cards show live mini-previews of *your* current region, not canned images.

## 10. Decisions log (2026-07-03)

1. **Zoom depth**: v1 = world & regions (country level, Natural Earth). City/street level is an explicit **v2** — it will require tiled vector data (e.g. OpenMapTiles/Protomaps) reprojected the same way, and some exotic projections stop making sense at that scale.
2. **Satellite fidelity**: crisp high-res required → two-tier raster architecture (equirectangular Blue Marble for world scale, Web-Mercator tile warping for region scale). Adds milestone M4b and the licensing constraints in §8.
3. **Max print size**: A0 and beyond → streaming tile-row export encoder (§5.7), 150–300 DPI options with sensible defaults.
4. **Granular customization is in scope for v1**: styles are presets + user diff (§5.4) — layer toggles (country names, capitals, cities, rivers, lakes, roads, borders), per-class typography (family/size/color/halo), background & ocean colors. Roads limited to NE 10m major roads in v1 (street networks are v2 with city zoom).
5. **Hobo–Dyer projection added** (9th card), with Gall–Peters/Behrmann variants and south-up toggle nearly free via the same cylindrical equal-area parameterization.

## 11. Open questions (remaining)

1. **Label density.** The reference poster has thousands of labels (towns, straits, islands). v1 spec = countries, oceans, capitals, big cities. Is that enough for the "classic atlas" feel you want, or is dense labeling the point?
2. **Commercial intent for satellite posters.** Given §8: is personal printing enough for high-res satellite, or do you want to sell those prints (→ budget for a commercially-licensed tile source / long-term: build your own Sentinel-2 mosaic)?
3. **Sticker scope**: is the fixed set (compass, frame, cartouche, text, graticule) enough, or do you want user-uploaded images/SVGs as stickers?
4. **Ocean list**: which oceans/seas should the gazetteer include beyond the big five? (Mediterranean, Caribbean, South China Sea…? Each is 5 minutes of curation.)
5. **Monetization/usage**: personal tool, or public? If public and free, hosting is trivial; if you ever want print-on-demand fulfillment, that's a v3 with a backend.
6. **Custom font uploads**: the curated 8-font list covers most needs; do you also want users to upload their own font files (licensing is on them; adds file-handling + embedding work, medium effort)?