const assert=require('node:assert/strict');
const fs=require('node:fs');
globalThis.JSZip=require('../vendor/jszip.min.js');
require('../_excel_export.js');
(async()=>{
 const bytes=await SraExcel.build([{name:'Nha cung cap',headers:['STT','Chứng chỉ','Ghi chú'],rows:[[1,{text:'Có & nguồn',link:'https://example.com/proof?q=1&x=2'},'=HYPERLINK("bad")'],[2,{text:'Không',link:'javascript:alert(1)'},'<script>']]},{name:'Email mau',headers:['Nội dung'],rows:[['Dear supplier,\nAmlodipine besylate']]}]);
 const zip=await JSZip.loadAsync(bytes);
 const sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');
 const rel=await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string');
 assert.match(sheet,/<hyperlink ref="B2" r:id="rId1"/);
 assert.match(sheet,/Có &amp; nguồn/);assert.match(sheet,/t="inlineStr"/);assert.ok(!sheet.includes('<f>'));
 assert.match(rel,/Target="https:\/\/example.com\/proof\?q=1&amp;x=2"/);
 assert.ok(!rel.includes('javascript:'));assert.ok(!sheet.includes('rId2'));
 assert.ok(zip.file('xl/worksheets/sheet2.xml'));
 // Optional fixture for a real Excel reader during local verification.
 if(process.env.APISRC_XLSX_FIXTURE)fs.writeFileSync(process.env.APISRC_XLSX_FIXTURE,bytes);
 console.log('PASS: two-sheet XLSX, evidence hyperlinks, XML escaping and formula safety');
})().catch(e=>{console.error(e);process.exit(1)});
