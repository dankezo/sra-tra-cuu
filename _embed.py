# -*- coding: utf-8 -*-
import json
import re
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

blob = json.dumps(
    {
        "u": src.get("updated", ""),
        "n": len(packed),
        "t": table,
        "r": packed,
        "h": src.get("h") or {},
        "c": company_sites({"company": r[5]} for r in rows),
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
tmp.replace(html_path)
print("rows", len(packed), "html_mb", round(html_path.stat().st_size / 1e6, 2), "table", len(table))
