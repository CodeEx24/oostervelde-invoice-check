# AGENTS.md — Oostervelde Invoice Check
Rules for all coding agents. CLAUDE.md is canonical; this mirrors the must-follow rules.

## Non-negotiables
- Follow the folder structure and naming conventions in CLAUDE.md.
- **Human in the loop:** nothing is paid, approved, or sent to a contractor by code or agents. Output is a *proposal* for Sanne. No mail/send integrations.
- **Money is integer cents.** No floats in any amount calculation. Dutch formats (1.234,56; DD/MM/YYYY) are parsed only in `money.ts` / `dates.ts`.
- **The contract text beats everyone's memory** (Sanne's, yours): cite the article and quote the Dutch text for every rule.
- The price year follows the **execution date**, never the invoice date (Art. 4.2).
- **Reuse-first:** check existing helpers/patterns before writing new ones.
- **Don't bloat CLAUDE.md:** per-ticket detail goes to `docs/tickets/OIC-###.md`.
- Changing a number in the golden table (`test/engine.test.ts`) requires a written reason in the PR and a NOTES.md update.
- Never read, copy or commit real personal/financial data; the dataset here is fictional.

## Git
Branch `<type>/oic-<n>/<title>`; Conventional Commits with the ticket key; squash-merge after green CI.

## Done means
Tests green · AC met · docs updated · no float money · judgment calls are flagged for Sanne, not hidden.
