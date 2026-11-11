import { useEffect, useMemo, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cameraPresetForAspect, ORBIT_LIMITS } from "./scene-config.js";

/**
 * Keeps the bedside framing stable and responsive. The camera eases to the
 * preset for the current aspect ratio (desktop wide, tablet, phone portrait),
 * and only when `orbit` is on does the student get a limited, deliberate
 * look-around — nothing is draggable by accident.
 */
export function CameraRig({ orbit }: { orbit: boolean }) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const preset = useMemo(
    () => cameraPresetForAspect(size.width / Math.max(1, size.height)),
    [size.width, size.height],
  );
  const goal = useRef({
    position: new THREE.Vector3(...preset.position),
    target: new THREE.Vector3(...preset.target),
    fov: preset.fov,
    settled: false,
  });
  const current = useRef({ target: new THREE.Vector3(...preset.target) });
  const first = useRef(true);

  useEffect(() => {
    goal.current.position.set(...preset.position);
    goal.current.target.set(...preset.target);
    goal.current.fov = preset.fov;
    goal.current.settled = false;
    if (first.current) {
      first.current = false;
      camera.position.copy(goal.current.position);
      current.current.target.copy(goal.current.target);
      camera.fov = preset.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(current.current.target);
      goal.current.settled = true;
    }
    invalidate();
  }, [preset, camera, invalidate]);

  // When orbit is switched off, glide back to the authored framing.
  useEffect(() => {
    if (!orbit) {
      goal.current.settled = false;
      invalidate();
    }
  }, [orbit, invalidate]);

  useFrame((_, delta) => {
    if (orbit || goal.current.settled) return;
    const step = 1 - Math.exp(-delta * 6);
    camera.position.lerp(goal.current.position, step);
    current.current.target.lerp(goal.current.target, step);
    camera.fov = THREE.MathUtils.lerp(camera.fov, goal.current.fov, step);
    camera.updateProjectionMatrix();
    camera.lookAt(current.current.target);
    const remaining =
      camera.position.distanceTo(goal.current.position) +
      current.current.target.distanceTo(goal.current.target) +
      Math.abs(camera.fov - goal.current.fov) * 0.01;
    if (remaining < 0.002) {
      camera.position.copy(goal.current.position);
      current.current.target.copy(goal.current.target);
      camera.fov = goal.current.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(current.current.target);
      goal.current.settled = true;
    } else {
      invalidate();
    }
  });

  if (!orbit) return null;
  return (
    <OrbitControls
      makeDefault
      target={preset.target}
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.6}
      zoomSpeed={0.5}
      minDistance={ORBIT_LIMITS.minDistance}
      maxDistance={ORBIT_LIMITS.maxDistance}
      minPolarAngle={ORBIT_LIMITS.minPolarAngle}
      maxPolarAngle={ORBIT_LIMITS.maxPolarAngle}
      minAzimuthAngle={ORBIT_LIMITS.minAzimuthAngle}
      maxAzimuthAngle={ORBIT_LIMITS.maxAzimuthAngle}
    />
  );
}
