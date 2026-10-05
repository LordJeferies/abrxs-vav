# Auditoría de repos propios · 2026-10-02

Lectura de clones públicos fijados en estos commits. No se copió código de estos
repos en esta entrega ni se publicó ningún cambio remoto.

| Repo | Commit leído | Evidencia y decisión |
|---|---|---|
| https://github.com/LordJeferies/abraxas-os | 96ed709b3a7f993d42eb987229975ef23afe9eca | CURRENT_STATUS indica v0.19.3/F1.6. AlphaContent conserva timelineDirectives, parentResourceId/groupRole, staticGraph, sourcePayload y provenance. IndexedDB guarda overlays/drafts. Tiene MediaTransport Rust/HTTP Range y proyección VideoFlow. Preservar editor y modelar adapter explícito antes de unificar persistencia. |
| https://github.com/LordJeferies/Abrxs-Canter | b6c8e4c24a426aa76b6a103e2e705780a8e6d78a | Cargo marca 3.8.1. Engines Python stage1/2/3 y pruebas de intercambio Review. Integración por datos; no reescritura ni lanzamiento automático de Whisper. |
| https://github.com/LordJeferies/Abrxs-Review | e958b82fd727c0d3c12649cacf0a4bbdf4e6de59 | README Review 05: Drive inicial, tiempos manuales, notas separadas de decisiones de corte; no inventar sincronización del iframe. Preservar companion web. |

## Fronteras a resolver antes de integrar

1. Remote Production Graph v1 usa segundos, pieceId y relaciones entre eventos;
   este Foundation graph v2 usa frames con timebase racional y un plan por proyecto.
2. Alfa contiene varios contenidos, formatos estáticos, jerarquías y provenance.
   Un importador que aplana todo a eventos perdería información y no es aceptable.
3. Debe añadirse el modelo de pieza y SourceMap con fixture roundtrip: Alpha → graph
   → Alpha/projection, conservando parent-child, bindings, grupos, T1–T9 y raw source.
4. Las nuevas escrituras deberán pasar por un solo propietario de estado. No conectar
   simultáneamente IndexedDB, VideoFlow drafts y este servicio como tres verdades.
5. La shell de esta entrega permite certificar core con independencia; integrar sus
   capacidades en el editor actual requiere una rama y gates del repo actual.

## Próxima tarea concreta

Definir y probar un adapter AlphaContent que preserve todo el modelo actual, antes
que añadir providers. Después conectar ProjectStore a la shell existente y verificar
el mismo contenido tras reiniciar. El primer flujo de media/render partirá de un clip
con asset local; no hace falta IA para certificar la cadena.
