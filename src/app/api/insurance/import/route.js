import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, appRequestErrorStatus, verifyStaffRequest, AppRequestError } from "@/lib/server/firebaseAdmin";
import {
  getAccessibleInsuranceInvestor,
  insuranceEventPayload,
  insurancePolicyIdentity,
  loadInsurancePoliciesForInvestor,
  normaliseInsurancePayload,
  parseInsuranceWorkbook
} from "@/lib/server/insuranceServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function parseRequest(request, actor) {
  const form = await request.formData();
  const investorId = String(form.get("investorId") || "");
  const action = String(form.get("action") || "preview");
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") throw new AppRequestError("Select the Insurance Excel file.", 400, "insurance_file_required");
  if (file.size > 8 * 1024 * 1024) throw new AppRequestError("Insurance workbook must be 8 MB or less.", 400, "insurance_file_too_large");
  const investor = await getAccessibleInsuranceInvestor(actor, investorId);
  const parsed = parseInsuranceWorkbook(Buffer.from(await file.arrayBuffer()), file.name || "insurance.xlsx");
  return { form, action, file, investor, parsed };
}

export async function POST(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const { action, file, investor, parsed } = await parseRequest(request, actor);
    const existing = await loadInsurancePoliciesForInvestor(investor.id);
    const existingByKey = new Map(existing.map((item) => [insurancePolicyIdentity(item), item]));
    const previewRows = parsed.rows.map((item) => ({ ...item, match: existingByKey.has(insurancePolicyIdentity(item)) ? "update" : "new" }));

    if (action === "preview") {
      return NextResponse.json({ success: true, sheetName: parsed.sheetName, rows: previewRows, errors: parsed.errors, warnings: parsed.warnings, summary: { rows: previewRows.length, new: previewRows.filter((item) => item.match === "new").length, update: previewRows.filter((item) => item.match === "update").length, errors: parsed.errors.length, warnings: parsed.warnings.length } });
    }
    if (action !== "commit") throw new AppRequestError("Unsupported import action.", 400, "insurance_import_action_invalid");
    if (parsed.errors.length) throw new AppRequestError("Fix workbook validation errors before importing.", 400, "insurance_import_validation_failed");

    let created = 0; let updated = 0;
    for (const item of parsed.rows) {
      const match = existingByKey.get(insurancePolicyIdentity(item));
      const ref = match ? adminDb.collection("insurancePolicies").doc(match.id) : adminDb.collection("insurancePolicies").doc();
      const record = normaliseInsurancePayload({ ...item, sourceFileName: file.name || "insurance.xlsx" }, { actor, investor, existing: match || null, source: "insurance_excel" });
      const batch = adminDb.batch();
      batch.set(ref, record, { merge: Boolean(match) });
      batch.set(adminDb.collection("insurancePolicyEvents").doc(), insuranceEventPayload({ policyId: ref.id, policy: { ...match, ...record }, actor, eventType: match ? "policy_import_updated" : "policy_import_created", note: `${match ? "Updated" : "Created"} from ${file.name || "insurance workbook"}.`, metadata: { rowNumber: item.rowNumber, sourceFileName: file.name || "" } }));
      batch.set(adminDb.collection("activityLogs").doc(), {
        recordType: "investor", recordId: investor.id, investorId: investor.id, investorName: investor.fullName || "Investor",
        advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "", assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
        insurancePolicyId: ref.id, action: match ? "insurance_import_updated" : "insurance_import_created",
        title: match ? "Insurance policy updated from Excel" : "Insurance policy imported from Excel",
        description: `${record.productName} · ${record.policyNumber}`, metadata: { sourceFileName: file.name || "", rowNumber: item.rowNumber },
        createdByUid: actor.uid, createdByName: actor.fullName || actor.email || "GrowVest", createdAt: FieldValue.serverTimestamp()
      });
      await batch.commit();
      existingByKey.set(insurancePolicyIdentity(record), { id: ref.id, ...record });
      if (match) updated += 1; else created += 1;
    }
    return NextResponse.json({ success: true, created, updated, imported: created + updated, warnings: parsed.warnings });
  } catch (error) {
    console.error("Insurance workbook import failed", error);
    return NextResponse.json({ error: error.message || "Unable to import insurance workbook." }, { status: appRequestErrorStatus(error, 500) });
  }
}
