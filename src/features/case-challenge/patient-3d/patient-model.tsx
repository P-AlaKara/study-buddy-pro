import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { VISUAL_STATE_CONFIG, type PatientVisualState } from "./patient-visual-state.js";

const CHARACTER_URL = "/models/patient/patient.gltf";
const ANIMATION_URL = "/models/patient/UAL1_Standard.glb";

/** Yaw so the character faces the camera (0 = front toward +Z camera). */
const MODEL_YAW = 0;
const FADE_SECONDS = 0.5;

export function PatientModel({ state }: { state: PatientVisualState }) {
  const character = useGLTF(CHARACTER_URL);
  const library = useGLTF(ANIMATION_URL);
  const camera = useThree((s) => s.camera);

  // Manual mixer bound to the character's (shared) skeleton — the UAL clips
  // reference the same bone names, so they drive this rig without retargeting.
  const mixer = useMemo(() => new THREE.AnimationMixer(character.scene), [character.scene]);
  const actions = useMemo(() => {
    const map: Record<string, THREE.AnimationAction> = {};
    for (const clip of library.animations) {
      map[clip.name] = mixer.clipAction(clip, character.scene);
    }
    return map;
  }, [mixer, library.animations, character.scene]);

  const currentClip = useRef<string | null>(null);
  const leanRef = useRef(0);
  const gownRef = useRef<THREE.Mesh | null>(null);
  const gownBaseY = useRef(0);
  const gownForward = useRef(0);
  const gownScratch = useMemo(() => new THREE.Vector3(), []);
  const spine = useMemo(
    () =>
      character.scene.getObjectByName("spine_02") ??
      character.scene.getObjectByName("spine_03") ??
      character.scene.getObjectByName("spine_01") ??
      null,
    [character.scene],
  );

  // One-time material setup: non-metal stylised skin/cloth, shadows on.
  useEffect(() => {
    character.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // skinned bounds can cull early otherwise
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material?.isMeshStandardMaterial) {
        material.metalness = 0;
        material.roughness = 0.9;
        // Quaternius hair/brow texture is pale grey; tint toward dark hair.
        if (/hair/i.test(material.name)) material.color.set("#2b2420");
      }
    });
  }, [character.scene]);

  // Add a simple hospital gown (the base character ships in undergarments only).
  // Sized from the shoulder/pelvis bones so it fits any unit scale, draped over
  // the torso as a clinical-blue shell.
  useEffect(() => {
    const root = character.scene;
    root.updateWorldMatrix(true, true);
    const ls = root.getObjectByName("upperarm_l");
    const rs = root.getObjectByName("upperarm_r");
    const pelvis = root.getObjectByName("pelvis");
    if (!ls || !rs || !pelvis) return;
    const lp = ls.getWorldPosition(new THREE.Vector3());
    const rp = rs.getWorldPosition(new THREE.Vector3());
    const pv = pelvis.getWorldPosition(new THREE.Vector3());
    const shoulderW = Math.max(lp.distanceTo(rp), 0.001); // true shoulder span
    const shoulderY = (lp.y + rp.y) / 2;
    const top = shoulderY + shoulderW * 0.14; // high neckline, covers the chest
    const bottom = pv.y - (shoulderY - pv.y) * 0.85;
    const height = Math.max(top - bottom, shoulderW);
    // A front-only curved gown panel, pushed ahead of the chest so it occludes
    // the base character's undergarments from the fixed frontal camera. A narrow
    // arc means no back panel shows and the arms stay visible at the sides.
    const radius = shoulderW * 0.78;
    const geometry = new THREE.CylinderGeometry(
      radius * 0.86,
      radius * 1.05,
      height,
      20,
      1,
      true,
      -Math.PI * 0.34,
      Math.PI * 0.68,
    );
    const material = new THREE.MeshStandardMaterial({
      color: "#9fc1dd",
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const gown = new THREE.Mesh(geometry, material);
    gown.name = "__hospital_gown";
    gown.scale.z = 0.7; // shallow front curve rather than a full barrel
    gown.castShadow = true;
    gown.renderOrder = 2;
    root.add(gown);
    gownRef.current = gown;
    gownBaseY.current = (top + bottom) / 2;
    gownForward.current = shoulderW * 0.22; // sit ahead of the chest surface
    return () => {
      root.remove(gown);
      geometry.dispose();
      material.dispose();
      gownRef.current = null;
    };
  }, [character.scene]);

  // Frame the patient chest-up, independent of the model's unit scale, from the
  // head/chest bone world positions (clinical focus = face + chest).
  useEffect(() => {
    const root = character.scene;
    root.updateWorldMatrix(true, true);
    const head = root.getObjectByName("Head");
    const chest = root.getObjectByName("spine_02") ?? root.getObjectByName("spine_01");
    if (!head || !chest) return;
    const headPos = head.getWorldPosition(new THREE.Vector3());
    const bodyHeight = Math.max(headPos.y, 0.001);
    const focus = new THREE.Vector3(headPos.x, headPos.y - bodyHeight * 0.16, headPos.z);
    camera.position.set(focus.x, headPos.y + bodyHeight * 0.03, focus.z + bodyHeight * 0.82);
    camera.lookAt(focus);
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [camera, character.scene]);

  // Crossfade to the clip for the current visual state.
  const config = VISUAL_STATE_CONFIG[state];
  useEffect(() => {
    const clipName = actions[config.clip] ? config.clip : Object.keys(actions)[0];
    if (!clipName) return;
    const next = actions[clipName];
    if (!next) return;
    next.reset().setEffectiveWeight(1).fadeIn(FADE_SECONDS).play();
    if (currentClip.current && currentClip.current !== clipName) {
      actions[currentClip.current]?.fadeOut(FADE_SECONDS);
    }
    currentClip.current = clipName;
  }, [actions, config.clip]);

  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  // Advance the clip, then layer restrained breathing + guarding posture on the
  // chest bone (additive on top of the clip, re-applied each frame).
  useFrame((_, delta) => {
    mixer.update(delta);
    if (!spine) return;
    // Keep the gown over the torso as the idle clip sways/leans (upright, x/z
    // tracking the chest bone), then layer breathing + guarding on the chest.
    if (gownRef.current) {
      spine.getWorldPosition(gownScratch);
      gownRef.current.position.set(
        gownScratch.x,
        gownBaseY.current,
        gownScratch.z + gownForward.current,
      );
    }
    leanRef.current = THREE.MathUtils.damp(leanRef.current, config.lean, 3, delta);
    const phase = performance.now() / 1000;
    spine.rotation.x +=
      leanRef.current + Math.sin(phase * config.breathRate * Math.PI) * config.breathDepth;
  });

  return (
    <group rotation={[0, MODEL_YAW, 0]}>
      <primitive object={character.scene} />
    </group>
  );
}

useGLTF.preload(CHARACTER_URL);
useGLTF.preload(ANIMATION_URL);
