# status.md — Progress Tracker

Tracking implementation progress against the milestones in `prj.md`.

## Current milestone: M3 — Styles (Classic Atlas + Minimal)

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
