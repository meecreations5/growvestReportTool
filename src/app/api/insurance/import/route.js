import { createHash } from "node:crypto";
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

const IMPORT_CHUNK_SIZE = 100;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function importPolicyDocumentId(investorId, item) {
  return `ins_${sha256(`${investorId}|${insurancePolicyIdentity(item)}`).slice(0, 40)}`;
}

async function parseRequest(request, actor) {
  const form = await request.formData();
  const investorId = String(form.get("investorId") || "");
  const action = String(form.get("action") || "preview");
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") throw new AppRequestError("Select the Insurance Excel file.", 400, "insurance_file_required");
  if (file.size > 8 * 1024 * 1024) throw new AppRequestError("Insurance workbook must be 8 MB or less.", 400, "insurance_file_too_large");
  const investor = await getAccessibleInsuranceInvestor(actor, investorId);
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseInsuranceWorkbook(buffer, file.name || "insurance.xlsx");
  const fileHash = sha256(buffer);
  const importId = `insurance_${sha256(`${investor.id}|${fileHash}`).slice(0, 40)}`;
  return { form, action, file, investor, parsed, fileHash, importId };
}

function previewAgainstExisting(parsed, existing) {
  const existingByKey = new Map(existing.map((item) => [insurancePolicyIdentity(item), item]));
  const rows = parsed.rows.map((item) => ({ ...item, match: existingByKey.has(insurancePolicyIdentity(item)) ? "update" : "new" }));
  return { existingByKey, rows };
}

async function markImportFailure(importRef, error, actor) {
  try {
    await importRef.set({
      status: "failed",
      lastError: String(error?.message || error || "Import failed").slice(0, 1200),
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: actor.uid
    }, { merge: true });
  } catch (journalError) {
    console.error("Insurance import failure journal could not be updated", journalError);
  }
}

export async function POST(request) {
  let importRef = null;
  let actor = null;
  try {
    actor = await verifyStaffRequest(request);
    const { action, file, investor, parsed, fileHash, importId } = await parseRequest(request, actor);
    const existing = await loadInsurancePoliciesForInvestor(investor.id);
    const { existingByKey, rows: previewRows } = previewAgainstExisting(parsed, existing);

    if (action === "preview") {
      return NextResponse.json({
        success: true,
        sheetName: parsed.sheetName,
        rows: previewRows,
        errors: parsed.errors,
        warnings: parsed.warnings,
        summary: {
          rows: previewRows.length,
          new: previewRows.filter((item) => item.match === "new").length,
          update: previewRows.filter((item) => item.match === "update").length,
          errors: parsed.errors.length,
          warnings: parsed.warnings.length
        }
      });
    }
    if (action !== "commit") throw new AppRequestError("Unsupported import action.", 400, "insurance_import_action_invalid");
    if (parsed.errors.length) throw new AppRequestError("Fix workbook validation errors before importing.", 400, "insurance_import_validation_failed");

    importRef = adminDb.collection("insuranceImportBatches").doc(importId);
    const previousImport = await importRef.get();
    if (previousImport.exists && previousImport.data()?.status === "completed") {
      const previous = previousImport.data();
      return NextResponse.json({
        success: true,
        importBatchId: importId,
        idempotentReplay: true,
        created: Number(previous.created || 0),
        updated: Number(previous.updated || 0),
        imported: Number(previous.imported || 0),
        warnings: parsed.warnings
      });
    }

    const previewNew = previewRows.filter((item) => item.match === "new").length;
    const previewUpdate = previewRows.filter((item) => item.match === "update").length;
    await importRef.set({
      importType: "insurance_excel",
      investorId: investor.id,
      investorName: investor.fullName || "Investor",
      clientCode: investor.clientCode || "",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      fileName: file.name || "insurance.xlsx",
      fileHash,
      sheetName: parsed.sheetName,
      status: "processing",
      totalRows: parsed.rows.length,
      plannedCreates: previewNew,
      plannedUpdates: previewUpdate,
      processedRows: 0,
      created: 0,
      updated: 0,
      imported: 0,
      warningCount: parsed.warnings.length,
      startedAt: previousImport.exists ? (previousImport.data()?.startedAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
      createdByUid: previousImport.exists ? (previousImport.data()?.createdByUid || actor.uid) : actor.uid,
      createdByName: previousImport.exists ? (previousImport.data()?.createdByName || actor.fullName || actor.email || "GrowVest") : (actor.fullName || actor.email || "GrowVest"),
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: actor.uid,
      lastError: null
    }, { merge: true });

    const ulipSnapshot = await adminDb.collection("ulipPolicies").where("investorId", "==", investor.id).get();
    const ulipByPolicyNumber = new Map(ulipSnapshot.docs.map((item) => [
      String(item.data()?.policyNumber || "").trim().toUpperCase(),
      { id: item.id, policyNumber: String(item.data()?.policyNumber || "") }
    ]).filter(([key]) => key));

    const previousData = previousImport.exists ? previousImport.data() || {} : {};
    let created = Math.max(0, Number(previousData.created || 0));
    let updated = Math.max(0, Number(previousData.updated || 0));
    const resumeFrom = Math.min(parsed.rows.length, Math.max(0, Number(previousData.processedRows || 0)));
    for (let start = resumeFrom; start < parsed.rows.length; start += IMPORT_CHUNK_SIZE) {
      const chunk = parsed.rows.slice(start, start + IMPORT_CHUNK_SIZE);
      const batch = adminDb.batch();

      for (const item of chunk) {
        const identity = insurancePolicyIdentity(item);
        const match = existingByKey.get(identity);
        const ref = match
          ? adminDb.collection("insurancePolicies").doc(match.id)
          : adminDb.collection("insurancePolicies").doc(importPolicyDocumentId(investor.id, item));
        const normalisedRecord = normaliseInsurancePayload(
          { ...item, sourceFileName: file.name || "insurance.xlsx" },
          { actor, investor, existing: match || null, source: "insurance_excel" }
        );
        const ulipLink = normalisedRecord.insuranceType === "ULIP Insurance"
          ? ulipByPolicyNumber.get(String(normalisedRecord.policyNumber || "").trim().toUpperCase())
          : null;
        const record = {
          ...normalisedRecord,
          linkedUlipPolicyId: ulipLink?.id || (normalisedRecord.insuranceType === "ULIP Insurance" ? (match?.linkedUlipPolicyId || "") : ""),
          linkedUlipPolicyNumber: ulipLink?.policyNumber || (normalisedRecord.insuranceType === "ULIP Insurance" ? (match?.linkedUlipPolicyNumber || "") : "")
        };
        batch.set(ref, record, { merge: Boolean(match) });
        batch.set(adminDb.collection("insurancePolicyEvents").doc(`${importId}_row_${item.rowNumber}`), insuranceEventPayload({
          policyId: ref.id,
          policy: { ...match, ...record },
          actor,
          eventType: match ? "policy_import_updated" : "policy_import_created",
          note: `${match ? "Updated" : "Created"} from ${file.name || "insurance workbook"}.`,
          metadata: { rowNumber: item.rowNumber, sourceFileName: file.name || "", importBatchId: importId }
        }), { merge: true });
        batch.set(adminDb.collection("activityLogs").doc(`insurance_import_${importId}_${item.rowNumber}`), {
          recordType: "investor",
          recordId: investor.id,
          investorId: investor.id,
          investorName: investor.fullName || "Investor",
          advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
          assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
          insurancePolicyId: ref.id,
          action: match ? "insurance_import_updated" : "insurance_import_created",
          title: match ? "Insurance policy updated from Excel" : "Insurance policy imported from Excel",
          description: `${record.productName} · ${record.policyNumber}`,
          metadata: { sourceFileName: file.name || "", rowNumber: item.rowNumber, importBatchId: importId },
          createdByUid: actor.uid,
          createdByName: actor.fullName || actor.email || "GrowVest",
          createdAt: FieldValue.serverTimestamp()
        }, { merge: true });
        existingByKey.set(identity, { id: ref.id, ...record });
        if (match) updated += 1; else created += 1;
      }

      batch.set(importRef, {
        status: "processing",
        processedRows: Math.min(start + chunk.length, parsed.rows.length),
        created,
        updated,
        imported: created + updated,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: actor.uid
      }, { merge: true });
      await batch.commit();
    }

    await importRef.set({
      status: "completed",
      processedRows: parsed.rows.length,
      created,
      updated,
      imported: created + updated,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastError: null
    }, { merge: true });

    return NextResponse.json({ success: true, importBatchId: importId, created, updated, imported: created + updated, warnings: parsed.warnings });
  } catch (error) {
    if (importRef && actor) await markImportFailure(importRef, error, actor);
    console.error("Insurance workbook import failed", error);
    return NextResponse.json({ error: error.message || "Unable to import insurance workbook." }, { status: appRequestErrorStatus(error, 500) });
  }
}
