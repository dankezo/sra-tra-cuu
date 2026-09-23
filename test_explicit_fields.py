import unittest
from unittest.mock import patch
from pathlib import Path
import tempfile
from _explicit_fields import explicit_form, explicit_strength


class ExplicitFieldsTests(unittest.TestCase):
    def test_greek_export_headers_and_status(self):
        import _parse as P
        import _parse_add as A
        records = [
            ['Κωδικός', 'Ονομασία / Περιεκτικότητα', 'Κατάσταση Α.Κ.'],
            ['1', 'DRUG F.C.TAB 20MG/TAB', 'Εγκεκριμένο'],
            ['2', 'OTHER INJ.SOL 10MG/ML', 'Αρθ.29 Ν1316'],
        ]
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(P, 'RAW', Path(directory)), patch.object(P, 'pick_file', return_value=Path('eof.xlsx')), patch.object(P, 'xlsx_rows', return_value=iter(records)), patch.object(A, 'parse_gr_price'):
                rows = []
                A.parse_gr(rows)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['form'], 'F.C.TAB')
        self.assertEqual(rows[0]['strength'], '20MG/TAB')
        self.assertEqual(rows[0]['inn'], '')

    def test_greek_crawl_inn_company_and_dedupe(self):
        import _parse as P
        import _parse_add as A
        records = [
            ['EOF_Code', 'TradeName_Strength', 'Status', 'Active_Substance', 'Company_MAH'],
            ['26909', 'KERENDIA F.C.TAB 40MG/TAB BT X 28 TAB', 'Approved', 'FINERENONE', 'BAYER HELLAS'],
            ['26909', 'KERENDIA F.C.TAB 40MG/TAB BT X 28 TAB', 'Approved', 'FINERENONE', 'BAYER HELLAS'],
            ['1', 'OTHER INJ.SOL 10MG/ML', 'Withdrawn', 'X', 'Y'],
        ]
        with tempfile.TemporaryDirectory() as directory:
            crawl = Path(directory) / 'GR' / 'crawl'
            crawl.mkdir(parents=True)
            xlsx = crawl / 'EOF_Greek_Medicines_Full.xlsx'
            xlsx.write_bytes(b'placeholder-not-xlsx')
            with patch.object(P, 'RAW', Path(directory)), patch.object(P, 'xlsx_rows', return_value=iter(records)), patch.object(A, 'parse_gr_price') as price:
                rows = []
                A.parse_gr_crawl(rows, xlsx)
                price.assert_not_called()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['inn'], 'FINERENONE')
        self.assertEqual(rows[0]['company'], 'BAYER HELLAS')
        self.assertEqual(rows[0]['form'], 'F.C.TAB')
        self.assertEqual(rows[0]['extra'], '26909')

    def test_combination_and_concentration(self):
        for text, expected in [
            ('Abacavir-Lamivudin 600 mg/300 mg, Filmtabletten', '600 mg/300 mg'),
            ('LONSURF F.C.TAB (15+6,14)MG/TAB BTx60', '(15+6,14)MG/TAB'),
            ('KENACOMB CREAM 0,1%+0,25%+100KU/G TUBx25 G', '0,1%+0,25%+100KU/G'),
            ('ABASAGLAR SOLUTION FOR INJECTION 100U/ML', '100U/ML'),
            ('OPDIVO 10MG/ML BT X 1 VIAL X 24 ML', '10MG/ML'),
            ('PACK WITH 10 CARTRIDGES X 3ML', ''),
        ]:
            with self.subTest(text=text):
                self.assertEqual(explicit_strength(text), expected)

    def test_verbatim_forms(self):
        self.assertEqual(explicit_form('Vivotif, Kapseln', 'CH'), 'Kapseln')
        self.assertEqual(explicit_form('ABATOR TABLET, FILM COATED 10MG', 'CY'), 'TABLET, FILM COATED')
        self.assertEqual(explicit_form('KERENDIA F.C.TAB 40MG/TAB BT X 28 TAB', 'GR'), 'F.C.TAB')
        self.assertEqual(explicit_form('Drug', 'CY', '30 TABS IN BLISTERS'), 'TABS')
        self.assertEqual(explicit_form('Drug', 'CY', '1 BOTTLE X 100ML'), '')


if __name__ == '__main__':
    unittest.main()
