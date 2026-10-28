# Comparison with Sanne's 10 verdicts

**Result:** the engine agrees with Sanne on the verdict for 8 of 10 invoices, differs on 2 (2026-0038, DW26-009), and agrees on verdict but not on the amount for 1 (B-26-0102). In both verdict differences the contract supports the engine, not Sanne. Her Dutch notes are translated in the table.

| Invoice | Sanne | Engine | Same verdict? | Sanne's note (NL → EN) | Engine dispute |
|---|---|---|---|---|---|
| Hoekstra 2026-0031 | approve | approve | yes | - | - |
| De Wit DW26-004 | approve | approve | yes | - | - |
| Jansen F26-0007 | approve | approve | yes | spoed, voorrijkosten ok → emergency job, call-out fee OK | - |
| Hoekstra 2026-0038 | approve | dispute | **NO** | prijzen kloppen met de nieuwe prijslijst → prices match the new price list | € 24,11 excl. + € 5,06 VAT = € 29,17 |
| Bosman B-26-0102 | dispute | dispute | yes | voorrijkosten op regulier werk, 45,00 + btw terugvragen → call-out fee on regular work, claim back 45.00 + VAT | € 46,44 excl. + € 9,75 VAT = € 56,19 |
| De Wit DW26-009 | dispute | approve | **NO** | meerwerk 385,00 boven de 250, geen akkoord gezien → extra work 385.00 above the 250, no approval seen | - |
| Hoekstra 2026-0044 | dispute | dispute | yes | 8 uur gefactureerd, max 6. 2 uur terugvragen → 8 hours invoiced, max 6. Claim back 2 hours | € 120,74 excl. + € 25,36 VAT = € 146,10 |
| De Wit DW26-011 | dispute | dispute | yes | schilderarbeid tegen 21% btw, moet 9% → painting labour charged at 21% VAT, should be 9% | € 0,00 excl. + € 60,68 VAT = € 60,68 |
| Jansen F26-0012 | approve | approve | yes | - | - |
| Bosman B-26-0097 | approve | approve | yes | spoed → emergency | - |

## Every difference, explained

**Hoekstra 2026-0031** — agree

Both approve. Executed 6 Jan 2026, so indexed prices apply (CV-ketel 2.528,40, labour 60,37); 5 h ≤ max 6.

**De Wit DW26-004** — agree

Both approve. Executed 8 Jan 2026 (indexed prices). Home built 1972 (> 2 years): 9 % on labour W01 and ceiling W04, 21 % on paint — exactly as billed. 12 h ≤ max 14.

**Jansen F26-0007** — agree

Both approve. Work order WO-26-1003 is spoed, so one call-out fee is allowed. 2 h ≤ max 3, prices indexed (executed 5 Jan 2026).

**Hoekstra 2026-0038** — DIFFERENT verdict

DIFFERENT. Sanne approved because 'prices match the new price list'. But the work was executed on 17 Dec 2025 and Art. 4.2 says the EXECUTION date decides, not the invoice date. 2025 prices apply: radiators 289,00 (billed 298,25) and labour 58,50 (billed 60,37). Overcharge 24,11 excl. VAT. Her shortcut 'check that the invoice is from this year' is the wrong test.

**Bosman B-26-0102** — agree on verdict, amount differs

Same verdict, different amount. WO-26-1005 is regular work, so the call-out fee is not allowed (Art. 4.3). Sanne wants back '45,00 + btw', but the fee billed is 46,44: the 2025 price of 45,00 indexed by 3,2 % (work executed 12 Jan 2026). Disputing 45,00 would leave 1,44 unrecovered; the contractor would also point out the mismatch with the invoice line.

**De Wit DW26-009** — DIFFERENT verdict

DIFFERENT. Sanne disputes the meerwerk of 385,00 as 'above 250, no approval seen'. But WO-26-1006 in the work-order export carries approval GA-0412 for EUR 400,00 (Art. 4.5: with approval, up to the approved amount is paid). 385,00 ≤ 400,00, so it is payable. Sanne said herself that she doesn't always open the export. Disputing it would have been wrong and the contractor would have pushed back.

**Hoekstra 2026-0044** — agree

Both dispute. WO-26-1007 max 6 h, no MU approval; billed 8 h → 2 h × 60,37 = 120,74 excl. VAT (+ 25,36 VAT).

**De Wit DW26-011** — agree

Both dispute. Labour on WO-26-1008 (built 1968) must carry 9 % but was billed at 21 %. Only the VAT is wrong, not the price: reclaim = VAT billed minus VAT due = 60,68 (computed per VAT bucket, the way invoices round).

**Jansen F26-0012** — agree

Both approve. 6 smoke detectors at the indexed 40,76 (executed 7 Jan 2026), 2 h ≤ max 3, regular work with no call-out fee.

**Bosman B-26-0097** — agree

Both approve. WO-26-1010 is spoed: one call-out fee (46,44, indexed) is allowed; 3 h ≤ max 4.

## What this says about the engine and about Sanne

- Sanne's two misses are exactly the two shortcuts she described in the audit: 'check the invoice date for the price year' and 'skip the work-order export when it's small or I'm busy'. Both are the kind of lookups a tool should do for her.
- Nothing in the 10 shows the engine being wrong against the contract. That is a statement about these 10 only: the 30 others were checked against rules, not against Sanne. Where the engine is least sure is listed in NOTES.md (judgment calls).
