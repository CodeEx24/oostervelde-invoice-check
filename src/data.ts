import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv.js";
import { parseEuro } from "./money.js";
import type { PriceItem, WorkOrder, Supplier } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
/** Dataset folder. Override with DATA_DIR (e.g. the unzipped MSTR dataset). */
export const DATA_DIR = process.env.DATA_DIR ?? join(here, "..", "data");
export const OUTPUT_DIR = process.env.OUTPUT_DIR ?? join(here, "..", "output");

export function loadPriceList(dir = DATA_DIR): PriceItem[] {
  const rows = parseCsv(readFileSync(join(dir, "price-agreement-2025.csv"), "utf8"));
  return rows.map((r) => ({
    code: r.code,
    supplier: r.supplier as Supplier,
    description: r.description,
    unit: r.unit,
    price2025Cents: parseEuro(r.price_excl_vat_2025.replace(".", ",")),
  }));
}

export function loadWorkOrders(dir = DATA_DIR): WorkOrder[] {
  const rows = parseCsv(readFileSync(join(dir, "work-orders-export.csv"), "utf8"));
  return rows.map((r) => ({
    wo: r.wo,
    address: r.address,
    supplier: r.supplier as Supplier,
    job: r.job,
    type: r.type as "regulier" | "spoed",
    maxLaborHours: Number(r.max_labor_hours),
    extraHoursApproval: r.extra_hours_approval || null,
    approvedExtraHours: r.approved_extra_hours ? Number(r.approved_extra_hours) : 0,
    meerwerkApproval: r.meerwerk_approval || null,
    approvedMeerwerkCents: r.approved_meerwerk_eur ? parseEuro(r.approved_meerwerk_eur.replace(".", ",")) : 0,
    built: Number(r.built),
  }));
}

export function listInvoiceFiles(dir = DATA_DIR): string[] {
  return readdirSync(join(dir, "invoices")).filter((f) => f.endsWith(".txt")).sort();
}

/** Read a text file with Windows (CRLF) line endings normalised to LF, so a Windows checkout parses the same. */
const readText = (path: string): string => readFileSync(path, "utf8").replace(/\r\n?/g, "\n");

export function readInvoiceText(file: string, dir = DATA_DIR): string {
  return readText(join(dir, "invoices", file));
}

export interface SanneVerdict { file: string; invoiceNo: string; supplier: string; verdict: string; note: string }
export function loadSanneVerdicts(dir = DATA_DIR): SanneVerdict[] {
  const p = join(dir, "reference", "sanne-verdicts.csv");
  if (!existsSync(p)) return [];
  return parseCsv(readFileSync(p, "utf8")).map((r) => ({
    file: r.invoice_file, invoiceNo: r.invoice_no, supplier: r.supplier, verdict: r.verdict, note: r.sanne_note,
  }));
}

export function loadContractText(dir = DATA_DIR): string {
  return readText(join(dir, "contract-excerpt.md"));
}
