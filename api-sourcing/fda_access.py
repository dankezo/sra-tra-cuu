"""Single-flight accessdata connector: respects robots, 30s between requests, no redirects."""
import re
import threading
import time
from pathlib import Path
from urllib.parse import urlparse
import requests

ROOT=Path(__file__).resolve().parent
HOST='www.accessdata.fda.gov'
LOCK=threading.Lock()


def allowed(robots, path):
    # FDA robots includes glob patterns that urllib.robotparser does not implement.
    wildcard=False
    for line in robots.splitlines():
        key,_,value=line.partition(':');key=key.strip().lower();value=value.split('#')[0].strip()
        if key=='user-agent':
            wildcard=value=='*'
        if wildcard and key=='disallow' and value and re.match(re.escape(value).replace(r'\*','.*'),path,re.I):
            return False
    return True


def fetch(url):
    parsed=urlparse(url)
    if parsed.scheme!='https' or parsed.hostname!=HOST or parsed.username or parsed.password:
        raise ValueError('Only official accessdata HTTPS URLs accepted')
    with LOCK:
        # Shared filesystem timestamp also covers other invocations through this process.
        ROOT.joinpath('private').mkdir(exist_ok=True)
        stamp=ROOT/'private/fda-last-request'
        def request(target):
            elapsed=time.time()-float(stamp.read_text() if stamp.exists() else '0')
            if elapsed<30:
                time.sleep(30-elapsed)
            stamp.write_text(str(time.time()))
            r=requests.get(target,timeout=20,allow_redirects=False)
            r.raise_for_status()
            if 300<=r.status_code<400:
                raise ValueError('FDA redirect requires a new robots check')
            return r.text
        robots_file=ROOT/'private/fda-robots.txt'
        if not robots_file.exists() or time.time()-robots_file.stat().st_mtime>86400:
            robots_file.write_text(request('https://'+HOST+'/robots.txt'))
        if not allowed(robots_file.read_text(), parsed.path):
            raise ValueError('Path disallowed by accessdata robots.txt')
        return request(url)
