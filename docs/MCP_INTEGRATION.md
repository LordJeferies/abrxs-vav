# ABRXSVAV — INTEGRACIÓN MCP (principio MCP-first)

> Toda la app debe poder operarse por MCP: tanto para usarla como agente al final, como
> para **probar su ejecución durante el desarrollo por código** (los tests de cada lote
> llaman el mismo catálogo de acciones que expondrá el MCP).

## 1. Patrones extraídos de los repos propios (2026-10-04, clonados y leídos)

### editorial-os / editorial-emulator — "MCP sobre nube compartida"
Servidor Node local por **stdio** con SDK oficial (`server.registerTool(...)` + Zod).
El MCP no toca la app: inicia sesión en Supabase (`signInWithPassword`) y lee/escribe la
misma fila `public.editorial_state` (`user_id, workspace_key, payload, updated_at`) que la
PWA consume. ~25 tools cada uno. Seguridad: `confirm: true` obligatorio en destructivas,
`expectedRevision` para concurrencia optimista, flag `READ_ONLY` en `.env`, password solo
en `.env` local 600.

### abraxas-publisher — "MCP sobre la misma base local"
Shim stdio JSON-RPC (`mcp/server.mjs`) → **bridge binario Rust** (`publisher_mcp_bridge`)
→ la misma SQLite de la app Tauri. *"No existe una segunda base de datos ni una copia
separada del dominio."* ~28 tools: doctor, marcas, fichas, importar, estados,
calendarizar, undo/redo, dry-run, cola, get/set Drive Client ID (sin tokens jamás).

### openshortsX — "MCP remoto HTTP" (app de video, MIT)
Servidor MCP remoto en `/mcp` (Streamable-HTTP sin estado, ~200 líneas propias sin SDK).
Cada tool es una llamada HTTP **de vuelta a la misma app** con la auth del llamador
reenviada (httpx ASGITransport): un agente con su API key tiene exactamente los mismos
límites/permisos que el dashboard. Tools: `process_video`, `create_upload`,
`get_job_status`, `list_clips`, `add_subtitles`, `recut_clip`, `publish_clip`, `get_quota`.

### Principio común de los cuatro
El MCP nunca tiene su propia fuente de verdad; las herramientas son las mismas acciones de
la UI; siempre hay un tool de diagnóstico primero; lo destructivo pide confirmación.

## 2. Decisión de arquitectura AbrxsVAV

```
contracts v2.3: ActionCatalog (nombre, input Zod→JSON Schema, permiso, destructive)
     ├── UI desktop      → llama acciones directamente (in-process)
     ├── Companion PWA   → HTTP local tipado / relay Supabase (mismas acciones)
     ├── mcp/server.mjs  → stdio → HTTP local de la app (patrón publisher)
     └── tests           → llaman el catálogo in-process (verificación por código)
```

- **Fase 1** (paso 1 del plan): `mcp/server.mjs` requiere la app corriendo (HTTP local en
  la app es el único dueño de estado — regla del OWN_REPOS_AUDIT: una sola autoridad).
- **Fase 2** (opcional, después): bridge para lectura when-app-closed, siguiendo el patrón
  publisher si hay necesidad real.
- Las acciones usan **nombres dotted** `vav.<dominio>.<acción>` y `confirm:true` cuando
  `destructive: true`.

## 3. Herramientas MCP por paso (crecen con la app — jamás por detrás)

| PASO | TOOLS QUE SE AÑADEN |
|---|---|
| 1 | `vav_status`, `vav_doctor`, `vav_list_projects`, `vav_create_project`, `vav_open_project`, `vav_close_project`, `vav_get_graph`, `vav_get_history`, `vav_jobs_list`, `vav_job_cancel`, `vav_job_retry`, `vav_smoke` (recorrido E2E del core) |
| 2 | `vav_canter_ingest`, `vav_canter_transcribe`, `vav_canter_list_pieces`, `vav_canter_set_cut`, `vav_canter_confirm_cut`, `vav_canter_export_piece` |
| 3 | `vav_move_piece`, `vav_set_piece_status` |
| 4 | `vav_companion_pair`, `vav_checkpoint_list`, `vav_checkpoint_approve` |
| 5 | `vav_visual_plan_settings`, `vav_visual_plan_run`, `vav_visual_items_list`, `vav_visual_item_approve`, `vav_visual_item_reject`, `vav_stock_search` |
| 6 | `vav_lab_generate`, `vav_lab_compare`, `vav_handoff_export`, `vav_handoff_import_result`, `vav_enhance` |
| 7 | `vav_xr_families_list`, `vav_xr_compose`, `vav_xr_variants`, `vav_xr_render` |
| 8 | `vav_captions_apply`, `vav_delivery_render_piece`, `vav_delivery_compile_kit`, `vav_delivery_nle_plan`, `vav_delivery_provenance_report` |
| 9 | `vav_workflows_list`, `vav_workflow_run`, `vav_review_add_note`, `vav_review_set_status` |
| 10 | `vav_faceless_run`, `vav_browser_adapters_list` |

Convenciones (copiadas de los propios repos): doctor/status primero; list antes que write;
destructivas con `confirm` + `force` donde aplique; resultados devuelven ids y resúmenes,
nunca secretos; undo/redo expuestos como acciones.

## 4. Seguridad

- Allowlist de acciones tipadas (regla 25 del canon de apps). ⛔ `{"shell": "..."}` no existe.
- El servidor MCP corre local por stdio; su `.env` con permisos 600; sin credenciales en tools results.
- `VAV_MCP_READ_ONLY=true` para modo lectura (mismo patrón editorial-os).
- Confirmación humana de créditos: acciones que cuestan dinero exigen confirm explícito.

## 5. Probar la app por código (el doble propósito)

- **Tests de integración**: cada paso del BUILD_PLAN define su smoke via ActionCatalog
  in-process (mismas funciones que la UI). El `vav_smoke` del paso 1: crear proyecto →
  job → cancelar → reintento → crash simulado → recuperación → historia consistente.
- **QA por agente**: durante el desarrollo, un cliente MCP (Claude/Codex) puede ejecutar
  el recorrido completo contra la app real corriendo — lo mismo que hará el usuario final
  con agentes después.
- Foundation ya trae Playwright + smoke scripts (`npm run smoke`, `npm run test:ui`) —
  se extienden, no se duplican.
