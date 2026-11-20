import { useEffect, useState } from "react";
import { ImageOff, Maximize2, Minus, Plus, RotateCcw, Target } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  assetSrc,
  resultMedia,
  type ResultMedia,
} from "@/features/case-challenge/components/result-media";
import type { CaseActionResult, CaseAsset, MedicalCase } from "@/features/case-challenge/schema";
import { cn } from "@/lib/utils";
import { FOCUS_RING, Tag } from "./studio-ui";

/*
 * Images and ECGs shown as pictures, never as file names. Generated ECGs are
 * drawn at the heart rate given (the arrival rate in the studio); case images
 * load from their storage URL (or, for older cases, `public/cases/<slug>/`),
 * and an image that is missing says so.
 */

type ImageStatus = "loading" | "ok" | "missing";

export function useImageStatus(src: string | undefined): ImageStatus {
  const [status, setStatus] = useState<ImageStatus>("loading");
  useEffect(() => {
    if (!src) {
      setStatus("missing");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    const image = new Image();
    image.onload = () => !cancelled && setStatus("ok");
    image.onerror = () => !cancelled && setStatus("missing");
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return status;
}

/** Where an image is served from; empty when nothing has been uploaded yet. */
export function assetSources(definition: MedicalCase, asset: CaseAsset | undefined): string[] {
  if (!asset || (!asset.url && !asset.filename)) return [];
  return [assetSrc(definition, asset)];
}

export interface ResolvedImage {
  status: ImageStatus;
  src: string | undefined;
}

/** The first of `sources` that loads. */
export function useFirstImage(sources: readonly string[]): ResolvedImage {
  const key = sources.join("|");
  const [state, setState] = useState<ResolvedImage>({ status: "loading", src: undefined });
  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (!list.length) {
      setState({ status: "missing", src: undefined });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", src: undefined });
    const attempt = (index: number) => {
      const src = list[index];
      if (src === undefined) {
        if (!cancelled) setState({ status: "missing", src: undefined });
        return;
      }
      const image = new Image();
      image.onload = () => !cancelled && setState({ status: "ok", src });
      image.onerror = () => attempt(index + 1);
      image.src = src;
    };
    attempt(0);
    return () => {
      cancelled = true;
    };
  }, [key]);
  return state;
}

/** A result's picture, with its loading state. */
export function useResultImage(
  definition: MedicalCase,
  result: CaseActionResult,
  heartRate?: number,
): { media: ResultMedia | null; image: ResolvedImage } {
  const media = mediaFor(definition, result, heartRate);
  const image = useFirstImage(media ? [media.src] : []);
  return { media, image };
}

/** Resolve a result's picture, drawing ECGs at `heartRate` when none was recorded. */
export function mediaFor(
  definition: MedicalCase,
  result: CaseActionResult,
  heartRate?: number,
): ResultMedia | null {
  const withRate =
    result.ecg && result.ecg.heartRate === undefined && heartRate !== undefined
      ? { ...result, ecg: { ...result.ecg, heartRate } }
      : result;
  return resultMedia(definition, withRate);
}

export function MediaThumb({
  definition,
  result,
  heartRate,
  title,
  className,
}: {
  definition: MedicalCase;
  result: CaseActionResult;
  heartRate?: number;
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { media, image } = useResultImage(definition, result, heartRate);
  const status = image.status;
  const asset = result.assetId
    ? definition.assets.find((item) => item.id === result.assetId)
    : undefined;

  if (!media || status === "missing") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border-2 border-dashed border-[#e0b4b4] bg-pink-soft/60 p-3 text-sm text-[#7b1f1f]",
          className,
        )}
      >
        <ImageOff aria-hidden className="size-6 shrink-0" />
        <span className="min-w-0">
          <span className="block font-extrabold">
            {!result.assetId && !result.ecg
              ? "No image chosen"
              : asset
                ? asset.url || asset.filename
                  ? "Image could not be loaded"
                  : "Image not uploaded yet"
                : "Image is not in this case's library"}
          </span>
          <span className="block text-[13px] leading-snug">
            {asset
              ? asset.url || asset.filename
                ? "The image could not be loaded. Upload it again in the image library."
                : "Upload the image file in the image library."
              : "Choose an image for this result."}
          </span>
        </span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative block w-full overflow-hidden rounded-2xl bg-[#151f29] text-left",
          FOCUS_RING,
          className,
        )}
        aria-label={`Enlarge: ${title}`}
      >
        {status === "loading" ? (
          <span className="block aspect-[4/3] animate-pulse bg-[#22303c]" />
        ) : (
          <img
            src={media.src}
            alt={media.altText}
            className="block aspect-[4/3] w-full object-contain"
            loading="lazy"
          />
        )}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-xs font-extrabold text-white">
          <Maximize2 aria-hidden className="size-3.5" /> Enlarge
        </span>
        {asset?.isPlaceholder && (
          <span className="absolute left-2 top-2">
            <Tag tone="warn">Placeholder image</Tag>
          </span>
        )}
      </button>
      <MediaDialog open={open} onOpenChange={setOpen} media={media} result={result} title={title} />
    </>
  );
}

export function MediaDialog({
  open,
  onOpenChange,
  media,
  result,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: ResultMedia;
  result: CaseActionResult;
  title: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [showAnswer, setShowAnswer] = useState(true);
  const answer = result.annotation;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setZoom(1);
      }}
    >
      <DialogContent className="max-h-[94vh] w-[min(96vw,1100px)] max-w-none gap-0 overflow-hidden rounded-[24px] border-0 bg-[#151f29] p-0 text-white">
        <div className="flex flex-wrap items-center gap-2 bg-[#22303c] px-4 py-3 pr-12">
          <DialogTitle className="mr-auto min-w-0 truncate font-display text-lg font-black">
            {title}
          </DialogTitle>
          <div className="flex items-center gap-1" aria-label="Zoom">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
              className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-12 text-center font-mono text-xs">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setZoom((value) => Math.min(4, value + 0.5))}
              className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Plus className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Reset zoom"
              onClick={() => setZoom(1)}
              className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>
          {answer && (
            <button
              type="button"
              aria-pressed={showAnswer}
              onClick={() => setShowAnswer((value) => !value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                showAnswer ? "bg-amber-300 text-slate-950" : "bg-white/10",
              )}
            >
              <Target aria-hidden className="size-4" />
              {showAnswer ? "Hide" : "Show"} debrief marker
            </button>
          )}
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <div
            className="relative mx-auto origin-top-left transition-[width] duration-150"
            style={{ width: `${zoom * 100}%` }}
          >
            <img src={media.src} alt={media.altText} className="block w-full select-none" />
            {answer && showAnswer && (
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-300 bg-amber-300/10"
                style={{
                  left: `${answer.xPercent}%`,
                  top: `${answer.yPercent}%`,
                  width: `${answer.radiusPercent * 2}%`,
                  aspectRatio: "1",
                }}
              >
                <span className="sr-only">Debrief marker: {answer.label}</span>
              </span>
            )}
          </div>
        </div>
        <DialogDescription asChild>
          <div className="space-y-1.5 bg-[#22303c] px-4 py-3 text-[13px] leading-relaxed text-white/80">
            {answer && (
              <p>
                <span className="font-extrabold text-amber-200">Debrief marker:</span>{" "}
                {answer.label}
              </p>
            )}
            <p>
              <span className="font-extrabold text-white">Description for screen readers:</span>{" "}
              {media.altText || "Missing — add one in the image library."}
            </p>
            <p className="text-white/60">
              {media.attribution}
              {media.sourceUrl && (
                <>
                  {" "}
                  <a
                    href={media.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    Source
                  </a>
                </>
              )}
            </p>
          </div>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
