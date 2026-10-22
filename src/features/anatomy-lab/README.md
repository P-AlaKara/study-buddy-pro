# Anatomy Lab

A self-contained, lazy-loaded 3D anatomy explorer built on the open-source
[Human Atlas](https://github.com/ashemag/human-atlas) engine and the BodyParts3D 4.0
reference dataset. It gives medical students an interactive full-body model — search,
system toggles, isolation, exploded views — without leaving Medley.

## Design goals

- **Modular.** Everything lives under `src/features/anatomy-lab/` plus
  `/public/models/anatomy/`. The only touch points outside the module are the route
  (`src/routes/anatomy.tsx`) and one nav entry in `src/components/study-app.tsx`.
  No backend, database or shared-state changes. You can work on the rest of the app
  without any Anatomy Lab context.
- **Faithful engine.** The Three.js engine is preserved from upstream (see
  [`MODIFICATIONS.md`](./MODIFICATIONS.md)); only the UI is rebuilt in Medley's design
  language against the same `SceneState` contract.
- **Replaceable dataset.** Anatomy data is addressed only through
  [`config.ts`](./config.ts) and the `atlas.json` manifest, so moving to a CDN or a
  newer dataset later means changing those — not the engine or UI.

## Layout

| File | Responsibility |
| --- | --- |
| `engine/anatomy.ts` | Dataset types, system definitions, concept explanations. |
| `engine/scene.tsx` | Three.js renderer: geometry batching, GPU state textures, picking, exploded layout, isolation framing, disposal. |
| `engine/model-download.ts` | Gzip-aware chunk decoding. |
| `engine/explosion-layout.ts` | Packs visible meshes into the exploded inventory. |
| `engine/pointer-tap.ts` | Tap-vs-orbit/pan/pinch discrimination. |
| `config.ts` | Asset location + dataset identity. |
| `anatomy-lab.tsx` | UI: search, systems, view controls, explode dock, detail panel, loading/error, data loading + state. |
| `anatomy-lab.css` | Scoped presentation in Medley tokens. |
| `credits.tsx` | Sources & Credits panel (licensing + attribution). |
| `tour.tsx` | First-run guided tour. |
| `feature-flag.ts` | `VITE_ENABLE_ANATOMY_LAB` (enabled unless `"false"`). |

## Performance

- The feature (and the `three` bundle) is lazy-loaded via the route and an inner
  `React.lazy` around the scene.
- Geometry streams as gzip chunks, decoded with `DecompressionStream`; the scene merges
  meshes into per-system batches and drives translation/visibility/selection through GPU
  textures to avoid thousands of draw calls.
- The scene renders only when the view changes, and disposes all GPU resources
  (geometries, materials, textures, renderer, DOM) on unmount.

## Known limitations

- Geometry decoding requires `DecompressionStream` (all current browser versions). Only
  the gzip chunks are shipped; the uncompressed fallback files were omitted to keep the
  repo lean, so a browser without `DecompressionStream` will show a load error.
- Physical-device and real multitouch-hardware performance has **not** been verified;
  responsive layouts were checked at desktop and common phone viewport sizes only.
- Descriptions are limited to the verified source dataset plus upstream's general system
  overviews — no clinical functions or relationships are fabricated.

## Attribution

Application code is MIT (Human Atlas); anatomy data is CC BY 4.0 (BodyParts3D). See
[`ATTRIBUTION.md`](./ATTRIBUTION.md), [`LICENSE-human-atlas.txt`](./LICENSE-human-atlas.txt)
and the in-app **Sources & Credits** panel.
