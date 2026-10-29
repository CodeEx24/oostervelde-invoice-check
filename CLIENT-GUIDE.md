# Client guide: checking a new month of invoices

This guide is for checking a **new batch** of invoices (for example February) with the same tool. You do not change any code. You put the new files in a new folder, point the tool at it, and run the same review.

**The rule stays the same: the tool proposes, Sanne decides. Nothing is sent to a contractor by the tool.**

---

## Step 1: Make a folder for the new month

Create a folder under `months/` with exactly these file names:

```
months/2026-02/
  invoices/                   ← the new invoices, one .txt file per invoice
  work-orders-export.csv      ← the NEW work-order export (same columns as before)
  price-agreement-2025.csv    ← copy from data/ (unchanged unless the price list changes)
  contract-excerpt.md         ← copy from data/
```

- The work-order export **must contain the new month's work orders**. If it does not, every invoice goes on **hold** as "unknown work order" (Art. 4.9).
- `reference/sanne-verdicts.csv` is optional. It is only used for the comparison report and is not needed for normal monthly use.

`months/` is in `.gitignore`, so real invoices are never committed. The repository is public: **never put client data anywhere else in the repo.**

## Step 2a: Get the review as a report (no Claude needed)

From the `solution` folder.

PowerShell (Windows):
```powershell
$env:DATA_DIR = "months/2026-02"; $env:OUTPUT_DIR = "months/2026-02/output"; npm run review
```

Bash (macOS/Linux/Git Bash):
```bash
DATA_DIR=months/2026-02 OUTPUT_DIR=months/2026-02/output npm run review
```

You get in `months/2026-02/output/`:
- `review-list.md`: the review list to read (verdict, line, rule, amount, evidence per invoice)
- `review-list.csv` / `review-list.json`: the same list for Excel or other tools
- `drafts/*.nl.txt`: Dutch dispute e-mails, marked **CONCEPT — nog niet verzonden** (draft, not sent)

## Step 2b: Or review it together with Claude (the full workflow)

1. Point the MCP server at the new folder. In `.mcp.json`, add an `env` block:
   ```json
   {
     "mcpServers": {
       "oostervelde-invoice-check": {
         "command": "npx",
         "args": ["tsx", "src/server.ts"],
         "env": {
           "DATA_DIR": "months/2026-02",
           "OUTPUT_DIR": "months/2026-02/output",
           "DECISIONS_FILE": "months/2026-02/output/decisions.jsonl"
         }
       }
     }
   }
   ```
   For Claude Desktop, put the same `env` block in its config (see README, Option B), using full paths.
2. **Restart the server.** In Claude Code type `/mcp` and reconnect `oostervelde-invoice-check` (or restart Claude Code / Claude Desktop). The server reads the data once at start-up, so without a restart it still shows the old month.
3. Start the review:
   ```
   /oostervelde-invoice-review Review the February invoices. Show me what needs my judgement first.
   ```
4. Claude shows the totals, then the **⚠ items that need your judgement**, then disputes, then proposed approvals.
5. **Sanne decides** each invoice: accept, reject or change. Claude logs it with `record_decision`. If she overrides a proposal, she gives her reason in her own words (an override without a reason is refused).
6. Claude drafts the Dutch dispute e-mails. **Sanne reads, edits and sends them herself.**
7. At the end Claude lists the decisions and overrides, and *proposes* rule changes for a developer to consider. The tool never changes its own rules.

## Step 3: Check for surprises

| What you see | What it means | Who fixes it |
|---|---|---|
| Error **"unknown supplier layout"** | A new contractor, or a contractor changed its invoice format | Developer adds a parser in `src/parsers/` |
| Many invoices on **hold: unknown work order** | Wrong or old work-order export | Export the correct file for this month |
| Invoices arrive as **PDF** | Only text input is supported | Convert to `.txt` first |
| Error about a missing file | A file name in the month folder is different | Use exactly the names in Step 1 |

## What the tool does not handle (yet)

- **Only the 4 known contractors**: Hoekstra, De Wit, Bosman, Jansen.
- **Contract terms are fixed**: 2025 prices + 3,2 % indexation from 1 January 2026 (by execution date). A new price list or indexation needs a developer to update the price list and `src/money.ts` / `src/dates.ts`.
- **Report titles still say "January"**. The checks are correct for any month; only the headings are hard-coded.
- **Each month is checked on its own.** Duplicates or extra hours across earlier months are not detected.
- **No received date** in the data, so the 10-working-day dispute deadline (Art. 4.10) is counted from the invoice date.
- Do **not** run `npm test` to check new data. The tests are pinned to the January dataset on purpose.

## Monthly checklist

- [ ] New folder `months/YYYY-MM/` with `invoices/`, the new `work-orders-export.csv`, the price list and the contract excerpt
- [ ] Run the review (Step 2a) or point the server at the folder and restart it (Step 2b)
- [ ] Look at every ⚠ and HOLD item first
- [ ] Sanne decides every invoice; overrides have a reason
- [ ] Sanne reviews and sends the dispute e-mails herself (within 10 working days, Art. 4.10)
- [ ] Pay approved invoices and the undisputed part of disputed ones (Art. 4.10)
