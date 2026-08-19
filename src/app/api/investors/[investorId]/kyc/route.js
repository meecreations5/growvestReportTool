import { FieldValue } from "firebase-admin/firestore";
import { adminDb, canStaffAccessRecord, verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import { encryptAadhaar, isValidPan, normaliseAadhaar, normalisePan } from "@/lib/server/kycSecurity";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    const { investorId } = await params;
    const investorRef = adminDb.collection("investors").doc(String(investorId || ""));
    const investorSnapshot = await investorRef.get();
    if (!investorSnapshot.exists) return Response.json({ error: "Investor profile was not found." }, { status: 404 });
    const investor = { id: investorSnapshot.id, ...investorSnapshot.data() };
    if (!canStaffAccessRecord(actor, investor)) return Response.json({ error: "You are not authorised to update this investor." }, { status: 403 });

    const payload = await request.json();
    const panNumber = normalisePan(payload?.panNumber || "");
    const aadhaarNumber = normaliseAadhaar(payload?.aadhaarNumber || "");
    const removeAadhaar = payload?.removeAadhaar === true;
    if (!isValidPan(panNumber)) return Response.json({ error: "Enter a valid PAN number." }, { status: 400 });
    if (panNumber) {
      const panMatches = await adminDb.collection("investors").where("panNormalized", "==", panNumber).get();
      const duplicatePan = panMatches.docs.find((item) => item.id !== investor.id && item.data()?.isDeleted !== true);
      if (duplicatePan) return Response.json({ error: "This PAN number is already linked to another GrowVest investor." }, { status: 409 });
    }

    const batch = adminDb.batch();
    const secureRef = adminDb.collection("investorKycSecure").doc(investor.id);
    const investorUpdates = {
      panNumber,
      panNormalized: panNumber,
      kycUpdatedAt: FieldValue.serverTimestamp(),
      kycUpdatedByUid: actor.uid,
      kycUpdatedByName: actor.fullName || actor.email || "GrowVest User",
      updatedAt: FieldValue.serverTimestamp()
    };

    let aadhaarChanged = false;
    if (removeAadhaar) {
      batch.delete(secureRef);
      Object.assign(investorUpdates, { aadhaarConfigured: false, aadhaarLast4: "" });
      aadhaarChanged = true;
    } else if (aadhaarNumber) {
      const protectedValue = encryptAadhaar(aadhaarNumber);
      const aadhaarMatches = await adminDb.collection("investorKycSecure")
        .where("aadhaarLookupHash", "==", protectedValue.aadhaarLookupHash)
        .limit(2)
        .get();
      const duplicateAadhaar = aadhaarMatches.docs.find((item) => item.id !== investor.id);
      if (duplicateAadhaar) {
        return Response.json({ error: "This Aadhaar number is already linked to another GrowVest investor." }, { status: 409 });
      }
      batch.set(secureRef, {
        investorId: investor.id,
        ...protectedValue,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: actor.uid
      }, { merge: true });
      Object.assign(investorUpdates, { aadhaarConfigured: true, aadhaarLast4: protectedValue.last4 });
      aadhaarChanged = true;
    }

    batch.update(investorRef, investorUpdates);
    const activityRef = adminDb.collection("activityLogs").doc();
    batch.set(activityRef, {
      recordType: "investor",
      recordId: investor.id,
      investorId: investor.id,
      clientCode: investor.clientCode || "",
      leadName: investor.fullName || "Investor",
      advisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || "",
      action: "investor_kyc_identifiers_updated",
      title: "Investor KYC identifiers updated",
      description: `${investor.fullName || "Investor"}'s KYC identifiers were updated. Sensitive identifier values are not written to the activity log.`,
      metadata: {
        panConfigured: Boolean(panNumber),
        aadhaarChanged,
        aadhaarConfigured: removeAadhaar ? false : (aadhaarNumber ? true : Boolean(investor.aadhaarConfigured))
      },
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email || "GrowVest User",
      createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();

    return Response.json({
      panNumber,
      aadhaarConfigured: removeAadhaar ? false : (aadhaarNumber ? true : Boolean(investor.aadhaarConfigured)),
      aadhaarLast4: removeAadhaar ? "" : (aadhaarNumber ? aadhaarNumber.slice(-4) : investor.aadhaarLast4 || "")
    });
  } catch (error) {
    console.error("Investor KYC update failed", error);
    return Response.json({ error: error?.message || "Unable to update investor KYC details." }, { status: appRequestErrorStatus(error, 500) });
  }
}
