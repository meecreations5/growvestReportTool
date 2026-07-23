import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { USER_ROLES } from "@/lib/constants/roles";

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function matches(item, fields, term) {
  return fields.some((field) => normalise(item[field]).includes(term));
}

function monthLabel(report) {
  const month = Number(report.reportMonth || 0);
  const year = report.reportYear || "";
  const label = month >= 1 && month <= 12
    ? new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date(2026, month - 1, 1))
    : report.reportMonthKey || "Monthly report";
  return `${label} ${year}`.trim();
}

async function safeGet(searchQuery) {
  try {
    const snapshot = await getDocs(searchQuery);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.warn("Workspace search source unavailable", error);
    return [];
  }
}

export async function searchWorkspace(currentUser, rawTerm) {
  const term = normalise(rawTerm);
  if (!currentUser?.id || term.length < 2) return [];

  const privileged = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN].includes(currentUser.role);
  const investorQuery = privileged
    ? query(collection(db, "investors"), where("isDeleted", "==", false), limit(80))
    : query(collection(db, "investors"), where("assignedAdvisorUid", "==", currentUser.id), where("isDeleted", "==", false), limit(80));
  const leadQuery = privileged
    ? query(collection(db, "leads"), where("isDeleted", "==", false), limit(80))
    : query(collection(db, "leads"), where("assignedAdvisorUid", "==", currentUser.id), where("isDeleted", "==", false), limit(80));
  const reportQuery = privileged
    ? query(collection(db, "monthlyReports"), limit(80))
    : query(collection(db, "monthlyReports"), where("advisorUid", "==", currentUser.id), limit(80));

  const [investors, leads, reports] = await Promise.all([
    safeGet(investorQuery),
    safeGet(leadQuery),
    safeGet(reportQuery)
  ]);

  const results = [];
  investors.filter((item) => matches(item, ["fullName", "clientCode", "email", "contactNo", "city"], term)).slice(0, 6).forEach((item) => {
    results.push({
      id: `investor-${item.id}`,
      type: "Investor",
      title: item.fullName || "Investor",
      meta: [item.clientCode, item.contactNo || item.email].filter(Boolean).join(" · "),
      href: `/investors/${item.id}`
    });
  });
  leads.filter((item) => matches(item, ["fullName", "leadCode", "email", "contactNo", "city"], term)).slice(0, 6).forEach((item) => {
    results.push({
      id: `lead-${item.id}`,
      type: "Lead",
      title: item.fullName || "Lead",
      meta: [item.leadCode, item.status].filter(Boolean).join(" · "),
      href: `/leads/${item.id}`
    });
  });
  reports.filter((item) => matches(item, ["investorName", "clientCode", "reportCode", "reportMonthKey", "status"], term)).slice(0, 6).forEach((item) => {
    results.push({
      id: `report-${item.id}`,
      type: "Report",
      title: item.investorName || "Monthly report",
      meta: [monthLabel(item), item.reportCode].filter(Boolean).join(" · "),
      href: `/reports/${item.id}`
    });
  });

  return results.slice(0, 12);
}
