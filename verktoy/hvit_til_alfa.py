"""Gjør hvit bakgrunn gjennomsiktig (som «Color to alpha» i GIMP), uten å endre fargene på strekene."""
import sys
import numpy as np
from PIL import Image
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGBA'); a = np.asarray(im).astype(float) / 255
    rgb, al = a[..., :3], a[..., 3]
    alfa = np.clip((1 - rgb).max(axis=2) / 1.0, 0, 1)          # hvor langt fra hvitt
    alfa = np.where(alfa < 0.04, 0, alfa)                        # støy i bakgrunnen
    med = np.where(alfa[..., None] > 0, (rgb - (1 - alfa[..., None])) / np.maximum(alfa[..., None], 1e-6), 0)
    ut = np.dstack([np.clip(med, 0, 1), alfa * al])
    Image.fromarray((ut * 255).round().astype(np.uint8), 'RGBA').save(f, optimize=True)
    print('ok', f)
