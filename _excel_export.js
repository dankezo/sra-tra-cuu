/* Small, offline OOXML export. All source values are strings, never Excel formulas. */
(function(root) {
  const xml=v=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  function col(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;}
  async function build(sheets) {
    const zip=new root.JSZip();
    let types='',links='',names='';
    for(let i=0;i<sheets.length;i++) {
      const {name,headers,rows}=sheets[i];
      if(rows.length>1048575)throw new Error('Phạm vi vượt số dòng tối đa của Excel. Hãy thu hẹp tìm kiếm.');
      const end=col(headers.length-1)+(rows.length+1);
      const parts=[`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><dimension ref="A1:${end}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>`];
      headers.forEach((_,j)=>parts.push(`<col min="${j+1}" max="${j+1}" width="${j===0?12:28}" customWidth="1"/>`));
      parts.push('</cols><sheetData>');
      for(let r=0;r<=rows.length;r++) {
        const values=r===0?headers:rows[r-1];
        parts.push(`<row r="${r+1}">`+values.map((v,c)=>`<c r="${col(c)}${r+1}" t="inlineStr" s="${r===0?1:0}"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')+'</row>');
        if(r%2000===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      parts.push(`</sheetData><autoFilter ref="A1:${end}"/></worksheet>`);
      zip.file(`xl/worksheets/sheet${i+1}.xml`,parts.join(''));
      types+=`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
      links+=`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`;
      names+=`<sheet name="${xml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`;
    }
    zip.file('[Content_Types].xml',`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${types}</Types>`);
    zip.file('_rels/.rels',`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${names}</sheets></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${links}<Relationship Id="styles" Type="${rel}/styles" Target="styles.xml"/></Relationships>`);
    zip.file('xl/styles.xml',`<?xml version="1.0"?><styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    return zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:3}});
  }
  root.SraExcel={build};
})(typeof globalThis!=='undefined'?globalThis:this);
