import { describe, expect, it } from "vitest";
import { compareWithSanne } from "../src/compare.js";
import { buildContext, reviewAll, reviewInvoice } from "../src/engine.js";
import { renderDraftEmail, renderReviewList, totals } from "../src/render.js";

const ctx = buildContext();
const rs = reviewAll(ctx);
const rv = (no: string) => rs.find((r) => r.invoice.invoiceNo === no)!;

/** [verdict, disputed excl. VAT, VAT, other] in cents. Hand-verified line by line (see NOTES.md). */
const GOLDEN: Record<string, [string, number, number, number]> = {
  "B-26-0089": ["dispute", 3660, 769, 0], "F26-0001": ["approve", 0, 0, 0], "DW26-002": ["dispute", 0, 5880, 0],
  "B-26-0097": ["approve", 0, 0, 0], "F26-0007": ["approve", 0, 0, 0], "2026-0035": ["approve", 0, 0, 0],
  "B-26-0099": ["approve", 0, 0, 0], "2026-0031": ["approve", 0, 0, 0], "F26-0012": ["approve", 0, 0, 0],
  "2026-0038": ["dispute", 2411, 506, 0], "2026-0040": ["dispute", 7840, 1646, 0], "DW26-004": ["approve", 0, 0, 0],
  "2026-0044": ["dispute", 12074, 2536, 0], "F26-0010": ["approve", 0, 0, 0], "B-26-0102": ["dispute", 4644, 975, 0],
  "2026-0049": ["approve", 0, 0, 0], "2026-0050": ["approve", 0, 0, 0], "DW26-009": ["approve", 0, 0, 0],
  "DW26-011": ["dispute", 0, 6068, 0], "F26-0016": ["dispute", 2724, 572, 0], "2026-C003": ["approve", 0, 0, 0],
  "DW26-013": ["hold", 0, 0, 0], "2026-0052": ["dispute", 0, 0, 10000], "2026-0057": ["dispute", 2168, 455, 0],
  "B-26-0127": ["dispute", 6398, 1344, 0], "DW26-014": ["approve", 0, 0, 0], "DW26-015": ["hold", 0, 0, 0],
  "B-26-0131": ["dispute", 24000, 5040, 0], "DW26-016": ["dispute", 1000, 90, 0], "F26-0018": ["approve", 0, 0, 0],
  "2026-0058": ["dispute", 4644, 976, 0], "DW26-017": ["approve", 0, 0, 0], "F26-0019": ["dispute", 140400, 29484, 0],
  "F26-0021": ["dispute", 4644, 975, 0], "B-26-0140": ["dispute", 5850, 1229, 0], "2026-0061": ["hold", 0, 0, 0],
  "2026-0063": ["approve", 0, 0, 0], "B-26-0144": ["dispute", 1414, 297, 0], "DW26-018": ["dispute", 10114, 910, 0],
  "F26-0024": ["dispute", 31000, 6510, 0],
};

describe("golden results for all 40 invoices", () => {
  it("covers every invoice exactly once", () => { expect(Object.keys(GOLDEN).sort()).toEqual(rs.map((r) => r.invoice.invoiceNo).sort()); });
  for (const [no, [verdict, excl, vatc, other]] of Object.entries(GOLDEN)) {
    it(`${no}: ${verdict} ${excl}/${vatc}/${other}`, () => {
      const r = rv(no);
      expect([r.verdict, r.disputeExclCents, r.disputeVatCents, r.disputeOtherCents]).toEqual([verdict, excl, vatc, other]);
    });
  }
  it("totals", () => {
    const t = totals(rs);
    expect([t.approve, t.dispute, t.hold]).toEqual([17, 20, 3]);
    expect([t.excl, t.vat, t.other]).toEqual([264985, 66262, 10000]);
  });
});

describe("rules behave as the CONTRACT says (not as Sanne said)", () => {
  it("4.2: execution date decides the price year, not the invoice date", () => {
    const r = rv("2026-0038"); // invoiced 12 Jan 2026, executed 17 Dec 2025
    expect(r.verdict).toBe("dispute");
    expect(r.findings.filter((f) => f.kind === "price").map((f) => f.disputeExclCents).sort((a, b) => a - b)).toEqual([561, 1850]);
    expect(rv("2026-0031").verdict).toBe("approve"); // executed 6 Jan 2026 -> indexed price is right
  });
  it("4.2: a mixed invoice only disputes the lines billed at the wrong year's price", () => {
    const r = rv("2026-0040"); // kettle indexed (wrong), labour 2025 (right)
    expect(r.findings.filter((f) => f.severity === "dispute")).toHaveLength(1);
    expect(r.findings[0].lineNos).toEqual([1]); expect(r.disputeExclCents).toBe(7840);
    const b = rv("B-26-0089"); // bitumen indexed (wrong), labour 62,00 (right)
    expect(b.disputeExclCents).toBe(3660);
  });
  it("4.1: unit conversion (rol 25 m vs metres) is compared per list unit, exactly", () => {
    const r = rv("2026-0057");
    expect(r.disputeExclCents).toBe(2168); // 40 m billed 290,00; allowed 40/25 x 167,70 = 268,32
    expect(r.findings[0].evidence.join(" ")).toContain("268,32");
    expect(rv("2026-0050").verdict).toBe("approve"); // 2 rolls at 167,70 is correct
  });
  it("4.3: call-out fee only on spoed, and once", () => {
    expect(rv("B-26-0102").disputeExclCents).toBe(4644);       // regular work; 46,44 not Sanne's 45,00
    expect(rv("F26-0021").findings[0].kind).toBe("voorrijkosten");
    expect(rv("2026-0058").disputeExclCents).toBe(4644);       // spoed but charged twice -> only the second
    for (const no of ["B-26-0097", "B-26-0099", "F26-0007", "F26-0010", "2026-0035"]) expect(rv(no).verdict).toBe("approve"); // one fee on spoed = fine
  });
  it("4.4: hours above max (+ MU) at the contract rate", () => {
    expect(rv("2026-0044").disputeExclCents).toBe(12074);  // 8 h vs 6 -> 2 x 60,37
    expect(rv("DW26-018").disputeExclCents).toBe(10114);   // 14 h vs 12 -> 2 x 50,57
    expect(rv("B-26-0127").disputeExclCents).toBe(6398);   // 10 h vs 8+1 (MU-0241) -> 1 x 63,98
    expect(rv("DW26-014").verdict).toBe("approve");        // 20 h = 18 + 2 (MU-0233)
    expect(rv("DW26-009").verdict).toBe("approve");        // exactly at max 16
  });
  it("4.5: meerwerk — free up to 250, GA covers up to the approved amount, otherwise NOTHING", () => {
    expect(rv("2026-0063").verdict).toBe("approve");        // 180 <= 250
    expect(rv("DW26-009").verdict).toBe("approve");         // 385 with GA-0412 (400): Sanne wrongly disputed
    expect(rv("B-26-0131").disputeExclCents).toBe(24000);   // 640 - 400
    expect(rv("F26-0024").disputeExclCents).toBe(31000);    // 310 > 250 and no GA -> all 310, not 60
  });
  it("4.6: 9% only on W01/W04 and only for homes older than two years", () => {
    expect(rv("DW26-011").disputeVatCents).toBe(6068);      // labour billed 21%, home 1968
    expect(rv("DW26-002").disputeVatCents).toBe(5880);      // same error on a December-2025 job
    expect(rv("DW26-004").verdict).toBe("approve");
    expect(rv("DW26-015").verdict).toBe("hold");            // 2025 new build billed 9%: undercharged, not reclaimable
    expect(rv("2026-0061").verdict).toBe("hold");           // Hoekstra billed 9%
    expect(rv("DW26-015").disputeVatCents).toBe(0);
  });
  it("4.7: item off the price list", () => { expect(rv("B-26-0140").disputeExclCents).toBe(5850); expect(rv("B-26-0140").needsSanne).toBe(true); });
  it("4.8: duplicate invoice is disputed in full; the original is not", () => {
    expect(rv("F26-0019").disputeExclCents).toBe(140400); expect(rv("F26-0019").payableExclCents).toBe(0);
    expect(rv("F26-0001").verdict).toBe("approve");
  });
  it("4.8: credit note is netted, the disputed call-out fee is NOT disputed twice", () => {
    const o = rv("2026-0049");
    expect(o.verdict).toBe("approve"); expect(o.disputeExclCents).toBe(0); expect(o.creditAppliedInclCents).toBe(-5619);
    expect(o.findings.some((f) => f.kind === "credit-note" && /ALREADY CREDITED/.test(f.reasonEn))).toBe(true);
    expect(rv("2026-C003").verdict).toBe("approve");
  });
  it("4.9: unknown work order = hold, nothing else is claimed", () => {
    const r = rv("DW26-013"); expect(r.verdict).toBe("hold"); expect(r.disputeExclCents + r.disputeVatCents).toBe(0);
  });
  it("arithmetic errors in the invoice itself are caught", () => {
    expect(rv("2026-0052").disputeOtherCents).toBe(10000);  // total 510,20 but 339,01 + 71,19 = 410,20
    expect(rv("DW26-016").disputeExclCents).toBe(1000);     // 30 m2 x 7,43 = 222,90, billed 232,90
  });
  it("invoices that are fine are NOT flagged (no false positives)", () => {
    const clean = ["2026-0031", "2026-0035", "2026-0050", "2026-0063", "B-26-0097", "B-26-0099", "DW26-004", "DW26-009", "DW26-014", "DW26-017", "F26-0001", "F26-0007", "F26-0010", "F26-0012", "F26-0018"];
    for (const n of clean) expect(rv(n).findings.filter((f) => f.severity !== "info"), n).toEqual([]);
  });
  it("VAT per finding adds up to the exact invoice-level VAT", () => {
    for (const r of rs) {
      const sum = r.findings.filter((f) => f.severity === "dispute").reduce((a, f) => a + f.disputeVatCents, 0);
      expect(sum, r.invoice.invoiceNo).toBe(r.disputeVatCents);
    }
  });
  it("never claims more than was billed", () => {
    for (const r of rs) if (!r.invoice.isCredit) expect(r.disputeExclCents + r.disputeVatCents + r.disputeOtherCents, r.invoice.invoiceNo).toBeLessThanOrEqual(r.billedInclCents);
  });
  it("judgment calls are marked so Sanne looks at them", () => {
    expect(rs.filter((r) => r.needsSanne).map((r) => r.invoice.invoiceNo).sort()).toEqual(["2026-0061", "B-26-0140", "DW26-013", "DW26-015"]);
  });
});

describe("rendering", () => {
  it("review list contains every invoice, the totals and Dutch contractor text", () => {
    const md = renderReviewList(rs, ctx);
    for (const r of rs) expect(md).toContain(r.invoice.invoiceNo);
    expect(md).toContain("€ 2.649,85"); expect(md).toContain("Voor de aannemer");
  });
  it("dispute e-mail is a clearly marked draft in Dutch and never claims to be sent", () => {
    const d = renderDraftEmail(rv("2026-0044"))!;
    expect(d).toContain("CONCEPT — nog niet verzonden"); expect(d).toContain("art. 4.10"); expect(d).toContain("€ 120,74");
    expect(renderDraftEmail(rv("2026-0031"))).toBeNull();
  });
  it("re-reviewing is stable (no hidden state)", () => {
    const a = JSON.stringify(reviewInvoice(rv("2026-0044").invoice, ctx).findings.map((f) => f.disputeExclCents));
    const b = JSON.stringify(reviewInvoice(rv("2026-0044").invoice, ctx).findings.map((f) => f.disputeExclCents));
    expect(a).toBe(b);
  });
});

describe("comparison with Sanne's 10", () => {
  const rows = compareWithSanne(rs);
  it("exactly two verdict differences — and in both the contract sides with the engine", () => {
    expect(rows).toHaveLength(10);
    expect(rows.filter((r) => !r.match).map((r) => r.file).sort()).toEqual(["h-2026-0038.txt", "w-DW26-009.txt"]);
  });
  it("every row has commentary", () => { for (const r of rows) expect(r.commentary.length, r.file).toBeGreaterThan(20); });
});
