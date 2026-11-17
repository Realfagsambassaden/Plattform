#!/usr/bin/env python3
"""Automatisk kontroll av oppgaver før studentene ser dem (AGENTS.md: «Oppgavebanken først, og kontroll før studentene ser noe»).

Bruk:
  python3 verktoy/sjekk_oppgaver.py [rot]                 # sjekker studie/sporsmal.json (banken)
  python3 verktoy/sjekk_oppgaver.py --fil ovelse.json     # sjekker en liste med spørsmål (f.eks. et arbeidskrav fra databasen)
  python3 verktoy/sjekk_oppgaver.py --streng              # avslutter med feilkode hvis noe er FEIL (ikke bare ADVARSEL)

Sjekker:
  - påkrevde felt, gyldig tema/undertema og vanskelighet
  - notasjon (NOTASJON.md): desimalkomma, rå «^» utenfor formler, ubalanserte $
  - kladdetekst fra KI: «…», «...», «Enklere:», «TODO», «[CHECK]»
  - fasit: tallsvar kan leses; feilalternativer er ulike fasiten og hverandre
  - gjeldende siffer i fasiten mot det minst nøyaktige måltallet i teksten
  - spørsmål med variabler ({{x}}): alle variabler finnes, fasiten kan regnes ut for alle verdier (ingen deling på null o.l.)
  - like spørsmålstekster
  - dekning: antall spørsmål per tema og vanskelighetsgrad
"""
import json
import math
import re
import sys
from collections import Counter, defaultdict
from itertools import product
from pathlib import Path

NIVAER = ('lett', 'middels', 'vanskelig')
KLADD = re.compile(r'…|\.\.\.|\bEnklere:|\bTODO\b|\[CHECK\]|\bXXX\b', re.I)

funn = []   # (nivå, id, melding)


def meld(niva, qid, tekst):
    funn.append((niva, qid, tekst))


def utenfor_formler(s):
    """Teksten med alt mellom $ … $ fjernet."""
    deler = re.split(r'\$\$?', s)
    return ' '.join(deler[::2])


def sjekk_notasjon(qid, felt, s):
    if not isinstance(s, str) or not s:
        return
    if s.count('$') % 2:
        meld('FEIL', qid, f'{felt}: ubalanserte $ (formelen blir ødelagt)')
    ute = utenfor_formler(s)
    if re.search(r'(?<![\w{])\d+,\d+(?![\w}])', ute.replace('{,}', '.')) and not re.search(r'\d+, \d+', ute):
        m = re.search(r'\d+,\d+', ute)
        meld('ADVARSEL', qid, f'{felt}: desimalkomma «{m.group(0)}» – bruk punktum (NOTASJON.md)')
    if '{,}' in s:
        meld('ADVARSEL', qid, f'{felt}: desimalkomma «{{,}}» i formel – bruk punktum (NOTASJON.md)')
    if re.search(r'\d\s*\^\s*\(?[-−+]?\d', ute):
        meld('ADVARSEL', qid, f'{felt}: tierpotens med rå «^» utenfor formel – skriv $\\cdot 10^{{…}}$')
    if KLADD.search(s):
        meld('FEIL', qid, f'{felt}: ser ut som kladdetekst («{KLADD.search(s).group(0)}»)')


# ---- tall og gjeldende siffer (samme regler som minSiffer i studie.js)
TALL = re.compile(r'^\s*([-−+]?\d+(?:[.,]\d+)?)\s*(?:(?:[eE]\s*([-−+]?\d+))|(?:[*·×]\s*10\s*\^\s*\{?\(?\s*([-−+]?\d+)\s*\)?\}?))?\s*(.*)$')


def les_tall(s):
    s = re.sub(r'\$|\\[,;: ]|~', ' ', str(s)).replace('\\cdot', '·').replace('\\times', '×').replace('−', '-')
    s = re.sub(r'\\mathrm\{([^}]*)\}', r'\1', s).replace('{', '').replace('}', '')
    m = TALL.match(s)
    if not m:
        return None
    mant = m.group(1).replace(',', '.').replace('−', '-')
    eks = m.group(2) or m.group(3)
    try:
        v = float(mant) * (10 ** int(eks.replace('−', '-')) if eks else 1)
    except ValueError:
        return None
    sifre = mant.lstrip('-+').replace('.', '').lstrip('0') or '0'
    return {'v': v, 'siffer': max(1, len(sifre)), 'enhet': m.group(4).strip()}


def min_siffer(tekst):
    t = re.sub(r'\$|\\[,;: ]|~', ' ', tekst)
    t = re.sub(r'\\(?:mathrm|text)\{([^}]*)\}', r'\1', t)
    t = re.sub(r'\\cdot|\\times|·|×', '*', t).replace('−', '-').replace('{', '').replace('}', '')
    best = None
    for m in re.finditer(r'(^|[^\w.^_])(\d+(?:[.,]\d+)?)(\s*(?:[eE]\s*[-+]?\d+|\*\s*10\s*\^\s*\(?\s*[-+]?\d+\s*\)?))?(\s*)([a-zA-ZæøåÆØÅµμΩ°%/]*)', t):
        mant, eks, ord_ = m.group(2).replace(',', '.'), bool(m.group(3)), m.group(5)
        punkt = '.' in mant
        if not eks and not ord_:
            continue
        if not eks and not punkt and len(mant) == 1 and len(ord_) > 3:
            continue
        if float(mant) == 0:   # «x = 0», «0 V»: et nullpunkt, ikke et måltall
            continue
        n = max(1, len(mant.replace('.', '').lstrip('0')))
        best = n if best is None else min(best, n)
    return best


# ---- trygg utregning av fasituttrykk for malspørsmål
FUNK = {k: getattr(math, k) for k in ('sqrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'log10', 'exp', 'pi')}
FUNK.update({'abs': abs, 'ln': math.log, 'e': math.e})


def regn(uttrykk, v):
    u = str(uttrykk).replace('^', '**').replace('·', '*').replace('×', '*').replace('−', '-')
    if re.search(r'__|import|lambda|\[|\]|;', u):
        raise ValueError('ugyldig uttrykk')
    return float(eval(u, {'__builtins__': {}}, {**FUNK, **v}))


def verdier(a):
    lo, hi, st = float(a['min']), float(a['maks']), float(a['steg'])
    n = int(round((hi - lo) / st)) + 1
    return [round(lo + i * st, 10) for i in range(max(1, min(n, 200)))]


def sjekk_mal(qid, q):
    vs = q.get('variabler') or []
    navn = {a.get('navn') for a in vs}
    for felt in ('tekst', 'forklaring'):
        for m in re.finditer(r'\{\{([^{}]+)\}\}', q.get(felt) or ''):
            u = m.group(1).strip()
            if u != 'svar' and u not in navn:
                try:
                    regn(u, {n: 1.0 for n in navn})
                except Exception:
                    meld('FEIL', qid, f'{felt}: {{{{{u}}}}} er verken en variabel eller et uttrykk som kan regnes ut')
    for a in vs:
        if a.get('navn') not in (q.get('tekst') or ''):
            meld('ADVARSEL', qid, f'variabelen {a.get("navn")} står ikke i spørsmålsteksten')
    try:
        lister = [verdier(a) for a in vs]
    except Exception:
        meld('FEIL', qid, 'variablene mangler min/maks/steg')
        return
    antall = math.prod(len(x) for x in lister) if lister else 1
    if antall > 20000:   # sjekk et utvalg
        lister = [x[:: max(1, len(x) // 10)] for x in lister]
    fortegn, feil = set(), 0
    for kombo in product(*lister) if lister else [()]:
        v = {a['navn']: x for a, x in zip(vs, kombo)}
        try:
            y = regn(q.get('svar'), v)
            if not math.isfinite(y):
                raise ValueError('uendelig')
            fortegn.add(y > 0)
        except Exception:
            feil += 1
    if feil:
        meld('FEIL', qid, f'fasiten «{q.get("svar")}» kan ikke regnes ut for {feil} av variabelverdiene (deling på null o.l.)')
    if len(fortegn) > 1:
        meld('ADVARSEL', qid, 'fasiten skifter fortegn for ulike variabelverdier – sjekk at spørsmålet gir mening for alle')
    if re.search(r'\b[A-Za-z]\w*\s*[/*]\s*[A-Za-z]\w*\b', utenfor_formler(q.get('tekst') or '').replace('km/h', '').replace('m/s', '')):
        meld('ADVARSEL', qid, 'spørsmålsteksten ser ut til å inneholde en formel (røper den løsningen?)')


def sjekk(sporsmal, struktur=None, navn='banken'):
    tekster = defaultdict(list)
    dekning = Counter()
    for i, q in enumerate(sporsmal):
        qid = q.get('id') or f'#{i + 1}'
        for f in ('tekst', 'forklaring'):
            if not q.get(f):
                meld('FEIL' if f == 'tekst' else 'ADVARSEL', qid, f'mangler {f}')
        niva = q.get('vanskelighet') or q.get('niva')
        if niva not in NIVAER:
            meld('ADVARSEL', qid, f'vanskelighet «{niva}» er ikke lett/middels/vanskelig')
        if struktur is not None:
            t, u = q.get('tema'), q.get('undertema')
            if t not in struktur:
                meld('FEIL', qid, f'ukjent tema «{t}»')
            elif u not in struktur[t].get('undertemaer', {}):
                meld('FEIL', qid, f'ukjent undertema «{u}» i {t}')
            dekning[(t, niva)] += 1
        for f in ('tekst', 'forklaring', 'riktig'):
            sjekk_notasjon(qid, f, q.get(f))
        for x in q.get('feil') or []:
            sjekk_notasjon(qid, 'feilalternativ', x.get('svar'))
        tekster[re.sub(r'\s+', ' ', (q.get('tekst') or '').strip().lower())].append(qid)

        if q.get('variabler'):
            sjekk_mal(qid, q)
            continue
        riktig = q.get('riktig')
        feil = [x.get('svar') for x in q.get('feil') or []]
        if riktig is None:
            meld('FEIL', qid, 'mangler fasit')
            continue
        if str(riktig).strip() in [str(x).strip() for x in feil]:
            meld('FEIL', qid, 'et feilalternativ er likt fasiten')
        if len(set(map(str, feil))) != len(feil):
            meld('ADVARSEL', qid, 'to feilalternativer er like')
        for x in q.get('feil') or []:
            if x.get('type') not in ('regnefeil', 'begrep', None):
                meld('ADVARSEL', qid, f'ukjent feiltype «{x.get("type")}»')
        f = les_tall(riktig)
        if f and f['enhet'] != '' or (f and re.search(r'\d', str(riktig))):
            krav = min_siffer(q.get('tekst') or '')
            if f and krav and f['siffer'] != krav and abs(f['v']) not in (0,):
                # bare advarsel: tvetydige tall (300 m) og eksakte tall gjør regelen usikker
                meld('ADVARSEL', qid, f'fasiten «{riktig}» har {f["siffer"]} gjeldende siffer, minst nøyaktige måltall har {krav}')

    for t, ids in tekster.items():
        if t and len(ids) > 1:
            meld('ADVARSEL', ids[0], f'samme spørsmålstekst som {", ".join(ids[1:])}')
    return dekning


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    streng = '--streng' in sys.argv
    if '--fil' in sys.argv:
        fil = Path(sys.argv[sys.argv.index('--fil') + 1])
        d = json.loads(fil.read_text(encoding='utf-8'))
        sp = d if isinstance(d, list) else d.get('sporsmal', [])
        sjekk(sp, None, fil.name)
        dekning = None
    else:
        rot = Path(args[0]) if args else Path(__file__).resolve().parent.parent
        d = json.loads((rot / 'studie' / 'sporsmal.json').read_text(encoding='utf-8'))
        dekning = sjekk(d['sporsmal'], d.get('struktur'))
        sp = d['sporsmal']

    for niva in ('FEIL', 'ADVARSEL'):
        l = [f for f in funn if f[0] == niva]
        if l:
            print(f'\n{niva} ({len(l)}):')
            for _, qid, t in l:
                print(f'  {qid}: {t}')
    if dekning is not None:
        print('\nDekning (lett/middels/vanskelig):')
        temaer = d.get('struktur', {})
        for t, info in temaer.items():
            n = [dekning[(t, v)] for v in NIVAER]
            print(f'  {info.get("tittel", t):34s} {n[0]:3d} {n[1]:3d} {n[2]:3d}' + ('   ← mangler' if not sum(n) else ''))
    nf = sum(1 for f in funn if f[0] == 'FEIL')
    print(f'\nsjekk_oppgaver: {len(sp)} spørsmål, {nf} feil, {len(funn) - nf} advarsler')
    sys.exit(1 if streng and nf else 0)


if __name__ == '__main__':
    main()
