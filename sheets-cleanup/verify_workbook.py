"""Recalculates orders_cleanup_demo.xlsx with the `formulas` engine and checks
every formula result against values computed independently in Python.
Run: python verify_workbook.py  (needs formulas)"""
import formulas
from build_workbook import RAW, PRODUCTS, REGIONS, CATEGORIES

xl = formulas.ExcelModel().loads("orders_cleanup_demo.xlsx").finish()
sol = xl.calculate()


def val(sheet, cell):
    for k, v in sol.items():
        if k.upper().endswith(f"[ORDERS_CLEANUP_DEMO.XLSX]{sheet.upper()}'!{cell}"):
            x = v.value[0, 0]
            return x.item() if hasattr(x, "item") else x
    raise KeyError(f"{sheet}!{cell}")


cat = dict(PRODUCTS)
seen, exp = set(), {(r, c): 0.0 for r in REGIONS for c in CATEGORIES}
dup_amt = unm_amt = 0.0
dups = unm = 0
for i, (d, cust, reg, prod, q, p) in enumerate(RAW, start=2):
    name = " ".join(w.capitalize() for w in cust.strip().split())
    key = (d, name, prod, q)
    amt = q * p
    assert val("Clean", f"B{i}") == name, (i, val("Clean", f"B{i}"), name)
    if key in seen:
        dups += 1; dup_amt += amt
        assert val("Clean", f"H{i}") == "DUPLICATE", i
        continue
    seen.add(key)
    assert val("Clean", f"H{i}") == "", i
    if prod not in cat:
        unm += 1; unm_amt += amt
        assert val("Clean", f"E{i}") == "UNMAPPED", i
        continue
    exp[(reg, cat[prod])] += amt

total = 0.0
for r, reg in enumerate(REGIONS, start=2):
    for k, c in enumerate(CATEGORIES):
        got = val("Summary", f"{chr(66 + k)}{r}")
        assert abs(got - exp[(reg, c)]) < 1e-9, (reg, c, got, exp[(reg, c)])
        total += exp[(reg, c)]
t = len(REGIONS) + 2
tot = chr(66 + len(CATEGORIES))
assert abs(val("Summary", f"{tot}{t}") - total) < 1e-9
assert val("Summary", f"B{t + 3}") == dups == 1
assert val("Summary", f"B{t + 4}") == unm == 1
assert abs(val("Summary", f"B{t + 5}") - dup_amt) < 1e-9
assert abs(val("Summary", f"B{t + 6}") - unm_amt) < 1e-9
assert val("Summary", f"B{t + 7}") == "OK"
print(f"all checks pass: revenue {total:,.2f}, 1 duplicate ({dup_amt:,.2f}) and "
      f"1 unmapped row ({unm_amt:,.2f}) excluded, reconciliation OK")
