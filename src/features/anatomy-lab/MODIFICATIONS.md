# Upstream modifications

Record of changes made to the Human Atlas sources (MIT) and BodyParts3D assets
(CC BY 4.0) when integrating them into Medley. Upstream revision: `ashemag/human-atlas`
`main` as retrieved during integration.

## Code — `engine/` (preserved close to verbatim)

| File | Origin | Change |
| --- | --- | --- |
| `engine/scene.tsx` | `app/scene.tsx` | Copied verbatim; only reformatted with the repo's Prettier config. |
| `engine/explosion-layout.ts` | `app/explosion-layout.ts` | Copied verbatim; reformatted. |
| `engine/pointer-tap.ts` | `app/pointer-tap.ts` | Copied verbatim; reformatted. |
| `engine/model-download.ts` | `app/model-download.ts` | Copied verbatim; reformatted. |
| `engine/anatomy.ts` | `app/anatomy.ts` | Copied verbatim; reformatted. `Part.bounds` typed as a fixed `[number, number, number]` tuple (was `number[]`) — a safe type refinement for the project's stricter config. |

Medley's root `tsconfig` is stricter than upstream's (it adds `noUncheckedIndexedAccess`
and `noPropertyAccessFromIndexSignature`). To keep the engine on the same single strict
config as the rest of the app, `engine/scene.tsx` received non-null assertions (`!`) on
provably-safe parallel-array / TypedArray reads inside the render loop, and bracket access
for Three.js shader `uniforms` / geometry `attributes` index signatures. Logic is unchanged.
The `[atlas]`-only `useEffect` dependency (intentional — callbacks are read via refs; adding
them would rebuild the whole scene) is annotated with an `eslint-disable` + rationale.

Not ported: `app/page.tsx` (UI), `app/agent-tools.ts` (optional WebMCP tools),
`app/globals.css`, and the project's own shadcn/ui copies. The UI was rebuilt in
Medley's design system (`anatomy-lab.tsx`, `anatomy-lab.css`) against the same
`SceneState` contract, so the engine is driven exactly as upstream expects. The
WebMCP/agent tooling was intentionally omitted (no LLM in this release).

The build/convert scripts (`scripts/convert-anatomy.py`, `optimize-anatomy.mjs`,
`compress-models.mjs`) were not copied; the repository already ships browser-ready
geometry and regenerating it is out of scope.

## Assets — `/public/models/anatomy/`

- `atlas.json`: chunk `url`/`gzip` paths rewritten from `/models/…` to the
  namespaced `/models/anatomy/…` so the assets are hosted under Medley's own `/public`
  and never collide with other model assets. No geometry, names, concepts, system
  groupings or source identifiers were altered.
- Geometry chunks: only the gzip-compressed `body-*.bin.gz` files are shipped (~32 MB,
  the compressed geometry the viewer actually streams). The uncompressed `body-*.bin`
  fallback files were omitted to keep the repository lean. All modern browsers support
  `DecompressionStream`, which the loader uses whenever available; see "Known limitations"
  in the feature README.
- `ATTRIBUTION.md`: copied verbatim alongside the assets.

## Dependencies added

- `three@0.159.0` and `@types/three@0.159.0` (the versions the upstream engine targets).
