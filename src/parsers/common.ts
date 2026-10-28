import { parseEuro, parseQtyMilli } from "../money.js";
import type { InvoiceLine, PriceItem, Supplier, VatLine } from "../types.js";

export const AMT = String.raw`-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}`;
export const QTY = String.raw`-?\d+(?:,\d+)?`;

export function mustMatch(text: string, re: RegExp, what: string, file: string): RegExpExecArray {
  const m = re.exec(text);
  if (!m) throw new Error(`${file}: could not find ${what}`);
  return m;
}

export function parseVatLines(text: string): VatLine[] {
  const out: VatLine[] = [];
  const re = new RegExp(String.raw`BTW\s+(\d+)%\s+over\s+(${AMT}):\s*(${AMT})`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ ratePct: +m[1], baseCents: parseEuro(m[2]), vatCents: parseEuro(m[3]), raw: m[0] });
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Match a printed description to the supplier's price-list code. */
export function matchCode(description: string, supplier: Supplier, prices: PriceItem[]): string | null {
  const d = norm(description);
  const hit = prices.find((p) => p.supplier === supplier && norm(p.description) === d);
  if (hit) return hit.code;
  // Credit notes: "Creditering voorrijkosten, ..." refers to the call-out fee code.
  if (/^creditering voorrijkosten/.test(d)) {
    return prices.find((p) => p.supplier === supplier && /^voorrijkosten/i.test(p.description))?.code ?? null;
  }
  return null;
}

export function stripMeerwerk(desc: string): { description: string; isMeerwerk: boolean } {
  const m = /^meerwerk:\s*(.+)$/i.exec(desc.trim());
  return m ? { description: m[1].trim(), isMeerwerk: true } : { description: desc.trim(), isMeerwerk: false };
}

export function mkLine(
  n: number, raw: string, desc: string, qty: string, unit: string, unitPrice: string, amount: string,
  vatRatePct: number | null, supplier: Supplier, prices: PriceItem[],
): InvoiceLine {
  const { description, isMeerwerk } = stripMeerwerk(desc);
  return {
    n, raw: raw.trim(), description, isMeerwerk,
    qtyMilli: parseQtyMilli(qty), unit,
    unitPriceCents: parseEuro(unitPrice), amountCents: parseEuro(amount),
    vatRatePct, code: isMeerwerk ? null : matchCode(description, supplier, prices),
  };
}
