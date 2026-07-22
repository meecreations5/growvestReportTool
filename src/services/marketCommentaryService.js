import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  COMMENTARY_SCOPE,
  COMMENTARY_STATUS,
  createEmptyMarketCommentary
} from "@/lib/constants/marketCommentary";
import { getReportMonthKey } from "@/lib/constants/report";

function timestampValue(value) {
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime() || 0;
  return 0;
}

function normaliseStringList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }
  return [...new Set(String(value || "").split(",").map((item) => item.trim()).filter(Boolean))];
}

function cleanPayload(value = {}) {
  const scope = value.scope || COMMENTARY_SCOPE.MONTHLY;
  const reportMonth = scope === COMMENTARY_SCOPE.MONTHLY ? Number(value.reportMonth || new Date().getMonth() + 1) : null;
  const reportYear = scope === COMMENTARY_SCOPE.MONTHLY ? Number(value.reportYear || new Date().getFullYear()) : null;

  return {
    title: String(value.title || "").trim(),
    category: value.category || "monthly_summary",
    scope,
    reportMonth,
    reportYear,
    reportMonthKey: scope === COMMENTARY_SCOPE.MONTHLY ? getReportMonthKey(reportYear, reportMonth) : "reusable",
    summary: String(value.summary || "").trim(),
    content: String(value.content || "").trim(),
    tags: normaliseStringList(value.tags),
    applicableAssetClasses: normaliseStringList(value.applicableAssetClasses),
    investorVisible: value.investorVisible !== false,
    internalNote: String(value.internalNote || "").trim()
  };
}

function userName(currentUser) {
  return currentUser?.fullName || currentUser?.email || "GrowVest User";
}

function sortRows(rows = []) {
  return [...rows].sort((a, b) => {
    const statusRank = {
      [COMMENTARY_STATUS.APPROVED]: 0,
      [COMMENTARY_STATUS.DRAFT]: 1,
      [COMMENTARY_STATUS.ARCHIVED]: 2
    };
    const statusDifference = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    if (statusDifference) return statusDifference;
    const monthDifference = String(b.reportMonthKey || "").localeCompare(String(a.reportMonthKey || ""));
    if (monthDifference) return monthDifference;
    const updatedDifference = timestampValue(b.updatedAt) - timestampValue(a.updatedAt);
    if (updatedDifference) return updatedDifference;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

export function subscribeMarketCommentaries(currentUser, callback, onError) {
  if (!currentUser?.id) {
    callback([]);
    return () => {};
  }

  const reference = query(collection(db, "marketCommentaries"), orderBy("updatedAt", "desc"));
  return onSnapshot(
    reference,
    (snapshot) => callback(sortRows(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))),
    onError
  );
}

export async function getMarketCommentary(commentaryId) {
  if (!commentaryId) return null;
  const snapshot = await getDoc(doc(db, "marketCommentaries", commentaryId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createMarketCommentary(value, currentUser) {
  const payload = cleanPayload(value);
  if (!payload.title) throw new Error("Commentary title is required.");
  if (!payload.content) throw new Error("Commentary content is required.");

  const reference = doc(collection(db, "marketCommentaries"));
  const now = serverTimestamp();
  const record = {
    ...createEmptyMarketCommentary(),
    ...payload,
    status: COMMENTARY_STATUS.DRAFT,
    version: 1,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    createdByUid: currentUser.id,
    createdByName: userName(currentUser),
    updatedByUid: currentUser.id,
    updatedByName: userName(currentUser),
    approvedAt: null,
    approvedByUid: null,
    approvedByName: "",
    archivedAt: null,
    archivedByUid: null,
    archivedByName: ""
  };

  await setDoc(reference, record);
  await setDoc(doc(db, "marketCommentaries", reference.id, "versions", `r1`), {
    ...record,
    commentaryId: reference.id,
    snapshotType: "created",
    savedAt: now,
    savedByUid: currentUser.id,
    savedByName: userName(currentUser)
  });
  return reference.id;
}

export async function saveMarketCommentaryDraft(commentaryId, value, currentUser) {
  if (!commentaryId) return createMarketCommentary(value, currentUser);
  const reference = doc(db, "marketCommentaries", commentaryId);
  const cleaned = cleanPayload(value);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("Commentary record not found.");
    const current = snapshot.data();
    if (current.status === COMMENTARY_STATUS.ARCHIVED) throw new Error("Restore this commentary before editing it.");

    const revision = Number(current.revision || 1) + 1;
    const now = serverTimestamp();
    const next = {
      ...cleaned,
      status: current.status === COMMENTARY_STATUS.APPROVED ? COMMENTARY_STATUS.DRAFT : current.status,
      version: Number(current.version || 1),
      revision,
      updatedAt: now,
      updatedByUid: currentUser.id,
      updatedByName: userName(currentUser),
      approvedAt: current.status === COMMENTARY_STATUS.APPROVED ? null : current.approvedAt || null,
      approvedByUid: current.status === COMMENTARY_STATUS.APPROVED ? null : current.approvedByUid || null,
      approvedByName: current.status === COMMENTARY_STATUS.APPROVED ? "" : current.approvedByName || ""
    };

    transaction.update(reference, next);
    transaction.set(doc(db, "marketCommentaries", commentaryId, "versions", `r${revision}`), {
      ...current,
      ...next,
      commentaryId,
      snapshotType: "draft_saved",
      savedAt: now,
      savedByUid: currentUser.id,
      savedByName: userName(currentUser)
    });
  });

  return commentaryId;
}

export async function approveMarketCommentary(commentaryId, currentUser) {
  const reference = doc(db, "marketCommentaries", commentaryId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("Commentary record not found.");
    const current = snapshot.data();
    if (!String(current.content || "").trim()) throw new Error("Add commentary content before approval.");

    const version = Number(current.version || 1) + 1;
    const revision = Number(current.revision || 1) + 1;
    const now = serverTimestamp();
    const approval = {
      status: COMMENTARY_STATUS.APPROVED,
      version,
      revision,
      approvedAt: now,
      approvedByUid: currentUser.id,
      approvedByName: userName(currentUser),
      updatedAt: now,
      updatedByUid: currentUser.id,
      updatedByName: userName(currentUser)
    };

    transaction.update(reference, approval);
    transaction.set(doc(db, "marketCommentaries", commentaryId, "versions", `v${version}`), {
      ...current,
      ...approval,
      commentaryId,
      snapshotType: "approved",
      savedAt: now,
      savedByUid: currentUser.id,
      savedByName: userName(currentUser)
    });
  });
}

export async function duplicateMarketCommentary(source, currentUser) {
  return createMarketCommentary({
    ...source,
    title: `${source.title || "Commentary"} — Copy`,
    status: COMMENTARY_STATUS.DRAFT,
    internalNote: ""
  }, currentUser);
}

export async function archiveMarketCommentary(commentaryId, currentUser) {
  await updateDoc(doc(db, "marketCommentaries", commentaryId), {
    status: COMMENTARY_STATUS.ARCHIVED,
    archivedAt: serverTimestamp(),
    archivedByUid: currentUser.id,
    archivedByName: userName(currentUser),
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: userName(currentUser)
  });
}

export async function restoreMarketCommentary(commentaryId, currentUser) {
  await updateDoc(doc(db, "marketCommentaries", commentaryId), {
    status: COMMENTARY_STATUS.DRAFT,
    archivedAt: null,
    archivedByUid: null,
    archivedByName: "",
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.id,
    updatedByName: userName(currentUser)
  });
}

export async function listMarketCommentaryVersions(commentaryId) {
  const snapshot = await getDocs(query(
    collection(db, "marketCommentaries", commentaryId, "versions"),
    orderBy("savedAt", "desc")
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function seedDefaultCommentaryExamples(currentUser) {
  const existing = await getDocs(collection(db, "marketCommentaries"));
  if (!existing.empty) return 0;

  const now = new Date();
  const examples = [
    {
      title: "Disciplined monthly market perspective",
      category: "monthly_summary",
      scope: COMMENTARY_SCOPE.REUSABLE,
      summary: "A calm, long-term market summary suitable for standard monthly reports.",
      content: "Markets can move differently over short periods, but the portfolio should continue to be evaluated against the Investor's goals, time horizon and agreed asset allocation. This month's review focuses on progress, disciplined contributions and any rebalancing required to keep the financial journey on track.",
      tags: ["monthly", "discipline", "long-term"]
    },
    {
      title: "Volatility and portfolio risk note",
      category: "risk",
      scope: COMMENTARY_SCOPE.REUSABLE,
      summary: "Reusable explanation for periods of higher volatility.",
      content: "Short-term volatility may temporarily affect portfolio values. The recommended approach is to review concentration, liquidity needs and goal timelines rather than react to isolated market movements. Any allocation change should remain consistent with the Investor's risk profile and documented financial priorities.",
      tags: ["risk", "volatility"]
    },
    {
      title: "Forward-looking portfolio outlook",
      category: "outlook",
      scope: COMMENTARY_SCOPE.REUSABLE,
      summary: "Balanced outlook language for the next reporting period.",
      content: "During the next review period, the focus will remain on consistent investing, adequate liquidity and alignment between each holding and its intended Bucket List goal. Opportunities will be evaluated selectively, with priority given to diversification, quality and long-term suitability.",
      tags: ["outlook", "strategy"]
    }
  ];

  for (const example of examples) {
    const id = await createMarketCommentary(example, currentUser);
    await approveMarketCommentary(id, currentUser);
  }
  return examples.length;
}
