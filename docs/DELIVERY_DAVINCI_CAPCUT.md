# Delivery, DaVinci y CapCut

## Outputs seleccionables por proyecto, pieza o batch

- final dressed MP4;
- clean MP4;
- preview/reference render;
- B-roll rendered + sources;
- X-roll final + alpha + internal assets;
- SRT/ASS/word JSON;
- animated captions alpha;
- SFX/music;
- Project/Graph manifests;
- DaVinci package;
- CapCut kit.

## DaVinci package

```text
DAVINCI_PACKAGE/
  MASTER/
  BROLL/
  XROLL/
  CAPTIONS/
  SFX/
  MUSIC/
  OVERLAYS/
  ASSET_MANIFEST.json
  EDIT_PLAN.txt
  TIMELINE.json
  DAVINCI_MCP_PLAN.json
  reference_render.mp4
```

`DAVINCI_MCP_PLAN.json` se compila desde Production Graph; no es una segunda fuente de verdad.

## CapCut kit

Assets + captions + alpha overlays + SFX + placement txt/csv/json + reference render. Evitar depender de formatos privados no documentados.
