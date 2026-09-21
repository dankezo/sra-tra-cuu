# SRA medicine search (Bảo An Pharma)

Public lookup of **circulating** human medicines from official national dumps and the EMA authorised list. Built for TT 12/2025 SRA / TT 40/2025 nhóm 1 work: search by INN or product name, grouped by country.

**Use it:** type an INN (e.g. `atorvastatin`). Suggestions appear under the box. Results open by country — tap a card to see every matching row.

| Chip | Meaning |
| --- | --- |
| **dump** | National competent-authority dump on this page |
| **EMA** (navy) | EMA centralised authorisation |
| Coverage **red** | Country has neither a national dump nor EMA (JP, AU, GB) |

Green coverage = national dump in the index. Navy = EEA country with no local dump yet; EMA still applies for centralised products.

## What this is not

- Not a scrape and not a live API. Data is the last official file folded into `index.html`.
- EMA does not replace the 36 national registers.
- Cancelled / withdrawn / not-marketed products are dropped.

## Local rebuild (maintainers)

```text
python _parse.py      # data/raw/{CC}/ → data/search.json
python _rebuild.py    # prefix HTML + _app.js
python _embed.py      # intern search.json into index.html
```

Do not edit `index.html` with a partial search-and-replace — the file is large. Change `_app.js` and rebuild.

Raw dumps stay in `data/raw/` and are not published (some files are hundreds of MB).
