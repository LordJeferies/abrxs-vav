# ABRXSVAV — PRODUCT ADDENDUM MAESTRO

> **Este documento complementa `README.md`, `docs/PRODUCT_SPEC.md` y el resto de `docs/`.
> Donde haya conflicto, este addendum gana.** Última actualización: 2026-10-04 (v1.2).

---

## 1. Identidad

| QUÉ | DECISIÓN |
|---|---|
| Producto | **AbrxsVAV** (VAV = Video · Audio · Visual) |
| Familia / marca paraguas | **Abraxas** — tus repos Abrxs-* siguen siendo "Abraxas" internamente |
| Repo principal | `LordJeferies/abrxs-vav` |
| Scope interno de paquetes | `@abraxas/*` — **NO cambia** (los IDs internos de contratos no cambian; solo branding visible) |
| Versión de arranque | 0.3.0 (base: Foundation 0.2.0 con núcleo REAL) |
| Barra de calidad | La intro del EP55 es el **mínimo**, no el techo |

## 2. Qué es / qué NO es

**Es:** una app de escritorio (con companion PWA) donde un proyecto va desde un guion o
un podcast crudo hasta piezas terminadas, vestidas, revisadas y entregadas — sin saltar
entre 4+ herramientas. El usuario entra por donde esté: máster crudo → Canter; 20 clips
ya cortados → Dresser; solo guion → Plan. Estaciones, no wizard obligatorio.

**NO es:**
- No es un generador automático estilo MoneyPrinter que escupe videos sin control. La IA propone, tú apruebas.
- No es n8n genérico (Gmail, CRM, weather). Es producción audiovisual, solo eso.
- No es un editor frame-a-frame tipo Premiere/DaVinci. Decide qué queda, cómo se viste, y exporta o entrega kit de edición.
- No reemplaza a DaVinci: sin grading completo, sin multicam, sin mezcla de audio profesional.
- No es una app cerrada: **todo el core es operable por MCP** (ver `docs/MCP_INTEGRATION.md`).

## 3. Los 8 principios

1. **El Production Graph es la única verdad.** Canter escribe cortes, Dresser escribe planes visuales, Review escribe notas — todos sobre el mismo grafo. Los módulos nunca importan código de otros módulos; todos importan los contratos. No existen "plan Dresser" y "plan DaVinci" separados: el NlePlan se **compila** desde el grafo.
2. **El tiempo canónico son frames** (enteros, `out` exclusivo). Cada máster declara su fps; los timestamps del transcript son pista de búsqueda, no autoridad. Los cortes se confirman manualmente (apertura/cierre alineados al texto).
3. **Toda acción de IA crea una operación registrada** en el Operation Log. Nunca modifica el máster en silencio. Undo/redo y auditoría salen gratis.
4. **Human-in-the-loop por defecto.** Los workflows tienen checkpoints de aprobación; los jobs caros piden confirmación antes de gastar créditos.
5. **Los motores que ya funcionan no se reescriben.** Canter 3.8.1 y Review 05 entran por adapters.
6. **Todo lo externo entra por providers con contratos.** Dresser/Lab piden `capability = stock.search` o `image.generate`; nunca llaman a una API concreta.
7. **Aislamiento total.** Registries + plugins versionados (`xroll.comic-info@1.2.0`); si un plugin crashea, el batch de 20 sigue; Error Boundary por módulo en la UI; el core no sabe qué es COMIC_INFO ni Montserrat.
8. **MCP-first.** Cada acción del core se expone en un `ActionCatalog` único del cual salen la UI, el companion, el servidor MCP y los tests de integración (ver `docs/MCP_INTEGRATION.md`).

## 4. Las 11 estaciones

```
ABRXS VAV
│
├── HUB            proyectos + estado por estación + continuar donde ibas
├── PLAN           guion → estructura de beats → preproducción visual
├── CANTER         transcribir · alinear · seleccionar · cortar
├── DRESSER        planes visuales · captions · XR · timeline + QA
├── VISUAL LAB     search · generate · compare · i2v · upscale · storyboard
├── WORKFLOW STUDIO video automation (Array · Router · HITL · batch)
├── REVIEW         notas · comparación · aprobación (transversal)
├── DELIVERY       MP4 · CapCut Kit · DaVinci Package · NlePlan · ref render
├── CLIENTS        brand · fonts · glossary · reglas · grammars
├── LIBRARY        assets · packs · plantillas
└── ACTIVITY       Job Engine global · Doctor · logs · recuperación post-crash
```

Spec completa por estación (qué hace, qué NO hace, cómo, qué construir, referencias,
criterio de verificación): **`docs/STATIONS_SPEC.md`**.

## 5. Conceptos de primera clase (schemas en `docs/CONTRACTS_V2_SPEC.md`)

| # | CONCEPTO | DECISIÓN |
|---|---|---|
| 1 | **MaterializationStrategy** ⭐ | El evento visual guarda QUÉ es separado de CÓMO se produce. Modos: `local \| native_api \| tool_api \| browser_adapter \| manual_handoff`, con `fallbacks` en ese orden. Va en contratos desde el primer lote aunque solo se implementen 2 modos. |
| 2 | **VisualPlanItem v3** | Unifica B-roll simple y X-roll complejo: mismo objeto, distinta complejidad de materialización. Incluye `purpose` (por qué existe), `anchorText`, `brollType`, `familyId`, `assetSlots`, `variants`, `deliverable`. |
| 3 | **EditGrammar** | Estilos de edición (`EDITORIAL_DOCUMENTARY_V1`, `FAST_SOCIAL_V1`) como dato de primera clase, junto al Client Profile. |
| 4 | **ContinuityGroup + Start/End Frame** | Grupos de coherencia por personaje/estilo/localización + imágenes inicio/fin para i2v. |
| 5 | **HandoffPackage** ⭐ | Prompt + negative + outputSpec + references + expectedFilename + returnInstructions. "Import Result" matchea por `expectedFilename` y sabe qué evento era. Ver `docs/HANDOFF_UX.md`. |
| 6 | **NlePlan** | SIEMPRE compilado desde el Production Graph (plan DaVinci MCP, CapCut guide, EDIT_PLAN.txt). Nunca un segundo plan. |
| 7 | **Reference render** | Proxy final de baja resolución incluido en el kit: muestra cómo debe quedar antes del montaje externo. |
| 8 | **XrProductionState** | Canon R6.1: `beta → alfa → generated → approved → omega`. |
| 9 | **DeliverableLevel** | Equivalente a los stop-at de MPT: `assets_only \| preview \| final`. |
| 10 | **AssetSlot + XrFamilyDefinition** | La unidad del Asset Plan (A01, A02…) y la familia XR como plugin versionado con estados de cámara. |
| 11 | **CaptionPolicy** | `full \| none \| preserve_existing \| inserts_only \| smart` — obligatorio soportar videos con captions quemados. |
| 12 | **ActionCatalog** (v2.3) | Catálogo único de acciones tipadas → UI / companion / MCP / tests. Ver `docs/MCP_INTEGRATION.md`. |
| 13 | **PromptRecord** (v2.3) | Todo prompt de IA queda versionado con su job (reproducibilidad y "por qué salió así"). |

## 6. Reglas de generación

- **Prioridad de materialización:** `local → native_api → tool_api/MCP → browser_adapter → manual_handoff`.
- **Browser Generation Adapter:** Playwright, SIEMPRE adapter aislado (si el sitio cambia, falla ese adapter y nada más). Sin saltarse login, CAPTCHA ni límites. Confirmación humana antes de gastar créditos. Es plugin, nunca core, y el último en prioridad.
- **Toda generación (los 3 caminos) termina en el mismo AssetStore** con provenance (origen, provider, modelo, prompt, seed, hash, licencia).
- **Coste por diseño (modo Dressing):** de un podcast de 120 min se generan minutos de material IA (18 clips × 5–15 s), nunca horas. El XR Composer es determinista: la IA genera assets, nunca movimientos de cámara sobre másters.

## 7. XR canon R6/R6.1 = gramática oficial

| FAMILIA | MATERIALIZACIÓN | NOTA |
|---|---|---|
| PHOTOS | Casi directa | buscar/generar 2–3 imágenes + montaje |
| COMIC_CC | Muy compatible | 3 escenas IA; texto lo renderiza AbrxsVAV (editable) |
| COMIC_INFO | Adapter | 1 máster + estados de cámara deterministas (FFmpeg/Remotion) |
| OBJECTS | Solo generación IA | la composición/posicionamiento es del Composer |
| PHOTO_OBJECT | Parcial | foto + objetos; capas programáticas |
| TYPO | ⛔ Nunca delegar | Remotion determinista — mejor calidad, coste cero, editable |
| NO_XR | Nada que generar | mantener A-roll — decisión editorial válida |

Ejemplo canónico (XR03 COMIC_INFO de Amanda): 1 máster generado → 5 estados FFmpeg
(push-in/pan/pull-out con timings) → FINAL. Editar un timing solo re-renderiza; jamás
re-llama a IA. Densidad de referencia ≈ 1 XR / 5 min, pero **función narrativa > cuota**.

## 8. MoneyPrinterTurbo = GenerationAdapter (motor, NUNCA director)

| PARTE DE MPT | DECISIÓN |
|---|---|
| `app/services/task.py` (orquestador) | ⛔ NO usar — reinterpretaría el guion y destruiría decisiones editoriales |
| `material.py` (stock Pexels/Pixabay/Coverr) | ✅ provider `stock.search` (patrón del Asset Finder) |
| `voice.py` (TTS) | ✅ provider `tts` (Faceless Mode y VO de X-rolls) |
| `subtitle.py` (Whisper) | ✅ provider `transcribe` |
| `video.py` (combine/generate 9:16/16:9/1:1) | ✅ motor de composición batch (recetas Faceless) |
| `--stop-at` | ✅ absorbido → `DeliverableLevel` |
| `video_count` | ✅ absorbido → `variants[]` |
| `match_materials_to_script` | ✅ superado por `anchorText` + alineación word-level |

**Regla de oro:** a MPT nunca se le envía "un guion" para que decida. Se le envían jobs
compilados con decisiones exactas (queries, prompts, duraciones, negatives). Si MPT
desaparece mañana, se cambia el adapter y AbrxsVAV no se entera.

## 9. Pipeline Asset Sheet (obligatorio antes de generar)

```
VISUAL PLAN      qué eventos y por qué (ghost events punteados)
      ↓
ASSET PLAN       qué slots necesita cada evento (A01, A02, mapa, cifra…)
      ↓
ASSET RESOLUTION cada slot se resuelve por prioridad:
                 cliente → frames del máster → stock → imagen IA → video IA
      ↓
COMPOSITION      XR Composer / Remotion compone con capas
      ↓
RENDER + QA      self-eval pre-review obligatorio
```

Reglas heredadas de los videos de referencia de Remotion: sistema visual bloqueado
(fondo/fuentes/paleta fijas por cliente; varían los elementos, nunca el sistema); XR =
mini-composición en capas (scene.json + background/midground/foreground/overlays/captions
+ motion.json); beats del transcript asignados a eventos con propósito.

## 10. Batch + Visual Plan Settings

- Preset **"Vertical Podcast"**: ingest de 20 clips → transcript → ghost events → assets → Ken Burns → captions → FFmpeg → 20 MP4.
- **Auto-aprobar** opcional para lote; sin él, revisión manual de ghost events.
- Densidades de REFERENCIA (no obligación): B-roll 3–6/min; XR ≈ 1 cada 5 min. `NO_XR` y "mantener cámara" son decisiones válidas.
- Jobs aislados: si el B-roll del video 13 falla, los otros 19 siguen.
- Cache por hash(prompt+model+seed+params): editar transform/timing solo re-renderiza.
- Resolución de configuración: System → Client → Project → Video → Event (gana la más específica); presets congelados por snapshot; botón "View Resolved Config".

## 11. Handoff UX (resumen → ver `docs/HANDOFF_UX.md`)

Tres niveles de exportación de prompts: copia instantánea (un clic), `.txt` individuales
por slot, y **exportación batch en carpeta organizada** (`HANDOFF_EP32/C07/BR03_….txt`
+ `_LEEME.txt` + `C07_ALL_PROMPTS.txt` + frames de referencia). El retorno es automático
por `expectedFilename` (Import Result). `manual_handoff` es modo de primera clase y se
implementa antes que las APIs.

## 12. MCP-first (resumen → ver `docs/MCP_INTEGRATION.md`)

Un solo `ActionCatalog` alimenta 4 consumidores: UI desktop, companion PWA, servidor MCP
(`mcp/server.mjs` por stdio → HTTP local de la app) y tests de integración. Herramientas
`vav_*` con `confirm:true` en destructivas y `expectedRevision` en escrituras de nube.
Cada lote añade sus herramientas junto con su feature. Patrones tomados de los propios
repos editorial-os / editorial-emulator / abraxas-publisher / openshortsX.

## 13. Calidad (barra mínima)

Controlar las 5 capas — editorial (todo visual tiene propósito), visual (consistencia
palette/fonts/texture), motion (push, parallax, reveals — no zoom 110%), audio (SFX
motivado, ducking), ritmo (cambios por speech beat, no cadencia fija). QA self-eval
pre-review obligatorio. Criterios detallados: `docs/QUALITY_BAR.md` (existente).

## 14. LiquidGlass — doble uso + dos capas

- **(a) UI del shell** con UI Effect Registry (Performance / Balanced / Full) — SOLO en capa UI (nav, toolbars, popovers, inspectores), nunca sobre contenido. Glass en 2–3 superficies grandes simultáneas máximo.
- **(b) Motion effect pack** (`glass.panel`, `glass.title`, `glass.lower-third`) para Remotion/VideoFlow.
- Independientes entre sí. Tokens y reglas: `docs/UI_CANON.md`. Checklist de aceptación: `docs/UI_QA_CHECKLIST.md`.

## 15. Nubes y providers externos (→ ver `docs/CLOUD_AND_PROVIDERS.md`)

Supabase mismo proyecto, `workspace_key = abrxs-vav` (NUEVO workspace, jamás editorial-os),
tablas `vav_state` + `vav_commands`, payload `vav.v1`. Drive con split OAuth Web/Desktop y
`drive.readonly` por defecto. NVIDIA NIM como provider de `llm.complete` / `image.generate` /
`vision.analyze` (NO de video). Firebase: solo fallback documentado, no se usa hoy.

## 16. Milestones → `docs/BUILD_PLAN_11_STEPS.md`

11 pasos (0–10) en 4 etapas, ≈22 semanas de ritmo de sesiones. Cada paso termina en una
release utilizable con criterio de salida verificable. **PROHIBIDO saltar a providers de
IA antes de completar el Core (paso 1).** Canter 3.8.1 y Review 05 intactos hasta adapters.

## 17. Repos externos — regla

Etiquetas REFERENCE / ADAPT / REUSE / INTEGRATE / ⛔ según `references/LICENSE_NOTES.md`
y la tabla consolidada de `docs/SOURCES_AND_REUSE.md`. Freepik MCP = entender
search/generate/jobs y construir AssetProvider PROPIO. MoneyPrinterTurbo = patrón para el
buscador nativo. **Ningún MCP externo se acopla directo a la app.** Toda reutilización
documenta URL + commit + licencia + archivos tomados en `THIRD_PARTY_NOTICES.md`.

## 18. Prohibiciones duras

1. No usar `task.py` de MPT ni enviarle guiones a reinterpretar.
2. No conectar providers de IA antes del paso 1 completo (core verificado).
3. No reescribir Canter 3.8.1 ni Review 05 — adapters primero.
4. No crear segundas fuentes de verdad (ni "plan DaVinci" paralelo, ni DB del MCP, ni IndexedDB + servicio a la vez sin un único dueño de estado).
5. No acoplar ningún provider/API directo a módulos — todo por capability/registry.
6. No saltarse checkpoint humano en generación cara.
7. No publicar secretos en repo, docs, logs ni MCP tool results.
8. No integrar código AGPL/PolyForm/no-comercial (OpenChatCut, SupoClip, ViralMint, Clips Studio, Rescript, SUPIR, OpenShot, HyCanvas) — solo estudiar patrones.
