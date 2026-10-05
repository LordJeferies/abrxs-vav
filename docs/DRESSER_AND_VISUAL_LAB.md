# Dresser + Visual Lab

## Dresser

Dresser convierte un corte editorial en una pieza visual terminada. Sus eventos siguen siendo editables: mover +/- frames/ms, cambiar duración, asset, zoom, crop, posición, easing, caption policy o SFX sin regenerar todo.

### Timeline sugerido

- A-roll
- XR
- Images/Graphics
- Motion
- B-roll
- VO
- SFX
- Music
- Captions

### Caption policies

FULL, NONE, PRESERVE_EXISTING, INSERTS_ONLY, SMART. Los Visual Types también pueden declarar `SHOW/HIDE/AUTO/MERGE`.

## Visual Lab

Debe sentirse como un “space” creativo dentro de Abraxas, no como una ventana de proveedor:

- contexto del evento y anchor text;
- búsqueda client/source/stock;
- generación image/video;
- referencia de personaje/estilo;
- compare y gallery;
- annotate/reference crop;
- image→video;
- upscale/enhance;
- background removal;
- start/end frame jobs;
- history/provenance;
- import manual.

La estrategia puede ser `client → source → stock → AI image → AI video → keep A-roll` según reglas del cliente.

## Visual Packs

Inspirados en OpusClip templates, Creativly Remotion y tutoriales de motion:

```text
pack/
  manifest.json
  schema.json
  tokens.json
  scenes/
  components/
  assets/
  MOTION-SPEC.md
  preview.mp4
  tests/
```

Niveles de extensión:
1. Preset (solo datos)
2. Recipe (workflow declarativo)
3. Plugin (código aislado)
