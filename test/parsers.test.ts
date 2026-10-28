import { describe, expect, it } from "vitest";
import { buildContext } from "../src/engine.js";
import { lineAmount, vat } from "../src/money.js";

const ctx = buildContext();
const inv = (no: string) => ctx.invoices.find((i) => i.invoiceNo === no)!;

describe("parsing the 4 layouts", () => {
  it("reads all 40 invoices", () => {
    expect(ctx.invoices).toHaveLength(40);
    const by = (s: string) => ctx.invoices.filter((i) => i.supplier === s).length;
    expect([by("Hoekstra"), by("De Wit"), by("Bosman"), by("Jansen")]).toEqual([13, 10, 8, 9]);
  });
  it("every invoice has a work order, an execution date and at least one line", () => {
    for (const i of ctx.invoices) { expect(i.workOrder, i.file).toBeTruthy(); expect(i.executionDate, i.file).toBeTruthy(); expect(i.lines.length, i.file).toBeGreaterThan(0); }
  });
  it("Jansen dates are day-first", () => { expect(inv("F26-0001").invoiceDate).toBe("2026-01-02"); expect(inv("F26-0001").executionDate).toBe("2025-12-12"); });
  it("De Wit Dutch month names and per-line VAT", () => {
    const i = inv("DW26-004");
    expect(i.invoiceDate).toBe("2026-01-12"); expect(i.executionDate).toBe("2026-01-08");
    expect(i.lines.map((l) => l.vatRatePct)).toEqual([9, 21, 9]);
  });
  it("meerwerk lines (with an extra colon in the text) are flagged and not priced against the list", () => {
    const l = inv("DW26-009").lines.find((x) => x.isMeerwerk)!;
    expect(l.description).toBe("houtrot herstellen kozijn trapgat"); expect(l.amountCents).toBe(38500); expect(l.code).toBeNull();
    expect(inv("2026-0063").lines.find((x) => x.isMeerwerk)?.amountCents).toBe(18000);
    expect(inv("F26-0024").lines.find((x) => x.isMeerwerk)?.amountCents).toBe(31000);
    expect(inv("B-26-0131").lines.find((x) => x.isMeerwerk)?.amountCents).toBe(64000);
  });
  it("credit note refers to its original", () => {
    const c = inv("2026-C003"); expect(c.isCredit).toBe(true); expect(c.creditOf).toBe("2026-0049"); expect(c.statedTotalCents).toBe(-5619);
  });
  it("the unlisted item has no price code", () => {
    expect(inv("B-26-0140").lines.filter((l) => !l.code && !l.isMeerwerk).map((l) => l.description)).toEqual(["Vogelwering dakgoot"]);
  });
  it("only these invoices have internal arithmetic problems (so the engine must catch them, and no others)", () => {
    const bad = ctx.invoices.filter((i) => {
      const lineBad = i.lines.some((l) => lineAmount(l.qtyMilli, l.unitPriceCents) !== l.amountCents);
      const sum = i.lines.reduce((a, l) => a + l.amountCents, 0) !== i.statedSubtotalCents;
      const vatBad = i.vatLines.some((v) => vat(v.baseCents, v.ratePct) !== v.vatCents);
      const tot = i.statedSubtotalCents + i.vatLines.reduce((a, v) => a + v.vatCents, 0) !== i.statedTotalCents;
      return lineBad || sum || vatBad || tot;
    }).map((i) => i.invoiceNo).sort();
    expect(bad).toEqual(["2026-0052", "DW26-016"]);
  });
});
