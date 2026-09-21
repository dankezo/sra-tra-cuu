# -*- coding: utf-8 -*-
"""Rebuild index.html from current prefix + _app.js. Idempotent. Then run _embed.py."""
import re
from pathlib import Path

root = Path(__file__).resolve().parent
html_path = root / "index.html"
js = (root / "_app.js").read_text(encoding="utf-8")
raw = html_path.read_text(encoding="utf-8")
cut = raw.find('<script type="application/json"')
if cut < 0:
    raise SystemExit("json marker missing")
prefix = raw[:cut]

prefix = prefix.replace('<html lang="en" data-guide="en">', '<html lang="vi" data-guide="orig">')
prefix = prefix.replace('<html lang="vi" data-guide="en">', '<html lang="vi" data-guide="orig">')
prefix = prefix.replace('<html lang="en" data-guide="orig">', '<html lang="vi" data-guide="orig">')

CSS = r"""/* sra-search-ui */
    .tra-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    #tra .search-sticky {
      position: sticky; top: 48px; z-index: 20;
      background: color-mix(in srgb, var(--paper) 92%, white);
      backdrop-filter: blur(8px);
      margin: 0 -4px; padding: 8px 4px 10px;
    }
    .search-bar {
      display: grid; grid-template-columns: 1fr 88px; gap: 8px; margin: 0 0 8px;
      overflow: visible;
    }
    .search-bar input, #mgo {
      font: inherit; padding: 10px 12px; border: 1px solid var(--line);
      border-radius: 10px; background: var(--card); font-weight: 650;
    }
    .search-bar input { width: 100%; font-size: 16px; font-weight: 500; color: var(--ink); }
    #mgo {
      background: var(--teal); color: #fff; border-color: var(--teal); cursor: pointer;
    }
    #mgo:hover { background: var(--claude); border-color: var(--claude); }
    .qwrap { position: relative; overflow: visible; }
    #suggest {
      position: absolute; left: 4px; right: 4px; z-index: 50;
      background: #fff; border: 1px solid var(--line); border-radius: 12px;
      box-shadow: 0 10px 28px rgba(28,25,23,.12); overflow: hidden;
    }
    #suggest button {
      display: flex; width: 100%; text-align: left; gap: 10px; align-items: center;
      border: 0; border-bottom: 1px solid var(--line); background: #fff;
      padding: 8px 12px; cursor: pointer; font: inherit;
      color: var(--ink); white-space: nowrap; line-height: 1.25; min-height: 0;
    }
    #suggest button:last-child { border-bottom: 0; }
    #suggest button.on, #suggest button:hover { background: #E7F3F1; }
    #suggest .inn {
      flex: 1; min-width: 0; font-weight: 750; color: var(--ink);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    #suggest .n {
      flex: 0 0 auto; margin-left: auto; color: var(--muted);
      font-size: 12px; font-weight: 650; white-space: nowrap;
    }
    .filters {
      display: flex; flex-wrap: nowrap; align-items: center; gap: 6px;
      overflow-x: auto; overflow-y: hidden; padding: 2px 0 4px;
      scrollbar-width: thin;
    }
    .filters::-webkit-scrollbar { height: 4px; }
    .filters::-webkit-scrollbar-thumb { background: #D6CCC0; border-radius: 4px; }
    .filters button {
      flex: 0 0 auto; white-space: nowrap;
      font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer;
      border: 1px solid var(--line); background: var(--card); color: var(--ink);
      border-radius: 999px; padding: 4px 10px; min-height: 32px;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .filters button.on[data-src] { background: var(--ink); color: #fff; border-color: var(--ink); }
    .filters button.on[data-cc] { background: #E7F3F1; border-color: var(--teal); color: var(--teal); }
    .filters .sep {
      flex: 0 0 1px; width: 1px; align-self: stretch; margin: 4px 2px;
      background: var(--line);
    }
    img.flg {
      display: inline-block; width: 18px; height: 13px; object-fit: cover;
      border-radius: 2px; box-shadow: 0 0 0 1px rgba(28,25,23,.12);
      vertical-align: -1px; flex: 0 0 auto;
    }
    span.flag { display: inline-flex; align-items: center; margin-right: 6px; }
    span.flag img.flg { width: 20px; height: 15px; }
    #med-clip { max-height: none; }
    #tra-meta, #tra-hit { font-size: 13px; color: var(--muted); margin: 0 0 8px; }
    details.cg { background: var(--card); border-bottom: 1px solid var(--line); margin: 0; }
    details.cg:first-child { border-radius: 14px 14px 0 0; }
    details.cg:last-child { border-radius: 0 0 14px 14px; border-bottom: 0; }
    details.cg > summary {
      cursor: pointer; list-style: none; padding: 10px 14px;
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      font-size: 14px; font-weight: 700;
    }
    details.cg > summary::-webkit-details-marker { display: none; }
    details.cg > summary::after { content: "+"; margin-left: auto; color: var(--teal); font-weight: 800; }
    details.cg[open] > summary::after { content: "–"; }
    details.cg .cg-body { border-top: 1px solid var(--line); overflow-x: auto; }
    details.cg[open] .cg-prev { display: none; }
    .cg-prev { width: 100%; font-weight: 500; font-size: 12.5px; color: var(--muted); padding: 0 0 2px; }
    .cg-prev div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    table.med { font-size: 13px; margin: 0; min-width: 0; }
    .cg-flag { display: inline-flex; align-items: center; }
    .cg-n { color: var(--muted); font-weight: 650; font-size: 12.5px; }
    a.src {
      display: inline-flex; align-items: center; white-space: nowrap;
      background: #E7F3F1; color: var(--teal); text-decoration: none;
      border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 800;
      letter-spacing: .04em; text-transform: lowercase;
    }
    a.src:hover { background: var(--teal); color: #fff; }
    a.src.ema { background: #E8EEFC; color: #1e3a8a; text-transform: uppercase; }
    a.src.ema:hover { background: #1e3a8a; color: #fff; }
    a.src.miss { background: #FDECEC; color: var(--warn); }
    a.co { color: var(--teal); font-weight: 650; text-decoration: none; border-bottom: 1px solid #C5E4DE; }
    a.co:hover { color: var(--claude); border-color: var(--claude); }
    a.co.g { color: var(--muted); border-bottom-style: dashed; }
    @media (max-width: 860px) {
      #tra .search-sticky { top: 0; }
      #mgo { min-height: 44px; padding: 10px 8px; }
      table.med thead { display: none; }
      table.med, table.med tbody, table.med tr, table.med td { display: block; width: 100%; min-width: 0; }
      table.med tbody tr {
        padding: 10px 12px; border-bottom: 1px solid var(--line);
      }
      table.med td { padding: 1px 0; }
      table.med td.num { display: none; }
      table.med td.inn { font-weight: 800; font-size: 14px; }
      table.med td.nm { font-size: 14px; }
      table.med td.fm, table.med td.st { display: inline; color: var(--muted); font-size: 13px; padding-right: 8px; }
      table.med td.src { margin-top: 4px; }
      nav.toc { position: static; }
    }
/* /sra-search-ui */
"""

if "/* sra-search-ui */" in prefix:
    prefix = re.sub(r"/\* sra-search-ui \*/.*?/\* /sra-search-ui \*/", CSS.strip(), prefix, flags=re.S)
else:
    prefix = prefix.replace("  </style>", CSS + "  </style>", 1)

TRA = r'''    <section id="tra">
      <div class="tra-head">
        <div>
          <p class="kicker">Local · file chính thức đã tải về máy</p>
          <h2>Tra hoạt chất / tên thuốc</h2>
        </div>
      </div>
      <p>Gõ INN hoặc tên thuốc. Kết quả gom theo nước — bấm thẻ để mở hết dòng. Chỉ thuốc đang lưu hành (đã bỏ cancelled / withdrawn / ngừng bán). Chip EMA = duyệt tập trung EU.</p>
      <div class="search-sticky no-print">
        <div class="search-bar">
          <div class="qwrap">
            <input id="mq" type="search" placeholder="vd. atorvastatin, paracetamol, lisinopril…" autocomplete="off" spellcheck="false" />
          </div>
          <button type="button" id="mgo">Tìm</button>
        </div>
        <div id="suggest" hidden></div>
        <div id="mfilters" class="filters" aria-label="Lọc nguồn và nước"></div>
      </div>
      <p id="tra-meta">Đang nạp dữ liệu thuốc…</p>
      <p id="tra-hit"></p>
      <p class="empty" id="mnone">Không có dòng khớp. Thử INN tiếng Latin (vd atorvastatin).</p>
      <div class="clip" id="med-clip">
        <div id="med-groups"></div>
      </div>
    </section>
'''

prefix, ntra = re.subn(
    r"    <section id=\"tra\">.*?</section>\r?\n",
    TRA,
    prefix,
    count=1,
    flags=re.S,
)
if ntra != 1:
    raise SystemExit(f"tra section replace failed ({ntra})")

prefix = re.sub(
    r'\s*<details class="fold no-print" id="taithieu">.*?</details>\r?\n',
    "\n",
    prefix,
    count=1,
    flags=re.S,
)
prefix = prefix.replace('      <a href="#taithieu">Tải dump thiếu</a>\n', "")

prefix = prefix.replace(
    '<button type="button" data-guide="orig">Original</button>',
    '<button type="button" data-guide="orig" class="on">Tiếng gốc</button>',
)
prefix = prefix.replace(
    '<button type="button" data-guide="orig" class="on">Original</button>',
    '<button type="button" data-guide="orig" class="on">Tiếng gốc</button>',
)
prefix = prefix.replace(
    '<button type="button" data-guide="en" class="on">English</button>',
    '<button type="button" data-guide="en">English</button>',
)

prefix = prefix.rstrip() + "\n"

out = (
    prefix
    + '  <script type="application/json" id="sra-med">{}</script>\n'
    + "  <script>\n"
    + js
    + "  </script>\n"
    + "</body>\n</html>\n"
)
html_path.write_text(out, encoding="utf-8")
print("rebuilt", round(html_path.stat().st_size / 1e6, 3), "mb")
