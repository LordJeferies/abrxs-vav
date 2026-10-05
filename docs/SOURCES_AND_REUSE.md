# ABRXSVAV — FUENTES Y REUTILIZACIÓN (qué se copia de dónde)

> Tabla consolidada de decisión por repo. Complementa `references/REFERENCE_SOURCES.md`
> (54 fuentes con URL) y `references/LICENSE_NOTES.md` (licencias + protocolo de
> provenance). Regla: **MIT/Apache → copiar y adaptar · AGPL/PolyForm/comercial → solo
> estudiar el patrón y reconstruir propio · toda reutilización documenta URL + commit +
> licencia + archivos tomados en `THIRD_PARTY_NOTICES.md`**. Verificar la licencia en el
> commit exacto antes de copiar.

## 1. INTEGRATE — dependencia real

| REPO | LICENCIA | USO EN ABRXSVAV |
|---|---|---|
| XYFlow / React Flow | MIT | Canvas de Workflow Studio y Mapa del proyecto (paso 3 y 9) |
| VideoFlow (core) | Apache-2.0 | VideoJSON, preview, render — siempre tras `EditorAdapter` (su editor React tiene licencia aparte: gratuito hasta 3 empleados; jamás acoplado directo) |

## 2. REUSE — copiar código compatible

| REPO | LICENCIA | QUÉ SE TOMA |
|---|---|---|
| Foundation (este repo, base 0.2.0) | propio | ProjectStore, OperationLog, JobEngine, escrituras atómicas, shell, schemas — REALES, no se re-implementan como mocks |
| Abrxs-Canter 3.8.1 | propio | El motor completo entra vía `CanterAdapter` (paso 2); jamás reescribir |
| Abrxs-Review 05 | propio | Companion web/PWA + flujo Drive readonly-first (`drive.js`) — mismo contrato |
| LiquidGlass | MIT | Materiales del shell (tokens glass) + pack de efectos `xr.glass-ui.v1` |
| Creativly (Remotion) | MIT | Estructura `tokens.ts/scenes/` → spec de Visual Packs y beats |
| OpusClip Video Tools | MIT (partes: templates/remakes) | Catálogos machine-readable, motion specs, componentes Remotion → Visual Pack Registry |
| editorial-os / editorial-emulator MCP | propio | Patrón MCP stdio→Supabase, tools `*_status/get/search/CRUD`, `confirm`, `expectedRevision` |
| abraxas-publisher MCP | propio | Patrón shim stdio→bridge→misma DB, tools doctor/dry-run/undo, Drive Client ID get/set |
| openshortsX | MIT | Naming de tools de video (`process_video/get_job_status/list_clips/…`), transporte HTTP remoto, API-key-as-identity |

## 3. ADAPT — recrear el patrón (sin depender del repo)

| REPO | LICENCIA | QUÉ SE RECREA |
|---|---|---|
| **MoneyPrinterTurbo** | MIT | `material.py` → Asset Finder (stock.search paralelo); `voice.py`/`subtitle.py` → providers; `video.py` → composición batch; `--stop-at` → DeliverableLevel; `video_count` → variants. ⛔ JAMÁS `task.py` |
| Node Banana | MIT | Nodos tipados, ejecución topológica, Array/Router/Switch/HITL, provider abstraction, workflows ComfyUI |
| video-use | MIT | Media intelligence por capas (transcript barato → filmstrip caro), self-eval QA, repair loop, boundary fades |

## 4. REFERENCE — solo estudiar (patrones/UX)

| FUENTE | LICENCIA | QUÉ SE ESTUDIA |
|---|---|---|
| Freepik MCP | MIT | Ciclo search→generate→job→download → construir AssetProvider PROPIO |
| Freepik Spaces / Wireflow | — | UX de Spaces; workflow→REST/MCP |
| Langflow | MIT | HITL checkpoints, stateful sessions |
| n8n | Fair-code | Branching/retry/batch/manual approval — externo, jamás motor interno |
| Clarity Upscaler | — | Upscale multi-step → EnhancementProvider |
| aPulse | Apache-2.0 | Health checks → Doctor |
| OpenMolt | MIT | Agent runtime futuro, permisos scoped |
| XForge | — | Módulos con límites limpios |
| Vibe Workflow | — | UX de pipelines generativos (no su backend MuAPI) |
| Whisper JAX | Apache-2.0 | Provider de transcripción remota |
| Descript / Kapwing | Comercial | UX edición por texto, brand kits, repurpose |
| DaVinci Resolve / CapCut | Comercial | UX de entrega/kits; lo que NO copiamos: multicam, grading, mixing |
| Figma / Linear / Notion | Comercial | Command palette, estados vacíos, paridad pro |
| Apple HIG + Liquid Glass | — | Canon visual completo (docs/UI_CANON.md) |
| 4 videos Remotion (Vox-style) | — | script→beats→asset sheet→scene/layers→choreography→render |

## 5. ⛔ NO integrar (licencia) — solo ideas UX o nada

| REPO | LICENCIA | RAZÓN |
|---|---|---|
| Rescript | PolyForm Noncommercial | Solo ideas de interchange FCPXML/AAF; código prohibido |
| SUPIR | No comercial | Solo concepto teórico de upscale |
| OpenChatCut, SupoClip, ViralMint, Clips Studio | AGPL | Estudiar patrones (timeline agent-native, crash recovery, active speaker) y reconstruir propio |
| OpenShot Qt | GPL | Referencia NLE behavior |
| HyCanvas | Elastic (verificar) | Modularidad, brand kits |
| Flowise | EOL ago-2026 | Descartado, referencia histórica |

## 6. Referencias propias relevantes

| REPO | ROL |
|---|---|
| `LordJeferies/abraxas-os` | Editor Alfa/VideoFlow v0.19.3 — adapter explícito antes de unificar persistencia |
| `LordJeferies/Abrxs_os_v1` | Canon R6/R6.1 (familias XR, estados beta→omega) = gramática oficial de X-rolls |
| `LordJeferies/editorial-os` · `editorial-emulator` · `abraxas-publisher` | Patrones MCP + Supabase/Drive ya verificados en producción |
| `LordJeferies/openshortsX` | MCP de video + HTTP transport |

## 7. Protocolo de provenance en cada PR de reutilización

1. URL del repo y commit/tag exacto.
2. Licencia en ese commit (captura/quote).
3. Archivos o ideas reutilizadas.
4. Modificaciones realizadas.
5. Entrada en `THIRD_PARTY_NOTICES.md` si entra código a producción.
