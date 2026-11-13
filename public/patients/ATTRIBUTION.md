# Case Challenge ward backgrounds

Pre-rendered hospital-ward scenes used as the full-viewport background of the
clinical encounter. The clinical HUD floats over them; nothing is drawn in
WebGL.

| File                    | Use                                                       |
| ----------------------- | --------------------------------------------------------- |
| `ward-female.webp`      | Female patient, semi-reclined in bed (1344 × 768)         |
| `ward-female-1080.webp` | 1080 px wide variant, picked by `srcset` on small screens |
| `ward-male.webp`        | Male patient, semi-reclined in bed (1672 × 941)           |
| `ward-male-1080.webp`   | 1080 px wide variant, picked by `srcset` on small screens |

Project-provided renders, encoded as WebP (quality 84 / 82) from the original
PNGs. Resolved in code by `src/features/case-challenge/components/patient-media.ts`
(an explicit `patient.model` wins, otherwise `patient.sex`), which also records
each image's focal point (the patient's face) so cover-cropping keeps the
patient in frame on every viewport.
