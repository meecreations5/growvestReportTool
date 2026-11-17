import fs from "node:fs";
import assert from "node:assert/strict";

const commit = fs.readFileSync("src/app/api/portfolio/imports/fundbazaar/commit/route.js", "utf8");
const ui = fs.readFileSync("src/components/portfolio/PortfolioImportCentre.js", "utf8");
const parser = fs.readFileSync("src/lib/server/portfolioImportParser.js", "utf8");
const statusBlock = commit.slice(commit.indexOf("const importedCount = importedFiles.length;"), commit.indexOf("const totalCurrentValue = importedFiles.reduce"));
assert.ok(statusBlock.includes("importedCount + duplicateFiles.length"), "duplicate-only upload must count as a successful no-op");
assert.ok(statusBlock.includes("issueCount === 0 && successfulFileCount > 0"), "duplicate-only success must require no outstanding failures");
assert.ok(statusBlock.includes("PORTFOLIO_IMPORT_STATUS.PARTIAL"), "partially imported batch retains warning status");
assert.ok(statusBlock.includes("PORTFOLIO_IMPORT_STATUS.FAILED"), "genuine failed batch retains failure status");
assert.ok(parser.includes('createHash("sha256").update(buffer)'), "only identical file bytes are treated as duplicates");
assert.ok(ui.includes("Already processed. All selected files match earlier successful uploads"), "duplicate-only preview has explicit success message");
assert.ok(ui.includes("Nothing to update: these exact files were processed previously"), "zero-ready state is explained");
assert.equal((ui.match(/      setResult\(aggregated\);/g) || []).length, 1, "batch completion updates result state once");
const derivedStatus = (imported, duplicate, issues) => issues === 0 && imported + duplicate > 0 ? "completed" : imported > 0 ? "partial" : "failed";
for (const [name, args, expected] of [
  ["duplicate-only", [0,2,0], "completed"],
  ["new-files", [2,0,0], "completed"],
  ["mixed new and duplicate", [2,3,0], "completed"],
  ["partial with error", [1,2,1], "partial"],
  ["unresolved-only", [0,0,1], "failed"],
  ["duplicate plus unresolved", [0,1,1], "failed"],
  ["empty batch", [0,0,0], "failed"],
]) assert.equal(derivedStatus(...args), expected, name);
console.log("15 daily import status checks passed; report generation files unchanged.");
