#!/usr/bin/env python3
"""Henter inn fag laget fra malen Realfagsambassaden/fag-mal og kobler dem inn i nettstedet.
Bruk: python3 fag.py <prosjektmappe> <nettsted>   (f.eks. fysikkhjelp)
- leser fag.yml i plattformen (liste over repoer, eller «sti:» til en mappe i plattformen)
- henter hvert repo til kilder/<navn> (git clone), med mindre mappen finnes fra før (lokal forhåndsvisning)
- kopierer kapitler/ og bilder/ til <kortnavn>/ og lager en oversiktsside
- legger til sidemeny og menypunkt i _quarto.yml, og skriver _fag.json (brukes av innhold.py)"""
import json, os, re, shutil, subprocess, sys
from pathlib import Path
import yaml
sys.path.insert(0, str(Path(__file__).resolve().parent))
from eksempler import behandle as skjul_eksempellosninger

P = Path(sys.argv[1]).resolve(); NETTSTED = sys.argv[2]
liste = (yaml.safe_load((P / 'fag.yml').read_text(encoding='utf-8')) or {}).get('fag') or []
KILDER = P / 'kilder'; KILDER.mkdir(exist_ok=True)
fag_ut = []

def tittel(f):
    m = re.search(r'^title:\s*"?(.*?)"?\s*$', f.read_text(encoding='utf-8'), re.M)
    return m.group(1) if m else f.stem

for post in liste:
    if post.get('sti'):   # fag som ligger i plattformen selv (f.eks. mens det venter på eget repo)
        repo = post['sti']; mappe = P / post['sti']
        if not mappe.exists(): print('FEIL: finner ikke', mappe); continue
    else:
        repo = post['repo']; navn = repo.split('/')[-1]; mappe = KILDER / navn
    if not mappe.exists():
        r = subprocess.run(['git', 'clone', '--depth', '1', f'https://github.com/{repo}', str(mappe)], capture_output=True, text=True)
        if r.returncode: print('FEIL: fikk ikke hentet', repo, r.stderr[-300:]); continue
    meta = yaml.safe_load((mappe / 'fag.yml').read_text(encoding='utf-8'))
    if meta.get('nettsted') != NETTSTED or meta.get('status', 'skjult') == 'skjult':
        print(f'{repo}: hoppet over ({meta.get("nettsted")}, {meta.get("status")})'); continue
    kort = re.sub(r'[^a-z0-9-]', '', str(meta['kortnavn']).lower())
    if kort in ('forkurs', 'kommer', 'konto', 'assets', 'kilder', 'site_libs'): print('Ugyldig kortnavn', kort); continue
    ut = P / kort
    if ut.exists(): shutil.rmtree(ut)
    shutil.copytree(mappe / 'kapitler', ut / 'kapitler')
    if (mappe / 'bilder').exists(): shutil.copytree(mappe / 'bilder', ut / 'bilder')
    for f in (ut / 'kapitler').rglob('*.qmd'):   # sikkerhetsnett: løsningen i eksempler skjules bak «Vis løsning»
        t = f.read_text(encoding='utf-8'); u = skjul_eksempellosninger(t)
        if u != t: f.write_text(u, encoding='utf-8')
    arbeid = meta.get('status') == 'arbeid'
    banner = '::: {.callout-warning title="Under arbeid"}\nDette faget skrives fortsatt. Innholdet kan endre seg.\n:::\n\n' if arbeid else ''
    kapitler = []
    for kap in sorted(p for p in (ut / 'kapitler').iterdir() if p.is_dir()):
        sider = sorted(f for f in kap.glob('*.qmd') if f.name != 'index.qmd')
        if banner:
            for f in [kap / 'index.qmd', *sider]:
                if f.exists():
                    t = f.read_text(encoding='utf-8')
                    t = re.sub(r'^(---\n.*?\n---\n)', lambda m: m.group(1) + '\n' + banner, t, count=1, flags=re.S)
                    f.write_text(t, encoding='utf-8')
        dl = re.search(r'^del:\s*"?(.*?)"?\s*$', (kap / 'index.qmd').read_text(encoding='utf-8'), re.M) if (kap / 'index.qmd').exists() else None
        kapitler.append({'dir': kap.name, 'tittel': tittel(kap / 'index.qmd') if (kap / 'index.qmd').exists() else kap.name, 'del': dl.group(1) if dl else '',
                         'har_index': (kap / 'index.qmd').exists(), 'sider': [{'fil': s.name, 'tittel': tittel(s)} for s in sider]})
    # oversiktsside
    q = ['---', f'title: "{meta["tittel"]}"', f'subtitle: "{meta.get("beskrivelse", "")}"', 'toc: false', 'page-layout: full', '---', '', banner]
    if meta.get('bilde') and (mappe / meta['bilde']).exists(): q.append(f'![]({meta["bilde"]}){{.kommer-bilde}}\n')
    if meta.get('ansvarlig'): q.append(f'*Ansvarlig: {meta["ansvarlig"]}*\n')
    # PDF-kompendium (fag.yml: pdf: …). Lages hver gang nettsiden bygges; feiler det, bygges nettsiden likevel.
    if meta.get('pdf') and os.environ.get('UTEN_PDF') != '1':
        pdf = P / '_pdf' / f'{kort}.pdf'
        r = subprocess.run([sys.executable, str(Path(__file__).resolve().parent / 'pdf' / 'lag_pdf.py'), str(mappe), str(pdf)], capture_output=True, text=True)
        print(r.stdout[-600:]); 
        if r.returncode == 0 and pdf.exists():
            q.append(f'```{{=html}}\n<p class="pdf-lenke"><a class="btn-chalk sekundar" href="{kort}.pdf" download>⤓ Last ned som PDF</a> <span>Hele faget som kompendium, oppdatert {__import__("datetime").date.today().strftime("%d.%m.%Y")}.</span></p>\n```\n')
        else:
            print('PDF feilet for', kort, r.stderr[-800:])
    # Kapitlene som avrundede bokser, som i forkurset (tegning: i kapitlets index.qmd velger bildet)
    TEGNINGER = ['sau-maling', 'skratt-kast', 'bokser', 'kjelke', 'hockey', 'rakett', 'fotball', 'flaske', 'bernoulli', 'e-felt']
    def tell(f):
        t = f.read_text(encoding='utf-8'); return t.count('{{< video'), len(re.findall(r'\{\.oppgave\b', t))
    tot_v = tot_o = 0; html = []; forrige_del = None; apen = False
    for i, k in enumerate(kapitler, 1):
        kdir = ut / 'kapitler' / k['dir']
        filer = ([kdir / 'index.qmd'] if k['har_index'] else []) + [kdir / s_['fil'] for s_ in k['sider']]
        v = sum(tell(f)[0] for f in filer); o = sum(tell(f)[1] for f in filer); tot_v += v; tot_o += o
        tg = re.search(r'^tegning:\s*"?([\w-]+)"?\s*$', (kdir / 'index.qmd').read_text(encoding='utf-8'), re.M) if k['har_index'] else None
        tegning = tg.group(1) if tg else TEGNINGER[(i - 1) % len(TEGNINGER)]
        if k['del'] and k['del'] != forrige_del:
            if apen: html.append('</div>')
            html.append(f'<h2 class="kap-del">{k["del"]}</h2>\n<div class="kapitler">'); apen = True; forrige_del = k['del']
        elif not apen:
            html.append('<div class="kapitler">'); apen = True
        hode = f'kapitler/{k["dir"]}/index.html' if k['har_index'] else f'kapitler/{k["dir"]}/{k["sider"][0]["fil"].replace(".qmd", ".html")}'
        meta_ = ' · '.join(x for x in [f'{v} video{"er" if v != 1 else ""}' if v else '', f'{o} oppgave{"r" if o != 1 else ""}' if o else ''] if x)
        html += ['<div class="kapittel">',
                 f'  <a class="kap-hode" href="{hode}"><span class="kap-nr">{i}</span><span class="kap-navn">{k["tittel"]}</span></a>',
                 f'  <a href="{hode}" tabindex="-1" aria-hidden="true"><img class="kap-bilde" src="../assets/img/tegninger/{tegning}.webp" alt="" loading="lazy"></a>',
                 f'  <p class="kap-meta">{meta_}</p>' if meta_ else '', '  <ul>']
        html += [f'    <li><a href="kapitler/{k["dir"]}/{s_["fil"].replace(".qmd", ".html")}">{s_["tittel"]}</a></li>' for s_ in k['sider']]
        html += ['  </ul>', '</div>']
    if apen: html.append('</div>')
    q += ['```{=html}', f'<p class="forkurs-tall">→ {len(kapitler)} kapitler, {tot_o} oppgaver, {tot_v} videoer</p>'] + [h for h in html if h] + ['```', '']
    (ut / 'index.qmd').write_text('\n'.join(q), encoding='utf-8')
    fag_ut.append({'kortnavn': kort, 'tittel': meta['tittel'], 'status': meta.get('status'), 'kapitler': kapitler,
                   'beskrivelse': meta.get('beskrivelse', ''), 'bilde': f'{kort}/{meta["bilde"]}' if meta.get('bilde') else None})
    print(f'{repo}: {meta["tittel"]} → /{kort}/ ({sum(len(k["sider"]) for k in kapitler)} sider)')

(P / '_fag.json').write_text(json.dumps(fag_ut, ensure_ascii=False, indent=1), encoding='utf-8')

# sidemeny og menypunkt
yml = (P / '_quarto.yml').read_text(encoding='utf-8')
yml = re.sub(r'\n# >>> fag-sidemeny.*?# <<< fag-sidemeny\n', '\n', yml, flags=re.S)
yml = re.sub(r'      # >>> fag-meny\n.*?      # <<< fag-meny\n', '', yml, flags=re.S)
if fag_ut:
    sb = ['# >>> fag-sidemeny (lages av verktoy/fag.py)']
    for f in fag_ut:
        sb += [f'    - id: {f["kortnavn"]}', f'      title: "{f["tittel"]}"', '      style: docked', '      collapse-level: 1',
               '      contents:', f'        - {f["kortnavn"]}/index.qmd']
        for k in f['kapitler']:
            sb.append(f'        - section: "{k["tittel"]}"')
            if k['har_index']: sb.append(f'          href: {f["kortnavn"]}/kapitler/{k["dir"]}/index.qmd')
            sb.append('          contents:')
            sb += [f'            - {f["kortnavn"]}/kapitler/{k["dir"]}/{s["fil"]}' for s in k['sider']] or ['            []']
    sb.append('# <<< fag-sidemeny')
    yml = re.sub(r'(  sidebar:\n(?:    .*\n|      .*\n|        .*\n|          .*\n|            .*\n)*)', lambda m: m.group(1) + '\n'.join(sb) + '\n', yml, count=1)
    meny = []  # menyen bygges nå av emner.py
    _ = ['      # >>> fag-meny'] + [x for f in fag_ut for x in (f'      - href: {f["kortnavn"]}/index.qmd', f'        text: "{f["tittel"]}"')] + ['      # <<< fag-meny']
(P / '_quarto.yml').write_text(yml, encoding='utf-8')
print('fag:', len(fag_ut))
