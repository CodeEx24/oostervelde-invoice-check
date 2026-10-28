import { buildContext, reviewAll } from "./engine.js";
import { fmt } from "./money.js";
const ctx = buildContext();
let tx = 0, tv = 0;
for (const r of reviewAll(ctx)) {
  tx += r.disputeExclCents; tv += r.disputeVatCents;
  console.log(`${r.invoice.file.padEnd(17)} ${r.verdict.padEnd(8)} excl=${fmt(r.disputeExclCents).padStart(9)} vat=${fmt(r.disputeVatCents).padStart(7)}  ${r.findings.filter(f=>f.severity!=="info"||f.kind==="credit-note").map(f=>`[${f.article} ${f.kind}${f.severity==="hold"?"?":""} ${fmt(f.disputeExclCents)}/${fmt(f.disputeVatCents)}]`).join(" ")}`);
}
console.log("TOTAL excl", fmt(tx), "vat", fmt(tv));
