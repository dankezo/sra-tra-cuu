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

if ".htrack i.ema" not in prefix:
    prefix = prefix.replace(
        ".htrack i.m { background: #C45C3A; }",
        ".htrack i.m { background: #C45C3A; }\n    .htrack i.ema { background: #1e3a8a; }\n    .htrack i.w { background: #fff; box-shadow: inset 0 0 0 1px var(--line); }",
    )
if 'id="hcrawl"' not in prefix:
    prefix = prefix.replace(
        '<div id="hcomp"></div>',
        '<div id="hcomp"></div>\n        <div id="hcrawl"></div>',
    )

CSS = r"""/* sra-search-ui */
    .tra-layout {
      display: grid; grid-template-columns: 300px minmax(0, 1fr);
      gap: 16px; align-items: start;
    }
    .tra-side {
      position: sticky; top: 56px;
      background: var(--card); border: 1px solid var(--line);
      border-radius: 14px; padding: 12px;
    }
    .tra-side .search-bar {
      display: grid; grid-template-columns: 1fr 64px; gap: 6px; margin: 0 0 8px;
    }
    .tra-side input, #mgo {
      font: inherit; padding: 9px 10px; border: 1px solid var(--line);
      border-radius: 10px; background: #fff; font-weight: 650; color: var(--ink);
    }
    .tra-side input { width: 100%; font-size: 15px; font-weight: 500; }
    #mgo { background: var(--teal); color: #fff; border-color: var(--teal); cursor: pointer; }
    #mgo:hover { background: var(--claude); border-color: var(--claude); }
    .qwrap { position: relative; }
    #suggest {
      position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 50;
      background: #fff; border: 1px solid var(--line); border-radius: 12px;
      box-shadow: 0 10px 28px rgba(28,25,23,.12); overflow: hidden;
    }
    #suggest button {
      display: flex; flex-direction: column; width: 100%; text-align: left; gap: 2px;
      align-items: flex-start;
      border: 0; border-bottom: 1px solid var(--line); background: #fff;
      padding: 8px 12px; cursor: pointer; font: inherit;
      color: var(--ink); white-space: normal; line-height: 1.25;
    }
    #suggest button:last-child { border-bottom: 0; }
    #suggest button.on, #suggest button:hover { background: #E7F3F1; }
    #suggest .inn {
      font-weight: 750; color: var(--ink); white-space: normal;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden; max-width: 100%;
    }
    #suggest .n { flex: 0 0 auto; color: var(--muted); font-size: 12px; font-weight: 650; }
    .lang-mini {
      display: flex; border: 1px solid var(--line); border-radius: 999px;
      overflow: hidden; margin: 0 0 12px; width: max-content;
    }
    .lang-mini button {
      border: 0; background: transparent; font: inherit; font-size: 12px; font-weight: 800;
      padding: 5px 10px; cursor: pointer; color: var(--ink);
    }
    .lang-mini button.on { background: var(--ink); color: #fff; }
    .side-block { margin: 0 0 12px; }
    .side-lab {
      margin: 0 0 6px; font-size: 11px; font-weight: 800; letter-spacing: .08em;
      text-transform: uppercase; color: var(--muted);
    }
    .mg-lab { font-size: 12.5px; font-weight: 700; margin: 0 0 4px; }
    .mg-sliders { position: relative; height: 28px; }
    .mg-sliders input[type=range] {
      position: absolute; left: 0; width: 100%; top: 8px;
      pointer-events: none; appearance: none; background: none; height: 4px;
    }
    .mg-sliders input[type=range]::-webkit-slider-runnable-track {
      height: 4px; background: #E4DCD0; border-radius: 4px;
    }
    .mg-sliders input[type=range]::-webkit-slider-thumb {
      pointer-events: all; appearance: none; width: 16px; height: 16px;
      border-radius: 50%; background: var(--teal); border: 2px solid #fff;
      box-shadow: 0 0 0 1px var(--teal); margin-top: -6px; cursor: pointer;
    }
    .mg-sliders input[type=range]::-moz-range-track {
      height: 4px; background: #E4DCD0; border-radius: 4px;
    }
    .mg-sliders input[type=range]::-moz-range-thumb {
      pointer-events: all; width: 16px; height: 16px; border: 0;
      border-radius: 50%; background: var(--teal); cursor: pointer;
    }
    .form-filters, .src-mini { display: flex; flex-wrap: wrap; gap: 5px; }
    .form-filters { max-height: 148px; overflow: auto; }
    .form-filters button, .src-mini button, .flag-list button {
      font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
      border: 1px solid var(--line); background: #fff; color: var(--ink);
      border-radius: 999px; padding: 4px 9px;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .form-filters button.on, .src-mini button.on, .flag-list button.on {
      background: #E7F3F1; border-color: var(--teal); color: var(--teal);
    }
    .flag-list .src-mini { margin-bottom: 6px; }
    .flag-list .src-mini button { width: auto; border-radius: 999px; }
    .flag-list {
      display: flex; flex-direction: column; gap: 3px;
      max-height: 280px; overflow: auto; margin-top: 8px; padding-right: 2px;
    }
    .flag-list > button { justify-content: flex-start; border-radius: 8px; width: 100%; }
    .flag-list .dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
    .flag-list .dot.n { background: var(--teal); }
    .flag-list .dot.ema { background: #1e3a8a; }
    .flag-list .dot.m { background: var(--claude); }
    .tra-toolbar {
      display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center;
      margin: 0 0 10px; font-size: 13px; color: var(--muted);
    }
    .picked-bar {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      width: 100%;
    }
    .picked-bar button, .picked-bar select {
      font: inherit; font-size: 12.5px; font-weight: 700;
      border: 1px solid var(--line); background: var(--card); border-radius: 8px;
      padding: 5px 10px; cursor: pointer;
    }
    #sel-export { background: var(--teal); color: #fff; border-color: var(--teal); }
    #med-clip { max-height: 70vh; }
    #tra-meta, #tra-hit { margin: 0; }
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
    table.med td.ck { width: 28px; }
    table.med td.ck input { width: 15px; height: 15px; accent-color: var(--teal); vertical-align: middle; }
    .cg-flag { display: inline-flex; align-items: center; }
    .cg-n { color: var(--muted); font-weight: 650; font-size: 12.5px; }
    .more {
      display: block; width: 100%; border: 0; background: #F6F1E8; color: var(--teal);
      font: inherit; font-weight: 800; padding: 8px; cursor: pointer;
    }
    a.src {
      display: inline-flex; align-items: center; white-space: nowrap;
      background: #E7F3F1; color: var(--teal); text-decoration: none;
      border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 800;
      letter-spacing: .04em; text-transform: lowercase;
    }
    a.src:hover { background: var(--teal); color: #fff; }
    a.src.ema { background: #E8EEFC; color: #1e3a8a; text-transform: uppercase; }
    a.src.ema:hover { background: #1e3a8a; color: #fff; }
    a.co { color: var(--teal); font-weight: 650; text-decoration: none; border-bottom: 1px solid #C5E4DE; }
    a.co:hover { color: var(--claude); border-color: var(--claude); }
    a.co.g { color: var(--muted); border-bottom-style: dashed; }
    img.flg {
      display: inline-block; width: 18px; height: 13px; object-fit: cover;
      border-radius: 2px; box-shadow: 0 0 0 1px rgba(28,25,23,.12);
      vertical-align: -1px; flex: 0 0 auto;
    }
    span.flag { display: inline-flex; align-items: center; margin-right: 6px; }
    span.flag img.flg { width: 20px; height: 15px; }
    #hcrawl { margin-top: 16px; font-size: 13px; }
    #hcrawl table { font-size: 12.5px; }
    #hcrawl td.how { color: var(--muted); font-size: 12.5px; }
    .htrack i.ema { background: #1e3a8a; }
    .htrack i.w { background: #fff; box-shadow: inset 0 0 0 1px var(--line); }
    @media (max-width: 960px) {
      .tra-layout { grid-template-columns: 1fr; }
      .tra-side { position: static; }
      #tra .search-sticky { top: 0; }
      table.med thead { display: none; }
      table.med, table.med tbody, table.med tr, table.med td { display: block; width: 100%; min-width: 0; }
      table.med tbody tr { padding: 10px 12px; border-bottom: 1px solid var(--line); }
      table.med td { padding: 1px 0; }
      table.med td.num, table.med td.ck { display: inline; }
      table.med td.inn { font-weight: 800; font-size: 14px; }
      table.med td.fm, table.med td.st { display: inline; color: var(--muted); font-size: 13px; padding-right: 8px; }
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
      <p>Gõ INN hoặc tên thuốc. Lọc bên trái: khu vực, dạng bào chế, khoảng mg. EMA hiện dưới từng nước EEA (chip EMA). Tick dòng để giữ khi đổi hoạt chất — rồi export Excel.</p>
      <div class="tra-layout">
        <aside class="tra-side no-print">
          <div class="search-bar">
            <div class="qwrap">
              <input id="mq" type="search" placeholder="vd. atorvastatin, paracetamol…" autocomplete="off" spellcheck="false" />
              <div id="suggest" hidden></div>
            </div>
            <button type="button" id="mgo">Tìm</button>
          </div>
          <div class="lang-mini" role="group" aria-label="Dạng bào chế">
            <button type="button" data-guide="orig" class="on">Gốc</button>
            <button type="button" data-guide="en">EN</button>
            <button type="button" data-guide="vi">VI</button>
          </div>
          <div class="side-block">
            <p class="side-lab">Hàm lượng</p>
            <div class="mg-lab" id="mg-val">0 – 1000+ mg</div>
            <div class="mg-sliders">
              <input id="mg-min" type="range" min="0" max="1000" value="0" />
              <input id="mg-max" type="range" min="0" max="1000" value="1000" />
            </div>
          </div>
          <div class="side-block">
            <p class="side-lab">Dạng bào chế</p>
            <div id="mforms" class="form-filters"></div>
          </div>
          <div class="side-block">
            <p class="side-lab">Khu vực</p>
            <div id="msrc" class="src-mini"></div>
            <div id="mflags" class="flag-list"></div>
          </div>
        </aside>
        <div class="tra-main">
          <div class="tra-toolbar no-print">
            <p id="tra-meta">Đang nạp dữ liệu thuốc…</p>
            <p id="tra-hit"></p>
            <div class="picked-bar">
              <label><input type="checkbox" id="sel-page" /> Chọn trang này</label>
              <button type="button" id="sel-match">Chọn hết kết quả</button>
              <span id="sel-n">0 đã chọn</span>
              <button type="button" id="sel-export">Export Excel</button>
              <button type="button" id="sel-clear">Bỏ chọn</button>
              <label>Hiện
                <select id="page-size">
                  <option value="25">25</option>
                  <option value="50" selected>50</option>
                  <option value="100">100</option>
                  <option value="0">hết</option>
                </select>
              </label>
            </div>
          </div>
          <p class="empty" id="mnone">Không có dòng khớp. Thử INN tiếng Latin (vd atorvastatin).</p>
          <div class="clip" id="med-clip">
            <div id="med-groups"></div>
          </div>
        </div>
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
prefix = prefix.replace(
    '<tr data-df="dump"><td>🇧🇬 Bulgaria</td><td><span class="tag-dump">Có file</span></td><td class="fmt">PDF</td><td>Có — Ctrl+F trên PDF</td>',
    '<tr data-df="dump"><td>🇧🇬 Bulgaria</td><td><span class="tag-dump">Có file</span></td><td class="fmt">Excel</td><td>Có — IAL Register + Centrally Authorised</td>',
)

prefix = prefix.replace(
    '<button type="button" data-guide="orig" class="on">Tiếng gốc</button>',
    '<button type="button" data-guide="orig" class="on">Gốc</button>',
)
prefix = prefix.replace(
    '<button type="button" data-guide="en">English</button>',
    '<button type="button" data-guide="en">EN</button><button type="button" data-guide="vi">VI</button>',
)
prefix = prefix.replace(
    '<button type="button" data-guide="en" class="on">English</button>',
    '<button type="button" data-guide="en">EN</button><button type="button" data-guide="vi">VI</button>',
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
