"""Check candidate company sites from this computer; save reproducible evidence."""
import concurrent.futures
import datetime
import json
import urllib.request
import sys
from pathlib import Path
from _sites import BRANDS

def check(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=18) as response:
            body = response.read(180000).decode('utf-8', errors='replace')
            import re
            title = re.search(r'<title[^>]*>(.*?)</title>', body, re.I | re.S)
            blocked = any(s in body.lower() for s in ['just a moment...', 'verify you are human', 'access denied', 'website is for sale', 'domain is for sale'])
            return url, dict(status=response.status, url=response.url, title=re.sub(r'\s+', ' ', title[1]).strip() if title else '', reachable=not blocked)
    except Exception as exc:
        return url, dict(reachable=False, error=str(exc))

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    urls = sorted({url for _, url in BRANDS})
    with concurrent.futures.ThreadPoolExecutor(max_workers=18) as pool:
        results = dict(pool.map(check, urls))
    Path('data/company-link-audit.json').write_text(json.dumps(dict(checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), machine='local Windows computer', sites=results), ensure_ascii=False, indent=2), encoding='utf-8')
    print('Checked', len(results), 'reachable', sum(r['reachable'] for r in results.values()))
    for url, r in results.items():
        if not r['reachable']:
            print(url, r.get('error', r.get('title')))
