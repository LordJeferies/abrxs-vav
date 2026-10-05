# ABRXSVAV — UI CANON (normativo)

> Condensado normativo del canon visual completo del usuario (secciones 38–116 del
> ABRAXAS_CANON_DESARROLLO_APPS). **Toda UI nueva cumple este canon y el checklist de
> `docs/UI_QA_CHECKLIST.md`** — es parte del Definition of Done. Los valores vivos están
> en `packages/ui/src/tokens.css` y `materials.css`.

## 1. Pixel precision

"Pixel perfect" no significa medidas rígidas: significa que dos elementos alineados están
alineados de verdad; componentes equivalentes tienen exactamente la misma altura; paddings
equivalentes usan el mismo valor; iconos ópticamente centrados; baselines compartidas;
bordes de grosor estable; cards de la misma familia con la misma geometría; el spacing
tiene un sistema; los breakpoints son deliberados; no hay inconsistencias acumuladas.
Se trabaja en CSS logical pixels (no en píxeles físicos Retina). Revisa cada pantalla
como contra un diseño de Figma de producción.

## 2. Densidad

AbrxsVAV es **PRO TOOL** (desktop con puntero): filas compactas 28–32 px
(`--control-sm/md`), toolbar 40 px (`--control-lg`). Touch 44 px SOLO en el companion PWA
(`--control-touch`). No convertir un editor profesional en tarjetas gigantes.

## 3. Tipografía

- System stack (`--font-ui`); NUNCA empaquetar SF Pro.
- Jerarquía de roles, no 15 tamaños: display (28–36), title (22), section (17), body (14),
  secondary (13), meta (12), micro (11, uppercase + tracking 0.04em).
- Pesos: 400/500/600/700 — **semibold para UI**, bold solo para cifras/títulos fuertes.
- Tracking natural por defecto; ligeramente negativo solo en títulos grandes.
- Line-height: headings 1.05–1.2 · body 1.4–1.6 · metadata 1.25–1.4.

## 4. Superficies y materiales

- Niveles 0–4 (`--level-0..4`): background → content surface → card/panel → popover/
  inspector → modal. La diferencia entre niveles se logra con luminancia + border + blur
  + shadow combinados, no solo sombras.
- Bordes: 1 px + alpha (`rgba(255,255,255,.06/.10/.18)`); nunca wireframe.
- Radios en familias: 6/8/12/16/22/999. Radios anidados guardan proporción (exterior >
  interior).
- Sombras: ambient + contact, distintas por nivel (`--shadow-card/floating/modal`). Una
  sombra comunica elevación, no decora.
- Microtextura opcional: noise 1–2 %, subconsciente, no grano fuerte.
- Imágenes: SVG/vector/gradientes CSS preferidos; thumbnails cacheados (jamás cargar el
  original de 20 MB para dibujar 180×100).

## 5. LAS DOS CAPAS — la regla más importante

```
CONTENT LAYER (sólido, protagonista)
   video, timeline, transcript, grillas de assets, fichas, previews

UI LAYER (aquí vive LiquidGlass y NADA más)
   sidebar, toolbar, tabbar, popovers, inspectores, modales, floating controls
```

- LiquidGlass SOLO en capa UI; jamás en cards, filas, celdas, gráficos ni timeline.
- Presupuesto de blur: 2–3 superficies grandes visibles simultáneas máximo.
- Glass convincente = translucidez + sampling + blur + highlight + border light + sombra
  sutil (+ refracción MUY sutil si es estable). Glass ≠ blur enorme.
- El glass se prueba sobre imagen clara/oscura/colorida/video/scroll.
- `prefers-reduced-transparency` → modo Performance (superficies sólidas, cero blur);
  `prefers-reduced-motion` → springs y morphs se desactivan (no se aceleran).
- Modos del UI Effect Registry: **Performance** (sin blur) / **Balanced** (glass solo en
  nav, default) / **Full Visual** (demo). La UI no debe depender de la transparencia
  para ser comprensible.

## 6. Color

- Brand color solo para acciones/estados/feedback/contenido; chrome neutro.
- Color semántico por tokens (`--color-accent/success/warning/danger/info`) — jamás
  hardcodear red/green en componentes.
- Dark-first calibrado por nivel de superficie; jamás blanco puro sobre negro puro.
- La marca no domina la herramienta: vive en color, tipografía, iconografía, detalles.

## 7. Interacción

- **Matriz de 11 estados** en todo componente interactivo: default · hover · focus ·
  active/pressed · selected · disabled · loading · success · warning · error · empty.
- Press state responde ANTES de que termine el backend — el click nunca "no hizo nada"
  (crítico en una app con jobs largos).
- Focus ring SIEMPRE visible; `outline: none` sin alternativa está prohibido.
- Animaciones: escala fast 120–160 / normal 180–240 / emphasized 280–400 ms; dos easings
  globales (`--ease-standard/enter/exit`); interrumpibles; nunca `transition: all 500ms`.
- Hover discreto; jamás la única vía para una acción crítica (mobile no tiene hover).
- Drag & drop profesional: grab feedback, drag preview, destinos válidos, hover del
  destino, drop animation, success/error feedback. Funciona con mouse Y touch, con
  fallback de botones/menú.
- Gestos estándar (tap/long-press/drag/swipe); no inventar gestos nuevos.
- Teclado: ⌘K paleta, ⌘Z/⇧⌘Z undo, ESC cerrar, ⌘N nuevo, ⌘, ajustes — adaptado al flujo real.
- Menús contextuales (clic derecho / long-press) para acciones secundarias; acciones
  principales visibles; separar destructivas de frecuentes.

## 8. Layout y responsive

- Desktop: Sidebar | Workspace | Inspector. Inspector antes que abrir otra página para
  propiedades/detalles. Tablet: sidebar compacta + workspace. Mobile (companion): sheets.
- Breakpoints POR CONTENIDO (el inspector→sheet cuando comprime el workspace), no
  Tailwind-by-default.
- `100dvh` + `env(safe-area-inset-*)` en PWA; nada bajo el home indicator/notch.
- max-width por función (texto 600–760, settings 600–900, timeline full).
- Probar 125–200 % de zoom de texto: filas crecen, botones críticos no desaparecen.
- Scroll: el scroll vive en cada panel, no en la app; evitar 5 contenedores anidados;
  sticky solo si mantiene contexto.
- Modales solo cuando bloquean el flujo; popover para rápido; sheet para contextual;
  inspector para persistente.

## 9. Iconografía

- Set único estilo Lucide (stroke 1.5, viewBox 24, `--icon-*` escala 14/16/18/20/24),
  centrado óptico documentado (chevrons/play con corrección de 1 px si hace falta).
  Prohibido mezclar sets, emojis o iconos filled sueltos.

## 10. Contenido primero

En cada pantalla: ¿cuál es el objeto que el usuario vino a ver/manipular? Ese domina.
No el logo, no la navegación, no los efectos. Una buena interfaz de productividad es casi
invisible durante el trabajo. Menos efectos, no más: si glass + shadow + gradient + noise
+ glow son fuertes simultáneamente, está mal.

## 11. Estados de pantalla (toda vista)

Empty (qué falta + qué hacer + siguiente acción, no pantalla en blanco) · Loading
(skeletons, optimistic UI donde sea seguro, jamás congelar por un proceso) · Error
(humano: "No pudimos actualizar…" + Reintentar/Ver detalles/Copiar diagnóstico).

## 12. Criterio final de aceptación

No dar una pantalla por terminada sin poder afirmar: sin inconsistencias de spacing;
controles equivalentes = tamaños equivalentes; jerarquía tipográfica consistente;
iconografía de un solo sistema; light/dark calibrados (dark-first aquí); superficies con
jerarquía clara; glass selectivo; textura sutil; bordes coherentes; sombras que comunican;
botones que responden al instante; targets adecuados; safe areas OK (PWA); responsive sin
cortes; sin scroll horizontal accidental; mouse+touch+teclado donde corresponde; reduced
motion/transparency contemplados; 60 fps; el contenido conserva el protagonismo; **la UI
se siente diseñada, no generada por template**. Lo no probado se declara pendiente —
nunca se afirma sin evidencia.

## 13. Novedades Apple (2026) adoptadas

Ver `docs/APPLE_HIG_RESEARCH.md` (investigación completa con fuentes). Reglas nuevas:

1. **Scroll edge effects**: panel con scroll bajo una barra glass lleva fundido superior
   (y si aplica, inferior) para que el vidrio se lea — token `--scroll-edge-fade` en
   `packages/ui`.
2. **Variantes de glass**: estándar, strong (solo modal) y `--material-glass-tint`
   (tinte del accent del proyecto activo, solo en navegación/selección, nunca contenido).
3. **Checklist HIG de IA en toda feature con IA** (respaldo directo de la guía Apple
   "Generative AI"): revisión humana antes de usar · progreso con interrupción ·
   regenerar/refinar · modelo elegible y explicado · salida explicada.
4. **Ícono de app** en lenguaje Liquid Glass (diseño en el paso 10; referencia Icon Composer).
5. Referencia visual: UI Kits Figma macOS/iOS 27 ("liquid glass materials"); SF Symbols
   como referencia semántica de glifos — el set de la app sigue siendo Lucide.
