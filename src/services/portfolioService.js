import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

function rows(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function isIndexUnavailableError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "failed-precondition" && message.includes("index");
}

function dateSortValue(value) {
  if (!value) return 0;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
}

function latestByDate(items, field) {
  return [...items].sort((a, b) => dateSortValue(b?.[field]) - dateSortValue(a?.[field]))[0] || null;
}

function subscribeWithIndexFallback(primaryQuery, fallbackQuery, onPrimarySnapshot, onFallbackSnapshot, onError) {
  let activeUnsubscribe = () => {};
  let closed = false;
  let fallbackStarted = false;

  const startFallback = () => {
    if (closed || fallbackStarted) return;
    fallbackStarted = true;
    activeUnsubscribe = onSnapshot(
      fallbackQuery,
      onFallbackSnapshot,
      (error) => {
        if (!closed) onError?.(error);
      }
    );
  };

  activeUnsubscribe = onSnapshot(
    primaryQuery,
    onPrimarySnapshot,
    (error) => {
      if (isIndexUnavailableError(error)) {
        startFallback();
        return;
      }
      if (!closed) onError?.(error);
    }
  );

  return () => {
    closed = true;
    activeUnsubscribe?.();
  };
}

async function authenticatedFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has expired. Sign in again.");
  const token = await user.getIdToken();
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The portfolio request failed.");
  return payload;
}

export function subscribeInvestorPortfolio(investorId, currentUser, callback, onError) {
  if (!investorId) {
    callback([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, "portfolioPositions"), where("investorId", "==", investorId), ...(currentUser?.role === "advisor" ? [where("advisorUid", "==", currentUser.id)] : [])),
    (snapshot) => callback(rows(snapshot).filter((item) => !["inactive", "exited"].includes(item.status)).sort((a, b) => Number(b.currentValue || 0) - Number(a.currentValue || 0))),
    onError
  );
}

export function subscribeInvestorUlipPolicies(investorId, currentUser, callback, onError) {
  if (!investorId) {
    callback([]);
    return () => {};
  }
  const ownership = currentUser?.role === "advisor" ? [where("advisorUid", "==", currentUser.id)] : [];
  return onSnapshot(
    query(collection(db, "ulipPolicies"), where("investorId", "==", investorId), ...ownership),
    (snapshot) => callback(rows(snapshot).filter((item) => item.status !== "inactive").sort((a, b) => String(a.policyNumber || "").localeCompare(String(b.policyNumber || "")))),
    onError
  );
}

export function subscribePortfolioSnapshotHistory(investorId, currentUser, callback, onError, limitCount = 8) {
  if (!investorId) {
    callback([]);
    return () => {};
  }
  const ownership = currentUser?.role === "advisor" ? [where("advisorUid", "==", currentUser.id)] : [];
  const primaryQuery = query(
    collection(db, "portfolioSnapshots"),
    where("investorId", "==", investorId),
    ...ownership,
    orderBy("snapshotDate", "desc"),
    limit(limitCount)
  );
  const fallbackQuery = query(
    collection(db, "portfolioSnapshots"),
    where("investorId", "==", investorId),
    ...ownership
  );

  return subscribeWithIndexFallback(
    primaryQuery,
    fallbackQuery,
    (snapshot) => callback(rows(snapshot)),
    (snapshot) => callback([...rows(snapshot)]
      .sort((a, b) => dateSortValue(b.snapshotDate) - dateSortValue(a.snapshotDate))
      .slice(0, limitCount)),
    onError
  );
}

export function subscribeRecentInvestmentTransactions(investorId, currentUser, callback, onError, limitCount = 300) {
  if (!investorId) {
    callback([]);
    return () => {};
  }
  const ownership = currentUser?.role === "advisor" ? [where("advisorUid", "==", currentUser.id)] : [];
  const primaryQuery = query(
    collection(db, "investmentTransactions"),
    where("investorId", "==", investorId),
    ...ownership,
    orderBy("transactionDate", "desc"),
    limit(limitCount)
  );
  const fallbackQuery = query(
    collection(db, "investmentTransactions"),
    where("investorId", "==", investorId),
    ...ownership
  );

  return subscribeWithIndexFallback(
    primaryQuery,
    fallbackQuery,
    (snapshot) => callback(rows(snapshot)),
    (snapshot) => callback([...rows(snapshot)]
      .sort((a, b) => dateSortValue(b.transactionDate) - dateSortValue(a.transactionDate))
      .slice(0, limitCount)),
    onError
  );
}

export function subscribeLatestPortfolioSnapshot(investorId, currentUser, callback, onError) {
  if (!investorId) {
    callback(null);
    return () => {};
  }
  const ownership = currentUser?.role === "advisor" ? [where("advisorUid", "==", currentUser.id)] : [];
  const primaryQuery = query(
    collection(db, "portfolioSnapshots"),
    where("investorId", "==", investorId),
    ...ownership,
    orderBy("snapshotDate", "desc"),
    limit(1)
  );
  const fallbackQuery = query(collection(db, "portfolioSnapshots"), where("investorId", "==", investorId), ...ownership);

  return subscribeWithIndexFallback(
    primaryQuery,
    fallbackQuery,
    (snapshot) => callback(snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }),
    (snapshot) => callback(latestByDate(rows(snapshot), "snapshotDate")),
    onError
  );
}

export function subscribeInvestorTrading(investorId, currentUser, callback, onError) {
  if (!investorId) {
    callback([]);
    return () => {};
  }
  const ownership = currentUser?.role === "advisor" ? [where("advisorUid", "==", currentUser.id)] : [];
  const primaryQuery = query(
    collection(db, "tradingTransactions"),
    where("investorId", "==", investorId),
    ...ownership,
    orderBy("tradeDate", "desc"),
    limit(150)
  );
  const fallbackQuery = query(collection(db, "tradingTransactions"), where("investorId", "==", investorId), ...ownership);

  return subscribeWithIndexFallback(
    primaryQuery,
    fallbackQuery,
    (snapshot) => callback(rows(snapshot)),
    (snapshot) => callback([...rows(snapshot)].sort((a, b) => dateSortValue(b.tradeDate) - dateSortValue(a.tradeDate)).slice(0, 150)),
    onError
  );
}

export function subscribePortfolioImports(currentUser, callback, onError) {
  if (!currentUser?.id) {
    callback([]);
    return () => {};
  }
  if (currentUser.role !== "advisor") {
    return onSnapshot(
      query(collection(db, "portfolioImports"), orderBy("createdAt", "desc"), limit(50)),
      (snapshot) => callback(rows(snapshot)),
      onError
    );
  }

  const primaryQuery = query(
    collection(db, "portfolioImports"),
    where("advisorUid", "==", currentUser.id),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const fallbackQuery = query(collection(db, "portfolioImports"), where("advisorUid", "==", currentUser.id));
  return subscribeWithIndexFallback(
    primaryQuery,
    fallbackQuery,
    (snapshot) => callback(rows(snapshot)),
    (snapshot) => callback([...rows(snapshot)].sort((a, b) => dateSortValue(b.createdAt) - dateSortValue(a.createdAt)).slice(0, 50)),
    onError
  );
}

export async function previewPortfolioImport(files = []) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  return authenticatedFetch("/api/portfolio/imports/preview", { method: "POST", body: formData });
}

export async function commitPortfolioImport(batchId, mappings = []) {
  return authenticatedFetch("/api/portfolio/imports/fundbazaar/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batchId, mappings })
  });
}

export async function mapGenericPortfolioImport(batchId, fileId, file, config = {}) {
  const formData = new FormData();
  formData.append("batchId", batchId);
  formData.append("fileId", fileId);
  formData.append("file", file);
  formData.append("config", JSON.stringify(config));
  return authenticatedFetch("/api/portfolio/imports/generic/map", { method: "POST", body: formData });
}

// Backward-compatible aliases for any older screens still importing these names.
export const previewFundbazaarImport = previewPortfolioImport;
export const commitFundbazaarImport = commitPortfolioImport;

export async function updatePortfolioGoal(positionId, goalId = "") {
  return authenticatedFetch(`/api/portfolio/positions/${positionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goalId })
  });
}

export async function createManualPortfolioPosition(payload) {
  return authenticatedFetch("/api/portfolio/positions/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function recordDeliverySale(positionId, payload) {
  return authenticatedFetch(`/api/portfolio/positions/${positionId}/sell`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function createManualIntradayTrade(payload) {
  return authenticatedFetch("/api/portfolio/trading/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function getPortfolioReportSource(investorId, asOfDate, currentUser) {
  if (!investorId || !asOfDate) return null;
  const ownership = currentUser?.role === "advisor" ? [where("advisorUid", "==", currentUser.id)] : [];

  let snapshot = null;
  try {
    const snapshotResult = await getDocs(query(
      collection(db, "portfolioSnapshots"),
      where("investorId", "==", investorId),
      ...ownership,
      where("verificationStatus", "==", "verified"),
      where("snapshotDate", "<=", asOfDate),
      orderBy("snapshotDate", "desc"),
      limit(1)
    ));
    snapshot = snapshotResult.empty ? null : { id: snapshotResult.docs[0].id, ...snapshotResult.docs[0].data() };
  } catch (error) {
    if (!isIndexUnavailableError(error)) throw error;
    const fallbackResult = await getDocs(query(collection(db, "portfolioSnapshots"), where("investorId", "==", investorId), ...ownership));
    snapshot = latestByDate(
      rows(fallbackResult).filter((item) => item.verificationStatus === "verified" && String(item.snapshotDate || "") <= asOfDate),
      "snapshotDate"
    );
  }

  if (!snapshot) return null;

  const positionResult = await getDocs(query(
    collection(db, "portfolioSnapshotPositions"),
    where("snapshotId", "==", snapshot.id),
    ...ownership
  ));

  const monthKey = String(asOfDate || "").slice(0, 7);
  const monthStart = monthKey ? `${monthKey}-01` : "";
  let openingSnapshot = null;

  if (monthStart) {
    try {
      const openingResult = await getDocs(query(
        collection(db, "portfolioSnapshots"),
        where("investorId", "==", investorId),
        ...ownership,
        where("verificationStatus", "==", "verified"),
        where("snapshotDate", "<", monthStart),
        orderBy("snapshotDate", "desc"),
        limit(1)
      ));
      openingSnapshot = openingResult.empty ? null : { id: openingResult.docs[0].id, ...openingResult.docs[0].data() };
    } catch (error) {
      if (!isIndexUnavailableError(error)) throw error;
      const fallbackOpening = await getDocs(query(collection(db, "portfolioSnapshots"), where("investorId", "==", investorId), ...ownership));
      openingSnapshot = latestByDate(
        rows(fallbackOpening).filter((item) => item.verificationStatus === "verified" && String(item.snapshotDate || "") < monthStart),
        "snapshotDate"
      );
    }
  }

  let openingPositions = [];
  if (openingSnapshot?.id) {
    const openingPositionsResult = await getDocs(query(
      collection(db, "portfolioSnapshotPositions"),
      where("snapshotId", "==", openingSnapshot.id),
      ...ownership
    ));
    openingPositions = rows(openingPositionsResult);
  }

  let transactions = [];
  if (monthStart) {
    try {
      const transactionResult = await getDocs(query(
        collection(db, "investmentTransactions"),
        where("investorId", "==", investorId),
        ...ownership,
        where("transactionDate", ">=", monthStart),
        where("transactionDate", "<=", asOfDate),
        orderBy("transactionDate", "asc")
      ));
      transactions = rows(transactionResult);
    } catch (error) {
      if (!isIndexUnavailableError(error)) throw error;
      const fallbackTransactions = await getDocs(query(collection(db, "investmentTransactions"), where("investorId", "==", investorId), ...ownership));
      transactions = rows(fallbackTransactions)
        .filter((item) => String(item.transactionDate || "") >= monthStart && String(item.transactionDate || "") <= asOfDate)
        .sort((a, b) => dateSortValue(a.transactionDate) - dateSortValue(b.transactionDate));
    }
  }

  const tradingRef = monthKey ? doc(db, "tradingMonthlySummaries", `${investorId}_${monthKey}`) : null;
  const tradingDoc = tradingRef ? await getDoc(tradingRef) : null;
  const tradingSummary = tradingDoc?.exists() ? { id: tradingDoc.id, ...tradingDoc.data() } : null;
  return {
    asOfDate,
    snapshot,
    openingSnapshot,
    positions: rows(positionResult),
    openingPositions,
    transactions,
    tradingSummary
  };
}

export async function getPortfolioImportRecovery(batchId) {
  return authenticatedFetch(`/api/portfolio/imports/${batchId}/recovery`);
}

export async function recoverPortfolioImport(batchId, payload) {
  return authenticatedFetch(`/api/portfolio/imports/${batchId}/recovery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function getDailyPortfolioCoverage(dateKey = "") {
  const queryString = dateKey ? `?date=${encodeURIComponent(dateKey)}` : "";
  return authenticatedFetch(`/api/portfolio/coverage${queryString}`);
}

export async function setDailyPortfolioTracking(investorId, enabled) {
  return authenticatedFetch("/api/portfolio/coverage", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ investorId, enabled })
  });
}

export async function getPortfolioReconciliation() {
  return authenticatedFetch("/api/portfolio/reconciliation");
}
