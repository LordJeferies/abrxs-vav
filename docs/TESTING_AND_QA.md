# Testing y QA

## Pirámide

- contract/schema tests;
- pure core unit tests;
- job/store integration tests;
- media fixtures;
- renderer snapshot/visual regression;
- end-to-end small video fixtures;
- manual audiovisual certification for release.

## Fixture corpus mínimo

- 23.976, 24, 25, 29.97, 30, 50, 59.94;
- H.264/H.265/ProRes donde sea legal/soportado;
- VFR input;
- vertical/horizontal/square;
- stereo/mono;
- burned captions;
- multiple speakers;
- missing audio;
- very long master.

## Visual QA automático

Detectar: black frames, gaps, caption collision/offscreen, face covered unexpectedly, missing assets, wrong aspect, duplicate captions, audio pops, unexpected silence, broken alpha, duration mismatch y cut boundary anomalies.

Repair loop máximo configurable, por ejemplo 3.
