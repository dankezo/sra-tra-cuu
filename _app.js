    (function () {
      const root = document.documentElement;
      const q = document.getElementById("q");
      const none = document.getElementById("none");
      const rows = [...document.querySelectorAll("table.sra tbody tr")];
      const chips = [...document.querySelectorAll(".toolbar .chip[data-f]")];
      const guideBtns = [...document.querySelectorAll(".lang-switch button, .lang-mini button")];
      let filter = "all";
      let saved = "orig";
      try { saved = localStorage.getItem("sra-guide") || "orig"; } catch (e) {}
      if (saved !== "orig" && saved !== "en" && saved !== "vi") saved = "orig";

      function apply() {
        const v = (q && q.value || "").trim().toLowerCase();
        let n = 0;
        rows.forEach((el) => {
          if (el.classList.contains("grp")) { el.style.display = ""; return; }
          const show = (filter === "all" || el.dataset.g === filter) &&
            (!v || (el.dataset.keys || "").includes(v) || el.innerText.toLowerCase().includes(v));
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

      function paintUi(mode, forPrint) {
        document.querySelectorAll(".ui").forEach((el) => {
          const o = el.getAttribute("data-o") || "";
          const e = el.getAttribute("data-e") || o;
          el.textContent = forPrint && o !== e ? o + " / " + e : (mode === "en" ? e : o);
        });
        root.lang = mode === "en" ? "en" : "vi";
        if (typeof paintFormChips === "function") paintFormChips();
        if (typeof searchMed === "function" && mq && (mq.value || "").trim().length >= 2) searchMed();
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
        const ok = () => { el.classList.add("copied"); window.setTimeout(() => el.classList.remove("copied"), 900); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(ok).catch(() => {});
        }
      }
      document.querySelectorAll(".ui").forEach((el) => {
        el.tabIndex = 0;
        el.title = "Click to copy, then Ctrl+F on the register";
        el.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); copyChip(el); });
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
      const mforms = document.getElementById("mforms");
      const mgMinEl = document.getElementById("mg-min");
      const mgMaxEl = document.getElementById("mg-max");
      const mgVal = document.getElementById("mg-val");
      const selN = document.getElementById("sel-n");
      const pageSizeEl = document.getElementById("page-size");
      const CC = { FR:"Pháp", ES:"Tây Ban Nha", EMA:"EMA", IS:"Iceland", SK:"Slovakia", EE:"Estonia", LT:"Lithuania", CA:"Canada", CH:"Thụy Sĩ", PL:"Ba Lan", LV:"Latvia", US:"Mỹ", SE:"Thụy Điển", IT:"Ý", IE:"Ireland", CZ:"Séc", FI:"Phần Lan", RO:"Romania", BE:"Bỉ", AT:"Áo", NO:"Na Uy", AU:"Úc", LU:"Luxembourg", GB:"Anh", DE:"Đức", JP:"Nhật Bản", HU:"Hungary", NL:"Hà Lan", PT:"Bồ Đào Nha", BG:"Bulgaria", HR:"Croatia", CY:"Síp", DK:"Đan Mạch", GR:"Hy Lạp", MT:"Malta", SI:"Slovenia", LI:"Liechtenstein" };
      const EN = { FR:"France", ES:"Spain", EMA:"EMA", CA:"Canada", US:"United States", IE:"Ireland", CZ:"Czechia", RO:"Romania", LV:"Latvia", LU:"Luxembourg", CH:"Switzerland", FI:"Finland", IS:"Iceland", IT:"Italy", AT:"Austria", BE:"Belgium", EE:"Estonia", LT:"Lithuania", PL:"Poland", BG:"Bulgaria", HR:"Croatia", CY:"Cyprus", DK:"Denmark", DE:"Germany", GR:"Greece", HU:"Hungary", MT:"Malta", NL:"Netherlands", PT:"Portugal", SK:"Slovakia", SI:"Slovenia", SE:"Sweden", GB:"United Kingdom", JP:"Japan", AU:"Australia", NO:"Norway", LI:"Liechtenstein" };
      const EEA = new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","NO","LI"]);
      const SRA36 = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","US","GB","JP","CH","CA","AU","NO","IS","LI"];
      const SRC = {
        FR:{agency:"ANSM",url:"https://base-donnees-publique.medicaments.gouv.fr/"},
        ES:{agency:"AEMPS",url:"https://cima.aemps.es/"},
        EMA:{agency:"EMA",url:"https://www.ema.europa.eu/en/medicines"},
        CA:{agency:"Health Canada",url:"https://health-products.canada.ca/dpd-bdpp/"},
        US:{agency:"FDA",url:"https://www.accessdata.fda.gov/scripts/cder/daf/"},
        IE:{agency:"HPRA",url:"https://www.hpra.ie/homepage/medicines/medicines-information/find-a-medicine"},
        CZ:{agency:"SÚKL",url:"https://prehledy.sukl.cz/index_en.html"},
        RO:{agency:"ANM",url:"https://www.anm.ro/nomenclator/medicamente"},
        LV:{agency:"ZVA",url:"https://dati.zva.gov.lv"},
        LU:{agency:"Santé LU",url:"https://santesecu.public.lu/fr/espace-professionnel/departement-sante/pharmacies-et-medicaments/medicaments-humains.html"},
        CH:{agency:"Swissmedic",url:"https://www.swissmedicinfo.ch/"},
        FI:{agency:"FIMEA",url:"https://fimea.fi/en/databases_and_registers/fimeaweb"},
        IS:{agency:"IMA",url:"https://www.serlyfjaskra.is/"},
        AT:{agency:"BASG",url:"https://medikamente.basg.gv.at/de/medicinal-products"},
        EE:{agency:"SAM",url:"https://ravimiregister.ee/en/default.aspx"},
        BE:{agency:"AFMPS",url:"https://banquededonneesmedicaments.fagg-afmps.be/usage-humain"},
        IT:{agency:"AIFA",url:"https://www.aifa.gov.it/liste-dei-farmaci"},
        NO:{agency:"NOMA",url:"https://www.legemiddelsok.no/"},
        AU:{agency:"TGA",url:"https://www.tga.gov.au/resources/artg"},
        BG:{agency:"BDA",url:"https://bda.bg/bg/"}
      };
      const FORM_RULES = [
        ["tablet", ["film-coated", "filmtablette", "pellicul", "kalvopäällysteinen", "filmdrasjert", "tbl flm", "compr. film", "compressa rivestita", "film coated"]],
        ["tablet", ["tablet", "tablette", "tabletti", "tablett", "comprimé", "compr.", "compressa", "tbl nob", "tbl "]],
        ["capsule", ["capsule", "gélule", "gelule", "kapsel", "hartkapsel", "cps dur", "cps "]],
        ["injection", ["inject", "iniett", "infusion", "infuz", "parenteral"]],
        ["drops", ["eye drop", "goutte", "tropfen", "gocce", "drops"]],
        ["inhalation", ["inhal", "nebuli"]],
        ["suppository", ["suppositor", "suppositoire", "zäpfchen"]],
        ["patch", ["patch", "plaster", "transderm"]],
        ["spray", ["spray", "aerosol"]],
        ["cream", ["cream", "crème", "creme", "crema"]],
        ["ointment", ["ointment", "pommade", "salbe", "unguent"]],
        ["gel", [" gel", "gel"]],
        ["syrup", ["syrup", "sirop", "sirup"]],
        ["granules", ["granule", "granuli", "granul"]],
        ["powder", ["powder", "poudre", "pulver"]],
        ["suspension", ["suspension", "sospensione"]],
        ["solution", ["solution", "soluzione", "lösung", "raztvor", "раствор"]]
      ];
      const FORM_LBL = {
        tablet: { en: "tablet", vi: "viên nén" },
        capsule: { en: "capsule", vi: "viên nang" },
        injection: { en: "injection", vi: "tiêm / truyền" },
        solution: { en: "solution", vi: "dung dịch" },
        suspension: { en: "suspension", vi: "hỗn dịch" },
        powder: { en: "powder", vi: "bột" },
        granules: { en: "granules", vi: "cốm" },
        cream: { en: "cream", vi: "kem" },
        ointment: { en: "ointment", vi: "mỡ" },
        gel: { en: "gel", vi: "gel" },
        syrup: { en: "syrup", vi: "siro" },
        drops: { en: "drops", vi: "nhỏ (mắt/mũi)" },
        spray: { en: "spray", vi: "xịt" },
        inhalation: { en: "inhalation", vi: "hít" },
        patch: { en: "patch", vi: "dán" },
        suppository: { en: "suppository", vi: "đặt" },
        other: { en: "other", vi: "khác" }
      };
      const PACK = [
        { cc:"LT", name:"Lithuania", tag:"dump", how:"data.gov.lt → PreparatasPakuote → CSV. Máy hay 500 — tải bằng trình duyệt, thả vào data/raw/LT/.", url:"https://get.data.gov.lt/datasets/gov/vvkt/vaistiniai_preparatai/PreparatasPakuote" },
        { cc:"PL", name:"Ba Lan", tag:"dump", how:"RPL overall.xml rất lớn. Tải nền / Save as, thả data/raw/PL/.", url:"https://rejestry.ezdrowie.gov.pl/registry/rpl" },
        { cc:"SE", name:"Thụy Điển", tag:"ask", how:"Mail nplcentral@lakemedelsverket.se xin NPL ZIP. HAR không có dump công.", url:"https://www.lakemedelsverket.se/en/e-services-and-forms/substance-register-and-product-register/national-register-for-medicinal-products-npl" },
        { cc:"NL", name:"Hà Lan", tag:"ask", how:"Mail Geneesmiddelgebruik@cbg-meb.nl xin databestand. Không crawl OpenState 2017.", url:"https://www.geneesmiddeleninformatiebank.nl/" },
        { cc:"HU", name:"Hungary", tag:"ask", how:"Form OGYÉI xin CSV authorised. HAR nếu có thì gửi.", url:"https://ogyei.gov.hu/kozerdeku_adatok_igenylese" },
        { cc:"DE", name:"Đức", tag:"skip", how:"HAR portal.bfarm.de = JSF POST search.xhtml → HTML từng trang, không JSON dump. AMIce chỉ xuất CSV sau khi tìm. Tạm EMA.", url:"https://portal.bfarm.de/amguifree/am/search.xhtml" },
        { cc:"DK", name:"Đan Mạch", tag:"skip", how:"API medicinpriser theo INN ≤100/lần; bulk /v1/produkter 500. Không dump cả CSDL.", url:"https://www.produktresume.dk/AppBuilder/search" },
        { cc:"PT", name:"Bồ Đào Nha", tag:"skip", how:"Infomed không dump. CITS 150€/năm — không mua. Tạm EMA.", url:"https://extranet.infarmed.pt/INFOMED-fo/index.xhtml" },
        { cc:"SK", name:"Slovakia", tag:"skip", how:"lieky_all.json hiện rỗng/HTML. Tra SIDC + EMA.", url:"https://www.sukl.sk/en/servis/search/searching-on-the-database-of-medicinal-products?page_id=410" },
        { cc:"HR", name:"Croatia", tag:"skip", how:"Excel sau từng INN, không dump cả CSDL.", url:"https://www.halmed.hr/en/Lijekovi/pretrazivanje-lijekova/" },
        { cc:"GB", name:"Anh", tag:"skip", how:"MHRA = mục lục PDF. Không dump. Không EMA (sau Brexit).", url:"https://products.mhra.gov.uk/" },
        { cc:"JP", name:"Nhật", tag:"skip", how:"PMDA không dump. JAPIC trả phí. Không EMA.", url:"https://www.pmda.go.jp/PmdaSearch/iyakuSearch/" },
        { cc:"CY", name:"Síp", tag:"skip", how:"Không dump công. Tạm EMA.", url:"https://www.phs.moh.gov.cy/human-search/home.xhtml?lang=en" },
        { cc:"GR", name:"Hy Lạp", tag:"skip", how:"Không dump công. Tạm EMA.", url:"https://eof.gr/en/anazitisi-proionton/" },
        { cc:"MT", name:"Malta", tag:"skip", how:"Không dump công. Tạm EMA.", url:"https://www.medicinesauthority.gov.mt/advanced-search" },
        { cc:"SI", name:"Slovenia", tag:"skip", how:"Không dump công. Tạm EMA.", url:"https://www.cbz.si/" },
        { cc:"LI", name:"Liechtenstein", tag:"skip", how:"Không CSDL riêng — Áo + Swissmedic + EMA.", url:"https://medikamente.basg.gv.at/de/" }
      ];

      let MED = [];
      let HEALTH = null;
      let SITES = {};
      let INNS = [];
      let dumpCc = new Set();
      let srcKind = "all";
      const selCc = new Set();
      const selForms = new Set();
      let sugIx = -1;
      let pageSize = 50;
      let selected = {};
      try { selected = JSON.parse(localStorage.getItem("sra-sel") || "{}") || {}; } catch (e) { selected = {}; }
      try { pageSize = Number(localStorage.getItem("sra-page") || 50); } catch (e) {}
      const store = new WeakMap();
      const shownN = new WeakMap();

      function countryName(cc) { return CC[cc] || cc; }
      function flagIso(cc) { return cc === "EMA" ? "eu" : String(cc || "").toLowerCase(); }
      function flagImg(cc) {
        const iso = flagIso(cc);
        return "<img class=\"flg\" width=\"20\" height=\"15\" alt=\"\" src=\"https://flagcdn.com/w20/" + iso + ".png\" srcset=\"https://flagcdn.com/w40/" + iso + ".png 2x\" />";
      }
      function hydrateFlags() {
        document.querySelectorAll("span.flag").forEach((el) => {
          if (el.querySelector("img")) return;
          const cps = [];
          for (const ch of el.textContent.trim()) cps.push(ch.codePointAt(0));
          if (cps.length >= 2 && cps[0] >= 0x1F1E6 && cps[0] <= 0x1F1FF) {
            const iso = String.fromCharCode(cps[0] - 0x1F1E6 + 65, cps[1] - 0x1F1E6 + 65).toLowerCase();
            el.innerHTML = "<img class=\"flg\" width=\"20\" height=\"15\" alt=\"\" src=\"https://flagcdn.com/w20/" + iso + ".png\" srcset=\"https://flagcdn.com/w40/" + iso + ".png 2x\" />";
          }
        });
      }
      function esc(s) {
        return String(s || "").replace(/[&<>"]/g, (ch) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[ch]));
      }
      function srcOf(cc) { return SRC[cc] || { agency: cc, url: "#" }; }
      function formKey(s) {
        const t = " " + String(s || "").toLowerCase() + " ";
        for (let i = 0; i < FORM_RULES.length; i++) {
          const [k, needles] = FORM_RULES[i];
          for (let j = 0; j < needles.length; j++) {
            if (t.indexOf(needles[j]) !== -1) return k;
          }
        }
        return s ? "other" : "";
      }
      function formText(raw) {
        const mode = root.dataset.guide || "orig";
        if (mode === "orig") return raw || "—";
        const k = formKey(raw);
        if (!k) return raw || "—";
        const lab = FORM_LBL[k];
        return (lab && lab[mode]) || raw || "—";
      }
      function mgOf(s) {
        const m = String(s || "").replace(",", ".").match(/([\d.]+)\s*(mg|mcg|µg|ug|g)\b/i);
        if (!m) return null;
        const n = parseFloat(m[1]);
        if (!isFinite(n)) return null;
        const u = m[2].toLowerCase();
        if (u === "g") return n * 1000;
        if (u === "mcg" || u === "ug" || u === "µg") return n / 1000;
        return n;
      }
      function wikiHref(company) {
        return "https://en.wikipedia.org/wiki/Special:Search?go=Go&search=" + encodeURIComponent(company);
      }
      function coCell(company) {
        if (!company) return "—";
        const official = SITES[company];
        const href = official || wikiHref(company);
        return "<a class=\"co" + (official ? "" : " g") + "\" href=\"" + esc(href) + "\" target=\"_blank\" rel=\"noopener\">" + esc(company) + "</a>";
      }
      function rowSrc(r) {
        return r[6] === "e" || r[0] === "EMA" ? "e" : "d";
      }
      function srcChip(src, cc) {
        const ema = src === "e";
        const s = ema ? SRC.EMA : srcOf(cc);
        return "<a class=\"src" + (ema ? " ema" : "") + "\" href=\"" + esc(s.url || "#") + "\" target=\"_blank\" rel=\"noopener\">" + (ema ? "EMA" : "dump") + "</a>";
      }
      function rowKey(cc, r) {
        return cc + "\t" + (r[1] || "") + "\t" + (r[3] || "") + "\t" + (r[4] || "") + "\t" + (r[5] || "") + "\t" + (r[6] || "d");
      }
      function saveSel() {
        try { localStorage.setItem("sra-sel", JSON.stringify(selected)); } catch (e) {}
        if (selN) selN.textContent = Object.keys(selected).length.toLocaleString("vi-VN") + " đã chọn";
      }
      function paintSrc() {
        if (!msrc) return;
        msrc.innerHTML = [["all","Tất cả"],["dump","dump"],["ema","EMA"]].map(([k, lab]) => {
          return "<button type=\"button\" data-src=\"" + k + "\" class=\"" + (srcKind === k ? "on" : "") + "\">" + lab + "</button>";
        }).join("");
      }
      function paintFlags() {
        if (!mflags) return;
        const dumpN = dumpCc.size;
        mflags.innerHTML =
          "<div class=\"src-mini\" style=\"margin-bottom:6px\">" +
          "<button type=\"button\" data-reg=\"all\" class=\"" + (selCc.size ? "" : "on") + "\">Mọi nước</button>" +
          "<button type=\"button\" data-reg=\"eea\">EEA</button>" +
          "<button type=\"button\" data-reg=\"dump\">Có dump (" + dumpN + ")</button>" +
          "</div>" +
          SRA36.map((c) => {
            const on = selCc.has(c);
            let dot = "m";
            if (dumpCc.has(c)) dot = "n";
            else if (EEA.has(c)) dot = "ema";
            return "<button type=\"button\" data-cc=\"" + c + "\" class=\"" + (on ? "on" : "") + "\">" +
              flagImg(c) + " <i class=\"dot " + dot + "\"></i> " + esc(countryName(c)) + "</button>";
          }).join("");
      }
      function paintFormChips() {
        if (!mforms) return;
        const mode = root.dataset.guide === "en" ? "en" : "vi";
        const keys = Object.keys(FORM_LBL);
        mforms.innerHTML = keys.map((k) => {
          const lab = FORM_LBL[k][mode];
          return "<button type=\"button\" data-form=\"" + k + "\" class=\"" + (selForms.has(k) ? "on" : "") + "\">" + esc(lab) + "</button>";
        }).join("");
      }
      function paintMg() {
        if (!mgVal) return;
        const a = Number(mgMinEl.value || 0);
        const b = Number(mgMaxEl.value || 1000);
        mgVal.textContent = a + " – " + (b >= 1000 ? "1000+" : b) + " mg";
      }
      function hideSuggest() {
        window.clearTimeout(sugTimer);
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
          return "<button type=\"button\" class=\"" + (i === sugIx ? "on" : "") + "\"><span class=\"inn\">" + esc(it.inn) + "</span><span class=\"n\">" + it.n + " · " + it.ccs + "</span></button>";
        }).join("");
      }
      function matchInns(qstr) {
        const v = qstr.trim().toLowerCase();
        if (v.length < 2) return [];
        const start = [], mid = [];
        for (let i = 0; i < INNS.length && start.length + mid.length < 12; i++) {
          const it = INNS[i];
          const ix = it.key.indexOf(v);
          if (ix === 0) start.push(it);
          else if (ix > 0) mid.push(it);
        }
        return start.concat(mid).slice(0, 3);
      }
      function rowHtml(r, idx, code, src) {
        const k = rowKey(code, r);
        const on = selected[k] ? " checked" : "";
        return "<tr data-k=\"" + esc(k) + "\"><td class=\"ck\"><input type=\"checkbox\" data-k=\"" + esc(k) + "\"" + on + "></td><td class=\"num\">" + (idx + 1) + "</td><td class=\"inn\">" + esc(r[1]) + "</td><td class=\"nm\">" + esc(r[2]) + "</td><td class=\"fm\">" + esc(formText(r[3])) + "</td><td class=\"st\">" + esc(r[4] || "—") + "</td><td class=\"co\">" + coCell(r[5]) + "</td><td class=\"src\">" + srcChip(src, code) + "</td></tr>";
      }
      function fillRows(d, code) {
        const list = store.get(d) || [];
        const tb = d.querySelector("tbody");
        const start = shownN.get(d) || 0;
        const cap = pageSize > 0 ? Math.min(list.length, start + pageSize) : list.length;
        let html = "";
        for (let i = start; i < cap; i++) html += rowHtml(list[i], i, code, rowSrc(list[i]));
        tb.insertAdjacentHTML("beforeend", html);
        shownN.set(d, cap);
        let more = d.querySelector(".more");
        if (cap < list.length) {
          if (!more) {
            more = document.createElement("button");
            more.type = "button";
            more.className = "more";
            more.addEventListener("click", () => fillRows(d, code));
            d.querySelector(".cg-body").appendChild(more);
          }
          more.textContent = "Hiện thêm (" + (list.length - cap).toLocaleString("vi-VN") + " còn lại)";
          more.hidden = false;
        } else if (more) more.hidden = true;
      }
      function passes(r, src) {
        if (srcKind === "dump" && src === "e") return false;
        if (srcKind === "ema" && src !== "e") return false;
        if (selForms.size) {
          const fk = formKey(r[3]);
          if (!selForms.has(fk || "other")) return false;
        }
        const a = Number(mgMinEl && mgMinEl.value || 0);
        const b = Number(mgMaxEl && mgMaxEl.value || 1000);
        if (a > 0 || b < 1000) {
          const mg = mgOf(r[4]);
          if (mg == null) return false;
          if (mg < a || (b < 1000 && mg > b)) return false;
        }
        return true;
      }
      function searchMed() {
        const v = (mq.value || "").trim().toLowerCase();
        mgroups.innerHTML = "";
        hideSuggest();
        if (v.length < 2) {
          mhit.textContent = "Gõ ít nhất 2 ký tự.";
          mnone.style.display = "none";
          return;
        }
        const bits = v.split(/\s+/).filter(Boolean);
        const buckets = {};
        const srcOfRow = {};
        const order = [];
        let n = 0;
        for (let i = 0; i < MED.length; i++) {
          const r = MED[i];
          const src = rowSrc(r);
          const hay = (r[1] + " " + r[2] + " " + r[3] + " " + r[4] + " " + r[5]).toLowerCase();
          let ok = true;
          for (let b = 0; b < bits.length; b++) {
            if (hay.indexOf(bits[b]) === -1) { ok = false; break; }
          }
          if (!ok || !passes(r, src)) continue;
          const targets = [];
          if (src === "e") {
            EEA.forEach((cc) => {
              if (!selCc.size || selCc.has(cc)) targets.push(cc);
            });
          } else if (!selCc.size || selCc.has(r[0])) {
            targets.push(r[0]);
          }
          for (let t = 0; t < targets.length; t++) {
            const cc = targets[t];
            n++;
            if (!buckets[cc]) { buckets[cc] = []; order.push(cc); srcOfRow[cc] = srcOfRow[cc] || {}; }
            buckets[cc].push(r);
          }
        }
        order.sort((a, b) => {
          const ra = dumpCc.has(a) ? 0 : (EEA.has(a) ? 1 : 2);
          const rb = dumpCc.has(b) ? 0 : (EEA.has(b) ? 1 : 2);
          if (ra !== rb) return ra - rb;
          return (CC[a] || a).localeCompare(CC[b] || b, "vi");
        });
        order.forEach((code) => {
          const list = buckets[code];
          const hasEma = list.some((r) => rowSrc(r) === "e");
          const hasDump = list.some((r) => rowSrc(r) === "d");
          const d = document.createElement("details");
          d.className = "cg";
          d.dataset.cc = code;
          d.dataset.src = hasDump && srcKind !== "ema" ? "d" : (hasEma ? "e" : "d");
          const prev = list.slice(0, 2).map((r) => "<div>" + esc(r[1]) + " · " + esc(r[2]) + (r[5] ? " · " + esc(r[5]) : "") + "</div>").join("");
          const src = srcOf(code);
          d.innerHTML =
            "<summary>" + flagImg(code) + "<span>" + esc(countryName(code)) + "</span>" +
            "<span class=\"cg-n\">" + list.length + " dòng</span>" +
            (hasDump ? "<a class=\"src\" href=\"" + esc(src.url) + "\" target=\"_blank\" rel=\"noopener\" onclick=\"event.stopPropagation()\">dump</a>" : "") +
            (hasEma ? "<a class=\"src ema\" href=\"" + esc(SRC.EMA.url) + "\" target=\"_blank\" rel=\"noopener\" onclick=\"event.stopPropagation()\">EMA</a>" : "") +
            "<div class=\"cg-prev\">" + prev + "</div></summary>" +
            "<div class=\"cg-body\"><table class=\"med\"><thead><tr><th></th><th>#</th><th>Hoạt chất (INN)</th><th>Tên thuốc</th><th>Dạng</th><th>Hàm lượng</th><th>Công ty</th><th>Nguồn</th></tr></thead><tbody></tbody></table></div>";
          store.set(d, list);
          shownN.set(d, 0);
          d.addEventListener("toggle", function () {
            if (!d.open || d.dataset.ready) return;
            d.dataset.ready = "1";
            fillRows(d, code);
          });
          mgroups.appendChild(d);
        });
        mnone.style.display = n ? "none" : "block";
        mhit.textContent = n ? (n.toLocaleString("vi-VN") + " dòng · " + order.length + " nước") : "";
      }
      function pickSuggest(inn) {
        mq.value = inn;
        hideSuggest();
        searchMed();
      }
      function remember(code, r, on) {
        const k = rowKey(code, r);
        if (on) selected[k] = [code, r[1], r[2], r[3], r[4], r[5], r[6] || "d"];
        else delete selected[k];
        saveSel();
      }
      function exportSel() {
        const keys = Object.keys(selected);
        if (!keys.length) return;
        const lines = [["country","inn","product","form","strength","company","src"]];
        keys.forEach((k) => {
          const r = selected[k];
          lines.push(r.map((x) => "\"" + String(x || "").replace(/\"/g, "\"\"") + "\""));
        });
        const blob = new Blob(["\uFEFF" + lines.map((a) => a.join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "sra-chon.csv";
        a.click();
        URL.revokeObjectURL(a.href);
      }

      function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }
      function countUp(el, target, suffix) {
        const t0 = performance.now();
        function tick(now) {
          const p = Math.min(1, (now - t0) / 900);
          el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("vi-VN") + (suffix || "");
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }
      function covClass(s) {
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
        if (heroCap) heroCap.textContent = "Thanh ngang xếp xanh (dump) → navy (EMA) → đỏ (không dump, không EMA) → trắng.";
        const rank = { n: 0, ema: 1, m: 2, w: 3 };
        const track = document.getElementById("htrack");
        if (track) {
          const bits = (h.sources || []).filter((s) => s.cc !== "EMA").slice().sort((a, b) => rank[covClass(a)] - rank[covClass(b)]);
          track.innerHTML = bits.map((s, i) => {
            return "<i class=\"" + covClass(s) + "\" style=\"animation-delay:" + (i * 0.025) + "s\" title=\"" + esc(s.name) + "\"></i>";
          }).join("");
        }
        const st = document.getElementById("hst");
        if (st) {
          const redN = (h.sources || []).filter((s) => s.cc !== "EMA" && covClass(s) === "m").length;
          const navyN = (h.sources || []).filter((s) => s.cc !== "EMA" && covClass(s) === "ema").length;
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
        const covBits = (h.sources || []).filter((s) => s.cc !== "EMA").slice().sort((a, b) => rank[covClass(a)] - rank[covClass(b)]);
        cov.innerHTML = covBits.map((s, i) => {
          const cls = covClass(s);
          let extra = cls === "n" ? s.rows.toLocaleString("vi-VN") + " rows" : (cls === "ema" ? "EMA cover" : "neither dump nor EMA");
          return "<span class=\"" + cls + "\" style=\"animation-delay:" + (i * 0.03) + "s\"><b>" + esc(s.name) + "</b>" + extra + "</span>";
        }).join("");
        const box = document.getElementById("hcomp");
        box.innerHTML = "<div class=\"hcomp\">" + loaded.map((s) => {
          const full = s.full || 0;
          const lean = s.lean || 0;
          const mid = Math.max((s.rows || 0) - full - lean, 0);
          const tot = s.rows || 1;
          return "<div class=\"row\"><span>" + esc(s.name) + "</span><div class=\"hbar\"><i class=\"full\" style=\"--w:" + pct(full, tot) + "%\"></i><i class=\"mid\" style=\"--w:" + pct(mid, tot) + "%\"></i><i class=\"lean\" style=\"--w:" + pct(lean, tot) + "%\"></i></div><b>" + pct(full, tot) + "%</b></div>";
        }).join("") + "</div>";
        const crawl = document.getElementById("hcrawl");
        if (crawl) {
          const miss = PACK.filter((p) => !have.has(p.cc));
          crawl.innerHTML = "<p class=\"side-lab\" style=\"margin:12px 0 8px\">Còn thiếu dump — HAR / API</p>" +
            "<p class=\"hint\">AccessMedicina / Vidal (HAR sếp hay dùng): HTML monograph ATC (FT_*.html), không có JSON dump. Nội dung bản quyền McGraw Hill — không nhét vào ô tra SRA. Dùng để đọc ATC, không thay register nước.</p>" +
            "<table class=\"db\"><thead><tr><th>Nước</th><th>Việc</th><th></th></tr></thead><tbody>" +
            miss.map((p) => {
              return "<tr><td>" + flagImg(p.cc) + " <strong>" + esc(p.name) + "</strong></td><td class=\"how\">" + p.how + "</td><td><a class=\"go\" href=\"" + esc(p.url) + "\" target=\"_blank\" rel=\"noopener\">Open</a></td></tr>";
            }).join("") + "</tbody></table>";
        }
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
        dumpCc = new Set();
        for (let i = 0; i < MED.length; i++) {
          const r = MED[i];
          const src = r[6] || (r[0] === "EMA" ? "e" : "d");
          if (src === "d" && r[0] !== "EMA") dumpCc.add(r[0]);
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
          const d = JSON.parse(document.getElementById("sra-med").textContent);
          const t = d.t || [];
          MED = (d.r || []).map(function (r) {
            return [t[r[0]] || "", t[r[1]] || "", t[r[2]] || "", t[r[3]] || "", t[r[4]] || "", t[r[5]] || "", t[r[6]] || "d"];
          });
          HEALTH = d.h || null;
          SITES = d.c || {};
          buildInns();
          paintSrc();
          paintFlags();
          paintFormChips();
          paintMg();
          saveSel();
          mmeta.textContent = (d.n || MED.length).toLocaleString("vi-VN") + " dòng đang lưu hành · " + (d.u || "");
          paintHealth();
          hydrateFlags();
        } catch (e) {
          mmeta.textContent = "Không đọc được chỉ mục thuốc trên trang.";
        }
      }
      loadMed();
      setGuide(saved);
      guideBtns.forEach((b) => b.addEventListener("click", () => setGuide(b.dataset.guide)));
      window.addEventListener("beforeprint", () => paintUi(root.dataset.guide, true));
      window.addEventListener("afterprint", () => paintUi(root.dataset.guide, false));

      if (mgo) mgo.addEventListener("click", searchMed);
      if (msrc) msrc.addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-src]");
        if (!b) return;
        srcKind = b.getAttribute("data-src");
        paintSrc();
        if ((mq.value || "").trim().length >= 2) searchMed();
      });
      if (mflags) mflags.addEventListener("click", (ev) => {
        const reg = ev.target.closest("button[data-reg]");
        if (reg) {
          const k = reg.getAttribute("data-reg");
          selCc.clear();
          if (k === "eea") EEA.forEach((c) => { if (SRA36.indexOf(c) !== -1) selCc.add(c); });
          else if (k === "dump") dumpCc.forEach((c) => selCc.add(c));
          paintFlags();
          if ((mq.value || "").trim().length >= 2) searchMed();
          return;
        }
        const b = ev.target.closest("button[data-cc]");
        if (!b) return;
        const cc = b.getAttribute("data-cc");
        if (selCc.has(cc)) selCc.delete(cc); else selCc.add(cc);
        paintFlags();
        if ((mq.value || "").trim().length >= 2) searchMed();
      });
      if (mforms) mforms.addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-form]");
        if (!b) return;
        const k = b.getAttribute("data-form");
        if (selForms.has(k)) selForms.delete(k); else selForms.add(k);
        paintFormChips();
        if ((mq.value || "").trim().length >= 2) searchMed();
      });
      function onMg() {
        let a = Number(mgMinEl.value), b = Number(mgMaxEl.value);
        if (a > b) { const t = a; a = b; b = t; mgMinEl.value = a; mgMaxEl.value = b; }
        paintMg();
        if ((mq.value || "").trim().length >= 2) searchMed();
      }
      if (mgMinEl) mgMinEl.addEventListener("input", onMg);
      if (mgMaxEl) mgMaxEl.addEventListener("input", onMg);
      if (pageSizeEl) {
        pageSizeEl.value = String(pageSize);
        pageSizeEl.addEventListener("change", () => {
          pageSize = Number(pageSizeEl.value || 50);
          try { localStorage.setItem("sra-page", String(pageSize)); } catch (e) {}
          if ((mq.value || "").trim().length >= 2) searchMed();
        });
      }
      if (mgroups) {
        mgroups.addEventListener("change", (ev) => {
          const inp = ev.target.closest("input[type=checkbox][data-k]");
          if (!inp) return;
          const d = inp.closest("details.cg");
          const list = d ? store.get(d) : [];
          const tr = inp.closest("tr");
          const num = tr && tr.querySelector(".num");
          const r = list[Number((num && num.textContent) || 1) - 1];
          const cc = (d && d.dataset.cc) || (r && r[0]) || "";
          if (r) remember(cc, r, inp.checked);
        });
      }
      const selPage = document.getElementById("sel-page");
      if (selPage) selPage.addEventListener("change", () => {
        document.querySelectorAll("#med-groups details.cg[open] tbody input[type=checkbox]").forEach((inp) => {
          inp.checked = selPage.checked;
          inp.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });
      const selMatch = document.getElementById("sel-match");
      if (selMatch) selMatch.addEventListener("click", () => {
        document.querySelectorAll("#med-groups details.cg").forEach((d) => {
          const list = store.get(d) || [];
          const cc = d.dataset.cc || "";
          list.forEach((r) => remember(cc || r[0], r, true));
        });
        document.querySelectorAll("#med-groups input[type=checkbox][data-k]").forEach((inp) => { inp.checked = true; });
      });
      const selExport = document.getElementById("sel-export");
      if (selExport) selExport.addEventListener("click", exportSel);
      const selClear = document.getElementById("sel-clear");
      if (selClear) selClear.addEventListener("click", () => {
        selected = {};
        saveSel();
        document.querySelectorAll("#med-groups input[type=checkbox]").forEach((inp) => { inp.checked = false; });
        if (selPage) selPage.checked = false;
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
          } else if (ev.key === "Escape") hideSuggest();
          else if (ev.key === "Enter") {
            if (sugIx >= 0 && items[sugIx]) {
              ev.preventDefault();
              pickSuggest(items[sugIx].querySelector(".inn").textContent);
            } else searchMed();
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
