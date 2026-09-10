import { USER_ROLES } from "@/lib/constants/roles";

export const DEMO_SESSION_STORAGE_KEY = "growvest.demoInvestor.session.v1";
export const DEMO_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const DEMO_INTERESTS = [
  "Build Wealth",
  "Buy a Home",
  "Children's Education",
  "Retirement",
  "Travel & Experiences",
  "Family Financial Security",
  "Just Exploring"
];

function cleanName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function normalizeDemoMobile(value) {
  return String(value || "").replace(/\D/g, "").slice(-15);
}

export function isValidDemoMobile(value) {
  const mobile = normalizeDemoMobile(value);
  return mobile.length >= 10 && mobile.length <= 15;
}

export function maskDemoMobile(value) {
  const mobile = normalizeDemoMobile(value);
  if (!mobile) return "";
  const visible = mobile.slice(-4);
  return `••••••${visible}`;
}

function fnv1a(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value, step = 1000) {
  return Math.round(value / step) * step;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthStart(date, offset = 0) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1, 12, 0, 0, 0);
}

function monthEnd(date, offset = 0) {
  return new Date(date.getFullYear(), date.getMonth() + offset + 1, 0, 12, 0, 0, 0);
}

function firstName(name) {
  return cleanName(name).split(" ")[0] || "Investor";
}

export function createGuestDemoSession({ fullName, mobile, interest = "Just Exploring" } = {}) {
  const name = cleanName(fullName);
  const normalizedMobile = normalizeDemoMobile(mobile);
  if (name.length < 2) throw new Error("Please enter your full name.");
  if (!isValidDemoMobile(normalizedMobile)) throw new Error("Please enter a valid mobile number.");
  const selectedInterest = DEMO_INTERESTS.includes(interest) ? interest : "Just Exploring";
  const seed = fnv1a(`${name.toLowerCase()}|${normalizedMobile}`);
  const now = new Date();
  return {
    sessionId: `demo-${seed.toString(36)}`,
    seed,
    fullName: name,
    mobile: normalizedMobile,
    interest: selectedInterest,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DEMO_SESSION_TTL_MS).toISOString()
  };
}

export function storeGuestDemoSession(session) {
  if (typeof window === "undefined" || !session) return;
  window.localStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function getGuestDemoSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.sessionId || !session?.fullName || !session?.mobile || !session?.expiresAt) {
      window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
      return null;
    }
    if (Date.parse(session.expiresAt) <= Date.now()) {
      window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearGuestDemoSession() {
  if (typeof window !== "undefined") window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
}

export function hasActiveGuestDemoSession() {
  return Boolean(getGuestDemoSession());
}

export function buildDemoAuthProfile(session = getGuestDemoSession()) {
  if (!session) return null;
  const investorId = `demo-investor-${session.seed.toString(36)}`;
  return {
    id: session.sessionId,
    uid: session.sessionId,
    role: USER_ROLES.DEMO_INVESTOR,
    status: "active",
    portalEnabled: true,
    demo: true,
    investorId,
    activeInvestorId: investorId,
    primaryInvestorId: investorId,
    fullName: session.fullName,
    name: session.fullName,
    mobile: maskDemoMobile(session.mobile),
    contactNo: maskDemoMobile(session.mobile),
    email: "",
    clientCode: "DEMO",
    investorRelationship: "Guest",
    investorPermission: "view"
  };
}

function goalTemplates(interest) {
  const preferred = {
    "Buy a Home": ["Dream Home", "Family Holiday", "Retirement Freedom"],
    "Children's Education": ["Child Education", "Dream Home", "Retirement Freedom"],
    Retirement: ["Retirement Freedom", "Family Holiday", "Legacy Corpus"],
    "Travel & Experiences": ["Europe Family Holiday", "Dream Home", "Retirement Freedom"],
    "Family Financial Security": ["Family Security Corpus", "Child Education", "Retirement Freedom"],
    "Build Wealth": ["Wealth Creation", "Dream Home", "Retirement Freedom"],
    "Just Exploring": ["Dream Home", "Family Holiday", "Retirement Freedom"]
  };
  return preferred[interest] || preferred["Just Exploring"];
}

function makeGoals(random, session, totalWealth, monthlySip) {
  const names = goalTemplates(session.interest);
  const categories = {
    "Dream Home": "Home",
    "Family Holiday": "Travel",
    "Europe Family Holiday": "Travel",
    "Retirement Freedom": "Retirement",
    "Child Education": "Education",
    "Legacy Corpus": "Legacy",
    "Family Security Corpus": "Protection",
    "Wealth Creation": "Wealth"
  };
  const baseTargets = [totalWealth * (1.7 + random()), totalWealth * (0.35 + random() * 0.25), totalWealth * (2.8 + random() * 1.2)];
  return names.map((name, index) => {
    const target = round(baseTargets[index], 50000);
    const progress = index === 0 ? 42 + Math.round(random() * 28) : 25 + Math.round(random() * 55);
    const current = round(target * progress / 100, 5000);
    const targetDate = new Date(new Date(session.createdAt).getFullYear() + [4, 2, 12][index], [5, 10, 2][index], 1);
    return {
      id: `demo-goal-${index + 1}-${session.seed.toString(36)}`,
      goalId: `demo-goal-${index + 1}-${session.seed.toString(36)}`,
      name,
      goalName: name,
      category: categories[name] || "Lifestyle",
      description: index === 0 ? `A sample goal shaped around ${session.interest.toLowerCase()}.` : "Illustrative Bucket List goal for the GrowVest demo experience.",
      targetAmount: target,
      currentAmount: current,
      currentValue: current,
      progress,
      monthlySip: round(monthlySip * [0.5, 0.2, 0.3][index], 500),
      monthlyContribution: round(monthlySip * [0.5, 0.2, 0.3][index], 500),
      targetDate: isoDate(targetDate),
      targetYear: targetDate.getFullYear(),
      status: "Active",
      type: index === 0 ? "Primary" : "Growth",
      isPrimary: index === 0
    };
  });
}

function makePositions(random, session, totalWealth, monthlySip, goals, asOfDate) {
  const specs = [
    ["GrowVest Equity Opportunities Fund", "mutual_fund", "Mutual Funds", "FundBazaar", 0.27, 0.28],
    ["India Quality Leaders Fund", "mutual_fund", "Mutual Funds", "FundBazaar", 0.20, 0.23],
    ["Nifty 50 ETF", "etf", "Equity", "Bajaj Broking", 0.16, 0.17],
    ["Large Cap Equity Basket", "stock_delivery", "Equity", "Bajaj Broking", 0.14, 0.13],
    ["Corporate Bond Portfolio", "bond", "Fixed Income", "Manual", 0.12, 0.10],
    ["Gold Allocation", "gold", "Gold", "Manual", 0.11, 0.09]
  ];
  let allocated = 0;
  return specs.map(([name, productType, assetClass, provider, weight, investedWeight], index) => {
    const currentValue = index === specs.length - 1 ? totalWealth - allocated : round(totalWealth * weight, 1000);
    allocated += currentValue;
    const investedAmount = round(totalWealth * investedWeight * (0.94 + random() * 0.08), 1000);
    const gainLoss = currentValue - investedAmount;
    const goal = goals[index % goals.length];
    const qty = productType === "stock_delivery" || productType === "etf" ? Math.max(1, Math.round(currentValue / (650 + random() * 1800))) : round(250 + random() * 900, 0.001);
    const rate = currentValue / qty;
    const positionId = `demo-position-${index + 1}-${session.seed.toString(36)}`;
    return {
      id: positionId,
      positionId,
      investorId: `demo-investor-${session.seed.toString(36)}`,
      status: "active",
      source: provider === "FundBazaar" ? "fundbazaar" : provider === "Bajaj Broking" ? "bajaj_broking" : "manual",
      provider,
      productType,
      investmentTypeLabel: productType === "mutual_fund" ? "Mutual Fund" : productType === "stock_delivery" ? "Delivery Equity" : assetClass,
      assetClass,
      instrumentName: name,
      schemeName: productType === "mutual_fund" ? name : "",
      stockName: productType === "stock_delivery" ? name : "",
      symbol: productType === "stock_delivery" ? "GVDMO" : "",
      folioNo: productType === "mutual_fund" ? `GV${session.seed % 90000 + 10000}/${index + 1}` : "",
      totalUnits: qty,
      quantity: qty,
      currentNav: productType === "mutual_fund" ? rate : 0,
      currentRate: rate,
      averageBuyRate: investedAmount / qty,
      investedAmount,
      totalInvested: investedAmount,
      currentValue,
      gainLoss,
      gainLossAvailable: true,
      returnPercentage: investedAmount > 0 ? Number(((gainLoss / investedAmount) * 100).toFixed(2)) : 0,
      monthlySip: index < 2 ? round(monthlySip * [0.58, 0.42][index], 500) : 0,
      investmentMode: index < 2 ? "SIP + Lump Sum" : "Lump Sum",
      valuationDate: asOfDate,
      navDate: asOfDate,
      priceDate: asOfDate,
      goalAllocations: [{ goalId: goal.id, goalName: goal.name, percentage: 100 }]
    };
  });
}

function makeSnapshots(random, session, currentValue, investedAmount, monthlySip, anchor) {
  const rows = [];
  const months = 12;
  const monthlyGrowth = 0.006 + random() * 0.008;
  for (let i = 0; i < months; i += 1) {
    const monthsAgo = months - 1 - i;
    const date = monthEnd(anchor, -monthsAgo);
    const trendFactor = Math.pow(1 + monthlyGrowth, i - (months - 1));
    const noise = 0.985 + random() * 0.03;
    const value = round(currentValue * trendFactor * noise, 1000);
    const invested = round(Math.min(value * 0.96, investedAmount - monthlySip * monthsAgo), 1000);
    rows.push({
      id: `demo-snapshot-${i + 1}-${session.seed.toString(36)}`,
      investorId: `demo-investor-${session.seed.toString(36)}`,
      snapshotDate: isoDate(date),
      reconciliationStatus: "verified",
      summary: {
        currentValue: value,
        totalInvested: Math.max(0, invested),
        gainLoss: value - Math.max(0, invested),
        monthlySip,
        positionCount: 6
      }
    });
  }
  rows[rows.length - 1].summary.currentValue = currentValue;
  rows[rows.length - 1].summary.totalInvested = investedAmount;
  rows[rows.length - 1].summary.gainLoss = currentValue - investedAmount;
  return rows.reverse();
}

function makeReports(session, goals, snapshots, monthlySip, anchor) {
  return snapshots.slice(0, 6).map((snapshot, index) => {
    const date = new Date(`${snapshot.snapshotDate}T12:00:00`);
    const previous = snapshots[index + 1];
    const openingValue = Number(previous?.summary?.currentValue || snapshot.summary.currentValue - monthlySip);
    const newMoneyAdded = monthlySip;
    const investmentGain = snapshot.summary.currentValue - openingValue - newMoneyAdded;
    const id = `demo-report-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${session.seed.toString(36)}`;
    return {
      id,
      reportCode: `GV-DEMO-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`,
      reportMonth: date.getMonth() + 1,
      reportYear: date.getFullYear(),
      reportMonthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      statementDate: snapshot.snapshotDate,
      title: `${date.toLocaleString("en-IN", { month: "long" })} ${date.getFullYear()} Monthly Review`,
      status: "completed",
      investorVisible: true,
      activePublishedVersionId: `demo-version-${id}`,
      publishedVersion: 1,
      publishedAt: snapshot.snapshotDate,
      summary: {
        totalCorpus: snapshot.summary.currentValue,
        totalInvested: snapshot.summary.totalInvested,
        investmentGain,
        gainLoss: snapshot.summary.gainLoss,
        openingValue,
        newMoneyAdded,
        totalWithdrawals: 0,
        monthlySip,
        overallProgress: Number(goals[0]?.progress || 0)
      }
    };
  });
}

function makeReportVersion(session, reportMeta, reports, goals, positions, protectionSnapshot) {
  const currentIndex = reports.findIndex((item) => item.id === reportMeta.id);
  const previous = reports[currentIndex + 1] || null;
  const summary = reportMeta.summary || {};
  const allocationMap = new Map();
  positions.forEach((position) => allocationMap.set(position.assetClass, (allocationMap.get(position.assetClass) || 0) + position.currentValue));
  const allocation = [...allocationMap.entries()].map(([name, value]) => ({ name, label: name, value, amount: value, percentage: summary.totalCorpus ? value / summary.totalCorpus * 100 : 0 }));
  return {
    id: `demo-version-${reportMeta.id}`,
    reportId: reportMeta.id,
    versionId: `demo-version-${reportMeta.id}`,
    activePublishedVersionId: `demo-version-${reportMeta.id}`,
    reportCode: reportMeta.reportCode,
    reportMonth: reportMeta.reportMonth,
    reportYear: reportMeta.reportYear,
    reportMonthKey: reportMeta.reportMonthKey,
    statementDate: reportMeta.statementDate,
    publishedVersion: 1,
    investorName: session.fullName,
    clientCode: "DEMO",
    summary,
    goals,
    holdings: positions.map((position) => ({
      id: position.id,
      name: position.instrumentName,
      instrumentName: position.instrumentName,
      assetClass: position.assetClass,
      currentValue: position.currentValue,
      investedAmount: position.investedAmount,
      gainLoss: position.gainLoss,
      returnPercentage: position.returnPercentage
    })),
    allocation,
    funds: positions.filter((position) => position.productType === "mutual_fund"),
    monthlyChanges: [
      { title: "Portfolio updated", description: "Your sample portfolio reflects this month's market movement and SIP contribution.", tone: "info" },
      { title: "Bucket List progress", description: `${goals[0]?.name || "Primary goal"} moved closer to its illustrative target.`, tone: "success" }
    ],
    nextSteps: [
      { title: "Review your Bucket List", description: "See how each investment connects to a life goal.", status: "Open" },
      { title: "Speak with GrowVest", description: "Start a conversation when you are ready to make this experience your own.", status: "Suggested" }
    ],
    advisorInsights: [
      "Your sample allocation balances growth assets with stabilising fixed income.",
      "Bucket List progress is illustrative and demonstrates how GrowVest connects wealth to life goals."
    ],
    protectionSnapshot,
    nextReview: { date: isoDate(addDays(new Date(reportMeta.statementDate), 24)), note: "Illustrative monthly review with your GrowVest Partner." },
    previousMonthValue: Number(previous?.summary?.totalCorpus || 0),
    demo: true
  };
}

function makeProtection(random, session, anchor) {
  const healthCover = round(1500000 + random() * 1500000, 100000);
  const lifeCover = round(10000000 + random() * 15000000, 500000);
  const policies = [
    {
      id: `demo-policy-health-${session.seed.toString(36)}`,
      investorId: `demo-investor-${session.seed.toString(36)}`,
      insuranceType: "health",
      productName: "Family Health Cover",
      insurer: "Sample Health Insurance Co.",
      policyNumber: `DEMO-H-${session.seed % 900000 + 100000}`,
      policyStatus: "active",
      coverAmount: healthCover,
      premiumAmount: round(22000 + random() * 16000, 500),
      premiumFrequency: "Annual",
      healthMembers: [session.fullName, "Family"],
      expiryDate: isoDate(addDays(anchor, 142))
    },
    {
      id: `demo-policy-term-${session.seed.toString(36)}`,
      investorId: `demo-investor-${session.seed.toString(36)}`,
      insuranceType: "term",
      productName: "Term Protection",
      insurer: "Sample Life Insurance Co.",
      policyNumber: `DEMO-T-${session.seed % 900000 + 100000}`,
      policyStatus: "active",
      coverAmount: lifeCover,
      premiumAmount: round(18000 + random() * 14000, 500),
      premiumFrequency: "Annual",
      insuredSubject: session.fullName,
      expiryDate: isoDate(addDays(anchor, 240))
    }
  ];
  return {
    asOfDate: isoDate(anchor),
    generatedAt: anchor.toISOString(),
    summary: {
      activePolicyCount: policies.length,
      healthCover,
      lifeCover,
      policiesExpiringWithin30Days: 0,
      premiumsDueWithin30Days: 0,
      nextDue: isoDate(addDays(anchor, 68))
    },
    policies
  };
}

function makeSip(session, positions, anchor) {
  const funds = positions.filter((position) => Number(position.monthlySip || 0) > 0);
  return funds.map((position, index) => {
    const debitDate = addDays(anchor, 1 + index * 5);
    return {
      id: `demo-sip-${index + 1}-${session.seed.toString(36)}`,
      investorId: `demo-investor-${session.seed.toString(36)}`,
      positionId: position.id,
      instrumentName: position.instrumentName,
      sipAmount: position.monthlySip,
      debitDay: debitDate.getDate(),
      nextDebitDate: isoDate(debitDate),
      daysUntilDebit: 1 + index * 5,
      fundingStatus: index === 0 ? "pending" : "ready",
      bankName: "Sample Bank",
      accountLast4: String(1000 + session.seed % 8999),
      scheduleSource: "demo"
    };
  });
}

function makeTransactions(session, positions, monthlySip, anchor) {
  const rows = [];
  positions.slice(0, 2).forEach((position, positionIndex) => {
    for (let index = 0; index < 4; index += 1) {
      const date = monthStart(anchor, -index);
      date.setDate(5 + positionIndex * 3);
      rows.push({
        id: `demo-txn-${positionIndex}-${index}-${session.seed.toString(36)}`,
        investorId: `demo-investor-${session.seed.toString(36)}`,
        positionId: position.id,
        instrumentName: position.instrumentName,
        productType: position.productType,
        transactionType: "purchase",
        investmentMode: "SIP",
        transactionDate: isoDate(date),
        amount: round(monthlySip * (positionIndex === 0 ? 0.58 : 0.42), 500),
        cashFlowType: "inflow",
        source: "demo"
      });
    }
  });
  return rows.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

function makeDocuments(session, anchor) {
  return [
    { id: `demo-doc-1-${session.seed.toString(36)}`, title: "Investor Profile Summary", documentType: "Profile", fileName: "investor-profile-summary.pdf", mimeType: "application/pdf", sizeBytes: 248000, storagePath: "demo-only", status: "verified", investorVisible: true, createdAt: addDays(anchor, -18).toISOString(), demo: true },
    { id: `demo-doc-2-${session.seed.toString(36)}`, title: "Goal Planning Notes", documentType: "Planning", fileName: "goal-planning-notes.pdf", mimeType: "application/pdf", sizeBytes: 186000, storagePath: "demo-only", status: "verified", investorVisible: true, createdAt: addDays(anchor, -42).toISOString(), demo: true }
  ];
}

function makeMeetings(session, anchor) {
  const upcoming = addDays(anchor, 12);
  upcoming.setHours(16, 0, 0, 0);
  return {
    meetings: [
      { id: `demo-meeting-upcoming-${session.seed.toString(36)}`, investorVisible: true, title: "Monthly Wealth Review", status: "scheduled", startAt: upcoming.toISOString(), advisorName: "GrowVest Wealth Partner", mode: "Video" },
      { id: `demo-meeting-past-${session.seed.toString(36)}`, investorVisible: true, title: "Bucket List Discovery", status: "completed", startAt: addDays(anchor, -31).toISOString(), advisorName: "GrowVest Wealth Partner", mode: "Video" }
    ],
    moms: [
      { id: `demo-mom-${session.seed.toString(36)}`, investorVisible: true, title: "Bucket List Discovery", meetingTitle: "Bucket List Discovery", meetingDate: addDays(anchor, -31).toISOString(), advisorName: "GrowVest Wealth Partner", clientSummary: "We reviewed your illustrative priorities and connected them to a sample investment structure.", clientDecisions: ["Keep the home goal as the primary Bucket List item", "Review progress every month"] }
    ]
  };
}

function buildDemoData(session) {
  const random = mulberry32(session.seed || fnv1a(`${session.fullName}|${session.mobile}`));
  const anchor = new Date(session.createdAt || Date.now());
  anchor.setHours(12, 0, 0, 0);
  const totalWealth = round(3500000 + random() * 9000000, 10000);
  const monthlySip = round(25000 + random() * 70000, 500);
  const investedAmount = round(totalWealth * (0.78 + random() * 0.12), 10000);
  const goals = makeGoals(random, session, totalWealth, monthlySip);
  const positions = makePositions(random, session, totalWealth, monthlySip, goals, isoDate(anchor));
  const snapshots = makeSnapshots(random, session, totalWealth, investedAmount, monthlySip, anchor);
  const protectionSnapshot = makeProtection(random, session, anchor);
  const reports = makeReports(session, goals, snapshots, monthlySip, anchor);
  const sipItems = makeSip(session, positions, anchor);
  const transactions = makeTransactions(session, positions, monthlySip, anchor);
  const documents = makeDocuments(session, anchor);
  const meetingData = makeMeetings(session, anchor);
  const previousValue = Number(snapshots[1]?.summary?.currentValue || 0);
  const movement = totalWealth - previousValue;
  const assetMap = new Map();
  positions.forEach((position) => assetMap.set(position.assetClass, (assetMap.get(position.assetClass) || 0) + position.currentValue));
  const portfolio = {
    currentValue: totalWealth,
    totalInvested: investedAmount,
    gainLoss: totalWealth - investedAmount,
    monthlySip,
    movement,
    movementPercent: previousValue > 0 ? Number((movement / previousValue * 100).toFixed(2)) : null,
    movementLabel: "since previous update",
    positionCount: positions.length,
    asOfDate: isoDate(anchor),
    snapshotId: snapshots[0]?.id || "",
    snapshotDate: snapshots[0]?.snapshotDate || isoDate(anchor),
    previousSnapshotDate: snapshots[1]?.snapshotDate || "",
    reconciliationStatus: "verified",
    gainLossPartial: false,
    goalTotals: goals.map((goal) => ({ goalId: goal.id, goalName: goal.name, currentValue: goal.currentValue, monthlyContribution: goal.monthlyContribution })),
    goalInvestments: positions.map((position) => ({ positionId: position.id, goalId: position.goalAllocations[0].goalId, currentValue: position.currentValue })),
    assetAllocation: [...assetMap.entries()].map(([label, value]) => ({ label, value })),
    trend: [...snapshots].reverse().map((snapshot) => ({ date: snapshot.snapshotDate, value: snapshot.summary.currentValue })),
    topHoldings: positions.slice(0, 6),
    hasPortfolio: true
  };
  const investorId = `demo-investor-${session.seed.toString(36)}`;
  const investor = {
    id: investorId,
    fullName: session.fullName,
    name: session.fullName,
    clientCode: "DEMO",
    email: "",
    contactNo: maskDemoMobile(session.mobile),
    mobile: maskDemoMobile(session.mobile),
    city: "",
    investorSince: isoDate(addDays(anchor, -540)),
    personalProfile: { dateOfBirth: "" },
    riskAssessment: { finalProfile: "Balanced Growth" },
    riskProfile: "Balanced Growth",
    bucketList: goals,
    goals,
    advisorName: "GrowVest Wealth Partner",
    assignedAdvisorName: "GrowVest Wealth Partner",
    advisorEmail: "cwp@growvest.info",
    assignedAdvisorEmail: "cwp@growvest.info",
    advisorPhone: "",
    assignedAdvisorPhone: "",
    advisorDesignation: "Relationship Manager",
    assignedAdvisorDesignation: "Relationship Manager",
    panMasked: "DEMO••••X",
    aadhaarConfigured: false,
    latestPortfolioSnapshotId: snapshots[0]?.id || "",
    latestPortfolioSnapshotDate: snapshots[0]?.snapshotDate || isoDate(anchor),
    latestPortfolioValue: totalWealth,
    latestPortfolioInvested: investedAmount,
    latestPortfolioGainLoss: totalWealth - investedAmount,
    latestPortfolioMonthlySip: monthlySip,
    latestPortfolioReconciliationStatus: "verified",
    latestPortfolioIssueCount: 0,
    latestPortfolioUpdatedAt: anchor.toISOString(),
    demo: true
  };
  const notifications = [
    { id: `demo-notification-sip-${session.seed.toString(36)}`, status: "unread", title: "SIP due tomorrow", message: `${sipItems[0]?.instrumentName || "Your SIP"} · sample debit ${sipItems[0]?.sipAmount?.toLocaleString("en-IN") || ""}`, link: "/investor/sip-reminders", createdAt: anchor.toISOString(), category: "sip" },
    { id: `demo-notification-review-${session.seed.toString(36)}`, status: "unread", title: "Your Monthly Review is ready", message: "See how your illustrative wealth moved this month.", link: `/investor/reports/${reports[0]?.id}`, createdAt: addDays(anchor, -1).toISOString(), category: "monthlyReview" },
    { id: `demo-notification-goal-${session.seed.toString(36)}`, status: "read", title: "Bucket List progress updated", message: `${goals[0]?.name || "Your goal"} is ${goals[0]?.progress || 0}% funded in this demo.`, link: "/investor/goals", createdAt: addDays(anchor, -3).toISOString(), category: "bucketList" }
  ];
  return {
    investor,
    goals,
    positions,
    snapshots,
    transactions,
    trades: [],
    manualAccounts: [],
    ulipPolicies: [],
    portfolio,
    reports,
    protectionSnapshot,
    sipItems,
    notifications,
    documents,
    ...meetingData,
    nextMeeting: meetingData.meetings[0],
    latestMom: meetingData.moms[0]
  };
}

export function getDemoDataset(session = getGuestDemoSession()) {
  if (!session) throw new Error("Your demo session has expired. Start a new GrowVest demo.");
  return buildDemoData(session);
}

export function getDemoInvestorAppData(section = "dashboard", reportId = "", session = getGuestDemoSession()) {
  const data = getDemoDataset(session);
  if (section === "security") return { investor: data.investor };
  if (section === "profile") return { investor: data.investor, goals: data.goals };
  if (section === "documents") return { investor: data.investor, documents: data.documents };
  if (section === "meetings") return { investor: data.investor, meetings: data.meetings, moms: data.moms };
  if (section === "reports") return { investor: data.investor, reports: data.reports };
  if (section === "goals") return { investor: data.investor, portfolio: data.portfolio, goals: data.goals };
  if (section === "report") {
    const reportMeta = data.reports.find((item) => item.id === reportId) || data.reports[0];
    if (!reportMeta) throw new Error("This sample Monthly Review is unavailable.");
    return {
      investor: data.investor,
      reportMeta,
      publishedVersion: makeReportVersion(session, reportMeta, data.reports, data.goals, data.positions, data.protectionSnapshot),
      history: data.reports,
      acknowledgement: null
    };
  }
  return {
    investor: data.investor,
    portfolio: data.portfolio,
    goals: data.goals,
    reports: data.reports.slice(0, 2),
    nextMeeting: data.nextMeeting,
    latestMom: data.latestMom,
    protectionSnapshot: data.protectionSnapshot,
    generatedAt: new Date(session.createdAt).toISOString()
  };
}

export function getDemoPortfolioView(session = getGuestDemoSession()) {
  const data = getDemoDataset(session);
  return {
    investor: data.investor,
    positions: data.positions,
    ulipPolicies: data.ulipPolicies,
    snapshots: data.snapshots,
    transactions: data.transactions,
    trades: data.trades,
    manualAccounts: data.manualAccounts
  };
}

export function getDemoHoldingDetail(positionId, session = getGuestDemoSession()) {
  const data = getDemoDataset(session);
  const position = data.positions.find((item) => String(item.id) === String(positionId));
  if (!position) throw new Error("This sample holding could not be found.");
  return {
    position,
    transactions: data.transactions.filter((item) => item.positionId === position.id),
    portfolioValue: data.portfolio.currentValue,
    allocationPercentage: data.portfolio.currentValue > 0 ? Number((position.currentValue / data.portfolio.currentValue * 100).toFixed(2)) : 0
  };
}

export function getDemoSipFundingOverview(session = getGuestDemoSession()) {
  const data = getDemoDataset(session);
  return { investor: data.investor, items: data.sipItems, generatedAt: new Date(session.createdAt).toISOString(), demo: true };
}

export function getDemoInsurancePolicies(session = getGuestDemoSession()) {
  const data = getDemoDataset(session);
  return { investor: data.investor, policies: data.protectionSnapshot.policies, protectionSnapshot: data.protectionSnapshot, demo: true };
}

export function getDemoNotifications(session = getGuestDemoSession()) {
  return getDemoDataset(session).notifications;
}

export function demoReadOnlyError(action = "This action") {
  return new Error(`${action} is not available in the Demo Experience. Become part of GrowVest to use it with your own account.`);
}
