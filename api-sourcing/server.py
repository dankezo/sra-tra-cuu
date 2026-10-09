"""Loopback-only server: public HTML allowlist, optional web search, one-time local key setup."""
import argparse
import html
import json
import os
import secrets
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import gateway

ROOT=Path(__file__).resolve().parent


class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):
        pass  # Setup tokens and query/key values never go into access logs.

    def respond(self,code,body,kind='text/html; charset=utf-8'):
        body=body.encode() if isinstance(body,str) else body
        self.send_response(code);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(body)

    def valid_host(self):
        return self.headers.get('Host') in (f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}')

    def do_GET(self):
        if not self.valid_host():return self.respond(403,'Invalid host')
        parsed=urlparse(self.path)
        if parsed.path=='/setup':
            token=parse_qs(parsed.query).get('token',[''])[0]
            if not self.server.setup_token or not secrets.compare_digest(token,self.server.setup_token):return self.respond(403,'Invalid setup token')
            return self.respond(200,'<html lang="vi"><meta charset="utf-8"><title>Cấu hình API Sourcing cục bộ</title><h1>Cấu hình khóa Tavily</h1><p>Khóa chỉ lưu trong .env bị Git bỏ qua, không xuất vào HTML.</p><form method="post" action="/setup"><input type="hidden" name="token" value="'+html.escape(token)+'"><label>Khóa Tavily <input type="password" name="key" autocomplete="off" required></label><button>Lưu cấu hình cục bộ</button></form></html>')
        if parsed.path=='/api-sourcing/search':
            try:
                result=gateway.search(parse_qs(parsed.query).get('q',[''])[0])
                return self.respond(200,json.dumps(result),'application/json')
            except ValueError as error:return self.respond(400,json.dumps({'error':str(error)}),'application/json')
        if parsed.path=='/api-sourcing/health':
            return self.respond(200,json.dumps({'providers':gateway.providers(),'reader':bool(os.environ.get('JINA_API_KEY')),'local_only':True}),'application/json')
        files={'/':ROOT.parent/'index.html','/index.html':ROOT.parent/'index.html','/api-sourcing/':ROOT/'index.html','/api-sourcing/index.html':ROOT/'index.html'}
        if parsed.path in files:return self.respond(200,files[parsed.path].read_bytes())
        return self.respond(404,'Not found')

    def do_POST(self):
        expected=f'http://{self.headers.get("Host","")}'
        if not self.valid_host() or self.headers.get('Origin')!=expected:return self.respond(403,'Invalid origin')
        if self.path!='/setup':return self.respond(404,'Not found')
        length=int(self.headers.get('Content-Length','0'))
        if not 0<length<4096:return self.respond(400,'Invalid request length')
        fields=parse_qs(self.rfile.read(length).decode())
        token=fields.get('token',[''])[0];key=fields.get('key',[''])[0]
        if not self.server.setup_token or not secrets.compare_digest(token,self.server.setup_token):return self.respond(403,'Invalid token')
        if not key.startswith('tvly-') or any(c.isspace() for c in key) or '*' in key:return self.respond(400,'Invalid Tavily key')
        env=ROOT.parent/'.env';lines=env.read_text(encoding='utf-8').splitlines() if env.exists() else []
        lines=[line for line in lines if not line.startswith('TAVILY_API_KEY=')]
        env.write_text('\n'.join(lines+['TAVILY_API_KEY='+key])+'\n',encoding='utf-8')
        os.environ['TAVILY_API_KEY']=key;self.server.setup_token=None
        return self.respond(200,'<meta charset="utf-8"><h1>Đã lưu khóa Tavily cục bộ</h1><p>Không thêm thẻ thanh toán. Không thay đổi gói dịch vụ.</p><a href="/api-sourcing/">Mở API Sourcing</a>')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--port',type=int,default=8766);p.add_argument('--setup',action='store_true');args=p.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    server.setup_token=secrets.token_urlsafe(24) if args.setup else None
    print(f'Local: http://127.0.0.1:{args.port}/api-sourcing/',flush=True)
    if server.setup_token:print(f'Setup: http://127.0.0.1:{args.port}/setup?token={server.setup_token}',flush=True)
    server.serve_forever()
