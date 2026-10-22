// Where the packaged anatomy dataset lives. Assets are hosted under Medley's own
// /public so the feature never depends on an upstream demo's availability. The
// manifest (atlas.json) references its geometry chunks by absolute path, so moving
// to a CDN or a newer dataset later only means changing these values + the manifest.
export const ATLAS_MANIFEST_URL = "/models/anatomy/atlas.json";

// Dataset identity, surfaced in the credits panel. BodyParts3D 4.0, CC BY 4.0.
export const DATASET = {
  name: "BodyParts3D 4.0",
  reference: "Adult male reference anatomy",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  datasetLicenseUrl: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html",
  downloadUrl: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html",
  sourceViewerUrl: "https://lifesciencedb.jp/bp3d/",
  publicationUrl: "https://academic.oup.com/nar/article/37/suppl_1/D782/1000752",
  copyright: "© The Database Center for Life Science",
} as const;
