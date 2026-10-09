PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS apisrc_substance (
 id INTEGER PRIMARY KEY, inn TEXT NOT NULL, inn_clean_key TEXT NOT NULL UNIQUE,
 cas TEXT, unii TEXT, synonyms TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS apisrc_cas ON apisrc_substance(cas);
CREATE TABLE IF NOT EXISTS apisrc_company (
 id INTEGER PRIMARY KEY, canonical_name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE,
 country TEXT, address TEXT, website TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS apisrc_company_alias (
 id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES apisrc_company(id),
 alias_raw TEXT NOT NULL, alias_norm TEXT NOT NULL, source TEXT NOT NULL,
 UNIQUE(alias_norm,source));
CREATE INDEX IF NOT EXISTS apisrc_alias ON apisrc_company_alias(alias_norm);
CREATE TABLE IF NOT EXISTS apisrc_site (
 id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES apisrc_company(id),
 site_name TEXT, address TEXT, country TEXT);
CREATE TABLE IF NOT EXISTS apisrc_listing (
 id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES apisrc_company(id),
 site_id INTEGER REFERENCES apisrc_site(id), substance_id INTEGER REFERENCES apisrc_substance(id),
 source TEXT NOT NULL, source_url TEXT NOT NULL, fetched_at TEXT NOT NULL, raw_snippet TEXT,
 verification TEXT NOT NULL CHECK(verification IN ('official_verified','supplier_claimed','unknown')));
CREATE TABLE IF NOT EXISTS apisrc_certificate (
 id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES apisrc_company(id),
 site_id INTEGER REFERENCES apisrc_site(id), substance_id INTEGER NOT NULL REFERENCES apisrc_substance(id),
 type TEXT NOT NULL, identifier TEXT NOT NULL, holder TEXT NOT NULL, status TEXT NOT NULL,
 raw_status TEXT, issued_at TEXT, expires_at TEXT, renewal_due TEXT, monograph TEXT, cep_type TEXT,
 verification TEXT NOT NULL CHECK(verification IN ('official_verified','supplier_claimed','unknown')),
 source TEXT NOT NULL, source_url TEXT NOT NULL, fetched_at TEXT NOT NULL,
 source_file_date TEXT, date_basis TEXT, raw_snippet TEXT, UNIQUE(source,identifier));
CREATE INDEX IF NOT EXISTS apisrc_certificate_substance ON apisrc_certificate(substance_id);
CREATE TABLE IF NOT EXISTS apisrc_event_flag (
 company_id INTEGER REFERENCES apisrc_company(id), event TEXT, year INTEGER,
 status TEXT CHECK(status IN ('confirmed','unconfirmed')), source_url TEXT);
CREATE TABLE IF NOT EXISTS apisrc_vn_status (
 substance_id INTEGER PRIMARY KEY REFERENCES apisrc_substance(id),
 has_vn_api_registration INTEGER, has_vn_drug_registration INTEGER, reference TEXT, fetched_at TEXT);
CREATE TABLE IF NOT EXISTS apisrc_bag_item (
 id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, company_id INTEGER REFERENCES apisrc_company(id),
 substance_id INTEGER REFERENCES apisrc_substance(id), note TEXT, saved_at TEXT, snapshot_json TEXT);
CREATE TABLE IF NOT EXISTS apisrc_quote_request (
 id INTEGER PRIMARY KEY, bag_item_id INTEGER REFERENCES apisrc_bag_item(id), channel TEXT,
 sent_at TEXT, status TEXT DEFAULT 'not_sent', reply_note TEXT, quoted_price TEXT,
 price_unit TEXT, price_date TEXT, docs_received TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS apisrc_crawler_session (
 id INTEGER PRIMARY KEY, domain TEXT, engine_used TEXT, session_cookies TEXT,
 user_agent TEXT, is_active INTEGER DEFAULT 0, last_passed_at TEXT);
CREATE INDEX IF NOT EXISTS apisrc_domain ON apisrc_crawler_session(domain);
CREATE TABLE IF NOT EXISTS apisrc_ingest_run (
 id INTEGER PRIMARY KEY, source TEXT NOT NULL, source_file_date TEXT, date_basis TEXT,
 started_at TEXT NOT NULL, finished_at TEXT, rows_in INTEGER DEFAULT 0,
 rows_changed INTEGER DEFAULT 0, status TEXT NOT NULL, error TEXT);
