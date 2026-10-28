/**
 * Dutch date parsing. The four suppliers use four formats:
 *  - Hoekstra: 09-01-2026 (DD-MM-YYYY)
 *  - Bosman:   2026-01-02 (ISO)
 *  - Jansen:   02/01/2026 (DD/MM/YYYY — day first!)
 *  - De Wit:   5 januari 2026 (Dutch month name)
 * Everything is normalised to ISO "YYYY-MM-DD".
 */
const MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
  juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

export function parseDate(raw: string): string {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return check(`${m[1]}-${m[2]}-${m[3]}`, raw);
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
  if (m) return check(`${m[3]}-${pad(+m[2])}-${pad(+m[1])}`, raw);
  m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(s);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon) return check(`${m[3]}-${pad(mon)}-${pad(+m[1])}`, raw);
  }
  throw new Error(`Cannot parse date: "${raw}"`);
}

function check(iso: string, raw: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) {
    throw new Error(`Invalid calendar date "${raw}" -> ${iso}`);
  }
  return iso;
}

/** Art. 4.2 cut-over: work executed on/after this date uses indexed prices. */
export const INDEXATION_DATE = "2026-01-01";
export const isIndexed = (executionIso: string) => executionIso >= INDEXATION_DATE;

/** Add N working days (Mon–Fri; no holiday calendar) — used for the 10-day dispute deadline (4.10). */
export function addWorkdays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

export function dutchDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const names = Object.keys(MONTHS);
  return `${d} ${names[m - 1]} ${y}`;
}
