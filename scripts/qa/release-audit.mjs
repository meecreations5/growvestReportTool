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
assert(packageJson.version === "0.33.2", "package.json version is 0.33.2");

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

const investorLifecycleRoute = read("src/app/api/investors/[investorId]/lifecycle/route.js");
const investorLifecycleCard = read("src/components/investors/InvestorLifecycleCard.js");
assert(investorLifecycleRoute.includes("Only Admin or Super Admin") && investorLifecycleRoute.includes('action === "disable"') && investorLifecycleRoute.includes('action === "delete"'), "Investor lifecycle management is Admin-only and supports disable/delete actions");
assert(investorLifecycleRoute.includes("soft_delete_with_retention") && investorLifecycleRoute.includes("revokeRefreshTokens") && investorLifecycleRoute.includes("pausedByInvestorLifecycle"), "Investor deletion retains history while portal sessions are revoked and SIP reminders are lifecycle-paused");
assert(investorLifecycleCard.includes("Type DELETE to confirm") && investorLifecycleCard.includes("Records retained for history"), "Investor lifecycle UI requires explicit delete confirmation and shows retained-record impact");

const portfolioParser = read("src/lib/server/portfolioImportParser.js");
const portfolioCommit = read("src/app/api/portfolio/imports/fundbazaar/commit/route.js");
const portfolioPreview = read("src/app/api/portfolio/imports/preview/route.js");
const portfolioCoverage = read("src/lib/server/portfolioCoverage.js");
const portfolioImportCentre = read("src/components/portfolio/PortfolioImportCentre.js");
const portfolioCoveragePanel = read("src/components/portfolio/DailyPortfolioCoveragePanel.js");
const portfolioOrphanCleanup = read("src/app/api/portfolio/imports/orphans/route.js");
const portfolioRecovery = read("src/app/api/portfolio/imports/[batchId]/recovery/route.js");
assert(portfolioParser.includes('createHash("sha256")') && portfolioParser.includes("fileFingerprint"), "portfolio files use SHA-256 fingerprints for duplicate protection");
assert(portfolioParser.includes("Fundbazaar Portfolio Ledger is not applicable") && portfolioParser.includes("Client Wise Valuation Report.xlsx"), "Fundbazaar daily import is standardized on Client Wise Valuation Report.xlsx and Ledger is disabled");
assert(portfolioParser.includes("fundbazaarBootstrapOnly: true") && portfolioParser.includes("completely blank/newly reset portfolio"), "readable legacy Fundbazaar XLS/HTML-XLS is exposed only as a blank/reset portfolio bootstrap format");
assert(portfolioCommit.includes("assertFundbazaarValuationFormat") && portfolioCommit.includes("excludeImportBatchIds: [batchId]") && portfolioCommit.includes("first upload of a completely blank or newly reset portfolio"), "Fundbazaar commit permits legacy XLS/HTML-XLS only when the selected investor has no prior portfolio state");
assert(portfolioPreview.includes("normalizedExternalClientName") && portfolioPreview.includes("suggestions: issueSuggestions"), "portfolio preview persists strong external identity even for rejected/uncommitted files so future Full Reset can remove their history safely");
assert(portfolioCoverage.includes("if (!expectedCount) return false") && portfolioCoverage.includes("completionPercentage = expectedCount ?") && portfolioCoverage.includes(": 0;"), "Daily Coverage ignores orphan issue files when no verified investors are expected and reports reset coverage as not started");
assert(portfolioImportCentre.includes("appliedImportHistory") && portfolioImportCentre.includes("No applied portfolio imports yet") && portfolioCoveragePanel.includes('"Not started"'), "Portfolio Import Centre hides zero-import preview noise and renders a clean not-started state after Full Reset");
assert(portfolioOrphanCleanup.includes('actor?.role !== "super_admin"') && portfolioOrphanCleanup.includes("CLEAR FAILED IMPORTS") && portfolioImportCentre.includes("Clear old failed attempts"), "Super Admin can explicitly purge already-existing zero-import Fundbazaar attempts after a reset without deleting applied portfolio history");
assert(portfolioImportCentre.includes("Suggested GrowVest investor") && portfolioImportCentre.includes("Suggestion only — confirm the GrowVest investor") && portfolioCoverage.includes("suggestedInvestorName") && portfolioCoveragePanel.includes("Suggested investor:"), "portfolio import review and Daily Coverage expose the best investor suggestion without auto-mapping it");
assert(portfolioPreview.includes("REP BY") && portfolioPreview.includes("primaryExternalInvestorName") && portfolioPreview.includes("primaryTokenScore"), "investor suggestions prioritize the actual investor name before Fundbazaar representative suffixes such as REP BY");
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
assert(portfolioAdministration.includes("Select multiple investments") && portfolioAdministration.includes("Delete Current Portfolio") && portfolioAdministration.includes("Full Portfolio Reset"), "individual Investor Portfolio Administration separates selected-holding cleanup, controlled current-portfolio cleanup and Full Portfolio Reset");

const portfolioOverview = read("src/components/portfolio/PortfolioOverview.js");
assert(portfolioOverview.includes("Portfolio Overview") && portfolioOverview.includes("Daily Portfolio Update") && portfolioOverview.includes("Portfolio health"), "Portfolio Overview separates monitoring from imports and destructive administration");

const centralPortfolioAdministration = read("src/components/portfolio/CentralPortfolioAdministration.js");
const centralPortfolioAdministrationRoute = read("src/app/api/portfolio/administration/route.js");
const portfolioResetRoute = read("src/app/api/portfolio/investors/[investorId]/reset/route.js");
const portfolioBulkResetRoute = read("src/app/api/portfolio/administration/reset/route.js");
const portfolioResetServer = read("src/lib/server/portfolioReset.js");
const investorDetail = read("src/components/investors/InvestorDetailClient.js");
const investorDashboard = read("src/app/investor/dashboard/page.js");
const reportForm = read("src/components/reports/ReportForm.js");
const reportInvestorSelection = read("src/components/reports/create/InvestorSelectionStep.js");
const reportConstants = read("src/lib/constants/report.js");
assert(centralPortfolioAdministration.includes("Choose investors to manage") && centralPortfolioAdministration.includes("Delete from selected investors"), "central Portfolio Administration supports multi-investor selection and category cleanup");
assert(centralPortfolioAdministration.includes("ENTIRE") && centralPortfolioAdministration.includes("previewInvestorPortfolioCleanup") && centralPortfolioAdministration.includes("previewInvestorTradingCleanup"), "central Portfolio Administration previews holdings and trading before bulk deletion");
assert(centralPortfolioAdministrationRoute.includes("verifyStaffRequest(request)") && centralPortfolioAdministrationRoute.includes("Only Admin or Super Admin"), "central Portfolio Administration inventory API is Admin-only");
assert(centralPortfolioAdministrationRoute.includes("portfolioAdministrationScope") && centralPortfolioAdministrationRoute.includes("tradingTransactions"), "central Portfolio Administration inventory separates holding scopes and trading");
assert(portfolioResetRoute.includes('actor?.role !== "super_admin"') && portfolioResetRoute.includes('confirmation !== "RESET PORTFOLIO"'), "individual Full Portfolio Reset is Super Admin-only with explicit typed confirmation");
assert(portfolioBulkResetRoute.includes('actor?.role !== "super_admin"') && portfolioBulkResetRoute.includes("RESET ${count} INVESTOR"), "bulk Full Portfolio Reset is Super Admin-only with investor-count confirmation");
assert(portfolioResetServer.includes('investorRows("portfolioPositions"') && portfolioResetServer.includes('investorRows("portfolioSnapshots"') && portfolioResetServer.includes('investorRows("portfolioFileFingerprints"') && portfolioResetServer.includes('investorRows("externalInvestorMappings"'), "Full Portfolio Reset removes portfolio master, snapshot, fingerprint and provider-mapping state");
assert(portfolioResetServer.includes('investorRows("portfolioImportChanges"') && portfolioResetServer.includes('investorRows("portfolioImportChangeItems"') && portfolioResetServer.includes('investorRows("activityLogs"') && portfolioResetServer.includes('fundbazaarDailyTrackingEnabled'), "Full Portfolio Reset removes recovery, portfolio-specific internal history and daily tracking state");
assert(portfolioResetServer.includes('batch.missingInvestors') && portfolioResetServer.includes('deleteBatch: remainingIds.length === 0 && missingInvestors.length === 0'), "Full Portfolio Reset removes historical daily-coverage references without deleting other Investors' shared batch history");
assert(portfolioResetServer.includes("purgeOrphanFundbazaarImportAttempts") && portfolioResetServer.includes("verified_fundbazaar_mappings_exist") && portfolioResetRoute.includes("orphanImportCleanup") && portfolioBulkResetRoute.includes("orphanImportCleanup"), "Full Portfolio Reset clears old orphan Fundbazaar issue attempts only when no verified Fundbazaar mapping remains");
assert(!portfolioResetServer.includes("monthlyReports") && !portfolioResetServer.includes("bucketList") && !portfolioResetServer.includes("goals"), "Full Portfolio Reset preserves published Monthly Reports and Goal/Bucket definitions");
assert(centralPortfolioAdministration.includes("Preview Full Portfolio Reset") && centralPortfolioAdministration.includes("previewBulkFullPortfolioReset") && centralPortfolioAdministrationRoute.includes("hasResettableHistory"), "central Portfolio Administration supports Super Admin bulk Full Reset including history-only investors");
assert(centralPortfolioAdministrationRoute.includes('collection("portfolioImportChanges")') && centralPortfolioAdministrationRoute.includes('collection("portfolioImportChangeItems")') && centralPortfolioAdministrationRoute.includes('collection("sipFundingCycles")') && centralPortfolioAdministrationRoute.includes('fundbazaarDailyTrackingEnabled'), "central Portfolio Administration detects recovery/SIP/daily-tracking history even without live holdings");
assert(investorDetail.includes('const currentPortfolio = Number(investor.latestPortfolioValue || 0)') && !investorDetail.includes('latestPortfolioValue || latestReport?.summary?.totalCorpus'), "staff current-portfolio summary does not revive a reset Portfolio Master from historical Monthly Reports");
assert(investorDashboard.includes("hasCurrentPortfolio") && investorDashboard.includes("No current portfolio data · published Monthly Reports remain available as historical records."), "Investor dashboard separates current Portfolio Master state from preserved historical Monthly Reports");
assert(!reportForm.includes("Latest reported corpus") && !reportForm.includes("subscribeMonthlyReports") && reportForm.includes("const carryForward = workflowCarry;"), "new Monthly Reports do not revive reset portfolio values or operational actions from historical reports");
assert(reportInvestorSelection.includes("latestPortfolioSnapshotId") && reportInvestorSelection.includes("Current holdings come only from the verified Portfolio Master") && !reportInvestorSelection.includes("investor?.portfolioValue"), "Monthly Report investor selection shows current Portfolio Master values only");
assert(reportConstants.includes("const funds = [];") && !reportConstants.includes("investor?.existingInvestments"), "Monthly Report base data does not seed current holdings from legacy Investor profile investments");

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
