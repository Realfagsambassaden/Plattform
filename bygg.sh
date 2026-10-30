#!/usr/bin/env bash
# Bygger fysikkhjelp.no fra fagrepoene.
#   ./bygg.sh            -> lager ferdig nettside i _site
#   ./bygg.sh preview    -> åpner forhåndsvisning på http://localhost:4200
#
# Kildene (kompendiene) hentes fra disse mappene. Standard er mappen kilder/ ved siden av dette repoet,
# men du kan peke på dine egne kopier, f.eks.:
#   TRES0312="$HOME/…/TRES0312 på GitHub" ./bygg.sh preview
# Kjøres automatisk av GitHub (se .github/workflows/bygg.yml).
set -euo pipefail
HER="$(cd "$(dirname "$0")" && pwd)"
TRES0312="${TRES0312:-$HER/kilder/TRES0312}"
export FIG_CACHE="${FIG_CACHE:-$HER/.figur-cache}"

echo "== Forkurs (TRES0312) fra $TRES0312"
python3 "$HER/verktoy/convert.py" "$TRES0312/TRES0312_Kompendium" "$HER"
python3 "$HER/verktoy/meny.py" "$HER"

cd "$HER"
if [ "${1:-}" = "preview" ]; then
  quarto preview --port 4200
else
  echo "== Bygger nettsiden"
  quarto render
  echo "Ferdig: $HER/_site"
fi
