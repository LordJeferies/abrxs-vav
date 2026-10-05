# Cambios

## AbrxsVAV 0.4.0 · 2026-10-04 (paso 1 del plan de 11)

- Contracts v2.3: delta aditivo en `@abraxas/contracts` — MaterializationStrategy,
  VisualPlanItem, AssetSlot, XrFamilyDefinition, EditGrammar, HandoffPackage,
  ImportResult, PromptRecord, ActionDefinition (12/12 tests verdes).
- ActionCatalog real: `/api/catalog` con las 12 acciones vav.* del servicio —
  principio MCP-first: UI, companion, MCP y tests consumen el mismo catálogo.
- Servidor MCP local `mcp/server.mjs` (stdio, cero dependencias): 13 herramientas,
  incluida `vav_smoke` (E2E real: proyecto → job completed → undo/redo). Escrituras
  exigen confirm:true; modo READ_ONLY disponible.
- Watchdog del JobEngine: timeout por tipo de trabajo (default 15 min, configurable).
- Shell: ModuleErrorBoundary por estación; branding ABRXSVAV v0.4 en la UI.
- Corpus sintético de CI en `samples/corpus/` (podcast con ghost events del canon).
- Sitio oficial en Pages: https://lordjeferies.github.io/abrxsvavstatus/ (status
  dinámico desde este repo + asistente local sin nube).

## AbrxsVAV 0.3.0 · 2026-10-04 (paso 0 del plan de 11)

- Renombrado a AbrxsVAV (branding visible: título de ventana, productName, README).
  Scope interno `@abraxas/*` y IDs de contratos sin cambios, según addendum.
- Nuevo addendum maestro `docs/00_ABRSX_VAV_ADDENDUM.md`: identidad, 8 principios,
  11 estaciones, conceptos v2.1–v2.3, reglas de generación, XR canon, MPT adapter,
  batch, calidad, prohibiciones.
- Docs nuevos: `STATIONS_SPEC.md` (qué/cómo/referencias por estación),
  `CONTRACTS_V2_SPEC.md` (schemas Zod v2.2+v2.3), `BUILD_PLAN_11_STEPS.md`,
  `MCP_INTEGRATION.md` (patrones de los 4 repos propios + ActionCatalog),
  `HANDOFF_UX.md` (prompts copiar/TXT/batch + Import Result),
  `CLOUD_AND_PROVIDERS.md` (Supabase abrxs-vav, Drive, NVIDIA NIM, Firebase fallback),
  `STABILITY_REQUIREMENTS.md`, `UI_CANON.md`, `UI_QA_CHECKLIST.md`,
  `SOURCES_AND_REUSE.md`.
- `packages/ui` nuevo: `tokens.css` + `materials.css` (design system dark-first,
  LiquidGlass solo en UI layer, modos de accesibilidad).
- AGENTS.md ampliado con reglas MCP-first, canon UI, provenance y Definition of Done.
- WORK_START_PROMPT.md reescrito para arrancar el paso 1 con contexto completo.
- Investigación Apple Design 2026 (whats-new/get-started/HIG/resources): doc
  APPLE_HIG_RESEARCH.md con validaciones externas del diseño y 5 adopciones nuevas
  (scroll edge effects, glass tint, checklist HIG de IA, ícono en capas, UI kits 27
  como referencia). UI_CANON.md §13 nuevo; ROADMAP.txt añadido para continuar el
  desarrollo desde cualquier app/agente.

## Foundation 0.2.0 · 2026-10-02

- Implementados ProjectStore, historial undo/redo y JobEngine persistentes.
- Nuevo servicio local Node con archivos atómicos, backups y control de revisión.
- Project Hub y Activity conectados a datos reales; plan por frames editable.
- Import/export graph v2 y resultados estructurales/TXT descargables.
- Contratos de proyecto/operación/trabajo sincronizados, fixtures y tests significativos.
- Lockfile, CI npm ci, smoke UI/API, Doctor básico y documentación de continuidad.
- Auditados los repos propios; registrada la integración futura con Alfa/VideoFlow.
- Referencias del usuario consolidadas y tareas preparadas para Copilot.

## Foundation 0.1.0

Starter UI, schemas iniciales, scaffold Tauri y documentos de producto.
