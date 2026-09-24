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
        if (typeof searchMed === "function" && hasSearched) searchMed();
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
      const SEARCH_COUNTRIES = [...SRA36, 'VN'];
      CC.VN = 'Việt Nam'; EN.VN = 'Vietnam';
      const SRC = {
        FR:{agency:"ANSM",url:"https://base-donnees-publique.medicaments.gouv.fr/"},
        ES:{agency:"AEMPS",url:"https://cima.aemps.es/"},
        EMA:{agency:"EMA",url:"https://www.ema.europa.eu/en/medicines"},
        CA:{agency:"Health Canada",url:"https://health-products.canada.ca/dpd-bdpp/index-eng.jsp"},
        US:{agency:"FDA",url:"https://www.accessdata.fda.gov/scripts/cder/daf/"},
        IE:{agency:"HPRA",url:"https://www.hpra.ie/find-a-medicine"},
        CZ:{agency:"SÚKL",url:"https://prehledy.sukl.cz/index_en.html"},
        RO:{agency:"ANM",url:"https://www.anm.ro/nomenclator/medicamente"},
        LV:{agency:"ZVA",url:"https://dati.zva.gov.lv/zalu-registrs/en"},
        LU:{agency:"Santé LU",url:"https://santesecu.public.lu/fr/espace-professionnel/departement-sante/pharmacies-et-medicaments/medicaments-humains.html",searchDomain:"santesecu.public.lu"},
        CH:{agency:"Swissmedic",url:"https://www.swissmedicinfo.ch/"},
        FI:{agency:"FIMEA",url:"https://fimea.fi/en/databases_and_registers/fimeaweb"},
        IS:{agency:"IMA",url:"https://www.serlyfjaskra.is/"},
        AT:{agency:"BASG",url:"https://medikamente.basg.gv.at/en/medicinal-products"},
        EE:{agency:"SAM",url:"https://ravimiregister.ee/en/default.aspx"},
        BE:{agency:"AFMPS",url:"https://banquededonneesmedicaments.fagg-afmps.be/usage-humain"},
        IT:{agency:"AIFA",url:"https://medicinali.aifa.gov.it/en/#/en/"},
        NO:{agency:"NOMA",url:"https://www.legemiddelsok.no/"},
        AU:{agency:"TGA",url:"https://www.tga.gov.au/resources/artg"},
        BG:{agency:"BDA",url:"https://www.bda.bg/en/registers",searchDomain:"bda.bg"},
        HR:{agency:"HALMED",url:"https://www.halmed.hr/en/Lijekovi/pretrazivanje-lijekova/"},
        CY:{agency:"CyPHS",url:"https://www.phs.moh.gov.cy/human-search/home.xhtml?lang=en"},
        DK:{agency:"DKMA",url:"https://www.produktresume.dk/AppBuilder/search"},
        DE:{agency:"BfArM",url:"https://portal.bfarm.de/amguifree/am/search.xhtml"},
        GR:{agency:"EOF",url:"https://eof.gr/en/anazitisi-proionton/"},
        HU:{agency:"NNGYK",url:"https://ogyei.gov.hu/gyogyszeradatbazis"},
        LT:{agency:"VVKT",url:"https://vapris.vvkt.lt/vvkt-web/public/medications"},
        MT:{agency:"MAM",url:"https://www.medicinesauthority.gov.mt/advanced-search"},
        NL:{agency:"CBG-MEB",url:"https://www.geneesmiddeleninformatiebank.nl/"},
        PL:{agency:"RPL",url:"https://rejestrymedyczne.ezdrowie.gov.pl/rpl/search/public"},
        PT:{agency:"INFARMED",url:"https://extranet.infarmed.pt/INFOMED-fo/index.xhtml"},
        SK:{agency:"SIDC",url:"https://www.sukl.sk/en/servis/search/searching-on-the-database-of-medicinal-products?page_id=410"},
        SI:{agency:"JAZMP",url:"https://www.cbz.si/"},
        SE:{agency:"MPA",url:"https://www.lakemedelsverket.se/sv/sok-lakemedelsfakta"},
        GB:{agency:"MHRA",url:"https://products.mhra.gov.uk/"},
        JP:{agency:"PMDA",url:"https://www.pmda.go.jp/PmdaSearch/iyakuSearch/"},
        LI:{agency:"BASG",url:"https://medikamente.basg.gv.at/en/medicinal-products"}
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
        { cc:"LT", name:"Lithuania", tag:"dump", how:"VVKT CSV đã nạp từ data/raw/add.", url:"https://vapris.vvkt.lt/vvkt-web/public/medications" },
        { cc:"PL", name:"Ba Lan", tag:"dump", how:"RPL xlsx đã nạp từ data/raw/add.", url:"https://rejestrymedyczne.ezdrowie.gov.pl/rpl/search/public" },
        { cc:"SE", name:"Thụy Điển", tag:"dump", how:"Lakemedelsprodukter Excel (mọi sheet, chỉ Godkänd/Registrerad đang bán) đã nạp.", url:"https://www.lakemedelsverket.se/sv/sok-lakemedelsfakta" },
        { cc:"ES", name:"Tây Ban Nha", tag:"dump", how:"CIMA REST API (pagina JSON) đã nạp — không phụ thuộc form web.", url:"https://cima.aemps.es/cima/rest/medicamentos?pagina=1" },
        { cc:"CH", name:"Thụy Sĩ", tag:"dump", how:"Swissmedic Erweiterte Liste HAM Excel đã nạp.", url:"https://www.swissmedic.ch/swissmedic/en/home/services/ogd.html" },
        { cc:"NL", name:"Hà Lan", tag:"dump", how:"CBG-MEB CSV đã nạp từ data/raw/add.", url:"https://www.geneesmiddeleninformatiebank.nl/" },
        { cc:"HU", name:"Hungary", tag:"dump", how:"OGYÉI tk_lista CSV đã nạp.", url:"https://ogyei.gov.hu/gyogyszeradatbazis" },
        { cc:"DE", name:"Đức", tag:"dump", how:"Gelbe Liste Profi-Suche crawl theo ATC L2 (~41k thuốc điều trị).", url:"https://www.gelbe-liste.de/profi-suche" },
        { cc:"DK", name:"Đan Mạch", tag:"dump", how:"DKMA Godkendte Lægemidler Excel đã nạp.", url:"https://www.produktresume.dk/AppBuilder/search" },
        { cc:"PT", name:"Bồ Đào Nha", tag:"dump", how:"INFARMED list đã nạp từ data/raw/add.", url:"https://extranet.infarmed.pt/INFOMED-fo/index.xhtml" },
        { cc:"SK", name:"Slovakia", tag:"dump", how:"SIDC JSON (lieky_ui42 + atc.php) đã nạp.", url:"https://www.sukl.sk/en/servis/search/searching-on-the-database-of-medicinal-products?page_id=410" },
        { cc:"HR", name:"Croatia", tag:"dump", how:"HALMED Excel đã nạp từ data/raw/add.", url:"https://www.halmed.hr/en/Lijekovi/pretrazivanje-lijekova/" },
        { cc:"GB", name:"Anh", tag:"dump", how:"NHS dm+d XML đã nạp (MHRA/EMA licensed AMPs).", url:"https://products.mhra.gov.uk/" },
        { cc:"JP", name:"Nhật", tag:"dump", how:"PMDA List of Approved Drugs PDF đã nạp.", url:"https://www.pmda.go.jp/PmdaSearch/iyakuSearch/" },
        { cc:"CY", name:"Síp", tag:"dump", how:"Pricelist Excel (INN + MAH) đã nạp.", url:"https://www.phs.moh.gov.cy/human-search/home.xhtml?lang=en" },
        { cc:"GR", name:"Hy Lạp", tag:"dump", how:"EOF crawl danh mục đầy đủ (mã thuốc, INN, MAH) đã nạp.", url:"https://services.eof.gr/human-search/home.xhtml" },
        { cc:"MT", name:"Malta", tag:"dump", how:"Medicines Authority CSV đã nạp từ data/raw/add.", url:"https://www.medicinesauthority.gov.mt/advanced-search" },
        { cc:"SI", name:"Slovenia", tag:"dump", how:"JAZMP/CBZ CSV đã nạp từ data/raw/add.", url:"https://www.cbz.si/" },
        { cc:"LI", name:"Liechtenstein", tag:"skip", how:"Không CSDL riêng — Article 57 + Áo + Swissmedic + EMA.", url:"https://medikamente.basg.gv.at/de/" }
      ];

      let MED = [];
      let HEALTH = null;
      let SITES = {};
      let vnIndex = SraVn.create([]);
      const vnNote = document.getElementById('vn-note');
      let vnData = null;
      let vnSnapshot = null;
      const vnOptions = SraVn.SIMPLE_POLICY;
      const TAG_LABEL_KEY = 'sra-vn-tag-labels';
      let tagConfigs = SraVn.DEFAULT_TAG_CONFIGS.map((t) => ({ ...t }));
      try {
        const savedLabels = JSON.parse(localStorage.getItem(TAG_LABEL_KEY) || '{}');
        tagConfigs.forEach((t) => { if (savedLabels[t.id]) t.label = String(savedLabels[t.id]); });
      } catch (e) {}
      let selectedTags = new Set(SraVn.defaultSelectedTags(tagConfigs));
      let vnAssessments = new Map();
      let compare = null;
      const vnReasons = {eligible:'đủ điều kiện', revoked:'thu hồi/đã xóa', inactive:'không hoạt động', type:'ngoài loại SĐK mục tiêu', expired:'hết hạn theo dữ liệu, chưa có bằng chứng gia hạn', renewalReview:'có tiếp nhận gia hạn, cần xác minh hạn mới', unknownExpiry:'thiếu hạn/trạng thái', unknownTerm:'thiếu hoặc mâu thuẫn kỳ cấp', shortTerm:'kỳ cấp/gia hạn ≤ 3 năm', nearExpiry:'không đủ thời gian còn lại', missingInn:'thiếu hoạt chất', domestic:'khớp Danh mục 93 nội địa'};
      function vnTagsConfigured() { return !!(vnSnapshot && vnSnapshot.records && vnSnapshot.records.length); }
      function vnFilterActive() { return selectedTags.size > 0; }
      function saveTagLabels() {
        const out = {};
        tagConfigs.forEach((t) => { out[t.id] = t.label; });
        try { localStorage.setItem(TAG_LABEL_KEY, JSON.stringify(out)); } catch (e) {}
      }
      function configureVn(force) {
        if (!vnSnapshot) return;
        const now=new Date(), today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        if(!force && vnIndex?.asOf===today && vnIndex.indexFor){ rebuildVnMatch(); paintVn(); paintTagFilter(); return; }
        vnIndex = vnSnapshot.configure(vnOptions);
        vnAssessments = new Map(vnIndex.audit.map(a=>[a.record.id,a]));
        rebuildVnMatch();
        paintVn();
        paintTagFilter();
      }
      function rebuildVnMatch() {
        if (!vnIndex?.indexFor) { vnIndex = Object.assign(SraVn.create([]), {tagStats:{}, indexFor:()=>SraVn.create([]), recordsFor:()=>[], domestic:()=>'unlisted'}); return; }
        const matcher = vnIndex.indexFor([...selectedTags]);
        vnIndex.matches = matcher.matches.bind(matcher);
        vnIndex.size = matcher.size;
      }
      function tagMeta(id) { return tagConfigs.find((t) => t.id === id); }
      function paintTagFilter() {
        const list = document.getElementById('vn-tag-list');
        const countEl = document.getElementById('vn-tag-count');
        const dots = document.getElementById('vn-tag-dots');
        const filterRoot = document.getElementById('vn-tag-filter');
        if (!list) return;
        const available = !!vnSnapshot?.records.length;
        if (filterRoot) filterRoot.querySelectorAll('input,button').forEach((el) => { el.disabled = !available; });
        list.innerHTML = tagConfigs.map((t) => {
          const n = vnIndex?.tagStats?.[t.id] || 0;
          const on = selectedTags.has(t.id);
          return `<label class="tag-row" data-tag="${esc(t.id)}">`+
            `<input type="checkbox" data-vn-tag="${esc(t.id)}" ${on ? 'checked' : ''} ${available ? '' : 'disabled'} />`+
            `<span class="tag-dot" style="background:${esc(t.colorHex)}"></span>`+
            `<span class="tag-label-wrap"><button type="button" class="tag-label" data-rename-tag="${esc(t.id)}" title="Đổi tên nhãn (lưu máy này)">${esc(t.label)}</button>`+
            `<small style="color:var(--muted)">${n.toLocaleString('vi-VN')} hồ sơ</small></span>`+
            `<button type="button" class="tag-info" aria-label="Giải thích ${esc(t.label)}">?</button>`+
            `<span class="tag-tip" role="tooltip"><strong>${esc(t.shortTitle)}</strong><span>${esc(t.description)}</span></span>`+
          `</label>`;
        }).join('');
        countEl.textContent = selectedTags.size ? `Đã chọn: ${selectedTags.size}` : 'Chưa chọn';
        dots.innerHTML = tagConfigs.filter((t) => selectedTags.has(t.id)).map((t) => `<i style="background:${esc(t.colorHex)}"></i>`).join('');
        paintFilterDrawerCount();
      }
      function paintVn(blocked=0, review=0) {
        const available = !!vnSnapshot?.records.length;
        if (!available) {vnNote.textContent='Chưa có dữ liệu SĐK DAV để sàng lọc.'; vnNote.classList.add('warn'); return;}
        if (!selectedTags.size) {
          vnNote.textContent = 'Vui lòng chọn ít nhất một phân loại tag để hiển thị kết quả.';
          vnNote.classList.add('warn');
          return;
        }
        vnNote.classList.remove('warn');
        const parts = tagConfigs.filter((t) => selectedTags.has(t.id)).map((t) => {
          const n = vnIndex?.tagStats?.[t.id] || 0;
          return `${t.label} ${n.toLocaleString('vi-VN')}`;
        });
        vnNote.textContent = 'Lọc SĐK VN: ' + parts.join(' · ') + ' · DAV ' + vnData.updated.slice(0,10).split('-').reverse().join('/') + ' · xét ngày ' + (vnIndex.asOf || '') +
          (blocked || review ? ` · loại ${blocked.toLocaleString('vi-VN')} khớp DM93` + (review ? `, giữ ${review.toLocaleString('vi-VN')} cần đối chiếu` : '') : '');
      }
      function vnDomestic(r) {return vnIndex.domestic ? vnIndex.domestic(r[1],r[4],r[3],vnOptions.group) : 'unlisted';}
      function vnRowTag(r) {
        if (r[0] !== 'VN') return '';
        return vnAssessments.get(r[7])?.tagId || '';
      }
      function vnRowAllowed(r) {
        if (!vnTagsConfigured()) return true;
        if (!selectedTags.size) return false;
        if (r[0] === 'VN') return selectedTags.has(vnRowTag(r));
        return vnIndex.matches(r[1]) || Object.values(r._inns || {}).some((inn) => vnIndex.matches(inn));
      }
      function vnBadgeHtml(tagId) {
        const t = tagMeta(tagId);
        if (!t) return '';
        return `<span class="vn-badge" style="color:${esc(t.colorHex)};border-color:${esc(t.colorHex)}55;background:${esc(t.colorHex)}14"><i style="background:${esc(t.colorHex)}"></i>${esc(t.label)}</span>`;
      }
      let INNS = [];
      let searchTerms = [];
      let dumpCc = new Set();
      let srcSel = new Set();
      let hasSearched = false;

      const selForms = new Set();
      let sugIx = -1;
      let sugTimer = 0;
      const safePageSize=value=>[25,50,100,200].includes(Number(value))?Number(value):50;
      let pageSize = 50;
      let selected = {};
      try { selected = JSON.parse(localStorage.getItem("sra-sel") || "{}") || {}; } catch (e) { selected = {}; }
      try { pageSize = safePageSize(localStorage.getItem("sra-page")); localStorage.setItem("sra-page",String(pageSize)); } catch (e) {}
      const store = new WeakMap();
      const shownN = new WeakMap();
      const allRows = new WeakMap();

      const mapSvg = document.getElementById('country-map');
      let countryView = 'globe';
      let activeCountry = '';
      let countryCounts = {};
      let countryData = {};
      let focusedCountry = '';
      let resultScrollFrame = 0;
      const selCountries = new Set();
      function paintFilterDrawerCount() {
        const el = document.getElementById('filter-drawer-count');
        if (!el) return;
        const n = selForms.size + selCountries.size + srcSel.size + (selectedTags.size ? 1 : 0) +
          ((document.getElementById('mg-exact')?.value || '').trim() || mgMinEl.value || mgMaxEl.value ? 1 : 0);
        el.textContent = n ? `${n} đang bật` : 'Hàm lượng · dạng · quốc gia · VN';
      }
      function syncFilterDrawer() {
        const drawer = document.getElementById('filter-drawer');
        if (!drawer) return;
        const mobile = window.matchMedia('(max-width: 680px)').matches;
        drawer.open = !mobile;
        paintFilterDrawerCount();
      }
      const WORLD = JSON.parse(document.getElementById('sra-world').textContent);
      const countryMap = SraCountryMap(mapSvg, WORLD, {eligible:eligibleCountries, selected:()=>focusedCountry, label:countryName, onSelect:selectCountry});
      function eligibleCountries() {
        return SEARCH_COUNTRIES.filter(c => !selCountries.size || selCountries.has(c));
      }
      function selectCountry(cc) {
        if (cc && cc === activeCountry) cc = '';
        activeCountry = cc || '';
        focusCountry(activeCountry);
        paintCountries();
        searchMed({ keepPeek: true });
        if (window.matchMedia('(max-width: 680px)').matches) {
          document.querySelector('.tra-main').scrollIntoView({block:'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
        }
      }
      function syncTraHeights() {
        const left = document.querySelector('.country-panel');
        const main = document.querySelector('.tra-main');
        if (!left || !main) return;
        if (window.matchMedia('(max-width: 680px)').matches) {
          main.style.height = '';
          return;
        }
        main.style.height = left.offsetHeight + 'px';
      }
      function paintCountries() {
        const listEl = document.getElementById('country-list');
        const showList = countryView === 'list';
        if (listEl) {
          listEl.hidden = !showList;
          if (showList) {
            const list = eligibleCountries().slice().sort((a,b) => countryName(a).localeCompare(countryName(b), 'vi'));
            listEl.innerHTML = list.map(c => `<button type="button" data-country="${c}" aria-pressed="${focusedCountry === c}">${flagImg(c)}<span>${esc(countryName(c))}</span><span class="country-total">${countryCounts[c] == null ? '' : countryCounts[c].toLocaleString('vi-VN')}</span></button>`).join('') || '<p style="padding:12px">Không tìm thấy quốc gia.</p>';
          }
        }
        const allBtn = document.getElementById('country-all');
        if (allBtn) allBtn.hidden = !activeCountry;
        drawMap();
        syncTraHeights();
      }
      function drawMap() { countryMap.render(); }
      function focusCountry(cc) {
        focusedCountry = cc || '';
        const listEl = document.getElementById('country-list');
        if (listEl) listEl.querySelectorAll('[data-country]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.country === focusedCountry)));
        countryMap.focus(focusedCountry);
        syncTraHeights();
      }
      document.getElementById('country-list').addEventListener('click', ev => {
        const b = ev.target.closest('[data-country]');
        if (b) selectCountry(b.dataset.country);
      });
      document.getElementById('country-all').addEventListener('click', () => selectCountry(''));
      document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
        countryView = b.dataset.view;
        countryMap.setView(countryView);
        document.querySelectorAll('[data-view]').forEach(el => el.setAttribute('aria-pressed', String(el === b)));
        paintCountries();
      }));
      syncFilterDrawer();
      window.addEventListener('resize', () => {
        const drawer = document.getElementById('filter-drawer');
        if (drawer && !window.matchMedia('(max-width: 680px)').matches) drawer.open = true;
      });
      async function buildCountryData() {
        const ema = MED.filter(r => rowSrc(r) === 'e');
        const local = {};
        for (const r of MED) if (rowSrc(r) !== 'e') (local[r[0]] ||= []).push(r);
        for (const cc of SEARCH_COUNTRIES) {
          countryData[cc] = cc==='VN' ? (local.VN || []) : SraData.mergeRows([...(local[cc] || []), ...(EEA.has(cc) ? ema : [])]);
          await loadProgress(50+Math.floor((SEARCH_COUNTRIES.indexOf(cc)+1)/SEARCH_COUNTRIES.length*49),'Lập chỉ mục '+countryName(cc));
          for (const r of countryData[cc]) r._search = searchText(r.slice(1, 6).join(' ') + ' ' + (r[8] || ''));
        }
      }

      function searchText(text) { return SraData.norm(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd'); }

      function countryName(cc) { return CC[cc] || cc; }
      function flagIso(cc) { return cc === "EMA" ? "eu" : String(cc || "").toLowerCase(); }
      function flagImg(cc) {
        if (window.matchMedia('(max-width: 680px)').matches) return '';
        const iso = flagIso(cc);
        return "<img class=\"flg\" width=\"20\" height=\"15\" alt=\"\" loading=\"lazy\" decoding=\"async\" src=\"https://flagcdn.com/w20/" + iso + ".png\" srcset=\"https://flagcdn.com/w40/" + iso + ".png 2x\" />";
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
      function srcOf(cc) { return cc==='VN' ? {agency:'DAV',url:'https://dichvucong.dav.gov.vn/congbothuoc/index'} : SRC[cc] || { agency: cc, url: "https://www.google.com/search?q=" + encodeURIComponent((EN[cc] || cc) + " official medicines register") }; }

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
      function searchHref(company) {
        return "https://www.google.com/search?q=" + encodeURIComponent(company);
      }
      function companyLink(company) {
        const link = SITES[company];
        if (link && typeof link === 'object' && /^https:\/\//i.test(link.url || '') && ['official', 'profile', 'search'].includes(link.kind)) return link;
        return { url: searchHref(company), kind: 'search' };
      }
      function coCell(company) {
        if (!company) return "—";
        const link = companyLink(company);
        const label = {official: 'Website công ty', profile: 'Giới thiệu công ty', search: 'Google Search'}[link.kind];
        return `<a class="co${link.kind === 'search' ? ' g' : ''}" href="${esc(link.url)}" target="_blank" rel="noopener" title="${label}">${esc(company)}<span class="co-kind">${label} ↗</span></a>`;
      }
      function rowSrc(r) {
        return r[6] === "e" || r[0] === "EMA" ? "e" : "d";
      }
      function srcChip(src, cc, product) {
        const ema = src === "e";
        const s = ema ? SRC.EMA : srcOf(cc);
        const hint = s.searchDomain ? 'Mở danh mục/file gốc của ' + s.agency : 'Mở trang tra cứu ' + s.agency;
        return `<a class="src${ema ? ' ema' : ''}" href="${esc(s.url)}" data-source="${ema ? 'ema' : 'dump'}" data-copy-product="${esc(product || '')}" title="${esc(hint)}; sao chép tên thuốc" target="_blank" rel="noopener">${ema ? 'EMA' : 'dump'} ↗</a>`;
      }

      function rowKey(cc, r) {
        return cc + "\t" + (r[1] || "") + "\t" + (r[2] || "") + "\t" + (r[3] || "") + "\t" + (r[4] || "") + "\t" + (r[5] || "") + "\t" + (r[6] || "d") + (cc==='VN' ? '\t'+r[7] : '');
      }
      function saveSel() {
        try { localStorage.setItem("sra-sel", JSON.stringify(selected)); } catch (e) {}
        if (selN) selN.textContent = Object.keys(selected).length.toLocaleString("vi-VN") + " đã chọn";
      }
      function paintSrc() {
        if (!msrc) return;
        msrc.innerHTML = [["d","dump"],["e","EMA"]].map(([k, lab]) => {
          return "<button type=\"button\" data-src=\"" + k + "\" class=\"" + (srcSel.has(k) ? "on" : "") + "\" aria-pressed=\"" + srcSel.has(k) + "\">" + lab + "</button>";
        }).join("") + (srcSel.has("d") && srcSel.has("e") ? "<p class=\"src-hint\">Đang lọc thuốc có cả dump và EMA</p>" : "");
        paintFilterDrawerCount();
      }
      function paintFlags() {
        const query = searchText(document.getElementById('filter-country-query').value);
        mflags.innerHTML = SEARCH_COUNTRIES.slice().sort((a,b)=>countryName(a).localeCompare(countryName(b),'vi')).filter(c=>searchText(c+' '+CC[c]+' '+EN[c]).includes(query)).map(c => `<label><input type="checkbox" data-country-filter="${c}" ${selCountries.has(c) ? 'checked' : ''} />${flagImg(c)}${esc(countryName(c))}</label>`).join('') || '<p>Không tìm thấy quốc gia.</p>';
        document.getElementById('region-count').textContent = selCountries.size ? '(' + selCountries.size + ')' : '';
        paintFilterDrawerCount();
      }
      function paintFormChips() {
        const mode = root.dataset.guide === 'en' ? 'en' : 'vi';
        mforms.innerHTML = Object.keys(FORM_LBL).map(k => `<label><input type="checkbox" data-form="${k}" ${selForms.has(k) ? 'checked' : ''} />${esc(FORM_LBL[k][mode])}</label>`).join('');
        document.getElementById('form-count').textContent = selForms.size ? '(' + selForms.size + ')' : '';
        paintFilterDrawerCount();
      }
      function paintMg() {
        const lo = mgMinEl.value, hi = mgMaxEl.value;
        const invalid = (lo !== '' && (!mgMinEl.validity.valid || Number(lo) < 0)) || (hi !== '' && (!mgMaxEl.validity.valid || Number(hi) < 0)) || (lo !== '' && hi !== '' && Number(lo) > Number(hi));
        mgVal.textContent = invalid ? 'Khoảng chưa hợp lệ: đầu dưới phải nhỏ hơn hoặc bằng đầu trên.' : (!lo && !hi ? 'Mọi hàm lượng' : (lo || '0') + ' – ' + (hi || 'không giới hạn') + ' mg');
        mgVal.style.color = invalid ? 'var(--warn)' : '';
        const cap = Math.max(1000, Number(lo) || 0, Number(hi) || 0);
        for (const [id, value] of [['mg-low-slider', lo || 0], ['mg-high-slider', hi || cap]]) {
          const slider = document.getElementById(id); slider.max = cap; slider.value = value;
        }
        paintFilterDrawerCount();
      }

      function termText(item) {
        return typeof item === 'string' ? item : (item && item.term) || '';
      }
      function termKind(item) {
        return typeof item === 'string' ? '' : (item && item.kind) || '';
      }
      const termKinds=new Map(), termPlans=new Map();
      function resolveTermKind(term, kind) {
        if (kind) return kind;
        const key = searchText(term);
        if(termKinds.has(key))return termKinds.get(key);
        const hits = INNS.filter((it) => it.key === key);
        const resolved=hits.length === 1 ? hits[0].kind : '';termKinds.set(key,resolved);return resolved;
      }
      function rowMatchesTerm(r, term, kind) {
        const cacheKey=kind+'\t'+term;
        let plan=termPlans.get(cacheKey);
        if(!plan){const key=searchText(term);plan={key,bits:key.split(/\s+/).filter(Boolean),resolved:resolveTermKind(term,kind)};termPlans.set(cacheKey,plan);}
        const {bits,resolved}=plan;
        if (!bits.length) return true;
        // Company suggestions must match the registrant/MAH field exactly (folded),
        // otherwise shared tokens like "cong ty co phan duoc ... an" leak across firms.
        if (resolved === 'Công ty') return SraData.companyExactMatch(r[5] || '', term);
        if (resolved === 'Hoạt chất') {
          const inns = [r[1], ...Object.values(r._inns || {})].map(searchText);
          return inns.some((hay) => SraData.queryMatches(hay, bits));
        }
        if (resolved === 'Tên thuốc') return SraData.queryMatches(searchText(r[2] || ''), bits);
        return SraData.queryMatches(r._search, bits);
      }
      function rowMatchesQueries(r) {
        if (!searchTerms.length) return true;
        return searchTerms.some((item) => rowMatchesTerm(r, termText(item), termKind(item)));
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
          return "<button type=\"button\" data-kind=\"" + esc(it.kind) + "\" class=\"" + (i === sugIx ? "on" : "") + "\"><span class=\"inn\">" + esc(it.inn) + "</span><span class=\"n\">" + esc(it.kind) + " · " + it.n + " dòng · " + it.ccs + "</span></button>";
        }).join("");
      }
      function matchInns(qstr) {
        const v = searchText(qstr);
        if (v.length < 2) return [];
        const priority = { 'Hoạt chất': 0, 'Tên thuốc': 1, 'Công ty': 2 };
        const selectedTerms = new Set(searchTerms.map((item) => searchText(termText(item))));
        return INNS.filter(it => it.key.includes(v) && !selectedTerms.has(searchText(it.inn)))
          .sort((a,b) => priority[a.kind] - priority[b.kind] || Number(b.key.startsWith(v)) - Number(a.key.startsWith(v)) || b.n - a.n)
          .slice(0, 12);
      }
      function rowHtml(r, idx, code, src) {
        const k = rowKey(code, r);
        const on = selected[k] ? " checked" : "";
        const tagId = vnRowTag(r); const vnBadge = (vnFilterActive() && tagId ? vnBadgeHtml(tagId) : '') + (vnFilterActive() && selectedTags.has('TAG_XANH_LA') && vnDomestic(r)==='review' ? '<span class="vn-review">Cần đối chiếu ô kỹ thuật VN</span>' : '');
        return "<tr data-k=\"" + esc(k) + "\"><td class=\"ck\"><input type=\"checkbox\" data-k=\"" + esc(k) + "\"" + on + "></td><td class=\"num\">" + (idx + 1) + "</td><td class=\"inn\">" + esc(r[1]) + vnBadge + "</td><td class=\"nm\">" + esc(r[2]) + (code === "VN" ? "<small class=\"vn-review\">SĐK: " + esc(r[8]) + " · Hạn: " + esc(vnAssessments.get(r[7])?.record.expiry || "chưa rõ") + "</small>" : "") + "</td><td class=\"fm\">" + esc(formText(r[3])) + "</td><td class=\"st\">" + esc(r[4] || "—") + "</td><td class=\"co\">" + coCell(r[5]) + "</td><td class=\"src\">" + (r._sources || [src]).map(k => srcChip(k, code, r[2])).join(" ") + "</td></tr>";
      }
      function bindCardSearch(d) {
        const inp = d.querySelector('.cg-q');
        if (!inp) return;
        const stop = (ev) => ev.stopPropagation();
        inp.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); inp.focus(); });
        inp.addEventListener('mousedown', stop);
        inp.addEventListener('pointerdown', stop);
        inp.addEventListener('keydown', (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter' || ev.key === ' ') ev.preventDefault();
        });
        let t = 0;
        inp.addEventListener('input', () => {
          window.clearTimeout(t);
          t = window.setTimeout(() => filterCard(d), 50);
        });
      }
      async function filterCard(d) {
        d._renderGen=(d._renderGen||0)+1;d._rendering=0;d.removeAttribute("aria-busy");
        const inp = d.querySelector('.cg-q');
        const all = allRows.get(d) || store.get(d) || [];
        const q = (inp && inp.value) || '';
        const gen=(d._filterGen=(d._filterGen||0)+1), list=[];
        const hasQuery=!!searchText(q);let lastYield=performance.now();
        for(let i=0;i<all.length;i++){
          if(!hasQuery||rowMatchesTerm(all[i],q,''))list.push(all[i]);
          if(i%256===0 && performance.now()-lastYield>10){
            d.querySelector('.cg-n').textContent='Đang lọc… '+Math.floor((i+1)/all.length*100)+'%';
            await new Promise(resolve=>setTimeout(resolve,0));
            if(gen!==d._filterGen||!d.isConnected)return;lastYield=performance.now();
          }
        }
        store.set(d, list);
        shownN.set(d, 0);
        const tb = d.querySelector('tbody');
        if (tb) tb.innerHTML = '';
        const more = d.querySelector('.more');
        if (more) more.remove();
        delete d.dataset.ready;
        const nEl = d.querySelector('.cg-n');
        if (nEl) nEl.textContent = list.length.toLocaleString('vi-VN') + ' dòng';
        if (!d.open) d.open = true;
        else {
          d.dataset.ready = '1';
          fillRows(d, d.dataset.cc);
        }
      }
      async function fillRows(d, code) {
        if(d._rendering)return;
        const gen=(d._renderGen=(d._renderGen||0)+1);
        d._rendering=gen;d.setAttribute('aria-busy','true');
        const list=store.get(d)||[], tb=d.querySelector('tbody'), start=shownN.get(d)||0;
        const cap=Math.min(list.length,start+safePageSize(pageSize));
        const loading=document.createElement('p');loading.className='cg-loading';loading.setAttribute('role','status');
        loading.textContent='Đang hiển thị kết quả… 0%';d.querySelector('.cg-body').prepend(loading);
        let more=d.querySelector('.more');if(more)more.disabled=true;
        const current=()=>d.isConnected && d._renderGen===gen && store.get(d)===list;
        try {
          // Paint feedback before building rows, including when reopening a large country card.
          await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
          if(!current())return;
          let html='',lastYield=performance.now();
          for(let i=start;i<cap;i++){
            html+=rowHtml(list[i],i,code,rowSrc(list[i]));
            if((i-start+1)%10===0 && performance.now()-lastYield>8){
              loading.textContent='Đang hiển thị kết quả… '+Math.floor((i-start+1)/Math.max(1,cap-start)*100)+'%';
              await new Promise(resolve=>setTimeout(resolve,0));if(!current())return;lastYield=performance.now();
            }
          }
          tb.insertAdjacentHTML('beforeend',html);shownN.set(d,cap);
          if(cap<list.length){
            if(!more){more=document.createElement('button');more.type='button';more.className='more';more.addEventListener('click',()=>fillRows(d,code));d.querySelector('.cg-body').appendChild(more);}
            more.textContent='Hiện thêm '+Math.min(safePageSize(pageSize),list.length-cap)+' ('+(list.length-cap).toLocaleString('vi-VN')+' còn lại)';more.hidden=false;
          }else if(more)more.hidden=true;
        } finally {
          loading.remove();
          if(d._renderGen===gen){d._rendering=0;d.removeAttribute('aria-busy');if(more)more.disabled=false;}
        }
      }
      function passes(r, src) {
        if(vnFilterActive() && r[0]==='VN' && !selectedTags.has(vnRowTag(r)))return false;
        const sources = r._sources || [src];
        if (srcSel.has("d") && srcSel.has("e")) {
          if (!(sources.includes("d") && sources.includes("e"))) return false;
        } else if (srcSel.has("d") && !sources.includes("d")) return false;
        else if (srcSel.has("e") && !sources.includes("e")) return false;
        if (selForms.size && !selForms.has(formKey(r[3]) || 'other')) return false;
        if (document.getElementById('strength-mode').value === 'exact') return SraData.strengthMatches(r[4], document.getElementById('mg-exact').value);
        const lo = mgMinEl.value, hi = mgMaxEl.value;
        if (!mgMinEl.validity.valid || !mgMaxEl.validity.valid || (lo !== '' && hi !== '' && Number(lo) > Number(hi))) return false;
        if (lo !== '' || hi !== '') {
          // A range is comparable only for a single mass, not combinations or mg/ml.
          const key = SraData.strengthKey(r[4]);
          if (!/^\d+(?:\.\d+)?mg$/.test(key)) return false;
          const mg = parseFloat(key);
          if (mg < Number(lo || 0) || (hi !== '' && mg > Number(hi))) return false;
        }
        return true;
      }

      function extraFiltersOn() {
        if (vnTagsConfigured()) return true;
        if (srcSel.size || selForms.size || selCountries.size) return true;
        if (document.getElementById("strength-mode").value === "exact" && (document.getElementById("mg-exact").value || "").trim()) return true;
        return !!(mgMinEl.value || mgMaxEl.value);
      }
      function searchMed(opts) {
        hasSearched = true;
        const keepPeek = !!(opts && opts.keepPeek);
        if (!keepPeek && activeCountry) {
          activeCountry = "";
          focusedCountry = "";
        }
        document.getElementById("search-start").hidden = true;
        document.getElementById("sel-page").checked = false;
        hideSuggest();
        mnone.style.display = "none";
        mhit.textContent = "Đang lọc… 0%";
        document.getElementById("compare-toggle").disabled=true;
        const queries = searchTerms.slice();
        const needFilter = queries.length > 0 || extraFiltersOn();
        const gen = (searchMed._gen = (searchMed._gen || 0) + 1);
        const run = async () => {
          if (gen !== searchMed._gen) return;
          mgroups.innerHTML = "";
          const buckets = {};
          const order = [];
          countryCounts = {};
          let n = 0;
          let vnBlocked = 0, vnReview = 0;
          const countries=eligibleCountries(), total=countries.reduce((n,c)=>n+(countryData[c]?.length||0),0);
          let processed=0, lastYield=performance.now();
          for (const cc of countries) {
            const rows = countryData[cc] || [], matches=[];
            for(const r of rows){
              let keep=!needFilter || ((!queries.length || rowMatchesQueries(r)) && passes(r,rowSrc(r)) && vnRowAllowed(r));
              if(keep && vnFilterActive() && selectedTags.has('TAG_XANH_LA') && r[0]!=='VN'){
                const state=vnDomestic(r);
                if(state==='blocked'){if(!activeCountry||activeCountry===cc)vnBlocked++;keep=false;}
                if(state==='review' && (!activeCountry||activeCountry===cc))vnReview++;
              }
              if(keep)matches.push(r);
              processed++;
              if(processed%256===0 && performance.now()-lastYield>10){
                mhit.textContent=`Đang lọc… ${Math.floor(processed/Math.max(1,total)*100)}%`;
                await new Promise(resolve=>setTimeout(resolve,0));
                if(gen!==searchMed._gen)return;
                lastYield=performance.now();
              }
            }
            countryCounts[cc] = matches.length;
            if ((!activeCountry || activeCountry === cc) && matches.length) {
              buckets[cc] = matches;
              order.push(cc);
              n += matches.length;
            }
          }
          paintCountries();
          order.sort((a, b) => {
            const ra = dumpCc.has(a) ? 0 : (EEA.has(a) ? 1 : 2);
            const rb = dumpCc.has(b) ? 0 : (EEA.has(b) ? 1 : 2);
            if (ra !== rb) return ra - rb;
            return (CC[a] || a).localeCompare(CC[b] || b, "vi");
          });
          order.forEach((code) => {
            const list = buckets[code];
            const hasEma = needFilter ? list.some((r) => r._sources.includes("e")) : EEA.has(code);
            const hasDump = needFilter ? list.some((r) => r._sources.includes("d")) : dumpCc.has(code);
            const d = document.createElement("details");
            d.className = "cg";
            d.dataset.cc = code;
            d.dataset.src = hasDump && !(srcSel.has("e") && !srcSel.has("d")) ? "d" : (hasEma ? "e" : "d");
            d.innerHTML =
              "<summary>" + flagImg(code) + "<span>" + esc(countryName(code)) + "</span>" +
              "<span class=\"cg-n\">" + list.length.toLocaleString("vi-VN") + " dòng</span>" +
              (hasDump ? '<span class="src-label">Nguồn quốc gia</span>' : "") +
              (hasEma ? '<span class="src-label">EMA</span>' : "") +
              "<input class=\"cg-q\" type=\"search\" placeholder=\"Lọc…\" aria-label=\"Lọc thuốc " + esc(countryName(code)) + "\" autocomplete=\"off\" /></summary>" +
              "<div class=\"cg-body\"><table class=\"med\"><colgroup><col class=\"ck\" /><col class=\"num\" /><col class=\"inn\" /><col class=\"nm\" /><col class=\"fm\" /><col class=\"st\" /><col class=\"co\" /><col class=\"src\" /></colgroup><thead><tr><th></th><th>#</th><th>Hoạt chất (INN)</th><th>Tên thuốc</th><th>Dạng</th><th>Hàm lượng</th><th>" + (code === "VN" ? "Công ty đăng ký" : "Công ty") + "</th><th>Nguồn</th></tr></thead><tbody></tbody></table></div>";
            store.set(d, list);
            allRows.set(d, list);
            shownN.set(d, 0);
            bindCardSearch(d);
            d.addEventListener("toggle", function () {
              if (!d.open || !d.isConnected) return;
              focusCountry(code);
              if (d.dataset.ready) return;
              d.dataset.ready = "1";
              fillRows(d, code);
            });
            mgroups.appendChild(d);
            if (activeCountry || order.length === 1 || code === focusedCountry) {
              d.open = true;
              d.dataset.ready = "1";
              fillRows(d, code);
            }
          });
          mnone.style.display = n ? "none" : "block";
          if(vnTagsConfigured())paintVn(vnBlocked, vnReview);
          mhit.textContent = (!selectedTags.size && vnTagsConfigured())
            ? 'Vui lòng chọn ít nhất một phân loại tag để hiển thị kết quả.'
            : (n ? (n.toLocaleString("vi-VN") + " dòng · " + order.length + " nước") : "Không có kết quả.");
          document.getElementById("compare-toggle").disabled=false;
          syncTraHeights();
        };
        window.setTimeout(run, 0);
      }
      function paintSearchTerms() {
        document.getElementById('search-terms').innerHTML = searchTerms.map((item, i) => {
          const term = termText(item);
          return `<span class="search-term"><span>${esc(term)}</span><button type="button" data-remove-term="${i}" aria-label="Xoá ${esc(term)}">×</button></span>`;
        }).join('');
        document.getElementById('search-terms').hidden = !searchTerms.length;
      }
      function pickSuggest(term, kind) {
        term = String(term || '').trim();
        kind = resolveTermKind(term, kind || '');
        if (term && !searchTerms.some((t) => searchText(termText(t)) === searchText(term))) {
          searchTerms.push(kind ? { term, kind } : term);
        }
        mq.value = '';
        paintSearchTerms();
        hideSuggest();
        searchMed();
        mq.focus();
      }
      document.getElementById('search-terms').addEventListener('click', ev => {
        const button = ev.target.closest('[data-remove-term]');
        if (!button) return;
        searchTerms.splice(Number(button.dataset.removeTerm), 1);
        paintSearchTerms(); searchMed(); mq.focus();
      });
      function remember(code, r, on, persist = true) {
        const k = rowKey(code, r);
        if (on) selected[k] = [code, r[1], r[2], r[3], r[4], r[5], (r._sources || [r[6] || "d"]).join("+"),r[7] || '',r[8] || ''];
        else delete selected[k];
        if (persist) saveSel();
      }
      function exportSel() {
        const keys = Object.keys(selected);
        if (!keys.length) return;
        const srcName = (s) => (!s ? "dump" : (String(s).includes("d") && String(s).includes("e") ? "dump+EMA" : (String(s).includes("e") ? "EMA" : "dump")));
        const srcHref = (cc, s) => {
          const bits = String(s || "d").split("+").filter(Boolean);
          if (bits.includes("e") && !bits.includes("d")) return (SRC.EMA && SRC.EMA.url) || "";
          return (srcOf(cc) || {}).url || "";
        };
        const emaHref = (SRC.EMA && SRC.EMA.url) || "https://www.ema.europa.eu/en/medicines";
        const head = "<tr><th>country</th><th>inn</th><th>product</th><th>form</th><th>strength</th><th>company</th><th>source</th></tr>";
        const body = keys.map((k) => {
          const r = selected[k];
          const cc = r[0] || "";
          const company = r[5] || "";
          const coUrl = companyLink(company).url;
          const src = r[6] || "d";
          const dumpUrl = srcHref(cc, src);
          const labels = String(src).split("+").filter(Boolean);
          const srcHtml = labels.map((bit) => {
            const lab = bit === "e" ? "EMA" : "dump";
            const href = bit === "e" ? emaHref : dumpUrl;
            return "<a href=\"" + esc(href) + "\">" + esc(lab) + "</a>";
          }).join(" · ") || esc(srcName(src));
          return "<tr><td>" + esc(countryName(cc) || cc) + "</td><td>" + esc(r[1]) + "</td><td>" + esc(r[2]) + "</td><td>" + esc(r[3]) + "</td><td>" + esc(r[4]) + "</td><td>" + (company ? "<a href=\"" + esc(coUrl) + "\">" + esc(company) + "</a>" : "—") + "</td><td>" + srcHtml + "</td></tr>";
        }).join("");
        const html = "<html xmlns:o=\"urn:schemas-microsoft-com:office:office\" xmlns:x=\"urn:schemas-microsoft-com:office:excel\"><head><meta charset=\"utf-8\" /></head><body><table border=\"1\">" + head + body + "</table></body></html>";
        const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
        const run = async () => {
          if (window.SraExcel && SraExcel.downloadBlob) await SraExcel.downloadBlob(blob, "sra-chon.xls", blob.type);
          else {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "sra-chon.xls";
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
          }
        };
        run();
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
      function fieldMix(s) {
        const tot = s.rows || 0;
        const full = s.full || 0;
        const lean = s.lean || 0;
        const mid = Math.max(tot - full - lean, 0);
        const p = s.pct || {};
        const fillPct = Math.round(((p.inn || 0) + (p.form || 0) + (p.strength || 0) + (p.company || 0)) / 4);
        return { tot, full, lean, mid, fullPct: pct(full, tot || 1), fillPct };
      }
      function greenScore(s) {
        const m = fieldMix(s);
        if (!m.tot) return -1;
        return m.fullPct * 10 + pct(m.mid, m.tot);
      }
      function allQuality() {
        const acc = { tot: 0, full: 0, lean: 0, mid: 0 };
        ((HEALTH && HEALTH.sources) || []).forEach((s) => {
          if (s.cc === "EMA") return;
          const m = fieldMix(s);
          acc.tot += m.tot;
          acc.full += m.full;
          acc.lean += m.lean;
          acc.mid += m.mid;
        });
        acc.fullPct = pct(acc.full, acc.tot || 1);
        return acc;
      }
      let healthCc = "";
      function applyQualityPie(pieId, mixId, legId, m) {
        const pie = document.getElementById(pieId);
        const mix = document.getElementById(mixId);
        const leg = document.getElementById(legId);
        const d1 = pct(m.full, m.tot || 1) * 3.6;
        const d2 = d1 + pct(m.mid, m.tot || 1) * 3.6;
        if (pie) {
          pie.classList.remove("idle");
          pie.classList.add("country");
          pie.style.setProperty("--d1", d1 + "deg");
          pie.style.setProperty("--d2", d2 + "deg");
        }
        if (mix) {
          mix.innerHTML =
            "<div class=\"qs ok\"><b>" + m.full.toLocaleString("vi-VN") + "</b><span>Đủ</span></div>" +
            "<div class=\"qs mid\"><b>" + m.mid.toLocaleString("vi-VN") + "</b><span>Thiếu</span></div>" +
            "<div class=\"qs bad\"><b>" + m.lean.toLocaleString("vi-VN") + "</b><span>Thiếu nặng</span></div>";
        }
        if (leg) {
          const tot = m.tot || 1;
          leg.innerHTML =
            "<li><span class=\"sw\" style=\"background:var(--teal)\"></span>Đủ hoạt chất · mg · dạng · công ty · " + m.full.toLocaleString("vi-VN") + " (" + pct(m.full, tot) + "%)</li>" +
            "<li><span class=\"sw\" style=\"background:#C4841D\"></span>Thiếu 1–2 trường · " + m.mid.toLocaleString("vi-VN") + " (" + pct(m.mid, tot) + "%)</li>" +
            "<li><span class=\"sw\" style=\"background:var(--warn)\"></span>Thiếu ≥3 trường · " + m.lean.toLocaleString("vi-VN") + " (" + pct(m.lean, tot) + "%)</li>";
        }
      }
      function paintCountryDonut(cc) {
        const s = (HEALTH && HEALTH.sources || []).find((x) => x.cc === cc);
        document.querySelectorAll("#hcov button[data-cc]").forEach((el) => {
          el.classList.toggle("on", el.getAttribute("data-cc") === cc);
          el.setAttribute("aria-pressed", el.getAttribute("data-cc") === cc ? "true" : "false");
        });
        const card = document.getElementById("hcdonut-card");
        const body = document.getElementById("hcdonut-body");
        const hint = document.getElementById("hcdonut-hint");
        const title = document.getElementById("hcdonut-title");
        if (!s || !cc) {
          healthCc = "";
          if (card) card.classList.remove("on");
          if (body) body.hidden = true;
          if (hint) hint.hidden = false;
          if (title) title.textContent = "Theo nước";
          return;
        }
        healthCc = cc;
        if (card) card.classList.add("on");
        if (body) body.hidden = false;
        if (hint) hint.hidden = true;
        if (title) title.textContent = s.name;
        applyQualityPie("hcdonut", "hcmix", "hcleg", fieldMix(s));
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
          "<div class=\"stat\"><b data-count=\"" + (f.search_rows || 0) + "\">0</b><span>dòng đang lưu hành trong ô tra</span></div>" +
          "<div class=\"stat\"><b data-count=\"" + (f.dropped || 0) + "\">0</b><span>đã loại (hủy / không lưu hành)</span></div>" +
          "<div class=\"stat\"><b data-count=\"" + nat + "\" data-suf=\"/36\">0/36</b><span>nước SRA có dump quốc gia</span></div>" +
          "<div class=\"stat\"><b data-count=\"" + pct(fullN, rowN) + "\" data-suf=\"%\">0%</b><span>dòng đủ hoạt chất · dạng · hàm lượng · công ty</span></div>";
        const cap = document.getElementById("hfunnel-cap");
        if (cap) cap.textContent = "File gốc → loại hủy / rút / không lưu hành → dòng duy nhất trên trang.";
        const funnel = document.getElementById("hfunnel");
        const raw = f.raw || 1;
        const keptP = f.kept_prod || 0;
        const rowsN = f.search_rows || 0;
        const drop = f.dropped || 0;
        funnel.innerHTML = "<div class=\"funnel\">" +
          "<div class=\"row\"><span>Sản phẩm đọc được</span><div class=\"bar\"><i style=\"--w:" + pct(raw, raw) + "%\"></i></div><b>" + (f.raw || 0).toLocaleString("vi-VN") + "</b></div>" +
          "<div class=\"row\"><span>Không lưu hành</span><div class=\"bar drop\"><i style=\"--w:" + pct(drop, raw) + "%\"></i></div><b>" + drop.toLocaleString("vi-VN") + "</b></div>" +
          "<div class=\"row\"><span>Sản phẩm giữ lại</span><div class=\"bar\"><i style=\"--w:" + pct(keptP, raw) + "%\"></i></div><b>" + keptP.toLocaleString("vi-VN") + "</b></div>" +
          "<div class=\"row\"><span>Dòng INN duy nhất</span><div class=\"bar\"><i style=\"--w:" + pct(rowsN, raw) + "%\"></i></div><b>" + rowsN.toLocaleString("vi-VN") + "</b></div></div>";
        const emaRows = h.ema_rows || 0;
        const natRows = rowsN - emaRows;
        document.getElementById('hsource-mix').innerHTML = `<div class="qs ok"><b>${natRows.toLocaleString('vi-VN')}</b><span>Dump quốc gia</span></div><div class="qs"><b>${emaRows.toLocaleString('vi-VN')}</b><span>EMA</span></div>`;
        const deg = pct(natRows, rowsN || 1) * 3.6;
        const donut = document.getElementById("hdonut");
        const heroCap = document.getElementById("hhero-cap");
        if (heroCap) { heroCap.textContent = ""; heroCap.hidden = true; }
        const track = document.getElementById("htrack");
        if (track) {
          const bits = (h.sources || []).filter((s) => s.cc !== "EMA").slice().sort((a, b) => greenScore(b) - greenScore(a) || a.name.localeCompare(b.name, "vi"));
          track.innerHTML = bits.map((s, i) => {
            return "<i class=\"" + covClass(s) + "\" style=\"animation-delay:" + (i * 0.025) + "s\" title=\"" + esc(s.name) + " · " + fieldMix(s).fillPct + "%\"></i>";
          }).join("");
        }
        const st = document.getElementById("hst");
        if (st) {
          const redN = (h.sources || []).filter((s) => s.cc !== "EMA" && covClass(s) === "m").length;
          const navyN = (h.sources || []).filter((s) => s.cc !== "EMA" && covClass(s) === "ema").length;
          st.innerHTML =
            "<span class=\"st ok\">Dump quốc gia " + nat + "</span>" +
            "<span class=\"st ema\">Phủ EMA " + navyN + "</span>" +
            "<span class=\"st gap\">Không có nguồn " + redN + "</span>" +
            "<span class=\"st ema\">EMA " + emaRows.toLocaleString("vi-VN") + " dòng</span>";
        }
        document.getElementById("hleg").innerHTML =
          "<li><span class=\"sw\" style=\"background:var(--teal)\"></span>Dump quốc gia · " + natRows.toLocaleString("vi-VN") + " dòng (" + pct(natRows, rowsN || 1) + "%)</li>" +
          "<li><span class=\"sw\" style=\"background:#1e3a8a\"></span>EMA tập trung · " + emaRows.toLocaleString("vi-VN") + " dòng (" + pct(emaRows, rowsN || 1) + "%)</li>";
        applyQualityPie("hqdonut", "hqmix", "hqleg", allQuality());
        const cov = document.getElementById("hcov");
        const covBits = (h.sources || []).filter((s) => s.cc !== "EMA").slice().sort((a, b) => greenScore(b) - greenScore(a) || a.name.localeCompare(b.name, "vi"));
        cov.innerHTML = covBits.map((s, i) => {
          const cls = covClass(s);
          const m = fieldMix(s);
          const full = m.fullPct;
          const midEnd = full + pct(m.mid, m.tot || 1);
          const fade = (m.fullPct / 100).toFixed(3);
          const hot = m.fullPct >= 55 ? " hot" : "";
          return "<button type=\"button\" class=\"" + cls + hot + "\" data-cc=\"" + esc(s.cc) + "\" aria-pressed=\"false\" title=\"" + esc(s.name) + " · đủ " + m.fullPct + "%\" style=\"--full:" + full + "%;--mid-end:" + midEnd + "%;--fade:" + fade + ";--hue:" + (cls === "ema" ? "#1e3a8a" : (cls === "m" ? "var(--warn)" : "var(--teal)")) + ";animation-delay:" + (i * 0.03) + "s\"><b>" + flagImg(s.cc) + " " + esc(s.name) + "</b></button>";
        }).join("");
        if (!cov.dataset.bound) {
          cov.dataset.bound = "1";
          cov.addEventListener("click", (ev) => {
            const btn = ev.target.closest("button[data-cc]");
            if (!btn) return;
            const cc = btn.getAttribute("data-cc");
            paintCountryDonut(healthCc === cc ? "" : cc);
          });
        }
        paintCountryDonut(healthCc);
        const box = document.getElementById("hcomp");
        if (box) box.innerHTML = "";
        const crawl = document.getElementById("hcrawl");
        if (crawl) {
          const miss = PACK.filter((p) => !have.has(p.cc));
          crawl.innerHTML = miss.length ? ("<p class=\"side-lab\" style=\"margin:12px 0 8px\">Còn thiếu dump — HAR / API</p>" +
            "<p class=\"hint\">AccessMedicina / Vidal (HAR sếp hay dùng): HTML monograph ATC (FT_*.html), không có JSON dump. Nội dung bản quyền McGraw Hill — không nhét vào ô tra SRA. Dùng để đọc ATC, không thay register nước.</p>" +
            "<table class=\"db\"><thead><tr><th>Nước</th><th>Việc</th><th></th></tr></thead><tbody>" +
            miss.map((p) => {
              return "<tr><td>" + flagImg(p.cc) + " <strong>" + esc(p.name) + "</strong></td><td class=\"how\">" + p.how + "</td><td><a class=\"go\" href=\"" + esc(p.url) + "\" target=\"_blank\" rel=\"noopener\">Mở</a></td></tr>";
            }).join("") + "</tbody></table>") : "";
        }
        const hsum = document.getElementById("hsum");
        if (hsum) hsum.textContent = "Sức khỏe dữ liệu · " + nat + "/36 dump quốc gia";
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
      async function buildInns() {
        const map = {};
        dumpCc = new Set();
        for (let i = 0; i < MED.length; i++) {
          if(i%4096===0)await loadProgress(25+Math.floor(i/MED.length*25),'Lập gợi ý tìm kiếm');
          const r = MED[i];
          const src = r[6] || (r[0] === "EMA" ? "e" : "d");
          if (src === "d" && r[0] !== "EMA") dumpCc.add(r[0]);
          for (const [field, kind] of [[1, 'Hoạt chất'], [2, 'Tên thuốc'], [5, 'Công ty']]) {
            const inn = (r[field] || '').trim();
            if (!inn) continue;
            const key = kind + ':' + searchText(inn);
            let it = map[key];
            if (!it) { it = { inn: inn, key: searchText(inn), kind, n: 0, cc: new Set() }; map[key] = it; }
            it.n++;
            it.cc.add(r[0]);
          }
        }
        INNS = Object.keys(map).map((k) => {
          const it = map[k];
          return { inn: it.inn, key: it.key, kind: it.kind, n: it.n, ccs: it.cc.size };
        }).sort((a, b) => b.n - a.n);
      }
      function dismissBoot(message) {
        const status = document.getElementById('boot-status');
        if (status && message) status.textContent = message;
        const boot = document.getElementById('boot-screen');
        if (!boot || boot.classList.contains('is-done')) return;
        boot.setAttribute('aria-busy', 'false');
        boot.style.pointerEvents = 'none';
        // Heavy parse can skip the fade if we flip opacity in the same turn — paint once, then ease out.
        void boot.offsetWidth;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            boot.classList.add('is-done');
            const remove = () => { if (boot.isConnected) boot.remove(); };
            boot.addEventListener('transitionend', (ev) => {
              if (ev.target === boot && ev.propertyName === 'opacity') remove();
            });
            setTimeout(remove, 900);
          });
        });
      }
      async function loadProgress(percent,label){
        const message=label+'… '+percent+'%';mmeta.textContent=message;
        const status=document.getElementById('boot-status');if(status)status.textContent=label+'…';
        const progress=document.getElementById('boot-progress');if(progress)progress.value=percent;
        const percentEl=document.getElementById('boot-percent');if(percentEl)percentEl.textContent=percent+'%';
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      async function loadMed() {
        const controls=[...document.querySelectorAll('.search-filters,.picked-bar,.country-panel')];
        controls.forEach(el=>el.inert=true);
        try {
          await loadProgress(0,"Đọc dữ liệu");
          const d = JSON.parse(document.getElementById("sra-med").textContent);
          const t = d.t || [];
          MED=[];const packed=d.r||[];
          for(let i=0;i<packed.length;i++){
            const r=packed[i];MED.push([t[r[0]]||'',t[r[1]]||'',t[r[2]]||'',t[r[3]]||'',t[r[4]]||'',t[r[5]]||'',t[r[6]]||'d']);
            if(i%8192===0)await loadProgress(Math.floor(i/packed.length*25),'Nạp hồ sơ');
          }
          HEALTH = d.h || null;
          SITES = d.c || {};
          vnData = d.vn;
          vnSnapshot = d.vn?.records ? SraVn.snapshot(d.vn) : null;
          configureVn(); paintVn();
          vnReasons.domestic='ô khớp danh mục 93 nội địa';
          for(const v of vnSnapshot?.records || []) {
            const row=['VN',v.inn,v.product,v.form,v.strength,v.registrant,'d',v.id,v.sdk];
            row._sources=['d'];row._inns={d:v.inn};MED.push(row);
            const co = v.registrant || '';
            if (co && !SITES[co]) {
              const key = searchText(co);
              if (key.includes('duoc my pham bao an') && !key.includes('quoc te')) {
                SITES[co] = { url: 'https://baoanpharma.com', kind: 'official' };
              }
            }
          }
          compare=SraCompare({dialog:document.getElementById('vn-compare'),records:vnSnapshot?.records || [],
            assessments:()=>vnAssessments,selectedTags:()=>[...selectedTags],tagLabel:(id)=>tagMeta(id)?.label || id,reasons:vnReasons,countryName,fold:searchText,
            getResults:()=>[...mgroups.querySelectorAll('details.cg')].flatMap(d=>(store.get(d)||[]).map(r=>({cc:d.dataset.cc,row:r}))),
            sourceUrl:cc=>srcOf(cc).url,
            companyLink,
            formLabel:raw=>{
              const k=formKey(raw);
              if(!k) return raw || 'Chưa có dạng';
              return (FORM_LBL[k] && FORM_LBL[k].vi) || raw || 'Chưa có dạng';
            },
            sourceOf:(cc,r)=>{
              const sources=r._sources || [rowSrc(r)];
              const preferDump=sources.includes('d') || !sources.includes('e');
              if(preferDump){const s=srcOf(cc);return {url:s.url,agency:s.agency};}
              return {url:SRC.EMA.url,agency:'EMA'};
            }});
          await buildInns();
          await buildCountryData();
          paintCountries();
          const mobileUi = window.matchMedia('(max-width: 680px)').matches;
          if (mobileUi) {
            paintMg();
            paintFilterDrawerCount();
            const drawer = document.getElementById('filter-drawer');
            let hydrating = false;
            const hydrate = () => {
              if (hydrating) return;
              hydrating = true;
              requestAnimationFrame(() => {
                paintSrc();
                paintFormChips();
                requestAnimationFrame(() => {
                  paintFlags();
                  paintTagFilter();
                  paintFilterDrawerCount();
                  hydrating = false;
                });
              });
            };
            if (drawer) {
              drawer.addEventListener('toggle', () => { if (drawer.open) hydrate(); });
              // Lightweight placeholder so first open feels immediate.
              document.getElementById('mforms').innerHTML = '<p style="padding:8px;color:var(--muted);font-size:12px">Đang mở bộ lọc…</p>';
              document.getElementById('mflags').innerHTML = '';
              document.getElementById('msrc').innerHTML = '';
            } else hydrate();
          } else {
            paintSrc();
            paintFlags();
            paintFormChips();
            paintMg();
          }
          saveSel();
          await loadProgress(100,'Sẵn sàng');
          mmeta.textContent = MED.length.toLocaleString("vi-VN") + " dòng từ 36 nước SRA & Việt Nam · " + (d.u || "");
          paintHealth();
          if (!mobileUi) hydrateFlags();
          controls.forEach(el=>el.inert=false);
          dismissBoot();
        } catch (e) {
          mmeta.textContent = "Không đọc được chỉ mục thuốc trên trang.";
          dismissBoot('Không đọc được dữ liệu thuốc.');
        }
      }
      // Let the boot screen paint before the heavy index parse.
      setTimeout(loadMed, 0);
      setGuide(saved);
      guideBtns.forEach((b) => b.addEventListener("click", () => setGuide(b.dataset.guide)));
      window.addEventListener("beforeprint", () => paintUi(root.dataset.guide, true));
      window.addEventListener("afterprint", () => paintUi(root.dataset.guide, false));

      if (mgo) mgo.addEventListener("click", () => pickSuggest(mq.value));
      document.getElementById('vn-tag-list').addEventListener('change', (ev) => {
        const input = ev.target.closest('[data-vn-tag]');
        if (!input) return;
        if (input.checked) selectedTags.add(input.dataset.vnTag); else selectedTags.delete(input.dataset.vnTag);
        rebuildVnMatch(); paintTagFilter(); paintVn(); searchMed({keepPeek: true});
        if (document.getElementById('vn-compare').open) compare?.open();
      });
      document.getElementById('vn-tag-list').addEventListener('click', (ev) => {
        const rename = ev.target.closest('[data-rename-tag]');
        if (!rename) return;
        ev.preventDefault();
        const id = rename.dataset.renameTag;
        const cfg = tagMeta(id);
        if (!cfg) return;
        const input = document.createElement('input');
        input.className = 'tag-label-edit';
        input.value = cfg.label;
        rename.replaceWith(input);
        input.focus(); input.select();
        const commit = () => {
          const next = input.value.trim() || cfg.label;
          cfg.label = next;
          saveTagLabels();
          paintTagFilter(); paintVn();
        };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') paintTagFilter(); });
        input.addEventListener('blur', commit);
      });
      document.getElementById('vn-tag-green').addEventListener('click', () => {
        selectedTags = new Set(['TAG_XANH_LA']);
        rebuildVnMatch(); paintTagFilter(); paintVn(); searchMed({keepPeek: true});
        if (document.getElementById('vn-compare').open) compare?.open();
      });
      document.getElementById('vn-tag-all').addEventListener('click', () => {
        selectedTags = new Set(tagConfigs.map((t) => t.id));
        rebuildVnMatch(); paintTagFilter(); paintVn(); searchMed({keepPeek: true});
        if (document.getElementById('vn-compare').open) compare?.open();
      });
      document.getElementById('vn-tag-clear').addEventListener('click', () => {
        selectedTags = new Set();
        rebuildVnMatch(); paintTagFilter(); paintVn(); searchMed({keepPeek: true});
        if (document.getElementById('vn-compare').open) compare?.open();
      });
      document.getElementById('compare-toggle').addEventListener('click', () => {
        const btn = document.getElementById('compare-toggle');
        if (btn.getAttribute('aria-pressed') === 'true') {
          document.getElementById('vn-compare').close();
          return;
        }
        if (!hasSearched) { mhit.textContent = 'Bấm Tìm thuốc trước khi so sánh.'; return; }
        btn.setAttribute('aria-pressed', 'true');
        compare?.open();
      });
      if (msrc) msrc.addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-src]");
        if (!b) return;
        const k = b.getAttribute("data-src");
        if (srcSel.has(k)) srcSel.delete(k); else srcSel.add(k);
        paintSrc();
        searchMed();
      });
      mflags.addEventListener('change', ev => {
        const input = ev.target.closest('[data-country-filter]');
        if (!input) return;
        const cc = input.dataset.countryFilter;
        if (input.checked) selCountries.add(cc); else selCountries.delete(cc);
        activeCountry = '';
        focusCountry(input.checked ? cc : [...selCountries].at(-1) || '');
        document.getElementById('region-count').textContent = selCountries.size ? '(' + selCountries.size + ')' : '';
        paintCountries(); searchMed();
      });
      document.getElementById('filter-country-query').addEventListener('input', paintFlags);
      document.getElementById('filter-countries-clear').addEventListener('click', () => {
        selCountries.clear(); activeCountry = ''; focusCountry(''); paintFlags(); paintCountries(); searchMed();
      });
      const filterDropdowns = [...document.querySelectorAll('.filter-dropdown')];
      filterDropdowns.forEach(dropdown => dropdown.addEventListener('toggle', () => {
        if (dropdown.open) filterDropdowns.forEach(other => { if(other !== dropdown) other.open = false; });
      }));
      document.addEventListener('click', ev => filterDropdowns.forEach(dropdown => { if(!dropdown.contains(ev.target)) dropdown.open = false; }));
      document.addEventListener('keydown', ev => {
        if (ev.key !== 'Escape') return;
        const open = filterDropdowns.find(dropdown => dropdown.open);
        if (open) { open.open = false; open.querySelector('summary').focus(); }
      });
      document.getElementById('med-clip').addEventListener('scroll', () => {
        if (resultScrollFrame) return;
        resultScrollFrame = requestAnimationFrame(() => {
          resultScrollFrame = 0;
          const bounds = document.getElementById('med-clip').getBoundingClientRect();
          const visible = [...mgroups.querySelectorAll('details[open]')].find(el => {
            const rect = el.getBoundingClientRect(); return rect.bottom > bounds.top + 60 && rect.top < bounds.bottom;
          });
          if (visible) focusCountry(visible.dataset.cc);
        });
      });
      mforms.addEventListener('change', ev => {
        const input = ev.target.closest('[data-form]');
        if (!input) return;
        if (input.checked) selForms.add(input.dataset.form); else selForms.delete(input.dataset.form);
        document.getElementById('form-count').textContent = selForms.size ? '(' + selForms.size + ')' : '';
        searchMed();
      });
      function onMg() { paintMg(); searchMed(); }
      mgMinEl.addEventListener('input', onMg);
      mgMaxEl.addEventListener('input', onMg);
      document.getElementById('mg-exact').addEventListener('input', searchMed);
      document.getElementById('strength-mode').addEventListener('change', ev => {
        const range = ev.target.value === 'range';
        document.getElementById('strength-range').hidden = !range;
        document.getElementById('mg-exact').hidden = range;
        onMg();
      });
      for (const [id, input] of [['mg-low-slider', mgMinEl], ['mg-high-slider', mgMaxEl]]) {
        document.getElementById(id).addEventListener('input', ev => {
          input.value = ev.target.value;
          if (mgMinEl.value && mgMaxEl.value && Number(mgMinEl.value) > Number(mgMaxEl.value)) {
            (input === mgMinEl ? mgMaxEl : mgMinEl).value = input.value;
          }
          onMg();
        });
      }
      document.getElementById('filter-reset').addEventListener('click', () => {
        selectedTags = new Set(SraVn.defaultSelectedTags(tagConfigs));
        rebuildVnMatch(); paintTagFilter(); configureVn(true);
        selForms.clear(); selCountries.clear(); activeCountry = ''; focusCountry(''); srcSel.clear();
        document.getElementById('filter-country-query').value = '';
        mgMinEl.value = ''; mgMaxEl.value = ''; document.getElementById('mg-exact').value = '';
        paintFormChips(); paintFlags(); paintSrc(); paintMg(); searchMed();
      });
      function snapshotFilter() {
        return {
          v: 2,
          vnTags: [...selectedTags],
          terms: [...searchTerms],
          q: mq.value || "",
          countries: [...selCountries],
          forms: [...selForms],
          src: [...srcSel],
          strengthMode: document.getElementById("strength-mode").value,
          mgExact: document.getElementById("mg-exact").value || "",
          mgMin: mgMinEl.value || "",
          mgMax: mgMaxEl.value || "",
          guide: root.dataset.guide || "orig"
        };
      }
      function applyFilter(f) {
        if (!f || typeof f !== "object") return;
        if (Array.isArray(f.vnTags)) {
          selectedTags = new Set(f.vnTags.filter((id) => tagConfigs.some((t) => t.id === id)));
        } else if (f.vnOnly === true) {
          selectedTags = new Set(['TAG_XANH_LA']);
        } else if (f.vnOnly === false) {
          selectedTags = new Set();
        }
        rebuildVnMatch(); paintTagFilter();
        configureVn(true);
        mq.value = typeof f.q === 'string' ? f.q : '';
        searchTerms = [...new Map((Array.isArray(f.terms) ? f.terms : [mq.value]).map((t) => {
          if (typeof t === 'string' && t.trim()) return [searchText(t), t.trim()];
          if (t && typeof t === 'object' && typeof t.term === 'string' && t.term.trim()) {
            return [searchText(t.term), { term: t.term.trim(), kind: t.kind || '' }];
          }
          return null;
        }).filter(Boolean)).values()];
        if (!Array.isArray(f.terms)) mq.value = '';
        paintSearchTerms();
        selCountries.clear();
        (f.countries || []).forEach((cc) => { if (SEARCH_COUNTRIES.includes(cc)) selCountries.add(cc); });
        selForms.clear();
        (f.forms || []).forEach((k) => selForms.add(k));
        srcSel.clear();
        (f.src || []).forEach((k) => { if (k === "d" || k === "e") srcSel.add(k); });
        const mode = f.strengthMode === "range" ? "range" : "exact";
        document.getElementById("strength-mode").value = mode;
        document.getElementById("strength-range").hidden = mode !== "range";
        document.getElementById("mg-exact").hidden = mode === "range";
        document.getElementById("mg-exact").value = f.mgExact || "";
        mgMinEl.value = f.mgMin || "";
        mgMaxEl.value = f.mgMax || "";
        if (f.guide) setGuide(f.guide);
        activeCountry = "";
        focusCountry("");
        paintFormChips(); paintFlags(); paintSrc(); paintMg();
        searchMed();
      }
      document.getElementById("filter-save").addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(snapshotFilter())], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "sra-loc.json";
        a.click();
        URL.revokeObjectURL(a.href);
      });
      document.getElementById("filter-load").addEventListener("click", () => document.getElementById("filter-file").click());
      document.getElementById("filter-file").addEventListener("change", (ev) => {
        const file = ev.target.files && ev.target.files[0];
        ev.target.value = "";
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try { applyFilter(JSON.parse(String(reader.result || "{}"))); }
          catch (e) { mhit.textContent = "Không đọc được file bộ lọc."; }
        };
        reader.readAsText(file);
      });
      function copyFallback(text) {
        const input = document.createElement('textarea'); input.value = text;
        input.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(input);
        const previous = document.activeElement; input.select();
        let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
        input.remove(); if (previous) previous.focus(); return ok;
      }
      let toastTimer;
      document.addEventListener('click', ev => {
        const link = ev.target.closest('a[data-copy-product]');
        if (!link) return;
        // Preserve native new-tab navigation and start copying in the same user gesture.
        ev.stopPropagation();
        const text = link.dataset.copyProduct;
        const report = ok => {
          const toast = document.getElementById('source-toast');
          toast.textContent = ok ? 'Đã sao chép: ' + text + '. Dán vào ô tìm kiếm của nguồn.' : 'Không thể tự sao chép. Tên thuốc: ' + text;
          toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 7000);
        };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => report(true)).catch(() => report(copyFallback(text)));
        else report(copyFallback(text));
      });

      if (pageSizeEl) {
        pageSizeEl.value = String(pageSize);
        pageSizeEl.addEventListener("change", () => {
          pageSize = safePageSize(pageSizeEl.value);
          pageSizeEl.value=String(pageSize);
          try { localStorage.setItem("sra-page", String(pageSize)); } catch (e) {}
          searchMed({ keepPeek: true });
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
          list.forEach((r) => remember(cc || r[0], r, true, false));
        });
        saveSel();
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

      if (mq) {
        mq.addEventListener("input", () => {
          window.clearTimeout(sugTimer);
          sugTimer = window.setTimeout(() => {
            sugIx = -1;
            showSuggest(matchInns(mq.value || ""));
          }, 80);
        });
        mq.addEventListener("keydown", (ev) => {
          if (ev.isComposing) return;
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
              pickSuggest(items[sugIx].querySelector(".inn").textContent, items[sugIx].dataset.kind || '');
            } else { ev.preventDefault(); pickSuggest(mq.value); }
          }
        });
      }
      if (suggest) {
        suggest.addEventListener("click", (ev) => {
          const b = ev.target.closest("button");
          if (!b) return;
          ev.preventDefault();
          pickSuggest(b.querySelector(".inn").textContent, b.dataset.kind || '');
        });
      }
      document.addEventListener("click", (ev) => {
        if (suggest && !suggest.contains(ev.target) && ev.target !== mq) hideSuggest();
      });
      const countryPanel = document.querySelector(".country-panel");
      if (countryPanel && window.ResizeObserver) new ResizeObserver(() => syncTraHeights()).observe(countryPanel);
      window.addEventListener("resize", syncTraHeights);
      syncTraHeights();
    })();
