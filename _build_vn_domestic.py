"""Transcription of the official 93-row annex; retain order and technical group."""
import json
from pathlib import Path

# name | strengths (one entry per annex row) | form; absence of form means conventional tablet/capsule.
DATA = '''Acyclovir|400mg,800mg
Albendazole|400mg
Allopurinol|300mg
Amisulpride|100mg,200mg
Atenolol|50mg
Atorvastatin|10mg,20mg
Bambuterol hydrochloride|10mg
Betahistine dihydrochloride|16mg
Bisoprolol fumarate|5mg,2.5mg,10mg
Carvedilol|12.5mg
Cefazolin|1g|Thuốc tiêm
Cefepime|1g,2g|Thuốc tiêm
Cefoperazone|1g,2g|Thuốc tiêm
Cefoperazone; Sulbactam|500mg; 500mg,1g; 500mg,1g; 1g|Thuốc tiêm
Cefotaxime|1g,2g|Thuốc tiêm
Cefotiam|1g|Thuốc tiêm
Ceftazidime|1g,2g,500mg|Thuốc tiêm
Ceftizoxime|1g|Thuốc tiêm
Ceftriaxone|1g|Thuốc tiêm
Cefuroxime|750mg,1.5g|Thuốc tiêm
Cetirizin dihydrochloride|10mg
Ciprofloxacin|500mg
Clopidogrel|75mg
Colchicine|1mg
Diosmin; Hesperidin|450mg; 50mg
Domperidone|10mg
Eperisone hydrochloride|50mg
Esomeprazole|40mg,20mg|Viên bao tan ở ruột
Etoricoxib|90mg,120mg
Ezetimibe|10mg
Fexofenadine hydrochloride|120mg,60mg
Fluconazole|150mg|Viên nang
Gabapentin|300mg
Galantamine|4mg
Ibuprofen|400mg
Ibuprofen; Paracetamol|200mg; 325mg
Irbesartan|150mg,300mg
Lamivudine|100mg
Lamotrigine|50mg
Lansoprazole|30mg|Viên nang
Levetiracetam|500mg
Levocetirizine dihydrochloride|5mg
Levofloxacin|500mg,250mg
Linezolid|600mg
Magnesi lactate dihydrate; Vitamin B6|470mg; 5mg
Meloxicam|7.5mg
Metformin hydrochloride|1000mg
Mirtazapin|30mg
Montelukast|10mg,5mg
Nabumeton|500mg
Nebivolol|5mg
Olanzapin|5mg,10mg
Paracetamol|500mg
Paracetamol; Tramadol hydrocloride|325mg; 37.5mg
Pcrindopril tert-butylamine|4mg
Piracetam|800mg
Quetiapine|200mg,100mg
Rabeprazole natri|20mg|Viên bao tan ở ruột
Rivaroxaban|15mg
Rosuvastatin|10mg,20mg,5mg
Spiramycin|3000000 IU
Sulpiride|50mg
Telmisartan|80mg,40mg
Tenofovir disoproxil fumarate|300mg
Trimetazidine hydrochloride|20mg
Trimetazidine hydrochloride|35mg|Viên giải phóng có kiểm soát
Valsartan|80mg
Venlafaxin|75mg
Vitamin B1; Vitamin B6; Vitamin B12|100mg; 200mg; 200mcg'''

rows = []
for line in DATA.splitlines():
    fields = line.split('|')
    name, strengths = fields[:2]
    form = fields[2] if len(fields) > 2 else 'Viên'
    for strength in strengths.split(','):
        rows.append(dict(id=len(rows)+1, inn=name, strength=strength, form=form, group='2'))
assert len(rows) == 93
assert rows[72]['inn'] == 'Paracetamol'
data = dict(document='03/2024/TT-BYT', checked='2026-09-23',
            source='https://vbpl.vn/boyte/Pages/vbpq-print.aspx?ItemID=166832',
            note='Phụ lục 93 thuốc, nhóm 2. Không suy rộng sang nhóm 1 hoặc dạng bào chế đặc biệt. Dòng 75 giữ nguyên cách ghi Pcrindopril trong bản HTML nguồn; cần kiểm tra bản ký trước khi ánh xạ.', rows=rows)
(Path(__file__).resolve().parent / 'data/vn-domestic-list.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
print('93 official annex entries')
