#!/usr/bin/env bash
# Bygger fysikkhjelp.no fra fagrepoene.
#   ./bygg.sh            -> lager ferdig nettside i _site
#   ./bygg.sh preview    -> åpner forhåndsvisning på http://localhost:4200
#
# Fagene hentes fra repoene i fag.yml (til kilder/). Forkurset (tidligere TRES0312-kompendiet i LaTeX)
# ligger nå i fagrepoet Realfagsambassaden/fysikk-forkurs.
# Kjøres automatisk av GitHub (se .github/workflows/bygg.yml).
set -euo pipefail
HER="$(cd "$(dirname "$0")" && pwd)"
export FIG_CACHE="${FIG_CACHE:-$HER/.figur-cache}"

python3 "$HER/verktoy/fag.py" "$HER" fysikkhjelp
python3 "$HER/verktoy/forside.py" "$HER"
python3 "$HER/verktoy/tema.py" "$HER"
python3 "$HER/verktoy/innhold.py" "$HER"

cd "$HER"
if [ "${1:-}" = "preview" ]; then
  quarto preview --port 4200
else
  echo "== Bygger nettsiden"
  quarto render
  # PDF-kompendiene (laget av fag.py) legges ved siden av fagets sider
  for f in _pdf/*.pdf; do [ -e "$f" ] || continue; k=$(basename "$f" .pdf); mkdir -p "_site/$k"; cp "$f" "_site/$k/"; done
  echo "Ferdig: $HER/_site"
fi
