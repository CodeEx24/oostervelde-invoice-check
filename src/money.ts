/**
 * Money helpers. All amounts are integer cents (no floats anywhere in the maths).
 * Dutch number format: "1.234,56" (dot = thousands, comma = decimals).
 */

/** Integer division rounded half away from zero. */
export function roundDiv(n: number, d: number): number {
  if (d < 0) { n = -n; d = -d; }
  const sign = n < 0 ? -1 : 1;
  const a = Math.abs(n);
  return sign * Math.floor((2 * a + d) / (2 * d));
}

/** "1.234,56" / "-46,44" / "EUR 490,00" -> cents. Throws on garbage. */
export function parseEuro(raw: string): number {
  const s = raw.replace(/EUR|€/gi, "").replace(/\s+/g, "");
  const m = /^(-?)(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/.exec(s);
  if (!m) throw new Error(`Cannot parse euro amount: "${raw}"`);
  const whole = m[2].replace(/\./g, "");
  const dec = (m[3] ?? "").padEnd(2, "0");
  const cents = parseInt(whole, 10) * 100 + parseInt(dec || "0", 10);
  return m[1] === "-" ? -cents : cents;
}

/** Quantity "2", "-1", "2,5" -> thousandths (so 2,5 = 2500). */
export function parseQtyMilli(raw: string): number {
  const m = /^(-?)(\d+)(?:,(\d{1,3}))?$/.exec(raw.trim());
  if (!m) throw new Error(`Cannot parse quantity: "${raw}"`);
  const v = parseInt(m[2], 10) * 1000 + parseInt((m[3] ?? "").padEnd(3, "0") || "0", 10);
  return m[1] === "-" ? -v : v;
}

/** cents -> "1.234,56" (Dutch). */
export function fmt(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const a = Math.abs(cents);
  const whole = Math.floor(a / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${whole},${(a % 100).toString().padStart(2, "0")}`;
}

/** cents -> "€ 1.234,56" */
export function eur(cents: number): string {
  return `€ ${fmt(cents)}`;
}

/** qty (milli) x unit price (cents) -> line amount (cents), half away from zero. */
export function lineAmount(qtyMilli: number, unitCents: number): number {
  return roundDiv(qtyMilli * unitCents, 1000);
}

/** Art. 4.2: +3.2 %, rounded to whole cents per unit. */
export const INDEX_NUM = 1032;
export const INDEX_DEN = 1000;
export function indexed(baseCents: number): number {
  return roundDiv(baseCents * INDEX_NUM, INDEX_DEN);
}

/** VAT amount for a base at a whole-percent rate, rounded to cents. */
export function vat(baseCents: number, ratePct: number): number {
  return roundDiv(baseCents * ratePct, 100);
}

export function qtyToString(milli: number): string {
  if (milli % 1000 === 0) return String(milli / 1000);
  return (milli / 1000).toString().replace(".", ",");
}
