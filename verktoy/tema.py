#!/usr/bin/env python3
"""Bygger temastrukturen for nettstedet: temasider, områdesider, løyper, sidemeny og toppmeny.
Bruk: python3 tema.py <prosjektmappe>   (kjøres etter meny.py og fag.py)

Grunnmuren er tema.yml (område → temaer → undertemaer). Innholdssider kobles til temaer fra:
  - løyper i loyper/*.yml (gammelt format: kapittel/side → tema)
  - fag fra malen: «tema: <tema-id>» og «undertema: <id>» i toppen av .qmd-fila (se _fag.json fra fag.py).
    De gamle navnene «emne:» og «delemne:» godtas fortsatt.
Ordet «emne» brukes ikke om temaene, fordi det også betyr et kurs (emnekode, emnebeskrivelse).
Løyper er ordnede lister av sider (et kurs, f.eks. TRES0312). Skriver også loyper.json, som
assets/js/loype.js bruker til «Forrige / Neste» og temalenken øverst på hver side."""
import json, re, sys
from html import escape
from pathlib import Path
import yaml

P = Path(sys.argv[1]).resolve()
E = yaml.safe_load((P / 'tema.yml').read_text(encoding='utf-8'))
omrader = E['omrader']
# Navnet på nettstedet (fysikkhjelp.no, matematikkhjelp.no …) hentes fra _quarto.yml, så samme verktøy brukes for alle.
_m = re.search(r'^  title:\s*"?([^"\n]+)"?\s*$', (P / '_quarto.yml').read_text(encoding='utf-8'), re.M)
NETTSTED = _m.group(1) if _m else 'nettstedet'
HAR_DEKNING = (P / 'dekning.qmd').exists()
HAR_LARER = (P / 'larer' / 'index.qmd').exists()
tema_info = {}                       # tema-id → (område, tema)
for o in omrader:
    for e in o['temaer']:
        tema_info[e['id']] = (o, e)
        # Undertemaer: listen i tema.yml + «oppgaver» (blandede oppgaver), som finnes i alle temaer
        e['undertemaer'] = list(e.get('undertemaer') or e.get('delemner') or []) + [{'id': 'oppgaver', 'tittel': 'Blandede oppgaver'}]
NIVAER = [('forkurs', 'Forkurs'), ('ingenior', 'Ingeniør'), ('fordypning', 'Fordypning')]
NIVA_NAVN = dict(NIVAER)
def topp(t, felt):
    m = re.search(r'^' + felt + r':\s*"?([\w-]+)"?\s*$', t.split('\n---', 1)[0], re.M)
    return m.group(1) if m else None

sider_per_tema = {eid: [] for eid in tema_info}   # tema → [side]
side_tema = {}                                    # qmd-sti → tema-id
loyper = []
uten_tema = []

def tittel_av(f):
    m = re.search(r'^title:\s*"?(.*?)"?\s*$', f.read_text(encoding='utf-8'), re.M)
    return m.group(1).replace('\\"', '"') if m else f.stem

def koble(sti, tittel, eid, kilde, undertema=None, niva=None):
    if eid not in tema_info:
        print(f'  ADVARSEL: ukjent tema «{eid}» for {sti}'); uten_tema.append((sti, tittel, kilde)); return
    gyldige = {d['id'] for d in tema_info[eid][1]['undertemaer']}
    if undertema and undertema not in gyldige:
        print(f'  ADVARSEL: ukjent undertema «{undertema}» i temaet {eid} for {sti}'); undertema = None
    if niva and niva not in NIVA_NAVN:
        print(f'  ADVARSEL: ukjent nivå «{niva}» for {sti}'); niva = None
    sider_per_tema[eid].append({'qmd': sti, 'tittel': tittel, 'kilde': kilde, 'undertema': undertema, 'niva': niva})
    side_tema[sti] = eid

# ---- løyper (forkurset fra kompendiet)
for lf in sorted((P / 'loyper').glob('*.yml')):
    L = yaml.safe_load(lf.read_text(encoding='utf-8'))
    if L.get('kilde') != 'forkurs': continue
    toc = json.loads((P / 'forkurs' / '_innhold.json').read_text(encoding='utf-8'))
    kob = L.get('temaer') or L.get('emner') or {}
    rekke = []
    for c in toc:
        for s in c['sider']:
            stem = s['fil'][:-4]; sti = f"forkurs/{c['dir']}/{s['fil']}"
            eid = kob.get(f"{c['dir']}/{stem}") or kob.get(c['dir'])
            if eid: koble(sti, s['tittel'], eid, L['tittel'], (L.get('undertemaer') or L.get('delemner') or {}).get(f"{c['dir']}/{stem}"), L.get('niva'))
            else: uten_tema.append((sti, s['tittel'], L['tittel']))
            rekke.append({'qmd': sti, 'tittel': s['tittel'], 'kapittel': c['tittel']})
    struktur = [{'tittel': None, 'kapitler': [{'tittel': c['tittel'], 'href': f"forkurs/{c['dir']}/index.qmd",
                  'sider': [f"forkurs/{c['dir']}/{s['fil']}" for s in c['sider']]} for c in toc]}]
    loyper.append({**{k: L.get(k) for k in ('id', 'tittel', 'institusjon', 'emnekode', 'beskrivelse')},
                   'oversikt': 'forkurs/index.qmd', 'sider': rekke, 'struktur': struktur})

# ---- fag fra malen
fag_f = P / '_fag.json'
fag_liste = json.loads(fag_f.read_text(encoding='utf-8')) if fag_f.exists() else []
for f in fag_liste:
    for k in f['kapitler']:
        for s in k['sider']:
            sti = f"{f['kortnavn']}/kapitler/{k['dir']}/{s['fil']}"
            tekst = (P / sti).read_text(encoding='utf-8')
            tid = topp(tekst, 'tema') or topp(tekst, 'emne')          # «emne:»/«delemne:» er gamle navn, godtas fortsatt
            if tid: koble(sti, s['tittel'], tid, f['tittel'], topp(tekst, 'undertema') or topp(tekst, 'delemne'), topp(tekst, 'niva') or f.get('niva'))
            else: uten_tema.append((sti, s['tittel'], f['tittel']))

# ---- løyper som følger et fag fra malen (kilde: fag, fag: <kortnavn>): sidene i fagets rekkefølge
for lf in sorted((P / 'loyper').glob('*.yml')):
    L = yaml.safe_load(lf.read_text(encoding='utf-8'))
    if L.get('kilde') != 'fag': continue
    f = next((x for x in fag_liste if x['kortnavn'] == L.get('fag')), None)
    if not f: continue
    rekke = [{'qmd': f"{f['kortnavn']}/kapitler/{k['dir']}/{s['fil']}", 'tittel': s['tittel'], 'kapittel': k['tittel']}
             for k in f['kapitler'] for s in k['sider']]
    struktur = []
    for i, k in enumerate(f['kapitler'], 1):
        if not struktur or struktur[-1]['tittel'] != (k.get('del') or None):
            struktur.append({'tittel': k.get('del') or None, 'kapitler': []})
        struktur[-1]['kapitler'].append({'tittel': k['tittel'],
            'href': f"{f['kortnavn']}/kapitler/{k['dir']}/index.qmd" if k.get('har_index') else None,
            'sider': [f"{f['kortnavn']}/kapitler/{k['dir']}/{s['fil']}" for s in k['sider']]})
    loyper.append({**{k: L.get(k) for k in ('id', 'tittel', 'institusjon', 'emnekode', 'beskrivelse')},
                   'oversikt': f"{f['kortnavn']}/index.qmd", 'sider': rekke, 'struktur': struktur})

def html(q): return '/' + q.replace('.qmd', '.html')

# ---- generer sider
UT = P / 'tema'
if UT.exists():
    for x in UT.rglob('*.qmd'): x.unlink()
UT.mkdir(exist_ok=True)

def antall(o): return sum(len(sider_per_tema[e['id']]) for e in o['temaer'])

# tema/index.qmd
q = ['---', 'title: "Temaer"', 'aliases: ["/emner/index.html"]', f'subtitle: "Alt stoffet på {NETTSTED}, ordnet etter tema. Velg et område og et tema, eller følg en løype."',
     'toc: false', 'page-layout: full', '---', '', '```{=html}', '<div class="omrader">']
for o in omrader:
    n = antall(o); live = n > 0
    q.append(f'<div class="omrade{"" if live else " tomt"}">')
    q.append(f'  <a class="omr-hode" href="{o["id"]}/index.html">')
    if o.get('bilde'): q.append(f'    <img src="../assets/img/tegninger/{o["bilde"]}.webp" alt="" loading="lazy">')
    q.append(f'    <span class="omr-navn">{o["tittel"]}</span>' + ('' if live else '<em class="pill off">kommer</em>') + '</a>')
    q.append(f'  <p class="omr-beskr">{o.get("beskrivelse", "")}</p><ul>')
    for e in o['temaer']:
        k = len(sider_per_tema[e['id']])
        q.append(f'    <li><a href="{o["id"]}/{e["id"]}.html"' + ('' if k else ' class="tom"') + f'>{e["tittel"]}</a>' + (f' <span class="ant">{k}</span>' if k else '') + '</li>')
    q.append('  </ul>\n</div>')
q += ['</div>', '```', '']
(UT / 'index.qmd').write_text('\n'.join(q), encoding='utf-8')

def i_loyper(sti):
    ut = []
    for L in loyper:
        for i, s in enumerate(L['sider'], 1):
            if s['qmd'] == sti: ut.append((L, i))
    return ut

for o in omrader:
    (UT / o['id']).mkdir(exist_ok=True)
    # Områdesiden: samme struktur som sidemenyen (tema → undertemaer), med nivåene som finnes for hvert undertema
    q = ['---', f'title: "{o["tittel"]}"', f'aliases: ["/emner/{o["id"]}/index.html"]', f'subtitle: "{o.get("beskrivelse", "")}"', 'toc: false', 'page-layout: full', '---', '',
         '```{=html}', '<div class="tema-kort">']
    for e in o['temaer']:
        ss = sider_per_tema[e['id']]
        q.append(f'<section class="ek{"" if ss else " tom"}"><h2><a href="{e["id"]}.html">{escape(e["tittel"])}</a>' + ('' if ss else ' <em class="pill off">kommer</em>') + '</h2>')
        if ss:
            q.append('<ul>')
            for d in e['undertemaer']:
                dss = [x for x in ss if x['undertema'] == d['id']]
                if not dss: continue
                nv = [t for k, t in NIVAER if any(x['niva'] == k for x in dss)]
                q.append(f'<li><a href="{e["id"]}/{d["id"]}.html">{escape(d["tittel"])}</a>' + ''.join(f'<span class="ek-niva">{t}</span>' for t in nv) + '</li>')
            for x in ss:
                if not x['undertema']: q.append(f'<li><a href="../../{x["qmd"].replace(".qmd", ".html")}">{escape(x["tittel"])}</a></li>')
            q.append('</ul>')
        q.append('</section>')
    q += ['</div>', '```', '']
    (UT / o['id'] / 'index.qmd').write_text('\n'.join(q), encoding='utf-8')
    for e in o['temaer']:
        ss = sider_per_tema[e['id']]
        q = ['---', f'title: "{e["tittel"]}"', f'aliases: ["/emner/{o["id"]}/{e["id"]}.html"]', f'subtitle: "{o["tittel"]}"', 'toc: false', '---', '']
        tekst = P / 'tema-tekster' / f'{e["id"]}.md'
        if tekst.exists(): q += [tekst.read_text(encoding='utf-8'), '']
        if ss:
            q.append('Under ser du en oversikt over sidene som behandler temaet, ordnet etter undertema og nivå.\n')
            nivaer = [(k, t) for k, t in NIVAER if any(x['niva'] == k for x in ss)]
            if any(not x['niva'] for x in ss): nivaer.append((None, 'Annet'))
            if len(nivaer) > 1 or len({x['kilde'] for x in ss}) > 1:
                q.append('::: {.callout-tip title="Ser du flere sider om det samme?"}\n'
                         'Det kan skyldes at de er tilpasset forskjellig nivå. Velg det nivået som passer deg: '
                         '**Forkurs** (lite forkunnskap), **Ingeniør** (første år på ingeniør- og realfag) eller **Fordypning**.\n:::\n')
            rader = [d for d in e['undertemaer'] if any(x['undertema'] == d['id'] for x in ss)]
            if any(not x['undertema'] for x in ss): rader.append({'id': None, 'tittel': 'Andre sider'})
            def celle(lst):
                return ''.join(f'<a href="../../{x["qmd"].replace(".qmd", ".html")}">{escape(x["tittel"])}<span class="tema-kilde">{escape(x["kilde"])}</span></a>' for x in lst)
            h = ['```{=html}', '<div class="niva-tabell-ramme"><table class="niva-tabell"><thead><tr><th>Undertema</th>'
                 + ''.join(f'<th>{t}</th>' for _, t in nivaer) + '</tr></thead><tbody>']
            for d in rader:
                navn = f'<a class="dl-lenke" href="{e["id"]}/{d["id"]}.html">{escape(d["tittel"])}</a>' if d['id'] else escape(d['tittel'])
                h.append(f'<tr><th scope="row">{navn}</th>' + ''.join(
                    f'<td data-niva="{t}">' + celle([x for x in ss if x['undertema'] == d['id'] and x['niva'] == k]) + '</td>' for k, t in nivaer) + '</tr>')
            h += ['</tbody></table></div>', '```', '']
            q += h
        else:
            q += ['::: {.callout-note title="Kommer"}', 'Vi har ikke stoff om dette temaet ennå. Har du forelesningsnotater du vil dele? [Donér dem her](https://realfagsambassaden.no/doner.html).', ':::', '']
        (UT / o['id'] / f'{e["id"]}.qmd').write_text('\n'.join(q), encoding='utf-8')
        # Én side per undertema: velg nivå
        for d in e['undertemaer']:
            dss = [x for x in ss if x['undertema'] == d['id']]
            if not dss: continue
            (UT / o['id'] / e['id']).mkdir(exist_ok=True)
            dq = ['---', f'title: "{d["tittel"]}"', f'aliases: ["/emner/{o["id"]}/{e["id"]}/{d["id"]}.html"]', f'subtitle: "{e["tittel"]} · {o["tittel"]}"', 'toc: false', '---', '',
                  f'[← Til temaet {e["tittel"]}](../{e["id"]}.qmd){{.dl-tilbake}}', '']
            nv = [(k, t) for k, t in NIVAER if any(x['niva'] == k for x in dss)] + ([(None, 'Annet')] if any(not x['niva'] for x in dss) else [])
            if len(dss) > 1: dq.append('Stoffet finnes på flere nivåer. Velg det som passer deg.\n')
            dq += ['```{=html}', '<div class="dl-nivaer">']
            for k, t in nv:
                dq.append(f'<section class="dl-niva"><h2>{t}</h2>' + ''.join(
                    f'<a class="dl-kort" href="../../../{x["qmd"].replace(".qmd", ".html")}"><span class="dl-tittel">{escape(x["tittel"])}</span><span class="tema-kilde">{escape(x["kilde"])}</span></a>'
                    for x in dss if x['niva'] == k) + '</section>')
            dq += ['</div>', '```', '']
            (UT / o['id'] / e['id'] / f'{d["id"]}.qmd').write_text('\n'.join(dq), encoding='utf-8')

# løyper/index.qmd
LU = P / 'loyper'; LU.mkdir(exist_ok=True)
q = ['---', 'title: "Løyper"', 'subtitle: "En løype er en vei gjennom temaene for et bestemt kurs. Følg en ferdig løype, eller lag din egen."',
     'toc: false', '---', '', '```{=html}', '<div class="loyper">']
for L in loyper:
    meta = ' · '.join(x for x in (L.get('institusjon'), L.get('emnekode'), f'{len(L["sider"])} sider') if x)
    q.append(f'<a class="loype" href="../{L["oversikt"].replace(".qmd", ".html")}"><span class="status">Løype</span><h3>{L["tittel"]}</h3><p class="loype-meta">{meta}</p><p>{L.get("beskrivelse", "")}</p></a>')
if HAR_DEKNING: q.append('<a class="loype egen" href="../dekning.html"><span class="status">Lag din egen</span><h3>Har du et annet kurs?</h3><p>Lim inn emnebeskrivelsen, så finner vi sidene som passer og lager en løype for deg.</p></a>')
q += ['</div>', '```', '']
(LU / 'index.qmd').write_text('\n'.join(q), encoding='utf-8')

# loyper.json for forrige/neste og temalenke
side_info = {}
for sti, eid in side_tema.items():
    o, e = tema_info[eid]
    side = next(x for x in sider_per_tema[eid] if x['qmd'] == sti)
    dl = next((d for d in e['undertemaer'] if d['id'] == side['undertema']), None)
    tvillinger = [{'url': html(x['qmd']), 'tittel': x['tittel'], 'kilde': x['kilde'], 'niva': NIVA_NAVN.get(x['niva'], '')}
                  for x in sider_per_tema[eid] if dl and dl['id'] != 'oppgaver' and x['undertema'] == dl['id'] and x['qmd'] != sti]
    side_info[html(sti)] = {'tema': e['tittel'], 'temaUrl': f'/tema/{o["id"]}/{e["id"]}.html', 'omrade': o['tittel'],
                            'undertema': dl['tittel'] if dl else None,
                            'undertemaUrl': f'/tema/{o["id"]}/{e["id"]}/{dl["id"]}.html' if dl else None, 'niva': NIVA_NAVN.get(side['niva'], ''), 'tvillinger': tvillinger}
# Temarekka: alle sider i menyrekkefølge (område → tema → undertema), brukt til forrige/neste på samme nivå
temarekke = []
for o in omrader:
    for e in o['temaer']:
        ss = sider_per_tema[e['id']]
        rekkef = [d['id'] for d in e['undertemaer']] + [None]
        for did in rekkef:
            for x in ss:
                if x['undertema'] == did:
                    temarekke.append({'url': html(x['qmd']), 'tittel': x['tittel'], 'niva': x['niva'] or '', 'omrade': o['tittel'], 'tema': e['tittel']})
(P / 'loyper.json').write_text(json.dumps({
    'temarekke': temarekke, 'nivanavn': NIVA_NAVN,
    'loyper': [{'id': L['id'], 'tittel': L['tittel'], 'url': html(L['oversikt']),
                'sider': [{'url': html(s['qmd']), 'tittel': s['tittel']} for s in L['sider']]} for L in loyper],
    'sider': side_info}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

# ---- sidemeny (én, etter temaer) og toppmeny
sb = ['  sidebar:', '    - id: tema', '      title: "Temaer"', '      style: docked', '      collapse-level: 1', '      contents:', '        - tema/index.qmd']
for o in omrader:
    if not antall(o): continue
    sb += [f'        - section: "{o["tittel"]}"', f'          href: tema/{o["id"]}/index.qmd', '          contents:']
    for e in o['temaer']:
        ss = sider_per_tema[e['id']]
        if not ss: continue
        sb += [f'            - section: "{e["tittel"]}"', f'              href: tema/{o["id"]}/{e["id"]}.qmd', '              contents:']
        for d in e['undertemaer']:
            if any(x['undertema'] == d['id'] for x in ss):
                sb += [f'                - text: "{d["tittel"]}"', f'                  href: tema/{o["id"]}/{e["id"]}/{d["id"]}.qmd']
        sb += [f'                - {s["qmd"]}' for s in ss if not s['undertema']]
if uten_tema:
    sb += ['        - section: "Annet"', '          contents:'] + [f'            - {s}' for s, _, _ in uten_tema]
sb += ['        - section: "Løyper"', '          href: loyper/index.qmd'] + (['          contents:'] if loyper else [])
def kap_blokk(k, inn):
    b = [f'{inn}- section: "{k["tittel"]}"'] + ([f'{inn}  href: {k["href"]}'] if k.get('href') else []) + [f'{inn}  contents:']
    return b + [f'{inn}    - {x}' for x in k['sider']]
for L in loyper:
    sb += [f'            - section: "{L["tittel"]}"', f'              href: {L["oversikt"]}', '              contents:']
    for d in L.get('struktur', []):
        if d['tittel']:
            sb += [f'                - section: "{d["tittel"]}"', '                  contents:']
            for k in d['kapitler']: sb += kap_blokk(k, '                    ')
        else:
            for k in d['kapitler']: sb += kap_blokk(k, '                ')

meny = ['    left:', '      - text: Temaer', '        menu:', '          - href: tema/index.qmd', '            text: "Alle temaer"']
for o in omrader:
    meny += [f'          - href: tema/{o["id"]}/index.qmd', f'            text: "{o["tittel"]}"' + ('' if antall(o) else '')]
meny += ['      - text: Løyper', '        menu:', '          - href: loyper/index.qmd', '            text: "Alle løyper"']
for L in loyper:
    meny += [f'          - href: {L["oversikt"]}', f'            text: "{L["tittel"]}"']
if HAR_DEKNING: meny += ['          - href: dekning.qmd', '            text: "Lag din egen løype"']
if HAR_LARER: meny += ['          - text: "---"', '          - href: larer/index.qmd', '            text: "For lærere: design din forelesning"']

yml = (P / '_quarto.yml').read_text(encoding='utf-8')
yml = re.sub(r'\n# >>> fag-sidemeny.*?# <<< fag-sidemeny\n', '\n', yml, flags=re.S)
yml = re.sub(r'  sidebar:\n(?:    +.*\n)*', '\n'.join(sb) + '\n', yml, count=1)
yml = re.sub(r'    left:\n(?:      .*\n|        .*\n|          .*\n|            .*\n)*', '\n'.join(meny) + '\n', yml, count=1)
(P / '_quarto.yml').write_text(yml, encoding='utf-8')

n = sum(len(v) for v in sider_per_tema.values())
print(f'tema: {n} sider koblet til {sum(1 for v in sider_per_tema.values() if v)} temaer, {len(uten_tema)} uten tema, {len(loyper)} løyper')
