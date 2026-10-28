import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { OUTPUT_DIR } from "./data.js";
import type { Verdict } from "./types.js";

/**
 * Human-in-the-loop log. Every decision Sanne takes is appended here (JSON lines).
 * An "override" = her final verdict differs from the engine's proposal; it is kept with her reason
 * so it can feed the comparison and a proposed rule/skill update. The engine never changes its own rules.
 */
export interface Decision {
  at: string;
  invoiceNo: string;
  proposed: Verdict;
  final: Verdict;
  override: boolean;
  sanneReason: string;
  finalDisputeExclCents?: number;   // if she edited the amount
  decidedBy: string;
}

const path = () => join(process.env.DECISIONS_FILE ?? join(OUTPUT_DIR, "decisions.jsonl"));

export function recordDecision(d: Omit<Decision, "at" | "override" | "decidedBy"> & { decidedBy?: string }): Decision {
  const full: Decision = { at: new Date().toISOString(), override: d.proposed !== d.final || d.finalDisputeExclCents !== undefined, decidedBy: d.decidedBy ?? "Sanne Verbeek", ...d };
  mkdirSync(dirname(path()), { recursive: true });
  appendFileSync(path(), JSON.stringify(full) + "\n");
  return full;
}

export function listDecisions(): Decision[] {
  if (!existsSync(path())) return [];
  return readFileSync(path(), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
