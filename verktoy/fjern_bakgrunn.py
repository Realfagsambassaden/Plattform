"""Fjerner hvit bakgrunn som henger sammen med kanten av bildet (flomfyll), men beholder hvitt inne i figuren
(f.eks. hvite bokstaver i fargede sirkler). Kanten mykes opp med fargeavstand til hvitt."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGBA'); a = np.asarray(im).astype(float)
    rgb = a[..., :3] / 255
    avst = (1 - rgb).max(axis=2)                 # 0 = hvit, 1 = langt fra hvit
    nesten_hvit = avst < 0.12
    lab, n = ndimage.label(nesten_hvit)
    kant = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    storrelse = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
    grense = 0.0025 * lab.size   # store hvite felt inne i figuren er også bakgrunn; små (bokstaver) beholdes
    kant |= {i + 1 for i, st in enumerate(storrelse) if st > grense}
    bakgrunn = np.isin(lab, list(kant))
    # myk overgang: piksler like ved bakgrunnen får alfa etter avstand fra hvitt
    naer = ndimage.binary_dilation(bakgrunn, iterations=2) & ~bakgrunn
    alfa = np.ones(avst.shape)
    alfa[bakgrunn] = 0
    alfa[naer] = np.clip(avst[naer] / 0.5, 0, 1)
    ut = a.copy(); ut[..., 3] = (a[..., 3] / 255 * alfa * 255)
    # fjern hvit «glorie» i kantpiksler
    m = naer[..., None] & (alfa[..., None] > 0)
    ut[..., :3] = np.where(m, np.clip((rgb - (1 - alfa[..., None])) / np.maximum(alfa[..., None], 1e-3), 0, 1) * 255, a[..., :3])
    Image.fromarray(ut.round().astype(np.uint8), 'RGBA').save(f, optimize=True)
    print('ok', f)
