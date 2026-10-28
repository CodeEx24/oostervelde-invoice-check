# NOTES — Oostervelde invoice check

Four headings, as asked: **Decisions and translations · Where Sanne decides · What changed along the way · What isn't finished.**

Headline result (all 40 invoices, `npm run all`): **17 approve · 20 dispute · 3 hold**. To dispute: **€ 2.649,85 excl. VAT + € 662,62 VAT + € 100,00 total error = € 3.412,47 incl. VAT**. Against Sanne's 10: same verdict on 8; the two differences (Hoekstra 2026-0038, De Wit DW26-009) are both cases where the contract sides with the engine, and one more where the verdict agrees but her amount is wrong (Bosman B-26-0102: 45,00 vs 46,44). Details in `output/comparison-with-sanne.md`.

---

## 1. Decisions and translations

### Translations I relied on
Dutch text is kept **verbatim** in the tool output and in the Dutch e-mail drafts; the English below is mine (also in `src/contract.ts`).

| Dutch | English | Why it matters |
|---|---|---|
| uitvoeringsdatum / datum uitvoering / uitgevoerd op | execution date (work done) | Art. 4.2: **this** decides the price year, not the invoice date (`factuurdatum`) |
| voorrijkosten | call-out fee | only on `spoed`, once per work order (4.3) |
| spoed / regulier | emergency / regular | work-order type |
| arbeid, uur | labour, hour | hour caps (4.4) |
| meerwerk | extra work outside the work order | 250-euro rule (4.5) |
| akkoord; MU-xxxx; GA-xxxx | approval; extra-hours approval; extra-work approval | stored in the work-order export |
| werkorder / werkbon / opdracht | work order | the join key between invoice and export |
| creditfactuur | credit note | 4.8: netted against the original |
| exclusief btw / btw | excl. VAT / VAT | price list is excl. VAT |
| rol 25 m vs m | roll of 25 m vs metre | 4.1 unit conversion |
| bouwjaar | year built | VAT 9 % depends on it (4.6) |
| betwist / onbetwist | disputed / undisputed | 4.10: the undisputed part IS paid |
| onbekende werkorders | unknown work orders | 4.9: hold |
| Art. 4.5 "ook niet het deel tot EUR 250,00" | "not even the part up to EUR 250.00" | without approval, meerwerk above 250 pays **nothing** (Sanne believed 250 is paid) |
| Art. 4.6 "uitsluitend over de arbeid (W01 en W04)" | "labour only (codes W01 and W04)" | 9 % is not "two VAT lines"; materials stay 21 % |

Number/date formats: `1.234,56` = 1,234.56 (dot thousands, comma decimals). Dates: Hoekstra `09-01-2026`, Bosman ISO, **Jansen `02/01/2026` = 2 January** (day first), De Wit `5 januari 2026`. All parsed in one place (`src/money.ts`, `src/dates.ts`) and unit-tested, including rejection of impossible dates.

### Interpretation choices (every place the contract or data left room)

| # | Question | What I chose | Why | Effect if the other reading is right |
|---|---|---|---|---|
| D1 | Which date picks the price year? | **Execution date** | Art. 4.2 says so explicitly | Sanne's "check invoice is from this year" would approve 5 invoices that overcharge |
| D2 | Indexation rounding | 2025 price × 1,032, rounded half-up to whole cents **per unit**, then × quantity | Art. 4.2 "afgerond op hele centen per eenheid"; matches every price the suppliers printed (19 prices tested) | none: it reproduces the suppliers' own numbers |
| D3 | Unit conversion (Art. 4.1): Hoekstra bills copper pipe per metre, list is per roll of 25 m | Compare exactly: 40 m allowed = 40/25 × 167,70 = **268,32**; billed 290,00 → dispute **21,68** | "prijs per eenheid omgerekend … mag niet hoger uitkomen"; no intermediate rounding of 6,708 | With 6,71 per metre it would be 21,60 (8 cents). Flagged in Gaps. |
| D4 | Meerwerk threshold basis | Sum of meerwerk lines per work order, excl. VAT; >250 with no GA → **everything** disputed; with GA → above the approved amount | Art. 4.5 literally | If only the excess over 250 were disputed, F26-0024 would be 60,00 instead of 310,00 |
| D5 | "Woningen ouder dan twee jaar" | execution year − build year > 2. Data has 1968–1972 and 2025 only, so no border case | Only the year is known | none in this data |
| D6 | 9 % VAT scope | Only price-list codes W01/W04 (labour, ceiling) on old homes; **materials and everything else 21 %, for every contractor** | Art. 4.6 | — |
| D7 | Contractor charges **too little** VAT (9 % on the 2025 new build DW26-015; 9 % on Hoekstra radiators 2026-0061) | **HOLD**, "ask for a corrected invoice", dispute amount 0 | There is no money to reclaim, but the invoice is wrong and should not be booked as is. This is a judgment (⚠) for Sanne | If MSTR expects DISPUTE: same two invoices, still not payable as is |
| D8 | Item not on the price list and not marked meerwerk (Bosman "Vogelwering dakgoot" 58,50) | **Dispute**, flagged ⚠ judgment | Art. 4.7: only paid after prior approval; the export has no field for such approvals, so I cannot see one | If an approval exists outside the export, Sanne overrides |
| D9 | Call-out fee on a spoed order charged twice | Only the second one is disputed | Art. 4.3 "ten hoogste één keer per werkorder" | — |
| D10 | Hours above max | Valued at the **contract** rate for the execution date; extra approved hours (MU) added to the max; hours aggregated over invoices of the same work order | Art. 4.4 | — |
| D11 | Duplicate | Same work order + identical lines = whole invoice disputed (F26-0019 = F26-0001); same work order with **different** lines = HOLD ⚠ (none occur) | Art. 4.8 | — |
| D12 | Credit note | C003 nets against 2026-0049; the call-out fee that I would have disputed on 0049 (46,44) is **already credited**, so not disputed twice; both approve | Art. 4.8 "verrekent" | double counting 46,44 + 9,75 |
| D13 | Unknown work order (WO-26-1099) | HOLD; nothing else is claimed because type, hours and build year are unknown | Art. 4.9 | — |
| D14 | VAT to reclaim | Billed VAT minus the VAT due on the amounts I accept, **per VAT bucket at invoice level** (that is how invoices round); per-finding VAT is reconciled to it | A per-line calculation gave 60,69 on DW26-011; the invoice-level one gives **60,68** | 1–2 cent differences |
| D15 | Overstated invoice total (2026-0052: total 510,20 but subtotal 339,01 + VAT 71,19 = 410,20) | Shown in its own "other" column (€ 100,00) because it has no VAT component | Keeps "excl. VAT" honest | — |
| D16 | Deadline "10 werkdagen" (4.10) | Counted from the **invoice date**, Mon–Fri, no holiday calendar | Received-date is not in the data | Deadline shifts by a few days |
| D17 | Headline amount | **excl. VAT**, with VAT and total incl. VAT next to it | Price list and Sanne's notes ("45,00 + btw") are excl. VAT | — |
| D18 | "Lekkage verhelpen, vast tarief" (fixed price) billed together with separate labour hours (2026-0052, 2026-0058) | Accepted: the contract does not say the fixed price includes labour, and the work order caps labour hours (which stay within the cap). 2026-0052 bills two fixed-price leaks; the work order names two leaks ("badkamer en keuken") | Flagged by the blind audit as unclear; if the fixed price includes labour, 60,37 on 0052 and 181,11 on 0058 would also be disputed. Ask MSTR. |

---

## 2. Where Sanne decides

**Principle: the system proposes, Sanne decides. There is no code path that pays, approves, or contacts a contractor.**

| Situation | What the solution does on its own | What goes to Sanne |
|---|---|---|
| Parse the 4 layouts, look up prices, work orders, rules; do all arithmetic; find duplicates and credit notes | Everything (code, cent-exact) | — |
| Invoice with **no findings** | Marks it "proposed approve" (17 invoices), with the line-by-line reason it is clean | She still signs off. These are listed compactly at the end |
| **Clear rule breach** (price, hours, call-out fee, meerwerk, duplicate, arithmetic, VAT overcharge) | Proposes **dispute** with article, line, amount (excl./VAT), evidence, Dutch quote, Dutch sentence | She accepts / rejects / changes the amount |
| **Not sure** (⚠ `judgment`): off-list item, VAT undercharged, repeat billing; or **missing data**: unknown work order | Proposes **hold** (or dispute with ⚠), and shows **both readings** | She says yes / no / change; for an unknown work order it waits for the housing officer |
| **Anything reaching a contractor** | Drafts a Dutch e-mail marked `CONCEPT — nog niet verzonden`. **No send tool exists.** The skill forbids sending unless Sanne explicitly asks for that specific draft | She reads, edits and sends it herself |
| **Sanne overrules** | `record_decision` appends proposal, final verdict and **her reason** to `output/decisions.jsonl` (an override without a reason is refused). At the end the skill lists the overrides and **proposes** a rule/skill change | A person changes the code. The tool never rewrites its own rules |

Why this shape: Sanne said she will not approve forty invoices on a computer's word and wants to see *why*. So every flag carries evidence, uncertain items are shown first with the question, clean invoices are never silently approved, and a mistake of hers or of the engine stays visible in the log.

---

## 3. What changed along the way

1. **Parser self-check found 3 "mismatches" on the first run, 2 real and 1 mine.** Comparing each invoice's lines to its own subtotal/total flagged `2026-0052` (total printed 100,00 too high), `DW26-016` (30 m² × 7,43 = 222,90 but 232,90 billed) and `2026-0063`. The last was my bug: unit `post` (lump sum) was not in my unit list, so the 180,00 meerwerk line was dropped. Fixed (any unit token), and a test now asserts that **exactly** the two real invoices have arithmetic errors.
2. **Double reporting of DW26-016.** The same 10,00 appeared as a price finding *and* an arithmetic finding. Changed to one finding per line: price if the unit price is above the contract, otherwise arithmetic.
3. **Headline total moved.** My first total (€ 2.749,85 "excl. VAT") included the 100,00 total error of `2026-0052`. That error has no VAT component, so it moved to its own column: **€ 2.649,85 excl.** + € 100,00 other.
4. **VAT cent mismatch.** Per-line VAT gave 60,69 for DW26-011; the invoice's own rounding gives 60,68. I switched to an invoice-level, per-VAT-bucket calculation and reconcile the per-finding numbers to it (the 1-cent remainder goes on the largest finding).
5. **Credit note handling.** First idea: dispute the call-out fee on 2026-0049. Then I saw C003 already credits it. Now the original is "approve, net of credit" and the finding is shown as *already credited*, not disputed twice.
6. **A wrong test, not a wrong engine.** A test sorted numbers as strings (`[1850, 561]`). Fixed the test.
7. **What I did not do:** let the model read invoices and do the maths in the prompt. I judged that unfit for "correct to the cent" and for evidence Sanne can forward, so the model only presents, asks and logs.
8. **Independent check (see §4 for the outcome):** a separate agent audited the 40 invoices **blind** (it was told not to read my code) and I compared its table with mine.

---

## 4. What isn't finished

**Honest gaps**
- **The skill has not yet been run live in Claude Desktop/Code by me.** The MCP server *is* tested end to end with a real MCP client over stdio (`test/server.test.ts`), and `npm run review` calls the same code as `review_all`, so the review list is what the skill gets. But the `SKILL.md` workflow (present → ask → log → draft → close) has not been exercised with a live Claude, and a few rounds of wording changes will probably be needed. **Next step #1** before the video.
- **No received-date** in the data: the 10-working-day (4.10) deadline is counted from the invoice date, with no Dutch holiday calendar.
- **Approvals outside the export** (e.g. for the Vogelwering item) cannot be seen; D8 is therefore ⚠.
- **Hours/meerwerk aggregation** only sees invoices in this batch; earlier months are not available.
- **Layouts are hard-coded** for the 4 suppliers. A fifth layout fails loudly ("unknown supplier layout"), it does not guess. No PDF/OCR; input is text.
- **Credit-note netting** is exact only for the case in the data (credit amount equals a disputed line); a partial or unrelated credit is shown as "applies" and reduces payable, but is not matched to specific lines.
- The **Dutch e-mail wording** was not reviewed by a native speaker; it is formal and complete, but Sanne may prefer her own tone. It repeats the contract quote on purpose ("it has to be airtight").
- **Amount ambiguities:** D3 (8 cents), D7 (VAT undercharge: hold vs dispute), D8 (off-list approval). I would ask MSTR about these three.

**What I would do next**
1. Run the skill live as Sanne, fix the wording, then record the video (one hard case: DW26-009 where Sanne's dispute is wrong because GA-0412 exists; one thing it still gets wrong or can't know: the off-list approval / VAT-undercharge policy).
2. Ask MSTR the three questions above and update the golden table if their key differs.
3. Add the received-date and a working-day calendar.
4. Learn from overrides: turn repeated overrides into *proposed* rule changes, reviewed by a person.

**Independent blind audit — result**
A separate agent (not shown my code or output; told not to read the solution folder) audited all 40 invoices from the raw dataset and produced its own table. Result:

- **Verdict and amount equal on 37 of 40 invoices**, including all 17 disputed rows' amounts excl. VAT: both of us get **€ 2.649,85 excl. VAT**. It also reached the same 8/10 agreement with Sanne and the same two differences (0038, DW26-009), and the same readings on indexation, meerwerk (GA cap, nothing paid without GA), unit conversion (268,32) and the credit note.
- **3 differences, all resolved:**
  1. `2026-0052`: the audit **approved** it; I **dispute € 100,00**. Checked against the raw file: lines 339,01 + VAT 71,19 = 410,20 but the invoice prints *TOTAAL TE BETALEN € 510,20*. The audit's arithmetic sweep missed the total line. Mine is right; this is the only place where the blind check was less strict.
  2. `2026-0061` and `DW26-015` (VAT charged too low): audit label "dispute, VAT −50,28 / −90,28, corrected invoice needed", mine "hold, corrected invoice needed". Same action for Sanne, different label (D7).
  3. VAT on `2026-0058`: audit 9,75 (21 % of 46,44), mine **9,76** (invoice-level: 86,80 billed − 77,04 due). That is the 1-cent rounding difference of D14; it makes my VAT total 543,14 vs the audit's 543,13 on the same 17 rows.
- The audit raised one **ambiguity I had not written down** (fixed-price leak repair + separate labour): added as D18.

This does not prove the engine matches MSTR's key, only that two independent readings of the contract and data agree and that the single disagreement was a real invoice error caught by the engine.
