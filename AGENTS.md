# AGENTS.md · Reglas de desarrollo de AbrxsVAV (familia Abraxas)

> **Lee primero `docs/00_ABRSX_VAV_ADDENDUM.md`** (identidad, 11 estaciones, conceptos,
> prohibiciones). Este archivo fija las reglas de comportamiento; el addendum las de producto.

## 1. Fuente de verdad

El `Production Graph` es canónico. Los módulos no deben guardarse verdades paralelas incompatibles.
El NlePlan (DaVinci/CapCut/EDIT_PLAN.txt) SIEMPRE se compila desde el grafo — jamás un segundo plan.

## 2. No hacer un monolito

- Canter no importa internals de Dresser.
- Dresser no importa internals de Review.
- Todos usan contracts/core/adapters.
- Los providers no conocen la UI.
- Los renderers no deciden narrativa.
- La IA propone operaciones/eventos; no muta masters silenciosamente.
- Un plugin que crashea (ej. una familia XR) no tumba el batch ni el shell (Error Boundary por módulo).

## 3. No reescribir lo que ya funciona sin paridad

Abrxs-Canter 3.8.1 y Abrxs-Review 05 deben integrarse de forma incremental. Primero adapter, luego extracción de servicios compartidos, después migración visual si hay paridad verificada.

## 4. Contratos primero

Antes de una nueva feature que cruce módulos:

1. definir contrato/schema;
2. escribir fixture;
3. validar migración/versionado;
4. implementar adapter/handler;
5. agregar UI;
6. agregar prueba.

## 5. Extensibilidad

Nuevos B-rolls, X-rolls, captions, SFX, motion, fonts, treatments, providers, renderers y exporters deben entrar por registry/plugin/preset, no por cadenas crecientes de `if/else`.

## 6. Timing

Usar timebase/frame/ticks enteros como verdad interna. La UI puede mostrar segundos/milisegundos/timecode.

## 7. Estado y jobs

Todo proceso caro debe ser:

- persistente;
- cancelable;
- reintentable;
- idempotente cuando sea posible;
- cacheable por fingerprint;
- aislado para que un fallo no tumbe el batch.

## 8. Assets

Cada asset debe guardar provenance: origen, provider, modelo, prompt, seed/opciones cuando aplique, hash, licencia/fuente y relación con el evento editorial.

## 9. Credenciales

Nunca guardar secretos en proyecto, JSON, logs ni Git. En macOS usar Keychain; en otros entornos, secure credential store equivalente.

## 10. Código de terceros

Los repos de `references/REFERENCE_SOURCES.md` son material de estudio y posible reutilización selectiva. Antes de copiar código:

- verificar licencia actual;
- documentar origen;
- copiar solo lo necesario;
- respetar NOTICE/attribution/copyleft;
- evitar incorporar directamente código no comercial a un producto comercial.

## 11. UX

La app debe permitir tanto:

- **Auto:** procesar lotes y salir con video terminado;
- **Assisted:** propuestas editables antes de generar;
- **Manual Pro:** control preciso de timing, transform y assets;
- **Directed:** importar un plan ya definido.

Todos convergen al mismo graph.

## 12. Browser automation

Es fallback, no primera opción. Prioridad: local/native → API/tool → browser adapter → manual handoff. No intentar evadir login, CAPTCHA, límites o restricciones de servicios.

## 13. Definition of Done

Una feature no está terminada solo porque compila. Debe incluir:

- contrato;
- UI mínima;
- error handling;
- persistencia si corresponde;
- test;
- diagnóstico;
- documentación;
- comportamiento de fallback;
- **acción en el ActionCatalog** (ver regla 14);
- **PROJECT_STATUS.json actualizado y VAVStatus reflejando el estado** (VAVStatus es parte del DoD desde 0.6.0);
- **cumplimiento del canon UI** (ver regla 15).

## 14. MCP-first

Toda acción del core vive en un único `ActionCatalog` (contracts v2.3) del cual salen la
UI, el companion PWA, el servidor MCP (`mcp/server.mjs`) y los tests de integración. Si
una feature no expone su acción, no está terminada. Herramientas `vav.*` tipadas;
`confirm:true` obligatorio en destructivas; resultados sin secretos; doctor/status
primero. Patrones y plan de tools por paso: `docs/MCP_INTEGRATION.md`.

## 15. Canon UI

Toda UI nueva cumple `docs/UI_CANON.md` (tokens, dos capas, densidad pro-tool, matriz de
11 estados) y el checklist de `docs/UI_QA_CHECKLIST.md` como parte del Definition of
Done. LiquidGlass solo en la capa UI; el contenido es sólido.

## 16. Handoff manual

El usuario siempre puede exportar prompts para IA externa (copiar · .txt · batch) y
re-importarlos por `expectedFilename`. Todo slot de asset contempla el modo
`manual_handoff` — ver `docs/HANDOFF_UX.md`. Nunca bloquear la app si un provider o un
sitio externo cambia.

## 17. Prohibiciones duras

Ver §18 del addendum: no usar `task.py` de MPT, no providers antes del paso 1, no
reescribir Canter 3.8.1/Review 05, no segundas fuentes de verdad, no acoplar providers
directo a módulos, no saltarse checkpoints humanos, no publicar secretos, no integrar
código AGPL/PolyForm/no-comercial.
