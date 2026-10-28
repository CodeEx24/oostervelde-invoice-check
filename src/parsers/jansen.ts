import { parseDate } from "../dates.js";
import { parseEuro } from "../money.js";
import type { Invoice, PriceItem } from "../types.js";
import { AMT, QTY, mkLine, mustMatch, parseVatLines } from "./common.js";

/** Jansen: description on one line, "qty unit @ price -> amount" on the next. Dates DD/MM/YYYY (day first). */
export function parseJansen(file: string, text: string, prices: PriceItem[]): Invoice {
  const h = mustMatch(text, /FACTUUR\s+(\S+)\s+\((\S+)\)/, "invoice header", file);
  const w = /Werkbon:\s*(WO-\d{2}-\d+).*?uitgevoerd op\s+(\S+)/.exec(text);
  const detailRe = new RegExp(String.raw`^\s+(${QTY})\s+(\S+)\s+@\s+(${AMT})\s+->\s+(${AMT})\s*$`);
  const rows = text.split(/\r?\n/);
  const lines = [];
  for (let i = 0; i < rows.length; i++) {
    const m = detailRe.exec(rows[i]);
    if (!m || i === 0) continue;
    const descLine = rows[i - 1];
    lines.push(mkLine(lines.length + 1, `${descLine.trim()}  |  ${rows[i].trim()}`, descLine, m[1], m[2], m[3], m[4], null, "Jansen", prices));
  }
  return {
    file, supplier: "Jansen", invoiceNo: h[1], invoiceDate: parseDate(h[2]),
    executionDate: w ? parseDate(w[2]) : null, workOrder: w?.[1] ?? null, isCredit: false, creditOf: null, lines,
    statedSubtotalCents: parseEuro(mustMatch(text, new RegExp(String.raw`Subtotaal:\s*(${AMT})`), "subtotal", file)[1]),
    vatLines: parseVatLines(text),
    statedTotalCents: parseEuro(mustMatch(text, new RegExp(String.raw`^Totaal:\s*EUR\s*(${AMT})`, "m"), "total", file)[1]),
  };
}
