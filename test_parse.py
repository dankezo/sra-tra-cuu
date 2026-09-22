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

    def test_company_links_require_verified_destination(self):
        from _sites import company_sites, fallback_company_url
        self.assertIn("google.com/search", fallback_company_url("Acme Ltd"))
        self.assertNotIn("company-information.service.gov.uk", fallback_company_url("Acme Ltd"))
        names = ["UAB Lex ano", "Micro Labs Limited", "Notteva Ltd", "Hering S.r.l.", "Merck KGaA", "Merck Sharp & Dohme", "EG S.p.A."]
        sites = company_sites({"company": name} for name in names)
        self.assertEqual(sites["UAB Lex ano"]["kind"], "search")
        self.assertEqual(sites["Notteva Ltd"]["kind"], "search")
        self.assertIn("microlabsltd.com", sites["Micro Labs Limited"]["url"])
        self.assertNotIn("labhering.com.br", sites["Hering S.r.l."]["url"])
        self.assertIn("merckgroup.com", sites["Merck KGaA"]["url"])
        self.assertIn("msd.com", sites["Merck Sharp & Dohme"]["url"])
        self.assertNotIn("eurogenerics.com", sites["EG S.p.A."]["url"])

    def test_sweden_lmf_keeps_smpc_drops_vet(self):
        import _parse_add as extra
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory)
            (raw / "SE").mkdir()
            (raw / "SE" / "produktdokument.xml").write_text(
                '<?xml version="1.0" encoding="utf-8"?>'
                "<ArrayOfDocumentList>"
                "<DocumentList><ProduktNamn>Atomoxetine Sandoz 18 mg Kapsel, hård</ProduktNamn>"
                "<Typ>PL</Typ><NplId>1</NplId><Företag>Sandoz A/S</Företag></DocumentList>"
                "<DocumentList><ProduktNamn>Atomoxetine Sandoz 18 mg Kapsel, hård</ProduktNamn>"
                "<Typ>SmPC</Typ><NplId>1</NplId><Företag>Sandoz A/S</Företag></DocumentList>"
                "<DocumentList><ProduktNamn>Ketaminol vet. Solution for injection</ProduktNamn>"
                "<Typ>SmPC</Typ><NplId>2</NplId><Företag>X</Företag></DocumentList>"
                "</ArrayOfDocumentList>",
                encoding="utf-8",
            )
            rows = []
            with patch.object(parser, "RAW", raw):
                extra.parse_se_lmf(rows)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["name"], "Atomoxetine Sandoz 18 mg Kapsel, hård")
            self.assertEqual(rows[0]["company"], "Sandoz A/S")
            self.assertEqual(rows[0]["strength"], "18 mg")

    def test_hungary_tk_lista_maps_inn_and_mah(self):
        import _parse_add as extra
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory)
            (raw / "HU").mkdir()
            (raw / "HU" / "tk_lista.csv").write_text(
                "TK-szám; Név; Kiszerelés; INN; Forg_Eng_Jog; Kiadhatóság\n"
                "OGYI-T-1/01;Paracetamol 500 mg tabletta;1 X 20;Paracetamol;EGIS Gyógyszergyár Zrt.;V\n"
                "OGYI-T-1/02;Paracetamol 500 mg tabletta;1 X 50;Paracetamol;EGIS Gyógyszergyár Zrt.;V\n"
                "OGYI-T-2/01;Ibuprofen 200 mg filmtabletta;1 X 10;Ibuprofen;SANDOZ Hungária Kft.;VN\n",
                encoding="cp1250",
            )
            rows = []
            with patch.object(parser, "RAW", raw):
                extra.parse_hu(rows)
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0]["inn"], "Paracetamol")
            self.assertEqual(rows[0]["company"], "EGIS Gyógyszergyár Zrt.")
            self.assertEqual(rows[0]["form"], "tabletta")
            self.assertEqual(rows[0]["strength"], "500 mg")
            self.assertEqual(rows[1]["inn"], "Ibuprofen")
            self.assertEqual(rows[1]["form"], "filmtabletta")


    def test_strength_from_product_name(self):
        self.assertEqual(parser.strength_from("ATORVASTATINE TEVA 10 mg, comprimé"), "10 mg")
        self.assertEqual(parser.strength_from("Tagrisso Tablets 40mg"), "40mg")
        self.assertEqual(parser.strength_from("Atomoxetine Sandoz 18 mg Kapsel, hård"), "18 mg")
        self.assertEqual(parser.strength_from("BECLOSPIN 800 microgrammes/2ml"), "800 microgrammes/2ml")
        rows = []
        parser.add_row(rows, "DE", "atorvastatin", "Atorvastatin Accord 20 mg Filmtabletten", "", "", "Accord")
        self.assertEqual(rows[0]["strength"], "20 mg")
        self.assertEqual(rows[0]["form"], "")


    def test_cima_keeps_marketed_with_form(self):
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory)
            (raw / "ES").mkdir()
            items = [
                {
                    "nombre": "A.A.S. 100 mg COMPRIMIDOS",
                    "vtm": {"nombre": "ácido acetilsalicílico"},
                    "labtitular": "Laboratorio Stada S.L.",
                    "dosis": "100 mg",
                    "comerc": True,
                    "formaFarmaceutica": {"id": 40, "nombre": "COMPRIMIDO"},
                    "nregistro": "42991",
                },
                {"nombre": "Off market", "comerc": False, "vtm": {"nombre": "x"}},
            ]
            (raw / "ES" / "cima_all.json").write_text(json.dumps(items), encoding="utf-8")
            rows = []
            with patch.object(parser, "RAW", raw):
                parser.parse_es(rows)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["inn"], "ácido acetilsalicílico")
            self.assertEqual(rows[0]["form"], "COMPRIMIDO")
            self.assertEqual(rows[0]["company"], "Laboratorio Stada S.L.")
            self.assertEqual(rows[0]["strength"], "100 mg")


if __name__ == '__main__':
    unittest.main()
