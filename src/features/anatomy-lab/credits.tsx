import { ArrowUpRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DATASET } from "./config";
import type { Atlas } from "./engine/anatomy";

/**
 * Sources & Credits. Preserves the upstream dataset attribution required by CC BY 4.0
 * and names the MIT-licensed application code the viewer is adapted from. Figures come
 * from the live manifest where available so they never drift from the shipped dataset.
 */
export function AnatomyCredits({
  open,
  onOpenChange,
  atlas,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  atlas: Atlas | null;
}) {
  const pieces = atlas?.parts.length ?? 2234;
  const concepts = atlas?.concepts.length ?? 3432;
  const triangles = atlas?.triangles ?? 2288268;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="anatomy-lab-credits w-[min(460px,100vw)] overflow-y-auto sm:max-w-none">
        <SheetHeader className="text-left">
          <div className="al-eyebrow" style={{ letterSpacing: "0.14em" }}>
            Sources &amp; Credits
          </div>
          <SheetTitle className="font-display text-2xl font-black">A body, revealed.</SheetTitle>
          <SheetDescription>
            This explorer adapts the open-source Human Atlas viewer and the BodyParts3D reference
            anatomy. It is an educational reference, not a diagnostic or surgical tool.
          </SheetDescription>
        </SheetHeader>

        <div className="al-credits-body mt-4">
          <p>
            <strong>{DATASET.reference}</strong>
            <br />
            {pieces.toLocaleString()} individually selectable source meshes and{" "}
            {concepts.toLocaleString()} named anatomical concepts, totalling{" "}
            {triangles.toLocaleString()} triangles of browser-optimized geometry.
          </p>
          <p>
            This reference does not contain every human structure or variation. Named concepts can
            group multiple source meshes; each source mesh is rendered once. Colours and system
            groupings are curated for exploration, and short descriptions provide general
            educational context only.
          </p>

          <h3>Anatomy data</h3>
          <p>
            BodyParts3D, {DATASET.copyright}, licensed under{" "}
            <strong>Creative Commons Attribution 4.0 International (CC BY 4.0)</strong>. Axes and
            units were converted to metres/Y-up, geometry simplified with a 0.2% per-structure error
            limit, normals quantized to signed 16-bit, and meshes packed into binary chunks. All{" "}
            {pieces.toLocaleString()} source meshes remain represented and their original source
            identifiers are preserved in the manifest.
          </p>
          <div className="al-credit-links">
            <a href={DATASET.datasetLicenseUrl} target="_blank" rel="noreferrer">
              Dataset license <ArrowUpRight size={14} />
            </a>
            <a href={DATASET.licenseUrl} target="_blank" rel="noreferrer">
              CC BY 4.0 terms <ArrowUpRight size={14} />
            </a>
            <a href={DATASET.downloadUrl} target="_blank" rel="noreferrer">
              Original geometry &amp; metadata <ArrowUpRight size={14} />
            </a>
            <a href={DATASET.sourceViewerUrl} target="_blank" rel="noreferrer">
              BodyParts3D anatomy viewer <ArrowUpRight size={14} />
            </a>
            <a href={DATASET.publicationUrl} target="_blank" rel="noreferrer">
              Source publication (Mitsuhashi et al., 2009) <ArrowUpRight size={14} />
            </a>
          </div>

          <h3>Application code</h3>
          <p>
            The 3D rendering engine, geometry streaming and interaction model are adapted from{" "}
            <strong>Human Atlas</strong> by ashemag, released under the <strong>MIT License</strong>
            . The interface has been rebuilt in Medley&apos;s design system; the engine and
            anatomical metadata are preserved.
          </p>
          <div className="al-credit-links">
            <a href="https://github.com/ashemag/human-atlas" target="_blank" rel="noreferrer">
              Human Atlas on GitHub <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
