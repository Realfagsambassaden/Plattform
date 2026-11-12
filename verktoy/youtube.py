#!/usr/bin/env python3
"""Henter alle videoene i spillelistene i youtube.yml og skriver dem til en JSON-fil.

Bruk:  python3 verktoy/youtube.py youtube.yml youtube-videoer.json

Kjøres av GitHub (.github/workflows/youtube.yml), fordi KI-øktene ikke når YouTube.
Fullstendig liste hentes med yt-dlp. Virker ikke det, brukes RSS-strømmen til spillelista
(bare de 15 nyeste). Beskrivelser hentes fra RSS der de finnes.
"""
import json
import subprocess
import sys
import urllib.request
import xml.etree.ElementTree as ET

import yaml

NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015",
      "media": "http://search.yahoo.com/mrss/"}


def rss(pid):
    url = f"https://www.youtube.com/feeds/videos.xml?playlist_id={pid}"
    with urllib.request.urlopen(url, timeout=30) as r:
        rot = ET.fromstring(r.read())
    ut = []
    for e in rot.findall("a:entry", NS):
        vid = e.findtext("yt:videoId", namespaces=NS)
        ut.append({"id": vid, "tittel": e.findtext("a:title", namespaces=NS),
                   "beskrivelse": (e.findtext("media:group/media:description", namespaces=NS) or "").strip(),
                   "publisert": (e.findtext("a:published", namespaces=NS) or "")[:10]})
    return ut


def ytdlp(pid):
    res = subprocess.run(["yt-dlp", "--flat-playlist", "-J", f"https://www.youtube.com/playlist?list={pid}"],
                         capture_output=True, text=True, timeout=300)
    if res.returncode != 0:
        raise RuntimeError(res.stderr[-500:])
    data = json.loads(res.stdout)
    return [{"id": e["id"], "tittel": e.get("title") or "", "beskrivelse": (e.get("description") or "").strip()}
            for e in data.get("entries") or [] if e and e.get("id")]


def main(oppsett, utfil):
    lister = yaml.safe_load(open(oppsett, encoding="utf-8"))["spillelister"]
    videoer, feil = [], []
    for sl in lister:
        pid = sl["id"]
        try:
            fra_rss, rss_feil = {v["id"]: v for v in rss(pid)}, ""
        except Exception as e:  # noqa: BLE001  (RSS for spillelister svarer ofte 404; da brukes bare yt-dlp)
            fra_rss, rss_feil = {}, str(e)
        try:
            liste = ytdlp(pid)
            kilde = "yt-dlp"
        except Exception as e:  # noqa: BLE001
            feil.append(f"{sl['navn']}: yt-dlp feilet ({e}); RSS: {rss_feil or 'ok, bare de 15 nyeste'}")
            liste = list(reversed(list(fra_rss.values())))  # RSS er nyeste først
            kilde = "rss"
        for nr, v in enumerate(liste, 1):
            r = fra_rss.get(v["id"], {})
            videoer.append({
                "id": v["id"],
                "url": f"https://www.youtube.com/watch?v={v['id']}",
                "tittel": v["tittel"] or r.get("tittel", ""),
                "beskrivelse": v.get("beskrivelse") or r.get("beskrivelse", ""),
                "publisert": r.get("publisert", ""),
                "miniatyrbilde": f"https://i.ytimg.com/vi/{v['id']}/hqdefault.jpg",
                "spilleliste": sl["navn"],
                "spilleliste_id": pid,
                "nr": nr,
                "fag": sl.get("fag", []),
                "kilde": kilde,
            })
        print(f"{sl['navn']}: {len(liste)} videoer ({kilde})")
    json.dump({"videoer": videoer, "feil": feil}, open(utfil, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for f in feil:
        print("ADVARSEL:", f)
    if not videoer:
        sys.exit("Fant ingen videoer.")


if __name__ == "__main__":
    main(*sys.argv[1:3])
