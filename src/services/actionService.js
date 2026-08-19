import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { authenticatedApiHeaders } from "@/lib/firebase/apiAuth";
import { ACTION_TERMINAL_STATUSES } from "@/lib/constants/actions";

function rows(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function timeValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortActions(items = []) {
  return [...items].sort((a, b) => timeValue(b.updatedAt || b.createdAt) - timeValue(a.updatedAt || a.createdAt));
}

function isIndexUnavailable(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "failed-precondition" && message.includes("index");
}

async function authenticatedFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const headers = await authenticatedApiHeaders(options.headers || {}, user);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The action request could not be completed.");
  return payload;
}

function subscribeWithFallback(primaryQuery, fallbackQuery, callback, onError, limitCount = 200) {
  let fallbackUnsubscribe = () => {};
  const primaryUnsubscribe = onSnapshot(
    primaryQuery,
    (snapshot) => callback(rows(snapshot)),
    (error) => {
      if (!isIndexUnavailable(error)) {
        onError?.(error);
        return;
      }
      fallbackUnsubscribe = onSnapshot(
        fallbackQuery,
        (snapshot) => callback(sortActions(rows(snapshot)).slice(0, limitCount)),
        onError
      );
    }
  );
  return () => {
    primaryUnsubscribe();
    fallbackUnsubscribe();
  };
}

export function subscribeActionCentre(currentUser, callback, onError, limitCount = 250) {
  if (!currentUser?.id) {
    callback([]);
    return () => {};
  }

  if (["super_admin", "admin"].includes(currentUser.role)) {
    return onSnapshot(
      query(collection(db, "investorActions"), orderBy("updatedAt", "desc"), limit(limitCount)),
      (snapshot) => callback(rows(snapshot)),
      onError
    );
  }

  const primary = query(
    collection(db, "investorActions"),
    where("advisorUid", "==", currentUser.id),
    orderBy("updatedAt", "desc"),
    limit(limitCount)
  );
  const fallback = query(collection(db, "investorActions"), where("advisorUid", "==", currentUser.id));
  return subscribeWithFallback(primary, fallback, callback, onError, limitCount);
}

export function subscribeInvestorActions(investorId, currentUser, callback, onError, limitCount = 150) {
  if (!investorId) {
    callback([]);
    return () => {};
  }

  const constraints = [where("investorId", "==", investorId)];
  if (currentUser?.role === "advisor") constraints.push(where("advisorUid", "==", currentUser.id));
  if (currentUser?.role === "investor") constraints.push(where("investorVisible", "==", true));

  const primary = query(
    collection(db, "investorActions"),
    ...constraints,
    orderBy("updatedAt", "desc"),
    limit(limitCount)
  );
  const fallback = query(collection(db, "investorActions"), ...constraints);
  return subscribeWithFallback(primary, fallback, callback, onError, limitCount);
}

export function subscribeActionEvents(actionId, currentUser, callback, onError, limitCount = 100) {
  if (!actionId) {
    callback([]);
    return () => {};
  }
  const constraints = [where("actionId", "==", actionId)];
  if (currentUser?.role === "advisor") constraints.push(where("advisorUid", "==", currentUser.id));
  if (currentUser?.role === "investor") {
    // Firestore rules require ownership on every returned event. Keep the
    // investorId constraint in the query itself; client-side filtering cannot
    // satisfy Firestore security rules.
    constraints.push(where("investorId", "==", currentUser.investorId || "__missing_investor__"));
    constraints.push(where("investorVisible", "==", true));
  }
  const primary = query(collection(db, "investorActionEvents"), ...constraints, orderBy("createdAt", "desc"), limit(limitCount));
  const fallback = query(collection(db, "investorActionEvents"), ...constraints);
  return subscribeWithFallback(primary, fallback, callback, onError, limitCount);
}

export async function getOpenInvestorActionsOnce(investorId, currentUser, limitCount = 100) {
  if (!investorId || !currentUser?.id) return [];
  const constraints = [where("investorId", "==", investorId)];
  if (currentUser.role === "advisor") constraints.push(where("advisorUid", "==", currentUser.id));
  if (currentUser.role === "investor") constraints.push(where("investorVisible", "==", true));

  let result;
  try {
    result = await getDocs(query(collection(db, "investorActions"), ...constraints, orderBy("updatedAt", "desc"), limit(limitCount)));
  } catch (error) {
    if (!isIndexUnavailable(error)) throw error;
    result = await getDocs(query(collection(db, "investorActions"), ...constraints));
  }

  return sortActions(rows(result))
    .filter((item) => !ACTION_TERMINAL_STATUSES.includes(String(item.status || "")))
    .slice(0, limitCount);
}

export async function createInvestorAction(payload) {
  return authenticatedFetch("/api/actions", {
    method: "POST",
    body: JSON.stringify(payload || {})
  });
}

export async function updateInvestorAction(actionId, payload) {
  if (!actionId) throw new Error("Action is required.");
  return authenticatedFetch(`/api/actions/${actionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload || {})
  });
}

export async function syncMonthlyReportActions(reportId) {
  if (!reportId) return { synced: 0 };
  return authenticatedFetch("/api/actions/sync-report", {
    method: "POST",
    body: JSON.stringify({ reportId })
  });
}

export async function syncMomActions(momId) {
  if (!momId) return { synced: 0 };
  return authenticatedFetch("/api/actions/sync-mom", {
    method: "POST",
    body: JSON.stringify({ momId })
  });
}
