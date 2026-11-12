#!/usr/bin/env python3
"""Lager bildene til Dashman-boten (assets/js/dashman.js) fra lærerens rigg i repoet Realfagsambassaden/dashman.

Bruk:  python3 verktoy/dashman_bilder.py <sti til dashman-repoet> assets/img/dashman

For hver positur lages et ferdig bilde (lyse kritt-streker, gjennomsiktig bakgrunn). Positurene med munn får egne
bilder for hver munnform (til snakking), og den nøytrale et med lukkede øyne (blunk).
Metoden er den samme som i rigg/eksempel_test.py (munn og øyne byttes ut ved hjelp av rigg.json).
"""
import json, sys, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

RIGG, UT = sys.argv[1] + '/rigg', sys.argv[2]
D = RIGG + '/deler'
R = json.load(open(RIGG + '/rigg.json'))
os.makedirs(UT, exist_ok=True)
HOYDE = 340           # alle positurer skaleres til samme høyde (fra hodet til føttene), så figuren er like stor
KRITT = (236, 239, 230)

def last(n): return Image.open(f'{D}/{n}.png').convert('RGBA')
MUNN = {k: last('munn_' + k) for k in ('lukket', 'o', 'aapen', 'smil_tenner')}
OYNE_L = last('oyne_lukket_v')

def tykk(im, k=3):
    a = im.split()[3].filter(ImageFilter.MaxFilter(k)); ut = Image.new('RGBA', im.size, KRITT + (0,)); ut.putalpha(a); return ut

def lag(n, munn=None, blunk=False, ekstra=None):
    im = last(n); a = np.asarray(im).copy(); r = R.get(n, {})
    lab, n = ndimage.label(a[..., 3] > 20, structure=np.ones((3, 3)))
    boks = ndimage.find_objects(lab)
    def fjern(b, m=4):   # fjern alle strekbiter som ligger helt inne i boksen (øyne/pupiller eller munn, ikke hodet)
        x0, y0, x1, y1 = b
        for k, s in enumerate(boks, 1):
            if s and s[1].start >= x0 - m and s[1].stop <= x1 + m and s[0].start >= y0 - m and s[0].stop <= y1 + m: a[lab == k, 3] = 0
    hoyde = im.height
    if munn and 'munn' in r: fjern(r['munn'])
    if blunk and 'oyne' in r: fjern(r['oyne'])
    im = Image.fromarray(a)
    if munn and 'munn' in r:
        m = MUNN[munn]; x0, y0, x1, y1 = r['munn']
        w = max(10, int((x1 - x0) * {'lukket': 1.0, 'smil_tenner': 0.9, 'o': 0.55, 'aapen': 0.8}[munn]))
        m = m.resize((w, max(4, int(m.height * w / m.width))), Image.LANCZOS)
        im.alpha_composite(m, (int((x0 + x1) / 2 - m.width / 2), int((y0 + y1) / 2 - m.height / 2)))
    if blunk and 'oyne' in r:
        x0, y0, x1, y1 = r['oyne']; o = OYNE_L.resize((int((x1 - x0) * 0.45), int(OYNE_L.height * (x1 - x0) * 0.45 / OYNE_L.width)))
        for cx in (x0 + (x1 - x0) * 0.27, x0 + (x1 - x0) * 0.73): im.alpha_composite(o, (int(cx - o.width / 2), int((y0 + y1) / 2 - o.height / 3)))
    if ekstra:   # (del, x, y, høyde) – legges på i et større lerret, så den kan stå utenfor figuren
        navn, x, y, h = ekstra; e = last(navn); e = e.resize((int(e.width * h / e.height), h), Image.LANCZOS)
        pad = 90; stor = Image.new('RGBA', (im.width + pad, im.height + pad), (0, 0, 0, 0)); stor.alpha_composite(im, (0, pad))
        stor.alpha_composite(e, (x, y)); im = stor
    im = tykk(im); s = HOYDE / hoyde
    return im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)

bilder = {}
def lagre(navn, im):
    im.save(f'{UT}/{navn}.webp', 'WEBP', quality=90, method=6); bilder[navn] = [im.width, im.height]

for m in ('lukket', 'o', 'aapen', 'smil_tenner'): lagre(f'snakk_{m}', lag('peker_tavla', munn=m))
lagre('noytral', lag('noytral')); lagre('noytral_blunk', lag('noytral', blunk=True))
lagre('glad', lag('armer_opp'))
lagre('ler_a', lag('hoho')); lagre('ler_b', lag('hoho_x')); lagre('ler', lag('lattermild'))
lagre('irritert', lag('mystisk', ekstra=('utrop', 215, 0, 110)))
lagre('trist', lag('undrende'))
lagre('tenker', lag('gruble', ekstra=('spm', 230, 0, 100)))
# ikonet på knappen: hodet fra noytral
n = lag('noytral'); lagre('ikon', n.crop((0, 0, n.width, int(n.height * 0.32))))
print(len(bilder), 'bilder,', sum(os.path.getsize(f'{UT}/{k}.webp') for k in bilder) // 1024, 'kB')
