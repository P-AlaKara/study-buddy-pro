import { ECG_ATTRIBUTION, ecgAltText, ecgDataUrl } from "../ecg.js";
import type { CaseActionResult, MedicalCase } from "../schema.js";

/** Everything the viewer needs to show one image or ECG result. */
export interface ResultMedia {
  src: string;
  altText: string;
  attribution: string;
  sourceUrl: string;
}

/**
 * The picture behind an image/ECG result: a generated ECG at the heart rate it
 * was recorded at, or the case asset file. `null` for text-only results.
 */
export function resultMedia(
  caseDefinition: MedicalCase,
  result: CaseActionResult,
): ResultMedia | null {
  if (result.type !== "image" && result.type !== "ecg") return null;
  if (result.ecg) {
    return {
      src: ecgDataUrl(result.ecg),
      altText: ecgAltText(result.ecg),
      attribution: ECG_ATTRIBUTION,
      sourceUrl: "",
    };
  }
  const asset = result.assetId
    ? caseDefinition.assets.find((candidate) => candidate.id === result.assetId)
    : undefined;
  if (!asset) return null;
  return {
    src: `/cases/${caseDefinition.slug}/${asset.filename}`,
    altText: asset.altText,
    attribution: asset.requiredAttributionText,
    sourceUrl: asset.sourceUrl,
  };
}
