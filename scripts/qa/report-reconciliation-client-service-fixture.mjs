import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const servicePath = path.join(root, "src/services/reportReconciliationService.js");
const formPath = path.join(root, "src/components/reports/ReportForm.js");
const legacyServicePath = path.join(root, "src/services/reportService.js");

const service = fs.readFileSync(servicePath, "utf8");
const form = fs.readFileSync(formPath, "utf8");
const legacy = fs.readFileSync(legacyServicePath, "utf8");

const checks = [
  [service.includes("export async function reconcileMonthlyReportPortfolio"), "Dedicated reconciliation service exports the function."],
  [service.includes('/api/reports/reconcile-portfolio'), "Dedicated reconciliation service calls the reconciliation API."],
  [service.includes('cache: "no-store"'), "Reconciliation request bypasses client/browser fetch caching."],
  [form.includes('from "@/services/reportReconciliationService"'), "ReportForm imports reconciliation from the dedicated service."],
  [!form.match(/reconcileMonthlyReportPortfolio,\s*\n\s*saveMonthlyReport\s*\n}\s*from "@\/services\/reportService"/), "ReportForm no longer imports the function from reportService."],
  [legacy.includes("export async function reconcileMonthlyReportPortfolio"), "Legacy export remains for compatibility with any external consumers."],
  [form.includes("await reconcileMonthlyReportPortfolio(form);"), "Completion gate still executes reconciliation before completing."],
];

let failures = 0;
for (const [ok, message] of checks) {
  if (ok) console.log(`PASS: ${message}`);
  else {
    failures += 1;
    console.error(`FAIL: ${message}`);
  }
}
if (failures) process.exit(1);
console.log(`PASS: ${checks.length} client reconciliation integration checks.`);
