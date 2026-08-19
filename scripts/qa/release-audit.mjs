import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const warnings = [];
const passes = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function pass(message) { passes.push(message); }
function fail(message) { failures.push(message); }
function warn(message) { warnings.push(message); }
function assert(condition, message) { condition ? pass(message) : fail(message); }

function walk(directory) {
  const rows = [];
  if (!fs.existsSync(directory)) return rows;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) rows.push(...walk(full));
    else rows.push(full);
  }
  return rows;
}

const packageJson = JSON.parse(read("package.json"));
assert(packageJson.version === "0.33.1", "package.json version is 0.33.1");

const forbiddenTopLevel = [".env", ".env.local", ".git", ".next", "node_modules"];
for (const item of forbiddenTopLevel) {
  assert(!fs.existsSync(path.join(root, item)), `${item} is not present in the release package`);
}

const indexes = JSON.parse(read("firestore.indexes.json"));
const unnecessarySingles = (indexes.indexes || []).filter((item) => (item.fields || []).length < 2);
assert(unnecessarySingles.length === 0, "Firestore index file contains no unnecessary single-field composite indexes");

const firestoreRules = read("firestore.rules");
assert(firestoreRules.includes("match /publicSettings/branding"), "public branding has an explicit Firestore rule");
assert(firestoreRules.includes("match /publicSettings/{documentId}") && firestoreRules.includes("allow read, create, update, delete: if false;"), "future publicSettings documents are private by default");
assert(firestoreRules.includes("match /investorKycSecure/{investorId}") && firestoreRules.includes("Full Aadhaar values"), "secure Aadhaar collection remains browser-inaccessible");
assert(firestoreRules.includes("preservesInvestorSecurityFields"), "advisor Investor updates preserve security-sensitive identity fields");
assert(!firestoreRules.includes("|| data.createdByUid == request.auth.uid"), "Firestore Advisor reads do not persist solely because the Advisor created a reassigned record");
assert(firestoreRules.includes("advisorCanReferenceScope") && firestoreRules.includes("getAfter(/databases/$(database)/documents/investors/$(investorId))"), "Advisor client writes are constrained to currently assigned Investor/Lead scope, including atomic create flows");
assert(!/allow\s+read\s*,\s*write\s*:\s*if\s+(signedIn\(\)|request\.auth\s*!=\s*null)/.test(firestoreRules), "Firestore rules contain no blanket authenticated read/write rule");
assert(firestoreRules.includes("resource.data.recipientUid == request.auth.uid") && firestoreRules.includes("advisorCanCreateNotification"), "notifications are explicit-recipient scoped and Advisor creation is constrained");
assert(firestoreRules.includes("match /sipFundingSchedules/{scheduleId}") && firestoreRules.includes("match /sipFundingCycles/{cycleId}"), "SIP funding schedule and cycle collections have explicit Firestore rules");
const sipRuleStart = firestoreRules.indexOf("match /sipFundingSchedules/{scheduleId}");
const sipRuleEnd = firestoreRules.indexOf("match /sipFundingCycles/{cycleId}");
assert(sipRuleStart >= 0 && sipRuleEnd > sipRuleStart && firestoreRules.slice(sipRuleStart, sipRuleEnd).includes("allow read, create, update, delete: if false"), "SIP schedules remain server-managed and browser-inaccessible");

const storageRules = read("storage.rules");
assert(storageRules.includes("request.resource.metadata.uploadedByUid == request.auth.uid"), "Investor document uploads require uploader ownership metadata");
assert(storageRules.includes("resource.metadata.uploadedByUid == request.auth.uid") && storageRules.includes("allow update: if request.resource != null"), "Investors cannot overwrite staff-uploaded document objects");
assert(storageRules.includes("resource.metadata.uploadedByUid == request.auth.uid"), "Investors can delete only files they uploaded themselves");
assert(!storageRules.includes("investorRecord(investorId).data.createdByUid == request.auth.uid"), "Advisor Storage access follows current Investor assignment, not historical creator identity");
assert(storageRules.includes("match /monthly-reports/{allPaths=**}") && storageRules.includes("allow read, write: if false;"), "Monthly Report PDFs remain server-only in Storage");

const firebaseAdmin = read("src/lib/server/firebaseAdmin.js");
assert(firebaseAdmin.includes("verifyIdToken(token, true)"), "server APIs verify revoked Firebase ID tokens");
assert(firebaseAdmin.includes("FIREBASE_APP_CHECK_ENFORCE_SERVER"), "optional server-side Firebase App Check enforcement is available");
assert(!firebaseAdmin.includes("record.createdByUid].includes(actor.uid)"), "Advisor server access does not persist solely because the Advisor originally created a record");

const reportDelivery = read("src/lib/server/reportDelivery.js");
assert(reportDelivery.includes("Monthly Reports can only be sent to the verified Investor email"), "Monthly Report primary recipient is locked to the verified Investor email");
assert(reportDelivery.includes("belongs to a different Monthly Report"), "client-supplied delivery IDs are bound to their report");
assert(reportDelivery.includes("REPORT_DELIVERY_ALLOWED_DOMAINS"), "CC/BCC has configurable approved-recipient controls");

const reportPdf = read("src/lib/server/reportPdf.js");
const momPdf = read("src/lib/server/momPdf.js");
assert(reportPdf.includes("fetchSafeRemoteImage") && !reportPdf.includes("const response = await fetch(url)"), "Monthly Report PDF remote images use SSRF-safe fetching");
assert(momPdf.includes("fetchSafeRemoteImage") && !momPdf.includes("const response = await fetch(url)"), "MOM PDF remote images use SSRF-safe fetching");

const kyc = read("src/lib/server/kycSecurity.js");
assert(kyc.includes("aadhaarLookupHash") && kyc.includes("createHmac"), "Aadhaar duplicate detection uses a keyed lookup hash");
assert(kyc.includes("at least 32 characters"), "KYC encryption rejects weak keys");

const kycRoute = read("src/app/api/investors/[investorId]/kyc/route.js");
assert(kycRoute.includes('"aadhaarLookupHash", "==", protectedValue.aadhaarLookupHash') && kycRoute.includes("another GrowVest investor"), "Aadhaar duplicate lookup is enforced before secure write");

const portfolioParser = read("src/lib/server/portfolioImportParser.js");
const portfolioCommit = read("src/app/api/portfolio/imports/fundbazaar/commit/route.js");
const portfolioRecovery = read("src/app/api/portfolio/imports/[batchId]/recovery/route.js");
assert(portfolioParser.includes('createHash("sha256")') && portfolioParser.includes("fileFingerprint"), "portfolio files use SHA-256 fingerprints for duplicate protection");
assert(portfolioParser.includes("Fundbazaar Portfolio Ledger is not applicable") && portfolioParser.includes("Client Wise Valuation Report.xlsx"), "Fundbazaar daily import is standardized on Client Wise Valuation Report.xlsx and Ledger is disabled");
assert(portfolioCommit.includes("Fundbazaar portfolio updates only accept Client Wise Valuation Report.xlsx"), "Fundbazaar commit rejects Ledger and non-XLSX valuation files");
assert(portfolioCommit.includes("journalVersion: 1") && portfolioCommit.includes("portfolioFileFingerprints"), "portfolio commits retain recovery journals and duplicate fingerprints");
assert(portfolioRecovery.includes("newer import") && portfolioRecovery.includes("Recovery journals are available"), "portfolio recovery blocks unsafe rollback after newer mutations");

const sipFundingRoute = read("src/app/api/sip-funding/route.js");
const sipFundingCron = read("src/app/api/cron/sip-funding-reminders/route.js");
const sipFundingConstants = read("src/lib/constants/sipFunding.js");
assert(sipFundingRoute.includes("withdrawal_transfer") && sipFundingRoute.includes("advisor_follow_up") && sipFundingRoute.includes("bank_mandate_issue") && sipFundingRoute.includes("service_request"), "SIP funding responses route investment decisions to Advisor Follow-up and bank/mandate issues to Service Requests");
assert(sipFundingRoute.includes("verifyAppRequest(request)") && sipFundingCron.includes("CRON_SECRET") && sipFundingCron.includes("secureSecretMatch"), "SIP funding APIs and reminder cron have authenticated/secret gates");
assert(sipFundingConstants.includes("[30, 14, 7, 5, 3, 1, 0]"), "SIP reminder timing includes configurable 5-day pre-debit reminders and other supported intervals");

const manualImportRoute = read("src/app/api/portfolio/investors/[investorId]/manual-import/route.js");
const manualTemplateRoute = read("src/app/api/portfolio/manual-template/route.js");
const portfolioAdministration = read("src/components/portfolio/InvestorPortfolioAdministration.js");
assert(manualImportRoute.includes("Admin access is required for Manual Portfolio administration") && manualImportRoute.includes("PORTFOLIO_SOURCES.MANUAL"), "Manual Portfolio Excel import is Admin-only and writes source=manual holdings");
assert(manualImportRoute.includes('mode === "replace"') && manualImportRoute.includes('manual_portfolio_merged') && manualImportRoute.includes('manual_portfolio_replaced'), "Manual Portfolio importer contains merge and replace workflows");
assert(manualTemplateRoute.includes("verifyStaffRequest(request)") && manualTemplateRoute.includes("Admin access is required"), "Manual Portfolio Excel template download is authenticated and Admin-only");
assert(portfolioAdministration.includes("Fundbazaar") && portfolioAdministration.includes("Trading / Intraday") && portfolioAdministration.includes("Manual Portfolio"), "Investor Portfolio Administration separates portfolio types and trading");
assert(portfolioAdministration.includes("Select multiple investments") && portfolioAdministration.includes("Delete Entire Portfolio"), "individual Investor Portfolio Administration supports selected-holding and entire-portfolio cleanup");

const portfolioOverview = read("src/components/portfolio/PortfolioOverview.js");
assert(portfolioOverview.includes("Portfolio Overview") && portfolioOverview.includes("Daily Portfolio Update") && portfolioOverview.includes("Portfolio health"), "Portfolio Overview separates monitoring from imports and destructive administration");

const centralPortfolioAdministration = read("src/components/portfolio/CentralPortfolioAdministration.js");
const centralPortfolioAdministrationRoute = read("src/app/api/portfolio/administration/route.js");
assert(centralPortfolioAdministration.includes("Choose investors to manage") && centralPortfolioAdministration.includes("Delete from selected investors"), "central Portfolio Administration supports multi-investor selection and category cleanup");
assert(centralPortfolioAdministration.includes("ENTIRE") && centralPortfolioAdministration.includes("previewInvestorPortfolioCleanup") && centralPortfolioAdministration.includes("previewInvestorTradingCleanup"), "central Portfolio Administration previews holdings and trading before bulk deletion");
assert(centralPortfolioAdministrationRoute.includes("verifyStaffRequest(request)") && centralPortfolioAdministrationRoute.includes("Only Admin or Super Admin"), "central Portfolio Administration inventory API is Admin-only");
assert(centralPortfolioAdministrationRoute.includes("portfolioAdministrationScope") && centralPortfolioAdministrationRoute.includes("tradingTransactions"), "central Portfolio Administration inventory separates holding scopes and trading");

const navigation = read("src/lib/constants/navigation.js");
assert(navigation.includes('label: "Advisor Follow-up"') && navigation.includes('label: "Service Requests"') && navigation.includes('label: "Bulk Data Upload"') && navigation.includes('label: "Monthly Market Note"'), "staff navigation uses simplified operating-language module names");
assert(navigation.includes('label: "Portfolio Overview"') && navigation.includes('href: "/portfolio/daily-update"') && navigation.includes('label: "Portfolio Administration"'), "Portfolio navigation separates overview, daily update and administration");

const portfolioCleanup = read("src/app/api/portfolio/investors/[investorId]/cleanup/route.js");
assert(portfolioCleanup.includes('confirmation !== "DELETE"') && portfolioCleanup.includes("Only Admin or Super Admin"), "investor portfolio bulk cleanup requires Admin authority and explicit DELETE confirmation");
assert(portfolioCleanup.includes("positionIds") && portfolioCleanup.includes("relatedTransactions") && portfolioCleanup.includes("createPortfolioSnapshot"), "investor portfolio cleanup supports selected holdings, related transaction cleanup and corrected snapshot rebuild");
assert(portfolioCleanup.includes("invalidated_by_portfolio_cleanup") && portfolioCleanup.includes("portfolio_holdings_bulk_deleted"), "investor portfolio cleanup invalidates affected recovery journals and writes an audit activity");
assert(portfolioCleanup.includes("fullyRemovedFileIds") && portfolioCleanup.includes("portfolioFileFingerprints"), "exact-file locks are released only when all current holdings from the affected import file are removed");
assert(portfolioCleanup.includes("cleanupBatchId") && portfolioCleanup.includes("cleanupScopes"), "multi-investor cleanup operations are correlated in per-investor audit metadata");

const reportPublish = read("src/app/api/reports/[reportId]/publish/route.js");
assert(reportPublish.includes("nextPublishedVersion") && reportPublish.includes("activePublishedVersionId") && reportPublish.includes("reportVersions"), "published Monthly Reports retain immutable version history");

const secureCompare = read("src/lib/server/secureCompare.js");
assert(secureCompare.includes("MIN_SERVER_SECRET_LENGTH = 32"), "cron/webhook authentication rejects short server secrets");

const meetingCron = read("src/app/api/cron/meeting-reminders/route.js");
assert(meetingCron.includes("claimReminder") && meetingCron.includes("reminderClaims"), "meeting reminder cron uses a concurrency claim before sending");

const brevoWebhook = read("src/app/api/webhooks/brevo/route.js");
assert(brevoWebhook.includes("1024 * 1024") && brevoWebhook.includes("safeProviderPayload"), "Brevo webhook payload size and stored provider fields are bounded");

const nextConfig = read("next.config.mjs");
assert(nextConfig.includes('X-Content-Type-Options') && nextConfig.includes('Cache-Control') && nextConfig.includes('X-Frame-Options'), "security and API no-cache response headers are configured");

const apiRouteRoot = path.join(root, "src", "app", "api");
const routeFiles = walk(apiRouteRoot).filter((file) => file.endsWith(`${path.sep}route.js`));
const directAuthPattern = /verifyAppRequest|verifyStaffRequest|CRON_SECRET|BREVO_WEBHOOK_TOKEN|secureSecretMatch/;
const unauthenticatedRoutes = routeFiles.filter((file) => !directAuthPattern.test(fs.readFileSync(file, "utf8")));
assert(unauthenticatedRoutes.length === 0, `all ${routeFiles.length} API routes contain an authentication, cron-secret, or webhook-secret gate`);
if (unauthenticatedRoutes.length) unauthenticatedRoutes.forEach((file) => fail(`Missing API auth marker: ${path.relative(root, file)}`));

const authenticatedApiRoutes = routeFiles.filter((file) => {
  const content = fs.readFileSync(file, "utf8");
  return content.includes("verifyAppRequest(request)") || content.includes("verifyStaffRequest(request)");
});
const missingTypedStatus = authenticatedApiRoutes.filter((file) => !fs.readFileSync(file, "utf8").includes("appRequestErrorStatus"));
assert(missingTypedStatus.length === 0, "authenticated server routes preserve 401/403 status for typed authentication/authorisation failures");

const sourceFiles = walk(path.join(root, "src")).filter((file) => /\.(js|jsx|mjs)$/.test(file));
const publicSecretPattern = /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|PASSWORD|PRIVATE_KEY|ENCRYPTION_KEY|SMTP_PASSWORD)/;
const publicSecretHits = [];
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (publicSecretPattern.test(content)) publicSecretHits.push(path.relative(root, file));
}
assert(publicSecretHits.length === 0, "no server secret is referenced through a NEXT_PUBLIC_* environment variable");
if (publicSecretHits.length) publicSecretHits.forEach((file) => fail(`Potential public secret reference: ${file}`));

const directApiFetchFiles = sourceFiles.filter((file) => {
  const content = fs.readFileSync(file, "utf8");
  return content.includes('fetch("/api/') || content.includes("fetch(`/api/");
});
const missingAppCheckHelper = directApiFetchFiles.filter((file) => {
  const content = fs.readFileSync(file, "utf8");
  // Service worker/bootstrap files may not call privileged custom APIs.
  return content.includes("Authorization") && !content.includes("authenticatedApiHeaders");
});
if (missingAppCheckHelper.length) {
  missingAppCheckHelper.forEach((file) => warn(`Authenticated custom API call does not use authenticatedApiHeaders: ${path.relative(root, file)}`));
} else {
  pass("authenticated custom API clients can attach Firebase App Check tokens");
}

console.log(`\nGrowVest v${packageJson.version} release audit`);
console.log("=".repeat(48));
passes.forEach((item) => console.log(`PASS  ${item}`));
warnings.forEach((item) => console.log(`WARN  ${item}`));
failures.forEach((item) => console.log(`FAIL  ${item}`));
console.log("-".repeat(48));
console.log(`${passes.length} passed, ${warnings.length} warning(s), ${failures.length} failure(s)`);

if (failures.length) process.exit(1);
