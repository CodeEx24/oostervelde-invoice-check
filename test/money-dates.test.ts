import { describe, expect, it } from "vitest";
import { addWorkdays, isIndexed, parseDate } from "../src/dates.js";
import { eur, fmt, indexed, parseEuro, parseQtyMilli, roundDiv, vat } from "../src/money.js";

describe("Dutch money", () => {
  it("parses Dutch notation to cents", () => {
    expect(parseEuro("1.234,56")).toBe(123456);
    expect(parseEuro("-46,44")).toBe(-4644);
    expect(parseEuro("EUR 2.528,40")).toBe(252840);
    expect(parseEuro("0,5")).toBe(50);
    expect(parseEuro("1.176,60")).toBe(117660);
    expect(() => parseEuro("12.34")).toThrow();
  });
  it("formats back", () => {
    expect(fmt(123456)).toBe("1.234,56");
    expect(fmt(-4644)).toBe("-46,44");
    expect(eur(5)).toBe("€ 0,05");
  });
  it("parses quantities", () => { expect(parseQtyMilli("2,5")).toBe(2500); expect(parseQtyMilli("-1")).toBe(-1000); });
  it("rounds half away from zero", () => { expect(roundDiv(5, 2)).toBe(3); expect(roundDiv(-5, 2)).toBe(-3); expect(roundDiv(4, 2)).toBe(2); });
  it("indexes every price by 3.2% rounded per unit (Art. 4.2) — matches what suppliers print", () => {
    const cases: [number, number][] = [
      [245000, 252840], [5850, 6037], [16500, 17028], [28900, 29825], [16250, 16770], [4500, 4644], [13500, 13932],
      [4900, 5057], [980, 1011], [1850, 1909], [720, 743], [6200, 6398], [3800, 3922], [5400, 5573], [14500, 14964],
      [5600, 5779], [118000, 121776], [3950, 4076], [2400, 2477],
    ];
    for (const [base, exp] of cases) expect(indexed(base)).toBe(exp);
  });
  it("VAT rounds per bucket", () => { expect(vat(88918, 9)).toBe(8003); expect(vat(20220, 21)).toBe(4246); });
});

describe("Dutch dates", () => {
  it("handles all four supplier formats", () => {
    expect(parseDate("09-01-2026")).toBe("2026-01-09");   // Hoekstra
    expect(parseDate("2026-01-02")).toBe("2026-01-02");   // Bosman
    expect(parseDate("02/01/2026")).toBe("2026-01-02");   // Jansen: DAY first, so 2 January (not 1 February)
    expect(parseDate("12/12/2025")).toBe("2025-12-12");
    expect(parseDate("5 januari 2026")).toBe("2026-01-05"); // De Wit
    expect(parseDate("18 december 2025")).toBe("2025-12-18");
  });
  it("rejects impossible dates", () => { expect(() => parseDate("31-02-2026")).toThrow(); expect(() => parseDate("5 smarch 2026")).toThrow(); });
  it("indexation cut-over is the EXECUTION date", () => { expect(isIndexed("2025-12-31")).toBe(false); expect(isIndexed("2026-01-01")).toBe(true); });
  it("counts working days", () => { expect(addWorkdays("2026-01-16", 10)).toBe("2026-01-30"); });
});
