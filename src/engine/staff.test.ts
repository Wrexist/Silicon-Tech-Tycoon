// Role-true skills (old backlog item, fixed in the "role-true skills" pass): a person's role
// label, headline level, and best-discipline advice must always agree — the role's discipline is
// the strongest in the profile, so an "Engineer 3" can never secretly be a better marketer.
import { describe, expect, it } from "vitest";
import { makeRng } from "./rng.ts";
import { makeSkills, levelFromSkills, ROLE_DISCIPLINE, type Discipline } from "./staff.ts";
import type { StaffRole } from "./types.ts";

const ROLES: StaffRole[] = ["engineer", "designer", "marketer"];
const DISCIPLINES: Discipline[] = ["engineering", "design", "marketing"];

describe("makeSkills — the role's discipline is always the strongest", () => {
  it("off-disciplines never exceed the primary across roles, levels and seeds", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = makeRng(seed);
      for (const role of ROLES) {
        for (let level = 1; level <= 10; level++) {
          const skills = makeSkills(rng, role, level);
          const primary = ROLE_DISCIPLINE[role];
          for (const d of DISCIPLINES) {
            if (d === primary) continue;
            expect(skills[d]).toBeLessThanOrEqual(skills[primary]);
            // beyond the tiny-level rounding zone the primary is STRICTLY strongest
            if (skills[primary] >= 4) expect(skills[d]).toBeLessThan(skills[primary]);
          }
        }
      }
    }
  });

  it("the headline level derived back from the profile stays within ±1 of the rolled level", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const rng = makeRng(seed);
      for (const role of ROLES) {
        for (let level = 1; level <= 10; level++) {
          const skills = makeSkills(rng, role, level);
          expect(Math.abs(levelFromSkills(skills, role) - level)).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
