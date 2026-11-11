import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  BED_HEAD_EXTRA_ANGLE,
  BED_HEAD_HINGE,
  WARD_BED_URL,
  WARD_PALETTE,
  WARD_PROPS,
  type WardPropSpec,
} from "./scene-config.js";

/** One shared material per palette entry, so every prop batches the same way. */
const paletteMaterials = new Map<string, THREE.MeshStandardMaterial>();

function wardMaterial(source: THREE.Material): THREE.Material {
  const spec = WARD_PALETTE[source.name];
  if (!spec) return source;
  let material = paletteMaterials.get(source.name);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      name: `ward-${source.name}`,
      color: new THREE.Color(spec.color),
      roughness: spec.roughness ?? 0.8,
      metalness: source.name === "steel" ? 0.35 : 0,
    });
    if (spec.emissive) {
      material.emissive = new THREE.Color(spec.emissive);
      material.emissiveIntensity = 0.9;
    }
    paletteMaterials.set(source.name, material);
  }
  return material;
}

function prepareWardObject(root: THREE.Object3D, castShadow: boolean) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(wardMaterial)
      : wardMaterial(mesh.material);
  });
}

/**
 * The ward bed with its head section lifted a little further than authored,
 * so a 45° reclined patient is supported by the mattress rather than floating
 * above it. The asset documents its hinge, so the two head-section nodes are
 * re-parented under a pivot placed there.
 */
export function WardBed() {
  const { scene } = useGLTF(WARD_BED_URL);
  const bed = useMemo(() => {
    const clone = scene.clone(true);
    prepareWardObject(clone, true);
    const hinge = new THREE.Vector3(...BED_HEAD_HINGE);
    const pivot = new THREE.Group();
    pivot.name = "bed-head-pivot";
    pivot.position.copy(hinge);
    pivot.rotation.x = -BED_HEAD_EXTRA_ANGLE;
    let parent: THREE.Object3D | null = null;
    for (const name of ["head-section", "head-section-shell"]) {
      const node = clone.getObjectByName(name);
      if (!node) continue;
      parent ??= node.parent;
      node.removeFromParent();
      node.position.sub(hinge);
      pivot.add(node);
    }
    (parent ?? clone).add(pivot);
    return clone;
  }, [scene]);
  return <primitive object={bed} />;
}

export function WardProp({ spec }: { spec: WardPropSpec }) {
  const { scene } = useGLTF(spec.url);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    prepareWardObject(clone, spec.castShadow ?? true);
    return clone;
  }, [scene, spec.castShadow]);
  return (
    <primitive
      object={object}
      position={spec.position}
      rotation-y={spec.rotation ?? 0}
      scale={spec.scale ?? 1}
    />
  );
}

/**
 * A sheet draped over the patient's legs and lower torso, tucked up to the
 * chest along the recline. Procedural so it fits either model, hides the
 * authored street shoes/midriff and grounds the figure on the mattress.
 */
function buildBlanketGeometry(): THREE.BufferGeometry {
  const width = 1.04;
  const zStart = -1.04; // just past the feet
  const zEnd = 0.32; // lower chest, on the recline
  // Centre-line height of the covered body along the bed (toes, shins,
  // thighs, hips, then the reclined torso), sampled from the model profile.
  const bodyLine: [number, number][] = [
    [-1.04, 0.69],
    [-0.62, 0.8],
    [-0.45, 0.76],
    [-0.2, 0.74],
    [0.1, 0.8],
    [0.2, 0.83],
    [0.32, 0.95],
  ];
  const bodyTop = (z: number) => {
    for (let index = 1; index < bodyLine.length; index += 1) {
      const [z0, y0] = bodyLine[index - 1]!;
      const [z1, y1] = bodyLine[index]!;
      if (z <= z1) {
        const t = THREE.MathUtils.clamp((z - z0) / (z1 - z0), 0, 1);
        const smooth = (1 - Math.cos(t * Math.PI)) / 2;
        return THREE.MathUtils.lerp(y0, y1, smooth);
      }
    }
    return bodyLine[bodyLine.length - 1]![1];
  };
  // Mattress surface: flat, then the raised head section above the hinge.
  const mattress = (z: number) => (z > 0.2 ? 0.63 + (z - 0.2) * 0.93 : 0.63);

  const geometry = new THREE.PlaneGeometry(width, zEnd - zStart, 28, 64);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, (zStart + zEnd) / 2);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const base = mattress(z);
    const sigma = z > 0.2 ? 0.38 : 0.34;
    const ridge = (bodyTop(z) + 0.015 - base) * Math.exp(-((x / sigma) ** 2));
    let y = base + Math.max(0, ridge);
    // Drape over the mattress edges.
    const overhang = Math.abs(x) - 0.47;
    if (overhang > 0) y -= overhang * 1.6;
    position.setY(index, y);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function PatientBlanket() {
  const geometry = useMemo(buildBlanketGeometry, []);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#c9d4ea" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function WardProps() {
  return (
    <>
      <WardBed />
      <PatientBlanket />
      {WARD_PROPS.map((spec) => (
        <WardProp key={spec.id} spec={spec} />
      ))}
    </>
  );
}

export function preloadWard() {
  useGLTF.preload(WARD_BED_URL);
  for (const spec of WARD_PROPS) useGLTF.preload(spec.url);
}

/**
 * The room itself is simple authored geometry: it only has to read as a calm
 * ward behind the bed, and keeping it procedural means no extra downloads.
 */
export function WardRoom() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#dfe2ea" roughness={0.92} />
      </mesh>
      {/* Back wall behind the bed head */}
      <mesh position={[0, 1.5, 1.75]} receiveShadow>
        <boxGeometry args={[14, 3, 0.12]} />
        <meshStandardMaterial color="#eef0f3" roughness={0.9} />
      </mesh>
      {/* Dado band + skirting on the back wall */}
      <mesh position={[0, 0.98, 1.685]}>
        <boxGeometry args={[14, 0.09, 0.012]} />
        <meshStandardMaterial color="#c9c4e6" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.06, 1.685]}>
        <boxGeometry args={[14, 0.12, 0.012]} />
        <meshStandardMaterial color="#aeb3c2" roughness={0.9} />
      </mesh>
      {/* Window on the back wall, far side of the bed */}
      <group position={[-2.55, 1.75, 1.69]}>
        <mesh>
          <boxGeometry args={[1.9, 1.45, 0.04]} />
          <meshStandardMaterial color="#f8f9fb" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.025]}>
          <planeGeometry args={[1.72, 1.28]} />
          <meshStandardMaterial
            color="#c9dcf5"
            emissive="#dbe9ff"
            emissiveIntensity={0.25}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <boxGeometry args={[0.04, 1.3, 0.01]} />
          <meshStandardMaterial color="#f3f4f6" />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <boxGeometry args={[1.74, 0.04, 0.01]} />
          <meshStandardMaterial color="#f3f4f6" />
        </mesh>
      </group>
      {/* Far side wall */}
      <mesh position={[-4.6, 1.5, -2]} receiveShadow>
        <boxGeometry args={[0.12, 3, 9]} />
        <meshStandardMaterial color="#eceef2" roughness={0.9} />
      </mesh>
      {/* Ceiling with a recessed light panel above the bed */}
      <mesh position={[0, 3, -1]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#f4f4f1" roughness={1} />
      </mesh>
      <mesh position={[0, 2.97, 0.3]}>
        <boxGeometry args={[1.3, 0.04, 0.5]} />
        <meshStandardMaterial color="#ffffff" emissive="#fff9ee" emissiveIntensity={1.1} />
      </mesh>
      {/* Privacy curtain track for this bay (rail only; the curtain is drawn back) */}
      <mesh position={[0.9, 2.55, 0.2]}>
        <boxGeometry args={[0.03, 0.03, 2.9]} />
        <meshStandardMaterial color="#c3c8d2" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0.4, 2.55, -1.25]}>
        <boxGeometry args={[1.0, 0.03, 0.03]} />
        <meshStandardMaterial color="#c3c8d2" metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}
