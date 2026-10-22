# Patient 3D model & animations — attribution and license

All assets in this folder are **CC0 1.0 Universal (public domain)**.
Attribution is not required, but is provided here as good practice.

## Source

- **Models & animations:** [Quaternius](https://quaternius.com) — *Universal Base
  Characters* and *Universal Animation Library* (both CC0).
  - https://quaternius.com/packs/universalbasecharacters.html
  - https://quaternius.com/packs/universalanimationlibrary.html
- **Obtained via the CC0 mirror:** `jamesonBradfield/Quaternius_IK_Rigged_with_animations`
  on Codeberg (CC0), which packages the Quaternius Superhero model + the Universal
  Animation Library (Standard) as loose glTF/GLB files.
  - https://codeberg.org/jamesonBradfield/Quaternius_IK_Rigged_with_animations

## License

Creative Commons Zero v1.0 Universal (CC0 1.0).
Full text: https://creativecommons.org/publicdomain/zero/1.0/

> This work has been dedicated to the public domain. You can copy, modify,
> distribute and perform the work, even for commercial purposes, all without
> asking permission.

## Files

| File | Description |
|---|---|
| `patient.gltf` | Quaternius Superhero Female character (65-bone UE-style humanoid rig), matching case 001's patient (Amara, 34 F). Derived from `Superhero_Female_FullBody.gltf`: normal/roughness texture references were stripped to reduce payload, keeping base-color textures only; `metallicFactor`/`roughnessFactor` set for a non-metal, stylized look. |
| `Superhero_Female_FullBody.bin` | Geometry/skin buffer for `patient.gltf` (unmodified). |
| `T_Superhero_Female_Dark_BaseColor.png` | Body base-color texture — the dark-brown-skin variant. |
| `T_Hair_2_BaseColor.png` | Eyebrow/hair base-color texture (darkened at runtime). |
| `T_Eye_Brown.png` | Eye base-color texture. |
| `UAL1_Standard.glb` | Universal Animation Library (Standard) — 45 animation clips on the **same** 65-bone rig, so they drive `patient.gltf` directly without retargeting. |

## Modifications

- `patient.gltf` was produced from the upstream glTF by pruning non-base-color
  textures (code-only JSON edit); geometry, skin and bone data are unchanged.
- Skin tone, lighting and clothing presentation are adjusted at runtime in
  Three.js (see `src/features/case-challenge/patient-3d/`), not by editing the
  model files.
