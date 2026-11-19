#!/usr/bin/env python3
"""Flytter løsningsforslagene til OPPGAVENE ut av de offentlige lærebokrepoene (besluttet 19. nov. 2026, se AGENTS.md).

Løsningsforslag (::: {.losning} inne i ::: {.oppgave}) flyttes til det private repoet Realfagsambassaden/eksamener,
mappa losninger/<repo>/<sti>.yml. I læreboka står igjen bare sluttsvaret:

    ::: {.fasit}
    a) $4.5\\,\\mathrm{MJ}$ · b) $12\\,^\\circ\\mathrm{C}$
    :::

Sluttsvaret er det som står med to streker under (\\underline{\\underline{…}}) i løsningsforslaget, med delspørsmålet
(a), b) …) foran når det finnes. Finnes ingen to streker, står ingen fasit (oppgaven har da bare hint).
Eksempler (::: {.eksempel}) røres ikke: der skal løsningen stå (skjult bak «Vis løsning»).

Bruk: python3 flytt_losninger.py <lærebokrepo> <privat eksamener-repo>   (f.eks. ../fysikk-forkurs ../eksamener)
Skriptet er idempotent: oppgaver som allerede er flyttet (ingen .losning), hoppes over.
"""
import re, sys
from pathlib import Path
import yaml

APNE = re.compile(r'^(:{3,})\s*\{(.*)\}\s*$')
LUKK = re.compile(r'^(:{3,})\s*$')
DEL = re.compile(r'^\s*(?:\*\*)?\(?([a-h])\)(?:\*\*)?\s')


class Blokk(str):
    pass


yaml.add_representer(Blokk, lambda d, s: d.represent_scalar('tag:yaml.org,2002:str', s, style='|'))


def klasser(a):
    return re.findall(r'\.[\w-]+', a)


def understreket(t):
    """Alle \\underline{\\underline{X}} i teksten, med delspørsmålet foran (a), b) …)."""
    ut, gjeldende, linjestart = [], None, 0
    i = 0
    merke = '\\underline{\\underline{'
    while True:
        j = t.find(merke, i)
        if j < 0:
            break
        # delspørsmål: siste «a)»-merke på en linje før understrekingen
        for linje in t[linjestart:j].split('\n'):
            m = DEL.match(linje)
            if m:
                gjeldende = m.group(1)
        linjestart = j
        k, dybde = j + len(merke), 2
        start = k
        while k < len(t) and dybde:
            if t[k] == '{':
                dybde += 1
            elif t[k] == '}':
                dybde -= 1
            k += 1
        x = t[start:k - 2].strip() if dybde == 0 else ''
        if x:
            ut.append((gjeldende, x))
        i = k
    return ut


def fasit(losning):
    deler = understreket(losning)
    if not deler:
        return ''
    sett, tekst = set(), []
    for d, x in deler:
        if (d, x) in sett:
            continue
        sett.add((d, x))
        tekst.append((f'{d}) ' if d and len({a for a, _ in deler}) > 1 else '') + f'${x}$')
    return ' · '.join(tekst)


def rens(linjer):
    t = '\n'.join(linjer)
    t = re.sub(r'^:{3,}.*$', '', t, flags=re.M)
    t = re.sub(r'!\[[^\]]*\]\([^)]*\)(\{[^}]*\})?', '', t)
    return re.sub(r'\s+', ' ', t).strip()


def flytt(fil, repo_navn, rot, privat):
    linjer = fil.read_text(encoding='utf-8').split('\n')
    stakk, nr, funn = [], 0, []   # funn: (start, slutt, oppgavenr, fence, oppgavelinjer)
    for i, linje in enumerate(linjer):
        a = APNE.match(linje)
        if a:
            node = {'start': i, 'fence': a.group(1), 'k': a.group(2), 'linjer': []}
            if '.oppgave' in klasser(a.group(2)):
                node['nr'] = nr; nr += 1
            stakk.append(node); continue
        if LUKK.match(linje) and stakk:
            node = stakk.pop()
            if '.losning' in klasser(node['k']) and stakk and 'nr' in stakk[-1]:
                funn.append((node['start'], i, stakk[-1]['nr'], node['fence'], list(stakk[-1]['linjer'])))
            elif stakk and '.losning' not in klasser(node['k']):
                stakk[-1]['linjer'] += node['linjer']
            continue
        if stakk:
            stakk[-1]['linjer'].append(linje)
    if not funn:
        return 0, 0
    rel = fil.relative_to(rot).with_suffix('')
    side_id = f'/{repo_navn}/{rel.as_posix()}.html'
    poster, med_fasit = [], 0
    for start, slutt, onr, fence, olinjer in reversed(funn):
        los = '\n'.join(linjer[start + 1:slutt]).strip('\n')
        f = fasit(los)
        poster.append({'nr': onr, 'id': f'{side_id}#{onr}', 'oppgave': rens(olinjer)[:160], 'losning': Blokk(los + '\n')})
        ny = [f'{fence} {{.fasit}}', f, fence] if f else []
        med_fasit += bool(f)
        linjer[start:slutt + 1] = ny
    poster.sort(key=lambda p: p['nr'])
    ut = Path(privat) / 'losninger' / repo_navn / rel.with_suffix('.yml')
    ut.parent.mkdir(parents=True, exist_ok=True)
    gamle = yaml.safe_load(ut.read_text(encoding='utf-8')) if ut.exists() else None
    if gamle:   # tidligere flyttet fra samme side: behold dem, legg til nye
        kjente = {p['id'] for p in poster}
        poster = sorted([p for p in gamle['oppgaver'] if p['id'] not in kjente] + poster, key=lambda p: p['nr'])
        for p in poster: p['losning'] = Blokk(p['losning'])
    hode = {'side': side_id, 'kilde': f'{repo_navn}/{fil.relative_to(rot).as_posix()}', 'oppgaver': poster}
    ut.write_text('# Løsningsforslag til oppgavene på siden (flyttet fra det offentlige lærebokrepoet).\n# Vises bare for lærere og brukes av hint-KI-en. Ikke legg dem tilbake i læreboka.\n'
                  + yaml.dump(hode, allow_unicode=True, sort_keys=False, width=1000), encoding='utf-8')
    fil.write_text('\n'.join(linjer), encoding='utf-8')
    return len(funn), med_fasit


if __name__ == '__main__':
    rot, privat = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    repo_navn = rot.name
    tot = fas = sider = 0
    for fil in sorted((rot / 'kapitler').rglob('*.qmd')):
        n, f = flytt(fil, repo_navn, rot, privat)
        if n:
            sider += 1; tot += n; fas += f
    print(f'{repo_navn}: {tot} løsningsforslag flyttet fra {sider} sider, {fas} med fasit (sluttsvar), {tot - fas} uten')
