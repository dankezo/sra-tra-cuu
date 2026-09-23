import unittest
from crawl_eof import partial, table_rows, detail_fields, form_data
from bs4 import BeautifulSoup


class CrawlTests(unittest.TestCase):
    def test_rotating_viewstate_and_cdata(self):
        updates, state = partial('<partial-response><changes><update id="frmMain:tblResults"><![CDATA[<tr><td>A & B</td></tr>]]></update><update id="j_id9:javax.faces.ViewState:3"><![CDATA[new-state]]></update></changes></partial-response>')
        self.assertEqual(state, 'new-state')
        self.assertIn('A & B', updates['frmMain:tblResults'])

    def test_session_errors(self):
        for text in ['<partial-response><redirect url="home.xhtml"/></partial-response>', '<html/>']:
            with self.assertRaises(ValueError):
                partial(text)
        with self.assertRaises(ValueError):
            detail_fields('<form id="frmSearch"><label>Active Substance</label><span>Filter</span></form>')

    def test_forms_and_link_resolution(self):
        form = BeautifulSoup('<form><input name="a" value="1"><input name="unchecked" type="checkbox"><select name="status"><option value="E" selected>Approved</option></select></form>', 'html.parser').form
        self.assertEqual(form_data(form), {'a': '1', 'status': 'E'})
        row = '<tr>' + ''.join('<td>'+s+'</td>' for s in ['001', 'Drug', 'Approved', '', '', '']) + '<td><a href="view.xhtml?id=abc">View</a></td></tr>'
        result = table_rows(row)[0]
        self.assertEqual(result['EOF_Code'], '001')
        self.assertEqual(result['Detail_URL'], 'https://services.eof.gr/human-search/view.xhtml?id=abc')

    def test_detail_section_not_parent_text(self):
        html = '''<div class="surface-section"><div>Δραστική ουσία</div><ul>
        <li><div></div><div>ACTIVE A</div><div>20 mg</div></li>
        <li><div></div><div>ACTIVE B</div><div>10 mg</div></li></ul></div>
        <li><div>Κάτοχος Αδείας Κυκλοφορίας</div><div>Company</div><div>Address</div></li>
        <div class="surface-section"><div>Ταξινόμηση ATC</div><ul><li><div>A01AA01</div><div>Description</div></li></ul></div>'''
        r = detail_fields(html)
        self.assertEqual(r['Active_Substance'], 'ACTIVE A; ACTIVE B')
        self.assertEqual(r['Company_MAH'], 'Company')
        self.assertEqual(r['ATC_Code'], 'A01AA01')
        self.assertEqual(r['Detail_Status'], 'ok')


if __name__ == '__main__':
    unittest.main()
