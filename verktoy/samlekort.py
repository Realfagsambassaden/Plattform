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


def kopper(n, te=False):
    try:
        n = float(n)
    except (TypeError, ValueError):
        return f'<em class="sk-ukjent">{UKJENT}</em>'
    if n >= 10:   # sprenger skalaen: koppene renner ut av kortet
        return '<em class="sk-kopper sk-sprenger">' + '☕' * 16 + '</em>'
    tall = int(n) if n == int(n) else n
    tekst = f'{tall} {"kopp" if n == 1 else "kopper"}' + (' + masse te' if te else '')
    return (f'<em class="sk-kopper">{"☕" * min(int(round(n)), 6)}{"🍵🍵" if te else ""}</em>'
            f'<small>{tekst}</small>')


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
        ('Utdanning', soyle(p.get('utdanning'), 100, p.get('utdanning_tekst') or p.get('utdanning') or '')),
        ('Erfaring', soyle(ar, 20, f'{ar} år' if ar not in (None, '') else '')),
        ('Kvalitet', ord_(p.get('kvalitet'))),
        ('Fun fact', ord_(p.get('funfact'))),
        ('Koffein', kopper(p.get('koffein'), p.get('te'))),
    ]
    rader = ''.join(f'<span class="sk-stat"><b>{n}</b><span class="sk-verdi">{v}</span></span>' for n, v in stats)
    ikon = f'<img class="sk-ikon" src="{bilder}{e(p["ikon"])}" alt="">' if p.get('ikon') else ''
    spr = ' data-sprenger' if isinstance(p.get('koffein'), (int, float)) and p['koffein'] >= 10 else ''
    return (f'<article class="samlekort" data-farge="{e(p.get("farge", "gronn"))}" id="{e(p["id"])}"{spr}>'
            f'<{tag} class="sk-inni"{lenke}><span class="sk-flate">'
            f'<span class="sk-topp"><{h} class="sk-navn">{e(p["navn"])}</{h}>{ikon}</span>'
            f'<span class="sk-bilde"><img src="{bilder}{e(p["foto"])}" alt="Portrett av {e(p.get("fullt_navn") or p["navn"])}"></span>'
            f'<span class="sk-rolle">{e(p.get("rolle", ""))}</span>'
            f'<span class="sk-stats">{rader}</span>'
            f'<span class="sk-bunn"><span class="sk-tilbud">{"Trykk for å lese mer →" if href else ""}</span><span class="sk-nr">#{nr:03d}</span></span>'
            f'</span><span class="sk-glans" aria-hidden="true"></span></{tag}></article>')


def bytt(fil, innhold):
    t = fil.read_text(encoding='utf-8')
    ny, n = re.subn(r'(<!-- >>> samlekort[^\n]*-->\n).*?([ \t]*<!-- <<< samlekort -->)',
                    lambda m: m.group(1) + innhold + '\n' + m.group(2), t, count=1, flags=re.S)
    if n != 1:
        sys.exit(f'Fant ikke samlekort-merkene i {fil}')
    if ny != t:
        fil.write_text(ny, encoding='utf-8')


def liste(xs):
    return '<ul>' + ''.join(f'<li>{x}</li>' for x in xs) + '</ul>'


def profilside(p, nr, mal):
    hode = mal[:mal.index('<main>')]
    hode = (hode.replace('href="stil.css"', 'href="../stil.css"').replace('href="img/', 'href="../img/')
            .replace('src="img/', 'src="../img/').replace('href="./', 'href="../')
            .replace('href="stott.html"', 'href="../stott.html"').replace('href="doner.html"', 'href="../doner.html"'))
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
    navn = {'youtube': 'YouTube', 'instagram': 'Instagram', 'tiktok': 'TikTok', 'facebook': 'Facebook', 'linkedin': 'LinkedIn', 'nettside': 'Nettside'}
    deler.append('<h2>Følg meg</h2>' + ('<div class="sosiale">' + ''.join(f'<a class="sosial" href="{e(u)}">{navn.get(k, k.title())}</a>' for k, u in sos.items()) + '</div>'
                                        if sos else '<p class="snart">Lenker kommer.</p>'))
    deler.append('<h2>Foredrag, skolebesøk og privatundervisning</h2><p>Vil du booke privatundervisning, eller invitere meg til skolebesøk, show eller andre arrangementer? <span class="snart">Kontaktinformasjon kommer snart.</span></p>')
    return (hode + '<!-- Laget av verktoy/samlekort.py fra ambassaden/ambassadorer.yml – rediger yml-fila, ikke denne. -->\n<main>\n'
            '  <section class="seksjon profilside">\n    <p class="overlinje"><a href="../#ambassadorer">← Alle ambassadørene</a></p>\n'
            '    <div class="profilside-rad">\n      <div class="profilside-kort">' + kort(p, nr, '../img/', None, 'h1') + '</div>\n'
            '      <div class="profilside-tekst">\n' + '\n'.join('        ' + d for d in deler) + '\n      </div>\n    </div>\n  </section>\n' + fot)


def main():
    folk = yaml.safe_load((ROT / 'ambassaden' / 'ambassadorer.yml').read_text(encoding='utf-8'))['ambassadorer']
    # Realfagsambassaden
    bytt(AMB / 'index.html', '    <div class="samlekort-rad">\n' + '\n'.join(
        '      ' + kort(p, i + 1, 'img/', f'profil/{p["id"]}.html') for i, p in enumerate(folk)) + '\n    </div>')
    mal = (AMB / 'doner.html').read_text(encoding='utf-8')
    (AMB / 'profil').mkdir(exist_ok=True)
    for i, p in enumerate(folk):
        (AMB / 'profil' / f'{p["id"]}.html').write_text(profilside(p, i + 1, mal), encoding='utf-8')
    # fysikkhjelp.no (bilder fra Realfagsambassaden, lenker dit)
    fh = '  <div class="samlekort-rad">\n' + '\n'.join(
        '    ' + kort(p, i + 1, AMB_URL + 'img/', f'{AMB_URL}profil/{p["id"]}.html') for i, p in enumerate(folk)
        if 'fysikkhjelp' in (p.get('nettsteder') or [])) + '\n  </div>'
    for f in ('index.qmd', 'om.qmd'):
        if (ROT / f).exists():
            bytt(ROT / f, fh)
    print(f'samlekort: {len(folk)} ambassadører')


if __name__ == '__main__':
    main()
