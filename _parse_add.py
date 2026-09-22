# -*- coding: utf-8 -*-
"""Stage and parse supplemental national dumps from data/raw/add."""
from __future__ import annotations

import csv
import io
import json
import re
import shutil
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime
from pathlib import Path

import _parse as P

ADD = P.RAW / "add"

A57_MAP = {
    "austria": "AT",
    "belgium": "BE",
    "bulgaria": "BG",
    "croatia": "HR",
    "cyprus": "CY",
    "czech republic": "CZ",
    "czechia": "CZ",
    "denmark": "DK",
    "estonia": "EE",
    "finland": "FI",
    "france": "FR",
    "germany": "DE",
    "greece": "GR",
    "hungary": "HU",
    "iceland": "IS",
    "ireland": "IE",
    "italy": "IT",
    "latvia": "LV",
    "liechtenstein": "LI",
    "lithuania": "LT",
    "luxembourg": "LU",
    "malta": "MT",
    "netherlands": "NL",
    "the netherlands": "NL",
    "norway": "NO",
    "poland": "PL",
    "portugal": "PT",
    "romania": "RO",
    "slovakia": "SK",
    "slovenia": "SI",
    "spain": "ES",
    "sweden": "SE",
}

SI_KEEP_MARKET = {
    "zdravilo je prisotno v prometu na debelo",
    "potekajoče začasno prenehanje opravljanja prometa",
    "potekajoce zacasno prenehanje opravljanja prometa",
    "potekajoča motnja v preskrbi",
    "potekajoca motnja v preskrbi",
    "napovedano začasno prenehanje opravljanja prometa",
    "napovedana motnja v preskrbi",
}
SI_DROP_MARKET = {
    "stalno prenehanje opravljanja prometa",
    "napovedano stalno prenehanje opravljanja prometa",
}


def fold_name(s: str) -> str:
    s = (s or "").replace("đ", "d").replace("Đ", "d").replace("ð", "d")
    s = unicodedata.normalize("NFKD", s).lower()
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn")


def find_add(*needles: str) -> Path | None:
    if not ADD.exists():
        return None
    want = [fold_name(n) for n in needles]
    files = [p for p in ADD.iterdir() if p.is_file()]
    for p in files:
        key = fold_name(p.name)
        if all(n in key for n in want):
            return p
    return None


def copy_if(src: Path | None, dest: Path) -> Path | None:
    if not src or not src.exists() or src.stat().st_size < 20:
        return dest if dest.exists() and dest.stat().st_size >= 20 else None
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size >= src.stat().st_size:
        return dest
    shutil.copy2(src, dest)
    return dest


def stage_add_files() -> None:
    mapping = [
        (("croatia",), "HR", "halmed.xlsx"),
        (("bo dao nha",), "PT", "infomed.xlsx"),
        (("hungary",), "HU", "ogyi.csv"),
        (("hy lap",), "GR", "eof.xlsx"),
        (("ha lan",), "NL", "cbg.csv"),
        (("japan",), "JP", "pmda-approved.pdf"),
        (("lithuania",), "LT", "preparatas.csv"),
        (("malta",), "MT", "medicines.csv"),
        (("poland",), "PL", "rpl.xlsx"),
        (("slovenia",), "SI", "cbz.csv"),
        (("union register",), "EMA", "union_register.xlsx"),
    ]
    for needles, cc, dest_name in mapping:
        copy_if(find_add(*needles), P.RAW / cc / dest_name)
    ema = find_add("ema.xlsx")
    if ema and fold_name(ema.name) == "ema.xlsx":
        copy_if(ema, P.RAW / "EMA" / "article57.xlsx")
    elif ema and "union" not in fold_name(ema.name):
        copy_if(ema, P.RAW / "EMA" / "article57.xlsx")


def decode_best(path: Path) -> str:
    blob = path.read_bytes()
    for enc in ("utf-8-sig", "utf-8", "cp1250", "cp1252", "latin-1"):
        try:
            return blob.decode(enc)
        except UnicodeDecodeError:
            continue
    return blob.decode("utf-8", "replace")


def csv_dicts(path: Path, delimiter: str | None = None):
    text = decode_best(path)
    if "<html" in text[:180].lower():
        P.log(f"skip {path.name} (html not csv)")
        return
    dialect = P.sniff_csv(text)
    if delimiter:
        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    else:
        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    yield from reader


def col(header, vals, *cands):
    hl = [(h or "").strip().lower() for h in header]
    for cand in cands:
        c = cand.lower()
        for i, h in enumerate(hl):
            if c in h:
                return vals[i] if i < len(vals) else ""
    return ""


def xlsx_after_header(path: Path, *needles: str):
    header = None
    for vals in P.xlsx_rows(path):
        if header is None:
            joined = " ".join((v or "").lower() for v in vals)
            if all(n.lower() in joined for n in needles):
                header = [(h or "").strip() for h in vals]
            continue
        if any(str(v).strip() for v in vals):
            yield header, vals


def parse_iso_date(s: str) -> datetime | None:
    s = (s or "").strip()
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    if not m:
        return P.parse_dot_dmy(s)
    try:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def form_from(text: str) -> str:
    s = text or ""
    m = re.search(
        r"\b(film-?coated tablets?|tablets?|capsules?|syrup|solution(?: for injection| for infusion)?|"
        r"suspension|injection|infusion|cream|ointment|gel|drops|spray|granules|powder|patch|inhalation|"
        r"suppositor(?:y|ies))\b",
        s,
        re.I,
    )
    return P.clean(m.group(1), 160) if m else ""


def split_jp_brand(cell: str) -> tuple[list[str], str]:
    text = (cell or "").strip()
    if not text:
        return [], ""
    m = re.search(r"\n\((.+)\)\s*$", text)
    if m:
        company = re.sub(r"\s+", " ", m.group(1)).strip()
        names = text[: m.start()].strip()
    else:
        company = ""
        names = text
    brands = []
    for ln in names.splitlines():
        bit = re.sub(r"\s+", " ", ln).strip()
        if bit and not bit.startswith("("):
            brands.append(bit)
    return brands or ([re.sub(r"\s+", " ", names).strip()] if names else []), company


def load_sk_items(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"\[\{.*\}\]", text, re.S)
    raw = m.group(0) if m else text
    try:
        items = json.loads(raw)
    except json.JSONDecodeError:
        return []
    return items if isinstance(items, list) else []


def parse_pt(rows):
    p = P.pick_file(P.RAW / "PT", "infomed.xlsx") or find_add("bo dao nha")
    if not p:
        return
    n = 0
    for header, vals in xlsx_after_header(p, "inn", "strength"):
        status = (col(header, vals, "ma status", "status") or "").strip().lower()
        market = (col(header, vals, "marketing") or "").strip().lower()
        if status and status not in {"approved", "authorised", "authorized"}:
            P.reject("PT", "not_authorised")
            continue
        if market and market not in {"marketed", "yes"}:
            P.reject("PT", "not_marketed")
            continue
        P.accept_prod("PT")
        P.add_row(
            rows,
            "PT",
            col(header, vals, "active substance", "inn"),
            col(header, vals, "medicinal product", "name"),
            col(header, vals, "pharmaceutical", "dose form", "form"),
            col(header, vals, "strength"),
            col(header, vals, "ma holder", "holder"),
            "",
            src="d",
        )
        n += 1
    P.log(f"parse PT {n}")


def parse_hr(rows):
    p = P.pick_file(P.RAW / "HR", "halmed.xlsx") or find_add("croatia")
    if not p:
        return
    n = 0
    for header, vals in xlsx_after_header(p, "active substance", "marketing authorisation"):
        revoked = (col(header, vals, "revocation") or "").strip()
        if revoked:
            P.reject("HR", "cancelled")
            continue
        market = fold_name(col(header, vals, "marketing status"))
        if "trajni prekid" in market or "nije stavljeno" in market:
            P.reject("HR", "not_marketed")
            continue
        if market and "stavljeno u promet" not in market and "privremeni prekid" not in market:
            P.reject("HR", "unknown_market")
            continue
        inn = col(header, vals, "active substance")
        name = col(header, vals, "name")
        if name.lower() in {"name", "former name"}:
            continue
        P.accept_prod("HR")
        P.add_row(
            rows,
            "HR",
            inn,
            name,
            col(header, vals, "pharmaceutical form"),
            P.strength_from(col(header, vals, "composition") or name),
            (col(header, vals, "marketing authorisation holder") or "").split("<")[0],
            col(header, vals, "marketing authorisation number"),
            src="d",
        )
        n += 1
    P.log(f"parse HR {n}")


def parse_nl(rows):
    p = P.pick_file(P.RAW / "NL", "cbg.csv") or find_add("ha lan")
    if not p:
        return
    n = 0
    seen = set()
    for it in csv_dicts(p, delimiter="|") or []:
        soort = (it.get("SOORT") or "").strip().upper()
        if soort and not soort.startswith("RVG") and not soort.startswith("RVH"):
            P.reject("NL", "not_human")
            continue
        name = (it.get("PRODUCTNAAM") or "").strip()
        inn = (it.get("WERKZAMESTOFFEN") or "").replace("#", ", ")
        form = it.get("FARMACEUTISCHEVORM") or ""
        strength = (it.get("POTENTIE") or "").strip() or P.strength_from(name)
        company = it.get("HANDELSVERGUNNINGHOUDER") or ""
        extra = (it.get("REGISTRATIENUMMER") or "").strip()
        key = (name.lower(), inn.lower(), form.lower(), strength.lower(), company.lower())
        if key in seen:
            continue
        seen.add(key)
        P.accept_prod("NL")
        P.add_row(rows, "NL", inn, name, form, strength, company, extra, src="d")
        n += 1
    P.log(f"parse NL {n}")


def parse_lt(rows):
    p = P.pick_file(P.RAW / "LT", "preparatas.csv") or find_add("lithuania")
    if not p:
        return
    n = 0
    seen = set()
    for it in csv_dicts(p, delimiter=";") or []:
        status = fold_name(it.get("Tiekimo būsena") or it.get("Tiekimo busena") or "")
        if status == "netiekiama":
            P.reject("LT", "not_marketed")
            continue
        if status and status != "tiekiama":
            P.reject("LT", "unknown_market")
            continue
        name = it.get("Preparato (sugalvotas) pavadinimas") or ""
        inn = it.get("Veiklioji (-osios) medžiaga (-os)") or it.get("Veiklioji (-osios) medziaga (-os)") or ""
        form = it.get("Farmacinė forma") or it.get("Farmacine forma") or ""
        strength = it.get("Stiprumas") or ""
        company = it.get("Registruotojas") or ""
        extra = it.get("VID") or ""
        key = (extra, name.lower(), inn.lower(), form.lower(), strength.lower(), company.lower())
        if key in seen:
            continue
        seen.add(key)
        P.accept_prod("LT")
        P.add_row(rows, "LT", inn, name, form, strength, company, extra, src="d")
        n += 1
    P.log(f"parse LT {n}")


def parse_mt(rows):
    p = P.pick_file(P.RAW / "MT", "medicines.csv") or find_add("malta")
    if not p:
        return
    text = decode_best(p)
    reader = csv.reader(io.StringIO(text))
    try:
        header = next(reader)
    except StopIteration:
        return
    def tidy(s: str) -> str:
        return (s or "").strip().strip("'\"").strip()

    header = [re.sub(r"[\[\]]", "", tidy(h)) for h in header]
    n = 0
    for vals in reader:
        rec = {header[i]: tidy(vals[i] if i < len(vals) else "") for i in range(len(header))}
        status = (rec.get("Status") or "").lower()
        if status != "authorised":
            P.reject("MT", "not_authorised" if status else "unknown_market")
            continue
        name = rec.get("Medicine Name") or ""
        inn_raw = rec.get("Active Ingredients") or ""
        inn = re.sub(r"\s+\d[\d.,]*.*$", "", inn_raw).strip(" '")
        form = rec.get("Pharmaceutical Forms") or ""
        P.accept_prod("MT")
        P.add_row(
            rows,
            "MT",
            inn,
            name,
            form,
            P.strength_from(inn_raw) or P.strength_from(name),
            rec.get("Authorization Holder") or "",
            rec.get("Authorisation Number") or "",
            src="d",
        )
        n += 1
    P.log(f"parse MT {n}")


def parse_pl(rows):
    p = P.pick_file(P.RAW / "PL", "rpl.xlsx") or find_add("poland")
    if not p:
        return
    n = 0
    for header, vals in xlsx_after_header(p, "identyfikator"):
        kind = (col(header, vals, "rodzaj preparatu") or "").strip().lower()
        if kind and "ludzk" not in kind:
            P.reject("PL", "not_human")
            continue
        valid = col(header, vals, "ważność pozwolenia", "waznosc pozwolenia")
        dt = parse_iso_date(valid)
        if dt and dt < P.TODAY and "beztermin" not in valid.lower():
            P.reject("PL", "cancelled")
            continue
        P.accept_prod("PL")
        P.add_row(
            rows,
            "PL",
            col(header, vals, "substancja czynna", "nazwa powszechnie"),
            col(header, vals, "nazwa produktu leczniczego"),
            col(header, vals, "postać farmaceutyczna", "postac farmaceutyczna"),
            col(header, vals, "moc"),
            col(header, vals, "podmiot odpowiedzialny"),
            col(header, vals, "identyfikator produktu", "numer pozwolenia"),
            src="d",
        )
        n += 1
    P.log(f"parse PL {n}")


def parse_si(rows):
    p = P.pick_file(P.RAW / "SI", "cbz.csv") or find_add("slovenia")
    if not p:
        return
    n = 0
    seen = set()
    for it in csv_dicts(p, delimiter=";") or []:
        market = fold_name(it.get("Naziv prisotnosti na trgu") or "")
        if market in SI_DROP_MARKET or "stalno prenehanje" in market:
            P.reject("SI", "not_marketed")
            continue
        if market not in SI_KEEP_MARKET:
            P.reject("SI", "unknown_market")
            continue
        name = it.get("Ime zdravila") or it.get("Kratko poimenovanje zdravila") or ""
        inn = it.get("Aktivno zdravilo") or ""
        form = it.get("Slovenski naziv farmacevtske oblike") or ""
        qty = (it.get("Količina osnovne enote za aplikacijo") or it.get("Kolicina osnovne enote za aplikacijo") or "").strip()
        unit = (it.get("Oznaka osnovne enote za aplikacijo") or "").strip()
        strength = f"{qty} {unit}".strip() or P.strength_from(name)
        company = it.get("Naziv imetnika dovoljenja") or ""
        extra = it.get("Nacionalna šifra") or it.get("Nacionalna sifra") or it.get("Številka dovoljenja") or ""
        key = (name.lower(), inn.lower(), form.lower(), strength.lower(), company.lower())
        if key in seen:
            continue
        seen.add(key)
        P.accept_prod("SI")
        P.add_row(rows, "SI", inn, name, form, strength, company, extra, src="d")
        n += 1
    P.log(f"parse SI {n}")


def parse_sk_sidc(rows):
    folder = P.RAW / "SK"
    files = []
    for name in ("lieky_all.json", "p00000.json"):
        p = folder / name
        if p.exists() and p.stat().st_size > 20:
            files.append(p)
    if not files:
        return 0
    n = 0
    seen = set()
    for path in files:
        items = load_sk_items(path)
        if not items:
            continue
        for it in items:
            if not isinstance(it, dict):
                continue
            st = fold_name(it.get("stav_nazov_en") or it.get("stav_nazov") or "")
            if st and "valid" not in st and "bez obmedzenia" not in st and "registr" not in st:
                P.reject("SK", "not_authorised")
                continue
            name = it.get("lie_nazov") or it.get("nazov") or ""
            inn = it.get("liecivo") or ""
            form = it.get("form_nazov_en") or it.get("form_nazov") or it.get("doplnok") or it.get("lie_doplnok") or ""
            strength = it.get("lie_sila") or it.get("sila") or P.strength_from(form)
            company = it.get("drz_nazov") or it.get("drzitel") or ""
            extra = str(it.get("lie_kod") or it.get("sukl_kod") or it.get("lie_id") or "")
            key = (name.lower(), inn.lower(), form.lower(), strength.lower(), company.lower(), extra)
            if key in seen:
                continue
            seen.add(key)
            P.accept_prod("SK")
            P.add_row(rows, "SK", inn, name, form, strength, company, extra, src="d")
            n += 1
        P.log(f"parse SK {path.name} {n}")
    return n


def dmd_folder() -> Path | None:
    for base in (P.RAW / "GB", ADD / "Anh"):
        if not base.exists():
            continue
        hits = sorted(base.rglob("f_amp2_*.xml"), key=lambda x: x.stat().st_size, reverse=True)
        if hits:
            return hits[0].parent
    return None


def xml_map(path: Path, row_tag: str) -> list[dict]:
    out = []
    for _event, el in ET.iterparse(path, events=("end",)):
        if P.local(el.tag) != row_tag:
            continue
        out.append({P.local(c.tag): (c.text or "").strip() for c in list(el)})
        el.clear()
    return out


def parse_gb(rows):
    folder = dmd_folder()
    if not folder:
        return
    lookup_p = next(folder.glob("f_lookup*.xml"), None)
    vtm_p = next(folder.glob("f_vtm*.xml"), None)
    vmp_p = next(folder.glob("f_vmp*.xml"), None)
    amp_p = next(folder.glob("f_amp*.xml"), None)
    if not amp_p:
        return
    suppliers = {}
    if lookup_p:
        root = ET.parse(lookup_p).getroot()
        for group in root:
            if P.local(group.tag) != "SUPPLIER":
                continue
            for info in group:
                cd = desc = ""
                for c in info:
                    t = P.local(c.tag)
                    if t == "CD":
                        cd = c.text or ""
                    elif t == "DESC":
                        desc = c.text or ""
                if cd:
                    suppliers[cd] = desc
    vtm = {}
    if vtm_p:
        for rec in xml_map(vtm_p, "VTM"):
            if rec.get("INVALID"):
                continue
            vtm[rec.get("VTMID") or ""] = rec.get("NM") or ""
    vmp = {}
    if vmp_p:
        for rec in xml_map(vmp_p, "VMP"):
            if rec.get("INVALID"):
                continue
            if rec.get("NON_AVAILCD") == "0001":
                continue
            vmp[rec.get("VPID") or ""] = rec
    n = 0
    drop_avail = {"0005", "0006", "0007", "0009"}
    for _event, el in ET.iterparse(amp_p, events=("end",)):
        if P.local(el.tag) != "AMP":
            continue
        rec = {P.local(c.tag): (c.text or "").strip() for c in list(el)}
        el.clear()
        if rec.get("INVALID"):
            P.reject("GB", "cancelled")
            continue
        if rec.get("LIC_AUTHCD") == "0002":
            P.reject("GB", "not_human")
            continue
        if rec.get("AVAIL_RESTRICTCD") in drop_avail:
            P.reject("GB", "not_marketed")
            continue
        vp = vmp.get(rec.get("VPID") or "", {})
        inn = vtm.get(vp.get("VTMID") or "", "")
        name = rec.get("NM") or rec.get("DESC") or ""
        vnm = vp.get("NM") or ""
        P.accept_prod("GB")
        P.add_row(
            rows,
            "GB",
            inn,
            name,
            form_from(vnm or name),
            P.strength_from(vnm or name),
            suppliers.get(rec.get("SUPPCD") or "", ""),
            rec.get("APID") or "",
            src="d",
        )
        n += 1
    P.log(f"parse GB {n}")


def parse_jp(rows):
    p = P.pick_file(P.RAW / "JP", "pmda-approved.pdf") or find_add("japan")
    if not p:
        return
    n = 0
    seen = set()
    try:
        import pymupdf
    except ImportError:
        pymupdf = None
    if pymupdf is None:
        P.log("parse JP skipped (pymupdf missing)")
        return
    doc = pymupdf.open(p)
    for page in doc:
        tabs = page.find_tables()
        if not tabs or not tabs.tables:
            continue
        for table in tabs.tables:
            extracted = table.extract() or []
            header = None
            for raw in extracted:
                vals = [re.sub(r"\s+", " ", (c or "").replace("\n", " ")).strip() if c else "" for c in raw]
                joined = " ".join(vals).lower()
                if header is None:
                    if "brand name" in joined and "active" in joined:
                        header = vals
                    continue
                brand_cell = ""
                inn_cell = ""
                # Prefer original newlines from the brand column.
                orig = [(c or "").strip() for c in raw]
                if len(orig) >= 6:
                    brand_cell = orig[3]
                    inn_cell = orig[5]
                else:
                    continue
                brands, company = split_jp_brand(brand_cell)
                inn = re.sub(r"\s+", " ", inn_cell.replace("\n", " ")).strip()
                for brand in brands:
                    if not brand or brand.lower().startswith("brand"):
                        continue
                    key = (brand.lower(), inn.lower(), company.lower())
                    if key in seen:
                        continue
                    seen.add(key)
                    P.accept_prod("JP")
                    P.add_row(
                        rows,
                        "JP",
                        inn,
                        brand,
                        form_from(brand),
                        P.strength_from(brand),
                        company,
                        "",
                        src="d",
                    )
                    n += 1
    doc.close()
    P.log(f"parse JP {n}")


def parse_union_register(rows):
    p = P.pick_file(P.RAW / "EMA", "union_register.xlsx") or find_add("union register")
    if not p:
        return
    n = 0
    for header, vals in xlsx_after_header(p, "eu #", "brand"):
        eu = col(header, vals, "eu #", "eu number")
        name = col(header, vals, "brand name")
        inn = col(header, vals, "inn")
        company = col(header, vals, "marketing authorisation holder", "holder")
        if not name and not inn:
            continue
        P.accept_prod("EMA")
        P.add_row(rows, "EMA", inn, name, "", "", company, eu, src="e")
        n += 1
    P.log(f"parse EMA union {n}")


def parse_article57_gaps(rows):
    p = P.pick_file(P.RAW / "EMA", "article57.xlsx")
    if not p:
        ema = find_add("ema.xlsx")
        if ema and "union" not in fold_name(ema.name):
            p = ema
    if not p:
        return
    have = {cc for cc, n in Counter(r["country"] for r in rows).items() if n and cc != "EMA"}
    n = 0
    by = Counter()
    for header, vals in xlsx_after_header(p, "authorisation country"):
        cname = (col(header, vals, "authorisation country") or "").strip().lower()
        cc = A57_MAP.get(cname)
        if not cc or cc in have:
            continue
        name = col(header, vals, "product name", "product short")
        inn = (col(header, vals, "active substance") or "").replace("|", ", ")
        company = col(header, vals, "marketing authorisation holder")
        route = col(header, vals, "route of administration")
        if not name and not inn:
            continue
        P.accept_prod(cc)
        P.add_row(rows, cc, inn, name, route, "", company, "", src="d")
        n += 1
        by[cc] += 1
    P.log("parse A57 gaps " + ", ".join(f"{k}:{v}" for k, v in sorted(by.items())) + f" total={n}")


def parse_added(rows):
    stage_add_files()
    parse_union_register(rows)
    parse_pt(rows)
    parse_hr(rows)
    parse_nl(rows)
    parse_lt(rows)
    parse_mt(rows)
    parse_pl(rows)
    parse_si(rows)
    parse_gb(rows)
    parse_jp(rows)
    parse_article57_gaps(rows)
