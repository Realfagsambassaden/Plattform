#!/usr/bin/env python3
"""Lager løypekortene på forsiden automatisk, ett kort per publisert fag.
Bruk: python3 forside.py <prosjektmappe>   (kjøres av bygg.sh etter fag.py)

- leser _fag.json (fra fag.py): fagene som faktisk publiseres (status arbeid eller klar)
- leser fag.yml i plattformen for valgfrie felt per fag:
      tegning: hallo            # bilde fra assets/img/tegninger/ (uten .webp)
      kort: "Tekst på kortet"   # ellers brukes beskrivelsen fra fagets egen fag.yml
- skriver kortene inn i index.qmd mellom <!-- >>> lopekort --> og <!-- <<< lopekort -->
Kort som ikke er fag (Forkurs TRES0312, «kommer»-kort, Alle emner, Lag din egen løype) står fast i index.qmd."""
import html, json, re, sys
from pathlib import Path
import yaml

P = Path(sys.argv[1]).resolve()
indeks = P / 'index.qmd'
fag_f = P / '_fag.json'
if not indeks.exists() or not fag_f.exists():
    sys.exit(0)

fag = json.loads(fag_f.read_text(encoding='utf-8'))
oppsett = {}
for post in (yaml.safe_load((P / 'fag.yml').read_text(encoding='utf-8')) or {}).get('fag') or []:
    navn = (post.get('repo') or post.get('sti') or '').rstrip('/').split('/')[-1]
    oppsett[navn] = post

RESERVE = ['hallo', 'sau-maling', 'bokser', 'kjelke', 'hockey', 'rakett', 'fotball', 'flaske', 'bernoulli', 'e-felt']
tegninger = P / 'assets' / 'img' / 'tegninger'
kort = []
for i, f in enumerate(fag):
    o = oppsett.get(f.get('repo_navn', ''), {})
    t = o.get('tegning') or f.get('tegning')
    if t and (tegninger / f'{t}.webp').exists():
        bilde = f'assets/img/tegninger/{t}.webp'
    elif f.get('bilde') and (P / f['bilde']).exists():
        bilde = f['bilde']
    else:
        bilde = f'assets/img/tegninger/{RESERVE[i % len(RESERVE)]}.webp'
    status = 'Løype · under arbeid' if f.get('status') == 'arbeid' else 'Løype'
    tekst = o.get('kort') or f.get('beskrivelse', '')
    kort += [f'  <a class="track live" href="{f["kortnavn"]}/index.html">',
             f'    <img class="track-bilde" src="{bilde}" alt="" loading="lazy">',
             f'    <span class="status">{status}</span>',
             f'    <h3>{html.escape(f["tittel"])}</h3>',
             f'    <p>{html.escape(tekst)}</p>',
             '  </a>']

t = indeks.read_text(encoding='utf-8')
ny, n = re.subn(r'(<!-- >>> lopekort[^\n]*-->\n).*?([ \t]*<!-- <<< lopekort -->)',
                lambda m: m.group(1) + ''.join(k + '\n' for k in kort) + m.group(2), t, count=1, flags=re.S)
if n:
    indeks.write_text(ny, encoding='utf-8')
    print('forside:', len(fag), 'løypekort')
else:
    print('forside: fant ikke <!-- >>> lopekort --> i', indeks)
