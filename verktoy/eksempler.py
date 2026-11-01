#!/usr/bin/env python3
"""Skjuler løsningen i eksempler: deler hvert ::: {.eksempel} i oppgavetekst og løsning,
og legger løsningen i ::: {.losning} (vises med knappen «Vis løsning» på nettsiden,
og kommer først på neste klikk i forelesningsmodus).

Brukes av convert.py (forkurset) og fag.py (fagrepoene). Eksempler som allerede har en
.losning, eller som står i OVERSTYR med verdien None, røres ikke.

Slik finner vi skillet (første regel som slår til):
  1. en markør: **Løsning**, *Løsning:*, *Metode:*, **Svar** …  -> løsningen starter der
  2. et hardt linjeskift (\\ på slutten av linja) i første avsnitt
  3. siste setning med spørsmålstegn eller oppfordring (Finn, Beregn, Hva …) i første avsnitt
  4. ellers: etter første avsnitt
OVERSTYR: deler av eksempeltittelen -> tekst som løsningen starter med (eller None = ikke skjul).

Kjør direkte for å se hvordan alle eksemplene deles:  python3 eksempler.py <fil.qmd> …"""
import re, sys

OVERSTYR = {
    # Eksempler som bare illustrerer et begrep (ingen oppgave å løse) skjules ikke:
    'Eksempel 1.1: Lengde': None,
    'Eksempel 1.2: Enhet for fart': None,
}

MARKOR = re.compile(r'(?:\\\n|\\\s)?[ \t]*(?:(?:\*\*|\*)(?:Løsning|Løsningsforslag|Svar|Metode)\b|(?<=\n)\*\*Del [a-z0-9]\b|(?<=\n)Løsning:)')
OPPFORDRING = re.compile(r'^(Finn|Beregn|Bestem|Regn|Vis|Gjør|Hva|Hvor|Hvilke|Hvilken|Hvordan|Tegn|Skriv|Forklar|Avgjør|Sammenlign|Kan|Er)\b')


def _maske(tekst):
    """Erstatter alt inni $...$, $$...$$, `kode` og {...} med X, så vi ikke deler midt i matte."""
    ut = list(tekst); i = 0; n = len(tekst)
    while i < n:
        if tekst.startswith('$$', i):
            j = tekst.find('$$', i + 2); j = n if j < 0 else j + 2
        elif tekst[i] == '$' and (i == 0 or tekst[i - 1] != '\\'):
            j = tekst.find('$', i + 1); j = n if j < 0 else j + 1
        elif tekst[i] == '`':
            j = tekst.find('`', i + 1); j = n if j < 0 else j + 1
        else:
            i += 1; continue
        for k in range(i + 1, j - 1): ut[k] = 'X'
        i = j
    return ''.join(ut)


def _blokker(linjer):
    """Deler eksempelkroppen i avsnitt (lister av linjer) på toppnivå; nestede ::: og $$ holdes samlet."""
    blokker, cur, dybde, imatte, ikode = [], [], 0, False, False
    for l in linjer:
        s = l.strip()
        if s.startswith('```'): ikode = not ikode
        elif not ikode:
            if s.count('$$') % 2: imatte = not imatte
            if not imatte:
                if re.match(r'^:::+\s*\S', s): dybde += 1
                elif re.match(r'^:::+\s*$', s): dybde -= 1
        if not s and dybde == 0 and not imatte and not ikode:
            if cur: blokker.append(cur); cur = []
        else:
            cur.append(l)
    if cur: blokker.append(cur)
    return blokker


def finn_skille(kropp):
    """kropp: teksten etter tittelen. Gir (oppgave, løsning) eller None."""
    r = _finn_skille(kropp)
    if not r: return r
    oppg, los = r
    # Figurer rett etter oppgaveteksten hører til oppgaven
    while True:
        m = re.match(r'\s*(::: *center\n(?:(?!:::).*\n)*?:::|!\[[^\n]*)\n', los + '\n')
        if not m or 'losning' in m.group(1): break
        oppg = oppg + '\n\n' + m.group(1); los = los[m.end():]
    return (oppg, los) if los.strip() else None


def _finn_skille(kropp):
    m_kropp = _maske(kropp)
    m = MARKOR.search(m_kropp)
    if m and kropp[:m.start()].strip():
        return kropp[:m.start()].rstrip(), kropp[m.start():].lstrip('\\ \t\n')
    blokker = _blokker(kropp.split('\n'))
    if not blokker: return None
    forste = '\n'.join(blokker[0]); m_forste = _maske(forste)
    br = re.search(r'\\\n', m_forste)
    if br and forste[br.end():].strip():
        return forste[:br.start()].rstrip(), forste[br.end():] + kropp[kropp.find(forste) + len(forste):]
    # setninger i første avsnitt
    slutt = [mm.end() for mm in re.finditer(r'[.?!](?=\s|$)', m_forste)]
    start = 0; siste = None
    for e in slutt:
        setning = forste[start:e].strip()
        if setning.endswith('?') or OPPFORDRING.match(setning.lstrip('*_ ')): siste = e
        start = e
    if siste is not None and forste[siste:].strip():
        return forste[:siste].rstrip(), forste[siste:].lstrip() + kropp[kropp.find(forste) + len(forste):]
    if len(blokker) > 1:
        rest = kropp[kropp.find(forste) + len(forste):].strip('\n')
        if rest.strip(): return forste.rstrip(), rest
    return None


def _tittel_og_kropp(linjer):
    """Finner tittel-linja (forkurs: [Eksempel …]{.eks-tittel}; fag: **Eksempel: …** første avsnitt)."""
    for i, l in enumerate(linjer):
        s = l.strip()
        if not s or s.startswith('<!--'): continue
        if '{.eks-tittel}' in s:
            return linjer[:i + 1], '\n'.join(linjer[i + 1:]), s
        m = re.match(r'^(\*\*Eksempel[^*]*\*\*)\s*(.*)$', s)
        if m:
            return linjer[:i] + [m.group(1)], '\n'.join(([m.group(2)] if m.group(2) else []) + linjer[i + 1:]), m.group(1)
        return linjer[:i], '\n'.join(linjer[i:]), ''
    return linjer, '', ''


def _overstyr(tittel):
    for k, v in OVERSTYR.items():
        if k in tittel: return True, v
    return False, None


def del_eksempel(linjer, rapport=None):
    hode, kropp, tittel = _tittel_og_kropp(linjer)
    if re.search(r'^\s*:::+\s*\{?\.losning', kropp, re.M): return linjer
    har, anker = _overstyr(tittel)
    if har:
        if anker is None: skille = None
        else:
            i = kropp.find(anker); skille = (kropp[:i].rstrip(), kropp[i:]) if i > 0 else None
    else:
        skille = finn_skille(kropp)
    if rapport is not None: rapport.append((tittel, skille))
    if not skille: return linjer
    oppg, los = skille
    if hode and hode[-1].startswith('**Eksempel') and oppg and not oppg.startswith('\n'):
        hode = hode[:-1] + [hode[-1] + ' ' + oppg.split('\n')[0]]; oppg = '\n'.join(oppg.split('\n')[1:])
    return hode + ([oppg] if oppg.strip() else []) + ['', '::: {.losning}', los.strip('\n'), ':::']


def behandle(tekst, rapport=None):
    """Går gjennom en .qmd-tekst og deler alle eksempler."""
    linjer = tekst.split('\n'); ut = []; i = 0
    while i < len(linjer):
        if re.match(r'^:::+\s*\{\.eksempel\b', linjer[i].strip()):
            ut.append(linjer[i]); dybde = 1; j = i + 1; imatte = False; ikode = False
            while j < len(linjer):
                s = linjer[j].strip()
                if s.startswith('```'): ikode = not ikode
                elif not ikode:
                    if s.count('$$') % 2: imatte = not imatte
                    if not imatte:
                        if re.match(r'^:::+\s*\S', s): dybde += 1
                        elif re.match(r'^:::+\s*$', s):
                            dybde -= 1
                            if dybde == 0: break
                j += 1
            # Står løsningen rett etter eksemplet (forkurset: ::: {.callout-note .svar …}), er den allerede skjult.
            k = j + 1
            while k < len(linjer) and not linjer[k].strip(): k += 1
            if k < len(linjer) and re.match(r'^:::+\s*\{[^}]*\.svar\b', linjer[k].strip()):
                ut.extend(linjer[i + 1:j])
            else:
                ut.extend(del_eksempel(linjer[i + 1:j], rapport))
            ut.append(linjer[j] if j < len(linjer) else ':::')
            i = j + 1
        else:
            ut.append(linjer[i]); i += 1
    return '\n'.join(ut)


if __name__ == '__main__':
    for f in sys.argv[1:]:
        r = []; behandle(open(f, encoding='utf-8').read(), r)
        for tittel, s in r:
            if not s: print(f'[IKKE DELT] {tittel}'); continue
            o = ' '.join(s[0].split())[-110:]; l = ' '.join(s[1].split())[:60]
            print(f'{tittel[:45]:45s} | …{o}\n{"":45s} → {l}')
