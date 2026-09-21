# -*- coding: utf-8 -*-
"""Pull remaining official dumps (public URLs only)."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "data" / "raw"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36"

JOBS = [
    ("LT/PreparatasPakuote.csv", "https://get.data.gov.lt/datasets/gov/vvkt/vaistiniai_preparatai/PreparatasPakuote/:format/csv"),
    ("FI/Perusrekisteri.xml", "https://data.pilvi.fimea.fi/avoin-data/Perusrekisteri.xml"),
    ("IS/medicine.json", "https://ws.lyfjastofnun.is/rest/v2/medicine/0"),
    ("IT/confezioni_fornitura.csv", "https://drive.aifa.gov.it/farmaci/confezioni_fornitura.csv"),
    ("IT/PA_confezioni.csv", "https://drive.aifa.gov.it/farmaci/PA_confezioni.csv"),
    ("IT/atc.csv", "https://drive.aifa.gov.it/farmaci/atc.csv"),
    ("PL/overall.xml", "https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/public-pl-report/6.0.0/overall.xml"),
    ("DK/produkter.json", "https://api.medicinpriser.dk/v1/produkter?offset=0&limit=100"),
    ("AU/artg-search.html", "https://www.tga.gov.au/resources/artg"),
]


def curl(rel: str, url: str, timeout: int = 120) -> None:
    dest = RAW / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "curl", "-L", "--fail", "--ssl-no-revoke",
        "-A", UA,
        "--connect-timeout", "30",
        "--max-time", str(timeout),
        "-o", str(dest),
        url,
    ]
    print(f"GET {rel}", flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        err = (r.stderr or r.stdout or "")[-400:]
        print(f"FAIL {rel} code={r.returncode} {err}", flush=True)
        if dest.exists() and dest.stat().st_size < 200:
            dest.unlink()
        return
    n = dest.stat().st_size if dest.exists() else 0
    head = dest.read_bytes()[:80] if n else b""
    kind = "html" if head.lstrip()[:1] in (b"<", b"") and b"<!doctype" in head.lower() or head.lstrip()[:15].lower().startswith(b"<!doctype") or head.lstrip()[:5].lower() == b"<html" else "bin"
    print(f"OK   {rel} {n:,} B kind={kind}", flush=True)


def main():
    for rel, url in JOBS:
        curl(rel, url)
    p = RAW / "IS" / "medicine.json"
    if p.exists() and p.stat().st_size > 500:
        try:
            json.loads(p.read_text(encoding="utf-8"))
            print("IS JSON valid", flush=True)
        except Exception as e:
            print("IS not JSON", e, flush=True)


if __name__ == "__main__":
    main()
