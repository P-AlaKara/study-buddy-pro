import { assertValidOsceStation } from "../validator.js";
import { CHEST_TIGHTNESS_STATION } from "./chest-tightness-on-the-stairs.js";

export const OSCE_STATIONS = [CHEST_TIGHTNESS_STATION] as const;

for (const station of OSCE_STATIONS) assertValidOsceStation(station);

export { CHEST_TIGHTNESS_STATION };
