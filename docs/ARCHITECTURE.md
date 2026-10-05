# Arquitectura

## Principio

```text
                     ABRAXAS OS
                         │
                  Production Graph
                         │
 ┌───────────┬───────────┼───────────┬───────────┐
 Plan      Canter      Dresser     Review     Delivery
                         │
                 ┌───────┴────────┐
                 │                │
             Visual Lab      Workflow Studio
```

## Core compartido

- ProjectStore
- ProductionGraph
- AssetStore
- JobEngine
- OperationLog
- MediaService
- TranscriptService
- Client/Profile resolver
- Plugin/Registry system
- CredentialStore
- Cache
- Diagnostics/Event Bus

## Separación de responsabilidades

### Canter
Decide qué queda y en qué orden: source mapping, transcript, alignment, cut, multicut y assembly.

### Dresser
Decide cómo se visualiza/viste: B-roll, XR, captions, motion, SFX, layout, generation y visual QA.

### Visual Lab
Resuelve assets: buscar, generar, comparar, mejorar, reference consistency, image→video y manual/browser handoff.

### Workflow Studio
Orquesta recipes audiovisuales. No reemplaza Production Graph ni timeline.

### Review
Feedback/aprobación. No cambia automáticamente corte o render sin una operación explícita.

### Delivery
Compila el graph a outputs: final MP4, assets, NLE packages, DaVinci MCP plan, CapCut instructions.

## Adapters

- CanterAdapter
- ReviewAdapter
- VideoFlowAdapter
- RemotionRenderer
- FFmpegMediaAdapter
- DaVinciAdapter
- CapCutKitExporter
- BrowserGenerationAdapter(s)
- GenerationProvider(s)

## Tiempo

La verdad interna es frame/tick based. Evitar floats como identidad temporal canónica. Para 29.97 usar timebase racional (30000/1001).

## Resolución de configuración

```text
System defaults
  → Client Profile
    → Style Pack
      → Project override
        → Piece override
          → Event override
```

La configuración resuelta debe ser inspeccionable y explicar de dónde vino cada valor.
