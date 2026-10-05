# Módulos y situaciones de uso

## 1. Podcast largo → clips terminados

1. Canter ingiere master.
2. Transcript word-level + source map.
3. Se crean fichas/cortes.
4. Dresser analiza cada pieza.
5. Visual Director propone B-roll/X-roll/captions/SFX.
6. Visual Lab resuelve assets.
7. Renderer compone.
8. QA valida.
9. Review aprueba.
10. Delivery exporta.

## 2. 20 clips verticales ya cortados

Saltarse Canter. Import batch → transcript si falta → Dresser preset → generar → render → QA → 20 MP4. Export opcional de assets.

## 3. Video ya tiene captions quemados

Caption policy:
- NONE;
- PRESERVE_EXISTING;
- INSERTS_ONLY: captions Dresser solo cuando un B-roll/X-roll fullscreen tapa los quemados;
- SMART: analiza si el insert cubre la región de captions.

## 4. Solo captions

Dresser puede ejecutar únicamente Caption Engine, exportar final y SRT/ASS/word JSON/alpha captions.

## 5. Solo B-rolls

No tocar captions ni XR. Generar/resolver B-rolls y exportar final o assets-only.

## 6. Solo guion / transcript

Plan/Preproduction produce beats, Visual Plan, asset plan, SFX, recording directions y referencias. Timing es textual/aproximado hasta alinear video real.

## 7. X-roll complejo

Un XR es mini composición con scenes/states/layers/assets. Puede tener background/midground/foreground, deterministic text, SFX, motion y renderer programático.

## 8. Generación externa

El evento crea AI Package (prompt, references, duration, aspect, purpose, negatives, expected filename). El usuario genera fuera y usa Import Result.

## 9. Browser-assisted generation

Adapter abre la web, verifica login, carga referencias, aplica parámetros permitidos, genera y descarga. Fallback si cambia UI: manual handoff. Nunca saltarse controles del proveedor.

## 10. DaVinci

Delivery puede crear:
- assets organizados;
- edit plan TXT;
- timeline/placement JSON;
- FCPXML/EDL cuando corresponda;
- `DAVINCI_MCP_PLAN.json` compilado desde Production Graph;
- reference render para verificar intención.

## 11. CapCut

CapCut Kit conserva assets, SRT, alpha overlays, SFX, placement TXT/CSV/JSON y reference render. No depender de formatos privados inestables.

## 12. Cliente nuevo

Importar TXT/MD/JSON desordenado → parser produce draft → diff → approve. Opcional “Export for AI” para que una IA complete campos bajo schema y reimportar respuesta.

## 13. Faceless / voiceover

Script → VO → visual beats → B-roll/X-roll → captions → music/SFX → render. Misma arquitectura; no crear un engine paralelo.

## 14. Review-only

Importar medias y notas; no requiere transcripción/render. Abrxs-Review web sigue como companion para Drive/iPhone.

## 15. Crear assets sin video

Visual Lab funciona independiente y guarda en Client/Project/Global Library.
