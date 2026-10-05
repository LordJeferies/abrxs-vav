# ABRXSVAV — NUBES Y PROVIDERS EXTERNOS (Supabase · Drive · NVIDIA · Firebase)

> Decisiones verificadas el 2026-10-04 contra los repos propios (editorial-os,
> abraxas-publisher, editorial-emulator, openshortsX) y el catálogo NVIDIA.

## 1. Supabase — el mismo proyecto, workspace NUEVO

| DECISIÓN | VALOR |
|---|---|
| Proyecto | El mismo de siempre: `jzqxfhlowlllkiqvuqtd.supabase.co` |
| `workspace_key` | **`abrxs-vav`** — workspace NUEVO. Jamás reutilizar `editorial-os` (productos distintos = datos separados, igual que ya lo hace el emulador con su propio workspace) |
| Payload schema | `vav.v1` — versionado desde el día 1, independiente de `version = 9` de Editorial OS |
| Tablas | `vav_state` (estado de jobs/piezas sincronizado con throttle) + `vav_commands` (cola de comandos del companion) |
| Schema de tabla | Mismo patrón probado: `user_id, workspace_key, payload (jsonb), revision, updated_at` + RLS por `user_id` |
| Auth | Email/password del `.env` local (permisos 600), como los MCP de editorial-os/emulator |
| Concurrencia | Toda mutación lleva `expectedRevision` (CAS) — una ventana vieja no pisa a otra |

El companion PWA (paso 4) es el consumidor principal: mismo canal que ya funciona en
editorial-os, con acciones tipadas en vez de mutación libre.

## 2. Google Drive — scopes readonly-first (patrón propio Abrxs-Review)

- **PWA/companion**: OAuth Web client (token client de `gapi`), scope
  `https://www.googleapis.com/auth/drive.readonly` por defecto; `drive.file` se añade
  SOLO cuando hay escritura explícita (así lo hace `drive.js` de Abrxs-Review hoy).
- **Desktop (Tauri)**: OAuth Desktop client separado (split canónico Web vs Desktop);
  implementación Rust (`drive.rs` como publisher).
- El Client ID se puede configurar incluso por MCP (`get/set_drive_client_id` como
  publisher) — el consentimiento OAuth siempre en la UI, tokens JAMÁS en el MCP ni en logs.
- Casos de uso AbrxsVAV: importar assets desde carpetas de cliente, subir kits de
  entrega, sincronizar notas del companion.

## 3. NVIDIA NIM — provider verificado (2026-10-04)

La API key del usuario sirve para todo el catálogo NIM via endpoints OpenAI-compatibles
en `integrate.api.nvidia.com`:

| CAPABILITY | DISPONIBLE | MODEOS |
|---|---|---|
| `llm.complete` | ✅ | Llama, Nemotron, etc. |
| `image.generate` | ✅ | FLUX.1-schnell, Stable Diffusion 3.5 (NIMs oficiales) |
| `vision.analyze` | ✅ | VLMs multimodales — análisis de escenas, QA visual |
| `video.generate` | ⚠️ NO confirmado | Cosmos son world-models mayormente self-hosted. No registrar como provider de video hoy |

**Encaje:** se registra como un provider más del registry con esas 3 capabilities. Usos:
Visual Director (análisis editorial), Visual Lab (generación de imágenes para slots),
QA self-eval (visión). Regla transversal: confirmación humana antes de gastar créditos.

## 4. Firebase — fallback documentado, no se usa

Supabase ya cubre auth + RLS + realtime + storage. Agregar Firebase serían dos verdades
de nube. Se documenta como fallback SOLO si aparece un requisito que Supabase no cubra
(p. ej., ciertas notificaciones push en iOS). No entra en ningún milestone.

## 5. Reglas transversales de providers

- Todo entra por `ProviderRegistry` con capabilities; ningún módulo conoce APIs concretas.
- STRICT FREE MODE: el router nunca cae a un provider pagado silenciosamente.
- Cada asset generado guarda provenance completa (provider, modelo, prompt/seed, hash, licencia).
- Rate limiter + circuit breaker por provider (ver STABILITY_REQUIREMENTS.md).
- Test connection obligatorio al configurar una key (aviso temprano).
- ComfyUI local: workflows como archivos JSON externos (`workflows/image/flux.json`,
  `workflows/video/wan_i2v.json`), sustitución solo de prompt/seed/size/frames/input.
