#!/usr/bin/env python3
"""Lager innhold.json: en oversikt over alt stoffet på nettsiden (sider, overskrifter, definisjoner, oppgaver).
Brukes av dekningssjekken («Dekker vi faget ditt?»), som sammenligner en emnebeskrivelse med denne oversikten.
Bruk: python3 innhold.py <quarto-prosjektmappe>"""
import json, re, sys
from pathlib import Path

P = Path(sys.argv[1])
sider = []

def les_side(fil, url, del_, kapittel):
    t = fil.read_text(encoding='utf-8')
    m = re.search(r'^title:\s*"(.*)"', t, re.M)
    tittel = m.group(1) if m else fil.stem
    emner = []
    for h in re.findall(r'^#{2,4} (.+)$', t, re.M):
        h = re.sub(r'\{.*?\}', '', h).strip()
        if h and h not in emner and h.lower() not in ('innhold', 'oppgaver'):
            emner.append(h)
    defs = [re.sub(r'^Definisjon:\s*', '', d) for d in re.findall(r'title="Definisjon: ([^"]+)"', t)]
    oppg = re.findall(r'\{\.oppgave tittel="([^"]*)"', t)
    return {
        'url': url, 'del': del_, 'kapittel': kapittel, 'tittel': tittel,
        'emner': emner[:25], 'definisjoner': defs[:25], 'oppgaver': [o for o in oppg if o][:25],
        'antall_oppgaver': t.count('{.oppgave'), 'video': '{{< video' in t,
    }

# Forkurs (fra kompendiet)
toc_f = P / 'forkurs' / '_innhold.json'
if toc_f.exists():
    for c in json.loads(toc_f.read_text(encoding='utf-8')):
        kap = f"{c['nr']}. {c['tittel']}" + ('' if c['status'] == 'klar' else ' (under arbeid)')
        for s in c['sider']:
            f = P / 'forkurs' / c['dir'] / s['fil']
            sider.append(les_side(f, f"/forkurs/{c['dir']}/{s['fil'].replace('.qmd', '.html')}", 'Forkurs', kap))

# Senere: flere deler (ingeniørfysikk, matematikk, …) legges til her på samme måte.

(P / 'innhold.json').write_text(json.dumps({'sider': sider}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('innhold.json:', len(sider), 'sider')
