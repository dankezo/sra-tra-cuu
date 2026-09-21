    (function () {
      const root = document.documentElement;
      const q = document.getElementById("q");
      const none = document.getElementById("none");
      const rows = [...document.querySelectorAll("table.sra tbody tr")];
      const chips = [...document.querySelectorAll(".toolbar .chip[data-f]")];
      const guideBtns = [...document.querySelectorAll(".lang-switch button")];
      let filter = "all";
      let saved = "en";
      try { saved = localStorage.getItem("sra-guide") || "en"; } catch (e) {}

      function apply() {
        const v = (q && q.value || "").trim().toLowerCase();
        let n = 0;
        rows.forEach((el) => {
          if (el.classList.contains("grp")) {
            el.style.display = "";
            return;
          }
          const g = el.dataset.g;
          const okG = filter === "all" || g === filter;
          const okQ = !v || (el.dataset.keys || "").includes(v) || el.innerText.toLowerCase().includes(v);
          const show = okG && okQ;
          el.style.display = show ? "" : "none";
          if (show) n++;
        });
        if (none) none.style.display = n ? "none" : "block";
      }
      if (q) q.addEventListener("input", apply);
      chips.forEach((btn) => {
        btn.addEventListener("click", () => {
          filter = btn.dataset.f;
          chips.forEach((c) => c.classList.toggle("on", c === btn));
          apply();
        });
      });
      document.querySelectorAll(".plus").forEach((el) => {
        el.addEventListener("blur", () => {
          const t = (el.textContent || "").trim();
          if (/^https?:\/\//i.test(t)) el.textContent = t;
        });
      });

      const LBL = {
        orig: {
          kicker: "Local · file chính thức đã tải về máy",
          title: "Tra hoạt chất / tên thuốc",
          lede: "Gõ INN hoặc tên thuốc. Kết quả gom theo nước — bấm thẻ để mở hết dòng. Chỉ thuốc đang lưu hành (đã bỏ cancelled / withdrawn / ngừng bán). Chip EMA = duyệt tập trung EU.",
          ph: "vd. atorvastatin, paracetamol, lisinopril…",
          find: "Tìm",
          all: "Tất cả",
          dump: "dump",
          ema: "EMA",
          metaWait: "Đang nạp dữ liệu thuốc…",
          type2: "Gõ ít nhất 2 ký tự.",
          empty: "Không có dòng khớp. Thử INN tiếng Latin (vd atorvastatin).",
          rows: "dòng",
          countries: "nước",
          tap: "Bấm thẻ nước để mở hết dòng. Chỉ thuốc đang lưu hành.",
          inn: "Hoạt chất (INN)",
          product: "Tên thuốc",
          form: "Dạng",
          str: "Hàm lượng",
          co: "Công ty",
          src: "Nguồn",
          site: "Tìm website công ty",
          rec: "hồ sơ",
          hit: function (n, c) { return n.toLocaleString("vi-VN") + " dòng · " + c + " nước — bấm thẻ nước để mở hết dòng."; }
        },
        en: {
          kicker: "Local · official dumps on this page",
          title: "Search active substance / product",
          lede: "Type an INN or product name. Results group by country. Tap a card to open every matching row. Circulating medicines only (cancelled / withdrawn / not marketed removed). EMA chip = centralised EU authorisation.",
          ph: "e.g. atorvastatin, paracetamol, lisinopril…",
          find: "Search",
          all: "All",
          dump: "dump",
          ema: "EMA",
          metaWait: "Loading medicines…",
          type2: "Type at least 2 characters.",
          empty: "No rows matched. Try a Latin INN (e.g. atorvastatin).",
          rows: "rows",
          countries: "countries",
          tap: "Tap a country card to open every row. Circulating medicines only.",
          inn: "INN",
          product: "Product",
          form: "Form",
          str: "Strength",
          co: "Company",
          src: "Source",
          site: "Find company website",
          rec: "record",
          hit: function (n, c) { return n.toLocaleString("en-US") + " rows · " + c + " countries — tap a card to open all rows."; }
        }
      };
      function loc() {
        return LBL[root.dataset.guide === "orig" ? "orig" : "en"];
      }

      function paintUi(mode, forPrint) {
        document.querySelectorAll(".ui").forEach((el) => {
          const o = el.getAttribute("data-o") || "";
          const e = el.getAttribute("data-e") || o;
          el.textContent = forPrint && o !== e ? o + " / " + e : (mode === "en" ? e : o);
        });
        const L = LBL[mode === "orig" ? "orig" : "en"];
        const kicker = document.getElementById("tra-kicker");
        const title = document.getElementById("tra-title");
        const lede = document.getElementById("tra-lede");
        const mqEl = document.getElementById("mq");
        const mgoEl = document.getElementById("mgo");
        const mnoneEl = document.getElementById("mnone");
        if (kicker) kicker.textContent = L.kicker;
        if (title) title.textContent = L.title;
        if (lede) lede.textContent = L.lede;
        if (mqEl) mqEl.placeholder = L.ph;
        if (mgoEl) mgoEl.textContent = L.find;
        if (mnoneEl && mnoneEl.style.display !== "block") { /* keep message ready */ }
        if (mnoneEl) mnoneEl.textContent = L.empty;
        paintSrcChips();
        paintFlagChips();
        root.lang = mode === "orig" ? "vi" : "en";
        if (mq && (mq.value || "").trim().length >= 2) searchMed();
      }
      function setGuide(mode) {
        root.dataset.guide = mode;
        try { localStorage.setItem("sra-guide", mode); } catch (e) {}
        guideBtns.forEach((b) => b.classList.toggle("on", b.dataset.guide === mode));
        paintUi(mode, false);
      }

      const dbBtns = document.querySelectorAll("#taidb .db-toolbar .chip");
      const dbNone = document.getElementById("db-none");
      let dbFilter = "all";
      function applyDb() {
        let n = 0;
        document.querySelectorAll("#db-tbl tbody tr").forEach((el) => {
          const show = dbFilter === "all" || el.dataset.df === dbFilter;
          el.style.display = show ? "" : "none";
          if (show) n++;
        });
        if (dbNone) dbNone.style.display = n ? "none" : "block";
      }
      dbBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          dbFilter = btn.dataset.df;
          dbBtns.forEach((c) => c.classList.toggle("on", c === btn));
          applyDb();
        });
      });

      const mailBtn = document.getElementById("copy-mail");
      const mailEl = document.getElementById("npl-mail");
      if (mailBtn && mailEl) {
        mailBtn.addEventListener("click", () => {
          const t = mailEl.textContent || "";
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(t).then(() => { mailBtn.textContent = "Copied"; });
          }
        });
      }

      function copyChip(el) {
        const text = (el.textContent || "").trim();
        if (!text) return;
        const ok = () => {
          el.classList.add("copied");
          window.setTimeout(() => el.classList.remove("copied"), 900);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(ok).catch(() => {
            const r = document.createRange();
            r.selectNodeContents(el);
            const s = window.getSelection();
            s.removeAllRanges();
            s.addRange(r);
            try { document.execCommand("copy"); } catch (e) {}
            ok();
          });
        }
      }
      document.querySelectorAll(".ui").forEach((el) => {
        el.tabIndex = 0;
        el.title = "Click to copy, then Ctrl+F on the register";
        el.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          copyChip(el);
        });
        el.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            copyChip(el);
          }
        });
      });

      const mq = document.getElementById("mq");
      const mgo = document.getElementById("mgo");
      const mgroups = document.getElementById("med-groups");
      const mmeta = document.getElementById("tra-meta");
      const mhit = document.getElementById("tra-hit");
      const mnone = document.getElementById("mnone");
      const suggest = document.getElementById("suggest");
      const msrc = document.getElementById("msrc");
      const mflags = document.getElementById("mflags");
      const CC = { FR:"Pháp", ES:"Tây Ban Nha", EMA:"EMA", IS:"Iceland", SK:"Slovakia", EE:"Estonia", LT:"Lithuania", CA:"Canada", CH:"Thụy Sĩ", PL:"Ba Lan", LV:"Latvia", US:"Mỹ", SE:"Thụy Điển", IT:"Ý", IE:"Ireland", CZ:"Séc", FI:"Phần Lan", RO:"Romania", BE:"Bỉ", AT:"Áo", NO:"Na Uy", AU:"Úc", LU:"Luxembourg", GB:"Anh", DE:"Đức", JP:"Nhật Bản", HU:"Hungary", NL:"Hà Lan", PT:"Bồ Đào Nha", BG:"Bulgaria", HR:"Croatia", CY:"Síp", DK:"Đan Mạch", GR:"Hy Lạp", MT:"Malta", SI:"Slovenia", LI:"Liechtenstein" };
      const FLAG = { FR:"🇫🇷", ES:"🇪🇸", EMA:"🇪🇺", CA:"🇨🇦", US:"🇺🇸", IE:"🇮🇪", CZ:"🇨🇿", RO:"🇷🇴", LV:"🇱🇻", LU:"🇱🇺", CH:"🇨🇭", FI:"🇫🇮", IS:"🇮🇸", IT:"🇮🇹", AT:"🇦🇹", BE:"🇧🇪", EE:"🇪🇪", LT:"🇱🇹", PL:"🇵🇱", BG:"🇧🇬", HR:"🇭🇷", CY:"🇨🇾", DK:"🇩🇰", DE:"🇩🇪", GR:"🇬🇷", HU:"🇭🇺", MT:"🇲🇹", NL:"🇳🇱", PT:"🇵🇹", SK:"🇸🇰", SI:"🇸🇮", SE:"🇸🇪", GB:"🇬🇧", JP:"🇯🇵", AU:"🇦🇺", NO:"🇳🇴", LI:"🇱🇮" };
      const EN = { FR:"France", ES:"Spain", EMA:"EMA", CA:"Canada", US:"United States", IE:"Ireland", CZ:"Czechia", RO:"Romania", LV:"Latvia", LU:"Luxembourg", CH:"Switzerland", FI:"Finland", IS:"Iceland", IT:"Italy", AT:"Austria", BE:"Belgium", EE:"Estonia", LT:"Lithuania", PL:"Poland", BG:"Bulgaria", HR:"Croatia", CY:"Cyprus", DK:"Denmark", DE:"Germany", GR:"Greece", HU:"Hungary", MT:"Malta", NL:"Netherlands", PT:"Portugal", SK:"Slovakia", SI:"Slovenia", SE:"Sweden", GB:"United Kingdom", JP:"Japan", AU:"Australia", NO:"Norway", LI:"Liechtenstein" };
      const EEA = new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","NO","LI"]);
      const SRC = {
        FR: { agency:"ANSM · BDPM", url:"https://base-donnees-publique.medicaments.gouv.fr/" },
        ES: { agency:"AEMPS · CIMA", url:"https://cima.aemps.es/" },
        EMA: { agency:"EMA", url:"https://www.ema.europa.eu/en/medicines" },
        CA: { agency:"Health Canada · DPD", url:"https://health-products.canada.ca/dpd-bdpp/" },
        US: { agency:"FDA · Drugs@FDA", url:"https://www.accessdata.fda.gov/scripts/cder/daf/" },
        IE: { agency:"HPRA", url:"https://www.hpra.ie/homepage/medicines/medicines-information/find-a-medicine" },
        CZ: { agency:"SÚKL", url:"https://prehledy.sukl.cz/index_en.html" },
        RO: { agency:"ANM", url:"https://www.anm.ro/nomenclator/medicamente" },
        LV: { agency:"ZVA", url:"https://dati.zva.gov.lv" },
        LU: { agency:"Santé Luxembourg", url:"https://santesecu.public.lu/fr/espace-professionnel/departement-sante/pharmacies-et-medicaments/medicaments-humains.html" },
        CH: { agency:"Swissmedic", url:"https://www.swissmedicinfo.ch/" },
        FI: { agency:"FIMEA", url:"https://fimea.fi/en/databases_and_registers/fimeaweb" },
        IS: { agency:"IMA", url:"https://www.serlyfjaskra.is/" },
        AT: { agency:"BASG", url:"https://medikamente.basg.gv.at/de/medicinal-products" },
        EE: { agency:"SAM", url:"https://ravimiregister.ee/en/default.aspx" },
        BE: { agency:"AFMPS", url:"https://banquededonneesmedicaments.fagg-afmps.be/usage-humain" },
        IT: { agency:"AIFA", url:"https://www.aifa.gov.it/liste-dei-farmaci" },
        NO: { agency:"NOMA · FEST", url:"https://www.legemiddelsok.no/" }
      };
      let MED = [];
      let HEALTH = null;
      let INNS = [];
      let haveCc = [];
      let srcKind = "all";
      const selCc = new Set();
      let sugIx = -1;
      const store = new WeakMap();

      function countryName(cc) {
        return (root.dataset.guide === "en" ? EN[cc] : CC[cc]) || cc;
      }
      function esc(s) {
        return String(s || "").replace(/[&<>"]/g, (ch) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[ch]));
      }
      function srcOf(cc) {
        return SRC[cc] || { agency: cc, url: "#" };
      }
      function srcChip(cc) {
        const src = srcOf(cc);
        const ema = cc === "EMA";
        const L = loc();
        return "<a class=\"src" + (ema ? " ema" : "") + "\" href=\"" + esc(src.url) + "\" target=\"_blank\" rel=\"noopener\">" + (ema ? L.ema : L.dump) + "</a>";
      }
      function coHref(cc, company) {
        if (!company) return "";
        const place = EN[cc] || cc;
        return "https://www.google.com/search?q=" + encodeURIComponent('"' + company + '" ' + place + " official website");
      }
      function ocHref(company) {
        if (!company) return "";
        return "https://opencorporates.com/companies?q=" + encodeURIComponent(company);
      }
      function coCell(cc, company) {
        if (!company) return "—";
        const L = loc();
        return "<a class=\"co\" href=\"" + esc(coHref(cc, company)) + "\" target=\"_blank\" rel=\"noopener\" title=\"" + esc(L.site) + "\">" + esc(company) + "</a>" +
          "<a class=\"co-alt\" href=\"" + esc(ocHref(company)) + "\" target=\"_blank\" rel=\"noopener\">" + esc(L.rec) + "</a>";
      }
      function paintSrcChips() {
        if (!msrc) return;
        const L = loc();
        const opts = [
          ["all", L.all],
          ["dump", L.dump],
          ["ema", L.ema]
        ];
        msrc.innerHTML = opts.map(([k, lab]) => {
          return "<button type=\"button\" data-src=\"" + k + "\" class=\"" + (srcKind === k ? "on" : "") + "\">" + esc(lab) + "</button>";
        }).join("");
      }
      function paintFlagChips() {
        if (!mflags) return;
        const order = haveCc.slice().sort((a, b) => {
          if (a === "EMA") return -1;
          if (b === "EMA") return 1;
          return countryName(a).localeCompare(countryName(b));
        });
        mflags.innerHTML = order.map((c) => {
          const on = selCc.size === 0 || selCc.has(c);
          return "<button type=\"button\" data-cc=\"" + c + "\" class=\"" + (selCc.size && selCc.has(c) ? "on" : (selCc.size === 0 ? "" : "")) + "\">" +
            (FLAG[c] || "") + " " + esc(countryName(c)) + "</button>";
        }).join("");
      }
      function hideSuggest() {
        if (!suggest) return;
        suggest.hidden = true;
        suggest.innerHTML = "";
        sugIx = -1;
      }
      function showSuggest(items) {
        if (!suggest) return;
        if (!items.length) { hideSuggest(); return; }
        suggest.hidden = false;
        suggest.innerHTML = items.map((it, i) => {
          return "<button type=\"button\" data-i=\"" + i + "\" class=\"" + (i === sugIx ? "on" : "") + "\"><span class=\"inn\">" + esc(it.inn) + "</span><span class=\"n\">" + it.n + " · " + it.ccs + "</span></button>";
        }).join("");
      }
      function matchInns(qstr) {
        const v = qstr.trim().toLowerCase();
        if (v.length < 2) return [];
        const start = [];
        const mid = [];
        for (let i = 0; i < INNS.length && start.length + mid.length < 40; i++) {
          const it = INNS[i];
          const ix = it.key.indexOf(v);
          if (ix === 0) start.push(it);
          else if (ix > 0) mid.push(it);
        }
        return start.concat(mid).slice(0, 8);
      }
      function rowHtml(r, idx, code) {
        const L = loc();
        return "<tr><td class=\"num\">" + (idx + 1) + "</td><td class=\"inn\">" + esc(r[1]) + "</td><td class=\"nm\">" + esc(r[2]) + "</td><td class=\"fm\">" + esc(r[3]) + "</td><td class=\"st\">" + esc(r[4]) + "</td><td class=\"co\">" + coCell(code, r[5]) + "</td><td class=\"src\">" + srcChip(code) + "</td></tr>";
      }
      function fillAllRows(tbody, list, code) {
        const CHUNK = 250;
        let i = 0;
        function more() {
          const end = Math.min(i + CHUNK, list.length);
          let html = "";
          for (; i < end; i++) html += rowHtml(list[i], i, code);
          tbody.insertAdjacentHTML("beforeend", html);
          if (i < list.length) requestAnimationFrame(more);
        }
        more();
      }
      function searchMed() {
        const L = loc();
        const v = (mq.value || "").trim().toLowerCase();
        mgroups.innerHTML = "";
        hideSuggest();
        if (v.length < 2) {
          mhit.textContent = L.type2;
          mnone.style.display = "none";
          return;
        }
        const bits = v.split(/\s+/).filter(Boolean);
        const buckets = {};
        const order = [];
        let n = 0;
        for (let i = 0; i < MED.length; i++) {
          const r = MED[i];
          const code = r[0];
          if (selCc.size && !selCc.has(code)) continue;
          if (srcKind === "ema" && code !== "EMA") continue;
          if (srcKind === "dump" && code === "EMA") continue;
          const hay = (r[1] + " " + r[2] + " " + r[3] + " " + r[4] + " " + r[5]).toLowerCase();
          let ok = true;
          for (let b = 0; b < bits.length; b++) {
            if (hay.indexOf(bits[b]) === -1) { ok = false; break; }
          }
          if (!ok) continue;
          n++;
          if (!buckets[code]) { buckets[code] = []; order.push(code); }
          buckets[code].push(r);
        }
        order.forEach((code) => {
          const list = buckets[code];
          const src = srcOf(code);
          const d = document.createElement("details");
          d.className = "cg";
          const prev = list.slice(0, 2).map((r) => {
            return "<div>" + esc(r[1]) + " · " + esc(r[2]) + (r[5] ? " · " + esc(r[5]) : "") + "</div>";
          }).join("");
          d.innerHTML =
            "<summary><span class=\"cg-flag\">" + (FLAG[code] || "") + "</span><span>" + esc(countryName(code)) + "</span>" +
            "<span class=\"cg-n\">" + list.length + " " + L.rows + "</span>" +
            "<a class=\"src" + (code === "EMA" ? " ema" : "") + "\" href=\"" + esc(src.url) + "\" target=\"_blank\" rel=\"noopener\" onclick=\"event.stopPropagation()\">" + (code === "EMA" ? L.ema : L.dump) + "</a>" +
            "<div class=\"cg-prev\">" + prev + "</div></summary>" +
            "<div class=\"cg-body\"><table class=\"med\"><thead><tr><th>#</th><th>" + esc(L.inn) + "</th><th>" + esc(L.product) + "</th><th>" + esc(L.form) + "</th><th>" + esc(L.str) + "</th><th>" + esc(L.co) + "</th><th>" + esc(L.src) + "</th></tr></thead><tbody></tbody></table></div>";
          store.set(d, list);
          d.addEventListener("toggle", function () {
            if (!d.open || d.dataset.ready) return;
            d.dataset.ready = "1";
            const tb = d.querySelector("tbody");
            fillAllRows(tb, store.get(d) || [], code);
          });
          mgroups.appendChild(d);
        });
        mnone.style.display = n ? "none" : "block";
        mhit.textContent = n ? L.hit(n, order.length) : "";
      }
      function pickSuggest(inn) {
        mq.value = inn;
        hideSuggest();
        searchMed();
      }

      function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }
      function countUp(el, target, suffix) {
        const t0 = performance.now();
        const dur = 900;
        function tick(now) {
          const p = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased).toLocaleString("vi-VN") + (suffix || "");
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }
      const PACK = [
        { cc:"IT", name:"Ý", tag:"dump", save:"IT/", files:"confezioni_fornitura.csv · PA_confezioni.csv · atc.csv",
          how:"Liste dei farmaci → <b>Anagrafica dei farmaci</b> (bỏ Liste di Trasparenza) → 3 nút Download CSV. Không đăng ký.",
          url:"https://www.aifa.gov.it/liste-dei-farmaci" },
        { cc:"AT", name:"Áo", tag:"dump", save:"AT/basg.csv", files:"basg.csv",
          how:"Cổng BASG mới → hiện thuốc người → Download / CSV / Datenexport. Không dùng aspregister cũ.",
          url:"https://medikamente.basg.gv.at/de/medicinal-products" },
        { cc:"EE", name:"Estonia", tag:"dump", save:"EE/", files:"ravimid.csv · pakendid.csv",
          how:"Andmed / Ravimid → Download list. Đợi Cloudflare rồi Save as CSV (đừng lưu HTML). Pack: Data/XML/pakendid.csv.",
          url:"https://ravimiregister.ee/en/default.aspx?pv=Andmed.Ravimid" },
        { cc:"BE", name:"Bỉ", tag:"dump", save:"BE/", files:"3 file CSDL (thuốc / AMM / pack)",
          how:"Usage humain → Télécharger la base de données complète → tải 3 mức nếu có.",
          url:"https://banquededonneesmedicaments.fagg-afmps.be/usage-humain" },
        { cc:"LT", name:"Lithuania", tag:"dump", save:"LT/PreparatasPakuote.csv", files:"PreparatasPakuote.csv",
          how:"data.gov.lt → PreparatasPakuote → Get this data as → CSV. Máy chủ hay 500, trình duyệt thường được.",
          url:"https://get.data.gov.lt/datasets/gov/vvkt/vaistiniai_preparatai/PreparatasPakuote" },
        { cc:"PL", name:"Ba Lan", tag:"dump", save:"PL/overall.xml", files:"overall.xml (rất lớn, để nền)",
          how:"RPL → tải XML/CSV/XLSX toàn bộ, hoặc overall.xml 6.0.0. File nặng, timeout là bình thường.",
          url:"https://rejestry.ezdrowie.gov.pl/registry/rpl" },
        { cc:"AU", name:"Úc", tag:"dump", save:"AU/artg.xlsx", files:"artg.xlsx",
          how:"ARTG → Search Visualisation Tool → lọc Medicines human → Export Excel (đủ hơn CSV 30k dòng).",
          url:"https://www.tga.gov.au/resources/artg" },
        { cc:"NO", name:"Na Uy", tag:"dump", save:"NO/fest.zip", files:"fest.zip",
          how:"Downloading FEST → Rekvirent extract → Version 2.5.1 (zip) thuốc người.",
          url:"https://www.dmp.no/en/about-us/distribution-of-data-on-medicinal-products/electronic-prescription-support-system-fest/downloading-fest-and-safest" },
        { cc:"BG", name:"Bulgaria", tag:"dump", save:"BG/", files:"2 PDF tháng mới (IAL + EU)",
          how:"Registers of medicinal products → tải PDF Регистър ИАЛ + Регистър ЕС tháng mới. Không CSV.",
          url:"https://bda.bg/bg/%D1%80%D0%B5%D0%B3%D0%B8%D1%81%D1%82%D1%80%D0%B8/%D1%80%D0%B5%D0%B3%D0%B8%D1%81%D1%82%D1%80%D0%B8-%D0%BD%D0%B0-%D0%BB%D0%B5%D0%BA%D0%B0%D1%80%D1%81%D1%82%D0%B2%D0%B5%D0%BD%D0%B8-%D0%BF%D1%80%D0%BE%D0%B4%D1%83%D0%BA%D1%82%D0%B8" },
        { cc:"SE", name:"Thụy Điển", tag:"ask", save:"SE/", files:"NPL ZIP (khi họ gửi)",
          how:"Người nước ngoài mail nplcentral@lakemedelsverket.se (thư mẫu ở thẻ 1 · Tải CSDL). NSL mở. Tạm EMA/HMA.",
          url:"https://www.lakemedelsverket.se/en/e-services-and-forms/substance-register-and-product-register/national-register-for-medicinal-products-npl" },
        { cc:"NL", name:"Hà Lan", tag:"ask", save:"NL/", files:"databestand CSV/XML",
          how:"Mail Geneesmiddelgebruik@cbg-meb.nl xin databestand human. Không dùng CSV OpenState 2017.",
          url:"https://www.geneesmiddeleninformatiebank.nl/" },
        { cc:"HU", name:"Hungary", tag:"ask", save:"HU/", files:"CSV/Excel khi họ trả",
          how:"Form dữ liệu công OGYÉI → xin danh mục authorised (INN, dạng, mg, MAH).",
          url:"https://ogyei.gov.hu/kozerdeku_adatok_igenylese" },
        { cc:"PT", name:"Bồ Đào Nha", tag:"skip", save:"", files:"—",
          how:"Infomed không dump công. CITS 150€/năm — không mua lúc này. Tra web + EMA/HMA.",
          url:"https://extranet.infarmed.pt/INFOMED-fo/index.xhtml" },
        { cc:"JP", name:"Nhật", tag:"skip", save:"", files:"—",
          how:"PMDA không dump cả CSDL. JAPIC trả phí — không mua. Tra trang JP + 添付文書.",
          url:"https://www.pmda.go.jp/PmdaSearch/iyakuSearch/" },
        { cc:"DK", name:"Đan Mạch", tag:"skip", save:"", files:"—",
          how:"API medicinpriser theo INN (≤100/lần), không dump cả CSDL. Bulk /v1/produkter đang 500. Tra web + EMA.",
          url:"https://www.produktresume.dk/AppBuilder/search" },
        { cc:"DE", name:"Đức", tag:"skip", save:"", files:"—",
          how:"AMIce/PharmNet chỉ xuất CSV kết quả tìm. Open data BfArM là thống kê — đừng dùng làm DB. Tra web + EMA.",
          url:"https://www.pharmnet-bund.de/dynamic/de/arzneimittel-informationssystem/index.html" },
        { cc:"SK", name:"Slovakia", tag:"skip", save:"", files:"—",
          how:"Endpoint JSON hiện trả HTML, không phải danh mục. Tra web SIDC + EMA/HMA.",
          url:"https://www.sukl.sk/en/servis/search/searching-on-the-database-of-medicinal-products?page_id=410" },
        { cc:"HR", name:"Croatia", tag:"skip", save:"", files:"—",
          how:"Chỉ xuất Excel sau khi tìm từng INN; SOAP không phải dump cả CSDL. Tra web + EMA/HMA.",
          url:"https://www.halmed.hr/en/Lijekovi/pretrazivanje-lijekova/" },
        { cc:"GB", name:"Anh", tag:"skip", save:"", files:"—",
          how:"products.mhra.gov.uk = mục lục PDF, không dump. Không bắt API ẩn. Tra web + EMA.",
          url:"https://products.mhra.gov.uk/" },
        { cc:"CY", name:"Síp", tag:"skip", save:"", files:"—", how:"Không dump công. Tra web CyPHS + EMA/HMA.", url:"https://www.phs.moh.gov.cy/human-search/home.xhtml?lang=en" },
        { cc:"GR", name:"Hy Lạp", tag:"skip", save:"", files:"—", how:"Không dump công. Tra web EOF + EMA/HMA.", url:"https://eof.gr/en/anazitisi-proionton/" },
        { cc:"MT", name:"Malta", tag:"skip", save:"", files:"—", how:"Không dump công. Tra Advanced Search + EMA/HMA.", url:"https://www.medicinesauthority.gov.mt/advanced-search" },
        { cc:"SI", name:"Slovenia", tag:"skip", save:"", files:"—", how:"Không dump công. Tra cbz.si + EMA/HMA.", url:"https://www.cbz.si/" },
        { cc:"LI", name:"Liechtenstein", tag:"skip", save:"", files:"—",
          how:"Không CSDL riêng. Dùng dump Áo (khi có) + Swissmedic (đã có trong ô tra).",
          url:"https://medikamente.basg.gv.at/de/" }
      ];
      function tagHtml(tag) {
        if (tag === "dump") return "<span class=\"tag-dump\">Tải zip</span>";
        if (tag === "ask") return "<span class=\"tag-ask\">Xin quyền</span>";
        return "<span class=\"tag-none\">Web + EMA</span>";
      }
      function paintDl(have) {
        const body = document.getElementById("dl-body");
        if (!body) return;
        body.innerHTML = PACK.filter(function (p) { return !have.has(p.cc); }).map(function (p) {
          const open = "<a class=\"go\" href=\"" + esc(p.url) + "\" target=\"_blank\" rel=\"noopener\">Open</a>";
          const save = p.save ? "<code>" + esc(p.save) + "</code>" : "—";
          return "<tr data-df=\"" + p.tag + "\"><td>" + (FLAG[p.cc] || "") + " <strong>" + esc(p.name) + "</strong> <span class=\"hint\">" + p.cc + "</span></td><td>" + tagHtml(p.tag) + "</td><td class=\"how\">" + p.how + (p.files ? "<br><span class=\"hint\">File: " + esc(p.files) + "</span>" : "") + "</td><td class=\"fmt\">" + save + "</td><td>" + open + "</td></tr>";
        }).join("");
      }
      function covClass(s, have) {
        if (s.cc === "EMA") return "ema";
        if (s.kind === "national_official" && s.rows) return "n";
        if (EEA.has(s.cc)) return "ema";
        return "m";
      }
      function paintHealth() {
        const h = HEALTH;
        if (!h) return;
        const f = h.funnel || {};
        const kpis = document.getElementById("hkpi");
        const nat = (h.have_national || []).length;
        const loaded = (h.sources || []).filter((s) => s.rows > 0);
        const fullN = loaded.reduce((a, s) => a + (s.full || 0), 0);
        const rowN = f.search_rows || 1;
        const have = new Set(h.have_national || []);
        const waitCc = new Set(PACK.filter((p) => p.tag === "dump" || p.tag === "ask").map((p) => p.cc));
        const waitN = PACK.filter((p) => (p.tag === "dump" || p.tag === "ask") && !have.has(p.cc)).length;
        kpis.innerHTML =
          "<div class=\"stat\"><b data-count=\"" + (f.search_rows || 0) + "\">0</b><span>circulating rows in search</span></div>" +
          "<div class=\"stat\"><b data-count=\"" + (f.dropped || 0) + "\">0</b><span>dropped (cancelled / not marketed)</span></div>" +
          "<div class=\"stat\"><b data-count=\"" + nat + "\" data-suf=\"/36\">0/36</b><span>SRA countries with a national dump</span></div>" +
          "<div class=\"stat\"><b data-count=\"" + pct(fullN, rowN) + "\" data-suf=\"%\">0%</b><span>rows with INN · form · strength · company</span></div>";
        const cap = document.getElementById("hfunnel-cap");
        if (cap) cap.textContent = "Raw dump → drop cancelled/withdrawn/not marketed → unique rows on this page.";
        const funnel = document.getElementById("hfunnel");
        const raw = f.raw || 1;
        const keptP = f.kept_prod || 0;
        const rowsN = f.search_rows || 0;
        const drop = f.dropped || 0;
        funnel.innerHTML = "<div class=\"funnel\">" +
          "<div class=\"row\"><span>Products read</span><div class=\"bar\"><i style=\"--w:" + pct(raw, raw) + "%\"></i></div><b>" + (f.raw || 0).toLocaleString("vi-VN") + "</b></div>" +
          "<div class=\"row\"><span>Not circulating</span><div class=\"bar drop\"><i style=\"--w:" + pct(drop, raw) + "%\"></i></div><b>" + drop.toLocaleString("vi-VN") + "</b></div>" +
          "<div class=\"row\"><span>Products kept</span><div class=\"bar\"><i style=\"--w:" + pct(keptP, raw) + "%\"></i></div><b>" + keptP.toLocaleString("vi-VN") + "</b></div>" +
          "<div class=\"row\"><span>Unique INN rows</span><div class=\"bar\"><i style=\"--w:" + pct(rowsN, raw) + "%\"></i></div><b>" + rowsN.toLocaleString("vi-VN") + "</b></div></div>";
        const emaRows = h.ema_rows || 0;
        const natRows = rowsN - emaRows;
        const deg = pct(natRows, rowsN || 1) * 3.6;
        const donut = document.getElementById("hdonut");
        const heroCap = document.getElementById("hhero-cap");
        if (heroCap) {
          heroCap.textContent = "Green = national dump in search. Navy = no national dump, EMA still covers (EEA). Red = neither dump nor EMA (JP / AU / GB).";
        }
        const track = document.getElementById("htrack");
        if (track) {
          track.innerHTML = (h.sources || []).filter((s) => s.cc !== "EMA").map((s, i) => {
            const cls = covClass(s, have);
            return "<i class=\"" + cls + "\" style=\"animation-delay:" + (i * 0.025) + "s\" title=\"" + esc(s.name) + "\"></i>";
          }).join("");
        }
        const st = document.getElementById("hst");
        if (st) {
          const redN = (h.sources || []).filter((s) => s.cc !== "EMA" && covClass(s, have) === "m").length;
          const navyN = (h.sources || []).filter((s) => s.cc !== "EMA" && covClass(s, have) === "ema").length;
          st.innerHTML =
            "<span class=\"st ok\">National dump " + nat + "</span>" +
            "<span class=\"st ema\">EMA cover " + navyN + "</span>" +
            "<span class=\"st gap\">Neither " + redN + "</span>" +
            "<span class=\"st ema\">EMA " + emaRows.toLocaleString("vi-VN") + " rows</span>";
        }
        document.getElementById("hleg").innerHTML =
          "<li><span class=\"sw\" style=\"background:var(--teal)\"></span>National dump · " + natRows.toLocaleString("vi-VN") + " rows (" + pct(natRows, rowsN || 1) + "%)</li>" +
          "<li><span class=\"sw\" style=\"background:#1e3a8a\"></span>EMA centralised · " + emaRows.toLocaleString("vi-VN") + " rows (" + pct(emaRows, rowsN || 1) + "%)</li>";
        const cov = document.getElementById("hcov");
        cov.innerHTML = (h.sources || []).map((s, i) => {
          const cls = covClass(s, have);
          let extra;
          if (s.cc === "EMA") extra = s.rows + " authorised medicines";
          else if (cls === "n") extra = s.rows.toLocaleString("vi-VN") + " rows" + (s.fresh === "updated" ? " · updated" : "");
          else if (cls === "ema") extra = "no national dump · EMA";
          else extra = "neither dump nor EMA";
          return "<span class=\"" + cls + "\" style=\"animation-delay:" + (i * 0.03) + "s\"><b>" + esc(s.name) + "</b>" + extra + "</span>";
        }).join("");
        const box = document.getElementById("hcomp");
        box.innerHTML = "<div class=\"hcomp\">" + loaded.map((s) => {
          const full = s.full || 0;
          const lean = s.lean || 0;
          const mid = Math.max((s.rows || 0) - full - lean, 0);
          const tot = s.rows || 1;
          return "<div class=\"row\"><span>" + esc(s.name) + (s.fresh === "updated" ? " · updated" : "") + "</span><div class=\"hbar\" title=\"full / partial / lean\"><i class=\"full\" style=\"--w:" + pct(full, tot) + "%\"></i><i class=\"mid\" style=\"--w:" + pct(mid, tot) + "%\"></i><i class=\"lean\" style=\"--w:" + pct(lean, tot) + "%\"></i></div><b>" + pct(full, tot) + "%</b></div>";
        }).join("") + "</div>" +
          "<p class=\"hint\" style=\"margin-top:10px\">Green = all 4 fields. Amber = missing 1–2. Red bar = lean. EMA is often lean on form/strength because the public JSON does not split them.</p>";
        paintDl(have);
        const hsum = document.getElementById("hsum");
        if (hsum) hsum.textContent = "Data health · " + nat + "/36 national dumps";
        const sec = document.getElementById("health");
        const ring = document.getElementById("hring");
        const circ = 2 * Math.PI * 50;
        if (ring) ring.style.setProperty("--off", String(circ));
        const runAnim = function () {
          sec.classList.add("on");
          if (ring) ring.style.setProperty("--off", String(circ * (1 - nat / 36)));
          const rn = document.getElementById("hring-n");
          if (rn) countUp(rn, nat, "");
          if (donut) donut.style.setProperty("--deg", deg + "deg");
          kpis.querySelectorAll("b[data-count]").forEach((el) => {
            countUp(el, Number(el.getAttribute("data-count") || 0), el.getAttribute("data-suf") || "");
          });
        };
        if (window.IntersectionObserver) {
          const io = new IntersectionObserver((ents) => {
            ents.forEach((e) => { if (e.isIntersecting) { runAnim(); io.disconnect(); } });
          }, { threshold: 0.12 });
          io.observe(sec);
        } else runAnim();
      }
      function buildInns() {
        const map = {};
        haveCc = [];
        const seenCc = new Set();
        for (let i = 0; i < MED.length; i++) {
          const r = MED[i];
          if (!seenCc.has(r[0])) { seenCc.add(r[0]); haveCc.push(r[0]); }
          const inn = (r[1] || "").trim();
          if (!inn) continue;
          const key = inn.toLowerCase();
          let it = map[key];
          if (!it) { it = { inn: inn, key: key, n: 0, cc: new Set() }; map[key] = it; }
          it.n++;
          it.cc.add(r[0]);
        }
        INNS = Object.keys(map).map((k) => {
          const it = map[k];
          return { inn: it.inn, key: it.key, n: it.n, ccs: it.cc.size };
        }).sort((a, b) => b.n - a.n);
      }
      function loadMed() {
        try {
          const raw = document.getElementById("sra-med");
          const d = JSON.parse(raw.textContent);
          const t = d.t || [];
          MED = (d.r || []).map(function (r) {
            return [t[r[0]] || "", t[r[1]] || "", t[r[2]] || "", t[r[3]] || "", t[r[4]] || "", t[r[5]] || ""];
          });
          HEALTH = d.h || null;
          buildInns();
          paintSrcChips();
          paintFlagChips();
          const locn = root.dataset.guide === "orig" ? "vi-VN" : "en-US";
          mmeta.textContent = (d.n || MED.length).toLocaleString(locn) + " circulating rows · " + (d.u || "");
          paintHealth();
        } catch (e) {
          mmeta.textContent = "Could not read the medicine index on this page.";
        }
      }
      loadMed();
      setGuide(saved === "orig" ? "orig" : "en");
      guideBtns.forEach((b) => b.addEventListener("click", () => setGuide(b.dataset.guide)));
      window.addEventListener("beforeprint", () => paintUi(root.dataset.guide, true));
      window.addEventListener("afterprint", () => paintUi(root.dataset.guide, false));

      if (mgo) mgo.addEventListener("click", searchMed);
      if (msrc) msrc.addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-src]");
        if (!b) return;
        srcKind = b.getAttribute("data-src");
        paintSrcChips();
        if ((mq.value || "").trim().length >= 2) searchMed();
      });
      if (mflags) mflags.addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-cc]");
        if (!b) return;
        const cc = b.getAttribute("data-cc");
        if (selCc.has(cc)) selCc.delete(cc);
        else selCc.add(cc);
        paintFlagChips();
        if ((mq.value || "").trim().length >= 2) searchMed();
      });
      let sugTimer = 0;
      if (mq) {
        mq.addEventListener("input", () => {
          window.clearTimeout(sugTimer);
          sugTimer = window.setTimeout(() => {
            sugIx = -1;
            showSuggest(matchInns(mq.value || ""));
          }, 80);
        });
        mq.addEventListener("keydown", (ev) => {
          const items = suggest && !suggest.hidden ? [...suggest.querySelectorAll("button")] : [];
          if (ev.key === "ArrowDown" && items.length) {
            ev.preventDefault();
            sugIx = Math.min(items.length - 1, sugIx + 1);
            items.forEach((el, i) => el.classList.toggle("on", i === sugIx));
          } else if (ev.key === "ArrowUp" && items.length) {
            ev.preventDefault();
            sugIx = Math.max(0, sugIx - 1);
            items.forEach((el, i) => el.classList.toggle("on", i === sugIx));
          } else if (ev.key === "Escape") {
            hideSuggest();
          } else if (ev.key === "Enter") {
            if (sugIx >= 0 && items[sugIx]) {
              ev.preventDefault();
              pickSuggest(items[sugIx].querySelector(".inn").textContent);
            } else {
              searchMed();
            }
          }
        });
      }
      if (suggest) {
        suggest.addEventListener("mousedown", (ev) => {
          const b = ev.target.closest("button");
          if (!b) return;
          ev.preventDefault();
          pickSuggest(b.querySelector(".inn").textContent);
        });
      }
      document.addEventListener("click", (ev) => {
        if (suggest && !suggest.contains(ev.target) && ev.target !== mq) hideSuggest();
      });
    })();
