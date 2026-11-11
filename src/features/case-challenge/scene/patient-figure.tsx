import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { PatientVisualState } from "./patient-visual-state.js";
import { GOWN_COLOR, type PatientModelSpec } from "./scene-config.js";

/** Approximate hip position along the figure (after yaw), the pivot for recline. */
const HIP_Z = 0.85;

/**
 * Hook point for the animation sprint. A controller receives the figure's
 * root and the latest visual state every frame; today none is registered, so
 * the figure stays in its authored pose. When clips arrive, create the
 * `AnimationMixer` here, map `state.breathing`/`state.cues` to clip weights and
 * call `invalidate()` from `useFrame` so the demand-driven canvas keeps
 * rendering while something moves.
 */
export interface PatientAnimationController {
  update(root: THREE.Object3D, state: PatientVisualState, delta: number): void;
  dispose(): void;
}

export function usePatientAnimation(
  root: RefObject<THREE.Group | null>,
  state: PatientVisualState,
  controller: PatientAnimationController | null = null,
) {
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    if (!controller) return;
    return () => controller.dispose();
  }, [controller]);
  // Intentionally no `useFrame` yet: a static figure needs no per-frame work.
  void root;
}

function prepareFigure(root: THREE.Object3D, spec: PatientModelSpec) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = materials.map((material) => {
      const standard = material as THREE.MeshStandardMaterial;
      if (spec.clothingMaterials.includes(material.name)) {
        // Dress the authored street clothes as a plain hospital gown: keep the
        // cloth normal map for folds, drop the printed colour texture.
        const gown = standard.clone();
        gown.name = `${material.name}-gown`;
        gown.map = null;
        gown.color = new THREE.Color(GOWN_COLOR);
        gown.roughness = 0.95;
        gown.metalness = 0;
        return gown;
      }
      if (standard.isMeshStandardMaterial) {
        standard.metalness = 0;
        standard.envMapIntensity = 0.6;
      }
      return standard;
    });
    if (mesh.material.length === 1) mesh.material = mesh.material[0]!;
  });
}

export function PatientFigure({
  spec,
  visualState,
}: {
  spec: PatientModelSpec;
  visualState: PatientVisualState;
}) {
  const { scene } = useGLTF(spec.url);
  const rootRef = useRef<THREE.Group>(null);
  const figure = useMemo(() => {
    const clone = scene.clone(true);
    prepareFigure(clone, spec);
    return clone;
  }, [scene, spec]);

  usePatientAnimation(rootRef, visualState);

  return (
    <group ref={rootRef} name="patient-rig" position={spec.offset} rotation-y={spec.yaw}>
      <group position={[0, 0, HIP_Z]} rotation-x={-spec.recline}>
        <primitive object={figure} position={[0, 0, -HIP_Z]} />
      </group>
    </group>
  );
}

export function preloadPatient(spec: PatientModelSpec) {
  useGLTF.preload(spec.url);
}
