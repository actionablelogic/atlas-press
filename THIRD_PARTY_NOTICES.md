# Third-party notices

Atlas Press source code is MIT-licensed (see `LICENSE`). The data, imagery and
fonts bundled in this repository, and the tile services the app can load at
runtime, come from third parties under their own terms, listed below.

## Bundled data

| Asset | Source | Licence |
|---|---|---|
| Country and land boundaries (via the `world-atlas` npm package) | [Natural Earth](https://www.naturalearthdata.com/) 1:10m / 1:50m / 1:110m | Public domain |
| `world-atlas` TopoJSON packaging | [topojson/world-atlas](https://github.com/topojson/world-atlas), © 2013–2019 Michael Bostock | ISC |
| `src/data/ne_110m_*.json` (lakes, rivers, populated places) | Natural Earth 1:110m | Public domain |
| `public/data/roads.json` (major highways, filtered and simplified) | Natural Earth 1:10m roads | Public domain |
| `public/textures/satellite.jpg` | [NASA Blue Marble Next Generation](https://visibleearth.nasa.gov/collection/1484/blue-marble) (December 2004, topography + bathymetry), NASA Earth Observatory / Reto Stöckli | NASA imagery, free to use; credit NASA |
| `public/textures/terrain.jpg` | [Natural Earth II](https://www.naturalearthdata.com/downloads/50m-raster-data/50m-natural-earth-2/) shaded relief with water, by Tom Patterson | Public domain |

## Bundled fonts (`public/fonts/`)

| Family | Copyright | Licence |
|---|---|---|
| Archivo | © 2020 The Archivo Project Authors | SIL OFL 1.1 |
| EB Garamond | © 2017 The EB Garamond Project Authors | SIL OFL 1.1 |
| Inter | © 2020 The Inter Project Authors | SIL OFL 1.1 |
| JetBrains Mono | © 2020 The JetBrains Mono Project Authors | SIL OFL 1.1 |
| Playfair Display | © 2017 The Playfair Display Project Authors (Reserved Font Name "Playfair Display") | SIL OFL 1.1 |
| Roboto Slab | © 2018 The Roboto Slab Project Authors | Apache License 2.0 |

Full licence texts: `public/fonts/OFL.txt` and `public/fonts/LICENSE-Apache-2.0.txt`.

## Runtime tile services (not bundled)

Region- and city-scale styles fetch map tiles from third-party services at
runtime. Their terms govern any poster made with them; the app shows the active
source's attribution and licence notice in the top bar and the export dialog.

| Service | Attribution | Terms |
|---|---|---|
| EOX Sentinel-2 cloudless 2020 | Sentinel-2 cloudless 2020 by EOX IT Services GmbH | CC BY-NC-SA 4.0 (non-commercial) |
| Esri World Imagery, World Topo, World Street, NatGeo, Ocean basemaps | Esri and data providers (as shown in the app) | [Esri terms of use](https://www.esri.com/en-us/legal/terms/full-master-agreement) |
| CARTO basemaps (Voyager, Positron, Dark Matter) | © OpenStreetMap contributors © CARTO | OpenStreetMap ODbL; [CARTO terms](https://carto.com/legal) |

The custom tile source option is governed entirely by the licence of the source
the user supplies.
