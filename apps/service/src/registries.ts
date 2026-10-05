/* Registries modulares — la respuesta del core a "mañana agrego más X-rolls, más SFX,
   más presets de captions" (addendum §7: registries + plugins, nunca if/else).
   Cada registro es DATO versionado: agregar un tipo = agregar una entrada, cero código.
   La UI, el Visual Studio, el coach y el MCP leen de aquí (una sola fuente por dominio). */

export interface RegistryEntry { id: string; label: string; note?: string; params?: string[]; }
export interface Registry { id: string; label: string; version: string; entries: RegistryEntry[]; }

/* ── Familias XR (canon R6 — docs/CONTENT_TYPES_SPEC.md §2) ── */
export const xrFamilies: Registry = {
  id: 'xr-families', label: 'Familias X-Roll (canon R6)', version: '1.0.0',
  entries: [
    { id: 'xroll.comic-info', label: 'COMIC_INFO', note: 'Panel de datos en zonas + recorrido de cámara determinista (1 máster IA + estados FFmpeg)', params: ['zones', 'cameraStates', 'masterPrompt'] },
    { id: 'xroll.comic-cc', label: 'COMIC_CC', note: 'Escenas cómic con texto hablado integrado; el texto lo renderiza la app (editable)', params: ['scenes', 'captionText'] },
    { id: 'xroll.typo', label: 'TYPO', note: 'Tipografía animada 100% determinista — JAMÁS se delega a IA', params: ['headline', 'packId', 'motion'] },
    { id: 'xroll.photos', label: 'PHOTOS', note: 'Fotos con recorrido (2–3 imágenes + Ken Burns)', params: ['assetSlots', 'motion'] },
    { id: 'xroll.objects', label: 'OBJECTS', note: 'Objetos generados por IA sobre fondo limpio; el Composer posiciona', params: ['objectPrompts'] },
    { id: 'xroll.photo-object', label: 'PHOTO_OBJECT', note: 'Foto + objetos en capas programáticas', params: ['photoSlot', 'objectSlots'] },
    { id: 'xroll.no-xr', label: 'NO_XR', note: 'Mantener A-roll — decisión editorial válida (función > cuota)' }
  ]
};

/* ── SFX (canon R6: librería pequeña y reconocible, con variantes) ── */
export const sfxFamilies: Registry = {
  id: 'sfx-families', label: 'Familias SFX (canon R6)', version: '1.0.0',
  entries: [
    { id: 'SFX_CLICK', label: 'Click', note: 'Aparición pequeña/UI/énfasis de objeto', params: ['soft', 'medium', 'deep'] },
    { id: 'SFX_CLICK_DEEP', label: 'Click profundo', note: 'Cierre/confirmación grave' },
    { id: 'SFX_KEYBOARD', label: 'Teclado', note: 'Tipeo/datos/acción textual', params: ['soft', 'mechanical'] },
    { id: 'SFX_WHOOSH', label: 'Whoosh', note: 'Movimiento/slide/acento de corte', params: ['soft', 'medium', 'short'] },
    { id: 'SFX_CAMERA', label: 'Cámara', note: 'Shutter/flash/enfoque' },
    { id: 'SFX_GOOD', label: 'Good', note: 'Acierto/confirmación positiva' },
    { id: 'SFX_WRONG', label: 'Wrong', note: 'Error/contradicción' },
    { id: 'SFX_LOW_BOOM', label: 'Low boom', note: 'Impacto grave de revelación' },
    { id: 'SFX_EMPHASIS', label: 'Énfasis', note: 'Subrayar un dato o palabra' },
    { id: 'SFX_SUSPENSE', label: 'Suspense', note: 'Tensión sostenida' },
    { id: 'SFX_TENSION', label: 'Tensión', note: 'Riser de tensión media' },
    { id: 'SFX_RISER', label: 'Riser', note: 'Construcción hacia un reveal' },
    { id: 'SFX_IMPACT', label: 'Impact', note: 'Golpe de dato/título' }
  ]
};

/* ── Motions (canon R6 — librería cerrada, zoom ≤ 1.18) ── */
export const motionPresets: Registry = {
  id: 'motion-presets', label: 'Presets de Motion (canon R6)', version: '1.0.0',
  entries: [
    { id: 'STATIC', label: 'Static', note: 'Plano fijo bloqueado' },
    { id: 'ZOOM_IN', label: 'Push in', note: 'Escala 1.0→1.05–1.18, ease-in-out' },
    { id: 'ZOOM_OUT', label: 'Pull back', note: 'Revela la escena alejándose' },
    { id: 'PAN_LEFT', label: 'Pan izquierda', note: 'Eje x' },
    { id: 'PAN_RIGHT', label: 'Pan derecha', note: 'Eje x' },
    { id: 'PAN_UP', label: 'Tilt arriba', note: 'Eje y' },
    { id: 'PAN_DOWN', label: 'Tilt abajo', note: 'Eje y' },
    { id: 'ZOOM_IN_PAN', label: 'Push + deriva', note: 'Escala y posición simultáneos' },
    { id: 'ZOOM_OUT_PAN', label: 'Pull + deriva', note: 'Escala y posición simultáneos' },
    { id: 'SLOW_DRIFT', label: 'Slow drift', note: 'Deriva sutil, casi imperceptible' }
  ]
};

/* ── Presets de captions (extensible por Client Profile) ── */
export const captionPresets: Registry = {
  id: 'caption-presets', label: 'Presets de Captions', version: '1.0.0',
  entries: [
    { id: 'amanda.vertical.v1', label: 'Amanda vertical', note: 'Karaoke word-level, safe area 9:16, máx 3 palabras por línea', params: ['font', 'colors', 'maxWordsPerLine'] },
    { id: 'joc.clean.v1', label: 'JOC clean', note: 'Lower-third sobrio para 16:9', params: ['font', 'position'] },
    { id: 'glass.ui.v1', label: 'Glass UI', note: 'Pill de vidrio (pack xr.glass-ui) para X-rolls', params: ['material', 'tint'] },
    { id: 'paper.vox.v1', label: 'Paper Vox', note: 'Etiquetas estilo editorial papel (pack xr.vox-paper)', params: ['font', 'highlight'] }
  ]
};

/* ── Packs visuales instalables (versionados — la Library los carga) ── */
export const visualPacks: Registry = {
  id: 'visual-packs', label: 'Visual Packs instalados', version: '1.0.0',
  entries: [
    { id: 'xr.vox-paper.v1', label: 'Vox Paper v1', note: 'Editorial papel: texturas, sellos, resaltes' },
    { id: 'xr.glass-ui.v1', label: 'Glass UI v1', note: 'Vidrio líquido: panels, títulos, lower-thirds' },
    { id: 'xr.data-story.v1', label: 'Data Story v1', note: 'Gráficas y datos animados deterministas' }
  ]
};

export const registries: Registry[] = [xrFamilies, sfxFamilies, motionPresets, captionPresets, visualPacks];
