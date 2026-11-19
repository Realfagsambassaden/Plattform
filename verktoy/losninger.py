#!/usr/bin/env python3
"""Samler løsningsforslagene til lærebokoppgavene fra det private repoet (eksamener/losninger/**.yml) til
hint-tjener/losninger.json, som bakes inn i hint-tjeneren ved publisering. De publiseres aldri på nettsidene.
Hint-KI-en og Dashman bruker dem (uten å vise dem), og lærere kan se dem på oppgavene (/losning).
Bruk: python3 verktoy/losninger.py <eksamener-repo> <plattform>"""
import json, sys
from pathlib import Path
import yaml

kilde, plattform = Path(sys.argv[1]), Path(sys.argv[2])
ut = {}
for f in sorted((kilde / 'losninger').rglob('*.yml')):
    d = yaml.safe_load(f.read_text(encoding='utf-8')) or {}
    for o in d.get('oppgaver') or []:
        if o.get('id') and o.get('losning'):
            ut[o['id']] = str(o['losning']).strip()
(plattform / 'hint-tjener' / 'losninger.json').write_text(json.dumps(ut, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('losninger.json:', len(ut), 'løsningsforslag')
