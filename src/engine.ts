import { addWorkdays, dutchDate, isIndexed } from "./dates.js";
import { quoteNl } from "./contract.js";
import { listInvoiceFiles, loadPriceList, loadWorkOrders, readInvoiceText } from "./data.js";
import { eur, indexed, lineAmount, qtyToString, roundDiv, vat } from "./money.js";
import { parseInvoice } from "./parsers/index.js";
import type { Finding, Invoice, InvoiceLine, InvoiceReview, PriceItem, Verdict, WorkOrder } from "./types.js";

export const MEERWERK_FREE_LIMIT_CENTS = 25000; // Art. 4.5

export interface Context {
  prices: PriceItem[];
  workOrders: Map<string, WorkOrder>;
  invoices: Invoice[];            // sorted by invoice date, then number
  duplicateOf: Map<string, string>; // invoiceNo -> invoiceNo of the original (identical content)
  repeatWo: Map<string, string>;    // invoiceNo -> earlier invoiceNo for the same WO (different content)
}

const sig = (i: Invoice) =>
  i.lines.map((l) => `${l.description}|${l.qtyMilli}|${l.unit}|${l.unitPriceCents}|${l.amountCents}`).sort().join(";");

export function buildContext(dir?: string): Context {
  const prices = loadPriceList(dir);
  const workOrders = new Map(loadWorkOrders(dir).map((w) => [w.wo, w]));
  const invoices = listInvoiceFiles(dir)
    .map((f) => parseInvoice(f, readInvoiceText(f, dir), prices))
    .sort((a, b) => (a.invoiceDate + a.invoiceNo).localeCompare(b.invoiceDate + b.invoiceNo));
  const duplicateOf = new Map<string, string>();
  const repeatWo = new Map<string, string>();
  const firstByWo = new Map<string, Invoice>();
  for (const inv of invoices) {
    if (inv.isCredit || !inv.workOrder) continue;
    const first = firstByWo.get(inv.workOrder);
    if (!first) { firstByWo.set(inv.workOrder, inv); continue; }
    if (sig(first) === sig(inv)) duplicateOf.set(inv.invoiceNo, first.invoiceNo);
    else repeatWo.set(inv.invoiceNo, first.invoiceNo);
  }
  return { prices, workOrders, invoices, duplicateOf, repeatWo };
}

export const findInvoice = (ctx: Context, key: string) =>
  ctx.invoices.find((i) => i.invoiceNo === key || i.file === key || i.file === `${key}.txt` || i.file.replace(/\.txt$/, "") === key);

const priceFor = (ctx: Context, line: InvoiceLine) => ctx.prices.find((p) => p.code === line.code) ?? null;
const isLabor = (p: PriceItem | null) => !!p && /^Arbeid/i.test(p.description);
const isCallout = (p: PriceItem | null) => !!p && /^Voorrijkosten/i.test(p.description);

/** Contract price per PRICE-LIST unit (cents) for work executed on `exec` (Art. 4.2). */
export function contractUnitPrice(item: PriceItem, exec: string): { cents: number; indexed: boolean } {
  const idx = isIndexed(exec);
  return { cents: idx ? indexed(item.price2025Cents) : item.price2025Cents, indexed: idx };
}

/** Billed-VAT rate for a line: De Wit prints it per line; others have one invoice-level rate. */
function billedRate(inv: Invoice, line: InvoiceLine): number | null {
  if (line.vatRatePct != null) return line.vatRatePct;
  const rates = [...new Set(inv.vatLines.map((v) => v.ratePct))];
  return rates.length === 1 ? rates[0] : null;
}

/** Art. 4.6: 9 % only on labour codes W01/W04 and only on homes older than two years. */
export function correctVatRate(code: string | null, wo: WorkOrder, exec: string): { rate: number; why: string } {
  const execYear = +exec.slice(0, 4);
  const age = execYear - wo.built;
  const older = age > 2;
  if (code === "W01" || code === "W04") {
    return older
      ? { rate: 9, why: `${code} is painting labour/ceiling work on a home built in ${wo.built} (older than two years)` }
      : { rate: 21, why: `${code} is painting labour but the home was built in ${wo.built} (not older than two years)` };
  }
  return { rate: 21, why: "material and all other work are always 21 %" };
}

let seq = 0;
function F(inv: Invoice, f: Omit<Finding, "id" | "invoiceNo" | "disputeVatCents" | "disputeOtherCents"> & { disputeVatCents?: number; disputeOtherCents?: number }): Finding {
  seq++;
  return { id: `${inv.invoiceNo}/${f.article}/${seq}`, invoiceNo: inv.invoiceNo, disputeVatCents: 0, disputeOtherCents: 0, ...f };
}

const woLine = (wo: WorkOrder) =>
  `Werkorder ${wo.wo}: type ${wo.type}, max ${wo.maxLaborHours} uur` +
  (wo.extraHoursApproval ? `, extra uren ${wo.extraHoursApproval} (+${wo.approvedExtraHours} uur)` : ", geen MU-akkoord") +
  (wo.meerwerkApproval ? `, meerwerk ${wo.meerwerkApproval} (${eur(wo.approvedMeerwerkCents)})` : ", geen GA-akkoord") +
  `, bouwjaar ${wo.built}`;

export function reviewInvoice(inv: Invoice, ctx: Context): InvoiceReview {
  seq = 0;
  const findings: Finding[] = [];
  const lineDisputed = new Map<number, number>();
  const addDisputed = (n: number, c: number) => lineDisputed.set(n, (lineDisputed.get(n) ?? 0) + c);
  const vatOnLine = (l: InvoiceLine, excl: number) => { const r = billedRate(inv, l); return r == null ? 0 : vat(excl, r); };

  const wo = inv.workOrder ? ctx.workOrders.get(inv.workOrder) ?? null : null;
  const exec = inv.executionDate;

  // ---------- Credit note (Art. 4.8) ----------
  if (inv.isCredit) {
    const orig = ctx.invoices.find((i) => i.invoiceNo === inv.creditOf);
    const total = inv.statedTotalCents;
    if (!orig) {
      findings.push(F(inv, { article: "4.8", kind: "credit-note", severity: "hold", confidence: "judgment", lineNos: [], disputeExclCents: 0,
        titleEn: "Credit note refers to an unknown invoice", reasonEn: `Credit note refers to invoice ${inv.creditOf}, which is not in the batch.`,
        reasonNl: `De creditfactuur verwijst naar factuur ${inv.creditOf}, die niet in de aanlevering zit.`, evidence: [inv.lines[0]?.raw ?? ""], contractQuoteNl: quoteNl("4.8") }));
    } else {
      const sameWo = orig.workOrder === inv.workOrder && orig.supplier === inv.supplier;
      findings.push(F(inv, { article: "4.8", kind: "credit-note", severity: sameWo ? "info" : "hold", confidence: sameWo ? "certain" : "judgment", lineNos: inv.lines.map((l) => l.n), disputeExclCents: 0,
        titleEn: `Credit note against ${orig.invoiceNo}`,
        reasonEn: `Credit note ${inv.invoiceNo} credits ${eur(-total)} incl. VAT against invoice ${orig.invoiceNo}${sameWo ? " (same work order and supplier)" : " — WORK ORDER OR SUPPLIER DIFFERS"}. Netted per Art. 4.8.`,
        reasonNl: `Creditfactuur ${inv.invoiceNo} verrekend met factuur ${orig.invoiceNo} (art. 4.8).`,
        evidence: inv.lines.map((l) => l.raw), contractQuoteNl: quoteNl("4.8") }));
    }
    return finish(inv, findings, ctx, "Credit note: netted against the original invoice (Art. 4.8).");
  }

  // ---------- Art. 4.9: unknown work order / supplier mismatch ----------
  if (!inv.workOrder || !wo) {
    findings.push(F(inv, { article: "4.9", kind: "unknown-wo", severity: "hold", confidence: "certain", lineNos: [], disputeExclCents: 0,
      titleEn: `Work order ${inv.workOrder ?? "(none)"} not found`,
      reasonEn: `Work order ${inv.workOrder ?? "(none)"} does not exist in the January work-order export. Nothing else can be checked (type, max hours, approvals, build year). Hold until the housing officer confirms the job.`,
      reasonNl: `Werkorder ${inv.workOrder ?? "(ontbreekt)"} komt niet voor in de werkorderexport van Woonkring Oostervelde. Op grond van art. 4.9 betalen wij de factuur niet totdat de opdracht is bevestigd. Wilt u de opdracht (werkorder) aanleveren?`,
      evidence: [`Factuur ${inv.invoiceNo}: ${inv.workOrder ?? "geen werkorder"}`, "Werkorderexport: geen regel met dit nummer"], contractQuoteNl: quoteNl("4.9") }));
    return finish(inv, findings, ctx, "On hold: unknown work order (Art. 4.9).");
  }
  if (wo.supplier !== inv.supplier) {
    findings.push(F(inv, { article: "4.9", kind: "supplier-mismatch", severity: "hold", confidence: "certain", lineNos: [], disputeExclCents: 0,
      titleEn: "Work order belongs to another contractor",
      reasonEn: `${wo.wo} is assigned to ${wo.supplier}, but the invoice is from ${inv.supplier}.`,
      reasonNl: `Werkorder ${wo.wo} is opgedragen aan ${wo.supplier}, niet aan ${inv.supplier} (art. 4.9).`,
      evidence: [woLine(wo)], contractQuoteNl: quoteNl("4.9") }));
    return finish(inv, findings, ctx, "On hold: work order belongs to another contractor.");
  }
  if (!exec) {
    findings.push(F(inv, { article: "4.2", kind: "info", severity: "hold", confidence: "judgment", lineNos: [], disputeExclCents: 0,
      titleEn: "No execution date", reasonEn: "Cannot decide which price year applies (Art. 4.2 uses the execution date).", reasonNl: "Uitvoeringsdatum ontbreekt; art. 4.2 maakt de uitvoeringsdatum bepalend.", evidence: [], contractQuoteNl: quoteNl("4.2") }));
    return finish(inv, findings, ctx, "On hold: execution date missing.");
  }

  // ---------- Art. 4.8: duplicate / repeat billing of a work order ----------
  const dupOf = ctx.duplicateOf.get(inv.invoiceNo);
  if (dupOf) {
    const orig = ctx.invoices.find((i) => i.invoiceNo === dupOf)!;
    findings.push(F(inv, { article: "4.8", kind: "duplicate", severity: "dispute", confidence: "certain", lineNos: inv.lines.map((l) => l.n),
      disputeExclCents: inv.statedSubtotalCents, disputeVatCents: inv.vatLines.reduce((a, v) => a + v.vatCents, 0),
      titleEn: `Duplicate of invoice ${dupOf}`,
      reasonEn: `Work order ${wo.wo} was already invoiced on ${dupOf} (${orig.invoiceDate}) with identical lines and amounts. Whole invoice disputed (Art. 4.8).`,
      reasonNl: `Werkorder ${wo.wo} is al gefactureerd op factuur ${dupOf} van ${dutchDate(orig.invoiceDate)}; de regels en bedragen zijn identiek. Volgens art. 4.8 wordt elke werkorder één keer gefactureerd. Wij betalen deze factuur niet.`,
      evidence: [`${dupOf}: ${orig.lines.map((l) => `${l.description} ${qtyToString(l.qtyMilli)} ${l.unit} = ${eur(l.amountCents)}`).join("; ")}`,
        `${inv.invoiceNo}: ${inv.lines.map((l) => `${l.description} ${qtyToString(l.qtyMilli)} ${l.unit} = ${eur(l.amountCents)}`).join("; ")}`, `Beide: werkorder ${wo.wo}, uitgevoerd ${dutchDate(exec)}`],
      contractQuoteNl: quoteNl("4.8") }));
    return finish(inv, findings, ctx, "Duplicate invoice (Art. 4.8): whole invoice disputed.");
  }
  const repeat = ctx.repeatWo.get(inv.invoiceNo);
  if (repeat) {
    findings.push(F(inv, { article: "4.8", kind: "duplicate", severity: "hold", confidence: "judgment", lineNos: [], disputeExclCents: 0,
      titleEn: `Second invoice for ${wo.wo} (earlier: ${repeat})`,
      reasonEn: `Work order ${wo.wo} was already invoiced on ${repeat}, but the lines differ. Could be a partial invoice or a double billing — Sanne decides.`,
      reasonNl: `Werkorder ${wo.wo} is eerder gefactureerd op factuur ${repeat}. Art. 4.8: één factuur per werkorder.`, evidence: [], contractQuoteNl: quoteNl("4.8") }));
  }

  // ---------- Line checks ----------
  const hoursBefore = ctx.invoices
    .filter((i) => !i.isCredit && i.workOrder === wo.wo && i.invoiceNo !== inv.invoiceNo && !ctx.duplicateOf.has(i.invoiceNo) &&
      (i.invoiceDate + i.invoiceNo) < (inv.invoiceDate + inv.invoiceNo))
    .reduce((a, i) => a + i.lines.filter((l) => isLabor(priceFor(ctx, l))).reduce((x, l) => x + l.qtyMilli, 0), 0);
  const calloutLines = inv.lines.filter((l) => isCallout(priceFor(ctx, l)) && l.qtyMilli > 0);
  let calloutSeen = 0;

  for (const l of inv.lines) {
    if (l.isMeerwerk) continue;
    const item = priceFor(ctx, l);

    // Art. 4.7 off-list
    if (!item) {
      findings.push(F(inv, { article: "4.7", kind: "off-list", severity: "dispute", confidence: "judgment", lineNos: [l.n],
        disputeExclCents: l.amountCents, disputeVatCents: vatOnLine(l, l.amountCents),
        titleEn: `"${l.description}" is not on the price list`,
        reasonEn: `Line ${l.n} "${l.description}" is not in the price list and was not listed as meerwerk. Only reimbursable after prior approval; none is recorded in the work-order export. Sanne should confirm no approval exists outside the export.`,
        reasonNl: `Regel ${l.n} (${l.description}) staat niet in de prijslijst en is niet als meerwerk vermeld. Op grond van art. 4.7 wordt dit alleen vergoed na voorafgaand akkoord van Woonkring Oostervelde; een akkoord is niet vastgelegd. Wij betalen deze regel niet (${eur(l.amountCents)} excl. btw).`,
        evidence: [l.raw, woLine(wo)], contractQuoteNl: quoteNl("4.7") }));
      addDisputed(l.n, l.amountCents);
      continue;
    }

    const exp = contractUnitPrice(item, exec);

    // Art. 4.3 call-out fee
    if (isCallout(item) && l.qtyMilli > 0) {
      const lineQty = l.qtyMilli;
      if (wo.type !== "spoed") {
        findings.push(F(inv, { article: "4.3", kind: "voorrijkosten", severity: "dispute", confidence: "certain", lineNos: [l.n],
          disputeExclCents: l.amountCents, disputeVatCents: vatOnLine(l, l.amountCents),
          titleEn: "Call-out fee on regular work",
          reasonEn: `${wo.wo} is type "${wo.type}". Call-out fees are only reimbursable on emergency (spoed) work orders. Billed ${eur(l.amountCents)}.`,
          reasonNl: `Regel ${l.n}: voorrijkosten ${eur(l.amountCents)} excl. btw op werkorder ${wo.wo}, type ${wo.type}. Op grond van art. 4.3 worden voorrijkosten alleen vergoed bij werkorders van het type spoed; bij regulier werk zijn ze in de prijzen inbegrepen.`,
          evidence: [l.raw, woLine(wo)], contractQuoteNl: quoteNl("4.3") }));
        addDisputed(l.n, l.amountCents);
        continue;
      }
      // spoed: once per work order
      const allowedMilli = Math.max(0, Math.min(lineQty, 1000 - calloutSeen));
      calloutSeen += lineQty;
      const excessMilli = lineQty - allowedMilli;
      if (excessMilli > 0) {
        const excessCents = allowedMilli === 0 ? l.amountCents : lineAmount(excessMilli, l.unitPriceCents);
        findings.push(F(inv, { article: "4.3", kind: "voorrijkosten", severity: "dispute", confidence: "certain", lineNos: [l.n],
          disputeExclCents: excessCents, disputeVatCents: vatOnLine(l, excessCents),
          titleEn: "Call-out fee charged more than once on one work order",
          reasonEn: `${wo.wo} is a spoed order, but the call-out fee may be charged at most once per work order. The invoice has ${calloutLines.length} call-out lines/${qtyToString(calloutLines.reduce((a, x) => a + x.qtyMilli, 0))} units. Extra charge disputed: ${eur(excessCents)}.`,
          reasonNl: `Regel ${l.n}: voorrijkosten (${eur(excessCents)} excl. btw) zijn meer dan één keer in rekening gebracht op werkorder ${wo.wo}. Op grond van art. 4.3 worden voorrijkosten ten hoogste één keer per werkorder vergoed.`,
          evidence: calloutLines.map((x) => `regel ${x.n}: ${x.raw}`), contractQuoteNl: quoteNl("4.3") }));
        addDisputed(l.n, excessCents);
        if (allowedMilli === 0) continue;
      }
    }

    // Art. 4.1 / 4.2 price (with unit conversion)
    let allowedAmount: number; let expectedPerInvUnit: string;
    if (l.unit === item.unit) {
      allowedAmount = lineAmount(l.qtyMilli, exp.cents);
      expectedPerInvUnit = `${eur(exp.cents)}/${item.unit}`;
    } else if (item.unit === "rol 25 m" && l.unit === "m") {
      allowedAmount = roundDiv(l.qtyMilli * exp.cents, 25 * 1000);
      expectedPerInvUnit = `${eur(exp.cents)} per rol van 25 m = ${(exp.cents / 25 / 100).toFixed(3).replace(".", ",")} per m`;
    } else {
      findings.push(F(inv, { article: "4.1", kind: "price", severity: "hold", confidence: "judgment", lineNos: [l.n], disputeExclCents: 0,
        titleEn: `Cannot convert unit "${l.unit}" to "${item.unit}"`, reasonEn: `Line ${l.n}: invoice unit "${l.unit}" vs price-list unit "${item.unit}" — no conversion known.`,
        reasonNl: `Regel ${l.n}: eenheid ${l.unit} wijkt af van de prijslijst (${item.unit}); art. 4.1.`, evidence: [l.raw], contractQuoteNl: quoteNl("4.1") }));
      continue;
    }
    const unitHigher = l.unit === item.unit ? l.unitPriceCents > exp.cents : l.unitPriceCents * 25 > exp.cents;
    const lineCalc = lineAmount(l.qtyMilli, l.unitPriceCents);
    const base = item.price2025Cents;
    const yearTxt = exp.indexed
      ? `werk uitgevoerd op ${dutchDate(exec)}: prijslijst 2025 ${eur(base)}/${item.unit} + 3,2% indexering = ${eur(exp.cents)}/${item.unit}`
      : `werk uitgevoerd op ${dutchDate(exec)} (vóór 1 januari 2026): prijs 2025 ${eur(base)}/${item.unit} blijft gelden, de indexering geldt niet`;
    const disputedSoFar = lineDisputed.get(l.n) ?? 0;
    if (unitHigher && l.amountCents - disputedSoFar > allowedAmount) {
      const diff = l.amountCents - disputedSoFar - allowedAmount;
      findings.push(F(inv, { article: exp.indexed ? "4.2" : "4.1", kind: "price", severity: "dispute", confidence: "certain", lineNos: [l.n],
        disputeExclCents: diff, disputeVatCents: vatOnLine(l, diff),
        titleEn: `${item.description}: price above contract (${exp.indexed ? "indexed" : "2025"} price applies)`,
        reasonEn: `Line ${l.n} "${l.description}": billed ${eur(l.unitPriceCents)}/${l.unit}, contract price ${expectedPerInvUnit} (${exp.indexed ? "executed on/after 1 Jan 2026 → indexed" : "executed in 2025 → 2025 price"}). Overcharge ${eur(diff)} excl. VAT on ${qtyToString(l.qtyMilli)} ${l.unit}.`,
        reasonNl: `Regel ${l.n} (${l.description}): gefactureerd ${eur(l.unitPriceCents)} per ${l.unit}; volgens de prijslijst is dat voor ${yearTxt}${l.unit !== item.unit ? ` (omgerekend: ${expectedPerInvUnit.split("=")[1]?.trim() ?? expectedPerInvUnit})` : ""}. Art. ${exp.indexed ? "4.1 en 4.2" : "4.1 en 4.2"}. Te veel gefactureerd: ${eur(diff)} excl. btw (${qtyToString(l.qtyMilli)} ${l.unit}).`,
        evidence: [l.raw, `Prijslijst ${item.code}: ${item.description}, ${eur(base)}/${item.unit} (2025)`, `Uitvoeringsdatum ${dutchDate(exec)} → ${exp.indexed ? "geïndexeerd" : "2025-prijs"}: ${expectedPerInvUnit}`, `Toegestaan: ${eur(allowedAmount)}; gefactureerd: ${eur(l.amountCents)}`],
        contractQuoteNl: quoteNl(exp.indexed ? "4.2" : "4.1") }));
      addDisputed(l.n, diff);
    } else if (!unitHigher && l.amountCents > lineCalc) {
      const diff = l.amountCents - lineCalc;
      findings.push(F(inv, { article: "4.1", kind: "arithmetic", severity: "dispute", confidence: "certain", lineNos: [l.n],
        disputeExclCents: diff, disputeVatCents: vatOnLine(l, diff),
        titleEn: "Line amount does not equal quantity × price",
        reasonEn: `Line ${l.n}: ${qtyToString(l.qtyMilli)} × ${eur(l.unitPriceCents)} = ${eur(lineCalc)}, but ${eur(l.amountCents)} was billed. Overcharge ${eur(diff)}.`,
        reasonNl: `Regel ${l.n} (${l.description}): ${qtyToString(l.qtyMilli)} ${l.unit} × ${eur(l.unitPriceCents)} = ${eur(lineCalc)}, maar gefactureerd is ${eur(l.amountCents)}. Verschil: ${eur(diff)} excl. btw (rekenfout).`,
        evidence: [l.raw, `${qtyToString(l.qtyMilli)} × ${eur(l.unitPriceCents)} = ${eur(lineCalc)}`], contractQuoteNl: quoteNl("4.1") }));
      addDisputed(l.n, diff);
    }

    // Art. 4.4 hours (labour lines)
    if (isLabor(item)) {
      const allowedMilli = (wo.maxLaborHours + wo.approvedExtraHours) * 1000;
      const used = hoursBefore + l.qtyMilli;
      const excessMilli = Math.max(0, Math.min(l.qtyMilli, used - allowedMilli));
      if (excessMilli > 0) {
        const amt = lineAmount(excessMilli, exp.cents);
        findings.push(F(inv, { article: "4.4", kind: "hours", severity: "dispute", confidence: "certain", lineNos: [l.n],
          disputeExclCents: amt, disputeVatCents: vatOnLine(l, amt),
          titleEn: `Hours above maximum (${qtyToString(l.qtyMilli)} billed, ${wo.maxLaborHours + wo.approvedExtraHours} allowed)`,
          reasonEn: `${wo.wo}: max ${wo.maxLaborHours} h${wo.extraHoursApproval ? ` + ${wo.approvedExtraHours} h approved (${wo.extraHoursApproval})` : ", no MU approval in work order"}. Billed ${qtyToString(l.qtyMilli)} h → ${qtyToString(excessMilli)} h too many × ${eur(exp.cents)}/h = ${eur(amt)}.`,
          reasonNl: `Werkorder ${wo.wo} vermeldt maximaal ${wo.maxLaborHours} arbeidsuren${wo.extraHoursApproval ? ` plus ${wo.approvedExtraHours} goedgekeurde extra uren (${wo.extraHoursApproval})` : "; er is geen extra uren-akkoord (MU) vastgelegd"}. Gefactureerd: ${qtyToString(l.qtyMilli)} uur. Art. 4.4: uren boven het maximum worden alleen vergoed bij voorafgaand akkoord. Te veel: ${qtyToString(excessMilli)} uur × ${eur(exp.cents)} = ${eur(amt)} excl. btw.`,
          evidence: [l.raw, woLine(wo)], contractQuoteNl: quoteNl("4.4") }));
        addDisputed(l.n, amt);
      }
    }
  }

  // ---------- Art. 4.5 meerwerk ----------
  const mw = inv.lines.filter((l) => l.isMeerwerk);
  if (mw.length) {
    const priorMw = ctx.invoices.filter((i) => !i.isCredit && i.workOrder === wo.wo && i.invoiceNo !== inv.invoiceNo && !ctx.duplicateOf.has(i.invoiceNo) && (i.invoiceDate + i.invoiceNo) < (inv.invoiceDate + inv.invoiceNo))
      .reduce((a, i) => a + i.lines.filter((x) => x.isMeerwerk).reduce((s, x) => s + x.amountCents, 0), 0);
    const thisMw = mw.reduce((a, l) => a + l.amountCents, 0);
    const total = priorMw + thisMw;
    let allowedTotal: number; let why: string;
    if (total <= MEERWERK_FREE_LIMIT_CENTS) { allowedTotal = total; why = `total ${eur(total)} ≤ ${eur(MEERWERK_FREE_LIMIT_CENTS)}: no approval needed`; }
    else if (wo.meerwerkApproval) { allowedTotal = Math.min(total, wo.approvedMeerwerkCents); why = `above ${eur(MEERWERK_FREE_LIMIT_CENTS)}; approval ${wo.meerwerkApproval} covers ${eur(wo.approvedMeerwerkCents)}`; }
    else { allowedTotal = 0; why = `above ${eur(MEERWERK_FREE_LIMIT_CENTS)} and no GA approval in the work order → nothing is reimbursed (not even the first ${eur(MEERWERK_FREE_LIMIT_CENTS)})`; }
    const allowedThis = Math.max(0, allowedTotal - Math.min(priorMw, allowedTotal));
    const excess = thisMw - allowedThis;
    if (excess > 0) {
      const first = mw[0];
      findings.push(F(inv, { article: "4.5", kind: "meerwerk", severity: "dispute", confidence: "certain", lineNos: mw.map((x) => x.n),
        disputeExclCents: excess, disputeVatCents: vatOnLine(first, excess),
        titleEn: wo.meerwerkApproval ? `Meerwerk above approved amount (${wo.meerwerkApproval})` : "Meerwerk above €250 without approval",
        reasonEn: `Meerwerk ${eur(thisMw)} on ${wo.wo}: ${why}. Disputed ${eur(excess)}.`,
        reasonNl: wo.meerwerkApproval
          ? `Meerwerk "${first.description}" (${eur(thisMw)} excl. btw) op werkorder ${wo.wo}. Er is akkoord ${wo.meerwerkApproval} voor ten hoogste ${eur(wo.approvedMeerwerkCents)}. Art. 4.5: met akkoord wordt ten hoogste het goedgekeurde bedrag vergoed. Te veel: ${eur(excess)} excl. btw.`
          : `Meerwerk "${first.description}" (${eur(thisMw)} excl. btw) op werkorder ${wo.wo} is hoger dan ${eur(MEERWERK_FREE_LIMIT_CENTS)} en er is geen voorafgaand schriftelijk akkoord (GA-nummer) in de werkorder vastgelegd. Art. 4.5: zonder akkoord wordt meerwerk boven ${eur(MEERWERK_FREE_LIMIT_CENTS)} niet vergoed, ook niet het deel tot ${eur(MEERWERK_FREE_LIMIT_CENTS)}. Betwist: ${eur(excess)} excl. btw.`,
        evidence: [...mw.map((x) => x.raw), woLine(wo)], contractQuoteNl: quoteNl("4.5") }));
      for (const l of mw) addDisputed(l.n, Math.min(l.amountCents, excess));
    }
  }

  // ---------- Art. 4.6 VAT ----------
  for (const l of inv.lines) {
    const br = billedRate(inv, l);
    if (br == null) continue;
    const item = priceFor(ctx, l);
    const code = l.isMeerwerk ? null : item?.code ?? null;
    const { rate, why } = correctVatRate(code, wo, exec);
    if (br === rate) continue;
    const base = l.amountCents - (lineDisputed.get(l.n) ?? 0);
    if (base <= 0) continue;
    if (br > rate) {
      const diff = vat(base, br) - vat(base, rate);
      findings.push(F(inv, { article: "4.6", kind: "vat-overcharged", severity: "dispute", confidence: "certain", lineNos: [l.n],
        disputeExclCents: 0, disputeVatCents: diff,
        titleEn: `VAT ${br}% charged, ${rate}% applies`,
        reasonEn: `Line ${l.n}: ${br}% VAT charged but ${rate}% applies (${why}). VAT overcharged on ${eur(base)}: ${eur(diff)}.`,
        reasonNl: `Regel ${l.n} (${l.description}): ${br}% btw berekend, maar op grond van art. 4.6 geldt ${rate}%${rate === 9 ? ` (arbeid schilderwerk, code ${code}, aan een woning met bouwjaar ${wo.built}, ouder dan twee jaar)` : ""}. Btw te veel berekend over ${eur(base)}: ${eur(diff)}.`,
        evidence: [l.raw, `Werkorder ${wo.wo}: bouwjaar ${wo.built}; uitvoering ${dutchDate(exec)}`, `Prijslijstcode: ${code ?? "meerwerk/overig"}`], contractQuoteNl: quoteNl("4.6") }));
    } else {
      const diff = vat(base, rate) - vat(base, br);
      findings.push(F(inv, { article: "4.6", kind: "vat-understated", severity: "hold", confidence: "judgment", lineNos: [l.n], disputeExclCents: 0,
        titleEn: `VAT ${br}% charged, ${rate}% applies (invoice is incorrect, contractor undercharged)`,
        reasonEn: `Line ${l.n}: ${br}% charged but ${rate}% applies (${why}). VAT is ${eur(diff)} too LOW on ${eur(base)}. No money to reclaim, but the invoice is wrong → ask for a corrected invoice before paying. Sanne decides.`,
        reasonNl: `Regel ${l.n} (${l.description}): ${br}% btw berekend, maar op grond van art. 4.6 geldt ${rate}% (${code === "W01" || code === "W04" ? `woning bouwjaar ${wo.built}, niet ouder dan twee jaar` : "verlaagd tarief geldt alleen voor arbeid schilderwerk W01/W04"}). Wilt u een gecorrigeerde factuur sturen?`,
        evidence: [l.raw, `Werkorder ${wo.wo}: bouwjaar ${wo.built}`], contractQuoteNl: quoteNl("4.6") }));
    }
  }

  // ---------- Exact invoice-level VAT to reclaim ----------
  // VAT billed minus the VAT that is due on the amounts we accept, computed per rate bucket (that is how invoices round).
  // Lines billed at a rate LOWER than due keep the billed rate (we never reclaim negative VAT).
  const buckets = new Map<number, number>();
  for (const l of inv.lines) {
    const base = l.amountCents - (lineDisputed.get(l.n) ?? 0);
    const billed = billedRate(inv, l);
    const due = correctVatRate(l.isMeerwerk ? null : l.code, wo, exec).rate;
    const eff = billed == null ? due : Math.min(billed, due);
    buckets.set(eff, (buckets.get(eff) ?? 0) + base);
  }
  const allowedVat = [...buckets].reduce((a, [r, b]) => a + vat(b, r), 0);
  const exactVat = Math.max(0, inv.vatLines.reduce((a, v) => a + v.vatCents, 0) - allowedVat);

  // ---------- Invoice-level arithmetic ----------
  const sumLines = inv.lines.reduce((a, l) => a + l.amountCents, 0);
  if (sumLines !== inv.statedSubtotalCents) {
    const diff = inv.statedSubtotalCents - sumLines;
    findings.push(F(inv, { article: "4.1", kind: "arithmetic", severity: diff > 0 ? "dispute" : "hold", confidence: "certain", lineNos: [], disputeExclCents: Math.max(diff, 0),
      titleEn: "Subtotal ≠ sum of lines", reasonEn: `Lines sum to ${eur(sumLines)} but the subtotal is ${eur(inv.statedSubtotalCents)}.`,
      reasonNl: `De regels tellen op tot ${eur(sumLines)}, maar het subtotaal is ${eur(inv.statedSubtotalCents)}.`, evidence: [`Som regels: ${eur(sumLines)}`, `Subtotaal: ${eur(inv.statedSubtotalCents)}`], contractQuoteNl: quoteNl("4.1") }));
  }
  for (const v of inv.vatLines) {
    const calc = vat(v.baseCents, v.ratePct);
    if (calc !== v.vatCents && v.vatCents > calc) {
      findings.push(F(inv, { article: "4.6", kind: "arithmetic", severity: "dispute", confidence: "certain", lineNos: [], disputeExclCents: 0, disputeVatCents: v.vatCents - calc,
        titleEn: "VAT amount miscalculated", reasonEn: `${v.ratePct}% of ${eur(v.baseCents)} = ${eur(calc)}, billed ${eur(v.vatCents)}.`,
        reasonNl: `${v.ratePct}% btw over ${eur(v.baseCents)} is ${eur(calc)}, niet ${eur(v.vatCents)}.`, evidence: [v.raw], contractQuoteNl: quoteNl("4.6") }));
    }
  }
  const vatSum = inv.vatLines.reduce((a, v) => a + v.vatCents, 0);
  const expectTotal = inv.statedSubtotalCents + vatSum;
  if (inv.statedTotalCents !== expectTotal) {
    const diff = inv.statedTotalCents - expectTotal;
    findings.push(F(inv, { article: "4.1", kind: "arithmetic", severity: diff > 0 ? "dispute" : "hold", confidence: "certain", lineNos: [], disputeExclCents: 0, disputeOtherCents: Math.max(diff, 0),
      titleEn: "Invoice total ≠ subtotal + VAT",
      reasonEn: `Subtotal ${eur(inv.statedSubtotalCents)} + VAT ${eur(vatSum)} = ${eur(expectTotal)}, but the total payable is ${eur(inv.statedTotalCents)}. Total overstated by ${eur(diff)} (pure arithmetic error in the total; no VAT component, so it is shown in its own column).`,
      reasonNl: `Subtotaal ${eur(inv.statedSubtotalCents)} + btw ${eur(vatSum)} = ${eur(expectTotal)}, maar het te betalen totaal is ${eur(inv.statedTotalCents)}. Verschil: ${eur(diff)} (rekenfout in het totaal).`,
      evidence: [`Subtotaal: ${eur(inv.statedSubtotalCents)}`, `Btw: ${eur(vatSum)}`, `Te betalen (factuur): ${eur(inv.statedTotalCents)}`], contractQuoteNl: quoteNl("4.1") }));
  }

  return finish(inv, findings, ctx, "", exactVat);
}

function finish(inv: Invoice, findings: Finding[], ctx: Context, note: string, exactVat?: number): InvoiceReview {
  // Apply credit notes that refer to this invoice (Art. 4.8: netted against the invoice).
  let creditsIncl = 0;
  for (const c of ctx.invoices.filter((i) => i.isCredit && i.creditOf === inv.invoiceNo && i.supplier === inv.supplier)) {
    creditsIncl += c.statedTotalCents;
    for (const cl of c.lines.filter((x) => x.amountCents < 0)) {
      const hit = findings.find((f) => f.severity === "dispute" && f.disputeExclCents === -cl.amountCents &&
        f.lineNos.some((n) => inv.lines.find((x) => x.n === n)?.code === cl.code));
      if (hit) {
        hit.severity = "info"; hit.kind = "credit-note";
        hit.reasonEn += ` ALREADY CREDITED by ${c.invoiceNo} (${eur(cl.amountCents)} excl. VAT, ${eur(c.statedTotalCents)} incl. VAT) — nothing left to dispute; the credit note is netted per Art. 4.8.`;
        hit.reasonNl += ` Dit bedrag is al gecrediteerd op creditfactuur ${c.invoiceNo}.`;
        hit.disputeExclCents = 0; hit.disputeVatCents = 0;
      }
    }
    findings.push(F(inv, { article: "4.8", kind: "credit-note", severity: "info", confidence: "certain", lineNos: [], disputeExclCents: 0,
      titleEn: `Credit note ${c.invoiceNo} applies`, reasonEn: `Credit note ${c.invoiceNo} (${eur(c.statedTotalCents)} incl. VAT) is netted against this invoice.`,
      reasonNl: `Creditfactuur ${c.invoiceNo} wordt met deze factuur verrekend (art. 4.8).`, evidence: c.lines.map((x) => x.raw), contractQuoteNl: quoteNl("4.8") }));
  }
  // Reconcile per-finding VAT (rounded per line) to the exact invoice-level figure: put the 1–2 cent rounding remainder on the largest VAT finding.
  if (exactVat !== undefined) {
    const open = findings.filter((f) => f.severity === "dispute" && f.kind !== "credit-note");
    const sum = open.reduce((a, f) => a + f.disputeVatCents, 0);
    const diff = exactVat - sum;
    if (diff !== 0 && open.length) {
      const target = [...open].sort((a, b) => (b.disputeVatCents + b.disputeExclCents) - (a.disputeVatCents + a.disputeExclCents))[0];
      target.disputeVatCents += diff;
    }
  }
  const billedIncl = inv.statedTotalCents;
  const dExcl = findings.filter((f) => f.severity === "dispute").reduce((a, f) => a + f.disputeExclCents, 0);
  const dVat = findings.filter((f) => f.severity === "dispute").reduce((a, f) => a + f.disputeVatCents, 0);
  const dOther = findings.filter((f) => f.severity === "dispute").reduce((a, f) => a + f.disputeOtherCents, 0);
  const hold = findings.some((f) => f.severity === "hold" && ["unknown-wo", "supplier-mismatch"].includes(f.kind)) || (!inv.workOrder);
  let verdict: Verdict; let reason = note;
  if (hold) verdict = "hold";
  else if (dExcl + dVat + dOther > 0) { verdict = "dispute"; reason = reason || `Dispute ${eur(dExcl)} excl. VAT + ${eur(dVat)} VAT${dOther ? ` + ${eur(dOther)} total error` : ""}.`; }
  else if (findings.some((f) => f.severity === "hold")) { verdict = "hold"; reason = reason || "On hold: needs Sanne's decision (see findings)."; }
  else { verdict = "approve"; reason = reason || (findings.length ? "No open findings." : "No findings: all lines match the contract."); }
  return {
    invoice: inv, verdict, verdictReasonEn: reason, findings,
    billedExclCents: inv.statedSubtotalCents, billedInclCents: billedIncl,
    disputeExclCents: dExcl, disputeVatCents: dVat, disputeOtherCents: dOther,
    payableExclCents: inv.statedSubtotalCents - dExcl,
    creditAppliedInclCents: creditsIncl,
    needsSanne: verdict === "hold" || findings.some((f) => f.confidence === "judgment" && f.severity !== "info"),
  };
}

export function reviewAll(ctx: Context): InvoiceReview[] {
  return ctx.invoices.map((i) => reviewInvoice(i, ctx));
}

export function deadlineFor(inv: Invoice): string {
  return addWorkdays(inv.invoiceDate, 10);
}
