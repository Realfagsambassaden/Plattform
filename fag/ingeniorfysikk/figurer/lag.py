#!/usr/bin/env python3
"""Tegner figurene: hver .tex her (unntatt _mal.tex) kompileres til ../bilder/<navn>.svg.
Svart strek på hvit bakgrunn – nettsiden inverterer til kritt på tavla (klassen .tikz-fig)."""
import subprocess, tempfile, shutil, sys
from pathlib import Path
H = Path(__file__).resolve().parent; mal = (H / '_mal.tex').read_text(encoding='utf-8')
for f in sorted(H.glob('*.tex')):
    if f.name.startswith('_'): continue
    with tempfile.TemporaryDirectory() as td:
        (Path(td) / 'f.tex').write_text(mal.replace('%BODY%', f.read_text(encoding='utf-8')), encoding='utf-8')
        r = subprocess.run(['pdflatex', '-interaction=nonstopmode', '-halt-on-error', 'f.tex'], cwd=td, capture_output=True, text=True)
        if r.returncode: print('FEIL', f.name, [l for l in r.stdout.split('\n') if l.startswith('!')][:2]); continue
        subprocess.run(['pdftocairo', '-svg', 'f.pdf', str(H.parent / 'bilder' / (f.stem + '.svg'))], cwd=td, check=True)
        print('ok', f.stem)
