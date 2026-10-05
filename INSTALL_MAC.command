#!/bin/bash
# AbrxsVAV — instalador/lanzador para macOS (doble clic o bash INSTALL_MAC.command)
set -e
cd "$(dirname "$0")"
echo "═══ AbrxsVAV · instalación/arranque ═══"
command -v node >/dev/null || { echo "Node no encontrado. Instala Node 22+: brew install node"; exit 1; }
[ -d node_modules ] || { echo "Instalando dependencias (npm ci)…"; npm ci; }
if [ ! -d apps/desktop/dist ]; then echo "Compilando UI…"; npm run build; fi
echo "Arrancando servicio + UI en segundo plano…"
nohup npm start >/tmp/abrxsvav.log 2>&1 &
sleep 3
if curl -s http://127.0.0.1:4317/api/health >/dev/null; then
  open "http://127.0.0.1:4317"
  echo "✓ AbrxsVAV listo en http://127.0.0.1:4317 (log: /tmp/abrxsvav.log)"
else
  echo "Servicio iniciándose… abre http://127.0.0.1:4317 en unos segundos (log: /tmp/abrxsvav.log)"
fi
