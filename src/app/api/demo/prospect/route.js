// PUBLIC_API_ROUTE: investor-demo-prospect
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

const ALLOWED_ACTIONS = new Set(["express_interest", "enrich"]);
const ALLOWED_CONTACTS = new Set(["Call", "WhatsApp", "Email"]);
const MAX_NEW_LEADS_PER_MOBILE_PER_DAY = 3;

function text(value, max = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function digits(value) {
  return String(value || "").replace(/\D/g, "").slice(-15);
}

function validEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function hash(value, length = 48) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

function submissionKey(mobile) {
  return hash(`${mobile}|${dateKey()}`, 64);
}

function demoLeadDocumentId(sessionId, mobile) {
  return `demo_${hash(`${sessionId}|${mobile}`, 48)}`;
}

function demoActivityId(kind, sessionId, mobile, suffix = "") {
  return `demo_${kind}_${hash(`${sessionId}|${mobile}|${suffix}`, 40)}`;
}

function leadNotes({ action, interest, preferredContact }) {
  if (action === "enrich") {
    return `Personalised Investor App Demo prospect. Interest: ${interest}. Preferred contact: ${preferredContact}.`;
  }
  return "Prospect selected ‘Become part of GrowVest’ from the personalised Investor App Demo.";
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = ALLOWED_ACTIONS.has(body.action) ? body.action : "express_interest";
    const fullName = text(body.fullName, 80);
    const mobile = digits(body.mobile);
    const email = text(body.email, 120).toLowerCase();
    const city = text(body.city, 80);
    const interest = text(body.interest, 120) || "General GrowVest enquiry";
    const preferredContact = ALLOWED_CONTACTS.has(body.preferredContact) ? body.preferredContact : "WhatsApp";
    const demoSessionId = text(body.demoSessionId, 80);
    const agreedToBecomePart = body.agreedToBecomePart === true;
    const honeypot = text(body.companyWebsite, 100);

    // Quietly accept honeypot submissions without writing anything.
    if (honeypot) return Response.json({ ok: true });
    if (fullName.length < 2) return Response.json({ error: "Please enter your full name." }, { status: 400 });
    if (mobile.length < 10 || mobile.length > 15) return Response.json({ error: "Please enter a valid mobile number." }, { status: 400 });
    if (!validEmail(email)) return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
    if (!demoSessionId.startsWith("demo-") || demoSessionId.length < 8) {
      return Response.json({ error: "Your Demo Experience has expired. Please start the demo again." }, { status: 400 });
    }
    if (!agreedToBecomePart) {
      return Response.json({ error: "Please confirm that you would like to become part of GrowVest." }, { status: 400 });
    }

    const now = new Date();
    const dateReceived = now.toISOString().slice(0, 10);
    const timeReceived = now.toTimeString().slice(0, 5);
    const counterRef = adminDb.collection("counters").doc("leads");
    const rateRef = adminDb.collection("demoProspectSubmissions").doc(submissionKey(mobile));
    const leadRef = adminDb.collection("leads").doc(demoLeadDocumentId(demoSessionId, mobile));
    const createActivityRef = adminDb.collection("activityLogs").doc(demoActivityId("lead_created", demoSessionId, mobile));
    const interestActivityRef = adminDb.collection("activityLogs").doc(demoActivityId("interest", demoSessionId, mobile, dateKey()));
    const enrichActivityRef = adminDb.collection("activityLogs").doc(demoActivityId("enriched", demoSessionId, mobile));

    const result = await adminDb.runTransaction(async (transaction) => {
      const [leadSnapshot, rateSnapshot, counterSnapshot] = await Promise.all([
        transaction.get(leadRef),
        transaction.get(rateRef),
        transaction.get(counterRef)
      ]);

      if (leadSnapshot.exists) {
        const existing = leadSnapshot.data() || {};
        const leadCode = existing.leadCode || "";
        const updates = {
          demoLastInterestAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };

        if (action === "enrich") {
          // Public demo enrichment must never wipe or overwrite details that GrowVest
          // staff may already have added after the lead entered the normal workflow.
          if (email && !text(existing.email, 120)) updates.email = email;
          if (city && !text(existing.city, 80)) updates.city = city;
          if (interest && !text(existing.purposeOfInvestment, 120)) updates.purposeOfInvestment = interest;
          if (preferredContact && !text(existing.preferredContact, 40)) updates.preferredContact = preferredContact;
          updates.demoGuestEmail = email;
          updates.demoGuestCity = city;
          updates.demoGuestInterest = interest;
          updates.demoPreferredContact = preferredContact;
          updates.demoEnrichmentNote = leadNotes({ action, interest, preferredContact });
          updates.demoEnrichmentComplete = true;
          updates.demoEnrichedAt = FieldValue.serverTimestamp();
        }

        transaction.set(leadRef, updates, { merge: true });

        if (action === "express_interest") {
          transaction.set(interestActivityRef, {
            recordType: "lead",
            recordId: leadRef.id,
            leadId: leadRef.id,
            leadCode,
            leadName: existing.fullName || fullName,
            advisorUid: existing.assignedAdvisorUid || "",
            assignedAdvisorUid: existing.assignedAdvisorUid || "",
            action: "demo_interest_confirmed",
            title: "Prospect chose Become part of GrowVest",
            description: `${leadCode || "Existing lead"} reconfirmed interest through the personalised Investor App Demo.`,
            metadata: { source: "Investor App Demo", demoSessionId },
            createdByUid: "public_demo",
            createdByName: "Investor App Demo",
            createdAt: FieldValue.serverTimestamp()
          }, { merge: true });
        } else {
          transaction.set(enrichActivityRef, {
            recordType: "lead",
            recordId: leadRef.id,
            leadId: leadRef.id,
            leadCode,
            leadName: existing.fullName || fullName,
            advisorUid: existing.assignedAdvisorUid || "",
            assignedAdvisorUid: existing.assignedAdvisorUid || "",
            action: "demo_lead_enriched",
            title: "Demo prospect details updated",
            description: "The prospect added details after choosing Become part of GrowVest.",
            metadata: { source: "Investor App Demo", interest, preferredContact, city, emailProvided: Boolean(email) },
            createdByUid: "public_demo",
            createdByName: "Investor App Demo",
            createdAt: FieldValue.serverTimestamp()
          }, { merge: true });
        }

        return { leadId: leadRef.id, leadCode, created: false };
      }

      const attempts = rateSnapshot.exists ? Number(rateSnapshot.data()?.count || 0) : 0;
      if (attempts >= MAX_NEW_LEADS_PER_MOBILE_PER_DAY) {
        const error = new Error("We already received your details today. The GrowVest team can continue from your existing enquiry.");
        error.statusCode = 429;
        throw error;
      }

      const nextValue = (counterSnapshot.exists ? Number(counterSnapshot.data()?.value || 0) : 0) + 1;
      const leadCode = `GV-LD-${now.getFullYear()}-${String(nextValue).padStart(4, "0")}`;
      const notes = leadNotes({ action, interest, preferredContact });
      const lead = {
        leadCode,
        fullName,
        contactNo: mobile,
        mobile,
        email: action === "enrich" ? email : "",
        city: action === "enrich" ? city : "",
        source: "Investor App Demo",
        leadSource: "Investor App Demo",
        leadOrigin: "personalised_guest_investor_demo",
        serviceType: "Financial Planning",
        purposeOfInvestment: action === "enrich" ? interest : text(body.interest, 120),
        preferredContact: action === "enrich" ? preferredContact : "WhatsApp",
        referrer: "",
        qualificationScore: null,
        amount: null,
        followUpDue: "",
        notes,
        dateReceived,
        timeReceived,
        receivedAt: FieldValue.serverTimestamp(),
        status: "NEW",
        statusChangedAt: FieldValue.serverTimestamp(),
        stageEnteredAt: FieldValue.serverTimestamp(),
        lastContactAt: null,
        lastContactChannel: null,
        lastContactDate: null,
        nextAction: "Contact prospect who chose Become part of GrowVest.",
        assignedAdvisorUid: "",
        assignedAdvisorName: "Unassigned",
        createdByUid: "public_demo",
        createdByName: "Investor App Demo",
        isDeleted: false,
        convertedInvestorId: null,
        consentToContact: true,
        consentSource: "Become part of GrowVest CTA",
        consentCapturedAt: FieldValue.serverTimestamp(),
        conversionIntent: "BECOME_GROWVEST",
        demoSessionId,
        demoInterestConfirmedAt: FieldValue.serverTimestamp(),
        demoLastInterestAt: FieldValue.serverTimestamp(),
        demoEnrichmentComplete: action === "enrich",
        demoEnrichedAt: action === "enrich" ? FieldValue.serverTimestamp() : null,
        originalLeadFlow: "SOP 1 - Lead to Conversion",
        originalLeadFlowStartedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      transaction.set(counterRef, { value: nextValue, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(rateRef, {
        count: attempts + 1,
        mobileHash: submissionKey(mobile).slice(0, 16),
        dateKey: dateKey(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(leadRef, lead);
      transaction.set(createActivityRef, {
        recordType: "lead",
        recordId: leadRef.id,
        leadId: leadRef.id,
        leadCode,
        leadName: fullName,
        advisorUid: "",
        assignedAdvisorUid: "",
        action: "lead_created",
        title: "Prospect chose Become part of GrowVest",
        description: `${leadCode} entered the normal Lead to Conversion flow from the personalised Investor App Demo.`,
        metadata: {
          source: "Investor App Demo",
          demoSessionId,
          trigger: "Become part of GrowVest",
          flow: "SOP 1 - Lead to Conversion"
        },
        createdByUid: "public_demo",
        createdByName: "Investor App Demo",
        createdAt: FieldValue.serverTimestamp()
      });

      if (action === "enrich") {
        transaction.set(enrichActivityRef, {
          recordType: "lead",
          recordId: leadRef.id,
          leadId: leadRef.id,
          leadCode,
          leadName: fullName,
          advisorUid: "",
          assignedAdvisorUid: "",
          action: "demo_lead_enriched",
          title: "Demo prospect details captured",
          description: "The prospect provided additional details while entering the GrowVest lead journey.",
          metadata: { source: "Investor App Demo", interest, preferredContact, city, emailProvided: Boolean(email) },
          createdByUid: "public_demo",
          createdByName: "Investor App Demo",
          createdAt: FieldValue.serverTimestamp()
        });
      }

      return { leadId: leadRef.id, leadCode, created: true };
    });

    return Response.json({
      ok: true,
      leadId: result.leadId,
      leadCode: result.leadCode,
      created: result.created,
      flowStarted: true
    });
  } catch (error) {
    console.error("Investor demo prospect submission failed", error);
    return Response.json(
      { error: error?.message || "We could not save your GrowVest interest. Please try again." },
      { status: Number(error?.statusCode || 500) }
    );
  }
}
