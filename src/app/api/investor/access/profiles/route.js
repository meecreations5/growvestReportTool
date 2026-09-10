import { NextResponse } from "next/server";
import { adminDb, AppRequestError, appRequestErrorStatus, verifyAppRequest } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

function clean(value = "") { return String(value || "").trim(); }

function relationshipLabel(value = "") {
  const normalized = clean(value).toLowerCase();
  const labels = { self: "Self", spouse: "Spouse", child: "Child", parent: "Parent", sibling: "Sibling", family: "Family Member", other: "Family Member" };
  return labels[normalized] || "Family Member";
}

export async function GET(request) {
  try {
    const actor = await verifyAppRequest(request);
    if (actor.role !== "investor" || actor.portalEnabled === false) {
      throw new AppRequestError("Investor Portal access is required.", 403, "investor_access_required");
    }

    const primaryInvestorId = clean(actor.primaryInvestorId || actor.investorId);
    const accountOwnerInvestorId = clean(actor.accountOwnerInvestorId || primaryInvestorId);
    const membershipSnapshot = await adminDb.collection("investorAccessMemberships")
      .where("uid", "==", actor.uid)
      .where("status", "==", "active")
      .get();

    const membershipMap = new Map();
    membershipSnapshot.docs.forEach((doc) => {
      const row = doc.data() || {};
      const investorId = clean(row.investorId);
      if (investorId) membershipMap.set(investorId, { id: doc.id, ...row });
    });

    const ids = new Set([
      primaryInvestorId,
      ...(Array.isArray(actor.accessibleInvestorIds) ? actor.accessibleInvestorIds.map(clean) : []),
      ...membershipMap.keys()
    ].filter(Boolean));

    if (!ids.size) throw new AppRequestError("This login is not linked to an Investor profile.", 403, "investor_link_missing");

    const snapshots = await adminDb.getAll(...[...ids].map((id) => adminDb.collection("investors").doc(id)));
    const profiles = snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => {
        const investor = snapshot.data() || {};
        const membership = membershipMap.get(snapshot.id) || {};
        return {
          investorId: snapshot.id,
          fullName: investor.fullName || investor.name || "GrowVest Investor",
          clientCode: investor.clientCode || "",
          photoURL: investor.photoURL || investor.profilePhotoURL || "",
          relationship: snapshot.id === accountOwnerInvestorId ? "Self" : relationshipLabel(membership.relationship),
          permission: membership.permission || "full",
          isPrimary: snapshot.id === primaryInvestorId,
          portalEnabled: investor.portalEnabled !== false && investor.status !== "inactive",
          status: investor.status || "active"
        };
      })
      .filter((item) => item.portalEnabled && item.status !== "inactive")
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.fullName.localeCompare(b.fullName));

    return NextResponse.json({ success: true, profiles, primaryInvestorId });
  } catch (error) {
    console.error("Investor access profiles failed", error);
    return NextResponse.json({ error: error?.message || "Investor access profiles could not be loaded." }, { status: appRequestErrorStatus(error, 500) });
  }
}
