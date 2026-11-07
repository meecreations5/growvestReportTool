import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  manualPmsCashEntryFlow, manualPmsTradeFlow, manualCashLedgerMovement,
  normalisePmsManagedTransaction, buildMonthlyReportingLedger
} from '../../src/lib/portfolioMonthlyLedger.js';
import { externalPortfolioCashFlow, unrepresentedExternalCashFlows } from '../../src/lib/portfolioPeriodCoverage.js';

let tests = 0;
function check(name, fn) {
  fn(); tests += 1; console.log(`PASS  ${name}`);
}
const month = { investorId: 'investor-PMS', startDate: '2026-10-01', cutoffDate: '2026-10-31' };
const tx = (id, date, type, amount, rest = {}) => ({ id, investorId: 'investor-PMS', source:'manual', manualPortfolioManaged:true, manualPortfolioAccountCode:'PMS-1', transactionDate:date, transactionType:type, netAmount:amount, ...rest });
const cash = (id, date, type, amount, reference = '', accountCode='PMS-1') => ({ id, investorId:'investor-PMS', source:'manual', accountCode, entryDate:date, entryType:type, amount, reference });
const initial = [
  tx('pms-buy','2026-10-18','Buy',100000),
  tx('pms-sell','2026-10-20','Sell',35000),
  tx('pms-redemption','2026-10-22','Redemption',40000),
  tx('sip-stop','2026-10-15','SIP Stopped',5000),
  tx('pms-transfer','2026-10-25','Transfer In',10000),
  tx('pms-nov-add','2026-11-01','PMS Capital Addition',70000),
  tx('pms-pending','2026-10-21','PMS Capital Addition',30000,{transactionStatus:'pending'}),
];
const ledger = {
  transactions: initial,
  manualCash: [
    cash('cash-add','2026-10-18','Additional Capital',100000,'REF-ADD'),
    cash('cash-withdraw','2026-10-22','PMS Capital Withdrawal',40000,'REF-OUT'),
    cash('cash-transfer','2026-10-25','Transfer In',10000),
    cash('cash-buy','2026-10-18','Purchase Debit',100000),
    cash('cash-sale','2026-10-20','Sale Proceeds',35000),
    cash('cash-late','2026-11-01','Investor Contribution',50000),
  ],
  investorActions: []
};

check('PMS purchase is an internal trade', () => assert.equal(manualPmsTradeFlow('Buy'), 'internal'));
check('PMS redemption does not automatically mean cash left the investor portfolio', () => assert.equal(manualPmsTradeFlow('Redemption'), 'internal'));
check('PMS capital top-up is external money', () => assert.equal(manualPmsTradeFlow('PMS Capital Addition'), 'new_money'));
check('PMS capital withdrawal is an actual external outflow', () => assert.equal(manualPmsTradeFlow('Investor Withdrawal'), 'withdrawal'));
check('SIP stop is not a contribution', () => assert.equal(externalPortfolioCashFlow(normalisePmsManagedTransaction(tx('stop','2026-10-15','SIP Stopped',10000))).newMoney,0));
check('Internal PMS transfer is not new wealth', () => assert.equal(manualPmsCashEntryFlow('Transfer In'),'internal'));
check('Cash Ledger additional capital is new wealth', () => assert.equal(manualPmsCashEntryFlow('Additional Capital'),'new_money'));
check('Cash Ledger investor withdrawal is external', () => assert.equal(manualPmsCashEntryFlow('PMS Capital Withdrawal'),'withdrawal'));
check('Cash Ledger internal purchase debit is not new money', () => assert.equal(manualPmsCashEntryFlow('Purchase Debit'),'internal'));
check('Cash Ledger sale proceeds are not external withdrawals', () => assert.equal(manualPmsCashEntryFlow('Sale Proceeds'),'internal'));
check('Opening cash alone is ambiguous, not a new deposit', () => assert.equal(manualPmsCashEntryFlow('Opening Cash'),'review'));
check('Cash Ledger id is stable across repeated imports', () => assert.equal(manualCashLedgerMovement(ledger.manualCash[0]).id, manualCashLedgerMovement(ledger.manualCash[0]).id));
const reporting = buildMonthlyReportingLedger({ledger,...month});
const external = reporting.reduce((sum,row)=>{
  const flow = externalPortfolioCashFlow(row);
  return {inflow:sum.inflow+flow.newMoney,outflow:sum.outflow+flow.withdrawals};
}, {inflow:0,outflow:0});
check('PMS money added counted once, not again for security buy', () => assert.equal(external.inflow,100000));
check('PMS withdrawal counted once, not again for internal redemption', () => assert.equal(external.outflow,40000));
check('October report ignores 1 November capital additions', () => assert.ok(reporting.every(row=>row.transactionDate<='2026-10-31')));
check('Cancelled and pending capital additions do not count', () => assert.equal(reporting.some(row=>row.id==='pms-pending'),false));
check('PMS October closing performance is 12000, not 112000', () => {
  const gain = 572000 - 500000 - external.inflow + external.outflow;
  assert.equal(gain,12000);
});
check('Post-30 Oct external additions are reported as coverage gaps', () => {
  const extra = buildMonthlyReportingLedger({ ledger:{transactions:[],manualCash:[cash('after','2026-10-31','Investor Contribution',10000)]}, ...month });
  const gap = unrepresentedExternalCashFlows({snapshotDate:'2026-10-30',cutoffDate:month.cutoffDate,transactions:extra});
  assert.equal(gap.newMoney,10000);
});
check('31 October PMS contribution belongs to October; 1 November does not', () => {
  const entries = buildMonthlyReportingLedger({ledger:{manualCash:[cash('m1','2026-10-31','Investor Deposit',5000),cash('m2','2026-11-01','Investor Deposit',10000)]},...month});
  assert.equal(entries.length,1); assert.equal(entries[0].amount,5000);
});
check('Explicit PMS capital transaction without ledger remains an external cash flow', () => {
  const rows=buildMonthlyReportingLedger({ ledger:{transactions:[tx('topup','2026-10-12','PMS Capital Addition',20000)]},...month });
  assert.equal(externalPortfolioCashFlow(rows[0]).newMoney,20000);
});
check('Same capital event recorded in both Transaction and Cash sheets is not double counted', () => {
  const rows=buildMonthlyReportingLedger({ledger:{transactions:[tx('capital','2026-10-12','PMS Capital Addition',20000,{transactionReference:'ABC'})],manualCash:[cash('cash-capital','2026-10-12','Investor Contribution',20000,'ABC')]},...month});
  const flow=rows.reduce((sum,row)=>sum+externalPortfolioCashFlow(row).newMoney,0);
  assert.equal(flow,20000);
  assert.equal(rows.find(row=>row.id==='capital').pmsCapitalMovementCoveredByCashLedger,true);
});
check('Unmatched reference does not silently discard a potentially separate capital event', () => {
  const rows=buildMonthlyReportingLedger({ledger:{transactions:[tx('capital','2026-10-12','PMS Capital Addition',20000,{transactionReference:'ABC'})],manualCash:[cash('cash-capital','2026-10-12','Investor Contribution',20000,'DIFFERENT')]},...month});
  assert.equal(rows.filter(row=>externalPortfolioCashFlow(row).newMoney>0).length,2);
});
check('Confirmed manual action matching the cash-ledger reference is not counted twice', () => {
  const rows=buildMonthlyReportingLedger({ledger:{manualCash:[cash('cash','2026-10-22','Investor Contribution',30000,'BANK-100')],investorActions:[{id:'act', financialImpactStatus:'confirmed',financialConfirmationMode:'manual_cash_movement', financialImpactType:'external_inflow', actualFinancialDate:'2026-10-22',actualFinancialAmount:30000,actualFinancialReference:'BANK-100'}]},...month});
  assert.equal(rows.reduce((sum,row)=>sum+externalPortfolioCashFlow(row).newMoney,0),30000);
});
check('Simple Manual Mutual Fund SIP retains actual contribution', () => {
  const rows=buildMonthlyReportingLedger({ledger:{transactions:[{source:'manual',manualInvestmentTemplate:true,productType:'mutual_fund',id:'sip-1',transactionDate:'2026-10-11',transactionType:'SIP',cashFlowType:'new_money',amount:5000}]},...month});
  assert.equal(rows.reduce((sum,row)=>sum+externalPortfolioCashFlow(row).newMoney,0),5000);
});
check('Simple Manual PMS buy remains internal, not fresh investor funding', () => {
  const rows=buildMonthlyReportingLedger({ledger:{transactions:[{source:'manual',manualInvestmentTemplate:true,productType:'pms',id:'buy-1',transactionDate:'2026-10-11',transactionType:'Buy',cashFlowType:'new_money',amount:5000}]},...month});
  assert.equal(rows.reduce((sum,row)=>sum+externalPortfolioCashFlow(row).newMoney,0),0);
});
check('Manual bulk exporter stores explicit cash-flow types and amount for securities', () => {
  const s=fs.readFileSync('src/lib/server/manualPortfolioWorkbook.js','utf8');
  assert.match(s,/cashFlowType: manualPmsTradeFlow\(row.transactionType\)/);
  assert.match(s,/amount: Math\.abs\(Number\(row\.netAmount \|\| row\.grossAmount/);
});
check('Cash Ledger classification is shared by report, scanner, and snapshot analytics',()=>{
  for (const p of ['src/lib/server/portfolioReportCashFlowCoverage.js','src/lib/server/portfolioServer.js','src/app/api/portfolio/report-source/route.js']){
    assert.match(fs.readFileSync(p,'utf8'),/buildMonthlyReportingLedger/);
  }
});
check('Manual PMS per-account source dates are not taken from other accounts',()=>{
  const s=fs.readFileSync('src/lib/server/manualPortfolioWorkbook.js','utf8');
  assert.match(s,/earliestValuationDate: group\.holdings\.filter\(\(row\) => row\.accountCode === accountSummary\.accountCode\)/);
});
check('New actual Manual source value dates are not silently replaced by upload date',()=>{
  const s=fs.readFileSync('src/app/api/portfolio/investors/[investorId]/manual-import/route.js','utf8');
  assert.match(s,/valuationDate: row\.valuationDateInput \|\| importDate/);
});
check('Missing monthly opening baseline blocks publication rather than invents zero market gain',()=>{
  const s=fs.readFileSync('src/lib/constants/report.js','utf8');
  assert.match(s,/reportType === REPORT_TYPE\.OPENING \|\| openingSnapshot \? "pass" : "block"/);
});
check('Manual PMS with an unknown cash entry requires review', () => {
  const rows = buildMonthlyReportingLedger({ledger:{manualCash:[cash('unknown','2026-10-20','Adjustment',3500)]}, ...month});
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cashFlowType,'review');
  assert.equal(externalPortfolioCashFlow(rows[0]).newMoney,0);
  assert.equal(externalPortfolioCashFlow(rows[0]).withdrawals,0);
  assert.match(fs.readFileSync('src/lib/constants/report.js','utf8'),/manual_pms_cash_classification/);
});
check('31 October timestamp with time is within October cutoff', () => {
  const rows = buildMonthlyReportingLedger({ledger:{transactions:[tx('end','2026-10-31T15:30:00Z','PMS Capital Addition',2500)]},...month});
  assert.equal(rows.length,1);
});
check('Dated capital columns are recognised in the simple Manual template', () => {
  const s=fs.readFileSync('src/app/api/portfolio/investors/[investorId]/manual-import/route.js','utf8');
  for (const field of ['pmsCapitalAdded','pmsCapitalAddedDate','pmsCapitalWithdrawn','pmsCapitalWithdrawnDate','pmsCapitalReference'])
    assert.ok(s.includes(field),`Missing ${field}`);
  assert.match(s,/needs its actual capital movement date/);
});
check('Repeated simple Manual Replace retains confirmed prior-month transaction history', () => {
  const s=fs.readFileSync('src/app/api/portfolio/investors/[investorId]/manual-import/route.js','utf8');
  assert.doesNotMatch(s,/transactionSnapshot\.docs[\s\S]*?writer\.delete\(item\.ref\)/);
  assert.match(s,/historicalTransactionsRetained: true/);
});
check('Confirmed action and explicit PMS capital trade sharing a reference are not double counted', () => {
  const rows=buildMonthlyReportingLedger({ledger:{transactions:[tx('capital','2026-10-12','PMS Capital Addition',20000,{transactionReference:'BANK-42'})],investorActions:[{id:'act', financialImpactStatus:'confirmed',financialConfirmationMode:'manual_cash_movement', financialImpactType:'external_inflow', actualFinancialDate:'2026-10-12',actualFinancialAmount:20000,actualFinancialReference:'BANK-42'}]},...month});
  assert.equal(rows.reduce((sum,row)=>sum+externalPortfolioCashFlow(row).newMoney,0),20000);
});
check('Explicit non-cashflow markers never fall through to a contribution regex', () => {
  assert.deepEqual(externalPortfolioCashFlow({cashFlowType:'non_cashflow',transactionType:'Investment Fees',amount:1500}),{newMoney:0,withdrawals:0});
});
check('Simple Manual Replace never deletes separately managed bulk PMS holdings', () => {
  const s=fs.readFileSync('src/app/api/portfolio/investors/[investorId]/manual-import/route.js','utf8');
  assert.match(s,/existingManual\.filter\(\(item\) => item\.manualInvestmentTemplate === true && !incomingIds\.has\(item\.id\)\)/);
});
check('Same-bank-reference PMS capital can be deduped across simple and managed Manual imports', () => {
  const simple={source:'manual',manualInvestmentTemplate:true,productType:'pms',id:'simple',transactionDate:'2026-10-12',transactionType:'PMS Capital Addition',amount:20000,transactionReference:'UTR-42'};
  const rows=buildMonthlyReportingLedger({ledger:{transactions:[simple],manualCash:[cash('bulk','2026-10-12','Additional Capital',20000,'UTR-42')]},...month});
  assert.equal(rows.reduce((sum,row)=>sum+externalPortfolioCashFlow(row).newMoney,0),20000);
});
console.log(`Manual PMS unified Monthly Wealth Review fixture: ${tests} checks passed.`);
