import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { PatientModel } from "./patient-model.js";
import type { PatientVisualState } from "./patient-visual-state.js";

/**
 * The patient viewport canvas. Rendered transparently so the light clinical
 * backdrop from `.case-patient-stage` shows behind the lit 3D patient, keeping
 * the scene lightweight and focused on the character (no heavy 3D room). Default
 * export so it can be code-split with `React.lazy`.
 */
export default function PatientScene({ state }: { state: PatientVisualState }) {
  return (
    <Canvas
      className="!absolute inset-0"
      camera={{ fov: 32, position: [0, 0.3, 3.2], near: 0.1, far: 50 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      performance={{ min: 0.5 }}
    >
      <hemisphereLight args={["#ffffff", "#c8cfdd", 1.1]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.3} color="#fff6ec" />
      <directionalLight position={[-3, 2, -1.5]} intensity={0.45} color="#cdd8f0" />
      <Suspense fallback={null}>
        <PatientModel state={state} />
      </Suspense>
    </Canvas>
  );
}
