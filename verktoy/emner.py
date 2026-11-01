#!/usr/bin/env python3
"""Bygger emnestrukturen for nettstedet: emnesider, områdesider, løyper, sidemeny og toppmeny.
Bruk: python3 emner.py <prosjektmappe>   (kjøres etter meny.py og fag.py)

Grunnmuren er emner.yml (område → emner). Innholdssider kobles til emner fra:
  - løyper i loyper/*.yml (forkurset: kapittel/side → emne)
  - fag fra malen: «emne: <emne-id>» i toppen av .qmd-fila (se _fag.json fra fag.py)
Løyper er ordnede lister av sider (et kurs, f.eks. TRES0312). Skriver også loyper.json, som
assets/js/loype.js bruker til «Forrige / Neste» og emnelenken øverst på hver side."""
import json, re, sys
from pathlib import Path
import yaml

P = Path(sys.argv[1]).resolve()
E = yaml.safe_load((P / 'emner.yml').read_text(encoding='utf-8'))
omrader = E['omrader']
emne_info = {}                       # emne-id → (område, emne)
for o in omrader:
    for e in o['emner']:
        emne_info[e['id']] = (o, e)

sider_per_emne = {eid: [] for eid in emne_info}   # emne → [side]
side_emne = {}                                    # qmd-sti → emne-id
loyper = []
uten_emne = []

def tittel_av(f):
    m = re.search(r'^title:\s*"?(.*?)"?\s*$', f.read_text(encoding='utf-8'), re.M)
    return m.group(1).replace('\\"', '"') if m else f.stem

def koble(sti, tittel, eid, kilde):
    if eid not in emne_info:
        print(f'  ADVARSEL: ukjent emne «{eid}» for {sti}'); uten_emne.append((sti, tittel, kilde)); return
    sider_per_emne[eid].append({'qmd': sti, 'tittel': tittel, 'kilde': kilde})
    side_emne[sti] = eid

# ---- løyper (forkurset fra kompendiet)
for lf in sorted((P / 'loyper').glob('*.yml')):
    L = yaml.safe_load(lf.read_text(encoding='utf-8'))
    if L.get('kilde') != 'forkurs': continue
    toc = json.loads((P / 'forkurs' / '_innhold.json').read_text(encoding='utf-8'))
    kob = L.get('emner') or {}
    rekke = []
    for c in toc:
        for s in c['sider']:
            stem = s['fil'][:-4]; sti = f"forkurs/{c['dir']}/{s['fil']}"
            eid = kob.get(f"{c['dir']}/{stem}") or kob.get(c['dir'])
            if eid: koble(sti, s['tittel'], eid, L['tittel'])
            else: uten_emne.append((sti, s['tittel'], L['tittel']))
            rekke.append({'qmd': sti, 'tittel': s['tittel'], 'kapittel': f"{c['nr']}. {c['tittel']}"})
    struktur = [{'tittel': None, 'kapitler': [{'tittel': f"{c['nr']}. {c['tittel']}", 'href': f"forkurs/{c['dir']}/index.qmd",
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
            m = re.search(r'^emne:\s*"?([\w-]+)"?\s*$', (P / sti).read_text(encoding='utf-8'), re.M)
            if m: koble(sti, s['tittel'], m.group(1), f['tittel'])
            else: uten_emne.append((sti, s['tittel'], f['tittel']))

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
        struktur[-1]['kapitler'].append({'tittel': f"{i}. {k['tittel']}",
            'href': f"{f['kortnavn']}/kapitler/{k['dir']}/index.qmd" if k.get('har_index') else None,
            'sider': [f"{f['kortnavn']}/kapitler/{k['dir']}/{s['fil']}" for s in k['sider']]})
    loyper.append({**{k: L.get(k) for k in ('id', 'tittel', 'institusjon', 'emnekode', 'beskrivelse')},
                   'oversikt': f"{f['kortnavn']}/index.qmd", 'sider': rekke, 'struktur': struktur})

def html(q): return '/' + q.replace('.qmd', '.html')

# ---- generer sider
UT = P / 'emner'
if UT.exists():
    for x in UT.rglob('*.qmd'): x.unlink()
UT.mkdir(exist_ok=True)

def antall(o): return sum(len(sider_per_emne[e['id']]) for e in o['emner'])

# emner/index.qmd
q = ['---', 'title: "Emner"', 'subtitle: "Alt stoffet på fysikkhjelp.no, ordnet etter tema. Velg et område og et emne, eller følg en løype."',
     'toc: false', 'page-layout: full', '---', '', '```{=html}', '<div class="omrader">']
for o in omrader:
    n = antall(o); live = n > 0
    q.append(f'<div class="omrade{"" if live else " tomt"}">')
    q.append(f'  <a class="omr-hode" href="{o["id"]}/index.html">')
    if o.get('bilde'): q.append(f'    <img src="../assets/img/tegninger/{o["bilde"]}.webp" alt="" loading="lazy">')
    q.append(f'    <span class="omr-navn">{o["tittel"]}</span>' + ('' if live else '<em class="pill off">kommer</em>') + '</a>')
    q.append(f'  <p class="omr-beskr">{o.get("beskrivelse", "")}</p><ul>')
    for e in o['emner']:
        k = len(sider_per_emne[e['id']])
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
    q = ['---', f'title: "{o["tittel"]}"', f'subtitle: "{o.get("beskrivelse", "")}"', 'toc: false', '---', '']
    for e in o['emner']:
        ss = sider_per_emne[e['id']]
        q.append(f'## [{e["tittel"]}]({e["id"]}.qmd)\n')
        q += [f'- [{s["tittel"]}](../../{s["qmd"]})' for s in ss] if ss else ['*Kommer.*']
        q.append('')
    (UT / o['id'] / 'index.qmd').write_text('\n'.join(q), encoding='utf-8')
    for e in o['emner']:
        ss = sider_per_emne[e['id']]
        q = ['---', f'title: "{e["tittel"]}"', f'subtitle: "{o["tittel"]}"', 'toc: false', '---', '']
        tekst = P / 'emner-tekster' / f'{e["id"]}.md'
        if tekst.exists(): q += [tekst.read_text(encoding='utf-8'), '']
        if ss:
            q.append('::: {.emne-sider}')
            for s in ss:
                lp = ', '.join(f'{L["tittel"]} ({i}/{len(L["sider"])})' for L, i in i_loyper(s['qmd']))
                q.append(f'- [{s["tittel"]}](../../{s["qmd"]})' + (f' []{{.emne-kilde}}' if False else '') + (f' <span class="emne-kilde">{lp}</span>' if lp else ''))
            q += [':::', '']
        else:
            q += ['::: {.callout-note title="Kommer"}', 'Vi har ikke stoff om dette emnet ennå. Har du forelesningsnotater du vil dele? [Donér dem her](https://realfagsambassaden.no/doner.html).', ':::', '']
        (UT / o['id'] / f'{e["id"]}.qmd').write_text('\n'.join(q), encoding='utf-8')

# løyper/index.qmd
LU = P / 'loyper'
q = ['---', 'title: "Løyper"', 'subtitle: "En løype er en vei gjennom emnene for et bestemt kurs. Følg en ferdig løype, eller lag din egen."',
     'toc: false', '---', '', '```{=html}', '<div class="loyper">']
for L in loyper:
    meta = ' · '.join(x for x in (L.get('institusjon'), L.get('emnekode'), f'{len(L["sider"])} sider') if x)
    q.append(f'<a class="loype" href="../{L["oversikt"].replace(".qmd", ".html")}"><span class="status">Løype</span><h3>{L["tittel"]}</h3><p class="loype-meta">{meta}</p><p>{L.get("beskrivelse", "")}</p></a>')
q.append('<a class="loype egen" href="../dekning.html"><span class="status">Lag din egen</span><h3>Har du et annet kurs?</h3><p>Lim inn emnebeskrivelsen, så finner vi sidene som passer og lager en løype for deg.</p></a>')
q += ['</div>', '```', '']
(LU / 'index.qmd').write_text('\n'.join(q), encoding='utf-8')

# loyper.json for forrige/neste og emnelenke
side_info = {}
for sti, eid in side_emne.items():
    o, e = emne_info[eid]
    side_info[html(sti)] = {'emne': e['tittel'], 'emneUrl': f'/emner/{o["id"]}/{e["id"]}.html', 'omrade': o['tittel']}
(P / 'loyper.json').write_text(json.dumps({
    'loyper': [{'id': L['id'], 'tittel': L['tittel'], 'url': html(L['oversikt']),
                'sider': [{'url': html(s['qmd']), 'tittel': s['tittel']} for s in L['sider']]} for L in loyper],
    'sider': side_info}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

# ---- sidemeny (én, etter emner) og toppmeny
sb = ['  sidebar:', '    - id: emner', '      title: "Emner"', '      style: docked', '      collapse-level: 1', '      contents:', '        - emner/index.qmd']
for o in omrader:
    if not antall(o): continue
    sb += [f'        - section: "{o["tittel"]}"', f'          href: emner/{o["id"]}/index.qmd', '          contents:']
    for e in o['emner']:
        ss = sider_per_emne[e['id']]
        if not ss: continue
        sb += [f'            - section: "{e["tittel"]}"', f'              href: emner/{o["id"]}/{e["id"]}.qmd', '              contents:']
        sb += [f'                - {s["qmd"]}' for s in ss]
if uten_emne:
    sb += ['        - section: "Annet"', '          contents:'] + [f'            - {s}' for s, _, _ in uten_emne]
sb += ['        - section: "Løyper"', '          href: loyper/index.qmd', '          contents:']
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

meny = ['    left:', '      - text: Emner', '        menu:', '          - href: emner/index.qmd', '            text: "Alle emner"']
for o in omrader:
    meny += [f'          - href: emner/{o["id"]}/index.qmd', f'            text: "{o["tittel"]}"' + ('' if antall(o) else '')]
meny += ['      - text: Løyper', '        menu:', '          - href: loyper/index.qmd', '            text: "Alle løyper"']
for L in loyper:
    meny += [f'          - href: {L["oversikt"]}', f'            text: "{L["tittel"]}"']
meny += ['          - href: dekning.qmd', '            text: "Lag din egen løype"', '          - text: "---"',
         '          - href: larer/index.qmd', '            text: "For lærere: design din forelesning"']

yml = (P / '_quarto.yml').read_text(encoding='utf-8')
yml = re.sub(r'\n# >>> fag-sidemeny.*?# <<< fag-sidemeny\n', '\n', yml, flags=re.S)
yml = re.sub(r'  sidebar:\n(?:    +.*\n)*', '\n'.join(sb) + '\n', yml, count=1)
yml = re.sub(r'    left:\n(?:      .*\n|        .*\n|          .*\n|            .*\n)*', '\n'.join(meny) + '\n', yml, count=1)
(P / '_quarto.yml').write_text(yml, encoding='utf-8')

n = sum(len(v) for v in sider_per_emne.values())
print(f'emner: {n} sider koblet til {sum(1 for v in sider_per_emne.values() if v)} emner, {len(uten_emne)} uten emne, {len(loyper)} løyper')
