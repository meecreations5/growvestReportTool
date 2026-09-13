import assert from "node:assert/strict";
import { derivePortfolioGoalProgress } from "../../src/lib/portfolioGoalAllocation.js";

const goals = [{
  id: "goal-general",
  name: "General Wealth / Corpus Creation",
  targetAmount: 1_000_000,
  currentAmount: 0,
  monthlySip: 0
}];

const positions = [
  {
    id: "axis-multicap",
    instrumentName: "Axis Multicap Fund",
    currentValue: 8824,
    monthlySip: 1000,
    goalAllocations: [{ goalId: "general_wealth", goalName: "General Wealth", percentage: 100 }]
  },
  {
    id: "axis-large-mid",
    instrumentName: "Axis Large & Mid Cap Fund",
    currentValue: 8420,
    monthlySip: 1000,
    goalAllocations: [{ goalId: "general_wealth", goalName: "General Wealth (Default)", percentage: 100 }]
  },
  {
    id: "axis-value",
    instrumentName: "Axis Value Fund",
    currentValue: 7054,
    monthlySip: 1000,
    goalAllocations: [{ goalId: "general_wealth", goalName: "General Wealth / Corpus Creation", percentage: 100 }]
  }
];

const result = derivePortfolioGoalProgress(goals, positions);
const goal = result.goals[0];

assert.equal(result.totalPortfolioValue, 24298);
assert.equal(result.activeMonthlySip, 3000);
assert.equal(result.assignedGoalCorpus, 24298);
assert.equal(result.invalidGoalAllocations.length, 0);
assert.equal(goal.currentAmount, 24298);
assert.equal(goal.monthlySip, 3000);
assert.equal(goal.progress, 2.4);
assert.equal(goal.status, "SIP Running");

console.log("Opening Wealth Review goal reconciliation fixture passed");
console.log(JSON.stringify({
  goal: goal.name,
  currentCorpus: goal.currentAmount,
  target: goal.targetAmount,
  progress: goal.progress,
  activeMonthlySip: goal.monthlySip,
  status: goal.status,
  invalidGoalAllocations: result.invalidGoalAllocations.length
}, null, 2));
