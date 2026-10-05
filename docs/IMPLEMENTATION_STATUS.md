# Implementation Status · AbrxsVAV 0.3.0 (paso 0 del plan de 11)

> Base heredada: Foundation 0.2.0 (su estado REAL/MOCK/PENDIENTE sigue válido y está en
> la sección inferior de este archivo). Este bloque refleja el delta AbrxsVAV.

## REAL (0.3.0)

- Repo `abrxs-vav` creado desde Foundation 0.2.0; branding visible renombrado
  (README, título de ventana, productName, index.html). Scope interno `@abraxas/*` intacto.
- Documentación completa: addendum maestro, STATIONS_SPEC, BUILD_PLAN_11_STEPS,
  CONTRACTS_V2_SPEC, MCP_INTEGRATION, HANDOFF_UX, CLOUD_AND_PROVIDERS,
  STABILITY_REQUIREMENTS, UI_CANON, UI_QA_CHECKLIST, SOURCES_AND_REUSE.
- `packages/ui` con `tokens.css` + `materials.css` (design system dark-first del canon).

## PENDIENTE (sigue el BUILD_PLAN_11_STEPS.md)

- Paso 1: contracts v2.3 en TS/Zod + ActionCatalog + scaffold MCP + watchdog/cache del
  JobEngine + Error Boundaries + corpus sintético. (El Lote 1 del chat anterior es el
  material de partida; se integra y valida, no se asume.)
- Pasos 2–10: Canter adapter, vistas compartidas, companion PWA, Dresser batch,
  Visual Lab, XR Composer, captions/delivery, workflow studio, faceless/browser.

---

# Implementation Status · Foundation 0.2.0 (heredado)

## REAL

- Shell React conectada a servicio local Node; Project Hub y Activity con datos reales.
- Crear/seleccionar/reabrir/renombrar proyectos con FPS racional.
- Añadir/editar/quitar eventos con frames enteros y rangos [startFrame,endFrame).
- Importar graph v2 con preview, validación y sustitución deshacible; descargar graph.
- Store versionado en archivos, validación de entrada/lectura, escritura atómica,
  fsync, copia anterior .bak y bloqueo de un único servicio por carpeta.
- CAS por revisión: una ventana obsoleta no sobrescribe otra.
- OperationLog en el mismo archivo/transacción del proyecto; 100 pasos undo/redo.
- JobEngine local de un worker: queued/running/completed/failed/cancelled,
  progress, snapshot de entrada, cancelación, retry manual (3 intentos), dedup.
- Recuperación: queued continúa; running se marca failed/interrupted para reintento.
- Handlers: validación ESTRUCTURAL y compilación del plan de edición TXT.
- Descarga de resultados, errores explícitos, indicadores de conexión y guardado.
- Doctor básico de Node/integridad de registros. Contratos runtime/JSON sincronizados.
- Archivo package-lock y CI reproducible con npm ci.

## MOCK / PROTOTIPO

- Workflow Studio: canvas XYFlow de ejemplo; no ejecuta recipes ni persiste nodos.
- static-preview: diseño antiguo del bootstrap; no representa el estado del core.
- Las páginas de estaciones pendientes describen responsabilidad, no ejecutan funciones.

## PENDIENTE

- Modelo multi-piece y SourceMap; adapter Alfa/Canter/Review con roundtrip sin pérdida.
- AssetStore binario, hashes/provenance de recursos, media ingest/preview/FFmpeg.
- Captions reales, Dresser/render, providers IA/stock y browser-assisted generation.
- Clientes, Visual Lab, recipes, Review, QA audiovisual, DaVinci MCP y CapCut Kit.
- Checkpoints de etapas de media, autoscheduling retry/backoff y resource limits.
- Integración de estos servicios en el editor actual v0.19.3.
- Integración nativa Tauri/Keychain, instalador DMG y certificación real macOS.

## Límites conocidos

Un proyecto contiene un graph; esta versión no migra automáticamente Alfa o graph v1.
No incluye media y no verifica que assetRefs existan. Validar estructura no aprueba un
video. El TXT es instructivo, no ejecuta acciones ni reproduce video.
El estado del servicio es local; no hay autenticación multiusuario ni exposición en red.
Las escrituras atómicas están diseñadas/probadas para filesystem local POSIX, no
carpetas de red. Un archivo corrupto requiere revisión de .bak; no se restaura solo.
La recuperación repite handlers puros del milestone; handlers con efectos externos
necesitarán idempotency/checkpoints antes de registrarse.

## Verificación

`npm run check`, `npm test`, `npm run build`, `npm run doctor`.
Suite core cubre persistencia/reapertura, undo/redo, fallos de escritura, corrupción,
conflictos, recuperación, cancelación, límite de retries y compilación racional.
La verificación de navegador y API se registra en docs/VALIDATION_REPORT.md.
