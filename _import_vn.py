"""Build a portable DAV ingredient snapshot; the source database stays read-only."""
import argparse
from collections import Counter
from datetime import date
import json
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parent


def eligible(record, as_of):
    if record.get('isDeleted') or record.get('isDaRutSoDangKy'):
        return False
    if record.get('isActive') is not True or record.get('isHetHan') is not False:
        return False
    expiry = (record.get('thongTinDangKyThuoc') or {}).get('ngayHetHanSoDangKy')
    return not expiry or expiry[:10] >= as_of


def build(source, as_of):
    wal = Path(str(source) + '-wal')
    if wal.exists() and wal.stat().st_size:
        raise ValueError('Close the DAV downloader first so the database checkpoint is complete')
    # immutable permits read-only access without creating WAL/SHM alongside the source.
    with sqlite3.connect(source.resolve().as_uri() + '?mode=ro&immutable=1', uri=True) as con:
        metadata = {k: json.loads(v) for k, v in con.execute('SELECT key,value FROM meta')}
        if not metadata.get('complete'):
            raise ValueError('DAV download is incomplete')
        counts = Counter()
        ingredients = set()
        records = []
        for (raw,) in con.execute('SELECT raw FROM drugs'):
            record = json.loads(raw)
            basic = record.get('thongTinThuocCoBan') or {}
            dates = record.get('thongTinDangKyThuoc') or {}
            flags = (int(record.get('isActive') is True) | (int(record.get('isHetHan') is True) << 1)
                     | (int(bool(record.get('isDaRutSoDangKy'))) << 2) | (int(bool(record.get('isDeleted'))) << 3)
                     | (int(bool(record.get('urlGiayTiepNhanGiaHan'))) << 4)
                     | (int(record.get('isHetHan') is None) << 5))
            records.append([str(record['id']), record.get('soDangKy') or '', record.get('soDangKyCu') or '',
                            basic.get('hoatChatChinh') or record.get('hoatChatChinh') or '',
                            basic.get('dangBaoChe') or '', basic.get('hamLuong') or '',
                            (dates.get('ngayCapSoDangKy') or '')[:10], (dates.get('ngayGiaHanSoDangKy') or '')[:10],
                            (dates.get('ngayHetHanSoDangKy') or '')[:10], flags,
                            (record.get('ngayTiepNhanHSGiaHan') or '')[:10], record.get('maSoHoSoGiaHan') or '',
                            record.get('tenThuoc') or '',
                            (record.get('congTyDangKy') or {}).get('tenCongTyDangKy') or record.get('tenCongTyDangKy') or ''])
            counts['total'] += 1
            if not eligible(record, as_of):
                counts['excluded'] += 1
                continue
            inn = (record.get('thongTinThuocCoBan') or {}).get('hoatChatChinh') or record.get('hoatChatChinh') or ''
            if not inn.strip():
                counts['missingIngredient'] += 1
                continue
            counts['included'] += 1
            if not (record.get('thongTinDangKyThuoc') or {}).get('ngayHetHanSoDangKy'):
                counts['withoutExpiry'] += 1
            ingredients.add(inn.strip())
    return dict(source='DAV', url='https://dichvucong.dav.gov.vn/congbothuoc/index',
                updated=metadata.get('updated'), asOf=as_of, counts=dict(counts), ingredients=sorted(ingredients),
                columns=['id', 'sdk', 'oldSdk', 'inn', 'form', 'strength', 'issued', 'renewed', 'expiry', 'flags', 'receiptDate', 'receiptId', 'product', 'registrant'],
                records=records)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database', type=Path)
    parser.add_argument('--as-of', default=date.today().isoformat(), type=lambda s: date.fromisoformat(s).isoformat())
    args = parser.parse_args()
    snapshot = build(args.database, args.as_of)
    (ROOT / 'data/vn-ingredients.json').write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(snapshot['counts'], 'distinct ingredient strings:', len(snapshot['ingredients']))
