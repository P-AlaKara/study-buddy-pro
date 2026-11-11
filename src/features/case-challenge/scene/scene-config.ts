/**
 * Static configuration for the 3D hospital scene: which patient models exist,
 * where the ward props stand, and how the camera frames the bed on each
 * breakpoint. Everything is in metres, +Y up, with the bed footprint centred on
 * the origin and the bed head pointing toward +Z (the back wall).
 *
 * Keeping this data-only means the React components stay thin and a future
 * animation sprint can add clips/poses here without touching the renderer.
 */

export type PatientModelId = "female" | "male";

export interface PatientModelSpec {
  id: PatientModelId;
  /** GLB served from `public/models/patient/`. */
  url: string;
  /** Human-readable description for alt text / debugging. */
  description: string;
  /**
   * Yaw (radians) that turns the figure so its head points toward the bed
   * head (+Z). The Innerscene meshes lie with the head toward −Z.
   */
  yaw: number;
  /**
   * Offset applied after yaw so the hips sit on the bed's head-section hinge
   * and the body does not clip the mattress. Tuned per model.
   */
  offset: [number, number, number];
  /** Extra recline (radians, about the hip) so the back meets the raised bed section. */
  recline: number;
  /** Material names (as authored in the GLB) that make up the clothing. */
  clothingMaterials: string[];
}

export const PATIENT_MODELS: Record<PatientModelId, PatientModelSpec> = {
  female: {
    id: "female",
    url: "/models/patient/female.glb",
    description: "young woman, reclined",
    yaw: Math.PI,
    offset: [0, 0.55, -0.65],
    recline: 0,
    clothingMaterials: ["lie_imani female_sportsuit01"],
  },
  male: {
    id: "male",
    url: "/models/patient/male.glb",
    description: "young man, reclined",
    yaw: Math.PI,
    offset: [0, 0.55, -0.65],
    recline: 0,
    clothingMaterials: ["lie_kenji male_casualsuit04"],
  },
};

/**
 * Used when the case data does not name a compatible model. Chosen
 * deliberately (not inferred from other patient fields) so an unrecognised
 * `sex` value never silently guesses.
 */
export const FALLBACK_PATIENT_MODEL: PatientModelId = "male";

/** Hospital-gown colour applied over the authored street clothes. */
export const GOWN_COLOR = "#aec6e4";

export interface WardPropSpec {
  id: string;
  url: string;
  position: [number, number, number];
  /** Yaw in radians. */
  rotation?: number;
  scale?: number;
  castShadow?: boolean;
}

/**
 * Ward furniture around the bed. The camera stands at the patient's left
 * (+X), so bulky items live on the far (−X) side where they add context
 * without covering the patient.
 */
export const WARD_PROPS: WardPropSpec[] = [
  { id: "cabinet", url: "/models/ward/bedside-cabinet.glb", position: [-0.95, 0, 0.55] },
  {
    id: "monitor",
    url: "/models/ward/patient-monitor.glb",
    position: [-0.98, 0, 1.12],
    rotation: 0.55,
  },
  { id: "iv", url: "/models/ward/iv-stand.glb", position: [0.82, 0, 1.0] },
  {
    id: "chair",
    url: "/models/ward/visitor-chair.glb",
    position: [-1.75, 0, -0.35],
    rotation: 1.1,
  },
  {
    id: "table",
    url: "/models/ward/over-bed-table.glb",
    position: [-1.55, 0, 0.9],
    rotation: -0.2,
  },
  {
    id: "panel",
    url: "/models/ward/bedhead-panel.glb",
    position: [0, 1.25, 1.62],
    castShadow: false,
  },
  // A neighbouring, curtained bay gives the room depth without competing.
  {
    id: "curtain",
    url: "/models/ward/curtain-rail.glb",
    position: [-3.6, 0, 0.3],
    castShadow: false,
  },
];

export const WARD_BED_URL = "/models/ward/bed-head-raised.glb";

/** Bed hinge for the raised head section, from the asset's documented pivot. */
export const BED_HEAD_HINGE: [number, number, number] = [0, 0.44, 0.2];
/** Extra lift (radians) for the head section so a 45° reclined patient is supported. */
export const BED_HEAD_EXTRA_ANGLE = 0.16;

/**
 * Palette overrides for the ward pack's eight flat colours. The pack is tuned
 * for an overhead management sim; these soften the saturated accents so the
 * room reads as a real, calm ward under soft light.
 */
export const WARD_PALETTE: Record<
  string,
  { color: string; roughness?: number; emissive?: string }
> = {
  shell: { color: "#f3f2ee", roughness: 0.85 },
  steel: { color: "#c3c8d2", roughness: 0.45 },
  charcoal: { color: "#4b5160", roughness: 0.7 },
  sky: { color: "#cfdcec", roughness: 0.95 },
  teal: { color: "#6f9fb3", roughness: 0.7 },
  sun: { color: "#dccfb8", roughness: 0.8 },
  screen: { color: "#1c2b3c", roughness: 0.3, emissive: "#2f6c7a" },
};

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

/**
 * Three-quarter bedside framing from the foot of the bed on the patient's
 * left, slightly elevated, for a scene that fills the whole viewport. The
 * patient lands in the centre band between the floating left and right
 * panels, with the face a little above centre so the bottom dock covers only
 * the foot of the bed; the tall (phone) preset pulls back and uses a wider
 * field of view so the face clears the top panels and the bottom dock.
 */
export const CAMERA_PRESETS: Record<"wide" | "standard" | "tall", CameraPreset> = {
  wide: { position: [3.05, 2.05, -1.05], target: [-0.35, 0.8, 0.3], fov: 34 },
  standard: { position: [2.75, 1.95, -0.9], target: [-0.2, 0.85, 0.35], fov: 38 },
  tall: { position: [2.9, 2.0, -0.95], target: [-0.05, 0.9, 0.45], fov: 48 },
};

export function cameraPresetForAspect(aspect: number): CameraPreset {
  if (aspect >= 1.45) return CAMERA_PRESETS.wide;
  if (aspect >= 0.95) return CAMERA_PRESETS.standard;
  return CAMERA_PRESETS.tall;
}

/** Limits for the optional "look around" orbit, so the patient never leaves frame. */
export const ORBIT_LIMITS = {
  minDistance: 1.9,
  maxDistance: 3.6,
  minPolarAngle: 0.55,
  maxPolarAngle: 1.35,
  minAzimuthAngle: 0.35,
  maxAzimuthAngle: 2.2,
};
