import assert from "node:assert/strict";
import fs from "node:fs";
import { isPmsWithdrawalProduct, isStructuredWithdrawalProduct, supportsWithdrawalSipInstruction, withdrawalProductLabel } from "../../src/lib/withdrawalPortfolio.js";

assert.equal(isStructuredWithdrawalProduct("mutual_fund"), true);
assert.equal(isStructuredWithdrawalProduct("pms"), true);
assert.equal(isStructuredWithdrawalProduct("stock_delivery"), false);
assert.equal(isPmsWithdrawalProduct("pms"), true);
assert.equal(supportsWithdrawalSipInstruction("mutual_fund"), true);
assert.equal(supportsWithdrawalSipInstruction("pms"), false);
assert.equal(withdrawalProductLabel("pms"), "PMS");

const panel = fs.readFileSync("src/components/actions/WithdrawalCashNeedsPanel.js", "utf8");
const actionServer = fs.readFileSync("src/lib/server/actionServer.js", "utf8");
const completionRoute = fs.readFileSync("src/app/api/actions/[actionId]/complete-withdrawal/route.js", "utf8");
const completionPanel = fs.readFileSync("src/components/actions/WithdrawalCompletionPanel.js", "utf8");

assert.match(panel, /isStructuredWithdrawalProduct\(item\)/);
assert.match(panel, /No Mutual Funds or PMS holdings mapped to this Bucket List/);
assert.match(panel, /Amount-based withdrawal/);
assert.match(actionServer, /Structured withdrawals support Mutual Fund and PMS holdings/);
assert.match(actionServer, /sipInstruction[\s\S]*not_applicable/);
assert.match(actionServer, /withdrawalValueMode: isPmsWithdrawalProduct/);
assert.match(completionRoute, /Automatic withdrawal completion supports Mutual Fund and PMS positions/);
assert.match(completionRoute, /const sipFields = supportsSip/);
assert.match(completionRoute, /isPms && !\(currentUnits > 0 && actualUnits > 0\)/);
assert.match(completionPanel, /Amount-based PMS withdrawal/);

console.log("pms-withdrawal fixture passed");
