/*
 * One-off: move case images that still live in public/cases/<slug>/ into the
 * `case-images` storage bucket, and point the cases at them.
 *
 * Run after `npx supabase db push` (migration 20261120120000_clinical_case_bank):
 *
 *   bun scripts/upload-case-images.ts            # preview
 *   bun scripts/upload-case-images.ts --apply    # upload and update the cases
 *
 * Needs SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY);
 * Bun reads them from .env. Safe to re-run: images that already have a URL are
 * skipped, and uploads overwrite the same path.
 */
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "case-images";
const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

interface Asset {
  id: string;
  filename: string;
  url?: string;
}
interface CaseJson {
  slug: string;
  assets: Asset[];
}
interface Row {
  id: string;
  slug: string;
  published: CaseJson | null;
  draft: CaseJson | null;
  version: number;
}

const apply = process.argv.includes("--apply");
const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SECRET_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY first.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase
  .from("clinical_cases")
  .select("id,slug,published,draft,version");
if (error) throw error;

let uploaded = 0;
for (const row of (data ?? []) as Row[]) {
  const urls = new Map<string, string>();
  for (const definition of [row.published, row.draft]) {
    for (const asset of definition?.assets ?? []) {
      if (asset.url || !asset.filename || urls.has(asset.filename)) continue;
      const file = join("public", "cases", definition!.slug, asset.filename);
      const path = `${row.id}/${asset.filename}`;
      console.log(`${apply ? "Uploading" : "Would upload"} ${file} -> ${BUCKET}/${path}`);
      if (apply) {
        const body = await readFile(file);
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, body, {
          contentType: TYPES[extname(asset.filename).toLowerCase()] ?? "application/octet-stream",
          upsert: true,
          cacheControl: "31536000",
        });
        if (uploadError) throw uploadError;
        uploaded += 1;
      }
      urls.set(asset.filename, supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }
  }
  if (!apply || !urls.size) continue;
  const withUrls = (definition: CaseJson | null) =>
    definition && {
      ...definition,
      assets: definition.assets.map((asset) =>
        asset.url || !urls.has(asset.filename)
          ? asset
          : { ...asset, url: urls.get(asset.filename) },
      ),
    };
  const { error: updateError } = await supabase
    .from("clinical_cases")
    .update({
      published: withUrls(row.published),
      draft: withUrls(row.draft),
      version: row.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("version", row.version);
  if (updateError) throw updateError;
  console.log(`Updated ${row.slug}: ${urls.size} image(s) now served from storage.`);
}

console.log(
  apply
    ? `Done: ${uploaded} file(s) uploaded.`
    : "Preview only. Re-run with --apply to upload and update the cases.",
);
