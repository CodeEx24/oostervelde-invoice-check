import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compareWithSanne, renderComparison } from "./compare.js";
import { OUTPUT_DIR } from "./data.js";
import { buildContext, reviewAll } from "./engine.js";
import { renderCsv, renderDraftEmail, renderReviewList, reviewView, totals } from "./render.js";
import { eur } from "./money.js";

const cmd = process.argv[2] ?? "all";
const ctx = buildContext();
const rs = reviewAll(ctx);
mkdirSync(join(OUTPUT_DIR, "drafts"), { recursive: true });

function review() {
  writeFileSync(join(OUTPUT_DIR, "review-list.md"), renderReviewList(rs, ctx));
  writeFileSync(join(OUTPUT_DIR, "review-list.csv"), renderCsv(rs));
  writeFileSync(join(OUTPUT_DIR, "review-list.json"), JSON.stringify({ totals: totals(rs), invoices: rs.map(reviewView) }, null, 2));
  let n = 0;
  for (const r of rs) {
    const d = renderDraftEmail(r);
    if (d) { writeFileSync(join(OUTPUT_DIR, "drafts", `${r.invoice.invoiceNo}.nl.txt`), d); n++; }
  }
  const t = totals(rs);
  console.log(`Review list: ${t.invoices} invoices → approve ${t.approve}, dispute ${t.dispute}, hold ${t.hold}`);
  console.log(`To dispute: ${eur(t.excl)} excl. VAT + ${eur(t.vat)} VAT + ${eur(t.other)} total errors = ${eur(t.incl)} incl. VAT`);
  console.log(`Written to ${OUTPUT_DIR} (review-list.md/.csv/.json, ${n} Dutch e-mail drafts in drafts/)`);
}
function compare() {
  const rows = compareWithSanne(rs);
  writeFileSync(join(OUTPUT_DIR, "comparison-with-sanne.md"), renderComparison(rows));
  console.log(`Comparison: ${rows.filter((r) => r.match).length}/${rows.length} verdicts equal → output/comparison-with-sanne.md`);
}
if (cmd === "review" || cmd === "all") review();
if (cmd === "compare" || cmd === "all") compare();
