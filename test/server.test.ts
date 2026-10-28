import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let client: Client;
const decisions = join(mkdtempSync(join(tmpdir(), "oost-")), "decisions.jsonl");
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  return { err: !!r.isError, text: r.content[0].text };
};

beforeAll(async () => {
  client = new Client({ name: "test", version: "1" });
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: ["--import", "tsx", "src/server.ts"], cwd: process.cwd(),
    env: { ...process.env as Record<string, string>, DECISIONS_FILE: decisions },
  }));
}, 30000);
afterAll(async () => { await client.close(); });

describe("MCP server over stdio", () => {
  it("exposes small, clearly named tools", async () => {
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual(["check_invoice", "draft_dispute_email", "find_duplicates", "get_contract_rule", "get_invoice", "get_price", "get_work_order", "list_decisions", "list_invoices", "record_decision", "review_all"]);
  });
  it("get_price applies Art. 4.2 by execution date", async () => {
    expect(JSON.parse((await call("get_price", { code: "H02", execution_date: "2025-12-31" })).text).applicablePrice).toBe("€ 58,50");
    expect(JSON.parse((await call("get_price", { code: "H02", execution_date: "2026-01-01" })).text).applicablePrice).toBe("€ 60,37");
  });
  it("get_work_order errors on an unknown order (Art. 4.9)", async () => {
    const r = await call("get_work_order", { work_order: "WO-26-1099" });
    expect(r.err).toBe(true); expect(r.text).toContain("NOT in the export");
    expect(JSON.parse((await call("get_work_order", { work_order: "WO-26-1006" })).text).meerwerkApproval).toBe("GA-0412");
  });
  it("get_contract_rule returns Dutch text + English", async () => {
    const a = JSON.parse((await call("get_contract_rule", { query: "meerwerk" })).text)[0];
    expect(a.id).toBe("4.5"); expect(a.textNl).toContain("niet vergoed"); expect(a.textEn).toContain("NOT reimbursed");
  });
  it("check_invoice returns a verdict with evidence", async () => {
    const v = JSON.parse((await call("check_invoice", { invoice: "2026-0044" })).text);
    expect(v.verdict).toBe("dispute"); expect(v.disputeExcl).toBe("€ 120,74"); expect(v.findings[0].article).toBe("4.4");
    expect(v.findings[0].reasonNl).toContain("uur");
  });
  it("unknown invoice is a clean error, not a crash", async () => { expect((await call("check_invoice", { invoice: "nope" })).err).toBe(true); });
  it("find_duplicates sees the duplicate and the credit note", async () => {
    const d = JSON.parse((await call("find_duplicates")).text);
    expect(d.duplicates).toEqual([{ duplicate: "F26-0019", duplicateOf: "F26-0001", workOrder: "WO-26-1013" }]);
    expect(d.creditNotes[0].credits).toBe("2026-0049");
  });
  it("draft_dispute_email only drafts", async () => { expect((await call("draft_dispute_email", { invoice: "2026-0044" })).text).toContain("nog niet verzonden"); });
  it("human-in-the-loop: overrides need a reason and are logged", async () => {
    expect((await call("record_decision", { invoice: "2026-0038", final_verdict: "approve", sanne_reason: "" })).err).toBe(true);
    const ok = JSON.parse((await call("record_decision", { invoice: "2026-0038", final_verdict: "approve", sanne_reason: "Aannemer heeft 2025-prijzen schriftelijk bevestigd" })).text);
    expect(ok.override).toBe(true); expect(ok.proposed).toBe("dispute");
    await call("record_decision", { invoice: "2026-0044", final_verdict: "dispute", sanne_reason: "akkoord" });
    const list = JSON.parse((await call("list_decisions")).text);
    expect(list.decisions).toBe(2); expect(list.overrides).toHaveLength(1);
  });
});
