# ABRXSVAV — TIPOS DE CONTENIDO QUE LA APP DEBE PRODUCIR

> Derivado del análisis de los repos reales del pipeline LordJeferies (2026-10-04):
> `Abrxs_os_v1` (canon R6/R6.1, Geometra), `ABRXOS-builders-r6`, `Abrxs_pages` (Lienzos),
> `editorial-os` + `editorial-emulator` (calendario multi-marca, planner, feeds),
> `abraxas-publisher` (programación/publicación), `Abrxs-Canter`, `Abrxs_transcriber_v1`,
> `Abrxs_cutter_v1`, `joc-html-public`, `joc-review`. Fuente de verdad de las librerías:
> `Abrxs_os_v1/canon/r6/runtime/libraries/{XR_FAMILIES,MOTION_LIBRARY,SFX_LIBRARY}_R6.json`.

## 1. Mapa de productos de contenido del pipeline

| PRODUCTO | FORMATO | DÓNDE SE HACE HOY | EN ABRXSVAV |
|---|---|---|---|
| Podcast largo / episodio completo | 16:9 máster | cámaras + Canter | **Canter** (cortes) + **Dresser** (XR cada ≈300 s) |
| Clips verticales | 9:16 (1080×1920) | Canter → cutter | **Dresser batch**: 2–4 XR por clip + B-rolls + captions |
| Clips horizontales | 16:9 (1920×1080) | Canter | **Dresser**: XR ≈1 cada 120 s |
| Intros (estilo EP55) | 16:9, duración corta | Geometra/fichas → lienzos | **Plan + Dresser**: densidad XR_INTRO = **exactamente 6** |
| Carruseles / posts | HTML pages (Lienzos) + imágenes feed | Abrxs_pages, editorial-os planner | **Plan/Dresser → Delivery**: export Lienzo-HTML + PNG grid; planner lots L1/L2/L3 |
| Fichas editoriales | JSON/HTML revisables | Abrxs_os_v1, joc-review | **Review**: fichas con targetRef, aprobación |
| Publicación programada | multi-plataforma | abraxas-publisher | **Delivery → n8n externo / publisher** (no nativo) |

## 2. X-Rolls — gramática oficial (canon R6)

Familias (plugins versionados del Visual Registry):

| FAMILIA | QUÉ ES | MATERIALIZACIÓN |
|---|---|---|
| `COMIC_INFO` | panel cómic con info/datos en zonas (4 zonas + centro, recorrido de cámara) | 1 máster IA + estados FFmpeg deterministas |
| `COMIC_CC` | escenas cómic con texto hablado integrado | 3 escenas IA; texto lo renderiza la app (editable) |
| `TYPO` | tipografía animada | ⛔ Remotion determinista, JAMÁS IA |
| `PHOTOS` | fotos con recorrido | 2–3 imágenes + Ken Burns |
| `OBJECTS` | objetos sobre fondo limpio | IA genera objetos; Composer posiciona |
| `PHOTO_OBJECT` | foto + objetos en capas | foto + objetos; capas programáticas |
| `NO_XR` | mantener A-roll | decisión editorial válida |

**Densidad por formato** (canon R6, campo `density`): intro XR_FULL `exact: 6` ·
vertical `min 2, max 4` · horizontal `approxPerSeconds: 120` · full_episode
`approxPerSeconds: 300` (≈1 cada 5 min).

**Reglas de selección** (campo `selectionRules`): no repetir la misma familia en
eventos consecutivos · preferir diversidad antes que repetición · **el ajuste narrativo
anula la diversidad** (narrativeFitOverridesDiversity). Estados de producción:
`beta → alfa → generated → approved → omega`.

## 3. Motions — librería cerrada de presets (MOTION_LIBRARY_R6)

"El motion describe cómo cambia en el tiempo un visual que YA existe" (nunca inventa
contenido). Presets del canon (el sistema los implementa como transform FFmpeg/Remotion):

```
STATIC · ZOOM_IN (scale 1.0 → 1.05–1.18, ease-in-out) · ZOOM_OUT (inverso)
PAN_LEFT · PAN_RIGHT · PAN_UP · PAN_DOWN
ZOOM_IN_PAN · ZOOM_OUT_PAN (escala + posición simultáneos)
SLOW_DRIFT (deriva sutil continua)
```

Regla de calidad derivada: zoom máximo sugerido 1.18 — nada de "zoom 110% flaco";
easing único `ease-in-out`; los motions se asignan por estado del XR y por B-roll.

## 4. SFX — librería reconocible y reutilizable (SFX_LIBRARY_R6)

Regla canónica: *"Reusar una librería pequeña y reconocible. La repetición es
preferible a inventar un sonido nuevo para cada evento."*

```
SFX_CLICK (soft/medium/deep) · SFX_CLICK_DEEP · SFX_KEYBOARD (soft/mechanical)
SFX_WHOOSH (soft/medium/short) · SFX_CAMERA · SFX_GOOD · SFX_WRONG
SFX_LOW_BOOM · SFX_EMPHASIS · SFX_SUSPENSE · SFX_TENSION · SFX_RISER · SFX_IMPACT
```

Cada evento SFX exige: `id, libraryId, variant, trigger, purpose, start, end, mix,
status`. En AbrxsVAV el SFX Registry implementa exactamente estas familias como roles
semánticos (`sfxRoles` en XrFamilyDefinition) → el Library mapea rol→archivo por pack.

## 5. Lienzos (carruseles/posts/páginas HTML) — Abrxs_pages

Los Lienzos son páginas HTML autocontenidas versionadas con `meta.json`
(`schemaVersion: abrxs.pages.lienzo-meta.v1`, source repo+commit, previousVersion,
latestChanges, url pública). Ejemplo real: `joc55-amanda-intro-alfa-1x`. Son la forma
actual de publicar intros/carruseles/fichas visuales.

**En AbrxsVAV:** el Lienzo se vuelve un *delivery target* más: Delivery puede exportar
una pieza como Lienzo-HTML (con manifest `lienzo-meta.v1` compatible) además de MP4/kits,
permitiendo subirlo directo al flujo de Abrxs_pages sin rehacer nada. Los carruseles de
feed (multi-página imagen/texto) se planifican en Plan/Dresser como secuencias de
frames-tarjeta y se exportan PNG+HTML.

## 6. Feed editorial multi-marca — editorial-os / emulator / publisher

- Planner con **lots** L1/L2/L3/EVENT por día de semana, superficies (Feed/…) y
  plataformas (instagram, linkedin…); taxonomía (pilares, familias); escenarios
  guardados; producción con estados por pieza y checklists.
- El emulador simula el feed resultante; publisher calendariza y publica.
- **En AbrxsVAV:** los Client Profiles y el Plan consumen esta lógica (una pieza de
  Canter/Dresser puede alimentar un slot del planner vía export; la integración
  profunda es post-paso 10, no core).

## 7. Pipeline de transcripción/corte existente (Canter ecosystem)

- `Abrxs_transcriber_v1`: Whisper MLX word-level, worker JSONL, alignment y **bridges
  para Geometra, Cutter y VideoFlow** — la app debe hablar ese mismo formato word-level.
- `Abrxs_cutter_v1` + `Abrxs-Canter 3.8.1`: corte por palabra con timeline; entra por
  `CanterAdapter` conservando el contrato.

## 8. Implicaciones para la app (resumen accionable)

1. XR Composer implementa las 7 familias con sus densidades canónicas por formato y las
   3 reglas de selección (como datos, en `XrFamilyDefinition`).
2. Motion presets = enum cerrada con params sugeridos (los 10 del canon); aplicables a
   B-rolls y estados XR; zoom ≤ 1.18.
3. SFX Registry = 13 familias con variantes; evento SFX con los 9 campos canónicos.
4. Delivery añade target **Lienzo-HTML** (manifest `abrxs.pages.lienzo-meta.v1`).
5. Transcripción word-level compatible con los bridges existentes de transcriber v1.
6. Client Profiles pueden exportar/importar con el planner de editorial-os (lots,
   superficies, plataformas) — integración diferida, contrato preparado.
