import { loadSanneVerdicts } from "./data.js";
import type { Context } from "./engine.js";
import { eur } from "./money.js";
import { totalDisputeIncl } from "./render.js";
import type { InvoiceReview } from "./types.js";

/** Analyst commentary per Sanne verdict (hand-written; the table around it is generated). */
export const COMMENTARY: Record<string, { who: "same" | "sanne-wrong" | "amount-differs" | "engine-wrong"; text: string }> = {
  "h-2026-0031.txt": { who: "same", text: "Both approve. Executed 6 Jan 2026, so indexed prices apply (CV-ketel 2.528,40, labour 60,37); 5 h ≤ max 6." },
  "w-DW26-004.txt": { who: "same", text: "Both approve. Executed 8 Jan 2026 (indexed prices). Home built 1972 (> 2 years): 9 % on labour W01 and ceiling W04, 21 % on paint — exactly as billed. 12 h ≤ max 14." },
  "j-F26-0007.txt": { who: "same", text: "Both approve. Work order WO-26-1003 is spoed, so one call-out fee is allowed. 2 h ≤ max 3, prices indexed (executed 5 Jan 2026)." },
  "h-2026-0038.txt": { who: "sanne-wrong", text: "DIFFERENT. Sanne approved because 'prices match the new price list'. But the work was executed on 17 Dec 2025 and Art. 4.2 says the EXECUTION date decides, not the invoice date. 2025 prices apply: radiators 289,00 (billed 298,25) and labour 58,50 (billed 60,37). Overcharge 24,11 excl. VAT. Her shortcut 'check that the invoice is from this year' is the wrong test." },
  "b-B-26-0102.txt": { who: "amount-differs", text: "Same verdict, different amount. WO-26-1005 is regular work, so the call-out fee is not allowed (Art. 4.3). Sanne wants back '45,00 + btw', but the fee billed is 46,44: the 2025 price of 45,00 indexed by 3,2 % (work executed 12 Jan 2026). Disputing 45,00 would leave 1,44 unrecovered; the contractor would also point out the mismatch with the invoice line." },
  "w-DW26-009.txt": { who: "sanne-wrong", text: "DIFFERENT. Sanne disputes the meerwerk of 385,00 as 'above 250, no approval seen'. But WO-26-1006 in the work-order export carries approval GA-0412 for EUR 400,00 (Art. 4.5: with approval, up to the approved amount is paid). 385,00 ≤ 400,00, so it is payable. Sanne said herself that she doesn't always open the export. Disputing it would have been wrong and the contractor would have pushed back." },
  "h-2026-0044.txt": { who: "same", text: "Both dispute. WO-26-1007 max 6 h, no MU approval; billed 8 h → 2 h × 60,37 = 120,74 excl. VAT (+ 25,36 VAT)." },
  "w-DW26-011.txt": { who: "same", text: "Both dispute. Labour on WO-26-1008 (built 1968) must carry 9 % but was billed at 21 %. Only the VAT is wrong, not the price: reclaim = VAT billed minus VAT due = 60,68 (computed per VAT bucket, the way invoices round)." },
  "j-F26-0012.txt": { who: "same", text: "Both approve. 6 smoke detectors at the indexed 40,76 (executed 7 Jan 2026), 2 h ≤ max 3, regular work with no call-out fee." },
  "b-B-26-0097.txt": { who: "same", text: "Both approve. WO-26-1010 is spoed: one call-out fee (46,44, indexed) is allowed; 3 h ≤ max 4." },
};

/** English translations of Sanne's Dutch notes (ours). */
export const NOTE_EN: Record<string, string> = {
  "j-F26-0007.txt": "emergency job, call-out fee OK",
  "h-2026-0038.txt": "prices match the new price list",
  "b-B-26-0102.txt": "call-out fee on regular work, claim back 45.00 + VAT",
  "w-DW26-009.txt": "extra work 385.00 above the 250, no approval seen",
  "h-2026-0044.txt": "8 hours invoiced, max 6. Claim back 2 hours",
  "w-DW26-011.txt": "painting labour charged at 21% VAT, should be 9%",
  "b-B-26-0097.txt": "emergency",
};

export interface CompareRow {
  file: string; invoiceNo: string; supplier: string;
  sanne: string; sanneNote: string; sanneNoteEn: string; ours: string; match: boolean;
  oursAmount: string; commentary: string; who: string;
}

export function compareWithSanne(rs: InvoiceReview[], dir?: string): CompareRow[] {
  const sanne = loadSanneVerdicts(dir);
  return sanne.map((s) => {
    const r = rs.find((x) => x.invoice.file === s.file)!;
    const c = COMMENTARY[s.file];
    return {
      file: s.file, invoiceNo: s.invoiceNo, supplier: s.supplier, sanne: s.verdict, sanneNote: s.note, sanneNoteEn: NOTE_EN[s.file] ?? "", ours: r.verdict,
      match: r.verdict === s.verdict, oursAmount: r.verdict === "dispute" ? `${eur(r.disputeExclCents)} excl. + ${eur(r.disputeVatCents)} VAT = ${eur(totalDisputeIncl(r))}` : "-",
      commentary: c?.text ?? "", who: c?.who ?? "?",
    };
  });
}

export function renderComparison(rows: CompareRow[]): string {
  const diffV = rows.filter((r) => !r.match);
  const amt = rows.filter((r) => r.who === "amount-differs");
  const L: string[] = [];
  L.push("# Comparison with Sanne's 10 verdicts");
  L.push("");
  L.push(`**Result:** the engine agrees with Sanne on the verdict for ${rows.length - diffV.length} of ${rows.length} invoices, differs on ${diffV.length} (${diffV.map((r) => r.invoiceNo).join(", ")}), and agrees on verdict but not on the amount for ${amt.length} (${amt.map((r) => r.invoiceNo).join(", ")}). In both verdict differences the contract supports the engine, not Sanne. Her Dutch notes are translated in the table.`);
  L.push("");
  L.push("| Invoice | Sanne | Engine | Same verdict? | Sanne's note (NL → EN) | Engine dispute |");
  L.push("|---|---|---|---|---|---|");
  for (const r of rows) L.push(`| ${r.supplier} ${r.invoiceNo} | ${r.sanne} | ${r.ours} | ${r.match ? "yes" : "**NO**"} | ${r.sanneNote ? `${r.sanneNote} → ${r.sanneNoteEn}` : "-"} | ${r.oursAmount} |`);
  L.push("");
  L.push("## Every difference, explained");
  L.push("");
  for (const r of rows) {
    L.push(`**${r.supplier} ${r.invoiceNo}** — ${r.who === "same" ? "agree" : r.who === "amount-differs" ? "agree on verdict, amount differs" : "DIFFERENT verdict"}`);
    L.push("");
    L.push(r.commentary);
    L.push("");
  }
  L.push("## What this says about the engine and about Sanne");
  L.push("");
  L.push("- Sanne's two misses are exactly the two shortcuts she described in the audit: 'check the invoice date for the price year' and 'skip the work-order export when it's small or I'm busy'. Both are the kind of lookups a tool should do for her.");
  L.push("- Nothing in the 10 shows the engine being wrong against the contract. That is a statement about these 10 only: the 30 others were checked against rules, not against Sanne. Where the engine is least sure is listed in NOTES.md (judgment calls).");
  L.push("");
  return L.join("\n");
}
