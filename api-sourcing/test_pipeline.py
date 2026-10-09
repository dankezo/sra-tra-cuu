import io
import sqlite3
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
from pipeline import database, ingest, parse_edqm, parse_fda, parse_who

EDQM = 'Substance\tCertificate (CEP) Holder\tCertificate (CEP) Number\tStatus CEP\tType CEP\tIssue Date CEP\tEnd date CEP\nAmlodipine\tTest Company IN\tR0-CEP 2000-001\tSuspended by EDQM GMP non-compliance\tChemical\t01/01/2020\t\n'
WHO = 'WHO Product ID,INN,Applicant,Date of prequalification\nWHOAPI-test,Test API,Test Co,"5  Sep,  2017"\n'


def fda_fixture(status='A', kind='II'):
    rows = [['DMF#','STATUS','TYPE','SUBMIT DATE','HOLDER','SUBJECT'], ['123',status,kind,'45000','Test Co','Amlodipine']]
    xml = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    for n, row in enumerate(rows, 1):
        xml += f'<row r="{n}">' + ''.join(f'<c r="{chr(65+i)}{n}" t="inlineStr"><is><t>{v}</t></is></c>' for i,v in enumerate(row)) + '</row>'
    xml += '</sheetData></worksheet>'
    stream = io.BytesIO()
    with zipfile.ZipFile(stream,'w') as z:
        z.writestr('xl/worksheets/sheet1.xml', xml)
    return stream.getvalue()


class ParserTests(unittest.TestCase):
    def test_edqm_suspended_not_valid(self):
        r = list(parse_edqm(EDQM))[0]
        self.assertEqual(r['status'], 'suspended')
        self.assertEqual(r['country'], 'IN')
        self.assertIsNone(r['expires_at'])

    def test_fda_type_and_unknown_status(self):
        self.assertEqual(list(parse_fda(fda_fixture('I')))[0]['status'], 'inactive')
        self.assertEqual(list(parse_fda(fda_fixture('PASSIGN')))[0]['status'], 'unknown')
        self.assertEqual(list(parse_fda(fda_fixture(kind='III'))), [])

    def test_who_dates(self):
        self.assertEqual(list(parse_who(WHO))[0]['issued_at'], '2017-09-05')

    def test_idempotent_and_failure_retains_previous(self):
        con = database(':memory:')
        url = 'https://extranet.edqm.eu/4DLink1/4DCGI/EXPORT_WEB_CEP.txt'
        ingest(con, 'EDQM', EDQM.encode(), url)
        self.assertEqual(ingest(con, 'EDQM', EDQM.encode(), url)['changed'], 0)
        with self.assertRaises(ValueError):
            ingest(con, 'EDQM', b'<html>challenge</html>', url)
        self.assertEqual(con.execute('SELECT count(*) FROM apisrc_certificate').fetchone()[0], 1)
        self.assertEqual(con.execute('SELECT status FROM apisrc_ingest_run ORDER BY id DESC LIMIT 1').fetchone()[0], 'error')

    def test_unofficial_url_rejected(self):
        with self.assertRaises(ValueError):
            ingest(database(':memory:'), 'EDQM', EDQM.encode(), 'https://example.com/edqm')
    def test_missing_record_becomes_unknown(self):
        con=database(':memory:')
        url='https://extranet.edqm.eu/4DLink1/4DCGI/EXPORT_WEB_CEP.txt'
        header,row=EDQM.splitlines()
        newer=row.replace('2000-001','2000-002')
        with patch('pipeline.now',return_value='2026-10-09T00:00:00+00:00'):
            ingest(con,'EDQM',(header+'\n'+row+'\n'+newer+'\n').encode(),url)
            ingest(con,'EDQM',(header+'\n'+newer+'\n').encode(),url)
        missing=con.execute("SELECT status FROM apisrc_certificate WHERE identifier='R0-CEP 2000-001'").fetchone()
        self.assertEqual(missing[0],'unknown')
        self.assertEqual(ingest(con,'EDQM',(header+'\n'+newer+'\n').encode(),url)['changed'],0)

    def test_quarter_and_stale_file(self):
        con = database(':memory:')
        url = 'https://www.fda.gov/media/test/download'
        with self.assertRaises(ValueError):
            ingest(con,'FDA',fda_fixture(),url)
        ingest(con,'FDA',fda_fixture(),url,'2026-06-30','quarter_end')
        with self.assertRaises(ValueError):
            ingest(con,'FDA',fda_fixture(),url,'2026-03-31','quarter_end')
        self.assertEqual(con.execute('SELECT source_file_date FROM apisrc_certificate').fetchone()[0], '2026-06-30')


if __name__ == '__main__':
    unittest.main()
