import { RESEARCH_PROJECTS } from "../engine/research.ts";
export function researchEraView(era: number, completed: readonly string[], pending: ReadonlySet<string | undefined>) {
  const all = RESEARCH_PROJECTS.filter(p => p.era === era);
  return { total: all.length, completed: all.filter(p => completed.includes(p.id)).length, visible: all.filter(p => !completed.includes(p.id) && !pending.has(p.id)) };
}
