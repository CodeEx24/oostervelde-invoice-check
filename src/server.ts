#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadArticles } from "./contract.js";
import { listDecisions, recordDecision } from "./decisions.js";
import { buildContext, contractUnitPrice, findInvoice, reviewAll, reviewInvoice } from "./engine.js";
import { eur } from "./money.js";
import { renderDraftEmail, renderReviewList, reviewView, totals } from "./render.js";

const ctx = buildContext();
const server = new McpServer({ name: "oostervelde-invoice-check", version: "1.0.0" });

const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
const fail = (msg: string) => ({ isError: true, content: [{ type: "text" as const, text: msg }] });

server.registerTool("list_invoices", {
  description: "List all invoices in the batch (supplier, number, dates, work order, billed total). Use first to see what exists. Read-only.",
  inputSchema: {},
}, async () => text(ctx.invoices.map((i) => ({
  file: i.file, supplier: i.supplier, invoiceNo: i.invoiceNo, isCredit: i.isCredit, creditOf: i.creditOf, invoiceDate: i.invoiceDate,
  executionDate: i.executionDate, workOrder: i.workOrder, total: eur(i.statedTotalCents),
}))));

server.registerTool("get_invoice", {
  description: "Get one invoice normalised from its supplier layout: dates (ISO), work order, lines (qty, unit, unit price, amount, price-list code, meerwerk flag, VAT rate if printed), VAT lines, totals. All money in cents. Accepts invoice number or file name.",
  inputSchema: { invoice: z.string().describe("Invoice number (e.g. 2026-0044) or file name (e.g. h-2026-0044.txt)") },
}, async ({ invoice }) => {
  const i = findInvoice(ctx, invoice);
  return i ? text(i) : fail(`Unknown invoice "${invoice}". Call list_invoices.`);
});

server.registerTool("get_price", {
  description: "Contract price for a price-list code on an execution date. Applies Art. 4.2: work executed on/after 2026-01-01 uses the 2025 price +3.2% rounded to whole cents; earlier work uses the 2025 price. The EXECUTION date decides, not the invoice date.",
  inputSchema: { code: z.string().describe("Price-list code, e.g. H02"), execution_date: z.string().describe("ISO date YYYY-MM-DD") },
}, async ({ code, execution_date }) => {
  const item = ctx.prices.find((p) => p.code === code.toUpperCase());
  if (!item) return fail(`Unknown price code "${code}".`);
  const p = contractUnitPrice(item, execution_date);
  return text({ code: item.code, supplier: item.supplier, description: item.description, unit: item.unit, price2025: eur(item.price2025Cents), applicablePrice: eur(p.cents), applicablePriceCents: p.cents, indexed: p.indexed });
});

server.registerTool("get_work_order", {
  description: "Work order from the January export: supplier, type (regulier/spoed), max labour hours, MU extra-hours approval, GA meerwerk approval + approved amount, build year. Returns an error if the work order does not exist (Art. 4.9: then the invoice goes on hold).",
  inputSchema: { work_order: z.string().describe("e.g. WO-26-1007") },
}, async ({ work_order }) => {
  const w = ctx.workOrders.get(work_order.toUpperCase());
  return w ? text({ ...w, approvedMeerwerk: eur(w.approvedMeerwerkCents) }) : fail(`Work order ${work_order} is NOT in the export (Art. 4.9: invoice is not paid until the assignment is confirmed).`);
});

server.registerTool("get_contract_rule", {
  description: "Contract Article 4 rule(s): the verbatim Dutch text plus an English translation. Pass an article like '4.5' or a topic word (meerwerk, voorrijkosten, indexering, btw, uren, duplicate). Omit to get all.",
  inputSchema: { query: z.string().optional() },
}, async ({ query }) => {
  const all = Object.values(loadArticles());
  const q = (query ?? "").toLowerCase().trim();
  const topics: Record<string, string> = { prices: "4.1", price: "4.1", prijs: "4.1", index: "4.2", indexering: "4.2", indexation: "4.2", voorrijkosten: "4.3", callout: "4.3", "call-out": "4.3", uren: "4.4", hours: "4.4", arbeid: "4.4", meerwerk: "4.5", extra: "4.5", btw: "4.6", vat: "4.6", prijslijst: "4.7", "off-list": "4.7", duplicate: "4.8", dubbel: "4.8", credit: "4.8", creditfactuur: "4.8", onbekend: "4.9", unknown: "4.9", betaling: "4.10", payment: "4.10" };
  const id = /^4\.\d+$/.test(q) ? q : topics[q];
  const hit = q ? all.filter((a) => a.id === id || a.titleNl.toLowerCase().includes(q) || a.titleEn.toLowerCase().includes(q)) : all;
  return hit.length ? text(hit) : fail(`No article matches "${query}". Try 4.1–4.10 or a topic like meerwerk, btw, voorrijkosten.`);
});

server.registerTool("check_invoice", {
  description: "Run every Article 4 check on ONE invoice in code (price+indexation, unit conversion, call-out fee, hours/MU, meerwerk/GA, off-list items, VAT 9/21, unknown work order, duplicate/credit notes, arithmetic). Returns a proposed verdict (approve/dispute/hold) and findings, each with article, line, amount (excl. VAT / VAT / other, in cents and formatted), evidence, Dutch contract quote and a Dutch sentence for the contractor. 'judgment' confidence = Sanne should look. Read-only; never sends anything.",
  inputSchema: { invoice: z.string().describe("Invoice number or file name") },
}, async ({ invoice }) => {
  const i = findInvoice(ctx, invoice);
  return i ? text(reviewView(reviewInvoice(i, ctx))) : fail(`Unknown invoice "${invoice}". Call list_invoices.`);
});

server.registerTool("find_duplicates", {
  description: "Cross-invoice checks Sanne cannot do by eye: work orders billed on more than one invoice (identical = duplicate, different = repeat), and credit notes with the invoice they net against (Art. 4.8).",
  inputSchema: {},
}, async () => text({
  duplicates: [...ctx.duplicateOf].map(([dup, orig]) => ({ duplicate: dup, duplicateOf: orig, workOrder: ctx.invoices.find((i) => i.invoiceNo === dup)?.workOrder })),
  sameWorkOrderDifferentContent: [...ctx.repeatWo].map(([a, b]) => ({ invoice: a, earlier: b })),
  creditNotes: ctx.invoices.filter((i) => i.isCredit).map((c) => ({ creditNote: c.invoiceNo, credits: c.creditOf, total: eur(c.statedTotalCents) })),
}));

server.registerTool("review_all", {
  description: "Run check_invoice on all invoices and return the complete review list (markdown) plus totals. Use for the full monthly run. Proposed verdicts only.",
  inputSchema: { format: z.enum(["markdown", "json"]).optional() },
}, async ({ format }) => {
  const rs = reviewAll(ctx);
  return format === "json" ? text({ totals: totals(rs), invoices: rs.map(reviewView) }) : text(renderReviewList(rs, ctx));
});

server.registerTool("draft_dispute_email", {
  description: "Dutch e-mail DRAFT to the contractor for a disputed or on-hold invoice: line, contract rule, amount. Returns text only. NOTHING IS SENT; Sanne must approve and send it herself.",
  inputSchema: { invoice: z.string() },
}, async ({ invoice }) => {
  const i = findInvoice(ctx, invoice);
  if (!i) return fail(`Unknown invoice "${invoice}".`);
  const d = renderDraftEmail(reviewInvoice(i, ctx));
  return d ? text(d) : text(`Invoice ${i.invoiceNo} has no open findings; no e-mail needed.`);
});

server.registerTool("record_decision", {
  description: "Log Sanne's decision on an invoice. Call this ONLY after Sanne has said accept / reject / change. If her final verdict differs from the proposal it is stored as an override together with her reason (used for the comparison and for proposing rule updates). Does not contact anyone.",
  inputSchema: {
    invoice: z.string(), final_verdict: z.enum(["approve", "dispute", "hold"]),
    sanne_reason: z.string().describe("Her reason in her own words (required for overrides)"),
    final_dispute_excl_eur: z.number().optional().describe("Only if she edited the disputed amount (EUR excl. VAT)"),
  },
}, async ({ invoice, final_verdict, sanne_reason, final_dispute_excl_eur }) => {
  const i = findInvoice(ctx, invoice);
  if (!i) return fail(`Unknown invoice "${invoice}".`);
  const proposed = reviewInvoice(i, ctx).verdict;
  if (proposed !== final_verdict && !sanne_reason.trim()) return fail("An override needs Sanne's reason. Ask her why, then call again.");
  return text(recordDecision({ invoiceNo: i.invoiceNo, proposed, final: final_verdict, sanneReason: sanne_reason, finalDisputeExclCents: final_dispute_excl_eur === undefined ? undefined : Math.round(final_dispute_excl_eur * 100) }));
});

server.registerTool("list_decisions", {
  description: "Sanne's logged decisions and overrides so far (for the end-of-run summary and for proposing rule/skill updates).",
  inputSchema: {},
}, async () => { const d = listDecisions(); return text({ decisions: d.length, overrides: d.filter((x) => x.override), all: d }); });

await server.connect(new StdioServerTransport());
