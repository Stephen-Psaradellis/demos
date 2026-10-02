# Messy export to clean summary - Excel / Google Sheets

[Download orders_cleanup_demo.xlsx](orders_cleanup_demo.xlsx) - opens in
Excel and in Google Sheets (File > Import), and recalculates in both.

A typical small-business sheet problem: an order export with inconsistent
names, a duplicated row and a product nobody added to the price list, and a
summary that silently counts all of it. This workbook fixes that with plain
formulas - no macros, no add-ins - so the client can see and edit every step.

| Sheet | What it does |
|---|---|
| **Raw** | the export as received; Region has a dropdown so new rows stay valid |
| **Lookup** | product -> category |
| **Clean** | `PROPER(TRIM())` names, `INDEX/MATCH` category with `UNMAPPED` instead of an error, a `COUNTIFS` duplicate flag on the 2nd+ copy only, an Issue column, and red highlighting on any row with an issue |
| **Summary** | `SUMIFS` revenue by region x category excluding duplicates and unmapped rows, counts and amounts of what was excluded, and a reconciliation cell that checks summary + exclusions = the raw export |

On the sample data: revenue **1,125.00**; **1 duplicate** (87.00) and
**1 unmapped product** (105.00) excluded and shown, reconciliation **OK**.

Built by `build_workbook.py`; `verify_workbook.py` recalculates the workbook
with an independent formula engine and checks every result against values
computed separately in Python - so the numbers are tested, not eyeballed.
