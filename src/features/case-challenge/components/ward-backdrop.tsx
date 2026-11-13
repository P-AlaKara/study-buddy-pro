import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameState } from "../engine.js";
import type { MedicalCase } from "../schema.js";
import { TypingDots } from "./case-ui.js";
import { wardImageForCase } from "./patient-media.js";

/**
 * The hospital ward filling the whole encounter viewport: one static,
 * pre-rendered image underneath everything clinical. Depth comes from the
 * cheap CSS layers in `.case-ward-*` (ambient light, window glow, vignette),
 * never from filters on the image itself, so the patient and bed keep their
 * detail. The layer is inert to the pointer; only the floating UI above it
 * receives events.
 */
export function WardBackdrop({ caseDefinition }: { caseDefinition: MedicalCase }) {
  const image = wardImageForCase(caseDefinition);
  const imageRef = useRef<HTMLImageElement>(null);
  // Tracks which source has decoded, so switching to the other ward image
  // fades that one in too rather than inheriting the previous "loaded".
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === image.src;

  // A cached (or server-rendered) image can finish before React attaches
  // `onLoad`, so also check `complete` once mounted. A failed load keeps the
  // image hidden and leaves the soft gradient behind it.
  useEffect(() => {
    const node = imageRef.current;
    if (node?.complete && node.naturalWidth > 0) setLoadedSrc(image.src);
  }, [image.src]);

  const focal = {
    "--ward-x": `${image.focus.x}%`,
    "--ward-y": `${image.focus.y}%`,
    "--ward-phone-x": `${image.phoneFocusX}%`,
  } as CSSProperties;

  return (
    <div
      className="case-ward"
      style={focal}
      data-loaded={loaded ? "true" : "false"}
      role="img"
      aria-label={image.alt}
    >
      <img
        key={image.id}
        ref={imageRef}
        src={image.src}
        srcSet={image.srcSet}
        sizes="100vw"
        width={image.width}
        height={image.height}
        alt=""
        className="case-ward-image"
        loading="eager"
        decoding="async"
        fetchPriority="high"
        draggable={false}
        onLoad={() => setLoadedSrc(image.src)}
      />
      <div className="case-ward-light" aria-hidden="true" />
      <div className="case-ward-vignette" aria-hidden="true" />
    </div>
  );
}

/** Live status chips over the patient: distress and speech. */
export function PatientStatusChips({ game, typing }: { game: GameState; typing: boolean }) {
  const critical = game.vitals.spo2 < 90 || game.vitals.systolicBp < 90;
  if (!critical && !typing) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {critical && (
        <span className="case-hud-chip inline-flex text-[var(--case-critical)]">
          <span className="size-1.5 animate-pulse rounded-full bg-[var(--case-critical)]" />
          {game.patientExpression.replaceAll("_", " ")}
        </span>
      )}
      {typing && (
        <span className="case-hud-chip inline-flex text-[var(--case-blue-ink)]">
          Speaking <TypingDots />
        </span>
      )}
    </div>
  );
}
