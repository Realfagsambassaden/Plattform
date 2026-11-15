"""Lager presentasjon.html (frittstående visning) fra deck.json og slides/."""
import json, re
from pathlib import Path

mappe = Path(__file__).parent
d = json.loads((mappe / "deck.json").read_text(encoding="utf-8"))
deler = []
for sid in d["order"]:
    s = (mappe / "slides" / f"{sid}.html").read_text(encoding="utf-8")
    s = s.replace("../bilder/", "bilder/")
    s = re.sub(r"<aside>.*?</aside>", "", s, flags=re.S)
    s = re.sub(r'<x-shape kind="arrow-right"[^>]*></x-shape>',
               '<span style="font-size:96px;font-weight:700;color:#6ef04a">→</span>', s)
    deler.append(f'<div class="ramme" id="{sid}"><div class="lerret">{s}</div></div>')
skrifter = "".join(f'<link rel="stylesheet" href="{f["href"]}">' for f in d["faces"].values())
html = f"""<!DOCTYPE html>
<html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{d["title"]}</title>{skrifter}
<style>
body{{margin:0;background:#070a09;font-family:'Comic Neue',sans-serif}}
.ramme{{width:min(96vw,1600px);aspect-ratio:16/9;margin:2vw auto;position:relative;overflow:hidden;border-radius:8px;box-shadow:0 0 0 1px #2a3330}}
.lerret{{width:1920px;height:1080px;transform-origin:0 0;position:absolute;top:0;left:0}}
.lerret>section{{position:relative;width:1920px;height:1080px;box-sizing:border-box}}
.lerret *{{box-sizing:border-box;margin:0}}
</style></head><body>
{"".join(deler)}
<script>
function skaler(){{document.querySelectorAll('.ramme').forEach(r=>{{r.firstElementChild.style.transform='scale('+r.clientWidth/1920+')'}})}}
addEventListener('resize',skaler);skaler();
</script></body></html>
"""
(mappe / "presentasjon.html").write_text(html, encoding="utf-8")
print("Laget presentasjon.html med", len(deler), "lysbilder")
