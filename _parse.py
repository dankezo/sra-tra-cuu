# -*- coding: utf-8 -*-
"""Rebuild search.json / CSV from official dumps — authorised + marketed only."""
from __future__ import annotations

import csv
import io
import json
import re
import ssl
import time
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from _sites import company_sites

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data"
NS_SS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
SS_T = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"
TODAY = datetime(2026, 9, 21)

SRA36 = [
    ("AT", "Áo"),
    ("BE", "Bỉ"),
    ("BG", "Bulgaria"),
    ("HR", "Croatia"),
    ("CY", "Síp"),
    ("CZ", "Séc"),
    ("DK", "Đan Mạch"),
    ("EE", "Estonia"),
    ("FI", "Phần Lan"),
    ("FR", "Pháp"),
    ("DE", "Đức"),
    ("GR", "Hy Lạp"),
    ("HU", "Hungary"),
    ("IE", "Ireland"),
    ("IT", "Ý"),
    ("LV", "Latvia"),
    ("LT", "Lithuania"),
    ("LU", "Luxembourg"),
    ("MT", "Malta"),
    ("NL", "Hà Lan"),
    ("PL", "Ba Lan"),
    ("PT", "Bồ Đào Nha"),
    ("RO", "Romania"),
    ("SK", "Slovakia"),
    ("SI", "Slovenia"),
    ("ES", "Tây Ban Nha"),
    ("SE", "Thụy Điển"),
    ("US", "Mỹ"),
    ("GB", "Anh"),
    ("JP", "Nhật Bản"),
    ("CH", "Thụy Sĩ"),
    ("CA", "Canada"),
    ("AU", "Úc"),
    ("NO", "Na Uy"),
    ("IS", "Iceland"),
    ("LI", "Liechtenstein"),
]

MON = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}


def log(m: str) -> None:
    print(m, flush=True)


def clean(s: str, n: int) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()[:n]


def add_row(rows, country, inn, name, form, strength, company="", extra="", src=""):
    inn = clean(inn, 240)
    name = clean(name, 240)
    form = clean(form, 160)
    strength = clean(strength, 80) or strength_from(name) or strength_from(inn)
    company = clean(company, 180)
    extra = clean(extra, 120)
    if not inn and not name:
        return
    src = src or ("e" if country == "EMA" else "d")
    rows.append(
        {
            "country": country,
            "inn": inn,
            "name": name,
            "form": form,
            "strength": strength,
            "company": company,
            "extra": extra,
            "src": src,
        }
    )


FUNNEL = {
    "raw": Counter(),
    "drop": defaultdict(Counter),
    "kept_prod": Counter(),
}


def reject(cc: str, reason: str) -> None:
    FUNNEL["raw"][cc] += 1
    FUNNEL["drop"][cc][reason] += 1


def accept_prod(cc: str) -> None:
    FUNNEL["raw"][cc] += 1
    FUNNEL["kept_prod"][cc] += 1


def local(tag: str) -> str:
    return tag.split("}")[-1]


def col_index(ref: str) -> int:
    letters = "".join(ch for ch in (ref or "") if ch.isalpha())
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch.upper()) - 64)
    return max(n - 1, 0)


NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def _xlsx_shared_strings(z: zipfile.ZipFile) -> list[str]:
    ss = []
    if "xl/sharedStrings.xml" not in z.namelist():
        return ss
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    for si in root.findall("m:si", NS_SS):
        ss.append("".join(t.text or "" for t in si.iter(SS_T)))
    return ss


def _xlsx_row_vals(row, ss: list[str]) -> list[str] | None:
    cells = {}
    maxc = -1
    i = 0
    for c in row.findall("m:c", NS_SS):
        ref = c.get("r") or ""
        idx = col_index(ref) if ref else i
        t = c.get("t")
        val = ""
        if t == "inlineStr":
            val = "".join(x.text or "" for x in c.iter() if local(x.tag) == "t")
        else:
            v = c.find("m:v", NS_SS)
            val = v.text if v is not None else ""
            if t == "s" and val and val.isdigit() and int(val) < len(ss):
                val = ss[int(val)]
        cells[idx] = val or ""
        maxc = max(maxc, idx)
        i += 1
    if maxc < 0:
        return None
    return [cells.get(j, "") for j in range(maxc + 1)]


def _xlsx_zip_path(z: zipfile.ZipFile, target: str) -> str | None:
    t = (target or "").lstrip("/")
    for cand in (t, "xl/" + t, t.replace("xl/xl/", "xl/")):
        if cand in z.namelist():
            return cand
    leaf = t.split("/")[-1]
    for n in z.namelist():
        if n.endswith("/" + leaf) and "worksheets" in n:
            return n
    return None


def xlsx_worksheets(path: Path) -> list[tuple[str, str]]:
    if not path.exists() or not zipfile.is_zipfile(path):
        return []
    with zipfile.ZipFile(path) as z:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        rid = {el.get("Id"): el.get("Target") for el in rels}
        out = []
        for sh in wb.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheets/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet"):
            title = sh.get("name") or ""
            zp = _xlsx_zip_path(z, rid.get(sh.get(NS_REL + "id") or "") or "")
            if zp:
                out.append((title, zp))
        return out


def xlsx_rows(path: Path, sheet_name: str | None = None):
    if not path.exists() or not zipfile.is_zipfile(path):
        return
    with zipfile.ZipFile(path) as z:
        ss = _xlsx_shared_strings(z)
        named = xlsx_worksheets(path)
        if sheet_name:
            match = [zp for title, zp in named if sheet_name.lower() in (title or "").lower() or sheet_name in zp]
            sheets = match or [zp for _, zp in named]
        else:
            sheets = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")]
            sheets.sort(key=lambda n: z.getinfo(n).file_size, reverse=True)
        if not sheets:
            return
        target = sheets[0]
        root = ET.fromstring(z.read(target))
        for row in root.findall("m:sheetData/m:row", NS_SS):
            vals = _xlsx_row_vals(row, ss)
            if vals:
                yield vals


def xlsx_rows_all(path: Path):
    """Yield (sheet_title, row) for every worksheet."""
    if not path.exists() or not zipfile.is_zipfile(path):
        return
    with zipfile.ZipFile(path) as z:
        ss = _xlsx_shared_strings(z)
        for title, zp in xlsx_worksheets(path):
            root = ET.fromstring(z.read(zp))
            for row in root.findall("m:sheetData/m:row", NS_SS):
                vals = _xlsx_row_vals(row, ss)
                if vals:
                    yield title, vals


def parse_en_date(s: str) -> datetime | None:
    s = (s or "").strip()
    m = re.match(r"(\d{1,2})-([A-Za-z]{3})-(\d{4})", s)
    if m:
        try:
            return datetime(int(m.group(3)), MON[m.group(2).upper()], int(m.group(1)))
        except (KeyError, ValueError):
            return None
    return None


def parse_dot_date(s: str) -> datetime | None:
    s = (s or "").strip()
    m = re.match(r"(\d{4})\.(\d{2})\.(\d{2})", s)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    return None


def parse_fr(rows):
    cis_p, comp_p = RAW / "FR" / "CIS_bdpm.txt", RAW / "FR" / "CIS_COMPO_bdpm.txt"
    cis_map = {}
    if cis_p.exists():
        for line in cis_p.read_bytes().decode("latin-1").splitlines():
            c = line.split("\t")
            if len(c) < 11:
                continue
            auth = (c[4] or "").strip()
            mkt = (c[6] or "").strip()
            if auth != "Autorisation active":
                reject("FR", "not_authorised")
                continue
            if mkt != "Commercialisée":
                reject("FR", "not_marketed")
                continue
            accept_prod("FR")
            cis_map[c[0]] = {"name": c[1], "form": c[2], "company": c[10]}
    n = 0
    if comp_p.exists():
        for line in comp_p.read_bytes().decode("latin-1").splitlines():
            c = line.split("\t")
            if len(c) < 7:
                continue
            nature = (c[6] or "").upper()
            if nature and nature != "SA":
                continue
            cis = c[0]
            info = cis_map.get(cis)
            if not info:
                continue
            add_row(rows, "FR", c[3], info.get("name") or "", c[1] or info.get("form") or "", c[4], info.get("company") or "", cis)
            n += 1
    log(f"parse FR {n} rows from {len(cis_map)} marketed CIS")


def parse_ema_cap(rows) -> bool:
    files = list((RAW / "BG").glob("Centrally*.xlsx")) + list((RAW / "EMA").glob("Centrally*.xlsx"))
    files = [p for p in files if p.stat().st_size > 1000]
    if not files:
        return False
    p = max(files, key=lambda x: x.stat().st_size)
    n = 0
    header = None
    for vals in xlsx_rows(p):
        if header is None:
            header = [(h or "").strip().lower() for h in vals]
            continue

        def col(*cands):
            for cand in cands:
                for i, h in enumerate(header):
                    if cand in h:
                        return vals[i] if i < len(vals) else ""
            return ""

        inn_raw = col("active substance", "inn")
        name = col("invented name", "name of medicine", "name")
        form = ""
        for i, h in enumerate(header):
            if "pharmaceutical form" in h and "eutct" not in h:
                form = vals[i] if i < len(vals) else ""
                break
        strength = col("strength")
        company = col("mah", "marketing")
        extra = col("eu number", "ema product")
        proc = (col("type of procedure") or "").upper()
        if proc and "CAP" not in proc and "CENTRAL" not in proc:
            reject("EMA", "not_central")
            continue
        inn_parts, seen = [], set()
        for bit in re.split(r"\s*/\s*", inn_raw or ""):
            bit = bit.strip()
            k = bit.lower()
            if bit and k not in seen:
                seen.add(k)
                inn_parts.append(bit)
        inn = " / ".join(inn_parts)
        if not inn and not name:
            reject("EMA", "not_human")
            continue
        accept_prod("EMA")
        add_row(rows, "EMA", inn, name, form, strength, company, extra, src="e")
        n += 1
    log(f"parse EMA CAP {p.name} {n}")
    return n > 0


def parse_ema(rows):
    # CAP supplies presentations; the EMA catalogue can contain additional products.
    parse_ema_cap(rows)
    p = RAW / "EMA" / "medicines.json"
    if not p.exists():
        return
    payload = json.loads(p.read_text(encoding="utf-8"))
    items = payload.get("data") if isinstance(payload, dict) else payload
    n = 0
    for it in items or []:
        if not isinstance(it, dict):
            continue
        if (it.get("category") or "Human") not in {"Human", ""}:
            reject("EMA", "not_human")
            continue
        st = (it.get("medicine_status") or "").strip()
        if st != "Authorised":
            reject("EMA", "not_authorised")
            continue
        accept_prod("EMA")
        add_row(
            rows,
            "EMA",
            it.get("international_non_proprietary_name_common_name") or it.get("active_substance") or "",
            it.get("name_of_medicine") or "",
            "",
            "",
            it.get("marketing_authorisation_developer_applicant_holder") or "",
            it.get("ema_product_number") or "",
            src="e",
        )
        n += 1
    log(f"parse EMA {n}")


def parse_bg(rows):
    folder = RAW / "BG"
    files = [
        p
        for p in folder.glob("*.xlsx")
        if p.stat().st_size > 1000 and "central" not in p.name.lower()
    ]
    if not files:
        return
    p = max(files, key=lambda x: x.stat().st_size)
    n = 0
    header = None
    for vals in xlsx_rows(p):
        if header is None:
            header = [(h or "").strip().lower() for h in vals]
            continue

        def col(*cands):
            for cand in cands:
                for i, h in enumerate(header):
                    if cand in h:
                        return vals[i] if i < len(vals) else ""
            return ""

        inn = col("inn")
        name = col("търговско", "invented", "name")
        form = ""
        for i, h in enumerate(header):
            if "форма en" in h or "form en" in h:
                form = vals[i] if i < len(vals) else ""
                break
        if not form:
            form = col("лек. форма", "форма", "form")
        strength = col("количество на акт", "quantity")
        company = col("притежател", "holder", "mah")
        extra = col("рег. №", "рег", "идентификатор")
        if not inn and not name:
            reject("BG", "not_human")
            continue
        accept_prod("BG")
        add_row(rows, "BG", inn, name, form, strength, company, extra, src="d")
        n += 1
    log(f"parse BG {p.name} {n}")


def parse_ca(rows):
    caz = RAW / "CA" / "allfiles.zip"
    if not caz.exists() or not zipfile.is_zipfile(caz):
        return
    with zipfile.ZipFile(caz) as z:
        drugs, ings, forms, companies, latest = {}, {}, {}, {}, {}
        for line in z.read("drug.txt").decode("utf-8", "replace").splitlines():
            parts = next(csv.reader([line]))
            if len(parts) >= 4:
                drugs[parts[0]] = parts[3]
        for line in z.read("ingred.txt").decode("utf-8", "replace").splitlines():
            parts = next(csv.reader([line]))
            if len(parts) >= 3:
                ings.setdefault(parts[0], []).append(
                    (parts[2], parts[4] if len(parts) > 4 else "", parts[5] if len(parts) > 5 else "")
                )
        for line in z.read("form.txt").decode("utf-8", "replace").splitlines():
            parts = next(csv.reader([line]))
            if len(parts) >= 3:
                forms[parts[0]] = parts[2]
        for line in z.read("comp.txt").decode("utf-8", "replace").splitlines():
            parts = next(csv.reader([line]))
            if len(parts) >= 5 and parts[4] == "DIN_OWNER":
                companies.setdefault(parts[0], parts[3])
        for line in z.read("status.txt").decode("utf-8", "replace").splitlines():
            parts = next(csv.reader([line]))
            if len(parts) < 4:
                continue
            did, st, dt = parts[0], (parts[2] or "").upper(), parse_en_date(parts[3]) or datetime.min
            prev = latest.get(did)
            if prev is None or dt >= prev[0]:
                latest[did] = (dt, st)
        n = 0
        for did, name in drugs.items():
            st = (latest.get(did) or (None, ""))[1]
            if st.startswith("CANCELLED"):
                reject("CA", "cancelled")
                continue
            if st != "MARKETED":
                reject("CA", "not_marketed")
                continue
            accept_prod("CA")
            inn_list = ings.get(did, [])
            inn = ", ".join(x[0] for x in inn_list if x[0])
            strength = ", ".join(f"{x[1]} {x[2]}".strip() for x in inn_list if x[1] or x[2])
            add_row(rows, "CA", inn, name, forms.get(did, ""), strength, companies.get(did, ""), did)
            n += 1
    log(f"parse CA {n}")


def parse_us(rows):
    usz = RAW / "US" / "drugsfda.zip"
    if not usz.exists() or not zipfile.is_zipfile(usz):
        return
    with zipfile.ZipFile(usz) as z:
        products = z.read("Products.txt").decode("latin-1", "replace")
        marketing = z.read("MarketingStatus.txt").decode("latin-1", "replace")
        apps = z.read("Applications.txt").decode("latin-1", "replace")
    status = {}
    for it in csv.DictReader(io.StringIO(marketing), delimiter="\t"):
        key = ((it.get("ApplNo") or "").zfill(6), (it.get("ProductNo") or "").zfill(3))
        status.setdefault(key, set()).add(it.get("MarketingStatusID") or "")
    sponsor = {}
    for it in csv.DictReader(io.StringIO(apps), delimiter="\t"):
        sponsor[(it.get("ApplNo") or "").zfill(6)] = (it.get("SponsorName") or "").strip()
    n = 0
    for it in csv.DictReader(io.StringIO(products), delimiter="\t"):
        appl = (it.get("ApplNo") or "").zfill(6)
        prod = (it.get("ProductNo") or "").zfill(3)
        ids = status.get((appl, prod), set())
        if "3" in ids:
            reject("US", "discontinued")
            continue
        if not ids.intersection({"1", "2"}):
            reject("US", "not_marketed")
            continue
        accept_prod("US")
        add_row(
            rows,
            "US",
            it.get("ActiveIngredient") or "",
            it.get("DrugName") or "",
            it.get("Form") or "",
            it.get("Strength") or "",
            sponsor.get(appl, ""),
            appl,
        )
        n += 1
    log(f"parse US {n}")


def parse_ie(rows):
    p = RAW / "IE" / "latestHumanlist.xml"
    if not p.exists():
        return
    n = 0
    for event, el in ET.iterparse(p, events=("end",)):
        if local(el.tag) != "Product":
            continue
        name = form = licence = company = market = ""
        inns = []
        for child in list(el):
            t = local(child.tag)
            if t == "ProductName":
                name = child.text or ""
            elif t == "DosageForm":
                form = child.text or ""
            elif t == "LicenceNumber":
                licence = child.text or ""
            elif t == "PAHolder":
                company = child.text or ""
            elif t == "MarketInfo":
                market = (child.text or "").strip()
            elif t == "ActiveSubstances":
                inns = [(c.text or "").strip() for c in list(child) if (c.text or "").strip()]
        if market != "Marketed":
            reject("IE", "not_marketed" if market == "Not marketed" else "unknown_market")
            el.clear()
            continue
        accept_prod("IE")
        add_row(rows, "IE", ", ".join(inns), name, form, "", company, licence)
        n += 1
        el.clear()
    log(f"parse IE {n}")


def dec_cz(p: Path) -> str:
    blob = p.read_bytes()
    for enc in ("cp1250", "utf-8-sig", "latin-1"):
        try:
            return blob.decode(enc)
        except UnicodeDecodeError:
            continue
    return blob.decode("latin-1", "replace")


def parse_cz(rows):
    latky_p = RAW / "CZ" / "dlp_latky.csv"
    sloz_p = RAW / "CZ" / "dlp_slozeni.csv"
    prep_p = RAW / "CZ" / "dlp_lecivepripravky.csv"
    org_p = RAW / "CZ" / "dlp_organizace.csv"
    if not prep_p.exists():
        return
    latky = {}
    if latky_p.exists():
        for it in csv.DictReader(io.StringIO(dec_cz(latky_p)), delimiter=";"):
            kod = it.get("KOD_LATKY") or ""
            latky[kod] = it.get("NAZEV_INN") or it.get("NAZEV_EN") or it.get("NAZEV") or ""
    inn_by = {}
    if sloz_p.exists():
        for it in csv.DictReader(io.StringIO(dec_cz(sloz_p)), delimiter=";"):
            if (it.get("S") or "").upper() != "L":
                continue
            kod = it.get("KOD_SUKL") or ""
            inn = latky.get(it.get("KOD_LATKY") or "", "")
            amt = f"{it.get('AMNT') or ''} {it.get('UN') or ''}".strip()
            if inn:
                inn_by.setdefault(kod, []).append((inn, amt))
    orgs = {}
    if org_p.exists():
        for it in csv.DictReader(io.StringIO(dec_cz(org_p)), delimiter=";"):
            orgs[it.get("ZKR_ORG") or ""] = it.get("NAZEV") or ""
    n = 0
    for it in csv.DictReader(io.StringIO(dec_cz(prep_p)), delimiter=";"):
        reg = (it.get("REG") or "").upper()
        if reg in {"C", "M", "K", "N", "J", "G"}:
            reject("CZ", "cancelled")
            continue
        if reg not in {"R", "B"}:
            reject("CZ", "not_authorised")
            continue
        accept_prod("CZ")
        kod = it.get("KOD_SUKL") or ""
        parts = inn_by.get(kod, [])
        inn = ", ".join(x[0] for x in parts[:8])
        strength = it.get("SILA") or ", ".join(x[1] for x in parts[:4] if x[1])
        add_row(rows, "CZ", inn, it.get("NAZEV") or "", it.get("FORMA") or "", strength, orgs.get(it.get("DRZ") or "", ""), kod)
        n += 1
    log(f"parse CZ {n}")


def parse_ro(rows):
    ro = RAW / "RO" / "nomenclator.xlsx"
    n = 0
    header = []
    for vals in xlsx_rows(ro) or []:
        if not header:
            header = [x.lower().strip() for x in vals]
            continue
        rec = {header[i] if i < len(header) else f"c{i}": vals[i] if i < len(vals) else "" for i in range(len(header))}
        inn = rec.get("dci") or ""
        name = rec.get("denumire comerciala") or ""
        form = rec.get("forma farmaceutica") or ""
        strength = rec.get("concentratie") or ""
        company = rec.get("firma / tara detinatoare app") or rec.get("firma / tara producatoare app") or ""
        extra = rec.get("cod cim") or ""
        accept_prod("RO")
        add_row(rows, "RO", inn, name, form, strength, company, extra)
        n += 1
    log(f"parse RO {n}")


def parse_lv(rows):
    p = RAW / "LV" / "HumanProducts.json"
    if not p.exists() or p.stat().st_size < 100:
        z = RAW / "LV" / "registry.json.zip"
        if z.exists() and zipfile.is_zipfile(z):
            with zipfile.ZipFile(z) as zz:
                p.write_bytes(zz.read("HumanProducts.json"))
        else:
            return
    items = json.loads(p.read_bytes().lstrip(b"\xef\xbb\xbf"))
    n = 0
    for it in items:
        if str(it.get("prd_removed") or "0") not in {"0", ""}:
            reject("LV", "removed")
            continue
        if str(it.get("status") or "") != "1":
            reject("LV", "not_authorised")
            continue
        stop = parse_dot_date(str(it.get("sell_stop_date") or ""))
        if stop and stop < TODAY:
            reject("LV", "sell_stopped")
            continue
        accept_prod("LV")
        add_row(
            rows,
            "LV",
            it.get("active_substance") or "",
            it.get("original_name") or it.get("medicine_name") or "",
            it.get("pharmaceutical_form") or "",
            it.get("strength") or "",
            it.get("marketing_authorisation_holder") or it.get("manufacturer") or "",
            it.get("authorisation_no") or "",
        )
        n += 1
    log(f"parse LV {n}")


def parse_lu(rows):
    p = RAW / "LU" / "liste-des-medicaments.xlsx"
    n = 0
    header = []
    for vals in xlsx_rows(p) or []:
        joined = " ".join(vals).lower()
        if not header:
            if "dénomination" in joined or "denomination" in joined:
                header = [x.lower().strip() for x in vals]
            continue
        rec = {header[i] if i < len(header) else f"c{i}": vals[i] if i < len(vals) else "" for i in range(len(header))}
        etat = (rec.get("etat") or rec.get("état") or "").strip()
        if etat == "23":
            reject("LU", "withdrawn")
            continue
        accept_prod("LU")
        name = rec.get("dénomination") or rec.get("denomination") or ""
        strength = rec.get("dosage") or ""
        form = rec.get("forme pharmaceutique") or ""
        inn = rec.get("atc libellé") or rec.get("atc libelle") or ""
        company = rec.get("nom titulaire") or ""
        add_row(rows, "LU", inn, name, form, strength, company, rec.get("nro amm") or "")
        n += 1
    log(f"parse LU {n}")


def parse_es(rows):
    cima = RAW / "ES" / "cima_all.json"
    if not cima.exists() or cima.stat().st_size < 80:
        fetch_cima()
    cima = RAW / "ES" / "cima_all.json"
    if cima.exists() and cima.stat().st_size >= 80:
        parse_es_cima(rows)
        return
    p = RAW / "ES" / "Medicamentos.xls"
    n = 0
    header = []
    for vals in xlsx_rows(p, "sheet1") or []:
        if not header:
            header = [x.lower().strip() for x in vals]
            continue
        rec = {header[i] if i < len(header) else f"c{i}": vals[i] if i < len(vals) else "" for i in range(len(header))}
        estado = (rec.get("estado") or "").strip()
        mkt = (rec.get("¿comercializado?") or rec.get("comercializado?") or "").strip().upper()
        if estado == "Anulado":
            reject("ES", "cancelled")
            continue
        if estado == "Suspenso":
            reject("ES", "suspended")
            continue
        if estado != "Autorizado":
            reject("ES", "not_authorised")
            continue
        if mkt != "SI":
            reject("ES", "not_marketed")
            continue
        accept_prod("ES")
        add_row(
            rows,
            "ES",
            rec.get("principios activos") or "",
            rec.get("medicamento") or "",
            "",
            "",
            rec.get("laboratorio") or "",
            rec.get("nº registro") or rec.get("no registro") or "",
        )
        n += 1
    log(f"parse ES {n}")


def fetch_cima() -> None:
    dest_all = RAW / "ES" / "cima_all.json"
    dest_all.parent.mkdir(parents=True, exist_ok=True)
    ua = {"User-Agent": "Mozilla/5.0 (SRA medicine lookup)"}
    ctx = ssl.create_default_context()
    items = []
    page = 1
    pages = None
    while page <= 400:
        dest = RAW / "ES" / f"cima_{page:03d}.json"
        payload = None
        if dest.exists() and dest.stat().st_size > 80:
            try:
                payload = json.loads(dest.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                payload = None
        if payload is None:
            url = f"https://cima.aemps.es/cima/rest/medicamentos?pagina={page}"
            try:
                with urlopen(Request(url, headers=ua), timeout=40, context=ctx) as r:
                    blob = r.read()
            except Exception as e:
                log(f"FAIL CIMA p{page}: {e}")
                break
            dest.write_bytes(blob)
            try:
                payload = json.loads(blob.decode("utf-8", "replace"))
            except json.JSONDecodeError:
                log(f"FAIL CIMA p{page}: not json")
                break
        batch = payload.get("resultados") or []
        if not batch:
            break
        items.extend(batch)
        total = int(payload.get("totalFilas") or 0)
        size = int(payload.get("tamanioPagina") or len(batch) or 200)
        if total and size:
            pages = (total + size - 1) // size
        if pages and page >= pages:
            break
        page += 1
        if page % 20 == 0:
            log(f"CIMA page {page}/{pages or '?'} items={len(items)}")
    dest_all.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    log(f"OK   CIMA {len(items)} rows, pages={page}")


def parse_es_cima(rows):
    p = RAW / "ES" / "cima_all.json"
    try:
        cima = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        log(f"parse ES CIMA fail {e}")
        return
    n = 0
    for it in cima:
        if not isinstance(it, dict):
            continue
        if it.get("comerc") is False:
            reject("ES", "not_marketed")
            continue
        vtm = it.get("vtm")
        inn = it.get("pactivos") or ""
        if not inn and isinstance(vtm, dict):
            inn = vtm.get("nombre") or ""
        elif not inn and isinstance(vtm, str):
            inn = vtm
        form = it.get("formaFarmaceutica")
        if isinstance(form, dict):
            form = form.get("nombre") or ""
        company = it.get("labtitular") or it.get("labcomercializador") or ""
        name = it.get("nombre") or ""
        if not inn and not name:
            continue
        accept_prod("ES")
        add_row(rows, "ES", str(inn), name, str(form or ""), it.get("dosis") or "", str(company), str(it.get("nregistro") or ""))
        n += 1
    log(f"parse ES CIMA {n}")


def parse_ch_swiss(rows, path: Path):
    header = None
    n = 0
    for vals in xlsx_rows(path) or []:
        joined = " ".join((v or "").lower() for v in vals)
        if header is None:
            if "zulassungs" in joined and "wirkstoff" in joined:
                header = [(h or "").strip() for h in vals]
            continue
        hl = [(h or "").lower() for h in header]

        def hg(*needles):
            for needle in needles:
                nlow = needle.lower()
                for i, h in enumerate(hl):
                    if nlow in h:
                        return vals[i] if i < len(vals) else ""
            return ""

        status = (hg("zulassungsstatus", "statut d'autorisation") or "").lower()
        if status and "zugelassen" not in status and "autorise" not in status:
            reject("CH", "not_authorised")
            continue
        name = hg("bezeichnung", "dénomination", "denomination")
        inn = hg("wirkstoff", "principe")
        company = hg("zulassungsinhaber", "inhaberin", "titulaire")
        extra = hg("zulassungs-\nnummer", "zulassungsnummer", "n° d'autorisation")
        strength = strength_from(name) or strength_from(hg("zusammensetzung", "composition"))
        if not name and not inn:
            continue
        accept_prod("CH")
        add_row(rows, "CH", inn, name, "", strength, company, extra)
        n += 1
    log(f"parse CH swiss {n}")


def parse_ch(rows):
    swiss = pick_file(RAW / "CH", "swiss.xlsx")
    if not swiss:
        from _parse_add import find_add

        src = find_add("swiss")
        if src:
            RAW.joinpath("CH").mkdir(parents=True, exist_ok=True)
            dest = RAW / "CH" / "swiss.xlsx"
            if not dest.exists() or dest.stat().st_size < src.stat().st_size:
                import shutil

                shutil.copy2(src, dest)
            swiss = dest
    if swiss:
        parse_ch_swiss(rows, swiss)
        return
    chz = RAW / "CH" / "OGD.zip"
    if not chz.exists() or not zipfile.is_zipfile(chz):
        return
    names_map, stoff, inns, firms = {}, {}, {}, {}
    with zipfile.ZipFile(chz) as z:
        root = ET.fromstring(z.read("OGD-Adressen.XML"))
        for el in list(root):
            d = {local(c.tag): (c.text or "") for c in list(el)}
            nr = d.get("PARTNER_NR") or ""
            if nr:
                firms[nr] = d.get("FIRMENNAME") or ""
        root = ET.fromstring(z.read("OGD-Praeparate.XML"))
        for el in list(root):
            d = {local(c.tag): (c.text or "") for c in list(el)}
            zn = d.get("ZULASSUNGSNUMMER")
            if zn:
                names_map[zn] = d
        for event, el in ET.iterparse(io.BytesIO(z.read("OGD-Stoff-Synonyme.XML")), events=("end",)):
            if local(el.tag) != "SYNONYME":
                continue
            d = {local(c.tag): (c.text or "") for c in list(el)}
            sid = d.get("STOFF_ID")
            syn = d.get("STOFFSYNONYM") or ""
            quelle = (d.get("QUELLE") or "").upper()
            if not sid or not syn:
                el.clear()
                continue
            cur = stoff.get(sid)
            if quelle == "DCI" or cur is None:
                stoff[sid] = syn
            el.clear()
        for event, el in ET.iterparse(io.BytesIO(z.read("OGD-Deklarationen.XML")), events=("end",)):
            if local(el.tag) != "DEKLARATION":
                continue
            d = {local(c.tag): (c.text or "") for c in list(el)}
            if (d.get("STOFFKATEGORIE") or "") != "WIRKS":
                el.clear()
                continue
            zn = d.get("ZULASSUNGSNUMMER") or ""
            inn = stoff.get(d.get("STOFF_ID") or "", "")
            if inn:
                inns.setdefault(zn, [])
                if inn not in inns[zn]:
                    inns[zn].append(inn)
            el.clear()
        n = 0
        for zn, info in names_map.items():
            if (info.get("VERWENDUNG") or "HAM") not in {"HAM", ""}:
                reject("CH", "not_human")
                continue
            if (info.get("ZULASSUNGSSTATUS") or "") != "Z":
                reject("CH", "not_authorised")
                continue
            accept_prod("CH")
            inn = ", ".join(inns.get(zn, [])[:8])
            add_row(
                rows,
                "CH",
                inn,
                info.get("PRAEPARATENAME") or "",
                info.get("ARZNEIFORM") or "",
                "",
                firms.get(info.get("ZULASSUNGSINHABERIN") or "", ""),
                zn,
            )
            n += 1
    log(f"parse CH {n}")


def parse_is(rows):
    p = RAW / "IS" / "medicine.json"
    if not p.exists() or p.stat().st_size < 1000:
        return
    try:
        payload = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        log("parse IS skip (not JSON)")
        return
    items = payload.get("medicines") if isinstance(payload, dict) else payload
    n = 0
    for it in items or []:
        if it.get("withdrawalDate"):
            reject("IS", "withdrawn")
            continue
        accept_prod("IS")
        strength = ""
        if it.get("strengthNumber") not in (None, ""):
            strength = f"{it.get('strengthNumber')} {it.get('strengthUnit') or ''}".strip()
        add_row(
            rows,
            "IS",
            it.get("activeIngredient") or "",
            it.get("medicineName") or "",
            it.get("form") or "",
            strength,
            it.get("marketingAuthorizationHolder") or "",
            it.get("nordicNumber") or "",
        )
        n += 1
    log(f"parse IS {n}")


def parse_fi(rows):
    p = RAW / "FI" / "Perusrekisteri.xml"
    if not p.exists() or p.stat().st_size < 10000:
        return
    marketed = set()
    inn_of = {}
    subst = {}
    products = {}
    for event, el in ET.iterparse(p, events=("end",)):
        tag = local(el.tag)
        if tag == "Pakkaus":
            pref = el.get("Laakevalmiste-ref") or ""
            kaupan = "0"
            sref = ""
            for c in list(el):
                t = local(c.tag)
                if t == "Kaupanolo":
                    for k in list(c):
                        if local(k.tag) == "Kaupan":
                            kaupan = (k.text or "0").strip()
                elif t == "Pakkaus_Laakeaine":
                    sref = c.get("Laakeaine-ref") or sref
            if kaupan == "1" and pref:
                marketed.add(pref)
            if pref and sref:
                inn_of.setdefault(pref, []).append(sref)
            el.clear()
        elif tag == "Laakeaine":
            sid = el.get("id") or ""
            names = [c.get("value") or "" for c in el.iter() if local(c.tag) == "Aine" and c.get("value")]
            if sid:
                subst[sid] = ", ".join(names)
            el.clear()
        elif tag == "Laakevalmiste":
            pid = el.get("id") or ""
            hum = name = form = strength = company = tila = ""
            for c in list(el):
                t = local(c.tag)
                if t == "Kauppanimi":
                    name = c.text or ""
                elif t == "Vahvuus":
                    strength = c.text or ""
                elif t == "Laakemuoto":
                    form = c.get("value") or c.text or ""
                elif t == "HUM":
                    hum = (c.text or "").strip()
                elif t == "Myyntilupa":
                    for k in list(c):
                        kt = local(k.tag)
                        if kt == "Haltija":
                            company = k.text or ""
                        elif kt == "Tila":
                            tila = (k.get("value") or k.text or "").lower()
            products[pid] = (hum, name, form, strength, company, tila)
            el.clear()
    n = 0
    for pid, (hum, name, form, strength, company, tila) in products.items():
        if hum != "1":
            reject("FI", "not_human")
            continue
        if any(x in tila for x in ("peruuntunut", "peruutettu", "rauennyt", "cancelled", "withdrawn")):
            reject("FI", "not_authorised")
            continue
        if pid not in marketed:
            reject("FI", "not_marketed")
            continue
        accept_prod("FI")
        inns = []
        for sid in inn_of.get(pid, []):
            inn = subst.get(sid)
            if inn and inn not in inns:
                inns.append(inn)
        add_row(rows, "FI", ", ".join(inns[:8]), name, form, strength, company, pid)
        n += 1
    log(f"parse FI {n}")


def sniff_csv(text):
    first = next((ln for ln in text.splitlines() if ln.strip()), "")
    if first.count(";") >= first.count(",") and first.count(";") > 0:
        dialect = csv.excel()
        dialect.delimiter = ";"
        return dialect
    try:
        return csv.Sniffer().sniff(text[:4000], delimiters=";,|\t")
    except csv.Error:
        return csv.excel


def gdict(it, *cands):
    keys = {k.lower(): k for k in it.keys() if k}
    for c in cands:
        for k, orig in keys.items():
            if c.lower() in k:
                return it.get(orig) or ""
    return ""


def pick_file(folder: Path, *names: str) -> Path | None:
    if not folder.exists():
        return None
    for name in names:
        p = folder / name
        if p.exists() and p.stat().st_size > 200:
            return p
    return None


def read_csv_rows(path: Path):
    text = path.read_bytes().decode("utf-8-sig", "replace")
    if "<html" in text[:180].lower():
        log(f"skip {path.name} (html not csv)")
        return
    yield from csv.DictReader(io.StringIO(text), dialect=sniff_csv(text))


def parse_dot_dmy(s: str) -> datetime | None:
    s = (s or "").strip()
    m = re.match(r"(\d{1,2})[./-](\d{1,2})[./-](\d{4})", s)
    if not m:
        return None
    try:
        return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    except ValueError:
        return None


STRENGTH_RE = re.compile(
    r"(\d[\d.,]*(?:\s*[-–/]\s*\d[\d.,]*)*\s*"
    r"(?:milligrammes?|microgrammes?|m(?:illi)?grams?|m(?:icro)?grams?|mikrogramm?(?:es?)?|"
    r"mg|mcg|µg|ug|μg|g|ml|i\.?u\.?|ie|ui|units?|mmol|meq|mbq|gbq|bq|%)\b"
    r"(?:\s*/\s*\d*[\d.,]*\s*(?:ml|g|h|kg|24\s*h|h))*)",
    re.I,
)


def strength_from(text: str) -> str:
    s = text or ""
    best = ""
    for m in STRENGTH_RE.finditer(s):
        bit = clean(m.group(1), 80)
        if re.fullmatch(r"\d{4}", bit):
            continue
        if len(bit) > len(best):
            best = bit
    return best


def parse_at(rows):
    p = pick_file(RAW / "AT", "medicinal-products.csv")
    if not p:
        return
    n = 0
    for it in read_csv_rows(p) or []:
        use = (it.get("Verwendung") or "").lower()
        if "veterin" in use or (use and "human" not in use):
            reject("AT", "not_human")
            continue
        stopped = (it.get("Einstellung des In-Verkehr-Bringens gemeldet") or "").strip().lower()
        if stopped in {"ja", "yes", "true", "1"}:
            reject("AT", "not_marketed")
            continue
        inn = it.get("Wirkstoff(e)") or ""
        name = it.get("Bezeichnung") or it.get("Name") or ""
        form = it.get("Darreichungsform") or ""
        st = " ".join(x for x in [(it.get("Stärke") or "").strip(), (it.get("Einheit Stärke") or "").strip()] if x)
        company = (it.get("Inhaber:in") or "").split(",")[0]
        accept_prod("AT")
        add_row(rows, "AT", inn, name, form, st or strength_from(name), company, it.get("Zulassungsnummer") or "")
        n += 1
    log(f"parse AT {n}")


def parse_ee(rows):
    p = pick_file(RAW / "EE", "hum_medProducts.csv", "pakendid.csv", "ravimid.csv")
    if not p:
        return
    n = 0
    for it in read_csv_rows(p) or []:
        species = (gdict(it, "animal species", "loomaliik") or "").strip()
        if species and species.lower() not in {"no", "nei", "-", "0"}:
            reject("EE", "not_human")
            continue
        exp = parse_dot_dmy(gdict(it, "expires", "kehtiv"))
        if exp and exp < TODAY:
            reject("EE", "not_authorised")
            continue
        inn = gdict(it, "name of active substance", "toimeaine", "inn", "active")
        name = gdict(it, "name") or gdict(it, "nimetus", "nimi", "ravim")
        form = gdict(it, "dosage form", "ravimvorm", "form")
        strength = gdict(it, "strength of active substance", "toimeaine_sisaldus", "tugevus", "strength")
        company = gdict(it, "marketing autorization holder", "marketing authorization holder", "myygiloahoidja", "holder", "company")
        extra = gdict(it, "marketing authorization number", "pakendi_kood", "kood")
        accept_prod("EE")
        add_row(rows, "EE", inn, name, form, strength, company, extra)
        n += 1
    log(f"parse EE {p.name} {n}")


def parse_be(rows):
    folder = RAW / "BE"
    if not folder.exists():
        return
    files = [
        p
        for p in folder.glob("*.csv")
        if "document" not in p.name.lower()
        and "taille" not in p.name.lower()
        and "conditionnement" not in p.name.lower()
        and "numéro" not in p.name.lower()
        and "numero" not in p.name.lower()
    ]
    if not files:
        files = [p for p in folder.glob("*.csv") if "document" not in p.name.lower()]
    if not files:
        return
    p = max(files, key=lambda x: x.stat().st_size)
    n = 0
    for it in read_csv_rows(p) or []:
        usage = (gdict(it, "usage") or "").lower()
        if usage and "humain" not in usage and "human" not in usage:
            reject("BE", "not_human")
            continue
        sold = (gdict(it, "commercialisé", "commercialise") or "").strip().lower()
        if sold in {"non", "no", "n"}:
            reject("BE", "not_marketed")
            continue
        inn = gdict(it, "substance active", "active")
        name = gdict(it, "nom")
        form = gdict(it, "forme pharmaceutique", "forme")
        company = gdict(it, "firme")
        accept_prod("BE")
        add_row(rows, "BE", inn, name, form, strength_from(inn) or strength_from(name), company)
        n += 1
    log(f"parse BE {p.name} {n}")


def parse_it(rows):
    p = pick_file(RAW / "IT", "confezioni_fornitura.csv")
    if not p:
        return
    n = 0
    seen = set()
    for it in read_csv_rows(p) or []:
        stato = (it.get("STATO_AMMINISTRATIVO") or "").strip().lower()
        if stato and stato not in {"autorizzata", "autorizzato"}:
            reject("IT", "not_authorised")
            continue
        code = (it.get("COD_FARMACO") or it.get("CODICE_AIC") or "").strip()
        inn = it.get("PA_ASSOCIATI") or ""
        name = it.get("DENOMINAZIONE") or ""
        form = it.get("FORMA") or ""
        company = it.get("RAGIONE_SOCIALE") or ""
        key = (code, inn.lower(), name.lower(), form.lower(), company.lower())
        if key in seen:
            continue
        seen.add(key)
        accept_prod("IT")
        add_row(rows, "IT", inn, name, form, strength_from(name) or strength_from(it.get("DESCRIZIONE") or ""), company, code)
        n += 1
    log(f"parse IT {n}")


def parse_no(rows):
    folder = RAW / "NO"
    p = pick_file(folder / "fest251", "fest251.xml") or pick_file(folder, "fest251.xml")
    if not p:
        zips = list(folder.glob("*.xml")) + list(folder.rglob("fest*.xml"))
        p = next((x for x in zips if x.stat().st_size > 10000), None)
    if not p:
        return
    n = 0
    for event, el in ET.iterparse(p, events=("end",)):
        tag = local(el.tag)
        if tag == "OppfLegemiddelMerkevare":
            status = ""
            inn = name = form = nfs = company = extra = ptype = ""
            for c in list(el):
                t = local(c.tag)
                if t == "Id" and not extra:
                    extra = (c.text or "").strip()
                elif t == "Status":
                    status = (c.get("V") or "").strip().upper()
                elif t == "LegemiddelMerkevare":
                    for k in list(c):
                        kt = local(k.tag)
                        if kt == "Atc":
                            inn = k.get("DN") or inn
                        elif kt == "Varenavn":
                            name = k.text or name
                        elif kt == "NavnFormStyrke":
                            nfs = k.text or ""
                        elif kt == "LegemiddelformLang":
                            form = k.text or form
                        elif kt == "LegemiddelformKort" and not form:
                            form = k.get("DN") or form
                        elif kt == "Preparattype":
                            ptype = k.get("V") or ""
                        elif kt == "ProduktInfo":
                            for pi in list(k):
                                if local(pi.tag) == "Produsent":
                                    company = pi.text or company
            if status != "A":
                reject("NO", "not_authorised")
            elif ptype and ptype != "7":
                reject("NO", "not_human")
            else:
                accept_prod("NO")
                add_row(rows, "NO", inn, name or nfs, form, strength_from(nfs), company, extra)
                n += 1
            el.clear()
        if tag == "KatLegemiddelMerkevare":
            el.clear()
            break
    log(f"parse NO {n}")


def xlsx_cell_text(c) -> str:
    t = c.get("t")
    if t == "inlineStr":
        return "".join(x.text or "" for x in c.iter() if local(x.tag) == "t")
    v = None
    for child in list(c):
        if local(child.tag) == "v":
            v = child.text or ""
            break
    return v or ""


def parse_au(rows):
    folder = RAW / "AU"
    files = list(folder.glob("*.xlsx"))
    if not files:
        return
    p = max(files, key=lambda x: x.stat().st_size)
    if p.stat().st_size < 1000 or not zipfile.is_zipfile(p):
        return
    n = 0
    qty_re = re.compile(r"(?:Quantity|Qty):\s*([\d.,]+\s*[A-Za-zµμ/%]+)", re.I)
    form_re = re.compile(
        r"\b(tablets?|capsules?|injections?|gel|cream|ointment|syrup|suspension|solution|inhalation|ampoules?|vials?|patch(?:es)?|suppositories?|spray|drops?|powder|film-coated|chewable|lozenges?)\b",
        re.I,
    )
    with zipfile.ZipFile(p) as z:
        sheet = next(n for n in z.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml"))
        header = None
        with z.open(sheet) as fh:
            for event, el in ET.iterparse(fh, events=("end",)):
                if local(el.tag) != "row":
                    continue
                vals = []
                for c in list(el):
                    if local(c.tag) == "c":
                        vals.append(xlsx_cell_text(c).strip())
                el.clear()
                if not any(vals):
                    continue
                if header is None:
                    header = [h.lower() for h in vals]
                    continue
                def col(*cands):
                    for cand in cands:
                        for i, h in enumerate(header):
                            if cand in h:
                                return vals[i] if i < len(vals) else ""
                    return ""
                device = col("manufacturer name (devices)", "manufacturer")
                if device and device.lower() not in {"not applicable", "n/a", "-", ""}:
                    reject("AU", "not_human")
                    continue
                name = col("product name", "name")
                inn_raw = col("active ingredients", "active")
                company = col("sponsor name", "sponsor")
                extra = col("artg id", "artg")
                if not inn_raw and not name:
                    reject("AU", "not_human")
                    continue
                inn = ""
                strength = ""
                eq = re.search(
                    r"Equivalent:\s*([^,()]+?)(?:,\s*Qty\s+([^)]+))?\s*\)",
                    inn_raw or "",
                    re.I,
                )
                if eq:
                    inn = (eq.group(1) or "").strip()
                    strength = (eq.group(2) or "").strip()
                if not inn:
                    inn = (inn_raw or "").split(",")[0]
                    inn = re.sub(r"\s*Quantity:.*", "", inn, flags=re.I).strip()
                if len(inn) < 3:
                    bits = re.findall(r"[A-Za-z][A-Za-z][A-Za-z0-9\-']+", inn_raw or name or "")
                    skip = {"quantity", "qty", "equivalent", "as", "the", "and", "with", "blister", "pack", "tablet", "tablets", "capsule", "injection"}
                    inn = next((b for b in bits if b.lower() not in skip), inn)
                if not strength:
                    qm = re.search(r"Equivalent:[^)]*?Qty\s+([\d.,]+\s*[A-Za-zµμ/%]+)", inn_raw or "", re.I)
                    if not qm:
                        qm = qty_re.search(inn_raw or "")
                    if qm:
                        strength = qm.group(1).strip()
                if not strength:
                    sm = re.search(r"(\d[\d.,]*\s*(?:mg|mcg|g|ml|µg|iu)\b)", name or "", re.I)
                    if sm:
                        strength = sm.group(1)
                fm = form_re.search(name or "")
                form = fm.group(1) if fm else ""
                accept_prod("AU")
                add_row(rows, "AU", inn, name, form, strength, company, extra)
                n += 1
    log(f"parse AU {p.name} {n}")


def parse_sk(rows):
    from _parse_add import parse_sk_sidc

    parse_sk_sidc(rows)


def file_fresh(path: Path | None) -> str:
    if not path or not path.exists():
        return "none"
    age = (datetime.now(timezone.utc) - datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)).days
    if age <= 180:
        return "updated"
    return "aging"


def completeness(rows):
    by = {}
    for r in rows:
        cc = r["country"]
        d = by.setdefault(cc, {"n": 0, "inn": 0, "form": 0, "strength": 0, "company": 0, "full": 0, "lean": 0})
        d["n"] += 1
        has = [bool(r["inn"]), bool(r["form"]), bool(r["strength"]), bool(r["company"])]
        d["inn"] += int(has[0])
        d["form"] += int(has[1])
        d["strength"] += int(has[2])
        d["company"] += int(has[3])
        score = sum(has)
        if score == 4:
            d["full"] += 1
        elif score <= 1:
            d["lean"] += 1
    return by


def build_health(rows):
    by = completeness(rows)
    kept = Counter(r["country"] for r in rows)
    dump_files = {
        "FR": RAW / "FR" / "CIS_bdpm.txt",
        "ES": pick_file(RAW / "ES", "cima_all.json") or RAW / "ES" / "Medicamentos.xls",
        "CA": RAW / "CA" / "allfiles.zip",
        "US": RAW / "US" / "drugsfda.zip",
        "IE": RAW / "IE" / "latestHumanlist.xml",
        "CZ": RAW / "CZ" / "dlp_lecivepripravky.csv",
        "RO": RAW / "RO" / "nomenclator.xlsx",
        "LV": RAW / "LV" / "HumanProducts.json",
        "LU": RAW / "LU" / "liste-des-medicaments.xlsx",
        "CH": pick_file(RAW / "CH", "swiss.xlsx") or RAW / "CH" / "OGD.zip",
        "FI": RAW / "FI" / "Perusrekisteri.xml",
        "IS": RAW / "IS" / "medicine.json",
        "AT": RAW / "AT" / "medicinal-products.csv",
        "EE": pick_file(RAW / "EE", "hum_medProducts.csv", "pakendid.csv") or RAW / "EE" / "hum_medProducts.csv",
        "BE": next(iter((RAW / "BE").glob("Export*humain-20*.csv")), RAW / "BE"),
        "IT": RAW / "IT" / "confezioni_fornitura.csv",
        "NO": pick_file(RAW / "NO" / "fest251", "fest251.xml") or RAW / "NO" / "fest251.xml",
        "AU": next(iter(sorted((RAW / "AU").glob("*.xlsx"), key=lambda x: x.stat().st_size, reverse=True)), RAW / "AU"),
        "BG": next(iter(sorted((RAW / "BG").glob("IAL*.xlsx"), key=lambda x: x.stat().st_size, reverse=True)), RAW / "BG"),
        "HR": RAW / "HR" / "halmed.xlsx",
        "PT": RAW / "PT" / "infomed.xlsx",
        "NL": RAW / "NL" / "cbg.csv",
        "LT": RAW / "LT" / "preparatas.csv",
        "MT": RAW / "MT" / "medicines.csv",
        "PL": RAW / "PL" / "rpl.xlsx",
        "SI": RAW / "SI" / "cbz.csv",
        "SK": pick_file(RAW / "SK", "lieky_all.json", "p00000.json", "lieky_00000.json") or RAW / "SK" / "lieky_all.json",
        "GB": next(iter((RAW / "add" / "Anh").rglob("f_amp2_*.xml")), RAW / "GB"),
        "JP": RAW / "JP" / "pmda-approved.pdf",
        "DE": RAW / "EMA" / "article57.xlsx",
        "DK": pick_file(RAW / "DK", "dkma.xlsx") or RAW / "EMA" / "article57.xlsx",
        "CY": pick_file(RAW / "CY", "cyprus.xlsx") or RAW / "EMA" / "article57.xlsx",
        "GR": pick_file(RAW / "GR", "eof.xlsx", "eof_price.xlsx") or RAW / "GR" / "eof.xlsx",
        "HU": pick_file(RAW / "HU", "tk_lista.csv", "ogyi.csv") or RAW / "HU" / "tk_lista.csv",
        "SE": pick_file(RAW / "SE", "lakemedel.xlsx", "produktdokument.xml") or RAW / "SE" / "produktdokument.xml",
        "LI": RAW / "EMA" / "article57.xlsx",
        "EMA": next(iter((RAW / "BG").glob("Centrally*.xlsx")), RAW / "EMA" / "medicines.json"),
    }
    names = dict(SRA36)
    names["EMA"] = "EMA"
    sources = []
    have_national = []
    missing = []
    for cc, name in SRA36:
        n = int(kept.get(cc, 0))
        kind = "national_official" if n else "no_local_dump"
        if n:
            have_national.append(cc)
        else:
            missing.append(cc)
        c = by.get(cc, {"n": 0, "inn": 0, "form": 0, "strength": 0, "company": 0, "full": 0, "lean": 0})
        nn = c["n"] or 1
        sources.append(
            {
                "cc": cc,
                "name": name,
                "kind": kind,
                "fresh": file_fresh(dump_files.get(cc)),
                "rows": n,
                "full": c["full"],
                "lean": c["lean"],
                "pct": {
                    "inn": round(100 * c["inn"] / nn) if c["n"] else 0,
                    "form": round(100 * c["form"] / nn) if c["n"] else 0,
                    "strength": round(100 * c["strength"] / nn) if c["n"] else 0,
                    "company": round(100 * c["company"] / nn) if c["n"] else 0,
                },
                "drop": dict(FUNNEL["drop"].get(cc, {})),
                "raw": int(FUNNEL["raw"].get(cc, 0)),
            }
        )
    ema_c = by.get("EMA", {"n": 0, "inn": 0, "form": 0, "strength": 0, "company": 0, "full": 0, "lean": 0})
    ema_n = ema_c["n"] or 1
    sources.append(
        {
            "cc": "EMA",
            "name": "EMA",
            "kind": "ema_central",
            "fresh": file_fresh(dump_files["EMA"]),
            "rows": int(kept.get("EMA", 0)),
            "full": ema_c["full"],
            "lean": ema_c["lean"],
            "pct": {
                "inn": round(100 * ema_c["inn"] / ema_n) if ema_c["n"] else 0,
                "form": round(100 * ema_c["form"] / ema_n) if ema_c["n"] else 0,
                "strength": round(100 * ema_c["strength"] / ema_n) if ema_c["n"] else 0,
                "company": round(100 * ema_c["company"] / ema_n) if ema_c["n"] else 0,
            },
            "drop": dict(FUNNEL["drop"].get("EMA", {})),
            "raw": int(FUNNEL["raw"].get("EMA", 0)),
        }
    )
    drop_total = sum(sum(v.values()) for v in FUNNEL["drop"].values())
    raw_total = sum(FUNNEL["raw"].values())
    reasons = Counter()
    for v in FUNNEL["drop"].values():
        reasons.update(v)
    return {
        "updated": time.strftime("%Y-%m-%d"),
        "funnel": {
            "raw": raw_total,
            "dropped": drop_total,
            "kept_prod": int(sum(FUNNEL["kept_prod"].values())),
            "search_rows": len(rows),
        },
        "drop_reasons": dict(reasons),
        "have_national": have_national,
        "missing": missing,
        "ema_rows": int(kept.get("EMA", 0)),
        "sources": sources,
        "taxonomy": {
            "national_official": "Dump gốc từ cơ quan quốc gia (NCA)",
            "ema_central": "Danh mục EMA — thuốc duyệt tập trung EU, không thay CSDL 36 nước",
            "no_local_dump": "Chưa có dump chính thức — tra trên web, tạm dùng EMA nếu là thuốc centralised",
            "updated": "File dump lấy trong 180 ngày",
            "aging": "File dump cũ hơn 180 ngày",
            "full": "Đủ 4 trường: hoạt chất + dạng + hàm lượng + công ty",
            "lean": "Thiếu ≥3 trong 4 trường (hoạt chất / dạng / hàm lượng / công ty)",
            "filter": "Chỉ giữ thuốc đang lưu hành (authorised + marketed). Bỏ cancelled / anulado / withdrawn / discontinued / not marketed.",
        },
    }


def dedupe(rows):
    seen, out = set(), []
    for r in rows:
        key = (r["country"], r["inn"].lower(), r["name"].lower(), r["form"].lower(), r["strength"].lower(), r["company"].lower(), r.get("src") or "d")
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def write_outputs(rows):
    rows = dedupe(rows)
    health = build_health(rows)
    csv_path = OUT / "SRA_thuoc_gop.csv"
    fields = ["country", "inn", "name", "form", "strength", "company", "extra", "src"]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    sites = company_sites(rows)
    compact = {
        "v": 2,
        "updated": time.strftime("%Y-%m-%d"),
        "count": len(rows),
        "r": [[r["country"], r["inn"], r["name"], r["form"], r["strength"], r["company"], r.get("src") or "d"] for r in rows],
        "h": health,
        "c": sites,
    }
    js_path = OUT / "search.json"
    js_path.write_text(json.dumps(compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    by = Counter(r["country"] for r in rows)
    (OUT / "summary.json").write_text(
        json.dumps({"count": len(rows), "by_country": dict(by), "health": health}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    miss = Counter(r["company"] for r in rows if r.get("company") and r["company"] not in sites)
    log(f"WROTE {len(rows)} rows csv={csv_path.stat().st_size:,} json={js_path.stat().st_size:,}")
    log("by: " + ", ".join(f"{k}:{v}" for k, v in sorted(by.items())))
    log("dropped: " + ", ".join(f"{k}:{sum(v.values())}" for k, v in sorted(FUNNEL["drop"].items())))
    log(f"sites {len(sites)} unmatched {len(miss)}")
    log("unmatched top: " + ", ".join(f"{k}:{v}" for k, v in miss.most_common(20)).encode("ascii", "replace").decode("ascii"))


def main():
    from _parse_add import parse_added

    t0 = time.time()
    rows = []
    parse_fr(rows)
    parse_ema(rows)
    parse_ca(rows)
    parse_us(rows)
    parse_ie(rows)
    parse_cz(rows)
    parse_ro(rows)
    parse_lv(rows)
    parse_lu(rows)
    parse_es(rows)
    parse_ch(rows)
    parse_is(rows)
    parse_fi(rows)
    parse_sk(rows)
    parse_ee(rows)
    parse_at(rows)
    parse_be(rows)
    parse_it(rows)
    parse_no(rows)
    parse_au(rows)
    parse_bg(rows)
    parse_added(rows)
    write_outputs(rows)
    log(f"done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    import _parse
    _parse.main()
