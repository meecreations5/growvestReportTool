import { adminDb, appRequestErrorStatus, verifyStaffRequest } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function sortNewestFirst(rows = []) {
  return [...rows].sort((a, b) => {
    const createdDiff = timestampMillis(b.createdAt) - timestampMillis(a.createdAt);
    if (createdDiff) return createdDiff;
    return String(a.fullName || "").localeCompare(String(b.fullName || ""));
  });
}

async function loadAdvisorInvestors(uid) {
  // Historical Investor records used both advisorUid and assignedAdvisorUid.
  // Read both scopes server-side, then de-duplicate. This avoids a browser
  // Firestore list query failing merely because old records use the legacy key.
  const [assignedSnapshot, legacySnapshot] = await Promise.all([
    adminDb.collection("investors").where("assignedAdvisorUid", "==", uid).get(),
    adminDb.collection("investors").where("advisorUid", "==", uid).get()
  ]);

  const byId = new Map();
  [...assignedSnapshot.docs, ...legacySnapshot.docs].forEach((doc) => {
    const data = doc.data();
    if (data?.isDeleted === true) return;
    byId.set(doc.id, { id: doc.id, ...data });
  });
  return Array.from(byId.values());
}

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    const isAdmin = ["super_admin", "admin"].includes(actor.role);

    let investors;
    if (isAdmin) {
      // Do not require isDeleted == false in the Firestore query. Older Investor
      // profiles may predate that field and should still remain visible. Filtering
      // it in application code also avoids a composite-index dependency here.
      const snapshot = await adminDb.collection("investors").get();
      investors = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((item) => item.isDeleted !== true);
    } else {
      investors = await loadAdvisorInvestors(actor.uid);
    }

    return Response.json({ investors: sortNewestFirst(investors) }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    console.error("Investor list failed", error);
    return Response.json(
      { error: error?.message || "Unable to load investors." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
