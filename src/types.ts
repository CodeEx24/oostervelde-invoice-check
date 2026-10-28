export type Supplier = "Hoekstra" | "De Wit" | "Bosman" | "Jansen";

export interface PriceItem {
  code: string;
  supplier: Supplier;
  description: string;
  unit: string;
  price2025Cents: number;
}

export interface WorkOrder {
  wo: string;
  address: string;
  supplier: Supplier;
  job: string;
  type: "regulier" | "spoed";
  maxLaborHours: number;
  extraHoursApproval: string | null;   // MU-xxxx
  approvedExtraHours: number;
  meerwerkApproval: string | null;     // GA-xxxx
  approvedMeerwerkCents: number;
  built: number;
}

export interface InvoiceLine {
  n: number;
  raw: string;               // the line exactly as printed (evidence)
  description: string;       // without "Meerwerk:" prefix
  isMeerwerk: boolean;
  qtyMilli: number;          // 1000 = 1.000
  unit: string;
  unitPriceCents: number;
  amountCents: number;
  vatRatePct: number | null; // only De Wit prints a rate per line
  code: string | null;       // price-list code if the description matches
}

export interface VatLine { ratePct: number; baseCents: number; vatCents: number; raw: string }

export interface Invoice {
  file: string;
  supplier: Supplier;
  invoiceNo: string;
  invoiceDate: string;       // ISO
  executionDate: string | null; // ISO
  workOrder: string | null;
  isCredit: boolean;
  creditOf: string | null;   // invoice number being credited
  lines: InvoiceLine[];
  statedSubtotalCents: number;
  vatLines: VatLine[];
  statedTotalCents: number;
}

export type Verdict = "approve" | "dispute" | "hold";

/** certain = deterministic contract rule; judgment = needs Sanne's eyes (interpretation or missing data). */
export type Confidence = "certain" | "judgment";

export interface Finding {
  id: string;                // e.g. "2026-0044/4.4/1"
  invoiceNo: string;
  article: string;           // "4.4"
  kind:
    | "price" | "voorrijkosten" | "hours" | "meerwerk" | "off-list" | "vat-overcharged"
    | "vat-understated" | "unknown-wo" | "supplier-mismatch" | "duplicate" | "arithmetic"
    | "credit-note" | "info";
  severity: "dispute" | "hold" | "info";
  confidence: Confidence;
  lineNos: number[];
  /** Amount to dispute, excl. VAT (cents). */
  disputeExclCents: number;
  /** VAT on that amount, at the rate the contractor charged (cents). */
  disputeVatCents: number;
  /** Overstated payable total with no VAT component (e.g. total ≠ subtotal + VAT). */
  disputeOtherCents: number;
  titleEn: string;
  reasonEn: string;
  reasonNl: string;          // ready to paste into the e-mail to the contractor
  evidence: string[];        // lines / numbers Sanne can verify
  contractQuoteNl: string;
}

export interface InvoiceReview {
  invoice: Invoice;
  verdict: Verdict;
  verdictReasonEn: string;
  findings: Finding[];
  billedExclCents: number;
  billedInclCents: number;
  disputeExclCents: number;
  disputeVatCents: number;
  disputeOtherCents: number;
  payableExclCents: number;  // undisputed part excl. VAT (Art. 4.10: undisputed part is paid)
  creditAppliedInclCents: number; // credit notes netted against this invoice (negative)
  needsSanne: boolean;       // true if any finding is a judgment call
}
