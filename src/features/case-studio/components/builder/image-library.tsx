import { useId, useRef, useState } from "react";
import { ImageOff, ImagePlus, LoaderCircle, Trash2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CaseAsset, MedicalCase } from "@/features/case-challenge/schema";
import { assetUsers, blankAsset, updateAsset } from "../../case-edits";
import { cn } from "@/lib/utils";
import { ACCEPTED_IMAGE_TYPES } from "../../image-upload";
import { assetSources, useFirstImage } from "../media";
import { useWorkspace } from "../workspace-context";
import {
  Button,
  EmptyState,
  Field,
  Panel,
  PanelHeading,
  Tag,
  TextArea,
  TextInput,
  Toggle,
  useConfirm,
} from "../studio-ui";

const LICENCES = [
  "CC0 1.0 Universal",
  "Public domain",
  "CC BY 4.0",
  "CC BY-SA 4.0",
  "CC BY-SA 3.0",
];

/** The picture itself: shows it once uploaded, with a way to upload or replace the file. */
function ImageUploader({
  definition,
  asset,
  onUploaded,
}: {
  definition: MedicalCase;
  asset: CaseAsset;
  onUploaded: (uploaded: { url: string; fileName: string }) => void;
}) {
  const { editor } = useWorkspace();
  const input = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "uploading" } | { kind: "error"; message: string }
  >({
    kind: "idle",
  });
  const [dragging, setDragging] = useState(false);
  const { status, src } = useFirstImage(assetSources(definition, asset));
  const hasImage = status === "ok" && src;

  async function upload(file: File | undefined) {
    if (!file || !editor) return;
    setState({ kind: "uploading" });
    try {
      onUploaded(await editor.uploadImage(file));
      setState({ kind: "idle" });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Upload failed.",
      });
    }
  }

  return (
    <div
      className="space-y-2"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void upload(event.dataTransfer.files[0]);
      }}
    >
      <div
        id={`studio-asset-${asset.id}`}
        className={cn(
          "studio-anchor relative grid aspect-[4/3] w-full scroll-mt-28 place-items-center overflow-hidden rounded-2xl",
          hasImage ? "bg-[#151f29]" : "border-2 border-dashed bg-muted/50",
          dragging ? "border-[#7c63e0] bg-lavender-soft" : "border-border",
        )}
      >
        {hasImage ? (
          <img src={src} alt={asset.altText} className="block h-full w-full object-contain" />
        ) : (
          <span className="p-3 text-center text-[13px] font-bold text-muted-foreground">
            <ImageOff aria-hidden className="mx-auto mb-1.5 size-6" />
            {status === "loading" && (asset.url || asset.filename)
              ? "Loading…"
              : asset.url || asset.filename
                ? "The image could not be loaded. Upload it again."
                : "Drop an image here, or choose a file."}
          </span>
        )}
        {state.kind === "uploading" && (
          <span className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-extrabold text-white">
            <span className="inline-flex items-center gap-2">
              <LoaderCircle aria-hidden className="size-4 animate-spin" /> Uploading…
            </span>
          </span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <Button
        size="sm"
        tone={hasImage ? "secondary" : "primary"}
        disabled={!editor || state.kind === "uploading"}
        onClick={() => input.current?.click()}
      >
        <Upload aria-hidden className="size-4" /> {hasImage ? "Replace image" : "Upload image"}
      </Button>
      <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF, up to 10 MB.</p>
      {state.kind === "error" && (
        <p role="alert" className="text-[13px] font-bold text-[#8f2424]">
          {state.message}
        </p>
      )}
    </div>
  );
}

export function AssetForm({
  definition,
  asset,
  onChange,
}: {
  definition: MedicalCase;
  asset: CaseAsset;
  onChange: (next: MedicalCase) => void;
}) {
  const listId = useId();
  // An upload finishes after other edits may have happened: apply it to the latest case.
  const latest = useRef(definition);
  latest.current = definition;
  const set = (partial: Partial<CaseAsset>) =>
    onChange(updateAsset(definition, asset.id, { ...asset, ...partial }));
  const users = assetUsers(definition, asset.id);
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div className="space-y-2">
        <ImageUploader
          definition={definition}
          asset={asset}
          onUploaded={({ url, fileName }) => {
            const current = latest.current.assets.find((item) => item.id === asset.id);
            if (!current) return;
            onChange(
              updateAsset(latest.current, asset.id, { ...current, url, filename: fileName }),
            );
          }}
        />
        <p className="text-[13px] text-muted-foreground">
          {users.length
            ? `Used by ${users.map((user) => `“${user.label || "untitled"}”`).join(", ")}.`
            : "Not used by any action yet."}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Licence" required className="sm:col-span-2">
          <TextInput
            value={asset.license}
            onChange={(license) => set({ license })}
            list={listId}
            placeholder="e.g. CC BY-SA 4.0"
          />
          <datalist id={listId}>
            {LICENCES.map((licence) => (
              <option key={licence} value={licence} />
            ))}
          </datalist>
        </Field>
        <Field
          label="Description for screen readers"
          required
          className="sm:col-span-2"
          help="What the image shows, without giving the answer away."
          example="Frontal chest radiograph of an adult."
        >
          <TextArea value={asset.altText} rows={2} onChange={(altText) => set({ altText })} />
        </Field>
        <Field label="Where it comes from" help="Link to the original file.">
          <TextInput
            value={asset.sourceUrl}
            onChange={(sourceUrl) => set({ sourceUrl })}
            placeholder="https://commons.wikimedia.org/…"
          />
        </Field>
        <Field label="Author">
          <TextInput value={asset.author} onChange={(author) => set({ author })} />
        </Field>
        <Field
          label="Attribution shown under the image"
          required
          className="sm:col-span-2"
          help="As the licence requires; mention any labels you removed."
        >
          <TextInput
            value={asset.requiredAttributionText}
            onChange={(requiredAttributionText) => set({ requiredAttributionText })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Toggle
            checked={asset.isPlaceholder}
            tone="warn"
            label="Placeholder — licence not confirmed yet"
            description="Flags the image for replacement before release."
            onChange={(isPlaceholder) => set({ isPlaceholder })}
          />
        </div>
      </div>
    </div>
  );
}

export function ImageLibrary({
  definition,
  onChange,
}: {
  definition: MedicalCase;
  onChange: (next: MedicalCase) => void;
}) {
  const confirm = useConfirm();
  return (
    <Panel id="studio-images">
      <PanelHeading
        level={3}
        title="Image library"
        description="X-rays, scans and photos this case uses, stored in the case library. ECGs are drawn automatically and need no file."
        aside={
          <Button
            tone="quiet"
            onClick={() =>
              onChange({ ...definition, assets: [...definition.assets, blankAsset(definition)] })
            }
          >
            <ImagePlus aria-hidden className="size-4" /> Add an image
          </Button>
        }
      />
      {definition.assets.length === 0 ? (
        <EmptyState title="No images yet">
          Add an image here or from any test result, then upload the file. Use open-licensed images
          with teaching labels removed.
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {definition.assets.map((asset, index) => (
            <li key={index} className="rounded-2xl border border-border p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-extrabold">
                  {asset.altText || asset.filename || "Untitled image"}
                </span>
                {asset.isPlaceholder && <Tag tone="warn">Placeholder</Tag>}
                <Button
                  size="sm"
                  tone="danger"
                  className="ml-auto"
                  onClick={async () => {
                    const users = assetUsers(definition, asset.id);
                    const ok = await confirm({
                      title: "Remove this image?",
                      confirmLabel: "Remove image",
                      description: users.length
                        ? `It is used by ${users.map((user) => `“${user.label}”`).join(", ")}. Those results will need a new image.`
                        : "No action uses it.",
                    });
                    if (ok)
                      onChange({
                        ...definition,
                        assets: definition.assets.filter((_, i) => i !== index),
                      });
                  }}
                >
                  <Trash2 aria-hidden className="size-4" /> Remove
                </Button>
              </div>
              <AssetForm definition={definition} asset={asset} onChange={onChange} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** "Add a new image" from inside a response editor, without leaving the step. */
export function AssetDialog({
  definition,
  assetIndex,
  onChange,
  onClose,
}: {
  definition: MedicalCase;
  /** Index, not id: the id follows the file name while it is typed. */
  assetIndex: number | null;
  onChange: (next: MedicalCase) => void;
  onClose: () => void;
}) {
  const asset = assetIndex === null ? undefined : definition.assets[assetIndex];
  return (
    <Dialog open={Boolean(asset)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,860px)] max-w-none overflow-y-auto rounded-[24px]">
        <DialogTitle className="font-display text-xl font-black">
          Add an image to this case
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Upload the file and describe it. Then choose it in the response's image picker.
        </DialogDescription>
        {asset && <AssetForm definition={definition} asset={asset} onChange={onChange} />}
        <div className="flex justify-end">
          <Button tone="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
