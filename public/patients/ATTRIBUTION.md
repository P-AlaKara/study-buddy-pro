# Patient viewport fallback images

- `female.webp` — female patient, semi-reclined in a hospital bed. Used for cases where `patient.sex` is female.
- `male.webp` — male patient, semi-reclined in a hospital bed. Used for all other cases.

Project-provided illustrative renders. Since the 3D hospital scene landed they
serve as the loading poster, the no-WebGL / failure fallback and the optional
"photo view" of the case stage. Resolved in code by
`src/features/case-challenge/components/patient-media.ts`; the 3D models live in
`public/models/` (see `public/models/ATTRIBUTION.md`).
