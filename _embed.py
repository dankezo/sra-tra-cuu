# -*- coding: utf-8 -*-
import json
import re
import time
from _sites import company_sites
from pathlib import Path

root = Path(__file__).resolve().parent
src = json.loads((root / "data" / "search.json").read_text(encoding="utf-8"))
seen = set()
rows = []
for r in src["r"]:
    while len(r) < 7:
        r.append("")
    if not r[6]:
        r[6] = "e" if r[0] == "EMA" else "d"
    key = (r[0], r[1].lower(), r[2].lower(), r[3].lower(), r[4].lower(), r[5].lower(), r[6])
    if key in seen:
        continue
    seen.add(key)
    rows.append(r[:7])

idx = {}
table = []
packed = []
for r in rows:
    ir = []
    for s in r:
        s = s or ""
        i = idx.get(s)
        if i is None:
            i = len(table)
            idx[s] = i
            table.append(s)
        ir.append(i)
    packed.append(ir)

vn = json.loads((root / "data/vn-ingredients.json").read_text(encoding="utf-8"))
vn.pop('ingredients', None)
vn_table, vn_index = [], {}
vn_records = []
for record in vn.pop('records'):
    packed_record = []
    for value in record:
        if value not in vn_index:
            vn_index[value] = len(vn_table)
            vn_table.append(value)
        packed_record.append(vn_index[value])
    vn_records.append(packed_record)
vn.update(table=vn_table, records=vn_records,
          domestic=json.loads((root / 'data/vn-domestic-list.json').read_text(encoding='utf-8')),
          evidence=json.loads((root / 'data/vn-evidence.json').read_text(encoding='utf-8')))

blob = json.dumps(
    {
        "u": src.get("updated", ""),
        "n": len(packed),
        "t": table,
        "r": packed,
        "h": src.get("h") or {},
        "c": company_sites({"company": r[5]} for r in rows),
        "vn": vn,
    },
    ensure_ascii=False,
    separators=(",", ":"),
).replace("<", "\\u003c")

html_path = root / "index.html"
html = html_path.read_text(encoding="utf-8")
pat = re.compile(
    r'(<script type="application/json" id="sra-med">)(.*?)(</script>)',
    re.S,
)
if not pat.search(html):
    raise SystemExit("marker missing")
html = pat.sub(lambda m: m.group(1) + blob + m.group(3), html, count=1)
tmp = html_path.with_name("_index.embed.html")
tmp.write_text(html, encoding="utf-8")
for attempt in range(6):
    try:
        tmp.replace(html_path)
        break
    except PermissionError:
        if attempt == 5:
            raise
        time.sleep(0.5)
print("rows", len(packed), "html_mb", round(html_path.stat().st_size / 1e6, 2), "table", len(table))
