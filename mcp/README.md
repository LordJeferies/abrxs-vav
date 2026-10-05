# AbrxsVAV MCP

Servidor MCP **local por stdio** para operar la app desde Claude / Codex / ChatGPT u
otro cliente MCP — y para **probar la app por código** (vav_smoke).

Patrón: igual que el publisher — el MCP **no tiene base de datos propia**; reenvía al
servicio local (único dueño del estado). Requiere la app corriendo:

```bash
npm start          # servicio en http://127.0.0.1:4317
# o npm run dev (UI + servicio)
```

## Configuración en un cliente MCP

```json
{
  "mcpServers": {
    "abrxs-vav": {
      "command": "node",
      "args": ["/ruta/a/abrxs-vav/mcp/server.mjs"]
    }
  }
}
```

Variables opcionales: `VAV_SERVICE_URL` (otra URL), `VAV_MCP_READ_ONLY=true`.

## Herramientas (crecen con la app — la versión se hereda del servicio; ver docs/MCP_INTEGRATION.md)

`vav_status` · `vav_catalog` · `vav_list_projects` · `vav_create_project` ·
`vav_get_project` · `vav_edit_project` · `vav_undo_project` · `vav_redo_project` ·
`vav_list_jobs` · `vav_create_job` · `vav_cancel_job` · `vav_retry_job` ·
`vav_smoke` (E2E del core) · `vav_studio_*` ×3 · `vav_providers_*` ×2 · `vav_registries_list` · `vav_coach_plan` · `vav_motion_*` ×3 · `vav_clients_*` ×5 · `vav_config_resolve` · `vav_qa_analyze` — 29 tools con paridad 1:1 verificada contra el ActionCatalog (`tests/mcp-parity.test.ts`).

Reglas: las acciones **destructivas** exigen `confirm:true` explícito en los argumentos
(ninguna en v0.4.0); la edición de proyectos usa CAS por revisión; `vav_smoke` crea un
proyecto `SMOKE_…` temporal. Los resultados nunca contienen secretos.
