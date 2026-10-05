# ABRXSVAV — INTEGRACIÓN HIGGSFIELD + PROMPT STUDIO (v0.5.0)

> La investigación del usuario sobre Higgsfield (auth `KEY_ID:KEY_SECRET`, ciclo async
> `POST → request_id/status_url → poll`, uploads con presigned URL, soul-styles) y la SPA
> "abrxs vision art creator" se integran **al core de AbrxsVAV**, no como sección suelta.
> Decisión de arquitectura en 3 capas — cada una cumple el principio "providers con
> contratos" (addendum §3.6) y el orden de materialización (local → api → … → manual).

## 1. Las tres capas

```
┌─ CAPA 1: PROMPT STUDIO (packages/prompts) — el cerebro editorial ────────────┐
│  Catálogos de cine (cámaras · lentes · luz · stock fílmico · atmósfera)      │
│  + motor enhance (sujeto INTACTO + capas cinematográficas añadidas)          │
│  + buildHandoff() → HandoffPackage para CUALQUIER IA (Kling/Veo/Freepik/GPT) │
│  Corre local (client-side o in-process). Cero coste. Siempre disponible.     │
└──────────────────────────────────────────────────────────────────────────────┘
┌─ CAPA 2: GENERATION PROVIDERS (apps/service/providers) — la ejecución ──────┐
│  HiggsfieldProvider: submit/poll/soulStyles/upload con presigned URL         │
│  NVIDIA NIM Provider: image.generate (FLUX/SD3.5) + llm (Nemotron)           │
│  DemoProvider: pipeline completo simulado (job → running → done) sin key     │
│  Todos por capability: image.generate / video.generate / soul.styles         │
└──────────────────────────────────────────────────────────────────────────────┘
┌─ CAPA 3: STUDIO UI (Visual Lab en el desktop) — la experiencia ─────────────┐
│  Wizard cómodo: engine → workflow → cámara/lente/luz con referencias visuales│
│  Prompt textarea + "Mejorar" (3 intensidades) → generar → galería con poll   │
│  Batch: aplicar cámara/luz a TODOS los X-rolls del proyecto (edita el grafo) │
│  Export handoff (.txt / copiar) + descarga del resultado al Asset Store      │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Por qué así:** el Prompt Studio es la parte que da **calidad de cine con cualquier
modelo** (incluida la IA del usuario en su web) — vive en el core y no depende de
ninguna API. Los providers son intercambiables (si Higgsfield cambia, se cambia el
adapter — lección de MPT). El wizard conecta Canter→Dresser: Canter corta, **Visual
Studio crea los visuales** de cada pieza.

## 2. Contrato del ciclo Higgsfield (para el adapter)

```
POST /v1/{workflow}        auth: Bearer base64(KEY_ID:KEY_SECRET)  → { request_id, status_url }
GET  {status_url}          poll 2s → backoff → 10s                 → queued/running/completed + outputs
GET  /v1/text2image/soul-styles                                     → catálogo de estilos (fallback local)
POST upload                presigned URL (image/*, video/*, audio/* con validación MIME)
```
Clave de **un solo uso** por sesión en Higgsfield — el Studio la pide, la prueba
(Test Connection muestra HTTP code + latencia) y NUNCA la persiste en el cliente;
en producción vive en env del servicio (`HF_API_KEY`) / Credential Store. Sin key →
`DemoProvider` con pipeline idéntico (job → running → resultados) para verificar todo
sin coste.

## 3. El motor de prompts (reglas "prompt alchemy")

Inspirado en el prompt-skill de Higgsfield y endurecido para cine profesional:

1. **El sujeto es sagrado**: nunca se reescribe sujeto, acción ni encuadre del usuario.
2. **Capas añadidas por intensidad** (1=discreta, 2=cinemática, 3=hostil al amateur):
   luz (3-point, golden hour, practicals…) · lente (35/50/85mm, anamorphic…) ·
   stock/grano (Kodak 5219, halación…) · atmósfera (haze, rain, dust…) · color (teal-orange…) ·
   composición (rule of thirds, leading lines…).
3. **Motion presets del canon R6** mapeados a lenguaje de cámara (ZOOM_IN→"slow push in",
   PAN_LEFT→"whip pan left", SLOW_DRIFT→"subtle floating drift").
4. **Negative siempre incluido** (watermark, text, deformed hands, low contrast…).
5. **Toda receta queda versionada** (PromptRecord) y exportable como HandoffPackage
   con `expectedFilename` — el retorno manual sigue siendo automático.

## 4. Integración con el Production Graph (no es una isla)

- Cada generación/handoff nace de un evento del grafo (slot A01 de un B-roll/X-roll)
  o crea uno propuesto.
- **Batch XR camera plan**: elegir cámara/luz del proyecto aplica a todos los X-rolls
  (edita `extensions` de los eventos vía CAS del ProjectStore — misma acción que la UI).
- Proveedor seleccionado por evento según MaterializationStrategy (`native_api` con
  `providerId: higgsfield|nvidia|demo`; fallbacks a `manual_handoff`).

## 5. Rutas y acciones nuevas (ActionCatalog crece — nunca va detrás)

| ACCIÓN | MÉTODO | QUÉ HACE |
|---|---|---|
| `vav.studio.enhance` | POST | Motor de mejora (capa 1, in-process) → prompt + negative + recipe |
| `vav.studio.generate` | POST | Encola job `media.generate` con strategy (demo/hf/nvidia) |
| `vav.providers.status` | GET | Providers registrados y su salud |
| `vav.providers.test` | POST | Test Connection real (HTTP code + latencia) |
| `vav.handoff.build` | POST | HandoffPackage desde un evento/slot (para cualquier IA) |

MCP tools nuevas: `vav_studio_enhance`, `vav_studio_generate`, `vav_providers_status`,
`vav_providers_test`, `vav_handoff_build`.

## 6. Qué queda para después (honesto)

- Move los métodos del Bridge a rutas server-side **ya está hecho por diseño** (el
  servicio ES el bridge; el secreto nunca toca el cliente).
- Catálogo de los 23 workflows de Higgsfield como datos (`workflows/higgsfield.json`)
  se completa al validar contra la API real con key del usuario (pendiente de parte
  del usuario: obtener KEY_ID:KEY_SECRET y NVIDIA nvapi-).
- Editor de escenas del guion ("cambiar de escena") y short/cinema studio completos
  entran con Dresser MVP (paso 5) — el wizard de esta entrega es su fundamento.
