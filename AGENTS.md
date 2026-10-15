# Atlas Press

Browser-based tool for designing printable world/region map posters in
arbitrary cartographic projections (not just Web Mercator). Full vision, tech
stack rationale, data model, and milestone plan in `PRD.md` — this file is
just the quick-reference.

## Stack

React 19 + TypeScript + Vite. `d3-geo` + `d3-geo-projection` for projections,
`versor` + d3 drag/zoom for spherical rotation, Natural Earth (TopoJSON) for
vector data, WebGL fragment shader for raster warping. Fully static site, no
backend. See `PRD.md` §3 for the full rationale per layer.

## Commands

```bash
npm run dev       # vite dev server
npm run build     # tsc -b && vite build
npm run lint      # oxlint
npm run preview   # preview the production build
```

## Docs in this repo

- `PRD.md` — vision, tech stack, data model, feature spec, milestones, decisions log
- `STATUS.md` — per-milestone task breakdown and progress (all M1–M7 complete)
- `NOTES.md` — architecture/rendering decisions (why, not what) — kept
  deliberately since `PRD.md` itself calls for this: "keep a NOTES.md of
  rendering decisions since they'll be tuned repeatedly"
