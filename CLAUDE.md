# CLAUDE.md — Oostervelde Invoice Check Engineering Guide
Working memory for this codebase. Read before writing code.
> PM project: Oostervelde Invoice Check (key OIC). Every branch/commit/PR references OIC-###.

## 1. Product
A local MCP server + Claude skill that checks Dutch contractor invoices against Article 4 of the Woonkring Oostervelde framework contract and gives Sanne (accounts payable) a review list with verdict, rule, amount and evidence. **Core constraint: Sanne signs off every payment — the system proposes, never decides, never contacts a contractor.**

## 2. Tech stack (locked — no swaps without an ADR)
Node 22 · TypeScript (strict, ESM/NodeNext) · `@modelcontextprotocol/sdk` (stdio) · zod · vitest · tsx. No database, no network, no runtime deps beyond the SDK and zod. Money = integer cents.

## 3. Folder structure
```
src/ money.ts dates.ts csv.ts data.ts types.ts contract.ts engine.ts render.ts compare.ts decisions.ts cli.ts server.ts parsers/
test/  data/ (read-only dataset)  output/ (generated)  docs/tickets/  docs/blueprint/  .claude/skills/
```
Rules: parsers only parse (no rules); the engine only decides (no I/O); `render.ts` only formats; `server.ts` stays thin (calls engine/render). Rules live in `engine.ts`, one block per contract article.

## 4. Coding standards & naming conventions
| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case .ts | dewit.ts |
| Functions | camelCase verb-first | reviewInvoice() |
| Constants | UPPER_SNAKE_CASE | MEERWERK_FREE_LIMIT_CENTS |
| Types | PascalCase, no I-prefix | InvoiceReview |
| Money variables | suffix `Cents` | disputeExclCents |
| Tests | *.test.ts | engine.test.ts |
| Branch | `<type>/oic-<n>/<kebab-title>` | feat/oic-12/meerwerk-rule |
| Commit | Conventional Commits | feat(engine): meerwerk cap (OIC-12) |
General: strict types, no `any`; **no floats for money**; parse Dutch formats only in `money.ts`/`dates.ts`; every contract rule cites its article and carries the Dutch quote; fail loudly on an unknown layout (never guess).
Reuse-first: before creating a helper, check `money.ts`, `dates.ts`, `parsers/common.ts`, `render.ts`.

## 5. Git
Trunk-based: short branch → PR → ≥1 review + green `npm test` → squash-merge; PR restates AC.

## 6. Best-practice skills
Consult when relevant: `oostervelde-invoice-review` (the product skill), `pdf`/`xlsx`/`docx` for deliverables. If a skill and a ticket AC conflict: AC wins for behaviour, skill wins for how it's coded.

## 7. Definition of Ready / Done
Ready: AC testable; prerequisites done; ≤ 8 pts. Done: AC met; `npm test` green; golden table updated *with a reason* if numbers change; NOTES.md updated if a decision changed; no float money.

## 8. Documentation & knowledge management
CLAUDE.md changes only for durable, project-wide knowledge (architecture, conventions, anti-duplication rules), at epic completion or when a decision is stable. Per-ticket detail lives in `docs/tickets/OIC-###.md`. Interpretation choices of the contract go in `NOTES.md` > Decisions and translations.

## 9. Commands
`npm install` · `npm test` · `npm run typecheck` · `npm run review` · `npm run compare` · `npm run all` · `npm run server`
> Keep CLAUDE.md canonical; critical rules are mirrored in AGENTS.md.
