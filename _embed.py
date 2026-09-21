# -*- coding: utf-8 -*-
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent
src = json.loads((root / "data" / "search.json").read_text(encoding="utf-8"))
seen = set()
rows = []
for r in src["r"]:
    while len(r) < 6:
        r.append("")
    key = (r[0], r[1].lower(), r[3].lower(), r[4].lower(), r[5].lower())
    if key in seen:
        continue
    seen.add(key)
    rows.append(r[:6])

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
        "c": src.get("c") or {},
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
html_path.write_text(html, encoding="utf-8")
print("rows", len(packed), "html_mb", round(html_path.stat().st_size / 1e6, 2), "table", len(table))
