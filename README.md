# SRA medicine search (Bảo An Pharma)

Public lookup of **circulating** human medicines from official national dumps and the EMA authorised list. Built for TT 12/2025 SRA / TT 40/2025 nhóm 1 work: search by INN, product or company name, grouped by country.

**Use it:** type an INN (e.g. `atorvastatin`), product or company name, then press Enter / Search or pick a suggestion. Each submitted name becomes a removable chip. Chips match with OR, so multiple spellings/languages expand the results; other filters narrow those results. Saved filter files include the chips and support older single-query files. Select a country from the globe, map, or list on the left; its results open on the right. All views share the same country selection. Country and medicine searches ignore accents.

Filters expand into checkboxes for dosage form and region. Strength supports exact input (bare numbers mean mg) or a range with editable endpoints and sliders. A blank upper endpoint is unlimited. The mg range deliberately excludes concentrations and combinations rather than treating them as single doses. Reset clears other filters but preserves the search chips; use × on each chip to remove it.

Source links open the register and copy the original INN in the same click, with visible success/failure feedback. English pages are used where supported. Bulgaria and Luxembourg provide lists/files rather than a medicine search form: their links explicitly say `dump · Google` and search within the official domain. Company destinations use a checked official website first, a checked company introduction/profile second (including third-party directories or Wikipedia), and Google Search when no verified destination is available. Link labels distinguish these three cases; Excel uses the same destination. Never infer a UK registry entry just from “Ltd”, and never treat an arbitrary substring as a company identity. Coverage status appears only in Data health.

| Chip | Meaning |
| --- | --- |
| **dump** | National competent-authority dump on this page |
| **EMA** (navy) | EMA centralised authorisation |
| Coverage **red** | Country has neither a national dump nor EMA |

Green coverage = national dump in the index. Navy = EEA country with no local dump yet; EMA still applies for centralised products. These colours appear in Data health, not country selectors.

## Merge rules

Both CAP and the EMA catalogue are loaded; finding CAP no longer skips `medicines.json`. Parse/embed deduplication includes the product name, preserving distinct brands.

Each EEA country receives the entire loaded EMA set plus its national dump. `_data_logic.js` merges rows only when product name/INN match after case/whitespace normalization and known fields do not conflict. More populated fields wins, ties prefer the dump. Both sources and original INNs remain available for links, source filtering and export. Different brands, strengths, forms or known holders remain separate. No fuzzy INN-only merging. Completeness means coverage of the loaded input files, not a live or exhaustive market database.

## What this is not

- Not a scrape and not a live API. Data is the last official file folded into `index.html`.
- EMA does not replace the 36 national registers.
- Cancelled / withdrawn / not-marketed products are dropped.

## Local rebuild (maintainers)

```text
python _parse.py      # data/raw/{CC}/ → data/search.json
python _rebuild.py    # prefix HTML + _app.js
python _embed.py      # intern search.json into index.html
node test_data_logic.js
python -m unittest test_parse.py
```

Do not edit `index.html` with a partial search-and-replace — the file is large. Change `_app.js`, `_data_logic.js`, `_search_ui.html` or `_search_ui.css`, then rebuild and embed. The rest of the document is retained from the HTML prefix.

Raw dumps stay in `data/raw/` and are not published (some files are hundreds of MB). Extra national files in `data/raw/add/` (named by country) are copied into `data/raw/{CC}/` on parse. EMA Article 57 fills remaining EEA gaps (DE, DK, CY, GR, HU, SE, LI) without replacing a real NCA dump.

## Source and map notes

Source URLs were checked against the [EMA national register directory](https://www.ema.europa.eu/en/medicines/national-registers-authorised-medicines), [AIFA](https://www.aifa.gov.it/en/trova-farmaco), [FimeaWeb](https://fimea.fi/en/databases_and_registers/fimeaweb) and register pages on 2026-09-22. Some sources block automated verification; external availability and English support vary.

The standalone HTML embeds D3 7.9.0 (ISC, `vendor/D3-LICENSE`) and [Natural Earth 1:110m country boundaries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson) (public domain). Small countries have supplemental selectable points. This generalized map is navigation only; the list always includes all 36 countries.

## Company link verification

`data/company-link-audit.json` records checks of the 224 original website candidates from the local Windows connection, with browser retries for failed requests. `data/company-link-resolutions.json` stores checked corrections and company profiles, their titles, redirects, and failures. `_sites.py` only publishes destinations in that checked map. Names without a verified mapping use Google; that means unverified, not proof that a company has no website. Checks reflect the recorded date and connection, not a guarantee of future or worldwide availability.

To refresh: run `python audit_company_links.py`, optionally `node _browser_audit.cjs`, then `python _resolve_company_links.py`, review identities/redirects and rebuild/embed. Browser checks require Playwright (`playwright` module or `SRA_PLAYWRIGHT_PATH`). Run `node test_search_ui.cjs` for company search, OR chips, duplicates/removal, save/load and mobile/tablet/desktop layout. QA screenshots remain local.
