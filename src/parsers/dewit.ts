import { parseDate } from "../dates.js";
import { parseEuro } from "../money.js";
import type { Invoice, PriceItem } from "../types.js";
import { AMT, QTY, mkLine, mustMatch, parseVatLines } from "./common.js";

/**
 * De Wit: written like a letter. Dutch month names ("5 januari 2026"), VAT rate per line "(9% btw)".
 * Meerwerk lines contain an extra colon: "Meerwerk: houtrot herstellen kozijn trapgat: 1 post x EUR 385,00 ..."
 */
export function parseDeWit(file: string, text: string, prices: PriceItem[]): Invoice {
  const no = mustMatch(text, /^FACTUUR\s+(\S+)/m, "invoice number", file)[1];
  const date = parseDate(mustMatch(text, /^Velp,\s+(.+)$/m, "invoice date", file)[1]);
  const exec = /uitgevoerd\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/.exec(text)?.[1];
  const wo = /Opdracht:\s*(WO-\d{2}-\d+)/.exec(text)?.[1] ?? null;
  const lineRe = new RegExp(
    String.raw`^-\s+(.+?):\s+(${QTY})\s+(\S+)\s+x\s+EUR\s+(${AMT})\s+=\s+EUR\s+(${AMT})\s+\((\d+)%\s+btw\)\s*$`,
  );
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = lineRe.exec(raw);
    if (m) lines.push(mkLine(lines.length + 1, raw, m[1], m[2], m[3], m[4], m[5], +m[6], "De Wit", prices));
  }
  return {
    file, supplier: "De Wit", invoiceNo: no, invoiceDate: date,
    executionDate: exec ? parseDate(exec) : null, workOrder: wo, isCredit: false, creditOf: null, lines,
    statedSubtotalCents: parseEuro(mustMatch(text, new RegExp(String.raw`Totaal excl\. btw EUR\s*(${AMT})`), "net total", file)[1]),
    vatLines: parseVatLines(text),
    statedTotalCents: parseEuro(mustMatch(text, new RegExp(String.raw`Totaal incl\. btw EUR\s*(${AMT})`), "total", file)[1]),
  };
}
