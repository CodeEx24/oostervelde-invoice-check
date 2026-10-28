import { parseDate } from "../dates.js";
import { parseEuro } from "../money.js";
import type { Invoice, PriceItem } from "../types.js";
import { AMT, QTY, mkLine, mustMatch, parseVatLines } from "./common.js";

/** Hoekstra: tidy column table. Dates DD-MM-YYYY. Credit notes start with "CREDITFACTUUR". */
export function parseHoekstra(file: string, text: string, prices: PriceItem[]): Invoice {
  const no = mustMatch(text, /Factuurnummer:\s*(\S+)/, "invoice number", file)[1];
  const date = parseDate(mustMatch(text, /Factuurdatum:\s*(\S+)/, "invoice date", file)[1]);
  const wo = /Uw werkorder:\s*(WO-\d{2}-\d+)/.exec(text)?.[1] ?? null;
  const exec = /Datum uitvoering:\s*(\S+)/.exec(text)?.[1];
  const isCredit = /^\s*CREDITFACTUUR/m.test(text);
  const creditOf = /Betreft creditering van factuur\s+(\S+)/.exec(text)?.[1] ?? null;

  const lineRe = new RegExp(
    String.raw`^(.+?)\s{2,}(${QTY})\s+(rol 25 m|\S+)\s+(${AMT})\s+(${AMT})\s*$`,
  );
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = lineRe.exec(raw);
    if (m) lines.push(mkLine(lines.length + 1, raw, m[1], m[2], m[3], m[4], m[5], null, "Hoekstra", prices));
  }
  return {
    file, supplier: "Hoekstra", invoiceNo: no, invoiceDate: date,
    executionDate: exec ? parseDate(exec) : null, workOrder: wo, isCredit, creditOf, lines,
    statedSubtotalCents: parseEuro(mustMatch(text, new RegExp(String.raw`Subtotaal excl\. BTW:\s*(${AMT})`), "subtotal", file)[1]),
    vatLines: parseVatLines(text),
    statedTotalCents: parseEuro(mustMatch(text, new RegExp(String.raw`TOTAAL TE BETALEN:\s*EUR\s*(${AMT})`), "total", file)[1]),
  };
}
