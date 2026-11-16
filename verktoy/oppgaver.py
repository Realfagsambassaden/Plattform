#!/usr/bin/env python3
"""Lager oppgaver.json: alle oppgavene i lærebøkene, med tekst og løsningsforslag.
Studieappen bruker den i «Skann»: studenten velger en oppgave, tar bilde av sin håndskrevne løsning, og KI vurderer
løsningen mot løsningsforslaget. «Skann løsningen»-knappen på oppgavene (assets/js/oppgaver.js) lenker hit med id-en.
id = sidens adresse + '#' + oppgavens nummer på siden (0, 1, 2 …), i samme rekkefølge som div.oppgave på siden.
Bruk: python3 oppgaver.py <quarto-prosjektmappe>"""
import json, re, sys
from pathlib import Path

P = Path(sys.argv[1])
APNE = re.compile(r'^(:{3,})\s*\{(.*)\}\s*$')
LUKK = re.compile(r'^(:{3,})\s*$')


def attr(a, navn):
    m = re.search(navn + r'="([^"]*)"', a)
    return m.group(1) if m else ''


def rens(linjer):
    """Gjør markdown om til lesbar tekst for KI og appen: behold formler og avsnitt, fjern bilder, kode og kommentarer."""
    t = '\n'.join(linjer)
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    t = re.sub(r'```.*?```', '', t, flags=re.S)
    t = re.sub(r'!\[[^\]]*\]\([^)]*\)(\{[^}]*\})?', '', t)          # bilder
    t = re.sub(r'^:{3,}.*$', '', t, flags=re.M)                       # gjenværende div-linjer
    t = re.sub(r'\{\.[^}]*\}', '', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()


def les(fil, url, kilde):
    tekst = fil.read_text(encoding='utf-8')
    fm = re.match(r'^---\n(.*?)\n---\n', tekst, re.S)
    meta = fm.group(1) if fm else ''
    def m(n):
        x = re.search(r'^' + n + r':\s*"?([^"\n]*)"?\s*$', meta, re.M)
        return x.group(1).strip() if x else ''
    side, tema, undertema = m('title') or fil.stem, m('tema'), m('undertema')
    ut, stakk, nr = [], [], 0
    for linje in tekst.split('\n'):
        a = APNE.match(linje)
        if a:
            klasse = a.group(2)
            node = {'farger': len(a.group(1)), 'klasse': klasse, 'linjer': [], 'losning': None}
            if '.oppgave' in re.findall(r'\.[\w-]+', klasse):
                node['oppgave'] = {'nr': nr, 'tittel': attr(klasse, 'tittel'), 'niva': attr(klasse, 'niva')}; nr += 1
            stakk.append(node); continue
        if LUKK.match(linje) and stakk:
            node = stakk.pop()
            if '.losning' in node['klasse'] and stakk:
                stakk[-1]['losning'] = node['linjer']
            elif 'oppgave' in node:
                o = node['oppgave']
                ut.append({'id': f"{url}#{o['nr']}", 'url': url, 'kilde': kilde, 'side': side, 'tema': tema, 'undertema': undertema,
                           'tittel': o['tittel'], 'niva': o['niva'], 'oppgave': rens(node['linjer'])[:2500],
                           'losning': rens(node['losning'] or [])[:3000]})
            if stakk and node.get('oppgave') is None and '.losning' not in node['klasse']:
                stakk[-1]['linjer'] += node['linjer']                  # annet innhold i oppgaven (f.eks. callout) tas med
            continue
        if stakk:
            stakk[-1]['linjer'].append(linje)
    return ut


oppgaver = []
toc_f = P / 'forkurs' / '_innhold.json'
if toc_f.exists():
    for c in json.loads(toc_f.read_text(encoding='utf-8')):
        for s in c['sider']:
            f = P / 'forkurs' / c['dir'] / s['fil']
            if f.exists():
                oppgaver += les(f, f"/forkurs/{c['dir']}/{s['fil'].replace('.qmd', '.html')}", 'Forkurs')
fag_f = P / '_fag.json'
if fag_f.exists():
    for fg in json.loads(fag_f.read_text(encoding='utf-8')):
        for k in fg['kapitler']:
            for s in k['sider']:
                f = P / fg['kortnavn'] / 'kapitler' / k['dir'] / s['fil']
                if f.exists():
                    oppgaver += les(f, f"/{fg['kortnavn']}/kapitler/{k['dir']}/{s['fil'].replace('.qmd', '.html')}", fg['tittel'])
oppgaver = [o for o in oppgaver if o['oppgave']]
(P / 'oppgaver.json').write_text(json.dumps({'oppgaver': oppgaver}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('oppgaver.json:', len(oppgaver), 'oppgaver,', sum(1 for o in oppgaver if o['losning']), 'med løsning')
