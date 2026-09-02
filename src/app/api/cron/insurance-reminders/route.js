import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { secureSecretMatch } from "@/lib/server/secureCompare";
import { insuranceDaysUntil, insuranceDueDates, insuranceReminderOffsets } from "@/lib/constants/insurance";

export const runtime = "nodejs";

function authorised(request) {
  const configured = String(process.env.CRON_SECRET || "").trim();
  if (!configured) return false;
  const supplied = String(request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "").trim();
  return secureSecretMatch(supplied, configured);
}

function amountText(value) {
  const amount = Number(value || 0);
  return amount > 0 ? ` · ₹${amount.toLocaleString("en-IN")}` : "";
}

async function processPolicy(policyDoc, today) {
  const policy = { id: policyDoc.id, ...policyDoc.data() };
  if (policy.autoReminder === false) return { id: policy.id, status: "disabled" };
  if (["Cancelled", "Claimed / Closed", "Renewed", "Lapsed", "Expired"].includes(policy.policyStatus)) return { id: policy.id, status: "closed" };
  const configured = new Set(insuranceReminderOffsets(policy.reminderDays));
  const dueItems = insuranceDueDates(policy);
  let sent = 0;
  for (const due of dueItems) {
    const days = insuranceDaysUntil(due.date, today);
    if (days === null || !configured.has(days)) continue;
    const safeDate = String(due.date).replace(/[^0-9]/g, "");
    const key = `${policy.id}_${due.kind}_${safeDate}_${days}`;
    const batch = adminDb.batch();
    const eventRef = adminDb.collection("insuranceReminderEvents").doc(key);
    const eventSnapshot = await eventRef.get();
    if (eventSnapshot.exists) continue;
    batch.set(eventRef, {
      policyId: policy.id, investorId: policy.investorId, investorName: policy.investorName || "Investor", advisorUid: policy.advisorUid || "",
      dueKind: due.kind, dueLabel: due.label, dueDate: due.date, daysBefore: days, sentAt: FieldValue.serverTimestamp(), createdByUid: "system"
    });
    const timing = days === 0 ? "due today" : `due in ${days} day${days === 1 ? "" : "s"}`;
    if (policy.investorPortalUid) {
      batch.set(adminDb.collection("notifications").doc(`insurance_${key}_investor`), {
        recipientUid: policy.investorPortalUid, recipientType: "investor", title: `${due.label} ${timing}`,
        message: `${policy.productName || "Insurance policy"} · ${policy.insurer || ""}${amountText(due.kind === "premium" ? policy.premiumAmount : policy.coverAmount)} · ${due.date}.`,
        eventType: "insurance_due_reminder", link: "/investor/insurance", investorId: policy.investorId, insurancePolicyId: policy.id,
        status: "unread", createdByUid: "system", createdAt: FieldValue.serverTimestamp(), readAt: null
      }, { merge: true });
    }
    if (policy.advisorUid) {
      batch.set(adminDb.collection("notifications").doc(`insurance_${key}_advisor`), {
        recipientUid: policy.advisorUid, recipientType: "advisor", title: `Insurance ${due.label.toLowerCase()} ${timing}`,
        message: `${policy.investorName || "Investor"} · ${policy.productName || "Insurance policy"} · ${due.date}.`,
        eventType: "insurance_due_reminder", link: `/insurance?investorId=${encodeURIComponent(policy.investorId || "")}`, investorId: policy.investorId, insurancePolicyId: policy.id,
        status: "unread", createdByUid: "system", createdAt: FieldValue.serverTimestamp(), readAt: null
      }, { merge: true });
    }
    await batch.commit();
    sent += 1;
  }
  return { id: policy.id, status: sent ? "sent" : "not_due", sent };
}

async function run(request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const snapshot = await adminDb.collection("insurancePolicies").limit(2500).get();
  const today = new Date().toISOString().slice(0, 10);
  const results = [];
  for (const doc of snapshot.docs) {
    try { results.push(await processPolicy(doc, today)); }
    catch (error) { results.push({ id: doc.id, status: "failed", error: error.message }); }
  }
  return NextResponse.json({ success: true, checked: snapshot.size, remindersSent: results.reduce((sum, item) => sum + Number(item.sent || 0), 0), results });
}

export async function GET(request) { try { return await run(request); } catch (error) { console.error("Insurance reminder cron failed", error); return NextResponse.json({ error: error.message || "Insurance reminder processing failed." }, { status: 500 }); } }
export async function POST(request) { return GET(request); }
