# Arrancar AbrxsVAV — Paso 1 del plan (Core desktop)

> Este proyecto se llama **AbrxsVAV** (familia Abraxas). Antes de escribir una línea:
>
> 1. Lee `docs/00_ABRSX_VAV_ADDENDUM.md` — define identidad, 8 principios, 11 estaciones,
>    MaterializationStrategy, EditGrammar, Continuity, Handoff Packages, NlePlan, XR canon
>    R6, MPT como adapter, MCP-first y el orden de los 11 pasos. **Gana sobre cualquier
>    otro doc en conflicto.**
> 2. Lee `AGENTS.md` (reglas), `docs/BUILD_PLAN_11_STEPS.md` (orden y verificación),
>    `docs/STATIONS_SPEC.md` (qué construir por estación),
>    `docs/CONTRACTS_V2_SPEC.md` (schemas a implementar),
>    `docs/MCP_INTEGRATION.md` (ActionCatalog y tools),
>    `docs/STABILITY_REQUIREMENTS.md` (P0 del paso 1),
>    `docs/IMPLEMENTATION_STATUS.md` (qué es REAL hoy — no re-implementar).

## Tarea del paso 1 — Core desktop

El paso 0 (este repo: branding + docs + tokens) ya está hecho. El paso 1 entrega el
núcleo con la especificación v2.3:

1. **Contracts v2.3** en `packages/contracts` (TS/Zod según `CONTRACTS_V2_SPEC.md`):
   MaterializationStrategy, VisualPlanItemV3, AssetSlot, XrFamilyDefinition,
   HandoffPackage/ImportResult, EditGrammar, ContinuityGroup, NlePlan, CaptionPolicy,
   DeliverableLevel, PromptRecord, **ActionCatalog**. Los JSON Schema de Foundation
   siguen validando (`npm run check` debe seguir verde).
2. **Integridad** (STABILITY_REQUIREMENTS §1): escrituras atómicas ya existen — añadir
   snapshots de seguridad, lock de proyecto con modo read-only, migraciones con backup.
3. **JobEngine v2**: fases (JobPhase), watchdog por tipo, cache por CacheKey
   (prompt+model+seed+params), recuperación post-crash ya existe — conservarla.
4. **ActionCatalog + scaffold MCP**: `mcp/server.mjs` (stdio → HTTP local de la app) con
   las tools del paso 1 (`vav_status`, `vav_doctor`, `vav_list_projects`,
   `vav_create_project`, `vav_open_project`, `vav_get_graph`, `vav_get_history`,
   `vav_jobs_list`, `vav_job_cancel`, `vav_job_retry`, `vav_smoke`).
5. **Shell**: Error Boundary por módulo, autosave de sesión, Command Palette ⌘K,
   tokens de `packages/ui` aplicados.
6. **Hub + Activity** sobre el ActionCatalog.
7. **Corpus sintético** como fixture de CI (audio corto + transcript fake + clips).

## Reglas del paso

- Ejecuta `npm ci && npm run check && npm test && npm run build` ANTES de empezar; deben
  pasar sobre la base Foundation 0.2 (núcleo REAL — no re-implementar como mocks).
- **PROHIBIDO** providers de IA en este paso. Prohibido tocar Canter 3.8.1 / Review 05.
- Todo trabajo pesado fuera del hilo principal (commands/workers).
- Al terminar: commit → tag → `docs/IMPLEMENTATION_STATUS.md` actualizado
  (REAL/MOCK/PENDIENTE) → verificación vía `vav_smoke`: crear proyecto → job → matar la
  app a mitad → reabrir → recuperar.
- Si algo del starter choca con el addendum, gana el addendum y se documenta el cambio.
