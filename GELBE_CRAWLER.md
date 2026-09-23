# Gelbe Liste crawler (DE)

ATC level-2 Profi-Suche export. Filters out cosmetics/supplements by requiring ATC.

## Run

```bash
# Full catalog (~90 ATC L2 groups → unique products → detail enrich)
python crawl_gelbe.py --phase all --workers 6 --delay 0.35

# Or stepwise
python crawl_gelbe.py --phase 1 --delay 0.35
python crawl_gelbe.py --phase 2 --workers 6

# Smoke test
python crawl_gelbe.py --phase all --atc A10 --limit 20
```

Output (gitignored under `data/raw/`):

- `data/raw/DE/crawl/gelbe.sqlite3` — resume checkpoint
- `data/raw/DE/crawl/gelbe_stage1.csv` — unique products from list pages
- `data/raw/DE/crawl/GelbeListe_Medicines_ATC_Filtered.xlsx` — full export
- `data/raw/DE/crawl/crawl.log`

Re-run phase 2 to retry partial/error rows. Phase 1 skips ATC groups marked complete.

## Notes

- Endpoint: `https://www.gelbe-liste.de/profi-suche/results` (POST page 1, GET later pages).
- Commercial MMI index, not BfArM official dump. Prefer EMA Article 57 for regulatory DE coverage unless Gelbe fields are required.
- Be polite: default delay 0.35s; do not raise workers above 6–8.
