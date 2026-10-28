import type { Invoice, PriceItem } from "../types.js";
import { parseHoekstra } from "./hoekstra.js";
import { parseBosman } from "./bosman.js";
import { parseJansen } from "./jansen.js";
import { parseDeWit } from "./dewit.js";

/** Detect the supplier layout from the content (not the file name) and normalise to one schema. */
export function parseInvoice(file: string, text: string, prices: PriceItem[]): Invoice {
  if (/Installatiebedrijf Hoekstra/i.test(text)) return parseHoekstra(file, text, prices);
  if (/DAKWERKEN BOSMAN/i.test(text)) return parseBosman(file, text, prices);
  if (/Elektro Jansen/i.test(text)) return parseJansen(file, text, prices);
  if (/Schilderwerken De Wit/i.test(text)) return parseDeWit(file, text, prices);
  throw new Error(`${file}: unknown supplier layout`);
}
