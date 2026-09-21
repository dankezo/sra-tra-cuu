# -*- coding: utf-8 -*-
"""Parallel download of official medicine dumps + build search.json / CSV."""
from __future__ import annotations

import csv
import io
import json
import re
import ssl
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data"
RAW.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36"
CTX = ssl.create_default_context()
MANIFEST = []

JOBS = [
    ("FR/CIS_bdpm.txt", "https://base-donnees-publique.medicaments.gouv.fr/download/file/CIS_bdpm.txt"),
    ("FR/CIS_COMPO_bdpm.txt", "https://base-donnees-publique.medicaments.gouv.fr/download/file/CIS_COMPO_bdpm.txt"),
    ("FR/CIS_CIP_bdpm.txt", "https://base-donnees-publique.medicaments.gouv.fr/download/file/CIS_CIP_bdpm.txt"),
    ("ES/Medicamentos.xls", "https://listadomedicamentos.aemps.gob.es/Medicamentos.xls"),
    ("ES/Presentaciones.xls", "https://listadomedicamentos.aemps.gob.es/Presentaciones.xls"),
    ("CA/allfiles.zip", "https://open.canada.ca/data/dataset/bf55e42a-63cb-4556-bfd8-44f26e5a36fe/resource/b05ae610-0366-478f-993f-b4afbdaadbc6/download/allfiles.zip"),
    ("CH/OGD.zip", "https://ogd.swissmedic.cloud/ogd-arzneimittel/Daten/OGD.zip"),
    ("EE/pakendid.csv", "https://ravimiregister.ee/Data/XML/pakendid.csv"),
    ("PL/overall.xml", "https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/public-pl-report/6.0.0/overall.xml"),
    ("RO/nomenclator.xlsx", "https://nomenclator.anm.ro/files/nomenclator.xlsx"),
    ("IS/medicine.json", "https://www.lyfjastofnun.is/rest/v2/medicine/0"),
    ("SE/sensl.zip", "http://nsl.mpa.se/sensl.zip"),
    ("EMA/medicines.json", "https://www.ema.europa.eu/en/documents/report/medicines-output-medicines_json-report_en.json"),
    ("EMA/epar.xlsx", "https://www.ema.europa.eu/sites/default/files/Medicines_output_european_public_assessment_reports.xlsx"),
    ("US/drugsfda.zip", "https://www.fda.gov/media/89850/download"),
    ("LT/PreparatasPakuote.csv", "https://get.data.gov.lt/datasets/gov/vvkt/vaistiniai_preparatai/PreparatasPakuote.csv"),
    ("LV/HumanProducts.xml.zip", "https://dati.zva.gov.lv/zalu-registrs/export/HumanProducts.xml.zip"),
    ("LV/registry.json.zip", "https://dati.zva.gov.lv/zalu-registrs/export/HumanProducts.json.zip"),
]


def log(m: str) -> None:
    print(m, flush=True)


def fetch_one(rel: str, url: str, timeout: int = 90) -> None:
    dest = RAW / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 2000:
        log(f"SKIP {rel} ({dest.stat().st_size:,} B)")
        MANIFEST.append({"url": url, "ok": True, "skipped": True, "file": rel, "bytes": dest.stat().st_size})
        return
    req = Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urlopen(req, timeout=timeout, context=CTX) as r:
            data = r.read()
            final = r.geturl()
    except Exception as e:
        log(f"FAIL {rel}: {e}")
        MANIFEST.append({"url": url, "ok": False, "error": str(e), "file": rel})
        return
    dest.write_bytes(data)
    log(f"OK   {rel} {len(data):,} B")
    MANIFEST.append({"url": url, "final": final, "ok": True, "bytes": len(data), "file": rel})


def fetch_sk() -> None:
    items = []
    offset = 0
    while offset < 40000:
        url = f"https://api.sukl.sk/json/lieky_ui42.php?limit=1000&offset={offset}"
        dest = RAW / "SK" / f"p{offset:05d}.json"
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = Request(url, headers={"User-Agent": UA})
        try:
            with urlopen(req, timeout=25, context=CTX) as r:
                data = r.read()
        except Exception as e:
            log(f"FAIL SK offset {offset}: {e}")
            break
        dest.write_bytes(data)
        try:
            payload = json.loads(data.decode("utf-8", "replace"))
        except json.JSONDecodeError:
            break
        batch = payload if isinstance(payload, list) else payload.get("data") or payload.get("items") or []
        if not batch:
            break
        items.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    (RAW / "SK" / "lieky_all.json").write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    log(f"OK   SK {len(items)} rows")


def fetch_cima() -> None:
    """Documented CIMA REST, first pages only if xls already there we still get JSON for INN."""
    items = []
    page = 1
    while page <= 40:
        url = f"https://cima.aemps.es/cima/rest/medicamentos?pagina={page}"
        dest = RAW / "ES" / f"cima_{page:03d}.json"
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = Request(url, headers={"User-Agent": UA})
        try:
            with urlopen(req, timeout=25, context=CTX) as r:
                data = r.read()
        except Exception as e:
            log(f"FAIL CIMA p{page}: {e}")
            break
        dest.write_bytes(data)
        try:
            payload = json.loads(data.decode("utf-8", "replace"))
        except json.JSONDecodeError:
            break
        batch = payload.get("resultados") or []
        items.extend(batch)
        tot = payload.get("totalPaginas") or 0
        if not batch or (tot and page >= tot):
            break
        page += 1
    (RAW / "ES" / "cima_all.json").write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    log(f"OK   CIMA {len(items)} rows, pages={page}")


def extra_pages() -> None:
    extras = [
        ("IE/listings.html", "https://www.hpra.ie/find-a-medicine/for-human-use/xml-product-listings"),
        ("IT/liste.html", "https://www.aifa.gov.it/liste-dei-farmaci"),
        ("FI/xml.html", "https://fimea.fi/en/databases_and_registers/basic-register-xml"),
        ("CZ/dlp.html", "https://opendata.sukl.cz/?q=katalog%2Fdatabaze-lecivych-pripravku-dlp"),
        ("LV/export.html", "https://dati.zva.gov.lv/zalu-registrs/export/en"),
        ("CH/listen.html", "https://www.swissmedic.ch/swissmedic/de/home/services/listen_neu.html"),
        ("LU/page.html", "https://santesecu.public.lu/fr/espace-professionnel/departement-sante/pharmacies-et-medicaments/medicaments-humains.html"),
    ]
    href_re = re.compile(r'href=["\']([^"\']+)["\']', re.I)
    follow = []
    for rel, url in extras:
        dest = RAW / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = Request(url, headers={"User-Agent": UA})
        try:
            with urlopen(req, timeout=25, context=CTX) as r:
                data = r.read()
                base = r.geturl()
        except Exception as e:
            log(f"FAIL page {rel}: {e}")
            continue
        dest.write_bytes(data)
        text = data.decode("utf-8", "replace")
        from urllib.parse import urljoin

        for h in href_re.findall(text):
            full = urljoin(base, h)
            if re.search(r"\.(xml|zip|csv|xlsx|xls)(\?|$)", full, re.I) or "download" in full.lower():
                name = Path(full.split("?")[0]).name or "file.bin"
                if len(name) < 3:
                    continue
                follow.append((str(Path(rel).parent / name), full))
    # unique
    seen = set()
    jobs = []
    for rel, u in follow:
        if u in seen:
            continue
        seen.add(u)
        jobs.append((rel, u))
    log(f"follow {len(jobs)} file links")
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(fetch_one, rel, u, 60) for rel, u in jobs]
        for _ in as_completed(futs):
            pass


def add_row(rows, country, inn, name, form, strength, extra=""):
    inn = re.sub(r"\s+", " ", (inn or "")).strip()
    name = re.sub(r"\s+", " ", (name or "")).strip()
    form = re.sub(r"\s+", " ", (form or "")).strip()
    strength = re.sub(r"\s+", " ", (strength or "")).strip()
    extra = re.sub(r"\s+", " ", (extra or "")).strip()
    if not inn and not name:
        return
    rows.append({"country": country, "inn": inn[:240], "name": name[:240], "form": form[:160], "strength": strength[:80], "extra": extra[:120]})


def parse_fr(rows):
    cis_p, comp_p = RAW / "FR" / "CIS_bdpm.txt", RAW / "FR" / "CIS_COMPO_bdpm.txt"
    cis_map = {}
    if cis_p.exists():
        for line in cis_p.read_bytes().decode("latin-1").splitlines():
            c = line.split("\t")
            if len(c) >= 3:
                cis_map[c[0]] = {"name": c[1], "form": c[2]}
    n = 0
    if comp_p.exists():
        for line in comp_p.read_bytes().decode("latin-1").splitlines():
            c = line.split("\t")
            if len(c) < 5:
                continue
            cis = c[0]
            subst = c[3] if len(c) > 3 else ""
            kind = (c[4] if len(c) > 4 else "").upper()
            amt = ((c[5] if len(c) > 5 else "") + " " + (c[6] if len(c) > 6 else "")).strip()
            if kind and kind not in {"SA", "A"} and "SA" not in kind:
                continue
            info = cis_map.get(cis, {})
            add_row(rows, "FR", subst, info.get("name", ""), info.get("form", ""), amt, cis)
            n += 1
    log(f"parse FR {n} (cis {len(cis_map)})")


def parse_cima(rows):
    p = RAW / "ES" / "cima_all.json"
    if not p.exists():
        return
    try:
        cima = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        log(f"parse ES fail {e}")
        return
    for it in cima:
        inn = it.get("pactivos") or it.get("vtm") or ""
        form = it.get("formaFarmaceutica")
        if isinstance(form, dict):
            form = form.get("nombre") or ""
        add_row(rows, "ES", str(inn), it.get("nombre") or "", str(form or ""), it.get("dosis") or "", str(it.get("nregistro") or ""))
    log(f"parse ES CIMA {len(cima)}")


def parse_ema(rows):
    p = RAW / "EMA" / "medicines.json"
    if not p.exists():
        return
    try:
        payload = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        log(f"parse EMA fail {e}")
        return
    items = payload if isinstance(payload, list) else []
    if isinstance(payload, dict):
        for v in payload.values():
            if isinstance(v, list) and v and isinstance(v[0], dict):
                items = v
                break
    n = 0
    for it in items:
        if not isinstance(it, dict):
            continue
        inn = it.get("international_non_proprietary_name_common_name") or it.get("active_substance") or ""
        add_row(rows, "EMA", str(inn), it.get("name_of_medicine") or it.get("medicine_name") or "", "", "", it.get("ema_product_number") or "")
        n += 1
    log(f"parse EMA {n}")


def parse_is(rows):
    p = RAW / "IS" / "medicine.json"
    if not p.exists():
        return
    try:
        payload = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        log(f"parse IS fail {e}")
        return
    meds = payload.get("medicines") if isinstance(payload, dict) else payload
    if not isinstance(meds, list):
        return
    for it in meds:
        add_row(rows, "IS", str(it.get("atcCodes") or ""), it.get("medicineName") or "", it.get("form") or "", f"{it.get('strengthNumber') or ''} {it.get('strengthUnit') or ''}".strip(), str(it.get("nordicNumber") or ""))
    log(f"parse IS {len(meds)}")


def parse_sk(rows):
    p = RAW / "SK" / "lieky_all.json"
    if not p.exists() or p.stat().st_size < 10:
        return
    items = json.loads(p.read_text(encoding="utf-8"))
    for it in items:
        add_row(rows, "SK", it.get("liecivo") or it.get("ATC") or it.get("atc") or "", it.get("nazov") or it.get("Nazov") or "", it.get("doplnok") or "", it.get("sila") or "", str(it.get("sukl_kod") or it.get("kod") or ""))
    log(f"parse SK {len(items)}")


def sniff_csv(text):
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


def parse_ee(rows):
    p = RAW / "EE" / "pakendid.csv"
    if not p.exists():
        return
    text = p.read_bytes().decode("utf-8-sig", "replace")
    n = 0
    for it in csv.DictReader(io.StringIO(text), dialect=sniff_csv(text)):
        add_row(rows, "EE", gdict(it, "toimeaine", "inn", "active"), gdict(it, "nimetus", "nimi", "ravim", "name"), gdict(it, "ravimvorm", "form"), gdict(it, "toimeaine_sisaldus", "tugevus", "strength"), gdict(it, "pakendi_kood", "kood"))
        n += 1
    log(f"parse EE {n}")


def parse_lt(rows):
    p = RAW / "LT" / "PreparatasPakuote.csv"
    if not p.exists() or p.stat().st_size < 100:
        return
    text = p.read_bytes().decode("utf-8-sig", "replace")
    n = 0
    for it in csv.DictReader(io.StringIO(text), dialect=sniff_csv(text)):
        add_row(rows, "LT", gdict(it, "veikli", "inn", "medziaga"), gdict(it, "pavadinimas", "preparat"), gdict(it, "forma"), gdict(it, "stiprum", "strength"), gdict(it, "vid", "pakid"))
        n += 1
    log(f"parse LT {n}")


def parse_ca(rows):
    caz = RAW / "CA" / "allfiles.zip"
    if not caz.exists() or not zipfile.is_zipfile(caz):
        return
    with zipfile.ZipFile(caz) as z:
        names = z.namelist()
        drug_n = next((n for n in names if re.search(r"drug\.txt$", n, re.I)), None)
        ing_n = next((n for n in names if re.search(r"ingred\.txt$", n, re.I)), None)
        form_n = next((n for n in names if re.search(r"form\.txt$", n, re.I)), None)
        drugs, ings, forms = {}, {}, {}
        if drug_n:
            for line in z.read(drug_n).decode("utf-8", "replace").splitlines():
                parts = next(csv.reader([line]))
                if len(parts) >= 4:
                    drugs[parts[0]] = parts[3]
        if ing_n:
            for line in z.read(ing_n).decode("utf-8", "replace").splitlines():
                parts = next(csv.reader([line]))
                if len(parts) >= 3:
                    ings.setdefault(parts[0], []).append((parts[2] if len(parts) > 2 else parts[1], parts[4] if len(parts) > 4 else "", parts[5] if len(parts) > 5 else ""))
        if form_n:
            for line in z.read(form_n).decode("utf-8", "replace").splitlines():
                parts = next(csv.reader([line]))
                if len(parts) >= 3:
                    forms[parts[0]] = parts[2]
        for did, name in drugs.items():
            inn_list = ings.get(did, [])
            inn = ", ".join(x[0] for x in inn_list if x[0])
            strength = ", ".join(f"{x[1]} {x[2]}".strip() for x in inn_list if x[1] or x[2])
            add_row(rows, "CA", inn, name, forms.get(did, ""), strength, did)
        log(f"parse CA {len(drugs)}")


def parse_ch(rows):
    chz = RAW / "CH" / "OGD.zip"
    if not chz.exists() or not zipfile.is_zipfile(chz):
        return
    import xml.etree.ElementTree as ET
    try:
        with zipfile.ZipFile(chz) as z:
            names = {Path(n).name: n for n in z.namelist()}
            praep_n = next((n for k, n in names.items() if "Praeparate" in k), None)
            dek_n = next((n for k, n in names.items() if "Deklarationen" in k), None)
            seq_n = next((n for k, n in names.items() if "Sequenzen" in k), None)
            names_map, seq_map = {}, {}
            if praep_n:
                root = ET.fromstring(z.read(praep_n))
                for el in list(root):
                    d = {c.tag.split("}")[-1]: (c.text or "") for c in list(el)}
                    zn = d.get("Zulassungsnummer") or d.get("ZULASSUNGSNUMMER") or ""
                    if zn:
                        names_map[zn] = d
            if seq_n:
                root = ET.fromstring(z.read(seq_n))
                for el in list(root):
                    d = {c.tag.split("}")[-1]: (c.text or "") for c in list(el)}
                    key = (d.get("Zulassungsnummer") or "") + "|" + (d.get("Sequenznummer") or "")
                    seq_map[key] = d
            n = 0
            if dek_n:
                root = ET.fromstring(z.read(dek_n))
                for el in list(root):
                    d = {c.tag.split("}")[-1]: (c.text or "") for c in list(el)}
                    zn = d.get("Zulassungsnummer") or ""
                    info = names_map.get(zn, {})
                    add_row(rows, "CH", d.get("Stoff") or d.get("STOFF") or "", info.get("Praeparatename") or info.get("PRAEPARATENAME") or "", info.get("Zulassungsstatus") or "", d.get("Menge") or d.get("MENGE") or "", zn)
                    n += 1
            log(f"parse CH {n}")
    except Exception as e:
        log(f"parse CH fail {e}")


def parse_pl(rows):
    pl = RAW / "PL" / "overall.xml"
    if not pl.exists() or pl.stat().st_size < 1000:
        return
    import xml.etree.ElementTree as ET
    n = 0
    try:
        for event, el in ET.iterparse(pl, events=("end",)):
            tag = el.tag.split("}")[-1]
            if tag not in {"produktLeczniczy", "ProduktLeczniczy", "medicinalProduct", "produktleczniczy"}:
                continue
            def tx(*names):
                for child in el:
                    if child.tag.split("}")[-1] in names:
                        return (child.text or "").strip()
                return ""
            inns = [(c.text or "").strip() for c in el.iter() if c.tag.split("}")[-1] in {"nazwaSubstancji", "substancjaCzynna", "inn"} and (c.text or "").strip()]
            add_row(rows, "PL", ", ".join(inns[:8]) or tx("nazwaPowszechnieStosowana"), tx("nazwaProduktu", "nazwa"), tx("postacFarmaceutyczna", "postac"), tx("moc"), tx("identyfikatorProduktuLeczniczego"))
            n += 1
            el.clear()
            if n > 200000:
                break
        log(f"parse PL {n}")
    except Exception as e:
        log(f"parse PL fail {e}")


def parse_lv(rows):
    folder = RAW / "LV"
    if not folder.exists():
        return
    for p in list(folder.glob("*.zip")):
        if zipfile.is_zipfile(p):
            with zipfile.ZipFile(p) as z:
                for n in z.namelist():
                    if n.endswith((".json", ".xml")):
                        (folder / Path(n).name).write_bytes(z.read(n))
    for p in folder.glob("*.json"):
        try:
            payload = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        items = payload if isinstance(payload, list) else payload.get("medicinalProducts") or payload.get("products") or payload.get("medicines") or []
        n = 0
        if isinstance(items, list):
            for it in items:
                if not isinstance(it, dict):
                    continue
                inn = it.get("inn") or it.get("activeSubstance") or it.get("activeSubstances") or ""
                if isinstance(inn, list):
                    inn = ", ".join(str(x.get("name") if isinstance(x, dict) else x) for x in inn)
                add_row(rows, "LV", str(inn), it.get("name") or it.get("productName") or "", str(it.get("pharmaceuticalForm") or it.get("form") or ""), str(it.get("strength") or ""), str(it.get("id") or ""))
                n += 1
        log(f"parse LV {p.name} {n}")


def parse_us(rows):
    usz = RAW / "US" / "drugsfda.zip"
    if not usz.exists() or not zipfile.is_zipfile(usz):
        return
    with zipfile.ZipFile(usz) as z:
        prod = next((n for n in z.namelist() if n.lower().endswith("products.txt")), None)
        if not prod:
            return
        text = z.read(prod).decode("latin-1", "replace")
        n = 0
        for it in csv.DictReader(io.StringIO(text), delimiter="\t"):
            add_row(rows, "US", it.get("ActiveIngredient") or "", it.get("DrugName") or "", it.get("Form") or it.get("DosageForm") or "", it.get("Strength") or "", it.get("ApplNo") or "")
            n += 1
        log(f"parse US {n}")


def parse_se(rows):
    sez = RAW / "SE" / "sensl.zip"
    if not sez.exists() or not zipfile.is_zipfile(sez):
        return
    import xml.etree.ElementTree as ET
    n = 0
    try:
        with zipfile.ZipFile(sez) as z:
            xmls = [nm for nm in z.namelist() if nm.lower().endswith(".xml")]
            for xn in xmls:
                for event, el in ET.iterparse(io.BytesIO(z.read(xn)), events=("end",)):
                    tag = el.tag.split("}")[-1].lower()
                    t = (el.text or "").strip()
                    if t and 3 < len(t) < 80 and tag in {"name", "displayname", "recommendedname", "en", "sv"}:
                        add_row(rows, "SE", t, t, "", "", "NSL")
                        n += 1
                    el.clear()
        log(f"parse SE NSL {n}")
    except Exception as e:
        log(f"parse SE fail {e}")


def parse_it_csv(rows):
    folder = RAW / "IT"
    if not folder.exists():
        return
    for p in folder.glob("*.csv"):
        text = p.read_bytes().decode("utf-8-sig", "replace")
        n = 0
        for it in csv.DictReader(io.StringIO(text), dialect=sniff_csv(text)):
            add_row(rows, "IT", gdict(it, "principio", "attivo", "inn"), gdict(it, "farmaco", "nome", "descrizione"), gdict(it, "forma"), gdict(it, "dosaggio", "unita"), gdict(it, "aic", "codice"))
            n += 1
        log(f"parse IT {p.name} {n}")


def parse_ie_xml(rows):
    folder = RAW / "IE"
    if not folder.exists():
        return
    import xml.etree.ElementTree as ET
    for p in folder.glob("*.xml"):
        n = 0
        try:
            for event, el in ET.iterparse(p, events=("end",)):
                tag = el.tag.split("}")[-1].lower()
                if "product" not in tag:
                    continue
                texts = {c.tag.split("}")[-1].lower(): (c.text or "") for c in list(el)}
                add_row(rows, "IE", texts.get("activesubstance") or texts.get("ingredient") or texts.get("inn") or "", texts.get("productname") or texts.get("name") or "", texts.get("pharmaceuticalform") or texts.get("form") or "", texts.get("strength") or "", texts.get("licence") or "")
                n += 1
                el.clear()
            log(f"parse IE {p.name} {n}")
        except Exception as e:
            log(f"parse IE fail {e}")


def parse_cz(rows):
    folder = RAW / "CZ"
    if not folder.exists():
        return
    for p in folder.glob("*.zip"):
        if zipfile.is_zipfile(p):
            with zipfile.ZipFile(p) as z:
                for n in z.namelist():
                    if n.lower().endswith(".csv"):
                        (folder / Path(n).name).write_bytes(z.read(n))
    for p in folder.glob("*.csv"):
        blob = p.read_bytes()
        text = ""
        for enc in ("utf-8-sig", "cp1250", "latin-1"):
            try:
                text = blob.decode(enc)
                break
            except UnicodeDecodeError:
                pass
        if not text:
            continue
        n = 0
        for it in csv.DictReader(io.StringIO(text), dialect=sniff_csv(text)):
            add_row(rows, "CZ", gdict(it, "latka", "inn", "nazev_latky", "leciva"), gdict(it, "nazev", "pripravek"), gdict(it, "forma"), gdict(it, "sila", "strength"), gdict(it, "kod", "sukl"))
            n += 1
        log(f"parse CZ {p.name} {n}")


def parse_fi(rows):
    folder = RAW / "FI"
    if not folder.exists():
        return
    import xml.etree.ElementTree as ET
    for p in folder.glob("*.xml"):
        n = 0
        try:
            for event, el in ET.iterparse(p, events=("end",)):
                tag = el.tag.split("}")[-1].lower()
                if "product" not in tag and "valmiste" not in tag:
                    continue
                texts = {c.tag.split("}")[-1].lower(): (c.text or "") for c in list(el)}
                add_row(rows, "FI", texts.get("vaikuttavaaine") or texts.get("ingredient") or texts.get("substance") or "", texts.get("nimi") or texts.get("name") or texts.get("valmistenimi") or "", texts.get("laakemuoto") or texts.get("form") or "", texts.get("vahvuus") or texts.get("strength") or "", texts.get("vnr") or "")
                n += 1
                el.clear()
            log(f"parse FI {p.name} {n}")
        except Exception as e:
            log(f"parse FI fail {e}")


def parse_ro(rows):
    ro = RAW / "RO" / "nomenclator.xlsx"
    if not ro.exists() or ro.stat().st_size < 1000 or not zipfile.is_zipfile(ro):
        return
    import xml.etree.ElementTree as ET
    try:
        with zipfile.ZipFile(ro) as z:
            ss = []
            ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            if "xl/sharedStrings.xml" in z.namelist():
                root = ET.fromstring(z.read("xl/sharedStrings.xml"))
                for si in root.findall("m:si", ns):
                    ss.append("".join(t.text or "" for t in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")))
            sheet = next((n for n in z.namelist() if n.startswith("xl/worksheets/sheet")), None)
            if not sheet:
                return
            root = ET.fromstring(z.read(sheet))
            header = []
            n = 0
            for row in root.findall("m:sheetData/m:row", ns):
                vals = []
                for c in row.findall("m:c", ns):
                    t = c.get("t")
                    v = c.find("m:v", ns)
                    val = v.text if v is not None else ""
                    if t == "s" and val and val.isdigit() and int(val) < len(ss):
                        val = ss[int(val)]
                    vals.append(val or "")
                if not header:
                    header = [x.lower() for x in vals]
                    continue
                rec = {header[i] if i < len(header) else f"c{i}": vals[i] if i < len(vals) else "" for i in range(len(header))}
                add_row(rows, "RO", gdict(rec, "dci", "substan"), gdict(rec, "denumire", "comercial"), gdict(rec, "form"), gdict(rec, "concentra", "doza"), gdict(rec, "cim"))
                n += 1
            log(f"parse RO {n}")
    except Exception as e:
        log(f"parse RO fail {e}")


def dedupe(rows):
    seen, out = set(), []
    for r in rows:
        key = (r["country"], r["inn"].lower(), r["name"].lower(), r["form"].lower(), r["strength"].lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def write_outputs(rows):
    rows = dedupe(rows)
    csv_path = OUT / "SRA_thuoc_gop.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["country", "inn", "name", "form", "strength", "extra"])
        w.writeheader()
        w.writerows(rows)
    compact = {"v": 1, "updated": time.strftime("%Y-%m-%d"), "count": len(rows), "r": [[r["country"], r["inn"], r["name"], r["form"], r["strength"]] for r in rows]}
    js_path = OUT / "search.json"
    js_path.write_text(json.dumps(compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    by = {}
    for r in rows:
        by[r["country"]] = by.get(r["country"], 0) + 1
    (OUT / "manifest.json").write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "summary.json").write_text(json.dumps({"count": len(rows), "by_country": by}, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"WROTE {len(rows)} rows csv={csv_path.stat().st_size:,} json={js_path.stat().st_size:,}")
    log("by: " + ", ".join(f"{k}:{v}" for k, v in sorted(by.items())))


def main():
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(fetch_one, rel, url) for rel, url in JOBS]
        for _ in as_completed(futs):
            pass
    extra_pages()
    fetch_sk()
    fetch_cima()
    rows = []
    parse_fr(rows)
    parse_cima(rows)
    parse_ema(rows)
    parse_is(rows)
    parse_sk(rows)
    parse_ee(rows)
    parse_lt(rows)
    parse_ca(rows)
    parse_ch(rows)
    parse_pl(rows)
    parse_lv(rows)
    parse_us(rows)
    parse_se(rows)
    parse_it_csv(rows)
    parse_ie_xml(rows)
    parse_cz(rows)
    parse_fi(rows)
    parse_ro(rows)
    write_outputs(rows)
    log(f"done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
