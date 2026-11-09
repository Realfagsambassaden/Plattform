#!/usr/bin/env python3
"""Holder orden på hvilke filer som er sjekket mot notasjonsreglene (NOTASJON.md).

Bruk (fra mappen der repoene er klonet ved siden av hverandre, f.eks. plattform/, ingeniorfysikk/, fysikk-forkurs/, videoer/):
  python3 plattform/verktoy/notasjon_status.py liste            # usjekkede filer, eldste først
  python3 plattform/verktoy/notasjon_status.py merk <nøkkel> …   # merk filer som sjekket mot gjeldende versjon

Nøkkelen er «<repomappe>/<sti>», f.eks. «ingeniorfysikk/kapitler/02-kinematikk/03-skratt-kast.qmd».
Kør `merk` etter at rettelsene er gjort (og helst flettet), slik at blob-en som lagres er den rettede.

En fil er usjekket når den mangler i statusfila, er sjekket mot en eldre versjon av reglene,
eller innholdet (git-blob) har endret seg siden sjekken. Statusfila er plattform/rutiner/notasjon-status.yml.
"""
import datetime, re, subprocess, sys
from pathlib import Path
import yaml

ROT = Path.cwd()
P = ROT / 'plattform'
if not P.exists():
    sys.exit('Fant ikke plattform/ her. Kjør fra mappen der repoene er klonet.')
VERSJON = int(re.search(r'\*\*Versjon:\s*(\d+)\*\*', (P / 'NOTASJON.md').read_text(encoding='utf-8')).group(1))
STATUS = P / 'rutiner' / 'notasjon-status.yml'


def fagrepoer():
    navn = set()
    for fy in (P / 'fag.yml', P / 'matematikkhjelp' / 'fag.yml'):
        if fy.exists():
            for f in (yaml.safe_load(fy.read_text(encoding='utf-8')) or {}).get('fag') or []:
                navn.add(f['repo'].split('/')[-1].lower())
    navn.add('fysikk-forkurs')
    return sorted(navn)


def filer():
    """Alt fagstoff som reglene gjelder: sider, tematekster og videomanus (i repoet videoer)."""
    ut, mangler = [], []
    for r in fagrepoer():
        d = ROT / r
        if not d.exists():
            mangler.append(r); continue
        ut += sorted(d.glob('kapitler/*/*.qmd'))
    ut += sorted(P.glob('tema-tekster/*.md')) + sorted(P.glob('matematikkhjelp/tema-tekster/*.md'))
    v = ROT / 'videoer'                       # videomanus: videoer/<fag>/<mappe>/manus.md
    if v.exists():
        ut += sorted(v.glob('*/*/manus.md'))
    else:
        mangler.append('videoer')
    return ut, mangler


def blob(f):
    return subprocess.run(['git', 'hash-object', str(f)], capture_output=True, text=True, check=True).stdout.strip()


def last():
    if STATUS.exists():
        return yaml.safe_load(STATUS.read_text(encoding='utf-8')) or {}
    return {}


def lagre(s):
    s['versjon'] = VERSJON
    hode = ('# Hvilke filer som er sjekket mot notasjonsreglene (NOTASJON.md).\n'
            '# Oppdateres av verktoy/notasjon_status.py – ikke rediger for hånd.\n')
    STATUS.write_text(hode + yaml.safe_dump(s, allow_unicode=True, sort_keys=True), encoding='utf-8')


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'liste'
    s = last(); s.setdefault('filer', {})
    if cmd == 'liste':
        fs, mangler = filer()
        if mangler:
            print('ADVARSEL: ikke klonet:', ', '.join(mangler), file=sys.stderr)
        usjekket = []
        for f in fs:
            k = str(f.relative_to(ROT)); e = s['filer'].get(k)
            if not e: grunn = 'ny'
            elif e.get('versjon', 0) < VERSJON: grunn = f"versjon {e.get('versjon')}"
            elif e.get('blob') != blob(f): grunn = 'endret'
            else: continue
            usjekket.append((e.get('dato', '0000') if e else '0000', k, grunn))
        for _, k, g in sorted(usjekket):
            print(f'{k}\t{g}')
        print(f'# {len(usjekket)} usjekket av {len(fs)} (regler versjon {VERSJON})', file=sys.stderr)
    elif cmd == 'merk':
        idag = datetime.date.today().isoformat()
        for k in sys.argv[2:]:
            f = ROT / k
            if not f.exists(): sys.exit(f'Finnes ikke: {k}')
            s['filer'][k] = {'versjon': VERSJON, 'blob': blob(f), 'dato': idag}
        lagre(s)
        print(f'merket {len(sys.argv) - 2} fil(er) som sjekket mot versjon {VERSJON}')
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
