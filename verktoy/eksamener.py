#!/usr/bin/env python3
"""Eksamensoppgavene til eksamenstreningen (hint-tjener/eksamen.js), fra det private repoet Realfagsambassaden/eksamener.

Kjør: python3 verktoy/eksamener.py <eksamener-repoet> <Plattform-mappa>
Skriver
  - hint-tjener/eksamener.json        alle overførte eksamener (med fasit og løsning; bygges inn i KI-tjeneren og sendes
                                      aldri til nettleseren før studenten har svart)
  - hint-tjener/statisk/eksamen/<id>/ figurene (offentlige, vises i eksamensmodus)
Finnes ikke repoet (mangler tilgang), skrives en tom liste, og eksamenstreningen sier at oppgavene ikke er lagt inn ennå.
«samme_som: <id>#<nr>» hentes fra den andre eksamenen. Foreløpig tas bare flervalgsoppgaver med (alternativer + riktig).
"""
import json, shutil, sys
from pathlib import Path
import yaml

KILDE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('../eksamener')
ROT = Path(sys.argv[2] if len(sys.argv) > 2 else '.').resolve()
UT = ROT / 'hint-tjener' / 'eksamener.json'
FIG = ROT / 'hint-tjener' / 'statisk' / 'eksamen'


def main():
    eksamener = {}
    if KILDE.is_dir():
        for f in sorted(KILDE.glob('*/eksamen.yml')):
            try:
                eksamener[f.parent.name] = (f.parent, yaml.safe_load(f.read_text(encoding='utf-8')))
            except Exception as e:
                print(f'eksamener: hopper over {f}: {e}')
    ut = []
    for mappe, (sti, e) in eksamener.items():
        eid = e.get('id') or mappe
        oppg = []
        for o in e.get('oppgaver') or []:
            if o.get('samme_som'):
                aid, nr = str(o['samme_som']).split('#')
                kilde = next((x for m, (_, a) in eksamener.items() if (a.get('id') or m) == aid for x in a.get('oppgaver') or [] if x.get('nr') == int(nr)), None)
                if not kilde:
                    continue
                kilde_mappe = next(m for m, (_, a) in eksamener.items() if (a.get('id') or m) == aid)
                o = {**kilde, 'nr': o['nr'], '_figurfra': kilde_mappe}
            # utelat: true – oppgaven har en feil som gjør den ubrukelig (f.eks. ingen riktige alternativer).
            if o.get('utelat') or not o.get('alternativer') or not o.get('riktig'):
                continue
            figur = ''
            if o.get('figur'):
                fra = KILDE / o.get('_figurfra', mappe) / o['figur']
                if fra.exists():
                    figur = f"figurer/{o.get('_figurfra', mappe)}-{Path(o['figur']).name}"
                    (FIG / eid / 'figurer').mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(fra, FIG / eid / figur)
            oppg.append({k: v for k, v in {'nr': o['nr'], 'tema': o.get('tema', ''), 'tekst': str(o.get('tekst', '')).strip(),
                         'alternativer': [str(a) for a in o['alternativer']], 'riktig': int(o['riktig']),
                         'losning': str(o.get('losning', '')).strip(), 'figur': figur, 'gruppe': o.get('gruppe', ''),
                         # merknad: vises for studenten før svaret, f.eks. om en feil i oppgaveteksten på den originale eksamenen.
                         'merknad': str(o.get('merknad', '')).strip()}.items() if v != ''})
        if oppg:
            ut.append({'id': eid, 'emne': e.get('emne', ''), 'tittel': e.get('tittel', eid), 'dato': str(e.get('dato', '')), 'oppgaver': oppg})
    UT.write_text(json.dumps({'eksamener': ut}, ensure_ascii=False), encoding='utf-8')
    print(f"eksamener: {len(ut)} eksamener, {sum(len(x['oppgaver']) for x in ut)} oppgaver")


if __name__ == '__main__':
    main()
