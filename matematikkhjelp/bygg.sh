#!/usr/bin/env bash
# Bygger matematikkhjelp.no. Bruker samme verktøy (../verktoy) og utseende (../assets) som fysikkhjelp.no.
#   ./matematikkhjelp/bygg.sh            -> lager ferdig nettside i matematikkhjelp/_site
#   ./matematikkhjelp/bygg.sh preview    -> åpner forhåndsvisning på http://localhost:4201
# Kjøres automatisk av GitHub (se .github/workflows/bygg.yml).
set -euo pipefail
HER="$(cd "$(dirname "$0")" && pwd)"
ROT="$(dirname "$HER")"
export FIG_CACHE="${FIG_CACHE:-$ROT/.figur-cache}"

# Felles utseende og skript hentes fra plattformen (lagres ikke i git her)
rm -rf "$HER/assets"; cp -R "$ROT/assets" "$HER/assets"

python3 "$ROT/verktoy/fag.py" "$HER" matematikkhjelp
python3 "$ROT/verktoy/forside.py" "$HER"
python3 "$ROT/verktoy/emner.py" "$HER"
python3 "$ROT/verktoy/innhold.py" "$HER"

cd "$HER"
if [ "${1:-}" = "preview" ]; then
  quarto preview --port 4201
else
  echo "== Bygger matematikkhjelp.no"
  quarto render
  for f in _pdf/*.pdf; do [ -e "$f" ] || continue; k=$(basename "$f" .pdf); mkdir -p "_site/$k"; cp "$f" "_site/$k/"; done
  echo "Ferdig: $HER/_site"
fi
