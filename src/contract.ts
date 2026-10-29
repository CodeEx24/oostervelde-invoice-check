import { loadContractText } from "./data.js";

export interface Article {
  id: string;        // "4.5"
  titleNl: string;   // "Meerwerk"
  titleEn: string;
  textNl: string;    // verbatim from the contract excerpt
  textEn: string;    // our translation (see NOTES.md > Decisions and translations)
}

/** English translations are ours; the Dutch text is read verbatim from contract-excerpt.md. */
const EN: Record<string, { title: string; text: string }> = {
  "4.1": { title: "Prices", text: "All prices are excl. VAT and are in the price list (Annex A). The unit in the price list governs. If the contractor invoices in another unit, the price per unit is converted to the price-list unit and may not come out higher." },
  "4.2": { title: "Indexation", text: "Prices are indexed once, as of 1 January 2026, by 3.2 %, rounded to whole cents per unit. The date the work was EXECUTED decides, not the invoice date. Work executed up to and including 31 December 2025 is invoiced at 2025 prices." },
  "4.3": { title: "Call-out fees (voorrijkosten)", text: "Call-out fees are only reimbursed on work orders of type 'spoed' (emergency), and at most once per work order. On regular work the call-out fee is included in the prices." },
  "4.4": { title: "Labour hours", text: "Every work order states the maximum labour hours. Hours above that are only reimbursed if Woonkring Oostervelde approved extra hours in advance. That approval is in the work order, with a number MU-xxxx and the number of approved extra hours." },
  "4.5": { title: "Extra work (meerwerk)", text: "Work outside the work order is listed separately on the invoice as meerwerk. Meerwerk up to and including EUR 250.00 excl. VAT per work order may be carried out without prior approval. Above that, prior written approval is required, recorded in the work order with a number GA-xxxx and an approved amount. Without approval, meerwerk above EUR 250.00 is NOT reimbursed, not even the part up to EUR 250.00. With approval, at most the approved amount is reimbursed." },
  "4.6": { title: "VAT", text: "Painting work on homes older than two years has the reduced rate of 9 %, on labour only (price-list codes W01 and W04). Materials and all other work: 21 %. The build year is in the work order." },
  "4.7": { title: "Deliveries outside the price list", text: "Deliveries or work not in the price list and not listed as meerwerk are only reimbursed after prior approval by Woonkring Oostervelde." },
  "4.8": { title: "One invoice per work order", text: "Every work order is invoiced once. Corrections go via a credit note that refers to the original invoice. Woonkring Oostervelde nets the credit note against that invoice." },
  "4.9": { title: "Unknown work orders", text: "An invoice without a valid work order from Woonkring Oostervelde is not paid until the assignment is confirmed." },
  "4.10": { title: "Payment", text: "Approved invoices are paid within 30 days of receipt. Disputed invoices or invoice lines are reported to the contractor in writing, with reasons, within 10 working days. The undisputed part IS paid." },
};

let cache: Record<string, Article> | null = null;

export function loadArticles(dir?: string): Record<string, Article> {
  if (cache && !dir) return cache;
  // Only the Dutch part is the contract; an English translation may follow after a "---" line.
  const text = loadContractText(dir).split(/\n-{3,}\s*\n/)[0];
  const out: Record<string, Article> = {};
  const re = /\*\*(4\.\d+)\s+([^*]+?)\.\*\*\s+([\s\S]*?)(?=\n\n\*\*4\.|\n*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const id = m[1];
    out[id] = { id, titleNl: m[2].trim(), titleEn: EN[id]?.title ?? m[2].trim(), textNl: m[3].trim().replace(/`/g, ""), textEn: EN[id]?.text ?? "" };
  }
  if (!dir) cache = out;
  return out;
}

export function quoteNl(id: string): string {
  const a = loadArticles()[id];
  return a ? `Art. ${a.id} ${a.titleNl}: "${a.textNl}"` : `Art. ${id}`;
}

export const GLOSSARY: [string, string][] = [
  ["factuur", "invoice"], ["creditfactuur", "credit note"], ["werkorder / werkbon / opdracht", "work order"],
  ["spoed", "emergency (urgent)"], ["regulier", "regular (non-emergency)"], ["voorrijkosten", "call-out fee"],
  ["arbeid / uur", "labour / hour"], ["meerwerk", "extra work outside the work order"],
  ["akkoord", "approval / agreement"], ["exclusief btw", "excl. VAT"], ["btw", "VAT"],
  ["uitvoeringsdatum / datum uitvoering / uitgevoerd op", "execution date (when the work was done)"],
  ["factuurdatum", "invoice date"], ["opdrachtgever / opdrachtnemer", "client / contractor"],
  ["stuk / rol / dag / keer / post", "piece / roll / day / time (occurrence) / lump sum"],
  ["bouwjaar", "year built"], ["onderhoud", "maintenance"], ["betwist", "disputed"],
  ["werkdagen", "working days"], ["netto / subtotaal / totaal", "net / subtotal / total"],
  ["koperen leiding", "copper pipe"], ["dakgoot", "roof gutter"], ["steiger", "scaffolding"],
  ["vogelwering", "bird guard (not on the price list)"], ["groepenkast", "fuse/consumer box"],
  ["rookmelder", "smoke detector"], ["plafond sausen", "ceiling spray-painting (per m2)"],
];
