function monthKey(value = "") {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.slice(0, 7) : "";
}

function previousMonthKey(value = "") {
  const match = String(value || "").match(/^(\d{4})-(\d{2})/);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Fundbazaar may contain more than one SIP instruction for the same scheme and
 * folio. Sum the SIP rows in the latest reliable monthly cycle instead of
 * taking only the latest transaction amount.
 */
export function deriveFundbazaarMonthlySip(sipTransactions = [], valuationDate = "") {
  const monthly = new Map();
  for (const item of sipTransactions) {
    const key = monthKey(item?.transactionDate);
    const value = Math.abs(Number(item?.purchaseAmount ?? item?.investedAmount ?? 0));
    if (!key || !(value > 0)) continue;
    monthly.set(key, (monthly.get(key) || 0) + value);
  }
  if (!monthly.size) return { amount: 0, monthKey: "", debitDays: [] };

  const keys = [...monthly.keys()].sort();
  const valuationMonth = monthKey(valuationDate);
  const completedMonth = previousMonthKey(valuationMonth);
  const completedAmount = completedMonth ? Number(monthly.get(completedMonth) || 0) : 0;
  const currentAmount = valuationMonth ? Number(monthly.get(valuationMonth) || 0) : 0;

  let selectedMonth = keys.at(-1);
  let amount = Number(monthly.get(selectedMonth) || 0);
  if (completedAmount > 0) {
    selectedMonth = completedMonth;
    amount = completedAmount;
    if (currentAmount >= completedAmount && currentAmount > 0) {
      selectedMonth = valuationMonth;
      amount = currentAmount;
    }
  }

  const debitDays = sipTransactions
    .filter((item) => monthKey(item?.transactionDate) === selectedMonth)
    .map((item) => Number(String(item.transactionDate || "").slice(8, 10)) || 0)
    .filter(Boolean)
    .sort((a, b) => a - b);

  return { amount: Number(amount.toFixed(2)), monthKey: selectedMonth, debitDays };
}
