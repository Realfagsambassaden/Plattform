#!/usr/bin/env python3
"""Samlekortene og profilsidene til ambassadørene, laget fra ambassaden/ambassadorer.yml.

Kjør: python3 verktoy/samlekort.py <Plattform-mappa>
Skriver
  - ambassaden/public/index.html  (mellom <!-- >>> samlekort --> og <!-- <<< samlekort -->)
  - ambassaden/public/profil/<id>.html  (én side per ambassadør)
  - index.qmd og om.qmd på fysikkhjelp.no (mellom de samme merkene), for dem med fysikkhjelp under nettsteder.
Kortet viser bilde, rolle og «skårer» som på et fotballkort (utdanning, erfaring, kvalitet, fun fact, koffein).
All tekst om personen står på profilsiden.
"""
import html, re, sys
from pathlib import Path
import yaml

ROT = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
AMB = ROT / 'ambassaden' / 'public'
AMB_URL = 'https://realfagsambassaden.no/'
UKJENT = '???'


def e(x):
    return html.escape(str(x), quote=True)


def kopper(n, te=False, energi=0, piller=0, ekstra=None, egen_tittel=None):
    """Koffein som rekker av kopper (☕), te (🍵) og energidrikk (🥫). Mer enn 10 til sammen sprenger skalaen:
    rekka renner ut av kortet."""
    try:
        n = float(n)
    except (TypeError, ValueError):
        return f'<em class="sk-ukjent">{UKJENT}</em>'
    energi, piller = int(energi or 0), int(piller or 0)
    rekke = '☕' * int(round(n)) + ('🍵🍵' if te else '') + '🥫' * energi + '💊' * piller
    # ekstra: [[kaffe|energidrikk|koffeinpiller, antall], …] legges til etter resten, i rekkefølge
    TEGN = {'kaffe': '☕', 'energidrikk': '🥫', 'koffeinpiller': '💊', 'te': '🍵'}
    for hva, ant in (ekstra or []):
        rekke += TEGN.get(hva, '☕') * int(ant)
        if hva == 'kaffe': n += int(ant)
        elif hva == 'energidrikk': energi += int(ant)
        else: piller += int(ant)
    tittel = f'{int(n) if n == int(n) else n} kopper kaffe om dagen' + (' + masse te' if te else '') + (f' + {energi} energidrikker' if energi else '') + (f' + {piller} koffeinpiller' if piller else '')
    if egen_tittel:
        tittel = e(egen_tittel)
    if n + energi + piller > 10:
        return f'<em class="sk-kopper sk-sprenger" title="{tittel}">{rekke}</em>'
    return f'<em class="sk-kopper" title="{tittel}">{rekke}</em>'


FILTER = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="sk-ru" x="-6%" y="-6%" width="112%" height="112%">'
          '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" result="n"/>'
          '<feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" result="d"/>'
          '<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="2" result="k"/>'
          '<feColorMatrix in="k" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 1.45" result="h"/>'
          '<feComposite in="d" in2="h" operator="in"/></filter></svg>')

def soyle(verdi, maks, tekst):
    if verdi in (None, ''):
        return f'<em class="sk-ukjent">{UKJENT}</em>'
    v = max(0, min(100, round(float(verdi) / maks * 100)))
    return f'<span class="sk-soyle" style="--v:{v}%"><i></i></span><small>{e(tekst)}</small>'


def ord_(x):
    return f'<em>{e(x)}</em>' if x not in (None, '') else f'<em class="sk-ukjent">{UKJENT}</em>'


def kort(p, nr, bilder, href, h='h3'):
    tag, lenke = ('a', f' href="{href}" aria-label="Les om {e(p["navn"])}"') if href else ('div', '')
    ar = p.get('erfaring_ar')
    stats = [
        ('🎓', 'Utdanning', soyle(p.get('utdanning'), 100, p.get('utdanning_tekst') or p.get('utdanning') or '')),
        ('⏳', 'Erfaring', soyle(ar, 20, f'{ar} år' if ar not in (None, '') else '')),
        ('⭐', 'Kvalitet', ord_(p.get('kvalitet'))),
        ('🤪', 'Fun fact', ord_(p.get('funfact'))),
        ('☕', 'Koffein', kopper(p.get('koffein'), p.get('te'), p.get('energidrikk'), p.get('koffeinpiller'), p.get('ekstra_koffein'), p.get('koffein_tittel'))),
    ]
    rader = ''.join(f'<span class="sk-stat"><b><span aria-hidden="true">{ik}</span>{n}</b><span class="sk-verdi">{v}</span></span>' for ik, n, v in stats)
    logo = f'<img class="sk-logo" src="{bilder}{e(p["ikon"])}" alt="">' if p.get('ikon') else ''
    spr = ' data-sprenger' if isinstance(p.get('koffein'), (int, float)) and p['koffein'] + int(p.get('energidrikk') or 0) + int(p.get('koffeinpiller') or 0) + sum(int(a) for _, a in (p.get('ekstra_koffein') or [])) > 10 else ''
    return (f'<article class="samlekort" data-farge="{e(p.get("farge", "gronn"))}" id="{e(p["id"])}"{spr}>'
            f'<{tag} class="sk-inni"{lenke}><span class="sk-flate">'
            f'<span class="sk-topp"><{h} class="sk-navn">{e(p["navn"])}</{h}>{logo}</span>'
            f'<span class="sk-bilde"><img src="{bilder}{e(p["foto"])}" alt="Portrett av {e(p.get("fullt_navn") or p["navn"])}"></span>'
            f'<span class="sk-rolle">{e(p.get("rolle", ""))}</span>'
            f'<span class="sk-stats">{rader}</span>'
            f'<span class="sk-bunn"><span class="sk-tilbud">{"Les mer →" if href else ""}</span><span class="sk-nr">#{nr:03d}</span></span>'
            f'</span><span class="sk-glans" aria-hidden="true"></span></{tag}></article>')


def bytt(fil, innhold):
    t = fil.read_text(encoding='utf-8')
    ny, n = re.subn(r'(<!-- >>> samlekort[^\n]*-->\n).*?([ \t]*<!-- <<< samlekort -->)',
                    lambda m: m.group(1) + innhold + '\n' + m.group(2), t, count=1, flags=re.S)
    if n != 1:
        sys.exit(f'Fant ikke samlekort-merkene i {fil}')
    if ny != t:
        fil.write_text(ny, encoding='utf-8')


NAVN = {'youtube': 'YouTube', 'tiktok': 'TikTok', 'instagram': 'Instagram', 'facebook': 'Facebook', 'linkedin': 'LinkedIn', 'nettside': 'Hjemmeside', 'epost': 'E-post'}
# Enkle strekikoner (ikke merkenes egne logoer)
IKONER = {
    'youtube': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/></svg>',
    'tiktok': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.2 4.4 5 4.6"/></svg>',
    'instagram': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".8" fill="currentColor"/></svg>',
    'facebook': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 21v-7.5h2.7l.4-3.2h-3.1V8.4c0-.9.3-1.6 1.6-1.6h1.6V4a21 21 0 0 0-2.4-.1c-2.4 0-4 1.4-4 4.1v2.3H8.6v3.2h2.7V21"/></svg>',
    'linkedin': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V16M8 7.8v.1M11.5 16v-5.5M11.5 13c0-1.6 1-2.6 2.3-2.6s2.2.9 2.2 2.6V16"/></svg>',
    'nettside': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.5 12 4l8.5 7.5"/><path d="M6 9.8V20h4.5v-5.5h3V20H18V9.8"/></svg>',
    'epost': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m3.8 7 8.2 6.2L20.2 7"/></svg>',
}


def liste(xs):
    return '<ul>' + ''.join(f'<li>{x}</li>' for x in xs) + '</ul>'


def profilside(p, nr, mal):
    hode = mal[:mal.index('<main>')]
    hode = (hode.replace('href="stil.css"', 'href="../stil.css"').replace('href="img/', 'href="../img/')
            .replace('src="img/', 'src="../img/').replace('href="./', 'href="../')
            .replace('href="stott.html"', 'href="../stott.html"').replace('href="doner.html"', 'href="../doner.html"'))
    hode = hode.replace('</head>', '<link rel="stylesheet" href="../samlekort.css">\n</head>')
    hode = re.sub(r'<title>.*?</title>', f'<title>{e(p["navn"])} – Realfagsambassaden</title>', hode)
    hode = re.sub(r'<meta name="description" content=".*?">',
                  f'<meta name="description" content="{e(p.get("rolle", ""))}. Ambassadør i Realfagsambassaden.">', hode)
    fot = mal[mal.index('</main>'):].replace('href="./', 'href="../').replace('</body>', '<script src="../kort.js"></script>\n</body>')
    snart = '<p class="snart">Kommer snart.</p>'
    deler = [f'<h2>Om meg</h2><p>{p.get("om") or ""}</p>' if p.get('om') else '<h2>Om meg</h2>' + snart,
             '<h2>Utdanning og bakgrunn</h2>' + (f'<p>{p["utdanning_og_bakgrunn"]}</p>' if p.get('utdanning_og_bakgrunn') else snart),
             '<h2>Erfaring</h2>' + (liste(p['erfaring']) if p.get('erfaring') else snart)]
    if p.get('meritter'):
        deler.append('<h2>Meritter</h2>' + liste(p['meritter']))
    deler.append('<h2>Mine tilbud</h2>' + (liste([f'<a href="{e(u)}">{e(t)}</a>' for t, u in p['tilbud']]) if p.get('tilbud') else snart))
    sos = {k: v for k, v in (p.get('sosiale') or {}).items() if v}
    if p.get('booking'):
        sos['epost'] = 'mailto:' + p['booking']
    if sos:
        knapper = ''.join(f'<a class="sosial" href="{e(u)}">{IKONER.get(k, "")}{NAVN.get(k, k.title())}</a>' for k, u in sos.items())
        deler.append(f'<h2>Følg meg</h2><div class="sosiale">{knapper}</div>')
    else:
        deler.append('<h2>Følg meg</h2><p class="snart">Lenker kommer.</p>')
    bt = p.get('booking_tekst') or 'Vil du booke privatundervisning, eller invitere meg til skolebesøk, show eller andre arrangementer?'
    if p.get('booking'):
        bt += f' Send en e-post til <a href="mailto:{e(p["booking"])}">{e(p["booking"])}</a>.'
    else:
        bt += ' <span class="snart">Kontaktinformasjon kommer snart.</span>'
    deler.append(f'<h2>Foredrag, skolebesøk og privatundervisning</h2><p>{bt}</p>')
    return (hode + '<!-- Laget av verktoy/samlekort.py fra ambassaden/ambassadorer.yml – rediger yml-fila, ikke denne. -->\n<main>\n'
            '  <section class="seksjon profilside">\n    <p class="overlinje"><a href="../#ambassadorer">← Alle ambassadørene</a></p>\n'
            '    <div class="profilside-rad">\n      <div class="profilside-kort">' + FILTER + kort(p, nr, '../img/', None, 'h1') + '</div>\n'
            '      <div class="profilside-tekst">\n' + '\n'.join('        ' + d for d in deler) + '\n      </div>\n    </div>\n  </section>\n' + fot)


def main():
    folk = yaml.safe_load((ROT / 'ambassaden' / 'ambassadorer.yml').read_text(encoding='utf-8'))['ambassadorer']
    # Realfagsambassaden
    bytt(AMB / 'index.html', '    <link rel="stylesheet" href="samlekort.css">\n    ' + FILTER + '\n    <div class="samlekort-rad">\n' + '\n'.join(
        '      ' + kort(p, i + 1, 'img/', f'profil/{p["id"]}.html') for i, p in enumerate(folk)) + '\n    </div>')
    mal = (AMB / 'doner.html').read_text(encoding='utf-8')
    (AMB / 'profil').mkdir(exist_ok=True)
    for i, p in enumerate(folk):
        (AMB / 'profil' / f'{p["id"]}.html').write_text(profilside(p, i + 1, mal), encoding='utf-8')
    # fysikkhjelp.no (bilder fra Realfagsambassaden, lenker dit)
    import shutil
    shutil.copyfile(AMB / 'samlekort.css', ROT / 'assets' / 'samlekort.css')
    fh = '  <link rel="stylesheet" href="assets/samlekort.css">\n  ' + FILTER + '\n  <div class="samlekort-rad">\n' + '\n'.join(
        '    ' + kort(p, i + 1, AMB_URL + 'img/', f'{AMB_URL}profil/{p["id"]}.html') for i, p in enumerate(folk)
        if 'fysikkhjelp' in (p.get('nettsteder') or [])) + '\n  </div>'
    for f in ('index.qmd', 'om.qmd'):
        if (ROT / f).exists():
            bytt(ROT / f, fh)
    print(f'samlekort: {len(folk)} ambassadører')


if __name__ == '__main__':
    main()
