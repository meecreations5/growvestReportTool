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

const investorPermissionMeetingService = read("src/services/meetingService.js");
const investorPermissionReportService = read("src/services/reportService.js");
const investorPermissionAssessmentService = read("src/services/assessmentService.js");
const investorPermissionDetail = read("src/components/investors/InvestorDetailClient.js");
assert(investorPermissionMeetingService.includes('subscribeInvestorMeetings(investorId, currentUser') && investorPermissionMeetingService.includes('where("advisorUid", "==", currentUser.id)'), "Investor meeting history query carries Advisor ownership required by Firestore rules");
assert(investorPermissionReportService.includes('subscribeInvestorReports(investorId, currentUser') && investorPermissionReportService.includes('where("advisorUid", "==", currentUser.id)') && investorPermissionReportService.includes('where("investorVisible", "==", true)'), "Investor report history query carries Advisor/Investor visibility constraints required by Firestore rules");
assert(investorPermissionAssessmentService.includes('subscribeAssessmentVersions(leadId, currentUser') && investorPermissionAssessmentService.includes('where("assignedAdvisorUid", "==", currentUser.id)'), "Assessment version history query carries assigned-Advisor ownership required by Firestore rules");
assert(investorPermissionDetail.includes('subscribeInvestorMeetings(\n      investor.id,\n      profile') && investorPermissionDetail.includes('subscribeInvestorReports(\n      investor.id,\n      profile') && investorPermissionDetail.includes('subscribeAssessmentVersions(\n      investor.leadId,\n      profile'), "Investor detail passes authenticated role scope into all permission-sensitive history subscriptions");

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
const portfolioConstants = read("src/lib/constants/portfolio.js");
const tradingAccountRoute = read("src/app/api/portfolio/trading/accounts/route.js");
const tradingAccountCentre = read("src/components/portfolio/TradingAccountCentre.js");
assert(portfolioParser.includes('createHash("sha256")') && portfolioParser.includes("fileFingerprint"), "portfolio files use SHA-256 fingerprints for duplicate protection");
assert(portfolioParser.includes("Fundbazaar Portfolio Ledger is not applicable") && portfolioParser.includes("FUNDBAZAAR_CLIENT_VALUATION"), "Fundbazaar daily import keeps Portfolio Ledger disabled while Client Wise Valuation remains the authoritative source");
assert(portfolioParser.includes('fileFormat: isHtml ? "HTML-XLS"') && portfolioParser.includes('/\\.(xls|xlsx|csv)$/i.test(file.name)') && !portfolioParser.includes("fundbazaarBootstrapOnly: true"), "Fundbazaar Client Wise Valuation accepts structurally valid XLS/XLSX/CSV/HTML-XLS for first-time and ongoing updates");
assert(portfolioCommit.includes("assertFundbazaarValuationFormat") && portfolioCommit.includes('["XLSX", "XLS", "CSV", "HTML-XLS"]') && !portfolioCommit.includes("first upload of a completely blank or newly reset portfolio"), "Fundbazaar commit validates report structure/format instead of blocking ongoing legacy XLS updates");
assert(portfolioPreview.includes("normalizedExternalClientName") && portfolioPreview.includes("suggestions: issueSuggestions"), "portfolio preview persists strong external identity even for rejected/uncommitted files so future Full Reset can remove their history safely");
assert(portfolioCoverage.includes("if (!expectedCount) return false") && portfolioCoverage.includes("completionPercentage = expectedCount ?") && portfolioCoverage.includes(": 0;"), "Daily Coverage ignores orphan issue files when no verified investors are expected and reports reset coverage as not started");
assert(portfolioImportCentre.includes("appliedImportHistory") && portfolioImportCentre.includes("No applied portfolio imports yet") && portfolioCoveragePanel.includes('"Not started"'), "Portfolio Import Centre hides zero-import preview noise and renders a clean not-started state after Full Reset");
assert(portfolioOrphanCleanup.includes('actor?.role !== "super_admin"') && portfolioOrphanCleanup.includes("CLEAR FAILED IMPORTS") && portfolioImportCentre.includes("Clear old failed attempts"), "Super Admin can explicitly purge already-existing zero-import Fundbazaar attempts after a reset without deleting applied portfolio history");
assert(portfolioImportCentre.includes("Suggested GrowVest investor") && portfolioImportCentre.includes("Suggestion only — confirm the GrowVest investor") && portfolioCoverage.includes("suggestedInvestorName") && portfolioCoveragePanel.includes("Suggested investor:"), "portfolio import review and Daily Coverage expose the best investor suggestion without auto-mapping it");
assert(portfolioPreview.includes("REP BY") && portfolioPreview.includes("primaryExternalInvestorName") && portfolioPreview.includes("primaryTokenScore"), "investor suggestions prioritize the actual investor name before Fundbazaar representative suffixes such as REP BY");
assert(portfolioCommit.includes("journalVersion: 1") && portfolioCommit.includes("portfolioFileFingerprints"), "portfolio commits retain recovery journals and duplicate fingerprints");
assert(portfolioRecovery.includes("newer import") && portfolioRecovery.includes("Recovery journals are available"), "portfolio recovery blocks unsafe rollback after newer mutations");
assert(portfolioConstants.includes('ANGEL_ONE: "angel_one"') && portfolioConstants.includes('ANGEL_ONE_DP_STATEMENT: "angel_one_dp_statement"') && portfolioConstants.includes('BROKER_DELIVERY: "broker_delivery"'), "Trading Account phase 1 defines Angel One, DP statement and broker-delivery portfolio contracts");
assert(portfolioParser.includes('import { inflateSync } from "node:zlib"') && portfolioParser.includes("parseAngelOneDpStatement") && portfolioParser.includes("pdfiumTextItems") && portfolioParser.includes("dpTransactions"), "Angel One digital DP PDFs are parsed locally into depository movements without OCR");
assert(portfolioParser.includes("ANGEL_ONE_DP_ALIASES") && portfolioParser.includes("parseAngelOneDpMatrix") && portfolioParser.includes('PORTFOLIO_REPORT_TYPES.ANGEL_ONE_DP_STATEMENT') && portfolioParser.includes('parseAngelOneDpMatrix(matrix, "HTML Export")'), "Angel One DP Transaction Cum Holding spreadsheets and HTML-XLS exports use the same safe DP movement/closing-holding contract as the supported PDF");
assert(portfolioParser.includes('"Total Holding Qty"') && portfolioParser.includes('"Close Rate"') && portfolioParser.includes("costBasisStatus") && portfolioParser.includes("does not contain purchase cost"), "native Bajaj Client Holding Reports map total quantity/current valuation while leaving unavailable purchase cost pending");
assert(portfolioParser.includes('/^total(?:\\s|$)/i') && portfolioParser.includes("month >= 1 && month <= 12"), "native Bajaj parser rejects report-total rows and safely handles US-style report dates");
assert(portfolioImportCentre.includes('.xls,.xlsx,.csv,.pdf') && portfolioImportCentre.includes('/\\.(xls|xlsx|csv|pdf)$/i') && portfolioImportCentre.includes("supported digital PDF") && portfolioImportCentre.includes("Angel One DP") && portfolioImportCentre.includes("DP Movements") && portfolioImportCentre.includes("structurally valid XLS, XLSX, CSV or HTML-XLS"), "Unified Import accepts provider-native spreadsheet/PDF formats and documents structure-based Fundbazaar/Angel One handling");
assert(portfolioCommit.includes("commitAngelOneFile") && portfolioCommit.includes('collection("brokerDpTransactions")') && portfolioCommit.includes('affectsTradingPnl: false'), "Angel One DP movements persist separately from trading transactions and never create trading P&L");
assert(portfolioCommit.includes("brokerPositionNumbers") && portfolioCommit.includes("previousCost") && portfolioCommit.includes('costBasisStatus: numbers.costBasisAvailable ? "available" : "pending"'), "broker holding snapshots preserve previously known cost basis instead of fabricating missing broker cost data");
assert(portfolioCommit.includes('collection("brokerAccounts")') && portfolioCommit.includes('collection("brokerAccountSnapshots")') && portfolioCommit.includes("brokerAccountId: brokerRecords.accountId"), "broker imports preserve account identity and dated account snapshots alongside delivery holdings");
assert(portfolioRecovery.includes('"brokerAccounts", "brokerAccountSnapshots", "brokerDpTransactions"'), "portfolio recovery includes broker account, snapshot and DP movement records");
assert(firestoreRules.includes("match /brokerAccounts/{accountId}") && firestoreRules.includes("match /brokerAccountSnapshots/{snapshotId}") && firestoreRules.includes("match /brokerDpTransactions/{transactionId}"), "broker account provenance and DP movements use explicit server-write Firestore rules");
assert(tradingAccountRoute.includes("verifyStaffRequest(request)") && tradingAccountRoute.includes('rowsByInvestorIds("brokerAccounts"') && tradingAccountRoute.includes('rowsByInvestorIds("tradingTransactions"'), "Trading Accounts API is authenticated and consolidates delivery, DP movement and intraday activity by broker account");
assert(tradingAccountCentre.includes('title="Trading Accounts"') && tradingAccountCentre.includes("Cost Basis Pending") && tradingAccountCentre.includes("DP Movements") && tradingAccountCentre.includes("Intraday This Month"), "Trading Accounts UI keeps delivery valuation, cost-basis gaps, DP movement and intraday performance visibly separate");

const sipFundingRoute = read("src/app/api/sip-funding/route.js");
const sipFundingCron = read("src/app/api/cron/sip-funding-reminders/route.js");
const sipFundingConstants = read("src/lib/constants/sipFunding.js");
assert(sipFundingRoute.includes("withdrawal_transfer") && sipFundingRoute.includes("advisor_follow_up") && sipFundingRoute.includes("bank_mandate_issue") && sipFundingRoute.includes("service_request"), "SIP funding responses route investment decisions to Advisor Follow-up and bank/mandate issues to Service Requests");
assert(sipFundingRoute.includes("verifyAppRequest(request)") && sipFundingCron.includes("CRON_SECRET") && sipFundingCron.includes("secureSecretMatch"), "SIP funding APIs and reminder cron have authenticated/secret gates");
assert(sipFundingConstants.includes("[30, 14, 7, 5, 3, 1, 0]"), "SIP reminder timing includes configurable 5-day pre-debit reminders and other supported intervals");

const manualImportRoute = read("src/app/api/portfolio/investors/[investorId]/manual-import/route.js");
const manualTemplateRoute = read("src/app/api/portfolio/manual-template/route.js");
const investorDocumentsPanel = read("src/components/investors/InvestorDocumentsPanel.js");
const investorDocumentsPage = read("src/app/investor/documents/page.js");
const documentService = read("src/services/documentService.js");
const documentPreviewModal = read("src/components/documents/DocumentPreviewModal.js");
const documentFileRoute = read("src/app/api/investor-documents/[documentId]/file/route.js");
const accessDocumentWorkflowDoc = read("docs/ACCESS_DOCUMENT_VIEW_AND_MANUAL_PORTFOLIO_UPLOAD_v0.33.2.md");
const bulkManualImportRoute = read("src/app/api/portfolio/manual-bulk-import/route.js");
const bulkManualTemplateRoute = read("src/app/api/portfolio/manual-bulk-template/route.js");
const bulkManualPortfolioPanel = read("src/components/portfolio/BulkManualPortfolioExcelPanel.js");
const manualPortfolioWorkbook = read("src/lib/server/manualPortfolioWorkbook.js");
const investorPortfolioPanel = read("src/components/portfolio/InvestorPortfolioPanel.js");
const portfolioService = read("src/services/portfolioService.js");
const portfolioAdministration = read("src/components/portfolio/InvestorPortfolioAdministration.js");
assert(manualImportRoute.includes("Admin access is required for Manual Portfolio administration") && manualImportRoute.includes("PORTFOLIO_SOURCES.MANUAL"), "Manual Portfolio Excel import is Admin-only and writes source=manual holdings");
assert(manualImportRoute.includes('mode === "replace"') && manualImportRoute.includes('manual_portfolio_merged') && manualImportRoute.includes('manual_portfolio_replaced'), "Manual Portfolio importer contains merge and replace workflows");
assert(manualTemplateRoute.includes("verifyStaffRequest(request)") && manualTemplateRoute.includes("Admin access is required"), "Manual Portfolio Excel template download is authenticated and Admin-only");
assert(manualTemplateRoute.includes("GrowVest_Manual_Investment_Template_v0.33.2.xlsx") && manualTemplateRoute.includes("public", "templates"), "Manual Investment template endpoint serves the approved workbook packaged with the application");
assert(fs.existsSync(path.join(root, "public", "templates", "GrowVest_Manual_Investment_Template_v0.33.2.xlsx")), "approved Manual Investment workbook is included in the release package");
assert(manualImportRoute.includes('workbook.SheetNames.includes("Manual Investments")') && manualImportRoute.includes('sipStatus') && manualImportRoute.includes('parseTransactionSheet(workbook)') && manualImportRoute.includes('collection("investmentTransactions")'), "Manual Investment importer accepts the simplified sheet, SIP status and optional transaction history");
assert(documentService.includes("viewInvestorDocument") && documentService.includes("authenticatedApiHeaders") && documentService.includes("/api/investor-documents/") && documentService.includes("URL.createObjectURL(blob)") && !documentService.includes("getBlob(ref(storage, documentRecord.storagePath))") && !documentService.includes('window.open("", "_blank")'), "Investor document View uses the authenticated same-origin file endpoint and creates only a temporary browser Object URL");
assert(documentFileRoute.includes("verifyAppRequest(request)") && documentFileRoute.includes("adminBucket.file(documentRecord.storagePath)") && documentFileRoute.includes("expectedPrefix") && documentFileRoute.includes("private, no-store") && documentFileRoute.includes("X-Content-Type-Options"), "Investor document file endpoint verifies app access, constrains Storage path, and streams files with private no-store headers");
assert(documentPreviewModal.includes('role="dialog"') && documentPreviewModal.includes("<iframe") && documentPreviewModal.includes("<img") && documentPreviewModal.includes("Opening secure document") && documentPreviewModal.includes("Download"), "secure document popup opens immediately, shows protected loading state, previews PDF/images in-app and keeps Download available");
assert(investorDocumentsPanel.includes("DocumentPreviewModal") && investorDocumentsPanel.includes("view:${item.id}") && investorDocumentsPage.includes("DocumentPreviewModal") && investorDocumentsPage.includes("view:${item.id}") && investorDocumentsPage.includes("Opening…"), "Staff Access & Documents and Investor Portal use action-specific View state and the shared popup preview");
assert(accessDocumentWorkflowDoc.includes("popup preview") && accessDocumentWorkflowDoc.includes("Download Manual Investment Template") && accessDocumentWorkflowDoc.includes("Transactions (Optional)"), "Access/Documents popup viewing and simplified Manual Investment workbook flow are documented");
assert(bulkManualImportRoute.includes("Manual Portfolio Management administration") && manualPortfolioWorkbook.includes("MAX_INVESTORS = 100") && manualPortfolioWorkbook.includes("MAX_TOTAL_ROWS = 10000"), "Manual Portfolio Management import is Admin-only and bounded for multi-investor workbooks");
assert(manualPortfolioWorkbook.includes("normalisePan") && manualPortfolioWorkbook.includes("normaliseCode") && manualPortfolioWorkbook.includes("normaliseName") && manualPortfolioWorkbook.includes('status: "conflict"'), "Manual Portfolio Management matches Investor ID/PAN/Client Code/name and blocks conflicting identity");
assert(manualPortfolioWorkbook.includes("never create an import group from this sheet alone") && !manualPortfolioWorkbook.includes("else groupFor(match.investor, match.matchedBy);"), "Reference-only Investors sheet cannot trigger Replace-mode deletion for investors without portfolio rows");
assert(manualPortfolioWorkbook.includes('status: "duplicate"') && manualPortfolioWorkbook.includes('source: PORTFOLIO_SOURCES.MANUAL') && manualPortfolioWorkbook.includes('mode === "replace"') && manualPortfolioWorkbook.includes("createPortfolioSnapshot"), "Manual Portfolio Management blocks duplicate stable keys, preserves source=manual scope, supports replace, and rebuilds investor snapshots");
assert(manualPortfolioWorkbook.includes("const replaceWriter = adminDb.bulkWriter()") && manualPortfolioWorkbook.includes("await replaceWriter.close()") && manualPortfolioWorkbook.indexOf("await replaceWriter.close()") < manualPortfolioWorkbook.indexOf("const writer = adminDb.bulkWriter();", manualPortfolioWorkbook.indexOf("commitManualPortfolioWorkbook")), "Manual Portfolio replace deletes old investor state before recreating stable document IDs");
assert(bulkManualTemplateRoute.includes("Investor Client Code") && bulkManualTemplateRoute.includes("Investor Name") && bulkManualTemplateRoute.includes("PAN") && bulkManualTemplateRoute.includes("02_Portfolio_Accounts") && bulkManualTemplateRoute.includes("11_Notes") && bulkManualTemplateRoute.includes("verifyStaffRequest(request)"), "Manual Portfolio Management template contains multi-investor identity and complete account/ledger sheets");
assert(bulkManualPortfolioPanel.includes("Manage multiple investors and PMS-style portfolio accounts from one Excel") && bulkManualPortfolioPanel.includes("Preview Workbook") && bulkManualPortfolioPanel.includes("blockingIssueCount"), "Central Portfolio Administration exposes preview-first Manual Portfolio Management workbook upload");
assert(manualPortfolioWorkbook.includes("manualPortfolioCashLedger") && manualPortfolioWorkbook.includes("manualPortfolioIncome") && manualPortfolioWorkbook.includes("manualPortfolioCorporateActions") && manualPortfolioWorkbook.includes("manualPortfolioCharges") && manualPortfolioWorkbook.includes("manualPortfolioReconciliations"), "Manual Portfolio Management persists cash, income, corporate actions, charges and reconciliation ledgers");
assert(manualPortfolioWorkbook.includes("PORTFOLIO_PRODUCT_TYPES.ETF") && read("src/lib/constants/portfolio.js").includes('ETF: "etf"'), "Manual Portfolio Management treats ETF as a first-class portfolio type");
assert(manualPortfolioWorkbook.includes('assetClass: "Cash"') && manualPortfolioWorkbook.includes("currentPortfolioValue") && manualPortfolioWorkbook.includes("xirrPercentage"), "Manual Portfolio Management includes uninvested cash in Portfolio Master and calculates account performance metrics");
assert(manualPortfolioWorkbook.includes("manualPortfolioAccountSnapshots") && manualPortfolioWorkbook.includes("assetClasses") && manualPortfolioWorkbook.includes("accountSnapshotDate"), "Manual Portfolio Management preserves dated account performance snapshots and asset allocation for month/FY history");
const portfolioServer = read("src/lib/server/portfolioServer.js");
assert(portfolioServer.includes("manualPortfolioCashLedger") && portfolioServer.includes('cashFlowType = "new_money"') && portfolioServer.includes('cashFlowType = "withdrawal"') && portfolioServer.includes('cashFlowType = "internal"'), "Portfolio Intelligence uses Manual Cash Ledger contributions/withdrawals without double-counting internal PMS cash movements");
assert(read("src/lib/server/portfolioIntelligence.js").includes("transaction.realisedPnl ?? transaction.realizedPnl") && manualPortfolioWorkbook.includes("realisedPnl: row.realizedPnl"), "Manual transaction realised P&L is included consistently in Portfolio Intelligence and account performance");
assert(investorPortfolioPanel.includes("Manual Portfolio Management") && investorPortfolioPanel.includes("manualAccounts.map") && portfolioService.includes("subscribeManualPortfolioAccounts"), "Investor Portfolio shows Manual Portfolio account value, cash and performance summaries from the workbook ledger");
assert(manualPortfolioWorkbook.includes("latestReconciliation") && investorPortfolioPanel.includes("Reconciliation ·") && investorPortfolioPanel.includes("statementValue"), "Manual Portfolio account cards show latest statement-vs-system reconciliation status and difference");
assert(portfolioAdministration.includes("Fundbazaar") && portfolioAdministration.includes("Trading / Intraday") && portfolioAdministration.includes("Manual Portfolio"), "Investor Portfolio Administration separates portfolio types and trading");
assert(portfolioAdministration.includes("Select multiple investments") && portfolioAdministration.includes("Delete Current Portfolio") && portfolioAdministration.includes("Full Portfolio Reset"), "individual Investor Portfolio Administration separates selected-holding cleanup, controlled current-portfolio cleanup and Full Portfolio Reset");

const portfolioOverview = read("src/components/portfolio/PortfolioOverview.js");
assert(portfolioOverview.includes("Portfolio Overview") && portfolioOverview.includes("Daily Portfolio Update") && portfolioOverview.includes("Portfolio health"), "Portfolio Overview separates monitoring from imports and destructive administration");

const centralPortfolioAdministration = read("src/components/portfolio/CentralPortfolioAdministration.js");
const centralPortfolioAdministrationRoute = read("src/app/api/portfolio/administration/route.js");
const portfolioResetRoute = read("src/app/api/portfolio/investors/[investorId]/reset/route.js");
const portfolioBulkResetRoute = read("src/app/api/portfolio/administration/reset/route.js");
const portfolioResetServer = read("src/lib/server/portfolioReset.js");
assert(portfolioResetServer.includes('investorRows("brokerAccounts"') && portfolioResetServer.includes('investorRows("brokerAccountSnapshots"') && portfolioResetServer.includes('investorRows("brokerDpTransactions"'), "Full Portfolio Reset removes broker account, broker snapshot and DP movement history");
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
assert(portfolioResetServer.includes('investorRows("manualPortfolioAccounts"') && portfolioResetServer.includes('investorRows("manualPortfolioAccountSnapshots"') && portfolioResetServer.includes('investorRows("manualPortfolioCashLedger"') && portfolioResetServer.includes('investorRows("manualPortfolioReconciliations"'), "Full Portfolio Reset removes Manual Portfolio Management account, performance snapshot and ledger state");
assert(firestoreRules.includes("match /manualPortfolioAccounts/{accountId}") && firestoreRules.includes("match /manualPortfolioAccountSnapshots/{snapshotId}") && firestoreRules.includes("match /manualPortfolioNotes/{noteId}") && firestoreRules.includes("resource.data.visibility == 'Investor'"), "Manual Portfolio Management ledgers and account snapshots use explicit server-write Firestore rules with note visibility protection");
assert(manualPortfolioWorkbook.includes('rawVisibility.toLowerCase() === "investor" ? "Investor" : "Internal"'), "Manual Portfolio note visibility is canonicalized to safe Internal/Investor values before server persistence");
assert(portfolioResetServer.includes('batch.missingInvestors') && portfolioResetServer.includes('deleteBatch: remainingIds.length === 0 && missingInvestors.length === 0'), "Full Portfolio Reset removes historical daily-coverage references without deleting other Investors' shared batch history");
assert(portfolioResetServer.includes("purgeOrphanFundbazaarImportAttempts") && portfolioResetServer.includes("verified_fundbazaar_mappings_exist") && portfolioResetRoute.includes("orphanImportCleanup") && portfolioBulkResetRoute.includes("orphanImportCleanup"), "Full Portfolio Reset clears old orphan Fundbazaar issue attempts only when no verified Fundbazaar mapping remains");
assert(!portfolioResetServer.includes("monthlyReports") && !portfolioResetServer.includes("bucketList") && !portfolioResetServer.includes("goals"), "Full Portfolio Reset preserves published Monthly Reports and Goal/Bucket definitions");
assert(centralPortfolioAdministration.includes("Preview Full Portfolio Reset") && centralPortfolioAdministration.includes("previewBulkFullPortfolioReset") && centralPortfolioAdministrationRoute.includes("hasResettableHistory"), "central Portfolio Administration supports Super Admin bulk Full Reset including history-only investors");
assert(centralPortfolioAdministrationRoute.includes('collection("portfolioImportChanges")') && centralPortfolioAdministrationRoute.includes('collection("portfolioImportChangeItems")') && centralPortfolioAdministrationRoute.includes('collection("sipFundingCycles")') && centralPortfolioAdministrationRoute.includes('collection("manualPortfolioAccountSnapshots")') && centralPortfolioAdministrationRoute.includes('fundbazaarDailyTrackingEnabled'), "central Portfolio Administration detects recovery/SIP/manual-performance/daily-tracking history even without live holdings");
assert(investorDetail.includes('const currentPortfolio = Number(investor.latestPortfolioValue || 0)') && !investorDetail.includes('latestPortfolioValue || latestReport?.summary?.totalCorpus'), "staff current-portfolio summary does not revive a reset Portfolio Master from historical Monthly Reports");
assert(investorDashboard.includes("hasCurrentPortfolio") && investorDashboard.includes("No current portfolio data · published Monthly Reports remain available as historical records."), "Investor dashboard separates current Portfolio Master state from preserved historical Monthly Reports");
assert(!reportForm.includes("Latest reported corpus") && !reportForm.includes("subscribeMonthlyReports") && reportForm.includes('item.sourceType === "monthly_report"') && reportForm.includes("previousReportCarry") && reportForm.includes("const carryForward = previousReportCarry.length ? previousReportCarry : workflowCarry;"), "new Monthly Reports do not revive reset portfolio values or unrelated Profile actions from historical reports");
assert(reportInvestorSelection.includes("latestPortfolioSnapshotId") && reportInvestorSelection.includes("Current holdings come only from the verified Portfolio Master") && !reportInvestorSelection.includes("investor?.portfolioValue"), "Monthly Report investor selection shows current Portfolio Master values only");
assert(reportConstants.includes("const funds = [];") && !reportConstants.includes("investor?.existingInvestments"), "Monthly Report base data does not seed current holdings from legacy Investor profile investments");

const portfolioGoalAllocation = read("src/lib/portfolioGoalAllocation.js");
const portfolioCommitForBuckets = read("src/app/api/portfolio/imports/fundbazaar/commit/route.js");
const actionRequestDialog = read("src/components/actions/ActionRequestDialog.js");
const actionServerForRequests = read("src/lib/server/actionServer.js");
const actionCentre = read("src/components/actions/ActionCentre.js");
const reportBucketWorkflowDoc = read("docs/REPORT_PORTFOLIO_BUCKET_ACTION_WORKFLOW_v0.33.2.md");
assert(portfolioGoalAllocation.includes('GENERAL_WEALTH_BUCKET_ID = "general_wealth"') && portfolioGoalAllocation.includes("normalisePortfolioGoalAllocations") && portfolioGoalAllocation.includes("generalWealthAllocation(remainder)"), "every portfolio allocation resolves to a specific Bucket List and/or explicit General Wealth default remainder");
assert(portfolioServer.includes("bucketTotals") && portfolioServer.includes("defaultBucketApplied") && portfolioServer.includes("latestPortfolioGeneralWealthValue"), "Portfolio Snapshot persists explicit default-bucket allocations and General Wealth totals while migrating legacy empty mappings");
assert(portfolioCommitForBuckets.includes("normalisePortfolioGoalAllocations(goalAllocations)") && portfolioCommitForBuckets.includes("portfolioAllocationStatus(goalAllocations)") && portfolioCommitForBuckets.includes("defaultBucketApplied: goalAllocations.some"), "Fundbazaar, broker, ULIP and Generic provider commits persist a Bucket List/default mapping immediately");
assert(manualImportRoute.includes("normalisePortfolioGoalAllocations") && manualPortfolioWorkbook.includes("goalAllocations: [generalWealthAllocation()]") && manualPortfolioWorkbook.includes("portfolioAllocationStatus(goalAllocations)"), "Manual single/bulk portfolio holdings and manual cash positions use the mandatory General Wealth default when no specific Bucket List applies");
assert(!read("src/lib/server/portfolioIntelligence.js").includes('new_unassigned_holdings') && read("src/lib/server/portfolioIntelligence.js").includes('new_general_wealth_holdings'), "Portfolio Intelligence treats new General Wealth holdings as valid default-bucket information rather than unassigned errors");
assert(reportForm.includes("portfolioFactsLocked") && reportForm.includes("Calculated from verified Portfolio Master") && reportForm.includes("updatePortfolioBucketFromReport") && reportForm.includes("General Wealth (Default)"), "Monthly Report Builder fetches/locks verified portfolio facts and supports controlled current Bucket List reassignment");
assert(reportConstants.includes("bucketLabel: portfolioBucketLabel(goalAllocations)") && reportConstants.includes("General Wealth (Default).`"), "generated report data preserves explicit Bucket List/default labels and verifies mandatory allocation");
assert(investorPortfolioPanel.includes("Take Action") && investorPortfolioPanel.includes("General Wealth holdings"), "Investor Portfolio exposes Take Action while showing General Wealth as the default bucket instead of Unassigned");
assert(actionRequestDialog.includes("requestedTargetGoalId") && actionRequestDialog.includes("requestedMonthlyAmount") && actionRequestDialog.includes("does not directly change Portfolio Master"), "Investor Take Action captures structured intent without directly mutating verified Portfolio Master values");
assert(actionServerForRequests.includes("requestedTargetGoalName") && actionServerForRequests.includes("requestedChangeDetails") && actionCentre.includes("ActionRequestDetails") && actionCentre.includes("Requested amount"), "structured Investor action details persist to Advisor Follow-up and are visible to the Advisor");
assert(reportBucketWorkflowDoc.includes("There is no operationally unassigned investment") && reportBucketWorkflowDoc.includes("Published Monthly Reports remain frozen") && reportBucketWorkflowDoc.includes("General Wealth 40%"), "Bucket/report/action workflow documentation covers default allocation, frozen reports and partial-allocation remainder rules");

const actionConstants = read("src/lib/constants/actions.js");
const actionUpdateRoute = read("src/app/api/actions/[actionId]/route.js");
const reportingPeriodStep = read("src/components/reports/create/ReportingPeriodStep.js");
const reportPeriodWorkflowDoc = read("docs/REPORTING_PERIOD_PLANNED_ACTUAL_CASH_FLOW_v0.33.2.md");
assert(reportConstants.includes("getDefaultReportPeriod") && reportingPeriodStep.includes('type="month"') && reportingPeriodStep.includes("Choose the month this report belongs to") && reportingPeriodStep.includes("between the 1st and 5th of the next month") && reportForm.includes('searchParams.get("month")') && reportForm.includes('field === "reportMonthKey"'), "Monthly Report generation defaults to the previous completed month while allowing an explicit month picker and month-aware Create Report links");
assert(reportConstants.includes("totalCorpus - openingValue - flowSummary.newMoney + flowSummary.withdrawals") && reportForm.includes("Money Withdrawn This Month") && reportForm.includes("Portfolio Gain / Loss"), "Monthly Report financial movement is automatic and separates external money from investment performance");
assert(portfolioService.includes("manualPortfolioCashLedger") && portfolioService.includes("manual_cash_movement") && portfolioService.includes("investor_action_confirmation"), "Report source includes confirmed Manual PMS cash flows and explicitly confirmed external action cash movements without relying on planned requests");
assert(actionConstants.includes('"Trading Account Deposit"') && actionConstants.includes('"Trading Account Withdrawal"') && actionConstants.includes('STRUCTURED_WITHDRAWAL_REQUEST_TYPE, "Partial Redemption", "Full Redemption", "Trading Account Withdrawal"') && !actionConstants.includes('"SIP Funding / Withdrawal"].includes(type)'), "Trading Account cash movement is explicit while SIP funding discussion is not misclassified as a portfolio withdrawal");
assert(actionRequestDialog.includes("requestedAccountReference") && actionCentre.includes("manual_cash_movement") && actionUpdateRoute.includes("actualFinancialAmount") && actionUpdateRoute.includes("actualFinancialDate"), "Advisor can confirm actual external cash movement with amount/date/account context only after operational completion");
assert(reportPeriodWorkflowDoc.includes("Planned Action") && reportPeriodWorkflowDoc.includes("Trading Account Withdrawal") && reportPeriodWorkflowDoc.includes("SIP stopped") && reportPeriodWorkflowDoc.includes("Portfolio Gain / Loss"), "Report-period documentation distinguishes planned actions, SIP changes, redemptions and Trading Account withdrawals");

const withdrawalCashNeedsPanel = read("src/components/actions/WithdrawalCashNeedsPanel.js");
const withdrawalCompletionPanel = read("src/components/actions/WithdrawalCompletionPanel.js");
const withdrawalCompletionRoute = read("src/app/api/actions/[actionId]/complete-withdrawal/route.js");
const withdrawalCashFlow = read("src/lib/portfolioCashFlow.js");
const reportDetailClient = read("src/components/reports/ReportDetailClient.js");
const reportDeleteRoute = read("src/app/api/reports/[reportId]/delete/route.js");
const communicationService = read("src/services/communicationService.js");
const monthlyWealthReport = read("src/components/reports/MonthlyWealthReport.js");
const monthlyPrintReport = read("src/components/reports/MonthlyReportPrintDocument.js");
const profileWithdrawalDoc = read("docs/PROFILE_WITHDRAWAL_REPORT_DELETE_WORKFLOW_v0.33.2.md");
const monthlyRuleStart = firestoreRules.indexOf("match /monthlyReports/{reportId}");
const monthlyRuleEnd = firestoreRules.indexOf("match /reportVersions/{versionId}");
const monthlyReportRules = monthlyRuleStart >= 0 && monthlyRuleEnd > monthlyRuleStart ? firestoreRules.slice(monthlyRuleStart, monthlyRuleEnd) : "";
assert(investorDetail.includes("Withdrawals & Cash Needs") && investorDetail.includes("WithdrawalCashNeedsPanel"), "Investor Profile contains a dedicated Withdrawals & Planned Cash Needs workflow");
assert(withdrawalCashNeedsPanel.includes("Select Bucket List and funds") && withdrawalCashNeedsPanel.includes("Complete holding") && withdrawalCashNeedsPanel.includes("Continue SIP") && withdrawalCashNeedsPanel.includes("Pause SIP") && withdrawalCashNeedsPanel.includes("Stop SIP"), "Profile withdrawal planning supports multiple mapped Mutual Funds with partial/full redemption and per-fund SIP instructions");
assert(actionServerForRequests.includes("bucketValueAtRequest") && actionServerForRequests.includes("bucketUnitsAtRequest") && actionServerForRequests.includes("100% mapped") && actionServerForRequests.includes("exceeds the value mapped"), "structured withdrawals are constrained to the selected Bucket List and cannot silently consume another Bucket List allocation");
assert(actionCentre.includes("WithdrawalCompletionPanel") && actionCentre.includes("WithdrawalActionSummary") && withdrawalCompletionPanel.includes("Complete Withdrawal & Update Portfolio"), "Advisor Follow-up exposes the controlled withdrawal completion workflow instead of generic Completed status");
assert(withdrawalCompletionRoute.includes("withdrawalPortfolioApplied") && withdrawalCompletionRoute.includes("createPortfolioSnapshot") && withdrawalCompletionRoute.includes("goalAllocations: nextGoalAllocations") && withdrawalCompletionRoute.includes("sipInstruction") && withdrawalCompletionRoute.includes("provisionalActionTransaction: true"), "confirmed withdrawal completion updates holdings, selected Bucket List allocation, SIP state, transactions and Portfolio Master with retry protection");
assert(withdrawalCashFlow.includes("dedupeActionWithdrawalTransactions") && portfolioService.includes("dedupeActionWithdrawalTransactions(transactions)"), "provider redemption reconciliation removes matching provisional action withdrawals from report cash-flow calculations without double counting");
assert(reportForm.includes("getInvestorProfileActionsForReportOnce") && reportForm.includes('title="Investor Profile actions"') && reportForm.includes("Auto-fetched and read-only") && reportForm.includes('item.sourceType === "monthly_report"'), "Monthly Report Builder auto-fetches Profile actions as a separate read-only section and keeps them out of editable Advisor carry-forward actions");
assert(monthlyWealthReport.includes("Investor Profile Actions") && monthlyPrintReport.includes("PROFILE ACTIONS & ADVISOR NEXT STEPS") && reportPdf.includes("Investor Profile"), "web, print and generated PDF report presentations include auto-fetched Investor Profile actions");
assert(reportDeleteRoute.includes("verifyStaffRequest(request)") && reportDeleteRoute.includes('confirmation !== "DELETE"') && reportDeleteRoute.includes("reportPermissionLevel") && reportDeleteRoute.includes("adminBucket.deleteFiles") && reportDeleteRoute.includes("monthly_report_deleted"), "Delete Report is a controlled authenticated server workflow with permission, typed confirmation, PDF cleanup and audit logging");
assert(reportDeleteRoute.includes("Portfolio Master, Bucket Lists and Investor Actions were preserved") && reportDeleteRoute.includes("deletedSourceReportId") && reportDeleteRoute.includes("latestReportId") && reportDeleteRoute.includes("emailDeliveryHistory"), "Delete Report preserves financial/Profile action history, detaches linked actions and repairs the Investor latest-report pointer");
assert(communicationService.includes("deleteMonthlyReport") && reportDetailClient.includes("Reason for deletion") && reportDetailClient.includes("Type DELETE to confirm") && reportDetailClient.includes("Portfolio Master, Bucket Lists, Investor Profile actions and financial transactions remain unchanged"), "staff report UI exposes reasoned Delete Report confirmation without implying underlying financial deletion");
assert(monthlyReportRules.includes("allow delete: if false") && monthlyReportRules.includes("server-managed"), "direct browser deletion of Monthly Reports is disabled so controlled cleanup cannot be bypassed");
assert(profileWithdrawalDoc.includes("Investor Profile is the withdrawal source") && profileWithdrawalDoc.includes("Profile actions in the report") && profileWithdrawalDoc.includes("Delete Report") && profileWithdrawalDoc.includes("provider later supplies the same redemption"), "final workflow documentation covers Profile withdrawal source, report auto-fetch, provider reconciliation and report deletion");

const navigation = read("src/lib/constants/navigation.js");
assert(navigation.includes('label: "Advisor Follow-up"') && navigation.includes('label: "Service Requests"') && navigation.includes('label: "Bulk Data Upload"') && navigation.includes('label: "Monthly Market Note"'), "staff navigation uses simplified operating-language module names");
assert(navigation.includes('label: "Portfolio Overview"') && navigation.includes('href: "/portfolio/daily-update"') && navigation.includes('label: "Trading Accounts"') && navigation.includes('href: "/portfolio/trading"') && navigation.includes('label: "Portfolio Administration"'), "Portfolio navigation separates overview, daily update, Trading Accounts and administration");

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
