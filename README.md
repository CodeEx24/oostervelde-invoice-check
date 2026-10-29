# Oostervelde invoice check

A local **MCP server** plus a **Claude skill** that check Woonkring Oostervelde's contractor invoices (40 Dutch invoices, 4 supplier layouts) against **Article 4** of the framework contract, and give Sanne (accounts payable) a review list: invoice, line, contract rule, amount to dispute, evidence, and a *proposed* verdict (approve / dispute / hold). **Sanne decides; nothing is ever sent to a contractor.**

All rules and money maths run in code (integer cents, no floats). Claude only presents, asks Sanne, and logs her decisions.

## Run it in 10 minutes

Prerequisites: Node.js 20+ (tested on 22).

```bash
npm install
npm test            # 91 tests: parsing, every rule, golden results for all 40 invoices, MCP server over stdio
npm run all         # writes output/review-list.{md,csv,json}, output/drafts/*.nl.txt, output/comparison-with-sanne.md
```

Expected last lines:

```
Review list: 40 invoices → approve 17, dispute 20, hold 3
To dispute: € 2.649,85 excl. VAT + € 662,62 VAT + € 100,00 total errors = € 3.412,47 incl. VAT
Comparison: 8/10 verdicts equal → output/comparison-with-sanne.md
```

Use another copy of the dataset: `DATA_DIR=/path/to/unzipped-dataset npm run all` (needs `invoices/`, `price-agreement-2025.csv`, `work-orders-export.csv`, `contract-excerpt.md`, optionally `reference/sanne-verdicts.csv`).

**Checking a new month?** See [CLIENT-GUIDE.md](CLIENT-GUIDE.md): folder layout, the commands, how to point the server and skill at the new data, and the current limits.

## How to use the MCP server and the skill

There are two parts:

- **MCP server** `oostervelde-invoice-check` (`src/server.ts`): exposes the checking engine to Claude as tools (see the table below). It runs locally over stdio, reads only the files in `data/`, and never touches the network.
- **Claude skill** `oostervelde-invoice-review` (`.claude/skills/oostervelde-invoice-review/SKILL.md`): tells Claude *how* to run a review for Sanne. Call the tools, show the judgment calls first, let her decide, log every decision, and only ever produce **drafts**.

### Step 0: install

```bash
git clone https://github.com/CodeEx24/oostervelde-invoice-check.git
cd oostervelde-invoice-check
npm install          # required: the MCP server will not start without node_modules
npm test             # optional sanity check (90 tests)
```

### Option A: Claude Code (zero config)

The repo is already wired for Claude Code:

| File | Role |
|---|---|
| `.mcp.json` | registers the MCP server (`npx tsx src/server.ts`) |
| `.claude/skills/oostervelde-invoice-review/` | the project skill, picked up automatically |

1. Run `claude` in the repo folder.
2. Approve the `oostervelde-invoice-check` MCP server when prompted (or check with `/mcp`; it should say *connected*).
3. Start a review, either by typing `/oostervelde-invoice-review` or by just asking:
   - *"Review the January invoices."*
   - *"Check all invoices and show me what needs my judgment first."*
   - *"Why is Hoekstra 2026-0038 disputed when the prices match the new price list?"*
   - *"Draft the dispute e-mail to Bosman for B-26-0102."*
   - *"I accept the dispute on DW26-011. Log it."*

If `/mcp` shows the server as *failed*, run `npm install` first. A missing `node_modules` is the usual cause.

### Option B: Claude Desktop

1. **Server:** open Settings → Developer → *Edit Config* (`claude_desktop_config.json`) and add the block below, using your own absolute path. Launching `tsx` by full path makes it work regardless of the working directory:

   ```json
   {
     "mcpServers": {
       "oostervelde-invoice-check": {
         "command": "node",
         "args": [
           "C:\\path\\to\\oostervelde-invoice-check\\node_modules\\tsx\\dist\\cli.mjs",
           "C:\\path\\to\\oostervelde-invoice-check\\src\\server.ts"
         ]
       }
     }
   }
   ```

   On macOS/Linux use forward slashes, e.g. `/Users/you/oostervelde-invoice-check/...`. Restart Claude Desktop; the tools appear under the 🔌/tools icon.
2. **Skill:** zip the folder `.claude/skills/oostervelde-invoice-review` (the zip must contain the folder with `SKILL.md` inside) and upload it under Settings → Capabilities → Skills.
3. Ask the same questions as above.

### Option C: any other MCP client / MCP Inspector

```bash
npm run server                                        # stdio server
npx @modelcontextprotocol/inspector npx tsx src/server.ts   # browse and call the tools in a web UI
```

### Environment variables (optional)

| Variable | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `./data` | dataset to review (another month, another copy) |
| `OUTPUT_DIR` | `./output` | where `npm run all` writes the review list and drafts |
| `DECISIONS_FILE` | `output/decisions.jsonl` | where `record_decision` logs Sanne's decisions (git-ignored) |

For the MCP server, set these under `"env": { ... }` in `.mcp.json` / `claude_desktop_config.json`.

### What a session looks like

1. Claude calls `list_invoices` + `find_duplicates`, then `review_all`.
2. You get totals, then **⚠ needs your judgment** items, then disputes (line, article, amount, evidence, Dutch contract quote), then proposed approvals.
3. For each invoice Sanne says accept / reject / change. Claude logs it with `record_decision`, and asks for her reason on any override.
4. For accepted disputes, Claude offers `draft_dispute_email`, which produces a Dutch **draft only**. Nothing is ever sent.

## MCP tools (all read-only except the decision log)

| Tool | What it does |
|---|---|
| `list_invoices` / `get_invoice` | Invoices normalised from the 4 layouts (ISO dates, cents, price-list codes) |
| `get_price(code, execution_date)` | Contract price; +3.2 % only if executed on/after 2026-01-01 (Art. 4.2) |
| `get_work_order(wo)` | Type, max hours, MU/GA approvals, build year; error if unknown (Art. 4.9) |
| `get_contract_rule(query)` | Verbatim Dutch article text + English translation |
| `check_invoice(invoice)` | All Article 4 checks → verdict + findings (article, line, amount, evidence, Dutch sentence) |
| `find_duplicates()` | Duplicate work orders and credit-note netting (Art. 4.8) |
| `review_all(format)` | Full review list (markdown/json) + totals |
| `draft_dispute_email(invoice)` | Dutch **draft** for Sanne. Nothing is sent. |
| `record_decision` / `list_decisions` | Log Sanne's decisions; overrides need her reason |

## Layout

```
src/            money.ts dates.ts parsers/ engine.ts contract.ts render.ts compare.ts decisions.ts cli.ts server.ts
test/           money-dates, parsers, engine (golden), server (real MCP client)
data/           the dataset as received (read-only)
output/         generated review list, comparison, Dutch e-mail drafts
.claude/skills/ the Claude skill   ·   .mcp.json  MCP registration
NOTES.md        decisions & translations, where Sanne decides, what changed, what isn't finished
docs/blueprint/ delivery blueprint (workbook, Jira CSV, import guide)
```

## Design in one paragraph

Parse each supplier layout into one schema (Dutch number/date formats handled, parser self-checks against the invoice's own totals) → apply one function per contract article → produce findings with evidence and a Dutch contractor sentence → proposed verdict. Clear rule breaches are *dispute*; missing data or interpretation is *hold* or flagged ⚠ *judgment*. See `NOTES.md`.
