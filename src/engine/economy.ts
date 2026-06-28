// Company economy — payroll, rent, runway, bankruptcy, staff XP, build time. PURE.
import { BALANCE } from "./balance.ts";
import { add, sum, gte, scale, type Money, ZERO, dollars } from "./money.ts";
import { ASSIGNMENT_DISCIPLINE, disciplineOutput, xpMult } from "./staff.ts";
import type { Assignment, Staff } from "./types.ts";

export function weeklyPayroll(staff: readonly Staff[]): Money {
  return staff.length ? sum(staff.map((s) => s.salary)) : ZERO;
}

export function weeklyBurn(staff: readonly Staff[], facilityRent: Money): Money {
  return add(weeklyPayroll(staff), facilityRent);
}

/** Weeks of runway at current burn given cash and (optional) expected weekly revenue. */
export function runwayWeeks(cash: Money, burn: Money, weeklyRevenue: Money = ZERO): number {
  const net = burn - weeklyRevenue; // positive = losing money
  if (net <= 0) return Infinity;
  return Math.max(0, Math.floor(cash / net));
}

export function isBankrupt(cash: Money): boolean {
  return cash < 0;
}

/** Salary for a freshly considered hire of a given role + skill. */
export function salaryFor(role: Staff["role"], skill: number): Money {
  const base = BALANCE.staff.baseSalary[role];
  return add(base, scale(BALANCE.staff.salaryPerSkill, skill));
}

/** Effective skill contributing to a function: each person assigned to it contributes their
 *  0..100 score in THAT discipline (scaled to the 1..10 output range). So a designer with strong
 *  Engineering still helps R&D — put people where their high scores are. */
export function assignedSkill(staff: readonly Staff[], assignment: Exclude<Assignment, "idle">): number {
  const discipline = ASSIGNMENT_DISCIPLINE[assignment];
  return staff
    .filter((s) => s.assignment === assignment)
    .reduce((a, s) => a + disciplineOutput(s, discipline), 0);
}

/** XP needed to reach the next skill level from the current skill. */
export function xpToNext(skill: number): number {
  return Math.round(BALANCE.staff.xpToLevel * Math.pow(BALANCE.staff.xpLevelScaling, skill - 1));
}

/** Apply one week of XP to a staff member, leveling up skill (and salary) at the threshold. */
export function gainWeeklyXp(s: Staff): { staff: Staff; leveledUp: boolean } {
  if (s.skill >= BALANCE.staff.maxSkill) return { staff: s, leveledUp: false };
  const base = s.assignment === "idle" ? BALANCE.staff.xpPerWeekIdle : BALANCE.staff.xpPerWeekOnTask;
  const rate = base * xpMult(s.trait);
  let xp = s.xp + rate;
  let skill = s.skill;
  let leveledUp = false;
  while (skill < BALANCE.staff.maxSkill && xp >= xpToNext(skill)) {
    xp -= xpToNext(skill);
    skill += 1;
    leveledUp = true;
  }
  const salary = leveledUp ? salaryFor(s.role, skill) : s.salary;
  return { staff: { ...s, xp, skill, salary }, leveledUp };
}

export function trainCost(skill: number): Money {
  return scale(BALANCE.staff.trainCostPerSkill, skill);
}

/** Weeks to manufacture a product, reduced by engineer R&D skill (+ assembly line elsewhere). */
export function buildWeeks(engineerSkill: number, fast: boolean): number {
  let w = BALANCE.build.baseWeeks - engineerSkill * BALANCE.build.weeksPerEngineerSkill;
  if (fast) w -= 1.5;
  return Math.max(BALANCE.build.minWeeks, Math.round(w));
}

/** R&D cost after engineering discount (more engineer skill = cheaper research). */
export function discountedRd(rdCost: Money, engineerSkill: number): Money {
  const factor = Math.max(
    0.45,
    1 - engineerSkill * BALANCE.staff.engineerRdSpeedPerSkill,
  );
  return scale(rdCost, factor);
}

/** Design-tier ceiling from designer skill (min 1). */
export function designCeiling(designerSkill: number): number {
  return 1 + Math.floor(designerSkill * BALANCE.staff.designerCeilingPerSkill);
}

export function canAfford(cash: Money, cost: Money): boolean {
  return gte(cash, cost);
}

export { dollars };
