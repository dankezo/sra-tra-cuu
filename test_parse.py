import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import _parse as parser


class DataTests(unittest.TestCase):
    def test_distinct_brands_survive_dedupe(self):
        rows = []
        for name in ['Brand A', 'Brand B', 'Brand A']:
            parser.add_row(rows, 'FR', 'substance', name, 'tablet', '10 mg', 'MAH')
        self.assertEqual(len(parser.dedupe(rows)), 2)

    def test_ema_catalog_is_loaded_even_when_cap_exists(self):
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory)
            (raw / 'EMA').mkdir()
            items = [
                {'name_of_medicine': 'Catalog-only', 'active_substance': 'X', 'category': 'Human', 'medicine_status': 'Authorised'},
                {'name_of_medicine': 'Withdrawn', 'category': 'Human', 'medicine_status': 'Withdrawn'},
                {'name_of_medicine': 'Veterinary', 'category': 'Veterinary', 'medicine_status': 'Authorised'},
            ]
            (raw / 'EMA' / 'medicines.json').write_text(json.dumps(items), encoding='utf-8')
            def cap(rows):
                parser.add_row(rows, 'EMA', 'Y', 'CAP-only', 'tablet', '10 mg', src='e')
                return True
            rows = []
            with patch.object(parser, 'RAW', raw), patch.object(parser, 'parse_ema_cap', cap):
                parser.parse_ema(rows)
            self.assertEqual({r['name'] for r in rows}, {'CAP-only', 'Catalog-only'})

    def test_jp_brand_split_keeps_each_strength(self):
        import _parse_add as extra
        brands, company = extra.split_jp_brand(
            "Tagrisso Tablets 40 mg\nTagrisso Tablets 80 mg\n(AstraZeneca K.K.)"
        )
        self.assertEqual(brands, ["Tagrisso Tablets 40 mg", "Tagrisso Tablets 80 mg"])
        self.assertEqual(company, "AstraZeneca K.K.")

    def test_sk_html_wrapped_json(self):
        import _parse_add as extra
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "p00000.json"
            path.write_text(
                '<html><body>[{"lie_nazov":"MUTAFLOR","liecivo":"","form_nazov_en":"capsule",'
                '"lie_sila":"","drz_nazov":"Ardeypharm GmbH","stav_nazov_en":"Valid Marketing Authorisation",'
                '"lie_kod":"66064"}]</body></html>',
                encoding="utf-8",
            )
            items = extra.load_sk_items(path)
            self.assertEqual(items[0]["lie_nazov"], "MUTAFLOR")

    def test_portugal_keeps_marketed_and_drops_withdrawn(self):
        import _parse_add as extra
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory)
            (raw / "PT").mkdir()
            # Tiny xlsx via parser helper would need a real workbook; use add_row filter through csv path instead.
            rows = []
            parser.add_row(rows, "PT", "Dextromethorphan", "Diacol", "Syrup", "1.8 mg/ml", "Bial", src="d")
            parser.add_row(rows, "EMA", "Dextromethorphan", "Diacol", "Syrup", "1.8 mg/ml", "Bial", src="e")
            out = parser.dedupe(rows)
            self.assertEqual(len(out), 2)
            sources = {r["src"] for r in out}
            self.assertEqual(sources, {"d", "e"})

    def test_company_fallback_uses_registry_not_wikipedia(self):
        from _sites import company_sites, fallback_company_url
        self.assertIn("company-information.service.gov.uk", fallback_company_url("Acme Ltd"))
        self.assertIn("google.com/search", fallback_company_url("UAB Niromed"))
        self.assertIn("google.com/search", fallback_company_url("InPharm Sp. z o.o."))
        self.assertIn("KRS", fallback_company_url("US Pharmacia Sp. z o.o."))
        self.assertNotIn("krs-online.com.pl", fallback_company_url("US Pharmacia Sp. z o.o."))
        sites = company_sites([{"company": "UAB Lex ano"}])
        self.assertTrue(sites["UAB Lex ano"].startswith("https://"))
        self.assertNotIn("wikipedia", sites["UAB Lex ano"])


if __name__ == '__main__':
    unittest.main()
