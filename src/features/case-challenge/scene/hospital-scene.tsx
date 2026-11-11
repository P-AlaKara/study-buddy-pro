import { Suspense, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { CameraRig } from "./camera-rig.js";
import { PatientFigure, preloadPatient } from "./patient-figure.js";
import type { PatientVisualState } from "./patient-visual-state.js";
import type { RenderTier } from "./render-tier.js";
import { CAMERA_PRESETS, type PatientModelSpec } from "./scene-config.js";
import { preloadWard, WardProps, WardRoom } from "./ward-props.js";

// Start fetching the ward GLBs as soon as this chunk loads, in parallel with
// React mounting the canvas.
preloadWard();

export interface HospitalSceneProps {
  model: PatientModelSpec;
  visualState: PatientVisualState;
  tier: Exclude<RenderTier, "off">;
  orbit: boolean;
  /** Fired once the first frame with all assets has been drawn. */
  onReady: () => void;
  /** Fired when WebGL is lost or rendering throws; the host swaps to the photo. */
  onFail: (reason: string) => void;
}

function Lights({ tier }: { tier: HospitalSceneProps["tier"] }) {
  const full = tier === "full";
  return (
    <>
      <hemisphereLight args={["#ffffff", "#b9c0cf", 0.55]} />
      {/* Key: daylight through the window on the far side of the bed. */}
      <directionalLight
        position={[-2.4, 3.3, 1.1]}
        intensity={2.2}
        color="#fff4e8"
        castShadow
        shadow-mapSize={full ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.00035}
        shadow-normalBias={0.03}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
        shadow-camera-left={-3.5}
        shadow-camera-right={3.5}
        shadow-camera-top={3.5}
        shadow-camera-bottom={-3.5}
      />
      {/* Fill from the camera side so the face never falls into shadow. */}
      <directionalLight position={[3.2, 2.4, -2.2]} intensity={1.4} color="#eef2ff" />
      {/* Warm bedhead reading light. */}
      <pointLight position={[0.2, 2.05, 1.35]} intensity={2.5} distance={5} color="#ffe9d2" />
    </>
  );
}

/** Reports the first drawn frame after the Suspense boundary resolves. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => invalidate(), [invalidate]);
  useFrame(() => onReady());
  return null;
}

function ContextLossWatcher({ onFail }: { onFail: (reason: string) => void }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onFail("webgl-context-lost");
    };
    canvas.addEventListener("webglcontextlost", handleLost);
    return () => canvas.removeEventListener("webglcontextlost", handleLost);
  }, [gl, onFail]);
  return null;
}

/**
 * The immersive ward. Rendered on demand (no idle redraw loop) because the
 * figure is static this sprint; the animation controller will request frames
 * while anything moves. Default export so it can be code-split with `lazy`.
 */
export default function HospitalScene({
  model,
  visualState,
  tier,
  orbit,
  onReady,
  onFail,
}: HospitalSceneProps) {
  const full = tier === "full";
  const initial = CAMERA_PRESETS.standard;
  preloadPatient(model);
  return (
    <Canvas
      className="case-stage-canvas"
      frameloop="demand"
      shadows={full ? "soft" : true}
      dpr={full ? [1, 2] : 1}
      camera={{ fov: initial.fov, position: initial.position, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
      }}
    >
      <color attach="background" args={["#e8ecf4"]} />
      <fog attach="fog" args={["#e8ecf4", 8, 15]} />
      <Lights tier={tier} />
      <WardRoom />
      <Suspense fallback={null}>
        <WardProps />
        <PatientFigure spec={model} visualState={visualState} />
        {full && (
          <ContactShadows
            position={[0, 0.002, 0]}
            opacity={0.38}
            scale={7}
            blur={2.4}
            far={1.4}
            frames={1}
          />
        )}
        {full && (
          <Environment resolution={64} frames={1}>
            <Lightformer
              intensity={1.6}
              rotation-x={Math.PI / 2}
              position={[0, 4, 0]}
              scale={[8, 8, 1]}
              color="#f4f6ff"
            />
            <Lightformer
              intensity={1.2}
              position={[-5, 2, 1]}
              rotation-y={Math.PI / 2}
              scale={[3, 2, 1]}
              color="#dfe9ff"
            />
            <Lightformer
              intensity={0.5}
              position={[4, 1.5, -3]}
              rotation-y={-Math.PI / 2}
              scale={[3, 2, 1]}
              color="#ffe9d6"
            />
          </Environment>
        )}
        <ReadySignal onReady={onReady} />
      </Suspense>
      <CameraRig orbit={orbit} />
      <ContextLossWatcher onFail={onFail} />
    </Canvas>
  );
}
