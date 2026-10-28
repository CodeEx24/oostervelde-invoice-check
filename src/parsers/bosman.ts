import { parseDate } from "../dates.js";
import { parseEuro } from "../money.js";
import type { Invoice, PriceItem } from "../types.js";
import { AMT, QTY, mkLine, mustMatch, parseVatLines } from "./common.js";

/** Bosman: pipe-separated lines, ISO dates, "Uitvoeringsdatum". */
export function parseBosman(file: string, text: string, prices: PriceItem[]): Invoice {
  const h = mustMatch(text, /FACTUUR\s+nr\.\s*(\S+)\s+datum\s+(\S+)/, "invoice header", file);
  const wo = /\(werkorder\s+(WO-\d{2}-\d+)\)/.exec(text)?.[1] ?? null;
  const exec = /Uitvoeringsdatum:\s*(\S+)/.exec(text)?.[1];
  const lineRe = new RegExp(
    String.raw`^\s*(\d+)\.\s+(.+?)\s+\|\s+(${QTY})\s+(\S+)\s+\|\s+a\s+(${AMT})\s+\|\s+(${AMT})\s*$`,
  );
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = lineRe.exec(raw);
    if (m) lines.push(mkLine(+m[1], raw, m[2], m[3], m[4], m[5], m[6], null, "Bosman", prices));
  }
  return {
    file, supplier: "Bosman", invoiceNo: h[1], invoiceDate: parseDate(h[2]),
    executionDate: exec ? parseDate(exec) : null, workOrder: wo, isCredit: false, creditOf: null, lines,
    statedSubtotalCents: parseEuro(mustMatch(text, new RegExp(String.raw`^\s*netto\s+(${AMT})`, "m"), "net total", file)[1]),
    vatLines: parseVatLines(text),
    statedTotalCents: parseEuro(mustMatch(text, new RegExp(String.raw`^\s*totaal\s+(${AMT})`, "m"), "total", file)[1]),
  };
}
