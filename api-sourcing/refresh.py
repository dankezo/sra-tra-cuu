"""Daily EDQM, weekly WHO, quarterly FDA. Failed pulls retain previous official records."""
import json
from datetime import datetime, timezone, timedelta
from pipeline import session, restore, fetch_source, ingest, export, now


if __name__=='__main__':
    outcomes=[]
    with session() as con:
        restore(con)
        for source,days in [('EDQM',1),('WHO',7),('FDA',7)]:
            if source=='FDA':
                today=datetime.now(timezone.utc)
                quarter_end=(today.replace(month=((today.month-1)//3)*3+1,day=1)-timedelta(days=1)).date().isoformat()
                file_date=con.execute("SELECT MAX(source_file_date) FROM apisrc_certificate WHERE source='FDA'").fetchone()[0]
                if file_date and file_date>=quarter_end:
                    outcomes.append({'source':source,'status':'quarter_current'});continue
            latest=con.execute("SELECT finished_at FROM apisrc_ingest_run WHERE source=? ORDER BY id DESC LIMIT 1",(source,)).fetchone()
            if latest and datetime.now(timezone.utc)-datetime.fromisoformat(latest[0])<timedelta(days=days):
                outcomes.append({'source':source,'status':'not_due'});continue
            try:
                outcomes.append(ingest(con,source,*fetch_source(source)))
            except Exception as error:
                # Keep failure observable even if download failed before parser execution.
                con.execute('INSERT INTO apisrc_ingest_run(source,started_at,finished_at,status,error) VALUES(?,?,?,?,?)',(source,now(),now(),'error',type(error).__name__))
                con.commit();outcomes.append({'source':source,'status':'error','error':type(error).__name__})
        result=export(con)
    print(json.dumps({'sources':outcomes,'export':result}))
