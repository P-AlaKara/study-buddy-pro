import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CASE_BANK } from "../src/features/case-challenge/cases/index.js";
import { validateCaseBank } from "../src/features/case-challenge/validator.js";

async function main() {
  const issues = validateCaseBank(CASE_BANK);

  for (const caseDefinition of CASE_BANK) {
    const caseFolder = resolve("public", "cases", caseDefinition.slug);
    const manifestPath = resolve(caseFolder, "assets.manifest.json");
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
        id?: string;
        filename?: string;
      }[];
      for (const expected of caseDefinition.assets) {
        const actual = manifest.find((asset) => asset.id === expected.id);
        if (!actual) {
          issues.push({
            path: `${caseDefinition.slug}.assets.${expected.id}`,
            message: "Asset is missing from assets.manifest.json.",
          });
          continue;
        }
        if (actual.filename !== expected.filename) {
          issues.push({
            path: `${caseDefinition.slug}.assets.${expected.id}`,
            message: "Manifest filename does not match the case definition.",
          });
        }
        try {
          await access(resolve(caseFolder, expected.filename));
        } catch {
          issues.push({
            path: `${caseDefinition.slug}.assets.${expected.id}`,
            message: `Asset file ${expected.filename} does not exist.`,
          });
        }
      }
    } catch {
      issues.push({
        path: `${caseDefinition.slug}.assets`,
        message: "Could not read assets.manifest.json.",
      });
    }
  }

  if (issues.length) {
    for (const issue of issues) console.error(`${issue.path}: ${issue.message}`);
    process.exitCode = 1;
  } else {
    console.log(`Validated ${CASE_BANK.length} medical cases.`);
  }
}

void main();
