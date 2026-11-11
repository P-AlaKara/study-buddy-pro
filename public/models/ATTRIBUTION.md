# 3D assets for the Clinical Case Challenge

All models below are dedicated to the public domain under **CC0 1.0 Universal**
(no attribution required). Attribution is kept here for provenance.

## `patient/`

Static (unrigged) reclined patient figures from the Innerscene 3D Parts
Library, built from MakeHuman CC0 assets. Each was re-encoded with
glTF-Transform (meshopt compression, 1024px WebP textures), bringing them from
~5.5 MB to ~0.55 MB. The authored street clothes are recoloured at runtime as a
plain hospital gown (`scene/patient-figure.tsx`).

| File         | Source                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| `female.glb` | "Imani — 3D Person, Reclined in bed" — https://www.innerscene.com/tools/library/3d-parts/imani-3d-person-reclined-in-bed-dbdf7937 |
| `male.glb`   | "Kenji — 3D Person, Reclined in bed" — https://www.innerscene.com/tools/library/3d-parts/kenji-3d-person-reclined-in-bed-5ac8cf9a |

Model selection is resolved from the case data in `scene/patient-model.ts`.

## `ward/`

Ward furniture from the "Hospital Wards and Clinic Operations" pack on
3dassets.dev (CC0, AI-generated static geometry, no textures). Used as-is; the
pack's eight-colour palette is remapped to softer materials at load time
(`WARD_PALETTE` in `scene/scene-config.ts`).

https://3dassets.dev/packs/hospital-wards-and-clinic-operations

| File                  | Pack asset           |
| --------------------- | -------------------- |
| `bed-head-raised.glb` | Ward Bed Head Raised |
| `bedside-cabinet.glb` | Bedside Cabinet      |
| `patient-monitor.glb` | Patient Monitor      |
| `iv-stand.glb`        | IV Stand             |
| `bedhead-panel.glb`   | Oxygen Outlet Panel  |
| `curtain-rail.glb`    | Curtain Rail With Drape |
| `visitor-chair.glb`   | Single Chair With Arms |
| `over-bed-table.glb`  | Over Bed Table       |

The room shell (floor, walls, window, ceiling) is procedural geometry in
`scene/ward-props.tsx`.
