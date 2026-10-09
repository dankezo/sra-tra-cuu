"""Explicit local company merge/split. Aliases preserve the override on re-ingestion."""
import argparse
import json
from pipeline import database, norm, now


def merge(con, old, new):
    if old == new or con.execute('SELECT count(*) FROM apisrc_company WHERE id IN (?,?)',(old,new)).fetchone()[0] != 2:
        raise ValueError('Choose two distinct existing companies')
    with con:
        for table in ('certificate','listing','site','company_alias','event_flag','bag_item'):
            con.execute(f'UPDATE apisrc_{table} SET company_id=? WHERE company_id=?', (new,old))
    return {'from':old,'into':new,'note':'Source holder names retained. Re-export to update UI.'}


def split(con, cert_id):
    cert = con.execute('SELECT * FROM apisrc_certificate WHERE id=?',(cert_id,)).fetchone()
    if not cert:
        raise ValueError('Unknown certificate')
    key = norm(cert['holder'])
    with con:
        con.execute('INSERT OR IGNORE INTO apisrc_company(canonical_name,name_key,created_at) VALUES(?,?,?)',(cert['holder'],key,now()))
        company=con.execute('SELECT id FROM apisrc_company WHERE name_key=?',(key,)).fetchone()[0]
        # Split all records for this source holder so the alias is coherent on the next import.
        con.execute('UPDATE apisrc_certificate SET company_id=? WHERE holder=? AND source=?',(company,cert['holder'],cert['source']))
        con.execute('UPDATE apisrc_company_alias SET company_id=? WHERE alias_norm=? AND source=?',(company,key,cert['source']))
    return {'company':company,'holder':cert['holder'],'source':cert['source']}


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--db');sub=p.add_subparsers(dest='action',required=True)
    m=sub.add_parser('merge');m.add_argument('old',type=int);m.add_argument('new',type=int)
    s=sub.add_parser('split');s.add_argument('certificate',type=int)
    args=p.parse_args()
    with database(args.db) as con:
        print(json.dumps(merge(con,args.old,args.new) if args.action=='merge' else split(con,args.certificate)))
