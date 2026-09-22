"""Resolve audited candidates: official site, company profile, then Google.

Only successful checks are published. This is a maintenance command, not runtime
cross-origin probing (which browsers cannot use to detect geographic blocking).
"""
import concurrent.futures
import json
from pathlib import Path
from audit_company_links import check

OFFICIAL = {
 'https://global.hisamitsu.com': 'https://global.hisamitsu/company/',
 'https://www.labhering.com.br': 'https://www.heringlaboratori.com/azienda/',
 'https://www.microlabs.com': 'https://www.microlabsltd.com/',
 'https://www.bml.com.au': 'https://bnmgroup.advanzpharma.com/',
 'https://www.landauer.com': 'https://www.ldrp.com.au/about/',
 'https://www.ibsa.com': 'https://www.ibsagroup.com/',
 'https://www.gl-pharma.at': 'https://gl-pharma.com/enuk/about-us/',
 'https://www.eurogenerics.com': 'https://www.eg.be/nl/over-eg/divisies',
 'https://www.abacusmedicine.com': 'https://abacusmedicinegroup.com/what-we-do/',
 'https://www.abbott.com.au': 'https://www.abbott.com/',
 'https://www.roche.com.au': 'https://www.roche.com/',
 'https://www.merck.com': 'https://www.merckgroup.com/en',
 'https://junopharm.com.au': 'https://www.junopharm.com/corporate-overview/',
}
# Explicit extra candidates for distinct legal entities (not domain guesses).
EXTRA = ['https://egstada.it/azienda', 'https://www.microlabsgmbh.de/']
PROFILES = {
 'glenmarkpharma.com':'Glenmark_Pharmaceuticals', 'inovapharma.com':None,
 'sunpharma.com':'Sun_Pharma', 'www.abbvie.com':'AbbVie', 'www.abbvie.com.au':'AbbVie',
 'www.astrazeneca.com':'AstraZeneca', 'www.astrazeneca.com.au':'AstraZeneca',
 'www.bayer.com':'Bayer', 'www.bayer.com.au':'Bayer',
 'www.boehringer-ingelheim.com':'Boehringer_Ingelheim', 'www.boehringer-ingelheim.com.au':'Boehringer_Ingelheim',
 'www.apotex.com':'Apotex', 'www.alfasigma.com':'Alfasigma', 'www.biocon.com':'Biocon',
 'www.csl.com':'CSL_Limited', 'www.cslbehring.com':'CSL_Behring', 'www.seqirus.com':'Seqirus',
 'www.ferring.com':'Ferring_Pharmaceuticals', 'www.lilly.com':'Eli_Lilly_and_Company', 'www.lilly.com.au':'Eli_Lilly_and_Company',
 'www.heteroworld.com':'Hetero_Drugs', 'www.medochemie.com':'Medochemie',
 'www.mt-pharma.co.jp':'Mitsubishi_Tanabe_Pharma', 'www.nipponkayaku.com':'Nippon_Kayaku',
 'www.sigmahealthcare.com.au':'Sigma_Healthcare', 'www.stallergenesgreer.com':'Stallergenes_Greer',
 'www.taisho.co.jp':'Taisho_Pharmaceutical', 'www.terumo.com':'Terumo',
 'www.torrentpharma.com':'Torrent_Pharmaceuticals', 'www.vrtx.com':'Vertex_Pharmaceuticals',
 'www.jnj.com':'Johnson_%26_Johnson', 'www.janssen.com':'Janssen_Pharmaceuticals',
 'www.haleon.com':'Haleon', 'olpha.eu':'Olainfarm',
}
PROFILE_URLS = {
 'https://glenmarkpharma.com': 'https://www.fortuneindia.com/companies/glenmark-pharmaceuticals-ltd',
 'https://www.abacusmedicine.com': 'https://augustinusfabrikker.dk/en/ownerships/abacus-medicine',
 'https://www.labhering.com.br': 'https://www.ufficiocamerale.it/5715/hering-srl',
 'https://junopharm.com.au': 'https://abr.business.gov.au/ABN/View?abn=55156303650',
 'https://www.1apharma.com': 'https://www.1a-award.de/ueber-uns/',
 'https://www.gl-pharma.at': 'https://en.wikipedia.org/wiki/G.L._Pharma',
 'https://www.betapharm.de': 'https://de.wikipedia.org/wiki/Betapharm',
 'https://www.dhu.com': 'https://de.wikipedia.org/wiki/Deutsche_Hom%C3%B6opathie-Union',
 'https://www.mepha.ch': 'https://de.wikipedia.org/wiki/Mepha',
 'https://www.wala.ch': 'https://de.wikipedia.org/wiki/Wala_Heilmittel',
 'https://www.macleodspharma.com': 'https://en.wikipedia.org/wiki/Macleods_Pharmaceuticals',
 'https://www.cinfa.com': 'https://es.wikipedia.org/wiki/Cinfa',
 'https://www.ardeypharm.de': 'https://de.wikipedia.org/wiki/Ardeypharm',
}
OFFICIAL.update({
 'https://www.accord-healthcare.com': 'https://www.accord-healthcare-products.co.uk/about',
 'https://www.menarini.com.au': 'https://www.menarini.com/en-us.html',
 'https://www.mundipharma.com.au': 'https://www.mundipharma.com/',
 'https://inpharm.com.pl': 'https://inpharm.pl/o-nas/',
 'https://www.sigmapharmaceuticals.co.uk': 'https://www.sigmaplc.com/',
 'https://www.spirig.ch': 'https://www.spirig-healthcare.ch/',
 'https://www.cemon.it': 'https://cemon.eu/chi-siamo/',
 'https://www.docgenerici.it': 'https://docpharma.com/contacts/?lang=en',
 'https://www.jamppharma.com': 'https://www.jamppharma.ca/en/about-us/',
 'https://www.parlogis.is': 'https://parlogis.is/en/',
 'https://www.generis.pt': 'https://www.generis.pt/sobre-nos/',
 'https://www.chartwellpharma.com': 'https://chartwellpharma.com/about-chartwell/',
 'https://www.eureco-pharma.nl': 'https://eureco-pharma.nl/en/about-eureco-pharma/',
 'https://www.exeltis.com': 'https://exeltis.com/en/cmo/',
 'https://www.generichealth.com.au': 'https://generichealth.com.au/about-us/',
 'https://www.linkmedical.com.au': 'https://www.linkhealthcare.com.au/home-australia/',
 'https://www.southernxpharma.com.au': 'https://southernxip.com/',
 'https://www.prodoc.qc.ca': 'https://prodoc.qc.ca/main.php?page=accueil',
 'https://www.techdow.com': 'https://www.techdow.com/en/',
 'https://www.xiromed.com': 'https://xiromed.com/',
 'https://www.arrowgeneriques.com': 'https://www.laboratoire-arrow.com/',
 'https://www.pharmadia.lt': 'https://www.pharmadia.eu/contact/',
})
PROFILE_URLS.update({
 'https://www.arrowgeneriques.com': 'https://www.pappers.fr/entreprise/arrow-generiques-433944485',
 'https://www.generis.pt': 'https://www.pharmacompass.com/about/generis-farmaceutica-sa',
 'https://www.docgenerici.it': 'https://www.pharmacompass.com/about/doc-generici',
 'https://www.spirig.ch': 'https://www.moneyhouse.ch/en/company/spirig-healthcare-ag-12145768491',
 'https://www.prodoc.qc.ca': 'https://dhpp.hpfb-dgpsa.ca/dhpp/company/4901',
 'https://www.linkmedical.com.au': 'https://abr.business.gov.au/ABN/View?abn=73010971516',
 'https://www.generichealth.com.au': 'https://ethical.org.au/companies/1985',
 'https://noumed.com.au': 'https://au.seek.com/companies/noumed-pharmaceuticals-165370347886415',
 'https://www.pharmadia.lt': 'https://rekvizitai.vz.lt/en/company/pharmadia/',
 'https://www.aftpharm.com': 'https://stockanalysis.com/quote/nze/AFT/',
 'https://www.jamppharma.com': 'https://dhpp.hpfb-dgpsa.ca/dhpp/company/4415',
 'https://www.gmpharma.com.au': 'https://www.tga.gov.au/resources/sponsor/gm-pharma-international-pty-ltd?page=1',
})
OFFICIAL['https://www.baxter.com.au'] = 'https://www.baxterhealthcare.com.au/'

if __name__ == '__main__':
    audit = json.loads(Path('data/company-link-audit.json').read_text(encoding='utf-8'))
    sites = audit['sites']
    # The old GM Pharma domain belongs to a different business; HTTP 200 is not identity evidence.
    sites['https://www.gmpharma.com.au']['reachable'] = False
    sites['https://www.gmpharma.com.au']['identityRejected'] = True
    for old, data in sites.items():
        if any(x in data.get('title','').lower() for x in ['maintenance','coming soon','challenge validation','checking your browser']):
            data['reachable'] = False
    for host, title in PROFILES.items():
        if title:
            PROFILE_URLS.setdefault('https://'+host, 'https://en.wikipedia.org/wiki/'+title)
    candidates = sorted(set(OFFICIAL.values()) | set(EXTRA) | set(PROFILE_URLS.values()))
    previous = Path('data/company-link-resolutions.json')
    # Reuse successful checks from this audit date, retry failures/new candidates.
    cache = json.loads(previous.read_text(encoding='utf-8')) if previous.exists() else {}
    checked = cache.get('checks', {}) if cache.get('checkedAt') == audit['checkedAt'] else {}
    pending = [u for u in candidates if not checked.get(u, {}).get('reachable')]
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        checked.update(dict(pool.map(check, pending)))
    resolved = {}
    for old, data in sites.items():
        official = OFFICIAL.get(old, old)
        result = checked.get(official, data)
        if result.get('reachable'):
            resolved[old] = dict(url=result.get('url', official), kind='official')
        else:
            profile = PROFILE_URLS.get(old)
            result = checked.get(profile, {})
            if result.get('reachable'):
                resolved[old] = dict(url=result.get('url', profile), kind='profile')
    for url in EXTRA:
        if checked[url].get('reachable'):
            resolved[url] = dict(url=checked[url].get('url', url), kind='official')
    Path('data/company-link-resolutions.json').write_text(json.dumps(dict(checkedAt=audit['checkedAt'], links=resolved, checks=checked), ensure_ascii=False, indent=2),encoding='utf-8')
    Path('data/company-link-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Resolved',len(resolved),'including',sum(v['kind']=='profile' for v in resolved.values()),'profiles')
    print('Unresolved:', '\n'.join(u for u in sites if u not in resolved))
