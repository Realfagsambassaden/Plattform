# Statistikk over tidligere TRES0312-eksamener (2023–2026), til Dashman.
# Hver deloppgave er merket med ett tema etter at Claude leste original-PDF-ene i det private eksamener-repoet
# (24. nov. 2026). Alle deloppgaver teller likt, slik eksamensforsidene sier. Bare tidligere, gitte eksamener er med.
# Kjør: python3 verktoy/eksamensstatistikk.py  →  hint-tjener/eksamensstatistikk.json
# Hver eksamen: liste av (oppgavenr, tema, antall deloppgaver). Alle deloppgaver teller likt (står i eksamensforsidene).
E = {
 "tres0312-2023-konte": [(1,"kinematikk",1),(2,"sirkelbevegelse",1),(3,"statikk",1),(4,"temperatur-og-varme",1),(5,"arbeid-og-energi",1),
   (6,"kinematikk",3),(7,"newtons-lover",4),(7,"bevegelsesmengde",1),(8,"statikk",2),(8,"newtons-lover",1),(9,"hydrostatikk",3),
   (10,"termodynamikk",2),(10,"gasser",1),(11,"kretser",3)],
 "tres0312-2023-ordinaer": [(1,"kinematikk",1),(2,"hydrostatikk",1),(3,"arbeid-og-energi",1),(4,"statikk",1),(5,"kretser",1),
   (6,"kretser",3),(7,"termodynamikk",3),(7,"gasser",1),(8,"arbeid-og-energi",1),(8,"bevegelsesmengde",1),(9,"hydrostatikk",3),
   (9,"newtons-lover",1),(10,"kinematikk",3),(11,"newtons-lover",1),(11,"sirkelbevegelse",3)],
 "tres0312-2024-konte": [(1,"kinematikk",1),(2,"hydrostatikk",1),(3,"statikk",1),(4,"hydrostatikk",1),(5,"termodynamikk",1),
   (6,"kretser",4),(7,"termodynamikk",2),(7,"gasser",1),(8,"arbeid-og-energi",2),(8,"bevegelsesmengde",1),(9,"hydrostatikk",3),
   (10,"kinematikk",3),(11,"statikk",4)],
 "tres0312-2024-ordinaer": [(1,"kinematikk",1),(2,"sirkelbevegelse",1),(3,"statikk",1),(4,"bevegelsesmengde",1),(5,"arbeid-og-energi",1),
   (6,"kretser",4),(7,"gasser",2),(7,"termodynamikk",1),(8,"statikk",3),(8,"newtons-lover",1),(9,"temperatur-og-varme",3),
   (10,"kinematikk",3),(11,"newtons-lover",2),(11,"kinematikk",1)],
 "tres0312-2025-konte": [(1,"kinematikk",1),(2,"sirkelbevegelse",1),(3,"statikk",1),(4,"bevegelsesmengde",1),(5,"arbeid-og-energi",1),
   (6,"kretser",4),(7,"hydrostatikk",2),(7,"gasser",1),(8,"statikk",3),(8,"newtons-lover",1),(9,"termodynamikk",2),(9,"gasser",1),
   (10,"kinematikk",3),(11,"newtons-lover",2),(11,"arbeid-og-energi",1)],
 "tres0312-2025-ordinaer": [(1,"kinematikk",1),(2,"sirkelbevegelse",1),(3,"arbeid-og-energi",1),(4,"temperatur-og-varme",1),(5,"kretser",1),
   (6,"arbeid-og-energi",1),(6,"kinematikk",3),(7,"newtons-lover",4),(8,"statikk",2),(8,"newtons-lover",1),(9,"hydrostatikk",3),
   (10,"gasser",1),(10,"temperatur-og-varme",1),(10,"bevegelsesmengde",1),(11,"kretser",3)],
 "tres0312-2026-konte": [(1,"kinematikk",1),(2,"sirkelbevegelse",1),(3,"arbeid-og-energi",1),(4,"gasser",1),(5,"arbeid-og-energi",1),
   (6,"kinematikk",2),(6,"arbeid-og-energi",2),(7,"newtons-lover",4),(8,"statikk",2),(8,"newtons-lover",1),(9,"hydrostatikk",3),
   (10,"temperatur-og-varme",2),(10,"gasser",1),(11,"kretser",3)],
}
NAVN = {"kinematikk":"Kinematikk (inkl. kast)","sirkelbevegelse":"Sirkelbevegelse","newtons-lover":"Newtons lover, krefter og friksjon",
 "bevegelsesmengde":"Bevegelsesmengde og støt","arbeid-og-energi":"Arbeid, energi og effekt","statikk":"Statikk (kraftmoment, tyngdepunkt)",
 "hydrostatikk":"Trykk og oppdrift","temperatur-og-varme":"Varme og kalorimetri","termodynamikk":"Termodynamikk (1. lov, prosesser, pV)",
 "gasser":"Ideell gass","kretser":"Elektriske kretser"}
import collections, json
tot = collections.Counter(); med = collections.Counter(); sum_alle = 0
per = {}
for e, l in E.items():
    s = sum(n for _, _, n in l); sum_alle += s; per[e] = s
    for t in {t for _, t, _ in l}: med[t] += 1
    for _, t, n in l: tot[t] += n
print(per)
rader = []
for t, n in tot.most_common():
    rader.append({"tema": t, "navn": NAVN[t], "andel": round(100 * n / sum_alle), "eksamener": med[t]})
    print(f"{NAVN[t]:42s} {n:3d} {100*n/sum_alle:5.1f} %  med på {med[t]}/{len(E)}")
json.dump({"TRES0312": {"eksamener": sorted(E), "antall": len(E), "deloppgaver": sum_alle, "temaer": rader}}, open(__import__("pathlib").Path(__file__).resolve().parent.parent / "hint-tjener" / "eksamensstatistikk.json", "w"), ensure_ascii=False, indent=1)
