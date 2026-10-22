# Anatomy Lab — attribution

The Anatomy Lab integrates two separately licensed upstream works.

## Application code — MIT

The 3D rendering engine, geometry streaming, exploded-layout packing and pointer
interaction model in [`engine/`](./engine) are adapted from **Human Atlas** by
ashemag (<https://github.com/ashemag/human-atlas>), released under the MIT License.
The full MIT notice is preserved in [`LICENSE-human-atlas.txt`](./LICENSE-human-atlas.txt).

## Anatomy data — CC BY 4.0

The bundled geometry and anatomical metadata are **BodyParts3D 4.0**, © The Database
Center for Life Science, licensed under **Creative Commons Attribution 4.0 International
(CC BY 4.0)**.

- License: <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html>
- CC BY 4.0 terms: <https://creativecommons.org/licenses/by/4.0/>
- Dataset download: <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>
- Source geometry: `isa_BP3D_4.0_obj_99.zip`, BodyParts3D 4.0
- Publication: Mitsuhashi et al. (2009), _BodyParts3D: 3D structure database for
  anatomical concepts_, <https://doi.org/10.1093/nar/gkn613>

The dataset attribution shipped with the assets lives at
[`/public/models/anatomy/ATTRIBUTION.md`](../../../public/models/anatomy/ATTRIBUTION.md)
and is surfaced in-app via the **Sources & Credits** panel ([`credits.tsx`](./credits.tsx)).

BodyParts3D represents an adult male reference anatomy. It is not a complete model of
every human structure or variation, and this interface is educational, not a clinical tool.

See [`MODIFICATIONS.md`](./MODIFICATIONS.md) for the record of changes made to the
upstream code and assets during integration.
