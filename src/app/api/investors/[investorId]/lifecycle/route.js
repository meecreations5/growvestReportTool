import { NextResponse } from "next/server";
import {
  adminAuth,
  adminDb,
  appRequestErrorStatus,
  verifyStaffRequest
} from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

const ADMIN_ROLES = new Set(["super_admin", "admin"]);

function requireAdmin(actor) {
  if (!ADMIN_ROLES.has(actor?.role)) {
    const error = new Error("Only Admin or Super Admin can manage Investor status.");
    error.statusCode = 403;
    throw error;
  }
}

function cleanReason(value = "", minimum = 3) {
  const reason = String(value || "").trim();
  if (reason.length < minimum) {
    const error = new Error(`Enter a reason of at least ${minimum} characters.`);
    error.statusCode = 422;
    throw error;
  }
  return reason;
}

async function linkedInvestorUsers(investorId) {
  const snapshot = await adminDb.collection("users").where("investorId", "==", investorId).get();
  return snapshot.docs;
}

async function setFirebaseUsersDisabled(userDocs, disabled) {
  await Promise.all(userDocs.map(async (item) => {
    try {
      await adminAuth.updateUser(item.id, { disabled });
      if (disabled) await adminAuth.revokeRefreshTokens(item.id);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
  }));
}

async function investorImpact(investorId) {
  const collections = {
    portfolioHoldings: "portfolioPositions",
    investmentTransactions: "investmentTransactions",
    tradingTransactions: "tradingTransactions",
    ulipPolicies: "ulipPolicies",
    portfolioSnapshots: "portfolioSnapshots",
    monthlyReports: "monthlyReports",
    documents: "investorDocuments",
    meetings: "meetings",
    advisorFollowUps: "investorActions",
    sipSchedules: "sipFundingSchedules"
  };

  const entries = await Promise.all(Object.entries(collections).map(async ([key, collectionName]) => {
    const snapshot = await adminDb.collection(collectionName).where("investorId", "==", investorId).get();
    return [key, snapshot.size];
  }));

  const linkedUsers = await linkedInvestorUsers(investorId);
  return {
    ...Object.fromEntries(entries),
    linkedPortalAccounts: linkedUsers.length
  };
}

async function setInvestorAliases(investor, status, batch) {
  if (investor.portalUsername) {
    batch.set(adminDb.collection("usernames").doc(investor.portalUsername), {
      status,
      updatedAt: new Date()
    }, { merge: true });
  }

  if (investor.portalGoogleEmail) {
    batch.set(adminDb.collection("investorLoginAliases").doc(investor.portalGoogleEmail), {
      status,
      portalEnabled: status === "active",
      updatedAt: new Date()
    }, { merge: true });
  }
}

async function pauseSipSchedules(investorId, batch) {
  const schedules = await adminDb.collection("sipFundingSchedules").where("investorId", "==", investorId).get();
  schedules.docs.forEach((item) => {
    const data = item.data() || {};
    if (data.active === false) return;
    batch.set(item.ref, {
      active: false,
      pausedByInvestorLifecycle: true,
      pausedAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });
  });
  return schedules.size;
}

async function resumeLifecycleSipSchedules(investorId, batch) {
  const schedules = await adminDb.collection("sipFundingSchedules").where("investorId", "==", investorId).get();
  let resumed = 0;
  schedules.docs.forEach((item) => {
    const data = item.data() || {};
    if (data.pausedByInvestorLifecycle !== true) return;
    resumed += 1;
    batch.set(item.ref, {
      active: true,
      pausedByInvestorLifecycle: false,
      resumedAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });
  });
  return resumed;
}

async function deactivateExternalMappings(investorId, batch) {
  const snapshot = await adminDb.collection("externalInvestorMappings").where("investorId", "==", investorId).get();
  snapshot.docs.forEach((item) => {
    batch.set(item.ref, {
      status: "inactive",
      active: false,
      investorDeleted: true,
      updatedAt: new Date()
    }, { merge: true });
  });
  return snapshot.size;
}

function lifecycleActivity({ investor, actor, action, title, description, reason, metadata = {} }) {
  return {
    recordType: "investor",
    recordId: investor.id,
    investorId: investor.id,
    clientCode: investor.clientCode || "",
    leadId: investor.leadId || "",
    leadCode: investor.leadCode || "",
    leadName: investor.fullName || "Investor",
    advisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
    assignedAdvisorUid: investor.assignedAdvisorUid || investor.advisorUid || actor.uid,
    action,
    title,
    description,
    metadata: { reason, ...metadata },
    createdByUid: actor.uid,
    createdByName: actor.fullName || actor.email || "Admin",
    createdAt: new Date()
  };
}

export async function POST(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    requireAdmin(actor);
    const { investorId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").trim().toLowerCase();
    const investorRef = adminDb.collection("investors").doc(String(investorId || ""));
    const investorSnapshot = await investorRef.get();

    if (!investorSnapshot.exists) {
      return NextResponse.json({ error: "Investor profile was not found." }, { status: 404 });
    }

    const investor = { id: investorSnapshot.id, ...investorSnapshot.data() };

    if (action === "preview_delete") {
      const impact = await investorImpact(investor.id);
      return NextResponse.json({
        success: true,
        investor: {
          id: investor.id,
          fullName: investor.fullName || "Investor",
          clientCode: investor.clientCode || ""
        },
        impact,
        retentionNotice: "Delete removes the Investor from active GrowVest views and disables portal access. Financial records, published reports, documents and audit history are retained for traceability."
      });
    }

    if (investor.isDeleted === true || investor.lifecycleStatus === "deleted") {
      return NextResponse.json({ error: "This Investor has already been deleted from active GrowVest records." }, { status: 409 });
    }

    if (action === "disable") {
      const reason = cleanReason(body.reason, 3);
      if (String(investor.status || "active").toLowerCase() === "inactive") {
        return NextResponse.json({ success: true, status: "inactive", message: "Investor is already disabled." });
      }

      const linkedUsers = await linkedInvestorUsers(investor.id);
      await setFirebaseUsersDisabled(linkedUsers, true);
      const batch = adminDb.batch();
      const portalWasEnabled = investor.portalEnabled === true;
      const pausedSipSchedules = await pauseSipSchedules(investor.id, batch);

      batch.set(investorRef, {
        status: "inactive",
        lifecycleStatus: "disabled",
        portalEnabled: false,
        portalStatus: "disabled",
        lifecyclePortalWasEnabled: portalWasEnabled,
        disabledAt: new Date(),
        disabledByUid: actor.uid,
        disabledByName: actor.fullName || actor.email || "Admin",
        disabledReason: reason,
        updatedAt: new Date()
      }, { merge: true });

      linkedUsers.forEach((item) => {
        const data = item.data() || {};
        batch.set(item.ref, {
          status: "inactive",
          portalEnabled: false,
          disabledByInvestorLifecycle: true,
          lifecyclePreviousStatus: data.status || "active",
          lifecyclePreviousPortalEnabled: data.portalEnabled === true,
          updatedAt: new Date()
        }, { merge: true });
      });
      await setInvestorAliases(investor, "inactive", batch);

      batch.set(adminDb.collection("activityLogs").doc(), lifecycleActivity({
        investor,
        actor,
        action: "investor_disabled",
        title: "Investor disabled",
        description: `${investor.fullName || "Investor"} was disabled by ${actor.fullName || actor.email || "Admin"}.`,
        reason,
        metadata: { linkedPortalAccounts: linkedUsers.length, pausedSipSchedules, portalWasEnabled }
      }));

      await batch.commit();
      return NextResponse.json({ success: true, status: "inactive", pausedSipSchedules });
    }

    if (action === "enable") {
      const reason = cleanReason(body.reason, 3);
      const shouldRestorePortal = investor.lifecyclePortalWasEnabled === true;
      const linkedUsers = await linkedInvestorUsers(investor.id);
      const lifecycleUsers = linkedUsers.filter((item) => item.data()?.disabledByInvestorLifecycle === true);
      const authUsersToEnable = shouldRestorePortal
        ? lifecycleUsers.filter((item) => {
          const data = item.data() || {};
          return (data.lifecyclePreviousStatus || "active") === "active" && data.lifecyclePreviousPortalEnabled !== false;
        })
        : [];
      if (authUsersToEnable.length) await setFirebaseUsersDisabled(authUsersToEnable, false);
      const batch = adminDb.batch();
      const resumedSipSchedules = await resumeLifecycleSipSchedules(investor.id, batch);

      batch.set(investorRef, {
        status: "active",
        lifecycleStatus: "active",
        portalEnabled: shouldRestorePortal,
        portalStatus: shouldRestorePortal ? "active" : "disabled",
        enabledAt: new Date(),
        enabledByUid: actor.uid,
        enabledByName: actor.fullName || actor.email || "Admin",
        enabledReason: reason,
        disabledReason: "",
        updatedAt: new Date()
      }, { merge: true });

      lifecycleUsers.forEach((item) => {
        const data = item.data() || {};
        const previousStatus = data.lifecyclePreviousStatus || "active";
        const previousPortalEnabled = data.lifecyclePreviousPortalEnabled === true;
        batch.set(item.ref, {
          status: shouldRestorePortal ? previousStatus : "inactive",
          portalEnabled: shouldRestorePortal && previousPortalEnabled,
          disabledByInvestorLifecycle: false,
          lifecyclePreviousStatus: null,
          lifecyclePreviousPortalEnabled: null,
          updatedAt: new Date()
        }, { merge: true });
      });
      await setInvestorAliases(investor, shouldRestorePortal ? "active" : "inactive", batch);

      batch.set(adminDb.collection("activityLogs").doc(), lifecycleActivity({
        investor,
        actor,
        action: "investor_enabled",
        title: "Investor enabled",
        description: `${investor.fullName || "Investor"} was enabled by ${actor.fullName || actor.email || "Admin"}.`,
        reason,
        metadata: { linkedPortalAccounts: linkedUsers.length, resumedSipSchedules, portalRestored: shouldRestorePortal }
      }));

      await batch.commit();
      return NextResponse.json({ success: true, status: "active", resumedSipSchedules, portalRestored: shouldRestorePortal });
    }

    if (action === "delete") {
      const reason = cleanReason(body.reason, 5);
      if (String(body.confirmation || "").trim().toUpperCase() !== "DELETE") {
        return NextResponse.json({ error: "Type DELETE to confirm Investor deletion." }, { status: 422 });
      }

      const [impact, linkedUsers] = await Promise.all([
        investorImpact(investor.id),
        linkedInvestorUsers(investor.id)
      ]);
      await setFirebaseUsersDisabled(linkedUsers, true);
      const batch = adminDb.batch();
      const pausedSipSchedules = await pauseSipSchedules(investor.id, batch);
      const disabledMappings = await deactivateExternalMappings(investor.id, batch);

      batch.set(investorRef, {
        isDeleted: true,
        status: "inactive",
        lifecycleStatus: "deleted",
        portalEnabled: false,
        portalStatus: "disabled",
        deletedAt: new Date(),
        deletedByUid: actor.uid,
        deletedByName: actor.fullName || actor.email || "Admin",
        deleteReason: reason,
        updatedAt: new Date()
      }, { merge: true });

      linkedUsers.forEach((item) => {
        batch.set(item.ref, {
          status: "inactive",
          portalEnabled: false,
          investorDeleted: true,
          updatedAt: new Date()
        }, { merge: true });
      });
      await setInvestorAliases(investor, "inactive", batch);

      batch.set(adminDb.collection("activityLogs").doc(), lifecycleActivity({
        investor,
        actor,
        action: "investor_deleted",
        title: "Investor deleted from active records",
        description: `${investor.fullName || "Investor"} was removed from active GrowVest Investor records by ${actor.fullName || actor.email || "Admin"}. Financial and audit history was retained.`,
        reason,
        metadata: { ...impact, pausedSipSchedules, disabledMappings, deletionMode: "soft_delete_with_retention" }
      }));

      await batch.commit();
      return NextResponse.json({
        success: true,
        status: "deleted",
        impact,
        message: "Investor was removed from active records. Retained financial and audit history was not physically erased."
      });
    }

    return NextResponse.json({ error: "Unsupported Investor lifecycle action." }, { status: 422 });
  } catch (error) {
    console.error("Investor lifecycle action failed", error);
    return NextResponse.json({ error: error.message || "Unable to manage Investor status." }, { status: appRequestErrorStatus(error, error?.statusCode || 500) });
  }
}
