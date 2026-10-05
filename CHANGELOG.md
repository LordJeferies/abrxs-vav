# Cambios

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
