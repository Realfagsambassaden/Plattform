#!/usr/bin/env python3
"""Lager et PDF-kompendium av et fag (samme innhold som nettsidene).

Bruk:  python3 lag_pdf.py <fagrepo-mappe> <ut.pdf>

Fagets fag.yml kan ha:
  pdf:
    undertittel: "Mekanikk"
    linje: "IFYA1000 · IFYT1000 · IFYG1000 · IFYG1002"

Slik blir nettsidene til papir:
  - hvert kapittel (kapitler/NN-*/) blir et kapittel, hver side en seksjon
  - eksempler får løsningen rett under (som i et vanlig kompendium)
  - løsningene på oppgavene samles i «Løsningsforslag» bakerst i kapitlet
  - videoer blir QR-kode og lenke; kjørbar Python blir vanlig kode
  - TikZ-figurene (figurer/*.tex) settes inn som vektorgrafikk
Krever Quarto og xelatex (+ pdflatex for figurene)."""
import datetime, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
import yaml

HER = Path(__file__).resolve().parent
PLATTFORM = HER.parent.parent
QUARTO = os.environ.get('QUARTO', 'quarto')
MANED = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']


def frontmatter(t):
    m = re.match(r'^---\n(.*?)\n---\n', t, re.S)
    return (yaml.safe_load(m.group(1)) or {}, t[m.end():]) if m else ({}, t)


def finn_div(linjer, i):
    """Indeks til linja som lukker diven som åpnes på linje i."""
    dybde = 0; imatte = False; ikode = False
    for j in range(i, len(linjer)):
        s = linjer[j].strip()
        if s.startswith('```'): ikode = not ikode; continue
        if ikode: continue
        if s.count('$$') % 2: imatte = not imatte
        if imatte: continue
        if re.match(r'^:{3,}\s*\S', s): dybde += 1
        elif re.match(r'^:{3,}\s*$', s):
            dybde -= 1
            if dybde == 0: return j
    return len(linjer) - 1


def figur(m, figurer):
    navn, stil = m.group(1), m.group(2) or ''
    px = re.search(r'width:\s*(\d+)px', stil)
    bredde = min(12.0, int(px.group(1)) * 0.022) if px else 8.0
    pdf = figurer.get(navn)
    if not pdf: return f'*[Figur: {navn}]*'
    return f'![]({pdf}){{width={bredde:.1f}cm fig-align="center"}}'


def andre_bilder(t, sidemappe, td):
    """Bilder som ikke er TikZ-figurer fra figurer/: PNG/JPG brukes direkte, SVG gjøres om til PDF
    (rsvg-convert), WebP til PNG. «Video kommer»-plassholdere tas bort."""
    t = re.sub(r'^!\[Video kommer\]\([^)]*\)(\{[^}]*\})?\s*$', '', t, flags=re.M)
    def bytt(m):
        sti, stil = m.group(2), m.group(3) or ''
        if sti.startswith(('figurer/', 'http')) or sidemappe is None: return m.group(0)
        fil = (sidemappe / sti).resolve()
        if not fil.exists(): return '*[Figur]*'
        px = re.search(r'width:\s*(\d+)px', stil)
        bredde = f'{{width={min(12.0, int(px.group(1)) * 0.022):.1f}cm fig-align="center"}}' if px else '{width=8.0cm fig-align="center"}'
        ut = td / 'bilder'; ut.mkdir(exist_ok=True)
        if fil.suffix == '.svg':
            if not shutil.which('rsvg-convert'): return '*[Figur]*'
            mål = ut / (fil.parent.name + '-' + fil.stem + '.pdf')
            if not mål.exists():
                r = subprocess.run(['rsvg-convert', '-f', 'pdf', '-o', str(mål), str(fil)], capture_output=True)
                if r.returncode: return '*[Figur]*'
        elif fil.suffix.lower() in ('.webp', '.png', '.jpg', '.jpeg'):
            # Lagres på nytt som enkel PNG: xelatex klarer ikke alle PNG-varianter
            from PIL import Image
            mål = ut / (fil.parent.name + '-' + fil.stem + '.png')
            if not mål.exists():
                bilde = Image.open(fil)
                if bilde.mode not in ('RGB', 'RGBA', 'L'): bilde = bilde.convert('RGBA')
                bilde.save(mål)
        elif fil.suffix.lower() == '.pdf':
            mål = fil
        else:
            return '*[Figur]*'
        rel = mål.relative_to(td) if str(mål).startswith(str(td)) else mål
        return f'![{m.group(1)}]({rel}){bredde}'
    return re.sub(r'!\[([^\]]*)\]\(([^)\s]+)\)(\{[^}]*\})?', bytt, t)


def side_til_md(tekst, kap, teller, losninger, figurer, sidemappe=None, td=None):
    t = re.sub(r'```\{=html\}.*?```', '', tekst, flags=re.S)
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    t = re.sub(r'\{\{<\s*video\s+(\S+)\s*>\}\}', lambda m: '```{=latex}\n\\videoqr{' + m.group(1) + '}\n```', t)
    # Callout-bokser blir egne bokser (Quarto sine krever ekstra pakker)
    t = re.sub(r'^(:{3,})\s*\{\.callout-(\w+)([^}]*)\}', lambda m: f'{m.group(1)} {{.merk type="{m.group(2)}"{m.group(3)}}}', t, flags=re.M)
    t = t.replace('{.python .kjor}', '{.python}').replace('{.text .utskrift}', '{.text}')
    t = re.sub(r'!\[[^\]]*\]\((?:\.\./)*bilder/([\w-]+)\.svg\)(\{[^}]*\})?', lambda m: figur(m, figurer), t)
    if td is not None: t = andre_bilder(t, sidemappe, td)
    t = re.sub(r'^(#{2,5}) ', lambda m: '#' * (len(m.group(1)) + 1) + ' ', t, flags=re.M)   # ## -> ### (siden selv er ##)
    # Oppgaver: nummerer, og flytt løsningen bakerst i kapitlet
    linjer = t.split('\n'); ut = []; i = 0
    while i < len(linjer):
        m = re.match(r'^(:{3,})\s*\{\.oppgave\b(.*)\}\s*$', linjer[i].strip())
        if m:
            slutt = finn_div(linjer, i)
            teller[0] += 1; nr = f'{kap}.{teller[0]}'
            attr = m.group(2)
            tittel = re.search(r'tittel="([^"]*)"', attr)
            kropp = linjer[i + 1:slutt]
            # .losning inne i oppgaven
            for k, l in enumerate(kropp):
                if re.match(r'^:{3,}\s*\{\.losning\}', l.strip()):
                    s2 = finn_div(kropp, k)
                    losninger.append((nr, tittel.group(1) if tittel else '', '\n'.join(kropp[k + 1:s2])))
                    kropp = kropp[:k] + kropp[s2 + 1:]
                    break
            ut.append(f'{m.group(1)} {{.oppgave nr="{nr}"{attr}}}')
            ut.extend(kropp); ut.append(linjer[slutt]); i = slutt + 1
        else:
            ut.append(linjer[i]); i += 1
    return '\n'.join(ut)


def lag_figurer(repo, mappe):
    """Kompilerer figurer/*.tex til PDF med fagets egen mal."""
    fig = repo / 'figurer'; ut = {}
    if not (fig / '_mal.tex').exists(): return ut
    mal = (fig / '_mal.tex').read_text(encoding='utf-8')
    for f in sorted(fig.glob('*.tex')):
        if f.name.startswith('_'): continue
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / 'f.tex').write_text(mal.replace('%BODY%', f.read_text(encoding='utf-8')), encoding='utf-8')
            r = subprocess.run(['pdflatex', '-interaction=nonstopmode', '-halt-on-error', 'f.tex'], cwd=td, capture_output=True, text=True)
            if r.returncode: print('  figur feilet:', f.name); continue
            shutil.copy(Path(td) / 'f.pdf', mappe / f'{f.stem}.pdf'); ut[f.stem] = f'figurer/{f.stem}.pdf'
    return ut


def main():
    repo = Path(sys.argv[1]).resolve(); utfil = Path(sys.argv[2]).resolve()
    meta = yaml.safe_load((repo / 'fag.yml').read_text(encoding='utf-8'))
    pdfmeta = meta.get('pdf') or {}
    idag = datetime.date.today()
    utfil.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        td = Path(td); (td / 'figurer').mkdir()
        figurer = lag_figurer(repo, td / 'figurer')
        deler = []
        kapitler = sorted(p for p in (repo / 'kapitler').iterdir() if p.is_dir())
        for kn, kap in enumerate(kapitler, 1):
            fm, kropp = frontmatter((kap / 'index.qmd').read_text(encoding='utf-8')) if (kap / 'index.qmd').exists() else ({}, '')
            teller = [0]; losninger = []
            deler.append(f'# {fm.get("title", kap.name)}\n')
            deler.append(side_til_md(kropp, kn, teller, losninger, figurer, kap, td))
            for side in sorted(f for f in kap.glob('*.qmd') if f.name != 'index.qmd'):
                sfm, skropp = frontmatter(side.read_text(encoding='utf-8'))
                deler.append(f'\n## {sfm.get("title", side.stem)}\n')
                deler.append(side_til_md(skropp, kn, teller, losninger, figurer, kap, td))
            if losninger:
                deler.append('\n## Løsningsforslag {.unnumbered}\n')
                for nr, tt, los in losninger:
                    deler.append(f'\n**Oppgave {nr}{": " + tt if tt else ""}**\n\n{los}\n')
        md = '\n'.join(deler)
        oppsett = (HER / 'oppsett.tex').read_text(encoding='utf-8').replace('FONTSTI', str(HER / 'fonter')).replace('FAGTITTEL', meta['tittel']) + '\n\\AtBeginDocument{\\hypersetup{pdftitle={' + meta['tittel'] + '}, pdfauthor={fysikkhjelp.no}}}\n'
        forside = (HER / 'forside.tex').read_text(encoding='utf-8')
        for a, b in [('UNDERTITTEL', pdfmeta.get('undertittel', '')), ('TITTEL', meta['tittel']), ('LINJE', pdfmeta.get('linje', '')),
                     ('UTGAVE', f'utgave {MANED[idag.month - 1]} {idag.year}'), ('BILDESTI', str(HER / 'bilder'))]:
            forside = forside.replace(a, b)
        (td / 'oppsett.tex').write_text(oppsett, encoding='utf-8')
        (td / 'forside.tex').write_text(forside, encoding='utf-8')
        shutil.copy(HER / 'pdf.lua', td / 'pdf.lua')
        hode = {
            'pagetitle': meta['tittel'], 'lang': 'nb', 'documentclass': 'scrreprt', 'classoption': ['a4paper', '11pt', 'oneside', 'chapterprefix=true'],
            'toc': True, 'toc-title': 'Innhold', 'toc-depth': 1, 'number-sections': True, 'top-level-division': 'chapter',
            'geometry': ['top=2.4cm', 'bottom=2.6cm', 'left=2.4cm', 'right=2.4cm'],
            'format': {'pdf': {'pdf-engine': 'xelatex', 'include-in-header': 'oppsett.tex', 'include-before-body': 'forside.tex',
                               'filters': ['pdf.lua'], 'highlight-style': 'github', 'keep-tex': True, 'colorlinks': True,
                               'linkcolor': 'headCol', 'urlcolor': 'oppgcol', 'template-partials': []}},
        }
        del hode['format']['pdf']['template-partials']
        q = '---\n' + yaml.safe_dump(hode, allow_unicode=True, sort_keys=False) + '---\n\n' + md
        (td / 'kompendium.qmd').write_text(q, encoding='utf-8')
        r = subprocess.run([QUARTO, 'render', 'kompendium.qmd', '--to', 'pdf'], cwd=td, capture_output=True, text=True)
        if r.returncode or not (td / 'kompendium.pdf').exists():
            print(r.stdout[-3000:], r.stderr[-3000:]); shutil.copy(td / 'kompendium.qmd', utfil.with_suffix('.qmd'))
            if (td / 'kompendium.tex').exists(): shutil.copy(td / 'kompendium.tex', utfil.with_suffix('.tex'))
            sys.exit(1)
        utfil.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(td / 'kompendium.pdf', utfil)
        if os.environ.get('BEHOLD_TEX'): shutil.copy(td / 'kompendium.tex', utfil.with_suffix('.tex'))
        mangler = sorted(set(re.findall(r'Missing character: There is no (\S+)', r.stderr + r.stdout)))
        if mangler: print('  tegn som mangler i skrifta:', ' '.join(mangler))
        print('PDF:', utfil)


if __name__ == '__main__':
    main()
