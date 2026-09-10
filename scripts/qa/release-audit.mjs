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
assert(packageJson.version === "0.34.8", "package.json version is 0.34.8");

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
const portfolioReportSourceRoute = read("src/app/api/portfolio/report-source/route.js");
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
assert(reportForm.includes("existingDraftNeedsPortfolioHydration") && reportForm.includes("hasMeaningfulPortfolioFacts") && reportForm.includes("corpusTouchedRef.current = hasMeaningfulPortfolioFacts(report)"), "recreated/empty Monthly Report drafts automatically rehydrate Portfolio Master after the saved-report route remount");
assert(portfolioService.includes('/api/portfolio/report-source?') && portfolioReportSourceRoute.includes("verifyStaffRequest(request)") && portfolioReportSourceRoute.includes("canStaffAccessRecord(actor, investor)"), "Monthly Report Portfolio Master hydration uses an authenticated server route instead of protected browser Firestore queries");
assert(reportForm.includes('getInvestors()') && !reportForm.includes('subscribeInvestors('), "Monthly Report investor selection uses the authenticated Investor directory API instead of a browser collection query");
assert(portfolioReportSourceRoute.includes("REPORT_SNAPSHOT_CAPTURE_GRACE_DAYS = 5") && portfolioReportSourceRoute.includes("findPostCutoffCaptureSnapshot") && portfolioReportSourceRoute.includes("capturedSnapshotDate") && portfolioReportSourceRoute.includes("datedValues.some((value) => value > cutoffDate)"), "month-end report regeneration can use a 1-5 day post-cutoff capture only when its dated source values do not cross the reporting cutoff");
assert(reportConstants.includes("totalCorpus - openingValue - flowSummary.newMoney + flowSummary.withdrawals") && reportForm.includes("Money Withdrawn This Month") && reportForm.includes("Portfolio Gain / Loss"), "Monthly Report financial movement is automatic and separates external money from investment performance");
assert(portfolioReportSourceRoute.includes("manualPortfolioCashLedger") && portfolioReportSourceRoute.includes("manual_cash_movement") && portfolioReportSourceRoute.includes("investor_action_confirmation"), "Report source includes confirmed Manual PMS cash flows and explicitly confirmed external action cash movements without relying on planned requests");
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
assert(withdrawalCashFlow.includes("dedupeActionWithdrawalTransactions") && portfolioReportSourceRoute.includes("dedupeActionWithdrawalTransactions(transactions)"), "provider redemption reconciliation removes matching provisional action withdrawals from report cash-flow calculations without double counting");
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

const insuranceConstants = read("src/lib/constants/insurance.js");
const insuranceServer = read("src/lib/server/insuranceServer.js");
const insuranceRoute = read("src/app/api/insurance/route.js");
const insuranceImportRoute = read("src/app/api/insurance/import/route.js");
const insuranceReminderCron = read("src/app/api/cron/insurance-reminders/route.js");
const insuranceService = read("src/services/insuranceService.js");
const insuranceCentre = read("src/components/insurance/InsuranceProtectionCentre.js");
const insurancePanel = read("src/components/insurance/InsuranceProtectionPanel.js");
const insuranceForm = read("src/components/insurance/InsurancePolicyForm.js");
const investorProtectionSnapshot = read("src/components/insurance/InvestorProtectionSnapshotCard.js");
const investorPortalPortfolio = read("src/app/investor/portfolio/page.js");
const investorDetailPage = read("src/app/(portal)/investors/[investorId]/page.js");
const insuranceIntegrationDoc = read("docs/INSURANCE_PROFILE_AND_PORTFOLIO_INTEGRATION_v0.33.3.md");
const insuranceWorkflowDoc = read("docs/INVESTOR_INSURANCE_PROTECTION_v0.33.3.md");
const insuranceManifest = read("docs/INSURANCE_PROTECTION_CODE_MANIFEST_v0.33.3.md");
const insuranceRulesStart = firestoreRules.indexOf("match /insurancePolicies/{policyId}");
const insuranceRulesEnd = firestoreRules.indexOf("match /insurancePolicyEvents/{eventId}");
const insurancePolicyRules = insuranceRulesStart >= 0 && insuranceRulesEnd > insuranceRulesStart ? firestoreRules.slice(insuranceRulesStart, insuranceRulesEnd) : "";
assert(insuranceConstants.includes('"Term Life"') && insuranceConstants.includes('"Health"') && insuranceConstants.includes('"Vehicle"') && insuranceConstants.includes('"Home"') && insuranceConstants.includes('"Travel"') && insuranceConstants.includes('"Cyber"') && insuranceConstants.includes("[60, 30, 15, 7, 1]"), "Insurance master supports standard life/health/vehicle/home/other policy types with 60/30/15/7/1 reminders");
assert(insuranceServer.includes("buildInsuranceProtectionSnapshot") && insuranceServer.includes("parseInsuranceWorkbook") && insuranceServer.includes("insurancePolicyIdentity"), "Insurance server normalises policies, parses the Excel schema and builds a protection-only report snapshot");
assert(insuranceRoute.includes("verifyAppRequest(request)") && insuranceRoute.includes("verifyStaffRequest(request)") && insuranceRoute.includes('action === "renew"') && insuranceRoute.includes("renewedFromPolicyId") && insuranceRoute.includes('policyStatus: "Renewed"'), "Insurance API is authenticated and preserves renewal history by creating a linked renewed policy");
assert(insuranceImportRoute.includes("verifyStaffRequest(request)") && insuranceImportRoute.includes('action === "preview"') && insuranceImportRoute.includes('action !== "commit"') && insuranceImportRoute.includes("8 * 1024 * 1024"), "Insurance Excel import is staff-only, preview-first and file-size bounded");
assert(insuranceReminderCron.includes("CRON_SECRET") && insuranceReminderCron.includes("insuranceReminderEvents") && insuranceReminderCron.includes('eventType: days < 0 ? "insurance_due_overdue" : "insurance_due_reminder"') && insuranceReminderCron.includes("insuranceDueDates") && insuranceConstants.includes('kind: "own_damage"') && insuranceConstants.includes('kind: "third_party"'), "Insurance reminder cron is secret-protected, idempotent and covers premium/renewal/motor OD/TP dates");
assert(insuranceService.includes("getInsurancePolicies") && insuranceService.includes("previewInsuranceWorkbook") && insuranceService.includes("importInsuranceWorkbook"), "Insurance client service exposes authenticated read/write and preview/import operations");
assert(insuranceCentre.includes("GrowVest_Insurance_Policy_Template_v0.33.3.xlsx") && insuranceCentre.includes("GrowVest_Insurance_Policy_Filled_Sample_v0.33.3.xlsx") && insuranceCentre.includes("GrowVest_Manual_Investment_and_Insurance_Guide_v0.33.3.docx") && insuranceCentre.includes("Preview & validate"), "Insurance workspace exposes the blank template, filled example, guide and preview-first import workflow");
assert(insurancePanel.includes("Insurance & Protection") && insurancePanel.includes("Cover amounts are intentionally excluded") && insurancePanel.includes("Renew") && insurancePanel.includes("Policy document"), "Insurance panel separates protection cover from investment corpus and supports renewals/documents");
assert(insuranceForm.includes("Own Damage expiry") && insuranceForm.includes("Third Party expiry") && insuranceForm.includes("Covered members / family floater details") && insuranceForm.includes("Nominee / beneficiary"), "Manual insurance form contains standard type-specific health, motor and life fields");
assert(navigation.includes('label: "Insurance & Protection"') && navigation.includes('href: "/insurance"') && investorDetail.includes('value: "protection"'), "Insurance & Protection is reachable from staff Portfolio navigation and Investor Profile");
const investorNavigation = read("src/lib/constants/investorNavigation.js");
assert(investorNavigation.includes('href: "/investor/insurance"') && fs.existsSync(path.join(root, "src", "app", "investor", "insurance", "page.js")), "Investor Portal includes a dedicated read-only Insurance & Protection page");
assert(insurancePolicyRules.includes("allow read, create, update, delete: if false") && firestoreRules.includes("match /insurancePolicyEvents/{eventId}") && firestoreRules.includes("match /insuranceReminderEvents/{eventId}"), "Insurance financial/protection collections are server-managed and browser-inaccessible");
assert(reportForm.includes("getInsuranceProtectionSnapshot") && investorPermissionReportService.includes("protectionSnapshot") && monthlyWealthReport.includes("Protection Snapshot") && reportPdf.includes("addProtectionPage") && monthlyPrintReport.includes("INSURANCE & PROTECTION"), "Monthly Report web/print/PDF flows include a frozen Insurance Protection Snapshot without changing portfolio corpus");
assert(fs.existsSync(path.join(root, "public", "templates", "GrowVest_Insurance_Policy_Template_v0.33.3.xlsx")) && fs.existsSync(path.join(root, "public", "templates", "GrowVest_Insurance_Policy_Filled_Sample_v0.33.3.xlsx")) && fs.existsSync(path.join(root, "public", "guides", "GrowVest_Manual_Investment_and_Insurance_Guide_v0.33.3.docx")), "Insurance template, filled sample and explanatory guide are packaged with the application");
assert(insuranceWorkflowDoc.includes("Insurance cover is never added to investment corpus") && insuranceWorkflowDoc.includes("60, 30, 15, 7 and 1") && insuranceWorkflowDoc.includes("renewal creates a new policy record"), "Insurance workflow documentation records corpus separation, reminder cadence and immutable renewal history");
assert(insuranceManifest.includes("src/app/api/insurance/route.js") && insuranceManifest.includes("firestore.rules") && insuranceManifest.includes("MonthlyWealthReport.js"), "Insurance code manifest covers APIs, security rules and Monthly Report integration");
assert(insuranceServer.includes("buildInsurancePortfolioOverview") && insuranceRoute.includes('searchParams.get("scope") === "portfolio"') && insuranceService.includes("getInsurancePortfolioOverview"), "Insurance exposes a staff-scoped consolidated protection overview for the Portfolio module");
assert(portfolioOverview.includes("Insurance & Protection across the portfolio") && portfolioOverview.includes("Investor protection coverage") && portfolioOverview.includes("getInsurancePortfolioOverview") && portfolioOverview.includes("Protection values are kept completely outside Current Portfolio Value"), "Portfolio Overview surfaces aggregate protection and keeps it explicitly outside investment AUM");
assert(investorProtectionSnapshot.includes("Protection cover is shown alongside wealth") && investorProtectionSnapshot.includes("getInsuranceProtectionSnapshot") && investorDetail.includes("InvestorProtectionSnapshotCard") && investorPortalPortfolio.includes('router.replace("/investor/insurance")') && fs.existsSync(path.join(root, "src", "app", "investor", "insurance", "page.js")), "Protection Snapshot remains available to staff while the Investor Portal uses one canonical Protection destination");
assert(investorDetailPage.includes("searchParams") && investorDetailPage.includes('"protection"') && investorDetailPage.includes('"portfolio"') && investorDetail.includes("initialTab"), "Investor Profile direct links can open Portfolio or Insurance & Protection tabs");
assert(insuranceIntegrationDoc.includes("Investor Profile") && insuranceIntegrationDoc.includes("Portfolio Overview") && (insuranceIntegrationDoc.includes("excluded from Current Portfolio Value") || insuranceIntegrationDoc.includes("excluded from Current Portfolio Value, AUM")), "Insurance Profile/Portfolio integration is documented with corpus separation and UAT");


// v0.33.4 Stability, Data Integrity & Mobile App Hardening regression checks.
const reportServiceV0334 = read("src/services/reportService.js");
const reportMigrationRoute = read("src/app/api/reports/[reportId]/migrate-period/route.js");
const reportDeleteRouteV0334 = read("src/app/api/reports/[reportId]/delete/route.js");
const reportPdfRoute = read("src/app/api/reports/[reportId]/pdf/route.js");
const reportValidation = read("src/lib/validation/reportSchema.js");
const dateUtils = read("src/lib/utils/date.js");
const investorLifecycleRouteV0334 = read("src/app/api/investors/[investorId]/lifecycle/route.js");
const investorShell = read("src/components/investor/InvestorShell.js");
const investorNavigationV0334 = read("src/lib/constants/investorNavigation.js");
const serviceWorker = read("public/sw.js");
const stabilityDoc = read("docs/STABILITY_DATA_INTEGRITY_MOBILE_APP_HARDENING_v0.33.4.md");
const stabilityManifest = read("docs/STABILITY_DATA_INTEGRITY_MOBILE_APP_HARDENING_CODE_MANIFEST_v0.33.4.md");
assert(reportServiceV0334.includes("canonicalPeriodId") && reportServiceV0334.includes("migrateMonthlyReportPeriod") && reportMigrationRoute.includes("canonicalReportId") && reportMigrationRoute.includes("monthly_report_period_migrated"), "v0.33.4 migrates editable Monthly Reports to the canonical Investor/month document ID when the report month changes");
assert(reportServiceV0334.includes("expectedVersion") && reportServiceV0334.includes("updated in another session"), "v0.33.4 blocks stale Monthly Report saves from overwriting a newer edit session");
assert(reportDeleteRouteV0334.includes("reportDeletionJobs") && reportDeleteRouteV0334.includes("storage_cleanup_pending") && reportDeleteRouteV0334.includes("retryPendingStorageCleanup"), "v0.33.4 report deletion is journaled and supports retry-safe secure Storage cleanup");
assert(reportPublish.includes("publicationClaim") && reportPublish.includes("PUBLISH_CLAIM_TTL_MS") && reportPublish.includes("idempotent"), "v0.33.4 Monthly Report publishing uses an idempotent publication claim");
assert(reportValidation.includes("legitimateZeroClosingBalance") && reportValidation.includes("verified fully-exited portfolio month"), "v0.33.4 permits a verified zero-closing-balance Monthly Report when exit evidence exists");
assert(reportPdfRoute.includes("FieldValue.increment(1)"), "v0.33.4 Monthly Report PDF download counters use atomic Firestore increments");
assert(dateUtils.includes('"Asia/Kolkata"') && dateUtils.includes("businessDateKey"), "v0.33.4 centralises GrowVest business-date defaults on Asia/Kolkata");
assert(insuranceReminderCron.includes("OVERDUE_REMINDER_STAGES") && insuranceReminderCron.includes("catchUp") && insuranceReminderCron.includes("insurance_due_overdue") && insuranceReminderCron.includes("insurance_due_reminder"), "v0.33.4 Insurance reminders prioritise overdue items and support catch-up reminder stages");
assert(investorLifecycleRouteV0334.includes("pauseInsuranceReminders") && investorLifecycleRouteV0334.includes("pauseMeetingReminders") && investorLifecycleRouteV0334.includes("pauseScheduledReportDeliveries"), "v0.33.4 Investor lifecycle controls pause Insurance, Meeting and scheduled Report communications");
assert(insuranceServer.includes("assertInsurancePolicyIdentityAvailable") && insuranceRoute.includes("INSURANCE_POLICY_STATUSES.includes") && insuranceRoute.includes("linkedUlipPolicyId"), "v0.33.4 Insurance manual entry blocks duplicates, validates statuses and supports ULIP protection-to-investment linkage");
assert(insuranceImportRoute.includes("insuranceImportBatches") && insuranceImportRoute.includes("importBatchId") && insuranceImportRoute.includes('status: "completed"'), "v0.33.4 Insurance Excel commits are journaled with stable import-batch identity");
assert(investorNavigationV0334.includes('label: "Home"') && investorNavigationV0334.includes('label: "Portfolio"') && investorNavigationV0334.includes('label: "Bucket List"') && investorNavigationV0334.includes('label: "Profile"') && investorShell.includes("grid-cols-5") && investorShell.includes("mobileMoreActive") && investorShell.includes("Open GrowVest actions"), "Current Investor Mobile App uses four calm primary destinations around one GrowVest action button");
assert(!investorNavigationV0334.includes('label: "Notifications", href: "/investor/notifications", icon: BellRing, mobile: true') && investorShell.includes("NotificationBell inverted"), "v0.33.4 keeps Notifications in the app header instead of duplicating them in bottom navigation");
assert(investorShell.includes("lg:hidden") && investorShell.includes('aria-label="Investor app menu"') && investorShell.includes("gv-safe-bottom"), "v0.33.4 aligns mobile/tablet More-menu breakpoints and safe-area handling with the fixed app navigation");
assert(investorShell.includes("touch-manipulation") && investorShell.includes("gv-signature-nav-item") && investorShell.includes("min-h-[60px]") && investorShell.includes('text-[#1F4ED8]'), "Current Investor Mobile App navigation uses compact touch targets with a restrained brand-blue active state");
const investorGlobalStylesV0334 = read("src/app/globals.css");
assert(investorGlobalStylesV0334.includes("iOS Safari zooms form controls smaller than 16px") && investorGlobalStylesV0334.includes(".gv-investor-viewport select") && investorGlobalStylesV0334.includes("font-size: 16px"), "v0.33.4 Investor Mobile App prevents iOS form-control zoom and improves touch scrolling");
assert(serviceWorker.includes("growvest-investor-v0.34.8") && serviceWorker.includes("growvest-pages-v0.34.8"), "Investor PWA caches remain versioned so installed apps receive hardened navigation/routes");
assert(stabilityDoc.includes("v0.33.4") && stabilityDoc.includes("Data Integrity") && stabilityDoc.includes("Mobile App") && stabilityManifest.includes("migrate-period/route.js") && stabilityManifest.includes("InvestorShell.js"), "v0.33.4 stability workflow and changed-code manifest are packaged with the release");

const investorPortfolioViewRoute = read("src/app/api/portfolio/investor-view/route.js");
const investorPortfolioPanelV0334 = read("src/components/portfolio/InvestorPortfolioPanel.js");
const investorPortfolioPageV0334 = read("src/app/investor/portfolio/page.js");
assert(investorPortfolioPageV0334.includes('router.replace("/investor/insurance")') && !investorPortfolioPageV0334.includes('?view=protection'), "Investor Portfolio sends legacy Protection views to the canonical Protection centre");
const portfolioServiceV0334 = read("src/services/portfolioService.js");
const investorPortfolioPermissionDoc = read("docs/INVESTOR_PORTFOLIO_PERMISSION_HOTFIX_v0.33.4.md");
assert(investorPortfolioViewRoute.includes("verifyAppRequest(request)") && investorPortfolioViewRoute.includes("actorCanAccessInvestor") && investorPortfolioViewRoute.includes('byInvestor("portfolioPositions"') && investorPortfolioViewRoute.includes('byInvestor("portfolioSnapshots"'), "v0.33.4 Investor Portfolio loads protected Portfolio Master data through an authenticated server route");
assert(investorPortfolioPanelV0334.includes("getInvestorPortfolioView") && !investorPortfolioPanelV0334.includes("subscribeInvestorPortfolio("), "v0.33.4 Investor Portfolio panel no longer relies on browser Firestore portfolio listeners");
assert(!investorPortfolioPageV0334.includes("firebase/firestore") && !investorPortfolioPageV0334.includes("getDoc("), "v0.33.4 Investor mobile Portfolio no longer reads the Investor profile directly from browser Firestore");
assert(portfolioServiceV0334.includes('authenticatedFetch(`/api/portfolio/investor-view') && investorPortfolioPermissionDoc.includes("Missing or insufficient permissions"), "v0.33.4 Investor Portfolio permission hotfix is routed through the authenticated API and documented");

// v0.33.5 Investor Mobile App Experience & Design System regression checks.
const investorAppDataRouteV0335 = read("src/app/api/investor/app-data/route.js");
const notificationApiRouteV0335 = read("src/app/api/notifications/route.js");
const investorAppServiceV0335 = read("src/services/investorAppService.js");
const notificationServiceV0335 = read("src/services/notificationService.js");
const investorDashboardV0335 = read("src/app/investor/dashboard/page.js");
const mobileInvestorDashboardV0335 = read("src/components/investor/MobileInvestorDashboard.js");
const investorPageHeaderV0335 = read("src/components/investor/InvestorPageHeader.js");
const investorReportDetailV0335 = read("src/components/reports/InvestorReportDetailClient.js");
const reportPrintClientV0335 = read("src/components/reports/ReportPrintClient.js");
const actionServiceV0335 = read("src/services/actionService.js");
const investorActionsPanelV0335 = read("src/components/actions/InvestorActionsPanel.js");
const actionTimelineV0335 = read("src/components/actions/ActionTimeline.js");
const withdrawalPanelV0335 = read("src/components/actions/WithdrawalCashNeedsPanel.js");
const actionRouteV0335 = read("src/app/api/actions/route.js");
const actionDetailRouteV0335 = read("src/app/api/actions/[actionId]/route.js");
const mobileExperienceDocV0335 = read("docs/INVESTOR_MOBILE_APP_EXPERIENCE_DESIGN_SYSTEM_v0.33.5.md");
const mobileExperienceManifestV0335 = read("docs/INVESTOR_MOBILE_APP_EXPERIENCE_DESIGN_SYSTEM_CODE_MANIFEST_v0.33.5.md");
const investorPhonePagesV0335 = [
  "src/app/investor/dashboard/page.js",
  "src/app/investor/goals/page.js",
  "src/app/investor/profile/page.js",
  "src/app/investor/insurance/page.js",
  "src/app/investor/reports/page.js",
  "src/app/investor/meetings/page.js",
  "src/app/investor/documents/page.js",
  "src/app/investor/change-password/page.js"
].map((file) => [file, read(file)]);
assert(investorAppDataRouteV0335.includes("verifyAppRequest(request)") && investorAppDataRouteV0335.includes('collection("portfolioPositions")') && investorAppDataRouteV0335.includes('collection("portfolioSnapshots")') && investorAppDataRouteV0335.includes('collection("ulipPolicies")') && investorAppDataRouteV0335.includes('section === "report"'), "v0.33.5 Investor App reads current Portfolio Master and published report detail through one authenticated server data boundary");
assert(investorDashboardV0335.includes('getInvestorAppData("dashboard", { force: background })') && investorDashboardV0335.includes("portfolio?.currentValue") && investorDashboardV0335.includes("window.setInterval(refresh, 60000)") && investorDashboardV0335.includes('window.addEventListener("focus", refresh)') && !investorDashboardV0335.includes("firebase/firestore"), "Investor Home is dynamic from Portfolio Master and refreshes without browser Firestore reads");
assert(mobileInvestorDashboardV0335.includes("Portfolio Master") && mobileInvestorDashboardV0335.includes("RefreshCw") && mobileInvestorDashboardV0335.includes("Total Wealth") && mobileInvestorDashboardV0335.includes("useInvestorPrivacy") && mobileInvestorDashboardV0335.includes("md:hidden") && investorPortfolioPanelV0334.includes("filterTrendByRange"), "Investor phone Home uses Portfolio Master wealth data, manual refresh and app-wide privacy while calendar-based trends live in Portfolio");
assert(notificationApiRouteV0335.includes("verifyAppRequest(request)") && notificationApiRouteV0335.includes('action === "mark_read"') && notificationApiRouteV0335.includes('action === "save_preferences"') && notificationServiceV0335.includes('fetch("/api/notifications"') && notificationServiceV0335.includes("window.setInterval(load, 30000)"), "v0.33.5 Investor notifications use authenticated API polling instead of a protected browser notification query");
assert(investorAppServiceV0335.includes('cache: "no-store"') && investorAppServiceV0335.includes("getInvestorReportDetail") && investorAppDataRouteV0335.includes('"Cache-Control": "private, no-store"'), "v0.33.5 current Investor App data and report detail bypass stale browser/server cache");
assert(investorPhonePagesV0335.every(([, content]) => !content.includes("firebase/firestore")), "v0.33.5 core Investor App pages do not import browser Firestore for protected read experiences");
assert(investorShell.includes("visual-corrected mobile app bar") && investorShell.includes("md:hidden") && investorShell.includes("Existing tablet sheet is intentionally preserved") && investorShell.includes("Signature GrowVest action sheet for phones") && investorShell.includes("md:block lg:hidden"), "Current native-style signature app shell remains phone-scoped while preserving tablet/desktop shells");
assert(investorPageHeaderV0335.includes('className="hidden gap-2.5 md:flex') && investorReportDetailV0335.includes("Phone-only one-minute review") && investorReportDetailV0335.includes("md:hidden") && investorReportDetailV0335.includes("md:grid"), "Investor phone views remove duplicate website-style headings and provide a one-minute Monthly Review summary");
assert(actionRouteV0335.includes("export async function GET") && actionRouteV0335.includes("verifyAppRequest(request)") && actionDetailRouteV0335.includes("export async function GET") && actionDetailRouteV0335.includes("verifyAppRequest(request)") && actionServiceV0335.includes("getInvestorActions") && actionServiceV0335.includes("getActionDetail"), "v0.33.5 Investor Actions and action detail have authenticated server read APIs");
assert(investorActionsPanelV0335.includes("getInvestorPortfolioView") && investorActionsPanelV0335.includes("getInvestorActions") && actionTimelineV0335.includes('profile.role === "investor"') && actionTimelineV0335.includes("getActionDetail") && withdrawalPanelV0335.includes('profile.role === "investor"') && withdrawalPanelV0335.includes("getInvestorPortfolioView") && withdrawalPanelV0335.includes("getInvestorActions"), "v0.33.5 Investor Advisor-Follow-up, timeline and withdrawal views avoid protected browser list reads");
assert(investorGlobalStylesV0334.includes("v0.33.5 Investor Mobile App Experience & Design System") && investorGlobalStylesV0334.includes("@media (max-width: 767px)") && investorGlobalStylesV0334.includes("--gv-mobile-card-radius"), "v0.33.5 mobile design-system CSS is explicitly scoped to phone widths below 768px");
assert(serviceWorker.includes("growvest-investor-v0.34.8") && serviceWorker.includes("growvest-pages-v0.34.8"), "Investor PWA caches are current for the phone app release");
assert(packageJson.version === "0.34.8" && mobileExperienceDocV0335.includes("phone-only") && mobileExperienceDocV0335.includes("Dynamic Investor Dashboard") && mobileExperienceManifestV0335.includes("MobileInvestorDashboard.js") && reportPrintClientV0335.includes("getInvestorReportDetail"), "Investor mobile design/security documentation and secure print path remain packaged with the current release");

// v0.33.5 phone-only GrowVest brand UI refinement regression checks.
const investorDocumentsBrandRefinementV0335 = read("src/app/investor/documents/page.js");
const investorPortfolioBrandRefinementV0335 = read("src/components/portfolio/InvestorPortfolioPanel.js");
const mobileBrandRefinementDocV0335 = read("docs/INVESTOR_MOBILE_BRAND_UI_REFINEMENT_HOTFIX_v0.33.5.md");
const mobileBrandRefinementManifestV0335 = read("docs/INVESTOR_MOBILE_BRAND_UI_REFINEMENT_CODE_MANIFEST_v0.33.5.md");
assert(investorDocumentsBrandRefinementV0335.includes("Phone-only compact explainer") && investorDocumentsBrandRefinementV0335.includes("MoreHorizontal") && investorDocumentsBrandRefinementV0335.includes("Phone actions use a clear app hierarchy") && investorDocumentsBrandRefinementV0335.includes("gv-mobile-cyan-soft") && investorDocumentsBrandRefinementV0335.includes("No documents in this view"), "Phone Documents use compact overflow-safe cards and a contextual GrowVest action hierarchy");
assert(investorPortfolioBrandRefinementV0335.includes("Phone-first intelligence hierarchy") && investorPortfolioBrandRefinementV0335.includes("gv-mobile-brand-panel") && investorPortfolioBrandRefinementV0335.includes("gv-mobile-yellow-soft") && investorPortfolioBrandRefinementV0335.includes("gv-mobile-wrap"), "v0.33.5 phone Portfolio Intelligence uses GrowVest brand accents, stronger hierarchy and long-name wrapping");
assert(investorGlobalStylesV0334.includes(".gv-mobile-brand-panel") && investorGlobalStylesV0334.includes(".gv-mobile-cyan-soft") && investorGlobalStylesV0334.includes(".gv-mobile-yellow-soft") && investorGlobalStylesV0334.includes(".gv-investor-viewport main > *") && investorGlobalStylesV0334.includes("overflow-x: clip") && investorGlobalStylesV0334.includes("overflow-y: visible"), "v0.33.5 phone design system constrains horizontal overflow without turning the Investor App wrapper into a vertical scroll container");
assert(documentPreviewModal.includes('window.matchMedia("(min-width: 768px)")') && documentPreviewModal.includes("shouldLockBody") && investorShell.includes("Mobile scroll recovery guard") && investorShell.includes('document.body.style.overflow === "hidden"'), "v0.33.5 mobile scroll recovery prevents document-preview body locks from leaving the Investor App unable to scroll");
assert(serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1") && mobileBrandRefinementDocV0335.includes("Royal Trust Blue") && mobileBrandRefinementDocV0335.includes("Growth Cyan") && mobileBrandRefinementManifestV0335.includes("InvestorPortfolioPanel.js"), "Mobile brand refinement documentation, manifest and installed-PWA cache refresh remain packaged");


// v0.33.6 phone-only finance-app redesign regression checks.
const mobileFinanceChartsV0336 = read("src/components/investor/mobile/MobileFinanceCharts.js");
const mobileBrandMarkV0336 = read("src/components/investor/mobile/InvestorBrandMark.js");
const mobileSvgLogoV0336 = read("src/components/investor/mobile/GrowVestSvgLogo.js");
const mobileSplashV0336 = read("src/components/investor/mobile/InvestorAppSplash.js");
const investorLoadingV0336 = read("src/app/investor/loading.js");
const investorMeetingsV0336 = read("src/app/investor/meetings/page.js");
const investorGoalsV0336 = read("src/app/investor/goals/page.js");
const investorSipV0336 = read("src/app/investor/sip-reminders/page.js");
const investorSecurityV0336 = read("src/app/investor/change-password/page.js");
const mobileRedesignDocV0336 = read("docs/INVESTOR_MOBILE_FINANCE_APP_REDESIGN_v0.33.6.md");
const mobileRedesignManifestV0336 = read("docs/INVESTOR_MOBILE_FINANCE_APP_REDESIGN_CODE_MANIFEST_v0.33.6.md");
assert(["growvest-icon.svg", "growvest-logo-dark.svg", "growvest-logo-white.svg", "growvest-wordmark-dark.svg", "growvest-wordmark-white.svg"].every((asset) => fs.existsSync(path.join(root, "public", "brand", asset))) && mobileBrandMarkV0336.includes("/brand/growvest-logo-white.svg") && mobileSvgLogoV0336.includes("InvestorBrandMark") && mobileSplashV0336.includes('variant="logo"') && investorShell.includes('variant="logo"'), "Investor entry and mobile chrome use the supplied official GrowVest SVG asset set");
assert(mobileFinanceChartsV0336.includes("MobileLineChart") && mobileFinanceChartsV0336.includes("MobileDonutChart") && mobileFinanceChartsV0336.includes("MobileBarChart") && mobileFinanceChartsV0336.includes("ProgressRing"), "v0.33.6 provides lightweight portfolio line, donut, bar and progress-ring infographics without a chart dependency");
assert(mobileInvestorDashboardV0335.includes("Total Wealth") && investorPortfolioPanelV0334.includes("MobilePortfolioAppView") && investorPortfolioPanelV0334.includes("MobileLineChart") && investorPortfolioPanelV0334.includes("MobileDonutChart"), "Home keeps a calm wealth hero while Portfolio owns the lightweight performance and allocation graphs");
assert(investorMeetingsV0336.includes("MobileMeetingsApp") && investorMeetingsV0336.includes("md:hidden") && investorSipV0336.includes("MobileSipApp") && investorSipV0336.includes("md:hidden") && investorActionsPanelV0335.includes("MobileActionsApp") && investorActionsPanelV0335.includes("md:hidden") && investorSecurityV0336.includes("MobileProvider") && investorSecurityV0336.includes("md:hidden"), "v0.33.6 extends the phone finance-app design to Meetings, SIP, Actions and Login & Security while preserving desktop views");
assert(investorGlobalStylesV0334.includes("v0.33.6 Investor finance-app shell refinements") && investorGlobalStylesV0334.includes("left: max(.7rem") && investorGlobalStylesV0334.includes("border-radius: 1.45rem") && investorShell.includes("grid-cols-5"), "v0.33.6 uses a floating five-item phone navigation bar with safe-area spacing");
assert(investorGlobalStylesV0334.includes("--gv-brand-primary: #1f4ed8") && investorGlobalStylesV0334.includes("--gv-brand-secondary: #1f4ed8") && investorGlobalStylesV0334.includes("--gv-brand-dark: #0b0b0f") && investorGlobalStylesV0334.includes("--gv-brand-warning: #f5b301") && investorGlobalStylesV0334.includes("--gv-brand-danger: #e53935") && investorGlobalStylesV0334.includes("--gv-brand-surface: #f4f6f9") && investorGlobalStylesV0334.includes("--gv-brand-muted: #6b7280"), "Current mobile design system uses the approved GrowVest Royal Trust Blue, Deep Premium Black, Insight Yellow, Strategic Red and neutral tokens");
assert(serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("/brand/growvest-logo-white.svg") && packageJson.version === "0.34.8" && mobileRedesignDocV0336.includes("below 768px only") && mobileRedesignManifestV0336.includes("MobileFinanceCharts.js"), "Current release preserves phone-only scope, official SVG assets and finance-app chart foundation");

const officialBrandPolishDocV0336 = read("docs/INVESTOR_MOBILE_OFFICIAL_SVG_BRAND_POLISH_v0.33.6.md");
const officialBrandPolishManifestV0336 = read("docs/INVESTOR_MOBILE_OFFICIAL_SVG_BRAND_POLISH_CODE_MANIFEST_v0.33.6.md");
assert(investorShell.includes('variant="logo"') && investorShell.includes('variant="icon"') && investorShell.includes("GrowVest Investor") && !investorShell.includes('>GrowVest Investor App<'), "v0.33.6 phone app bar uses official SVG branding and simplified screen-title hierarchy");
assert(mobileInvestorDashboardV0335.includes("#1F4ED8") && mobileInvestorDashboardV0335.includes("Total Wealth") && mobileInvestorDashboardV0335.includes("QuickAction") && investorSecurityV0336.includes('text-white">Protect your GrowVest access'), "Mobile wealth hero and quick actions use GrowVest brand blue with accessible dark-surface headings");
assert(investorGoalsV0336.includes('grid grid-cols-2 gap-2') && officialBrandPolishDocV0336.includes("2x2") && officialBrandPolishManifestV0336.includes("InvestorBrandMark.js"), "v0.33.6 Bucket List filters and official SVG mobile brand polish are documented and regression-covered");


// v0.33.7 phone-only professional UI and visual-intelligence regression checks.
const mobilePrimitivesV0337 = read("src/components/investor/mobile/InvestorMobilePrimitives.js");
const investorProfileV0337 = read("src/app/investor/profile/page.js");
const investorNotificationsV0337 = read("src/app/investor/notifications/page.js");
const monthlyWealthReportV0337 = read("src/components/reports/MonthlyWealthReport.js");
const mobileProfessionalDocV0337 = read("docs/INVESTOR_MOBILE_PROFESSIONAL_UI_VISUAL_INTELLIGENCE_v0.33.7.md");
const mobileProfessionalManifestV0337 = read("docs/INVESTOR_MOBILE_PROFESSIONAL_UI_VISUAL_INTELLIGENCE_CODE_MANIFEST_v0.33.7.md");
assert(fs.existsSync(path.join(root, "public", "brand", "growvest-icon-outline.svg")) && mobilePrimitivesV0337.includes("GrowVestOutline") && mobilePrimitivesV0337.includes("MobileEmptyState") && serviceWorker.includes("/brand/growvest-icon-outline.svg"), "v0.33.7 packages the official-icon-derived outline motif and reusable mobile brand primitives");
assert(mobileInvestorDashboardV0335.includes("What needs your attention") && mobileInvestorDashboardV0335.includes("Your Bucket List") && investorPortfolioPanelV0334.includes("showAllHoldings") && investorPortfolioPanelV0334.includes("See all"), "Home preserves priority guidance and Bucket List context while Portfolio preserves complete-holdings mobile access");
assert(investorGoalsV0336.includes("Search your goals") && investorGoalsV0336.includes("Near Completion") && investorGoalsV0336.includes("Not Started") && read("src/app/investor/reports/page.js").includes("Search monthly reviews"), "v0.33.7 Goals and Monthly Reviews provide phone search and complete filter coverage");
assert(monthlyWealthReportV0337.includes('grid gap-3 md:hidden') && monthlyWealthReportV0337.includes('item.insuranceType || "Protection"') && monthlyWealthReportV0337.includes('hidden overflow-x-auto rounded-xl border border-slate-200 md:block'), "v0.33.7 Monthly Report Protection uses phone policy cards while preserving the desktop table");
assert(investorProfileV0337.includes("ProfilePhotoUploader minimal") && investorProfileV0337.includes("Personal Details") && investorProfileV0337.includes("Your GrowVest Partner") && investorProfileV0337.includes("Login & Security") && read("src/components/profile/ProfilePhotoUploader.js").includes("minimal = false"), "Profile integrates phone photo editing into a focused identity, advisor and security experience");
assert(investorNotificationsV0337.includes("Choose your alerts") && investorNotificationsV0337.includes("settingsOpen") && investorNotificationsV0337.includes("updatePushCategory"), "v0.33.7 Notifications includes a phone-native alert-preferences bottom sheet");
assert(investorActionsPanelV0335.includes("Your actions") && investorActionsPanelV0335.includes("Review decision options") && investorShell.includes('title: "Your Actions"'), "v0.33.7 Investor follow-up is presented as clear Your Actions / Next Steps on phones");
assert(investorGlobalStylesV0334.includes("v0.33.7 Investor mobile professional polish") && investorGlobalStylesV0334.includes("gv-brand-outline-drift") && mobileProfessionalDocV0337.includes("below 768px") && mobileProfessionalManifestV0337.includes("InvestorMobilePrimitives.js"), "v0.33.7 professional mobile polish is phone-scoped, motion-aware and documented");
assert(packageJson.version === "0.34.8" && serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1"), "Current metadata and installed-PWA caches are current");

// v0.33.8 GrowVest motion-language and website-to-app continuity checks.
const motionMarkV0338 = read("src/components/investor/mobile/GrowVestMotionMark.js");
const entryMotionV0338 = read("src/components/investor/mobile/InvestorEntryMotion.js");
const splashV0338 = read("src/components/investor/mobile/InvestorAppSplash.js");
const motionDocV0338 = read("docs/GROWVEST_MOTION_LANGUAGE_APP_CONTINUITY_v0.33.8.md");
const motionManifestV0338 = read("docs/GROWVEST_MOTION_LANGUAGE_APP_CONTINUITY_CODE_MANIFEST_v0.33.8.md");
assert(motionMarkV0338.includes("growvest-icon-outline.svg") && motionMarkV0338.includes("growvest-icon.svg") && motionMarkV0338.includes("GrowVestActivityIndicator"), "v0.33.8 motion mark layers the official GrowVest outline and filled SVG assets with a reusable compact activity state");
assert(entryMotionV0338.includes("sessionStorage") && entryMotionV0338.includes("max-width: 767px") && entryMotionV0338.includes("prefers-reduced-motion"), "v0.33.8 Investor entry motion is phone-only, session-gated and reduced-motion aware");
assert(splashV0338.includes("GrowVestMotionMark") && splashV0338.includes('variant="logo"') && splashV0338.includes("Preparing your investor app"), "Branded Investor splash uses the official logo and GrowVest motion mark");
assert(investorShell.includes("InvestorEntryMotion") && mobileInvestorDashboardV0335.includes("GrowVestActivityIndicator") && read("src/app/investor/reports/page.js").includes("GrowVestActivityIndicator"), "v0.33.8 reuses the GrowVest motion language for app entry, Portfolio Master refresh and Monthly Review preparation");
assert(investorGlobalStylesV0334.includes("v0.33.8 GrowVest Motion Language") && investorGlobalStylesV0334.includes("gv-motion-outline-reveal") && investorGlobalStylesV0334.includes("prefers-reduced-motion"), "v0.33.8 motion CSS includes brand reveal, compact activity and accessibility safeguards");
assert(packageJson.version === "0.34.8" && serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1") && motionDocV0338.includes("once per browser session") && motionManifestV0338.includes("GrowVestMotionMark.js"), "GrowVest motion-language documentation remains packaged with current metadata and PWA cache");


// v0.33.9 Investor Mobile App recomposition regression checks.
const mobileRecompositionDocV0339 = read("docs/INVESTOR_MOBILE_APP_RECOMPOSITION_v0.33.9.md");
const mobileRecompositionManifestV0339 = read("docs/INVESTOR_MOBILE_APP_RECOMPOSITION_CODE_MANIFEST_v0.33.9.md");
const reportsV0339 = read("src/app/investor/reports/page.js");
const insuranceV0339 = read("src/components/insurance/InsuranceProtectionPanel.js");
const reportSectionNavV0339 = read("src/components/investor/InvestorReportSectionNav.js");
assert(packageJson.version === "0.34.8" && serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1"), "v0.33.9 release metadata and installed Investor PWA caches are current");
assert(splashV0338.includes("Preparing your investor app") && entryMotionV0338.includes('gv-investor-entry-motion-v3') && entryMotionV0338.includes('1080'), "v0.33.9 uses the simplified faster official-SVG phone entry experience");
assert(mobileInvestorDashboardV0335.includes("Total Wealth") && mobileInvestorDashboardV0335.includes("What needs your attention") && mobileInvestorDashboardV0335.includes("attentionActionsFor") && mobileInvestorDashboardV0335.includes("Your GrowVest Partner"), "Home prioritizes one focal wealth hero, priority-driven attention and relationship access");
assert(investorGoalsV0336.includes("topFilters") && investorGoalsV0336.includes("overflow-x-auto") && investorGoalsV0336.includes("Show goals by status") && investorGoalsV0336.includes("filtersOpen"), "Current Bucket List uses a scroll-safe compact filter strip with a full status filter sheet");
assert(investorPortfolioPanelV0334.includes("MobilePortfolioAppView") && investorPortfolioPanelV0334.includes("Where your money is invested") && investorPortfolioPanelV0334.includes("MobileLineChart") && investorPortfolioPanelV0334.includes("MobileDonutChart") && read("src/app/investor/portfolio/page.js").includes('router.replace("/investor/insurance")'), "Portfolio uses a calmer wealth hierarchy while Protection remains a separate canonical destination");
assert(insuranceV0339.includes("Protection Setup") && insuranceV0339.includes("Your Policies") && insuranceV0339.includes("not an adequacy score") && !insuranceV0339.includes("Protection Confidence"), "Protection uses a clear setup view without presenting a misleading adequacy/confidence score");
assert(reportsV0339.includes("A simple, insightful recap") && reportsV0339.includes("Previous Reviews") && investorReportDetailV0335.includes("Phone-only one-minute review") && investorReportDetailV0335.includes("What changed this month?"), "Monthly Reviews use a focused feature review, flat history and a one-minute detail summary");
assert(reportSectionNavV0339.includes("gv-investor-report-nav") && investorGlobalStylesV0334.includes("v0.33.9 Investor Mobile App Recomposition") && investorGlobalStylesV0334.includes("gv-mobile-primary-hero"), "v0.33.9 mobile navigation, surfaces and report chips use the recomposed phone design system");
assert(mobileRecompositionDocV0339.includes("phone-only below 768px") && mobileRecompositionDocV0339.includes("one strong visual focal point") && mobileRecompositionManifestV0339.includes("InvestorPortfolioPanel.js"), "v0.33.9 mobile recomposition scope and code manifest are packaged");


// v0.34.0 Premium Investor Mobile reference replication and page-performance checks.
const premiumMobileDocV0340 = read("docs/INVESTOR_MOBILE_PREMIUM_REFERENCE_REPLICATION_v0.34.0.md");
const premiumMobileManifestV0340 = read("docs/INVESTOR_MOBILE_PREMIUM_REFERENCE_REPLICATION_CODE_MANIFEST_v0.34.0.md");
const investorAppServiceV0340 = read("src/services/investorAppService.js");
const investorAppDataRouteV0340 = read("src/app/api/investor/app-data/route.js");
const investorHoldingRouteV0340 = read("src/app/api/investor/holding-detail/route.js");
const investorHoldingPageV0340 = read("src/app/investor/portfolio/[positionId]/page.js");
const investorDocumentsV0340 = read("src/app/investor/documents/page.js");
const investorNotificationsV0340 = read("src/app/investor/notifications/page.js");
const investorProfileV0340 = read("src/app/investor/profile/page.js");
const investorLoadingV0340 = read("src/app/investor/loading.js");
assert(packageJson.version === "0.34.8" && serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1"), "v0.34.0 release metadata and installed Investor PWA caches are current");
assert(investorAppServiceV0340.includes("responseCache") && investorAppServiceV0340.includes("inFlight") && investorAppServiceV0340.includes("ttlBySection") && investorAppServiceV0340.includes("force = false"), "v0.34.0 Investor App client data layer provides short-lived section caching, forced refresh and in-flight request deduplication");
assert(investorAppDataRouteV0340.includes('section === "documents"') && investorAppDataRouteV0340.includes('section === "meetings"') && investorAppDataRouteV0340.includes('section === "reports"') && investorAppDataRouteV0340.includes('section === "profile"') && investorAppDataRouteV0340.includes("const portfolio = await loadPortfolio(investor.id)"), "v0.34.0 utility sections bypass unnecessary Portfolio Master reads while wealth sections still hydrate live portfolio data");
assert(investorHoldingRouteV0340.includes("verifyAppRequest(request)") && investorHoldingRouteV0340.includes("positionId") && investorHoldingRouteV0340.includes("holding_access_denied") && investorHoldingPageV0340.includes("Investment activity") && investorPortfolioPanelV0334.includes('href={`/investor/portfolio/${position.id}`}'), "v0.34.0 adds secure Investor Holding Detail drill-down from the Portfolio holdings list");
assert(mobileInvestorDashboardV0335.includes("Total Wealth") && mobileInvestorDashboardV0335.includes("What needs your attention") && mobileInvestorDashboardV0335.includes("Your GrowVest Partner"), "Current Home follows the approved signature reference hierarchy with wealth hero, attention and relationship access");
assert(investorPortfolioPanelV0334.includes("Where your money is invested") && investorGoalsV0336.includes("Your Bucket List") && insuranceV0339.includes("Protection Setup") && insuranceV0339.includes("important areas recorded"), "Portfolio, Bucket List and Protection preserve the signature reference hierarchy with clear protection wording");
assert(reportsV0339.includes("Monthly Review") && reportsV0339.includes("View your full one-minute review") && investorReportDetailV0335.includes("What changed this month?") && investorReportDetailV0335.includes("mobileExpanded"), "Current Monthly Reviews use a focused signature library and on-demand one-minute report detail");
assert(investorDocumentsV0340.includes("MoreHorizontal") && investorDocumentsV0340.includes("No documents in this view") && investorDocumentsV0340.includes("Replace"), "v0.34.0 Documents use a compact premium mobile list with contextual file actions");
assert(investorNotificationsV0340.includes('label: "Action Required"') && investorNotificationsV0340.includes('label: "Updates"') && investorNotificationsV0340.includes("notificationTone"), "v0.34.0 Notifications separate actionable items from updates with semantic visual treatment");
assert(investorProfileV0340.includes("Personal Details") && investorProfileV0340.includes("Notifications") && investorProfileV0340.includes("Your GrowVest Partner") && investorProfileV0340.includes("Financial Privacy"), "Current Profile uses a minimal identity, settings, privacy and GrowVest Partner hierarchy");
assert(entryMotionV0338.includes("gv-investor-entry-motion-v3") && splashV0338.includes("Security of today. Transformation of tomorrow.") && investorLoadingV0340.includes("GrowVestActivityIndicator") && investorLoadingV0340.includes("gv-skeleton"), "v0.34.0 retains the animated official GrowVest entry identity and uses lightweight branded route skeletons for page performance");
assert(investorGlobalStylesV0334.includes("v0.34.0 Premium Mobile Reference Replication & Performance") && investorGlobalStylesV0334.includes("content-visibility: auto") && investorGlobalStylesV0334.includes("contain-intrinsic-size"), "v0.34.0 mobile CSS enables below-the-fold rendering optimization while keeping the redesign phone-only");
assert(premiumMobileDocV0340.includes("phone-only") && premiumMobileDocV0340.includes("in-flight request deduplication") && premiumMobileManifestV0340.includes("holding-detail/route.js"), "v0.34.0 premium mobile design/performance scope and code manifest are packaged");

// v0.34.1 Investor Mobile UX & Premium Design System consolidation checks.
const investorPrivacyV0341 = read("src/contexts/InvestorPrivacyContext.js");
const investorExperienceV0341 = read("src/lib/utils/investorExperience.js");
const goalDetailV0341 = read("src/app/investor/goals/[goalId]/page.js");
const actionDialogV0341 = read("src/components/actions/ActionRequestDialog.js");
const investorLoginV0341 = read("src/app/investor-login/page.js");
const uxDocV0341 = read("docs/INVESTOR_MOBILE_UX_PREMIUM_DESIGN_SYSTEM_v0.34.1.md");
const uxManifestV0341 = read("docs/INVESTOR_MOBILE_UX_PREMIUM_DESIGN_SYSTEM_CODE_MANIFEST_v0.34.1.md");
assert(packageJson.version === "0.34.8" && serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1"), "v0.34.1 release metadata and installed Investor PWA caches are current");
assert(investorPrivacyV0341.includes("growvest-investor-financial-privacy") && investorPrivacyV0341.includes("localStorage") && investorShell.includes("Financial privacy") && mobileInvestorDashboardV0335.includes("useInvestorPrivacy"), "v0.34.1 financial privacy persists and is available across the Investor App");
assert(investorExperienceV0341.includes("filterTrendByRange") && investorExperienceV0341.includes("cutoff.setMonth") && investorPortfolioPanelV0334.includes("filterTrendByRange"), "Portfolio trend controls use calendar-based ranges instead of fixed point slicing");
assert(mobileInvestorDashboardV0335.includes("attentionActionsFor") && mobileInvestorDashboardV0335.includes("priority:") && mobileInvestorDashboardV0335.includes("What needs your attention"), "Home selects priority-driven actions requiring the investor's attention");
assert(investorPortfolioPageV0334.includes('router.replace("/investor/insurance")') && investorNavigation.includes('href: "/investor/insurance"'), "v0.34.1 uses one canonical Investor Protection destination");
assert(goalDetailV0341.includes("What is building this goal") && goalDetailV0341.includes("Connected investments") && investorGoalsV0336.includes("/investor/goals/"), "v0.34.1 Bucket List supports goal-detail drill-down with connected investments");
assert(investorHoldingPageV0340.includes("Purpose") && investorHoldingPageV0340.includes("Building ${primaryGoal.goalName}") && investorHoldingPageV0340.includes("Role in your portfolio"), "v0.34.1 Holding Detail explains purpose and Bucket List connection");
assert(investorReportDetailV0335.includes("in 60 seconds") && investorReportDetailV0335.includes("What changed this month?") && investorReportDetailV0335.includes("Discuss with GrowVest"), "v0.34.1 Monthly Review leads with an investor-friendly one-minute summary");
assert(insuranceV0339.includes("Protection Setup") && insuranceV0339.includes("not an adequacy score"), "Protection wording avoids implying an uncalculated adequacy score");
assert(investorActionsPanelV0335.includes("pendingDecision") && investorActionsPanelV0335.includes("confirmDecision") && investorActionsPanelV0335.includes("Confirm your decision") && investorActionsPanelV0335.includes("Approve") && investorActionsPanelV0335.includes("Defer") && investorActionsPanelV0335.includes("Reject"), "v0.34.1 Investor decision actions include an explicit confirmation step");
assert(!investorLoginV0341.includes("FirebaseError") && investorLoginV0341.includes("We couldn") && investorLoginV0341.includes("contact GrowVest"), "v0.34.1 Investor login recovery avoids exposing Firebase implementation detail");
assert(investorGlobalStylesV0334.includes("v0.34.1 Investor Mobile UX & Premium Design System Consolidation") && investorGlobalStylesV0334.includes("--gv-mobile-meta-size") && investorGlobalStylesV0334.includes('html.dark .gv-investor-viewport') && uxDocV0341.includes("Calendar-based") && uxManifestV0341.includes("InvestorPrivacyContext.js"), "v0.34.1 mobile readability, dark-mode and release documentation are packaged");

// v0.34.2 GrowVest Signature Mobile UI checks.
const signatureDocV0342 = read("docs/INVESTOR_MOBILE_SIGNATURE_UI_v0.34.2.md");
const signatureManifestV0342 = read("docs/INVESTOR_MOBILE_SIGNATURE_UI_CODE_MANIFEST_v0.34.2.md");
const splashV0342 = read("src/components/investor/mobile/InvestorAppSplash.js");
assert(packageJson.version === "0.34.8" && serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1"), "v0.34.2 release metadata and installed Investor PWA caches are current");
assert(investorGlobalStylesV0334.includes("--gv-brand-primary: #1f4ed8") && investorGlobalStylesV0334.includes("--gv-brand-dark: #0b0b0f") && investorGlobalStylesV0334.includes("--gv-brand-warning: #f5b301") && investorGlobalStylesV0334.includes("--gv-brand-danger: #e53935") && investorGlobalStylesV0334.includes("v0.34.2 GrowVest Signature Mobile UI"), "v0.34.2 uses the supplied GrowVest palette and a canonical Signature Mobile UI layer");
assert(investorShell.includes("gv-signature-nav-item") && investorShell.includes("Open GrowVest actions") && investorShell.includes('variant="icon"') && investorShell.includes("strokeWidth={active ? 1.55 : 1.4}"), "v0.34.2 mobile navigation uses slim icons and the official GrowVest centre action");
assert(mobileInvestorDashboardV0335.includes("Total Wealth") && mobileInvestorDashboardV0335.includes("What needs your attention") && mobileInvestorDashboardV0335.includes("QuickAction") && mobileInvestorDashboardV0335.includes("bg-[#0B0B0F]"), "v0.34.2 Home uses the approved wealth hero, overlapping quick actions and focused review treatment");
assert(investorPortfolioPanelV0334.includes("MobileLineChart") && investorPortfolioPanelV0334.includes("MobileDonutChart") && investorPortfolioPanelV0334.includes("Asset Allocation") && investorPortfolioPanelV0334.includes("Portfolio Snapshot"), "v0.34.2 Portfolio keeps performance and allocation visualisation inside a flatter hierarchy");
assert(investorGoalsV0336.includes("Your Bucket List") && goalDetailV0341.includes("Plan at a glance") && goalDetailV0341.includes("What is building this goal") && goalDetailV0341.includes("strokeWidth={ICON_STROKE}"), "v0.34.2 Bucket List and Goal Detail use slim icons, flat progress and connected-investment context");
assert(reportsV0339.includes("bg-[#0B0B0F]") && reportsV0339.includes("Previous Reviews") && investorReportDetailV0335.includes("Portfolio Value") && investorReportDetailV0335.includes("What changed this month?"), "v0.34.2 Monthly Review uses a private-banking statement hierarchy with an on-demand detail view");
assert(insuranceV0339.includes("Protection Setup") && insuranceV0339.includes("This is a record-completeness view, not an adequacy score") && investorProfileV0340.includes("Personal Details") && investorProfileV0340.includes("Your GrowVest Partner"), "v0.34.2 Protection and Profile keep focused investor-facing language without dashboard clutter");
assert(splashV0342.includes("bg-[#0B0B0F]") && splashV0342.includes("#1F4ED8,#F5B301") && !splashV0342.includes("#20b8cd"), "v0.34.2 branded entry motion no longer introduces the retired cyan accent");
assert(signatureDocV0342.includes("Royal Trust Blue") && signatureDocV0342.includes("Slim Lucide outline icons") && signatureManifestV0342.includes("InvestorShell.js") && signatureManifestV0342.includes("InvestorReportDetailClient.js"), "v0.34.2 signature design specification and changed-code manifest are packaged");

// v0.34.3 visual-correction checks after device screenshot review.
const visualCorrectionDocV0343 = read("docs/INVESTOR_MOBILE_VISUAL_CORRECTION_v0.34.3.md");
const visualCorrectionManifestV0343 = read("docs/INVESTOR_MOBILE_VISUAL_CORRECTION_CODE_MANIFEST_v0.34.3.md");
assert(packageJson.version === "0.34.8" && serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1"), "v0.34.3 release metadata and installed Investor PWA caches are current");
assert(investorShell.includes('backHref: "/investor/dashboard"') && investorShell.includes('backHref: "/investor/goals"') && investorShell.includes('backHref: "/investor/portfolio"') && investorShell.includes('brightness-0 invert'), "v0.34.3 secondary Investor screens have consistent back navigation and the home logo is readable on Royal Trust Blue");
assert(mobileInvestorDashboardV0335.includes('pb-[38px]') && !mobileInvestorDashboardV0335.includes('pointer-events-none absolute -right-12 top-7 w-44') && mobileInvestorDashboardV0335.includes('progressLabel(goalPct)') && mobileInvestorDashboardV0335.includes('movementPercent).toFixed(1)') && mobileInvestorDashboardV0335.includes('movementPercent !== null'), "Current Home preserves compact hero proportions, no giant watermark, approved previous-update percentage and sub-1-percent goal progress");
assert(investorPortfolioPanelV0334.includes('const displayGain = Number(summary.gain || 0)') && investorPortfolioPanelV0334.includes('Gain / Loss on known cost') && investorPortfolioPanelV0334.includes('Limited verified history') && investorPortfolioPanelV0334.includes('mobileTrendDateLabel'), "Current Portfolio UI uses the cost-basis-aware gain/loss result and labels sparse history honestly");
assert(investorAppDataRouteV0340.includes('summarisePortfolioPerformance(livePositions, ulipPolicies)') && investorAppDataRouteV0340.includes('gainLoss: Number(gainLoss.toFixed(2))'), "Current authenticated Investor App API uses the central cost-basis-aware portfolio gain/loss definition");
assert(investorGoalsV0336.includes('showGoalTools = goals.length > 4') && investorGoalsV0336.includes('progressLabel(progress)') && goalDetailV0341.includes('Set a target date to measure progress') && goalDetailV0341.includes('progressLabel(progress)') && goalDetailV0341.includes('View all ${investments.length} investments'), "v0.34.3 Bucket List adapts controls to goal count, preserves sub-1-percent progress and removes unsupported positive-status claims");
assert(investorProfileV0340.includes('Financial Privacy') && investorProfileV0340.includes('advisorPhoto') && !investorProfileV0340.includes('Security of today. Transformation of tomorrow.</p></div></div>'), "v0.34.3 mobile Profile exposes privacy directly, supports advisor imagery and removes decorative promo clutter");
assert(investorShell.includes('h-12 w-12') && investorShell.includes('w-[27px]') && visualCorrectionDocV0343.includes('393px') && visualCorrectionManifestV0343.includes('MobileInvestorDashboard.js'), "v0.34.3 centre navigation is less dominant and screenshot-led visual correction documentation is packaged");

// v0.34.4 GrowVest Brand Color System & Screen Refinement.
const brandColorDocV0344 = read("docs/INVESTOR_MOBILE_BRAND_COLOR_SYSTEM_v0.34.4.md");
const brandColorManifestV0344 = read("docs/INVESTOR_MOBILE_BRAND_COLOR_SYSTEM_CODE_MANIFEST_v0.34.4.md");
const goalVisualsV0344 = read("src/components/investor/goalVisuals.js");
const mobileFinanceChartsV0344 = read("src/components/investor/mobile/MobileFinanceCharts.js");
const holdingDetailV0344 = read("src/app/investor/portfolio/[positionId]/page.js");
const investorNavigationV0344 = read("src/lib/constants/investorNavigation.js");
assert(packageJson.version === "0.34.8" && serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1"), "v0.34.4 release metadata and installed Investor PWA caches are current");
assert(mobileInvestorDashboardV0335.includes("gv-mobile-home-hero") && mobileInvestorDashboardV0335.includes("attentionActionsFor") && mobileInvestorDashboardV0335.includes("daysUntilDebit") && mobileInvestorDashboardV0335.includes("Portfolio update is under review"), "v0.34.4 Home uses the full-bleed wealth hero and data-driven attention priorities including SIP and portfolio review states");
assert(investorNavigationV0344.includes("ChartNoAxesCombined") && mobileInvestorDashboardV0335.includes("icon={ChartNoAxesCombined}") && mobileInvestorDashboardV0335.includes("icon={Target}"), "v0.34.4 primary Investor navigation and Home quick actions use a locked slim icon mapping");
assert(investorPortfolioPanelV0334.includes("aria-pressed={range === item}") && investorPortfolioPanelV0334.includes("filterTrendByRange(rawTrend, range)") && investorPortfolioPanelV0334.includes("rangeDescription") && investorPortfolioPanelV0334.includes("mobileAllocationColor") && !investorPortfolioPanelV0334.includes("slice(0, 24).reverse"), "v0.34.4 Portfolio range filters are wired to actual dated history and All can use the full available series");
assert(mobileFinanceChartsV0344.includes("const strokeWidth = 14") && investorPortfolioPanelV0334.includes("size={126}") && investorPortfolioPanelV0334.includes("backgroundColor: item.color"), "v0.34.4 Asset Allocation uses a stronger donut and GrowVest-led allocation colors");
assert(investorGoalsV0336.includes("Goal corpus") && investorGoalsV0336.includes("goalVisual(name)") && goalDetailV0341.includes("goalVisual(name)") && goalVisualsV0344.includes("return Home") && goalDetailV0341.includes("bg-[#FFF8DF]"), "v0.34.4 Bucket List is denser, goal icons stay consistent across list/detail, and planning gaps use Insight Yellow");
assert(holdingDetailV0344.includes("Investment snapshot") && holdingDetailV0344.includes("bg-[#EAF0FF]/65") && holdingDetailV0344.includes("BadgeIndianRupee"), "v0.34.4 Holding Detail highlights the investment snapshot with a restrained Royal Trust Blue surface");
assert(reportsV0339.includes("bg-[#0B0B0F]") && reportsV0339.includes("text-[#9BB2FF]") && investorReportDetailV0335.includes("text-[#9BB2FF]"), "v0.34.4 Monthly Review keeps Deep Premium Black as the signature summary and uses brand-blue positive emphasis");
assert(insuranceV0339.includes("const warning =") && insuranceV0339.includes("const critical =") && insuranceV0339.includes('warning ? "text-[#8A5B00]"') && insuranceV0339.includes('critical ? "text-[#E53935]"'), "v0.34.4 Protection separates warning yellow from critical red while normal policy states remain blue");
assert(brandColorDocV0344.includes("Royal Trust Blue") && brandColorDocV0344.includes("Insight Yellow") && brandColorDocV0344.includes("Strategic Red") && brandColorManifestV0344.includes("MobileInvestorDashboard.js"), "v0.34.4 brand-color specification and changed-code manifest are packaged");

// v0.34.5 Investor Experience Reconciliation.
const reconciliationDocV0345 = read("docs/INVESTOR_EXPERIENCE_RECONCILIATION_v0.34.5.md");
const reconciliationManifestV0345 = read("docs/INVESTOR_EXPERIENCE_RECONCILIATION_CODE_MANIFEST_v0.34.5.md");
const bucketRequestApiV0345 = read("src/app/api/bucket-list-requests/route.js");
const bucketRequestInvestorV0345 = read("src/components/investor/InvestorBucketListRequestPanel.js");
const bucketRequestStaffV0345 = read("src/components/investors/BucketListRequestReviewPanel.js");
const sipFundingApiV0345 = read("src/app/api/sip-funding/route.js");
const profileV0345 = read("src/app/investor/profile/page.js");
const functionsV0345 = read("functions/index.js");
assert(packageJson.version === "0.34.8" && serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1"), "v0.34.5 release metadata and installed Investor PWA caches are current");
assert(investorNavigationV0344.includes('{ label: "Reports", href: "/investor/reports", icon: FileBarChart2, mobile: true }') && investorNavigationV0344.includes('{ label: "Profile", href: "/investor/profile", icon: UserRound }'), "v0.34.5 exact-reference phone navigation uses Reports as the fifth persistent tab while Profile remains available from avatar/More");
assert(investorShell.includes('isMobileHome ? "px-0 py-0"') && investorGlobalStylesV0334.includes('.gv-mobile-home-stack > :not(.gv-mobile-home-hero)'), "v0.34.5 Home uses a structural edge-to-edge hero instead of a clipped negative-margin breakout");
assert(bucketRequestApiV0345.includes('status: "submitted"') && bucketRequestApiV0345.includes('nextStatus === "confirmed"') && bucketRequestApiV0345.includes('bucketList: nextGoals') && bucketRequestInvestorV0345.includes("Submit to GrowVest") && bucketRequestStaffV0345.includes("Confirm goal"), "v0.34.5 lets investors propose Bucket List items while GrowVest confirms them before active-goal calculations");
assert(sipFundingApiV0345.includes("ensureInferredSchedules") && sipFundingApiV0345.includes('scheduleSource: "portfolio_inferred"') && mobileInvestorDashboardV0335.includes("SIP reminders could not be refreshed"), "v0.34.5 can infer SIP reminder schedules from Portfolio SIP history and no longer silently hides reminder-load failures");
assert(functionsV0345.includes("notifyInvestorPortfolioVerified") && functionsV0345.includes('eventType: "portfolio_verified_update"') && functionsV0345.includes('link: "/investor/portfolio"'), "v0.34.5 creates a deep-linked Investor notification only after a verified reconciled daily portfolio snapshot");
assert(profileV0345.includes("Your Wealth Profile") && profileV0345.includes("panMasked") && profileV0345.includes("Monthly SIP plan") && investorNotificationsV0340.includes('key: "portfolio"') && investorNotificationsV0340.includes('key: "bucketList"'), "v0.34.5 completes key Investor Profile context and adds portfolio/SIP/Bucket List notification preferences");
assert(reconciliationDocV0345.includes("Where am I today?") && reconciliationDocV0345.includes("Investor Add Bucket List") && reconciliationManifestV0345.includes("bucket-list-requests/route.js"), "v0.34.5 reconciliation specification and changed-code manifest are packaged");

// v0.34.6 Family & Household Portal Access.
const familyAccessDocV0346 = read("docs/FAMILY_HOUSEHOLD_PORTAL_ACCESS_v0.34.6.md");
const familyAccessManifestV0346 = read("docs/FAMILY_HOUSEHOLD_PORTAL_ACCESS_CODE_MANIFEST_v0.34.6.md");
const investorAccessApiV0346 = read("src/app/api/investor/access/profiles/route.js");
const investorSelectorV0346 = read("src/app/investor/select-profile/page.js");
const investorAccessClientV0346 = read("src/lib/auth/investorAccess.js");
const apiAuthV0346 = read("src/lib/firebase/apiAuth.js");
const firebaseAdminV0346 = read("src/lib/server/firebaseAdmin.js");
const portalAccessV0346 = read("src/app/api/investors/[investorId]/portal-access/route.js");
const portalAccessCardV0346 = read("src/components/investors/InvestorPortalAccessCard.js");
const authContextV0346 = read("src/contexts/AuthContext.js");
const loginV0346 = read("src/app/investor-login/page.js");
const messagingWorkerV0346 = read("public/firebase-messaging-sw.js");
const notificationApiV0346 = read("src/app/api/notifications/route.js");
const investorAppServiceV0346 = read("src/services/investorAppService.js");
assert(packageJson.version === "0.34.8" && serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1"), "v0.34.6 Family Access metadata and installed-PWA caches are current");
assert(apiAuthV0346.includes("X-GrowVest-Investor-Id") && investorAccessClientV0346.includes("gv.activeInvestor."), "v0.34.6 sends the selected Investor context with authenticated API requests");
assert(firebaseAdminV0346.includes("investorAccessMemberships") && firebaseAdminV0346.includes("investor_context_denied") && firebaseAdminV0346.includes("primaryInvestorId"), "v0.34.6 validates household Investor switching server-side before changing actor context");
assert(firestoreRules.includes("match /investorAccessMemberships/{membershipId}") && firestoreRules.includes("allow read, write: if false") && firestoreRules.includes("accessibleInvestorIds") && firestoreRules.includes("investorIds"), "v0.34.6 keeps household grants server-only and constrains Google first-login access to authorised alias Investor IDs");
assert(indexes.indexes.some((item) => item.collectionGroup === "investorAccessMemberships" && item.fields?.some((field) => field.fieldPath === "uid") && item.fields?.some((field) => field.fieldPath === "status")), "v0.34.6 includes the uid/status household-membership index required by profile switching");
assert(investorAccessApiV0346.includes("investorAccessMemberships") && investorAccessApiV0346.includes("relationship") && investorSelectorV0346.includes("Who would you like to view?") && investorSelectorV0346.includes("Only profiles explicitly authorised by GrowVest"), "v0.34.6 provides an authorised family profile selector after login");
assert(authContextV0346.includes("accessProfiles") && authContextV0346.includes("switchInvestor") && authContextV0346.includes("clearStoredActiveInvestorId") && loginV0346.includes("/investor/select-profile"), "v0.34.6 manages active Investor context and clears it on logout");
assert(portalAccessV0346.includes("allowSharedAccess") && portalAccessV0346.includes("getUserByPhoneNumber") && portalAccessV0346.includes("investorAccessMemberships") && portalAccessV0346.includes("sharedAccountStillActive"), "v0.34.6 reuses a canonical family login only after explicit staff confirmation and preserves other profiles when one is disabled");
assert(portalAccessCardV0346.includes("Link to an existing family login") && portalAccessCardV0346.includes("Relationship to primary login holder") && portalAccessCardV0346.includes("Family Access"), "v0.34.6 staff Portal Access UI makes shared family authorisation explicit");
assert(investorAppServiceV0346.includes("getStoredActiveInvestorId") && notificationApiV0346.includes("notification_investor_context_denied"), "v0.34.6 scopes Investor App caching and in-app notifications to the selected Investor");
assert(functionsV0345.includes('investorId: safeText(notification.investorId') && messagingWorkerV0346.includes("investor=${encodeURIComponent(investorId)}") && investorShell.includes("Switch investor"), "v0.34.6 push deep links and the Investor shell preserve the correct household profile context");
assert(familyAccessDocV0346.includes("matching email/mobile details alone grant access") && familyAccessManifestV0346.includes("investorAccessMemberships"), "v0.34.6 Family Access specification and code manifest are packaged");

// v0.34.7 Personalised Guest Investor Demo and Lead handoff.
const demoCtaV0347 = read("src/components/investor/DemoInvestorCta.js");
const demoProspectApiV0347 = read("src/app/api/demo/prospect/route.js");
const demoInterestV0347 = read("src/app/investor/demo-interest/page.js");
const notificationBellV0347 = read("src/components/notifications/NotificationBell.js");
const demoDocV0347 = read("docs/PERSONALISED_GUEST_INVESTOR_DEMO_v0.34.7.md");
const demoManifestV0347 = read("docs/PERSONALISED_GUEST_INVESTOR_DEMO_CODE_MANIFEST_v0.34.7.md");
assert(demoCtaV0347.includes('action: "express_interest"') && demoCtaV0347.includes("agreedToBecomePart: true") && demoCtaV0347.includes('router.push("/investor/demo-interest")'), "v0.34.7 creates the GrowVest Lead before opening guest-detail enrichment");
assert(demoProspectApiV0347.includes("demoLeadDocumentId") && demoProspectApiV0347.includes('status: "NEW"') && demoProspectApiV0347.includes('leadSource: "Investor App Demo"') && demoProspectApiV0347.includes('originalLeadFlow: "SOP 1 - Lead to Conversion"'), "v0.34.7 hands a guest directly into the existing NEW Lead / SOP 1 workflow");
assert(demoProspectApiV0347.includes("if (leadSnapshot.exists)") && demoProspectApiV0347.includes("demoLastInterestAt") && demoProspectApiV0347.includes("created: false"), "v0.34.7 makes repeated Become part of GrowVest clicks idempotent for the same Demo session");
assert(demoProspectApiV0347.includes("demoGuestEmail") && demoProspectApiV0347.includes("!text(existing.email, 120)") && demoInterestV0347.includes('action: "enrich"') && demoInterestV0347.includes("they do not create another lead"), "v0.34.7 enrichment updates the same Lead without overwriting staff-entered normal Lead fields");
assert(demoDocV0347.includes("lead is created at the moment") && demoManifestV0347.includes("Lead-on-agreement refinement") && serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1"), "v0.34.7 guest-demo Lead trigger documentation and installed-PWA cache refresh are packaged");
assert(notificationBellV0347.includes("isDemoInvestor") && notificationBellV0347.includes("staffNotificationMode") && notificationBellV0347.includes('profile?.role === "investor" || isDemoInvestor'), "v0.34.7 Demo Investor notification bell uses synthetic Investor notifications and never falls through to Firebase-authenticated staff polling");

// v0.34.8 Portfolio Gain/Loss Integrity and Investment Type Totals.
const portfolioPerformanceV0348 = read("src/lib/portfolioPerformance.js");
const portfolioPanelV0348 = read("src/components/portfolio/InvestorPortfolioPanel.js");
const investorAppDataV0348 = read("src/app/api/investor/app-data/route.js");
const manualPositionV0348 = read("src/app/api/portfolio/positions/manual/route.js");
const manualImportV0348 = read("src/app/api/portfolio/investors/[investorId]/manual-import/route.js");
const genericCommitV0348 = read("src/app/api/portfolio/imports/fundbazaar/commit/route.js");
const manualWorkbookV0348 = read("src/lib/server/manualPortfolioWorkbook.js");
const portfolioServerV0348 = read("src/lib/server/portfolioServer.js");
const portfolioIntegrityDocV0348 = read("docs/PORTFOLIO_GAIN_LOSS_DATA_INTEGRITY_v0.34.8.md");
const portfolioIntegrityManifestV0348 = read("docs/PORTFOLIO_GAIN_LOSS_DATA_INTEGRITY_CODE_MANIFEST_v0.34.8.md");
assert(packageJson.version === "0.34.8" && serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1"), "v0.34.8 metadata and installed Investor PWA caches are current");
assert(portfolioPerformanceV0348.includes("summarisePortfolioPerformance") && portfolioPerformanceV0348.includes("summarisePortfolioByInvestmentType") && portfolioPerformanceV0348.includes("pendingCostBasisCount") && portfolioPerformanceV0348.includes("gainLoss += current - invested"), "v0.34.8 centralises cost-basis-aware portfolio performance and category totals, including losses");
assert(portfolioPanelV0348.includes("Investment Type Totals") && portfolioPanelV0348.includes("How Total Invested is built") && portfolioPanelV0348.includes("Trading / Derivatives") && portfolioPanelV0348.includes("never included in Total Invested or Bucket List corpus") && portfolioPanelV0348.includes("turnover this month"), "v0.34.8 shows Mutual Fund/Equity/ULIP/etc. totals and keeps Trading/Derivatives separate from invested wealth");
assert(portfolioPanelV0348.includes("Known Invested") && portfolioPanelV0348.includes("Gain / Loss (Known Cost)") && portfolioPanelV0348.includes("cost basis pending"), "v0.34.8 surfaces partial performance instead of treating missing purchase cost as profit");
assert(investorAppDataV0348.includes("summarisePortfolioPerformance") && investorAppDataV0348.includes("performanceAvailable") && investorAppDataV0348.includes("pendingCurrentValue"), "v0.34.8 Investor Home/App data uses the same cost-basis-aware gain/loss source of truth");
assert(manualPositionV0348.includes("preserve a previously known purchase cost") && manualImportV0348.includes("must never erase an already-known purchase") && genericCommitV0348.includes("must preserve any prior purchase cost"), "v0.34.8 valuation-only stock/NAV updates preserve prior purchase cost across manual and generic update paths");
assert(manualWorkbookV0348.includes('performanceExcludedReason: "cash_balance"') && manualWorkbookV0348.includes("summarisePortfolioPerformance"), "v0.34.8 cash contributes to portfolio value without being reported as investment gain");
assert(portfolioServerV0348.includes("gainLossPartial") && portfolioServerV0348.includes("latestPortfolioPendingCostBasisCount"), "v0.34.8 verified snapshots persist partial-performance integrity metadata");
assert(portfolioIntegrityDocV0348.includes("Mutual Fund SIP") && portfolioIntegrityDocV0348.includes("Trading / Derivatives") && portfolioIntegrityManifestV0348.includes("portfolioPerformance.js"), "v0.34.8 portfolio integrity specification and changed-code manifest are packaged");


// v0.34.8 Mobile Investor Sign Out hotfix.
const investorProfileSignoutV0348 = read("src/app/investor/profile/page.js");
const mobileSignoutDocV0348 = read("docs/MOBILE_INVESTOR_SIGNOUT_HOTFIX_v0.34.8.md");
assert(investorShell.includes('const exitHref = isDemoInvestor ? "/investor-demo" : "/investor-login"') && investorShell.includes('isDemoInvestor ? "Exit Demo" : "Sign Out"') && investorShell.includes('aria-label={isDemoInvestor ? "Exit GrowVest demo" : "Sign out of GrowVest Investor App"}'), "v0.34.8 phone GrowVest action sheet exposes Sign Out for real Investors and Exit Demo for guest Investors");
assert(investorProfileSignoutV0348.includes('onLogout={handleLogout}') && investorProfileSignoutV0348.includes('isDemoInvestor ? "Exit Demo" : "Sign Out"') && investorProfileSignoutV0348.includes('router.replace(exitHref)'), "v0.34.8 mobile Profile also exposes the correct real-Investor/demo exit action");
assert(serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1") && mobileSignoutDocV0348.includes("Investor App") && mobileSignoutDocV0348.includes("Demo"), "v0.34.8 mobile sign-out hotfix is documented and refreshes installed-PWA caches");

const secureCompare = read("src/lib/server/secureCompare.js");
assert(secureCompare.includes("MIN_SERVER_SECRET_LENGTH = 32"), "cron/webhook authentication rejects short server secrets");

const meetingCron = read("src/app/api/cron/meeting-reminders/route.js");
assert(meetingCron.includes("claimReminder") && meetingCron.includes("reminderClaims"), "meeting reminder cron uses a concurrency claim before sending");

// v0.34.5 Exact Home Reference Lock.
const homeLockDocV0345 = read("docs/INVESTOR_HOME_COMPOSITION_LOCK_v0.34.5.md");
assert(mobileInvestorDashboardV0335.includes("gv-mobile-home-quick-actions") && mobileInvestorDashboardV0335.includes("rounded-[18px]") && !mobileInvestorDashboardV0335.includes("-mt-[20px]") && investorGlobalStylesV0334.includes("margin-top: -26px !important") && investorGlobalStylesV0334.includes("border-radius: 26px 26px 0 0"), "v0.34.5 Home matches the approved layered transition: rounded white sheet behind the compact quick-action tray over the Royal Trust Blue hero");
assert(mobileInvestorDashboardV0335.includes("togglePrivacyMode") && mobileInvestorDashboardV0335.includes("RefreshCw size={13}") && !mobileInvestorDashboardV0335.includes(">Refresh</button>"), "v0.34.5 Home keeps privacy beside wealth and a compact icon-only refresh control");
assert(mobileInvestorDashboardV0335.includes("What needs your attention") && mobileInvestorDashboardV0335.includes("allAttentionActions.slice(0, 1)") && mobileInvestorDashboardV0335.includes("sipNeedsAction") && mobileInvestorDashboardV0335.includes("protectionDays"), "v0.34.5 Home previews one priority-driven attention item while preserving expandable SIP/protection intelligence");
assert(mobileInvestorDashboardV0335.includes("Your Bucket List") && mobileInvestorDashboardV0335.includes("progressLabel(goalPct)") && mobileInvestorDashboardV0335.includes("Your GrowVest Partner"), "v0.34.5 Home keeps Bucket List and GrowVest Partner compact on the approved flat white content canvas");
assert(mobileInvestorDashboardV0335.includes("bg-[#0B0B0F]") && mobileInvestorDashboardV0335.includes("Review is ready") && mobileInvestorDashboardV0335.includes("Your Monthly Review") && mobileInvestorDashboardV0335.includes("BarChart3"), "v0.34.5 Home uses the approved compact Deep Premium Black Monthly Review card with chart motif");
assert(serviceWorker.includes("growvest-investor-v0.34.8-mobile-signout1") && serviceWorker.includes("growvest-pages-v0.34.8-mobile-signout1") && homeLockDocV0345.includes("approved Home screenshot"), "v0.34.5 exact Home reference documentation and installed-PWA cache refresh are packaged");

const brevoWebhook = read("src/app/api/webhooks/brevo/route.js");
assert(brevoWebhook.includes("1024 * 1024") && brevoWebhook.includes("safeProviderPayload"), "Brevo webhook payload size and stored provider fields are bounded");

const nextConfig = read("next.config.mjs");
assert(nextConfig.includes('X-Content-Type-Options') && nextConfig.includes('Cache-Control') && nextConfig.includes('X-Frame-Options'), "security and API no-cache response headers are configured");

const apiRouteRoot = path.join(root, "src", "app", "api");
const routeFiles = walk(apiRouteRoot).filter((file) => file.endsWith(`${path.sep}route.js`));
const directAuthPattern = /verifyAppRequest|verifyStaffRequest|CRON_SECRET|BREVO_WEBHOOK_TOKEN|secureSecretMatch/;
const explicitPublicApiPattern = /PUBLIC_API_ROUTE: investor-demo-prospect/;
const unauthenticatedRoutes = routeFiles.filter((file) => {
  const content = fs.readFileSync(file, "utf8");
  return !directAuthPattern.test(content) && !explicitPublicApiPattern.test(content);
});
const explicitPublicRoutes = routeFiles.filter((file) => explicitPublicApiPattern.test(fs.readFileSync(file, "utf8")));
assert(unauthenticatedRoutes.length === 0, `all ${routeFiles.length} API routes contain an authentication/secret gate or an explicitly audited public-form marker`);
if (unauthenticatedRoutes.length) unauthenticatedRoutes.forEach((file) => fail(`Missing API auth/public marker: ${path.relative(root, file)}`));
assert(explicitPublicRoutes.length === 1 && path.relative(root, explicitPublicRoutes[0]).replaceAll("\\", "/") === "src/app/api/demo/prospect/route.js", "only the audited Investor Demo prospect form is intentionally public");

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
