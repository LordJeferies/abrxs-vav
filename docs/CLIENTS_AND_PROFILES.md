# Clientes, perfiles y configuración asistida por IA

## Jerarquía
System → Client → Style Pack → Project → Piece → Event.

## Client Profile

- colors/tokens;
- fonts;
- logos;
- portrait/reference assets;
- glossary/canonical spellings;
- caption presets;
- B-roll/X-roll/SFX rules;
- editing grammar;
- source priority;
- negative rules;
- platform profiles;
- export defaults.

## Import intuitivo

Aceptar TXT/MD/JSON. Parsear a draft con confidence. Mostrar diff antes de aplicar. Internamente usar JSON/schema versionado.

## AI roundtrip

`Export for AI` genera raw info + available fields/presets + schema + prompt. La respuesta se valida, normaliza y muestra como diff. Nunca aplicar una respuesta externa sin validación.

## Snapshots

Un proyecto congela una copia de presets/client config para evitar que cambiar el cliente global modifique proyectos viejos silenciosamente.
