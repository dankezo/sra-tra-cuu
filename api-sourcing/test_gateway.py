import json
import os
import tempfile
import time
import unittest
from unittest.mock import patch
import gateway
from pipeline import session, now
from extract import validate_extraction
from fda_access import allowed


class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.env=patch.dict(os.environ,{'APISRC_DB':os.path.join(self.temp.name,'test.sqlite3'),'APISRC_SEARCH_PROVIDERS':'tavily','TAVILY_API_KEY':'test','APISRC_WEB_DEADLINE_SECONDS':'0.1'})
        self.env.start()
    def tearDown(self):
        for future in list(gateway.INFLIGHT.values()):
            try:future.result(timeout=2)
            except Exception:pass
        gateway.INFLIGHT.clear();self.env.stop();self.temp.cleanup()
    def test_cache_avoids_network(self):
        query='cached API manufacturer supplier GMP CEP'
        with session() as con:
            con.execute('INSERT INTO apisrc_cache VALUES(?,?,?,?)',(gateway.cache_key('tavily',query),json.dumps({'provider':'tavily','results':[{'url':'https://example.com'}]}),now(),time.time()+60))
        with patch.object(gateway,'search_provider',side_effect=AssertionError('network called')):
            result=gateway.search('cached')
        self.assertTrue(result['providers'][0]['cached']);self.assertEqual(len(result['results']),1)
    def test_slow_provider_does_not_block_response(self):
        def slow(*args):
            time.sleep(.3);return {'provider':'tavily','results':[]}
        with patch.object(gateway,'search_provider',side_effect=slow):
            started=time.perf_counter();result=gateway.search('slow-query');elapsed=time.perf_counter()-started
            self.assertLess(elapsed,.25);self.assertEqual(result['pending'],1)
    def test_failure_is_cached_without_leaking_secrets(self):
        with patch.object(gateway,'search_provider',side_effect=RuntimeError('secret-in-url')) as request:
            gateway.search('failed-query');result=gateway.search('failed-query')
        self.assertEqual(request.call_count,1)
        self.assertNotIn('secret-in-url',json.dumps(result))
        self.assertTrue(result['providers'][0]['cached'])
    def test_fast_failover_stays_within_deadline(self):
        def provider(name,query):
            if name in ('brave','tavily'):raise RuntimeError('unavailable')
            return {'provider':name,'results':[{'url':'https://example.com'}]}
        with patch.dict(os.environ,{'APISRC_SEARCH_PROVIDERS':'brave,tavily,exa','BRAVE_SEARCH_API_KEY':'test','EXA_API_KEY':'test'}),patch.object(gateway,'search_provider',side_effect=provider):
            result=gateway.search('fallback-query')
        self.assertEqual(len(result['results']),1);self.assertEqual(result['results'][0]['url'],'https://example.com')
        self.assertIn('exa',result['attempted'])
    def test_provider_shapes_and_private_auth(self):
        from unittest.mock import Mock
        response=Mock();response.raise_for_status.return_value=None
        examples={'serpapi':{'organic_results':[{'link':'https://example.com','title':'Supplier','snippet':'Evidence'}]},
                  'hasdata':{'organicResults':[{'link':'https://example.com','title':'Supplier','snippet':'Evidence'}]},
                  'firecrawl':{'success':True,'data':{'web':[{'url':'https://example.com','title':'Supplier','description':'Evidence'}]}}}
        for name,payload in examples.items():
            response.json.return_value=payload
            with patch.dict(os.environ,{gateway.KEYS[name]:'private-key'}),patch.object(gateway.requests,'get',return_value=response),patch.object(gateway.requests,'post',return_value=response):
                result=gateway.search_provider(name,'amlodipine')
            self.assertEqual(result['results'][0]['snippet'],'Evidence');self.assertNotIn('private-key',json.dumps(result))
    def test_robots_glob_and_case(self):
        rules='User-agent: *\nDisallow: /scripts/warningletters/\nDisallow: /scripts/cdrh/*excel*.cfm'
        self.assertFalse(allowed(rules,'/SCRIPTS/WARNINGLETTERS/test'))
        self.assertFalse(allowed(rules,'/scripts/cdrh/testExcelDump.cfm'))
        self.assertTrue(allowed(rules,'/allowed'))
    def test_ai_quote_must_be_exact_and_relevant(self):
        text='Example Co supplies amlodipine. No other suppliers listed.'
        bad=[{'company':'Invented Co','quote':'Invented Co supplies amlodipine.'}]
        self.assertEqual(validate_extraction(bad,text,'amlodipine'),[])
        good=[{'company':'Example Co','quote':'Example Co supplies amlodipine.'}]
        self.assertEqual(validate_extraction(good,text,'amlodipine')[0]['verification'],'supplier_claimed')


if __name__=='__main__':unittest.main()
