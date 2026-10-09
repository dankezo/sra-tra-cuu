"""Isolated source ingestion and static publication. Python stdlib + existing requests."""
import argparse
import base64
import csv
import gzip
import hashlib
import io
import json
import os
import re
import sqlite3
import unicodedata
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.parse import quote
from xml.etree import ElementTree as ET

import requests

ROOT = Path(__file__).resolve().parent
SOURCES = {
    'EDQM': ('https://extranet.edqm.eu/publications/recherches_CEP.shtml', 'https://extranet.edqm.eu/4DLink1/4DCGI/EXPORT_WEB_CEP.txt'),
    'FDA': ('https://www.fda.gov/drugs/drug-master-files-dmfs/list-drug-master-files-dmfs', None),
    'WHO': ('https://extranet.who.int/prequal/medicines/prequalified/active-pharmaceutical-ingredients', 'https://extranet.who.int/prequal/medicines/prequalified/active-pharmaceutical-ingredients/export?page&_format=csv'),
}


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def norm(value):
    return re.sub(r'[^a-z0-9]+', ' ', unicodedata.normalize('NFKD', value.casefold()).encode('ascii', 'ignore').decode()).strip()


def day(value):
    value = ' '.join(str(value or '').split())
    if not value:
        return None
    for fmt in ('%d/%m/%Y', '%d %b, %Y', '%Y-%m-%d', '%m/%d/%Y'):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError('Unrecognized source date: ' + value)


def database(path=None):
    con = sqlite3.connect(path or os.environ.get('APISRC_DB', str(ROOT / 'sourcing.sqlite3')))
    con.row_factory = sqlite3.Row
    con.executescript((ROOT / 'schema.sql').read_text(encoding='utf-8'))
    return con


def parse_edqm(text):
    reader = csv.DictReader(io.StringIO(text.replace('\r\r\n', '\n')), delimiter='\t')
    required = {'Substance', 'Certificate (CEP) Holder', 'Certificate (CEP) Number', 'Status CEP', 'Type CEP'}
    if not required.issubset(reader.fieldnames or []):
        raise ValueError('EDQM schema changed; no data published')
    for r in reader:
        raw_status = r['Status CEP'].strip()
        status = next((s for s in ('valid', 'expired', 'suspended', 'withdrawn') if raw_status.lower().startswith(s)), 'unknown')
        holder = r['Certificate (CEP) Holder'].strip()
        country_match = re.search(r'\s([A-Z]{2})$', holder)
        yield dict(inn=r['Substance'].strip(), holder=holder, identifier=r['Certificate (CEP) Number'].strip(),
                   type='CEP', status=status, raw_status=raw_status, country=country_match[1] if country_match else None,
                   issued_at=day(r.get('Issue Date CEP')), expires_at=day(r.get('End date CEP')),
                   renewal_due=day(r.get('Renewal due')), monograph=r.get('Monograph Number'),
                   cep_type=r['Type CEP'], raw_snippet=json.dumps(r, ensure_ascii=False))


def xlsx_rows(content):
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(io.BytesIO(content)) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(t.text or '' for t in el.findall('.//m:t', ns)) for el in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', ns)]
        for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//m:row', ns):
            cells = {}
            for c in row:
                column = re.sub(r'\d', '', c.get('r', ''))
                v = c.findtext('m:v', '', ns)
                if c.get('t') == 's':
                    v = strings[int(v)]
                elif c.get('t') == 'inlineStr':
                    v = ''.join(t.text or '' for t in c.findall('.//m:t', ns))
                cells[column] = v.strip()
            yield [cells.get(c, '') for c in ('A', 'B', 'C', 'D', 'E', 'F')]


def parse_fda(content):
    rows = iter(xlsx_rows(content))
    header = next(rows)
    if header[:3] != ['DMF#', 'STATUS', 'TYPE'] or header[4:6] != ['HOLDER', 'SUBJECT']:
        raise ValueError('FDA schema changed; no data published')
    for number, status, kind, submitted, holder, subject in rows:
        if kind not in ('II', '2'):
            continue
        if not number.isdigit():
            raise ValueError('Invalid FDA number')
        issued = (datetime(1899, 12, 30) + timedelta(days=float(submitted))).date().isoformat() if submitted else None
        yield dict(inn=subject, holder=holder, identifier=number.zfill(6), type='DMF_US',
                   status={'A': 'active', 'I': 'inactive'}.get(status, 'unknown'), raw_status=status,
                   issued_at=issued, raw_snippet=f'DMF {number} | {status} | Type {kind} | {holder} | {subject}')


def parse_who(text):
    reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
    if not {'WHO Product ID', 'INN', 'Applicant', 'Date of prequalification'}.issubset(reader.fieldnames or []):
        raise ValueError('WHO schema changed; no data published')
    for r in reader:
        yield dict(inn=r['INN'].strip(), holder=r['Applicant'].strip(), identifier=r['WHO Product ID'].strip(),
                   type='WHO_PQ', status='valid', raw_status='Listed in WHO prequalified API list',
                   issued_at=day(r['Date of prequalification']), raw_snippet=json.dumps(r, ensure_ascii=False))


def ingest(con, source, content, source_url, file_date=None, date_basis='unreported'):
    page, download = SOURCES[source]
    allowed = urlparse(page).hostname
    if urlparse(source_url).scheme != 'https' or urlparse(source_url).hostname != allowed:
        raise ValueError('Official imports must cite the issuing authority HTTPS URL')
    if source == 'FDA' and not file_date:
        raise ValueError('FDA import requires the source quarter end date')
    if file_date:
        day(file_date)
    started = now()
    run = con.execute('INSERT INTO apisrc_ingest_run(source,source_file_date,date_basis,started_at,status) VALUES(?,?,?,?,?)',
                      (source, file_date, date_basis, started, 'running')).lastrowid
    con.commit()
    count = changed = 0
    try:
        text = content.decode('utf-8-sig') if source != 'FDA' else None
        parser = {'EDQM': lambda: parse_edqm(text), 'WHO': lambda: parse_who(text), 'FDA': lambda: parse_fda(content)}[source]
        records = list(parser())  # Validate complete file before mutating existing source records.
        if not records:
            raise ValueError('Empty official file; previous snapshot retained')
        with con:
            for r in records:
                if not r['inn'] or not r['holder'] or not r['identifier']:
                    raise ValueError('Missing source identity')
                key = norm(r['inn'])
                con.execute('INSERT OR IGNORE INTO apisrc_substance(inn,inn_clean_key,updated_at) VALUES(?,?,?)', (r['inn'], key, started))
                substance = con.execute('SELECT id FROM apisrc_substance WHERE inn_clean_key=?', (key,)).fetchone()[0]
                company_key = norm(r['holder'])
                alias = con.execute('SELECT company_id FROM apisrc_company_alias WHERE alias_norm=? AND source=?', (company_key, source)).fetchone()
                if alias:
                    company = alias[0]
                else:
                    con.execute('INSERT OR IGNORE INTO apisrc_company(canonical_name,name_key,country,created_at) VALUES(?,?,?,?)',
                                (r['holder'], company_key, r.get('country'), started))
                    company = con.execute('SELECT id FROM apisrc_company WHERE name_key=?', (company_key,)).fetchone()[0]
                    con.execute('INSERT INTO apisrc_company_alias(company_id,alias_raw,alias_norm,source) VALUES(?,?,?,?)', (company, r['holder'], company_key, source))
                payload = dict(company_id=company, substance_id=substance, source=source, source_url=source_url,
                               verification='official_verified', source_file_date=file_date, date_basis=date_basis,
                               **{k: r.get(k) for k in ('type', 'identifier', 'holder', 'status', 'raw_status', 'issued_at', 'expires_at', 'renewal_due', 'monograph', 'cep_type', 'raw_snippet')})
                previous = con.execute('SELECT * FROM apisrc_certificate WHERE source=? AND identifier=?', (source, r['identifier'])).fetchone()
                if previous and previous['source_file_date'] and file_date and file_date < previous['source_file_date']:
                    raise ValueError('Older source file rejected')
                if not previous or any(previous[k] != v for k, v in payload.items()):
                    changed += 1
                payload['fetched_at'] = started
                columns = ','.join(payload)
                update = ','.join(f'{k}=excluded.{k}' for k in payload if k not in ('source', 'identifier'))
                con.execute(f'INSERT INTO apisrc_certificate({columns}) VALUES({",".join("?" for _ in payload)}) ON CONFLICT(source,identifier) DO UPDATE SET {update}', tuple(payload.values()))
                count += 1
            # Removed records are retained as unknown, never silently left green.
            removed = con.execute("UPDATE apisrc_certificate SET status='unknown',raw_status='Absent from latest complete source file',fetched_at=?,source_file_date=?,date_basis=? WHERE source=? AND fetched_at<>?", (started, file_date, date_basis, source, started)).rowcount
            changed += removed
            con.execute('UPDATE apisrc_ingest_run SET finished_at=?,rows_in=?,rows_changed=?,status=? WHERE id=?', (now(), count, changed, 'ok', run))
    except Exception as error:
        with con:
            con.execute('UPDATE apisrc_ingest_run SET finished_at=?,status=?,error=? WHERE id=?', (now(), 'error', str(error)[:500], run))
        raise
    return {'source': source, 'rows': count, 'changed': changed, 'file_date': file_date, 'date_basis': date_basis}


def fetch_source(source):
    page, url = SOURCES[source]
    if source == 'FDA':
        response = requests.get(page, timeout=40)
        response.raise_for_status()
        match = re.search(r'href="([^"]+)"[^>]*[^<]*>\s*(\d)(?:st|nd|rd|th) Quarter (\d{4})', response.text)
        if not match:
            raise ValueError('FDA download link unavailable; use official browser download + import')
        url = urljoin(page, match[1].replace('&amp;', '&'))
        quarter, year = int(match[2]), int(match[3])
        file_date = (datetime(year + (quarter == 4), 1 if quarter == 4 else quarter * 3 + 1, 1) - timedelta(days=1)).date().isoformat()
        basis = 'quarter_end'
    else:
        file_date, basis = None, 'unreported'
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    if response.content.lstrip().startswith((b'<', b'<!')):
        raise ValueError('HTML/challenge returned instead of official data')
    if not file_date and response.headers.get('Last-Modified'):
        from email.utils import parsedate_to_datetime
        file_date = parsedate_to_datetime(response.headers['Last-Modified']).date().isoformat()
        basis = 'http_last_modified'
    ROOT.joinpath('raw').mkdir(exist_ok=True)
    suffix = {'EDQM': 'txt', 'WHO': 'csv', 'FDA': 'xlsx'}[source]
    ROOT.joinpath('raw', source.lower() + '.' + suffix).write_bytes(response.content)
    return response.content, url, file_date, basis


def export(con):
    certs = [dict(r) for r in con.execute('SELECT * FROM apisrc_certificate ORDER BY id')]
    # Raw source snippet remains in private SQLite; public report includes the exact relevant fields.
    for r in certs:
        r.pop('raw_snippet')
    data = {'built_at': now(), 'companies': [dict(r) for r in con.execute('SELECT id,canonical_name,country,address,website FROM apisrc_company')],
            'substances': [dict(r) for r in con.execute('SELECT * FROM apisrc_substance')], 'certificates': certs,
            'runs': [dict(r) for r in con.execute('SELECT * FROM apisrc_ingest_run ORDER BY id DESC LIMIT 30')]}
    encoded = base64.b64encode(gzip.compress(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode())).decode()
    html = (ROOT / 'template.html').read_text(encoding='utf-8').replace('<!--STYLE-->', (ROOT / 'style.css').read_text(encoding='utf-8'))
    html = html.replace('<!--DATA-->', encoded).replace('<!--APP-->', (ROOT / 'app.js').read_text(encoding='utf-8'))
    ROOT.joinpath('index.html').write_text(html, encoding='utf-8')
    return {'certificates': len(certs), 'html_bytes': len(html.encode())}


def normalize_substance(con, query):
    url = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/' + quote(query, safe='') + '/synonyms/JSON'
    response = requests.get(url, timeout=15)
    response.raise_for_status()
    info = response.json()['InformationList']['Information']
    if len(info) != 1:
        raise ValueError('Ambiguous PubChem identity; manual review required')
    synonyms = info[0]['Synonym']
    cas = next((s for s in synonyms if re.fullmatch(r'\d{2,7}-\d{2}-\d', s)), None)
    keys = {norm(s) for s in synonyms}
    # Only exact synonym identities; do not propagate base-compound CAS to salts.
    ids = [r['id'] for r in con.execute('SELECT id,inn_clean_key FROM apisrc_substance') if r['inn_clean_key'] in keys]
    with con:
        for substance in ids:
            con.execute('UPDATE apisrc_substance SET cas=?,synonyms=?,updated_at=? WHERE id=?', (cas, json.dumps(synonyms[:150], ensure_ascii=False), now(), substance))
    ROOT.joinpath('raw').mkdir(exist_ok=True)
    ROOT.joinpath('raw', 'pubchem-' + hashlib.sha256(query.encode()).hexdigest()[:12] + '.json').write_text(json.dumps({'url': url, 'fetched_at': now(), 'data': info}), encoding='utf-8')
    return {'query': query, 'cid': info[0]['CID'], 'matched_substances': len(ids), 'cas': cas}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', default=None)
    sub = parser.add_subparsers(dest='action', required=True)
    sub.add_parser('init')
    imp = sub.add_parser('import')
    imp.add_argument('source', choices=SOURCES)
    imp.add_argument('file', type=Path)
    imp.add_argument('--url', required=True)
    imp.add_argument('--file-date')
    imp.add_argument('--date-basis', default='unreported', choices=['unreported', 'quarter_end', 'source_reported', 'http_last_modified'])
    pull = sub.add_parser('fetch')
    pull.add_argument('source', choices=SOURCES)
    sub.add_parser('export')
    normalization = sub.add_parser('normalize')
    normalization.add_argument('query')
    args = parser.parse_args()
    with database(args.db) as con:
        if args.action == 'import':
            result = ingest(con, args.source, args.file.read_bytes(), args.url, args.file_date, args.date_basis)
        elif args.action == 'fetch':
            result = ingest(con, args.source, *fetch_source(args.source))
        elif args.action == 'export':
            result = export(con)
        elif args.action == 'normalize':
            result = normalize_substance(con, args.query)
        else:
            result = {'schema': 'ready'}
    print(json.dumps(result))


if __name__ == '__main__':
    main()
