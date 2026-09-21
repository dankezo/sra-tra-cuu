# -*- coding: utf-8 -*-
"""Download official SRA medicine dumps and build a local search index."""
from __future__ import annotations

import csv
import io
import json
import re
import ssl
import sys
import time
import zipfile
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data"
RAW.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()
MANIFEST = []


def log(msg: str) -> None:
    print(msg, flush=True)


def get(url: str, dest: Path | None = None, timeout: int = 180) -> bytes | None:
    req = Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urlopen(req, timeout=timeout, context=CTX) as r:
            data = r.read()
            final = r.geturl()
            ctype = r.headers.get("Content-Type", "")
    except (HTTPError, URLError, TimeoutError, ssl.SSLError) as e:
        log(f"  FAIL {url} -> {e}")
        MANIFEST.append({"url": url, "ok": False, "error": str(e)})
        return None
    if dest is None:
        dest = RAW / Path(url.split("?")[0]).name
        if dest.name in {"", "/", "download"} or len(dest.suffix) > 6:
            dest = RAW / "download.bin"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    MANIFEST.append(
        {
            "url": url,
            "final": final,
            "ok": True,
            "bytes": len(data),
            "ctype": ctype,
            "file": str(dest.relative_to(ROOT)),
        }
    )
    log(f"  OK {len(data):,} B  {dest.name}")
    return data


def html_links(url: str, pattern: str) -> list[str]:
    data = get(url, RAW / "pages" / (re.sub(r"\W+", "_", url)[:80] + ".html"))
    if not data:
        return []
    text = data.decode("utf-8", "replace")
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', text, re.I)
    out = []
    for h in hrefs:
        if h.startswith("//"):
            h = "https:" + h
        elif h.startswith("/"):
            from urllib.parse import urljoin

            h = urljoin(url, h)
        if re.search(pattern, h, re.I):
            out.append(h)
    return list(dict.fromkeys(out))


def add_row(rows: list, country: str, inn: str, name: str, form: str, strength: str, extra: str = "") -> None:
    inn = re.sub(r"\s+", " ", (inn or "")).strip()
    name = re.sub(r"\s+", " ", (name or "")).strip()
    form = re.sub(r"\s+", " ", (form or "")).strip()
    strength = re.sub(r"\s+", " ", (strength or "")).strip()
    extra = re.sub(r"\s+", " ", (extra or "")).strip()
    if not inn and not name:
        return
    rows.append(
        {
            "country": country,
            "inn": inn[:240],
            "name": name[:240],
            "form": form[:160],
            "strength": strength[:80],
            "extra": extra[:120],
        }
    )


def fetch_all() -> None:
    log("== France BDPM ==")
    fr_page = "https://base-donnees-publique.medicaments.gouv.fr/telechargement"
    fr_links = html_links(fr_page, r"(CIS_|telechargement|download|fichier)")
    # Known public filenames
    for name in [
        "CIS_bdpm.txt",
        "CIS_CIP_bdpm.txt",
        "CIS_COMPO_bdpm.txt",
        "CIS_GENER_bdpm.txt",
        "CIS_CPD_bdpm.txt",
    ]:
        for base in [
            f"https://base-donnees-publique.medicaments.gouv.fr/download/file/{name}",
            f"https://base-donnees-publique.medicaments.gouv.fr/telechargement.php?fichier={name}",
            f"https://base-donnees-publique.medicaments.gouv.fr/{name}",
            f"https://base-donnees-publique.medicaments.gouv.fr/telechargement/{name}",
        ]:
            dest = RAW / "FR" / name
            if dest.exists() and dest.stat().st_size > 1000:
                break
            if get(base, dest):
                break
    for h in fr_links:
        fn = Path(h.split("?")[0]).name or "fr.bin"
        if not dest_ok(RAW / "FR" / fn):
            get(h, RAW / "FR" / fn)

    log("== Spain AEMPS ==")
    get("https://listadomedicamentos.aemps.gob.es/Medicamentos.xls", RAW / "ES" / "Medicamentos.xls")
    get("https://listadomedicamentos.aemps.gob.es/Presentaciones.xls", RAW / "ES" / "Presentaciones.xls")
    get("https://listadomedicamentos.aemps.gob.es/prescripcion.zip", RAW / "ES" / "prescripcion.zip")

    log("== Canada DPD ==")
    get(
        "https://open.canada.ca/data/dataset/bf55e42a-63cb-4556-bfd8-44f26e5a36fe/resource/b05ae610-0366-478f-993f-b4afbdaadbc6/download/allfiles.zip",
        RAW / "CA" / "allfiles.zip",
    )

    log("== Switzerland OGD ==")
    get("https://ogd.swissmedic.cloud/ogd-arzneimittel/Daten/OGD.zip", RAW / "CH" / "OGD.zip")

    log("== Estonia ==")
    get("https://ravimiregister.ee/Data/XML/pakendid.csv", RAW / "EE" / "pakendid.csv")
    for u in html_links(
        "https://ravimiregister.ee/en/default.aspx?pv=Andmed.Ravimid",
        r"\.(csv|xml|zip)|type=csv",
    ):
        get(u, RAW / "EE" / (Path(u.split("?")[0]).name or "ee.bin"))

    log("== Latvia ==")
    for u in [
        "https://dati.zva.gov.lv/zalu-registrs/export/HumanProducts.xml.zip",
        "https://data.gov.lv/dati/dataset/latvijas-zalu-registrs/resource/",
    ]:
        pass
    for u in html_links("https://dati.zva.gov.lv/zalu-registrs/export/en", r"\.(xml|json|zip|csv)"):
        get(u, RAW / "LV" / Path(u.split("?")[0]).name)

    log("== Lithuania ==")
    for u in [
        "https://get.data.gov.lt/datasets/gov/vvkt/vaistiniai_preparatai/PreparatasPakuote/:format/csv",
        "https://get.data.gov.lt/datasets/gov/vvkt/vaistiniai_preparatai/PreparatasPakuote.csv",
    ]:
        dest = RAW / "LT" / "PreparatasPakuote.csv"
        if dest.exists() and dest.stat().st_size > 1000:
            break
        get(u, dest)

    log("== Poland RPL XML ==")
    get(
        "https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/public-pl-report/6.0.0/overall.xml",
        RAW / "PL" / "overall.xml",
        timeout=300,
    )

    log("== Romania nomenclator ==")
    for u in [
        "https://nomenclator.anm.ro/files/nomenclator.xlsx",
        "https://nomenclator.anm.ro/nomenclator/files/nomenclator.xlsx",
        "https://www.anm.ro/nomenclator/files/nomenclator.xlsx",
    ]:
        dest = RAW / "RO" / "nomenclator.xlsx"
        if dest.exists() and dest.stat().st_size > 1000:
            break
        if get(u, dest):
            break

    log("== Ireland HPRA ==")
    for u in html_links(
        "https://www.hpra.ie/find-a-medicine/for-human-use/xml-product-listings",
        r"\.(xml|zip)|xml",
    ):
        if "xml" in u.lower():
            get(u, RAW / "IE" / Path(u.split("?")[0]).name)

    log("== Italy AIFA ==")
    for u in html_links("https://www.aifa.gov.it/liste-dei-farmaci", r"\.(csv|xlsx|xls|zip)"):
        get(u, RAW / "IT" / Path(u.split("?")[0]).name)

    log("== EMA ==")
    for u in [
        "https://www.ema.europa.eu/en/documents/report/medicines-output-medicines_json-report_en.json",
        "https://www.ema.europa.eu/en/documents/report/medicines-output-medicines_en.xlsx",
        "https://www.ema.europa.eu/sites/default/files/Medicines_output_european_public_assessment_reports.xlsx",
    ]:
        get(u, RAW / "EMA" / Path(u.split("?")[0]).name)

    log("== Iceland REST ==")
    get("https://www.lyfjastofnun.is/rest/v2/medicine/0", RAW / "IS" / "medicine.json")

    log("== Slovakia JSON (paginated) ==")
    sk_rows = []
    offset = 0
    while offset < 80000:
        url = f"https://api.sukl.sk/json/lieky_ui42.php?limit=1000&offset={offset}"
        data = get(url, RAW / "SK" / f"lieky_{offset:05d}.json", timeout=60)
        if not data:
            break
        try:
            payload = json.loads(data.decode("utf-8", "replace"))
        except json.JSONDecodeError:
            break
        batch = payload if isinstance(payload, list) else payload.get("data") or payload.get("items") or []
        if not batch:
            break
        sk_rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
        time.sleep(0.15)
    (RAW / "SK" / "lieky_all.json").write_text(json.dumps(sk_rows, ensure_ascii=False), encoding="utf-8")
    log(f"  SK rows {len(sk_rows)}")

    log("== Finland XML ==")
    for u in html_links(
        "https://fimea.fi/en/databases_and_registers/basic-register-xml",
        r"\.(xml|xsd|csv|zip)",
    ):
        get(u, RAW / "FI" / Path(u.split("?")[0]).name)

    log("== Czech DLP ==")
    for u in html_links(
        "https://opendata.sukl.cz/?q=katalog%2Fdatabaze-lecivych-pripravku-dlp",
        r"\.(zip|csv)",
    ):
        get(u, RAW / "CZ" / Path(u.split("?")[0]).name)

    log("== Sweden NSL (open, no registration) ==")
    get("http://nsl.mpa.se/sensl.zip", RAW / "SE" / "sensl.zip")
    for u in html_links(
        "https://www.lakemedelsverket.se/sv/e-tjanster-och-hjalpmedel/substans-och-produktregister/nsl",
        r"\.(zip|xml)",
    ):
        get(u, RAW / "SE" / Path(u.split("?")[0]).name)

    log("== FDA Drugs@FDA ==")
    for u in [
        "https://www.fda.gov/media/89850/download",
        "https://www.fda.gov/downloads/Drugs/InformationOnDrugs/UCM527389.zip",
    ]:
        dest = RAW / "US" / "drugsfda.zip"
        if dest.exists() and dest.stat().st_size > 1000:
            break
        if get(u, dest):
            break

    log("== CIMA REST (documented) ==")
    cima = []
    page = 1
    while page <= 80:
        url = f"https://cima.aemps.es/cima/rest/medicamentos?pagina={page}"
        data = get(url, RAW / "ES" / f"cima_{page:03d}.json", timeout=60)
        if not data:
            break
        try:
            payload = json.loads(data.decode("utf-8", "replace"))
        except json.JSONDecodeError:
            break
        batch = payload.get("resultados") or []
        cima.extend(batch)
        tot = payload.get("totalPaginas") or payload.get("paginas") or 0
        if not batch or (tot and page >= tot):
            break
        page += 1
        time.sleep(0.1)
    (RAW / "ES" / "cima_all.json").write_text(json.dumps(cima, ensure_ascii=False), encoding="utf-8")
    log(f"  CIMA rows {len(cima)}")


def dest_ok(p: Path) -> bool:
    return p.exists() and p.stat().st_size > 1000


def split_fr(line: str) -> list[str]:
    return line.rstrip("\n").split("\t")


def parse_rows() -> list[dict]:
    rows: list[dict] = []

    # France
    cis_p = RAW / "FR" / "CIS_bdpm.txt"
    comp_p = RAW / "FR" / "CIS_COMPO_bdpm.txt"
    if not cis_p.exists():
        for p in (RAW / "FR").glob("*.txt") if (RAW / "FR").exists() else []:
            if "CIS" in p.name.upper() and "COMPO" not in p.name.upper() and "CIP" not in p.name.upper():
                cis_p = p
            if "COMPO" in p.name.upper():
                comp_p = p
    cis_map = {}
    if cis_p.exists():
        raw = cis_p.read_bytes()
        text = raw.decode("latin-1")
        for line in text.splitlines():
            c = split_fr(line)
            if len(c) >= 3:
                cis_map[c[0]] = {"name": c[1], "form": c[2]}
        log(f"parse FR CIS {len(cis_map)}")
    if comp_p.exists():
        text = comp_p.read_bytes().decode("latin-1")
        for line in text.splitlines():
            c = split_fr(line)
            if len(c) < 5:
                continue
            cis, subst, kind, amt = c[0], c[3] if len(c) > 3 else "", c[4] if len(c) > 4 else "", c[5] if len(c) > 5 else ""
            # typical: CIS, designation, code, name, type SA/FT, amount, unit, nature
            if len(c) >= 6:
                subst = c[3]
                kind = c[4]
                amt = (c[5] + " " + (c[6] if len(c) > 6 else "")).strip()
            if kind.upper() not in {"SA", "A", "ACTIVE", ""} and "SA" not in kind.upper():
                # still keep if looks like INN
                pass
            info = cis_map.get(cis, {})
            add_row(rows, "FR", subst, info.get("name", ""), info.get("form", ""), amt, cis)

    # Spain CIMA json (more reliable than xls)
    cima_all = RAW / "ES" / "cima_all.json"
    if cima_all.exists() and cima_all.stat().st_size > 10:
        try:
            cima = json.loads(cima_all.read_text(encoding="utf-8"))
            for it in cima:
                inn = it.get("vtm") or it.get("pactivos") or it.get("principiosActivos") or ""
                if isinstance(inn, list):
                    inn = ", ".join(
                        x.get("nombre") if isinstance(x, dict) else str(x) for x in inn
                    )
                add_row(
                    rows,
                    "ES",
                    str(inn),
                    it.get("nombre") or "",
                    it.get("formaFarmaceutica") or (it.get("formaFarmaceuticaSimplificada") or ""),
                    it.get("dosis") or it.get("dcsa") or "",
                    str(it.get("nregistro") or ""),
                )
            log(f"parse ES CIMA {len(cima)}")
        except Exception as e:
            log(f"parse ES fail {e}")

    # EMA
    for p in (RAW / "EMA").glob("*.json") if (RAW / "EMA").exists() else []:
        try:
            payload = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        items = payload if isinstance(payload, list) else payload.get("data") or payload.get("ema") or []
        if isinstance(payload, dict) and not items:
            for v in payload.values():
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    items = v
                    break
        n = 0
        for it in items:
            if not isinstance(it, dict):
                continue
            inn = it.get("international_non_proprietary_name_common_name") or it.get("active_substance") or ""
            add_row(
                rows,
                "EMA",
                str(inn),
                it.get("name_of_medicine") or it.get("medicine_name") or "",
                "",
                "",
                it.get("ema_product_number") or "",
            )
            n += 1
        log(f"parse EMA {p.name} {n}")

    # Iceland
    isj = RAW / "IS" / "medicine.json"
    if isj.exists():
        try:
            payload = json.loads(isj.read_text(encoding="utf-8"))
        except Exception as e:
            log(f"parse IS fail {e}")
            payload = {}
        meds = payload.get("medicines") if isinstance(payload, dict) else payload
        if isinstance(meds, list):
            for it in meds:
                inn = it.get("atcCodes") or it.get("atc") or ""
                # Iceland file has medicineName, form, strengthNumber+Unit
                subst = it.get("activeIngredient") or it.get("ingredient") or ""
                add_row(
                    rows,
                    "IS",
                    str(subst) or str(it.get("medicineName") or ""),
                    it.get("medicineName") or "",
                    it.get("form") or "",
                    f"{it.get('strengthNumber') or ''} {it.get('strengthUnit') or ''}".strip(),
                    str(it.get("nordicNumber") or ""),
                )
            log(f"parse IS {len(meds)}")

    # Slovakia
    sk = RAW / "SK" / "lieky_all.json"
    if sk.exists() and sk.stat().st_size > 10:
        try:
            items = json.loads(sk.read_text(encoding="utf-8"))
            for it in items:
                add_row(
                    rows,
                    "SK",
                    it.get("liecivo") or it.get("ATC") or it.get("atc") or "",
                    it.get("nazov") or it.get("Nazov") or it.get("name") or "",
                    it.get("doplnok") or it.get("forma") or "",
                    it.get("sila") or "",
                    str(it.get("sukl_kod") or it.get("kod") or ""),
                )
            log(f"parse SK {len(items)}")
        except Exception as e:
            log(f"parse SK fail {e}")

    # Estonia CSV
    ee = RAW / "EE" / "pakendid.csv"
    if ee.exists():
        blob = ee.read_bytes()
        text = blob.decode("utf-8-sig", "replace")
        sample = text[:2000]
        dialect = csv.Sniffer().sniff(sample, delimiters=";,\t")
        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
        n = 0
        for it in reader:
            keys = {k.lower(): k for k in it.keys() if k}
            def g(*cands):
                for c in cands:
                    k = keys.get(c.lower())
                    if k:
                        return it.get(k) or ""
                for k, orig in keys.items():
                    if any(c.lower() in k for c in cands):
                        return it.get(orig) or ""
                return ""
            add_row(
                rows,
                "EE",
                g("toimeaine", "inn", "active"),
                g("nimetus", "nimi", "name", "ravim"),
                g("ravimvorm", "form"),
                g("toimeaine_sisaldus", "tugevus", "strength"),
                g("pakendi_kood", "kood"),
            )
            n += 1
        log(f"parse EE {n}")

    # Lithuania
    lt = RAW / "LT" / "PreparatasPakuote.csv"
    if lt.exists() and lt.stat().st_size > 100:
        blob = lt.read_bytes()
        text = blob.decode("utf-8-sig", "replace")
        try:
            dialect = csv.Sniffer().sniff(text[:4000], delimiters=";,")
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
        n = 0
        for it in reader:
            keys = {k.lower(): k for k in it.keys() if k}

            def g(*cands):
                for c in cands:
                    for k, orig in keys.items():
                        if c.lower() in k:
                            return it.get(orig) or ""
                return ""

            add_row(
                rows,
                "LT",
                g("veikli", "inn", "medziaga"),
                g("pavadinimas", "preparat"),
                g("forma"),
                g("stiprum", "strength"),
                g("vid", "pakid"),
            )
            n += 1
        log(f"parse LT {n}")

    # Canada zip
    caz = RAW / "CA" / "allfiles.zip"
    if caz.exists() and zipfile.is_zipfile(caz):
        try:
            with zipfile.ZipFile(caz) as z:
                names = z.namelist()
                drug_n = next((n for n in names if re.search(r"drug.*\.txt$", n, re.I) and "_ap" not in n.lower() and "_ia" not in n.lower() and "_dr" not in n.lower()), None)
                ing_n = next((n for n in names if re.search(r"ingred.*\.txt$", n, re.I) and "_ap" not in n.lower() and "_ia" not in n.lower() and "_dr" not in n.lower()), None)
                form_n = next((n for n in names if re.search(r"form.*\.txt$", n, re.I) and "_ap" not in n.lower()), None)
                drugs, ings, forms = {}, {}, {}
                if drug_n:
                    for line in z.read(drug_n).decode("utf-8", "replace").splitlines():
                        parts = next(csv.reader([line]))
                        if len(parts) >= 4:
                            drugs[parts[0]] = {"name": parts[3], "class": parts[2] if len(parts) > 2 else ""}
                if ing_n:
                    for line in z.read(ing_n).decode("utf-8", "replace").splitlines():
                        parts = next(csv.reader([line]))
                        if len(parts) >= 3:
                            ings.setdefault(parts[0], []).append((parts[1] if len(parts) > 1 else "", parts[2] if len(parts) > 2 else "", parts[4] if len(parts) > 4 else "", parts[5] if len(parts) > 5 else ""))
                if form_n:
                    for line in z.read(form_n).decode("utf-8", "replace").splitlines():
                        parts = next(csv.reader([line]))
                        if len(parts) >= 3:
                            forms[parts[0]] = parts[2] if len(parts) > 2 else parts[1]
                for did, d in drugs.items():
                    inn_list = ings.get(did, [])
                    inn = ", ".join(x[1] or x[0] for x in inn_list if (x[1] or x[0]))
                    strength = ", ".join(f"{x[2]} {x[3]}".strip() for x in inn_list if x[2] or x[3])
                    add_row(rows, "CA", inn, d["name"], forms.get(did, ""), strength, did)
                log(f"parse CA drugs {len(drugs)}")
        except Exception as e:
            log(f"parse CA fail {e}")

    # Switzerland OGD zip XML
    chz = RAW / "CH" / "OGD.zip"
    if chz.exists() and zipfile.is_zipfile(chz):
        try:
            import xml.etree.ElementTree as ET

            with zipfile.ZipFile(chz) as z:
                praep = next((n for n in z.namelist() if "Praeparate" in n or "Praeparat" in n), None)
                seq = next((n for n in z.namelist() if "Sequenzen" in n), None)
                dek = next((n for n in z.namelist() if "Deklarationen" in n), None)
                names = {}
                if praep:
                    root = ET.fromstring(z.read(praep))
                    for el in root.iter():
                        tag = el.tag.split("}")[-1]
                        if tag.lower() in {"praeparat", "preparation", "row"}:
                            pass
                    # fallback: all ELEMENT with Zulassungsnummer + Name
                    for el in list(root):
                        d = {c.tag.split("}")[-1]: (c.text or "") for c in list(el)}
                        if not d:
                            continue
                        key = d.get("Zulassungsnummer") or d.get("ZULASSUNGSNUMMER") or d.get("AUTHNR") or ""
                        nm = d.get("Praeparatename") or d.get("PRAEPARATENAME") or d.get("NAME") or d.get("Bezeichnung") or ""
                        if key or nm:
                            names[key or nm] = d
                if dek:
                    root = ET.fromstring(z.read(dek))
                    n = 0
                    for el in list(root):
                        d = {c.tag.split("}")[-1]: (c.text or "") for c in list(el)}
                        inn = d.get("Stoff") or d.get("STOFF") or d.get("Bezeichnung") or d.get("SUBSTANZ") or ""
                        zn = d.get("Zulassungsnummer") or d.get("ZULASSUNGSNUMMER") or ""
                        info = names.get(zn, {})
                        add_row(
                            rows,
                            "CH",
                            inn,
                            info.get("Praeparatename") or info.get("PRAEPARATENAME") or info.get("NAME") or "",
                            info.get("Darreichungsform") or "",
                            d.get("Menge") or d.get("MENGE") or d.get("Stärke") or "",
                            zn,
                        )
                        n += 1
                    log(f"parse CH deklarationen {n}")
        except Exception as e:
            log(f"parse CH fail {e}")

    # Poland XML (stream-ish)
    pl = RAW / "PL" / "overall.xml"
    if pl.exists() and pl.stat().st_size > 1000:
        try:
            import xml.etree.ElementTree as ET

            n = 0
            for event, el in ET.iterparse(pl, events=("end",)):
                tag = el.tag.split("}")[-1]
                if tag.lower() not in {"produktleczniczy", "medicinalproduct", "product", "row"}:
                    # try common RPL tags
                    if tag not in {"produktLeczniczy", "ProduktLeczniczy", "medicinalProduct"}:
                        continue
                def tx(*names):
                    for nm in names:
                        for child in el:
                            if child.tag.split("}")[-1] == nm:
                                return (child.text or "").strip()
                    return ""
                inn = tx("substancjaCzynna", "nazwaPowszechnieStosowana", "commonName", "activeSubstance")
                if not inn:
                    inns = [
                        (c.text or "").strip()
                        for c in el.iter()
                        if c.tag.split("}")[-1] in {"nazwaSubstancji", "substancjaCzynna", "inn"}
                        and (c.text or "").strip()
                    ]
                    inn = ", ".join(inns[:6])
                add_row(
                    rows,
                    "PL",
                    inn,
                    tx("nazwaProduktu", "name", "nazwa"),
                    tx("postacFarmaceutyczna", "form", "postac"),
                    tx("moc", "strength"),
                    tx("identyfikatorProduktuLeczniczego", "id"),
                )
                n += 1
                el.clear()
                if n > 250000:
                    break
            log(f"parse PL {n}")
        except Exception as e:
            log(f"parse PL fail {e}")

    # Latvia JSON
    if (RAW / "LV").exists():
        for p in (RAW / "LV").glob("*"):
            if p.suffix.lower() == ".zip" and zipfile.is_zipfile(p):
                with zipfile.ZipFile(p) as z:
                    for n in z.namelist():
                        if n.endswith(".json"):
                            (RAW / "LV" / Path(n).name).write_bytes(z.read(n))
                        if n.endswith(".xml"):
                            (RAW / "LV" / Path(n).name).write_bytes(z.read(n))
        for p in (RAW / "LV").glob("*.json"):
            try:
                payload = json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                continue
            items = payload if isinstance(payload, list) else payload.get("medicinalProducts") or payload.get("products") or []
            n = 0
            if isinstance(items, list):
                for it in items:
                    if not isinstance(it, dict):
                        continue
                    inn = it.get("inn") or it.get("activeSubstance") or it.get("activeSubstances") or ""
                    if isinstance(inn, list):
                        inn = ", ".join(str(x.get("name") if isinstance(x, dict) else x) for x in inn)
                    add_row(
                        rows,
                        "LV",
                        str(inn),
                        it.get("name") or it.get("productName") or "",
                        it.get("pharmaceuticalForm") or it.get("form") or "",
                        it.get("strength") or "",
                        str(it.get("id") or ""),
                    )
                    n += 1
            log(f"parse LV {p.name} {n}")

    # Ireland XML
    if (RAW / "IE").exists():
        import xml.etree.ElementTree as ET

        for p in (RAW / "IE").glob("*.xml"):
            try:
                n = 0
                for event, el in ET.iterparse(p, events=("end",)):
                    tag = el.tag.split("}")[-1].lower()
                    if "product" not in tag and tag not in {"medicine", "item"}:
                        continue
                    texts = {c.tag.split("}")[-1].lower(): (c.text or "") for c in list(el)}
                    add_row(
                        rows,
                        "IE",
                        texts.get("activesubstance") or texts.get("ingredient") or texts.get("inn") or "",
                        texts.get("productname") or texts.get("name") or "",
                        texts.get("pharmaceuticalform") or texts.get("form") or "",
                        texts.get("strength") or "",
                        texts.get("licence") or texts.get("pa") or "",
                    )
                    n += 1
                    el.clear()
                log(f"parse IE {p.name} {n}")
            except Exception as e:
                log(f"parse IE fail {e}")

    # Italy CSV
    if (RAW / "IT").exists():
        for p in (RAW / "IT").glob("*.csv"):
            blob = p.read_bytes()
            text = blob.decode("utf-8-sig", "replace")
            try:
                dialect = csv.Sniffer().sniff(text[:3000], delimiters=";,")
            except csv.Error:
                dialect = csv.excel
            reader = csv.DictReader(io.StringIO(text), dialect=dialect)
            n = 0
            for it in reader:
                keys = {k.lower(): k for k in it.keys() if k}

                def g(*cands):
                    for c in cands:
                        for k, orig in keys.items():
                            if c.lower() in k:
                                return it.get(orig) or ""
                    return ""

                add_row(
                    rows,
                    "IT",
                    g("principio", "attivo", "inn"),
                    g("farmaco", "nome", "descrizione"),
                    g("forma"),
                    g("dosaggio", "unita"),
                    g("aic", "codice"),
                )
                n += 1
            log(f"parse IT {p.name} {n}")

    # Czech CSV in zip
    if (RAW / "CZ").exists():
        for p in (RAW / "CZ").glob("*.zip"):
            if not zipfile.is_zipfile(p):
                continue
            with zipfile.ZipFile(p) as z:
                for n in z.namelist():
                    if n.lower().endswith(".csv"):
                        (RAW / "CZ" / Path(n).name).write_bytes(z.read(n))
        for p in (RAW / "CZ").glob("*.csv"):
            blob = p.read_bytes()
            for enc in ("utf-8-sig", "cp1250", "latin-1"):
                try:
                    text = blob.decode(enc)
                    break
                except UnicodeDecodeError:
                    text = ""
            if not text:
                continue
            try:
                dialect = csv.Sniffer().sniff(text[:3000], delimiters=";,")
            except csv.Error:
                dialect = csv.excel
            reader = csv.DictReader(io.StringIO(text), dialect=dialect)
            n = 0
            for it in reader:
                keys = {k.lower(): k for k in it.keys() if k}

                def g(*cands):
                    for c in cands:
                        for k, orig in keys.items():
                            if c.lower() in k:
                                return it.get(orig) or ""
                    return ""

                add_row(
                    rows,
                    "CZ",
                    g("latka", "inn", "nazev_latky", "leciva"),
                    g("nazev", "pripravek", "nazev_pripravku"),
                    g("forma", "forma_leciva"),
                    g("sila", "strength"),
                    g("kod", "sukl"),
                )
                n += 1
            log(f"parse CZ {p.name} {n}")

    # Finland XML
    if (RAW / "FI").exists():
        import xml.etree.ElementTree as ET

        for p in (RAW / "FI").glob("*.xml"):
            try:
                n = 0
                for event, el in ET.iterparse(p, events=("end",)):
                    tag = el.tag.split("}")[-1].lower()
                    if "product" not in tag and "valmiste" not in tag and tag not in {"medicine"}:
                        continue
                    texts = {c.tag.split("}")[-1].lower(): (c.text or "") for c in list(el)}
                    inn = texts.get("vaikuttavaaine") or texts.get("ingredient") or texts.get("substance") or ""
                    add_row(
                        rows,
                        "FI",
                        inn,
                        texts.get("nimi") or texts.get("name") or texts.get("valmistenimi") or "",
                        texts.get("laakemuoto") or texts.get("form") or "",
                        texts.get("vahvuus") or texts.get("strength") or "",
                        texts.get("vnr") or texts.get("numero") or "",
                    )
                    n += 1
                    el.clear()
                log(f"parse FI {p.name} {n}")
            except Exception as e:
                log(f"parse FI fail {e}")

    # FDA zip
    usz = RAW / "US" / "drugsfda.zip"
    if usz.exists() and zipfile.is_zipfile(usz):
        try:
            with zipfile.ZipFile(usz) as z:
                prod = next((n for n in z.namelist() if n.lower().endswith("products.txt") or "product" in n.lower()), None)
                if prod:
                    text = z.read(prod).decode("latin-1", "replace")
                    reader = csv.DictReader(io.StringIO(text), delimiter="\t")
                    n = 0
                    for it in reader:
                        add_row(
                            rows,
                            "US",
                            it.get("ActiveIngredient") or it.get("ActiveIngredientName") or "",
                            it.get("DrugName") or it.get("ProductMktStatus") or "",
                            it.get("Form") or it.get("DosageForm") or "",
                            it.get("Strength") or "",
                            it.get("ApplNo") or "",
                        )
                        n += 1
                    log(f"parse US {n}")
        except Exception as e:
            log(f"parse US fail {e}")

    # Sweden NSL zip — substances only
    sez = RAW / "SE" / "sensl.zip"
    if sez.exists() and zipfile.is_zipfile(sez):
        try:
            import xml.etree.ElementTree as ET

            with zipfile.ZipFile(sez) as z:
                xmls = [n for n in z.namelist() if n.lower().endswith(".xml") and "other" in n.lower()]
                if not xmls:
                    xmls = [n for n in z.namelist() if n.lower().endswith(".xml")]
                n = 0
                for xn in xmls[:3]:
                    for event, el in ET.iterparse(io.BytesIO(z.read(xn)), events=("end",)):
                        tag = el.tag.split("}")[-1].lower()
                        if "name" in tag or tag in {"substance", "substans"}:
                            t = (el.text or "").strip()
                            if t and len(t) > 2:
                                add_row(rows, "SE", t, t, "", "", "NSL")
                                n += 1
                        el.clear()
                log(f"parse SE NSL names {n}")
        except Exception as e:
            log(f"parse SE fail {e}")

    # Romania xlsx
    ro = RAW / "RO" / "nomenclator.xlsx"
    if ro.exists() and ro.stat().st_size > 1000:
        try:
            import zipfile as zf

            # xlsx is zip of xml; parse sharedStrings + first sheet roughly
            with zipfile.ZipFile(ro) as z:
                ss = []
                if "xl/sharedStrings.xml" in z.namelist():
                    import xml.etree.ElementTree as ET

                    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
                    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
                    for si in root.findall("m:si", ns):
                        ss.append("".join(t.text or "" for t in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")))
                sheet = next((n for n in z.namelist() if n.startswith("xl/worksheets/sheet")), None)
                if sheet:
                    import xml.etree.ElementTree as ET

                    root = ET.fromstring(z.read(sheet))
                    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
                    n = 0
                    header = []
                    for row in root.findall("m:sheetData/m:row", ns):
                        vals = []
                        for c in row.findall("m:c", ns):
                            t = c.get("t")
                            v = c.find("m:v", ns)
                            val = v.text if v is not None else ""
                            if t == "s" and val.isdigit() and int(val) < len(ss):
                                val = ss[int(val)]
                            vals.append(val or "")
                        if not header:
                            header = [x.lower() for x in vals]
                            continue
                        rec = {header[i] if i < len(header) else f"c{i}": vals[i] if i < len(vals) else "" for i in range(max(len(header), len(vals)))}

                        def g(*cands):
                            for c in cands:
                                for k, v in rec.items():
                                    if c in k:
                                        return v
                            return ""

                        add_row(
                            rows,
                            "RO",
                            g("dci", "substan"),
                            g("denumire", "comercial"),
                            g("form"),
                            g("concentra", "doza"),
                            g("cim", "app"),
                        )
                        n += 1
                    log(f"parse RO {n}")
        except Exception as e:
            log(f"parse RO fail {e}")

    return rows


def dedupe(rows: list[dict]) -> list[dict]:
    seen = set()
    out = []
    for r in rows:
        key = (
            r["country"],
            r["inn"].lower(),
            r["name"].lower(),
            r["form"].lower(),
            r["strength"].lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def write_outputs(rows: list[dict]) -> None:
    rows = dedupe(rows)
    csv_path = OUT / "SRA_thuoc_gop.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["country", "inn", "name", "form", "strength", "extra"])
        w.writeheader()
        w.writerows(rows)
    # compact json for browser
    compact = {
        "v": 1,
        "updated": time.strftime("%Y-%m-%d"),
        "count": len(rows),
        "r": [[r["country"], r["inn"], r["name"], r["form"], r["strength"]] for r in rows],
    }
    js_path = OUT / "search.json"
    js_path.write_text(json.dumps(compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "manifest.json").write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=2), encoding="utf-8")
    by = {}
    for r in rows:
        by[r["country"]] = by.get(r["country"], 0) + 1
    (OUT / "summary.json").write_text(
        json.dumps({"count": len(rows), "by_country": by, "csv": csv_path.name}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log(f"WROTE {len(rows)} rows -> {csv_path.name} {js_path.stat().st_size:,} B json")
    log("by country: " + ", ".join(f"{k}:{v}" for k, v in sorted(by.items())))


def main() -> None:
    t0 = time.time()
    fetch_all()
    rows = parse_rows()
    write_outputs(rows)
    log(f"done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
