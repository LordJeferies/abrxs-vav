# ABRXSVAV — INVESTIGACIÓN APPLE DESIGN (2026-10-04)

> Investigación de las páginas oficiales de diseño de Apple para calibrar el frontend
> de AbrxsVAV (LiquidGlass + estética premium + UX utilitaria). Fuentes consultadas:
>
> - https://developer.apple.com/design/whats-new/
> - https://developer.apple.com/design/get-started/
> - https://developer.apple.com/design/human-interface-guidelines/ (índice; páginas de detalle son JS-rendered)
> - https://developer.apple.com/design/resources/

## 1. El estado del diseño Apple hoy (según /whats-new)

- **Liquid Glass sigue siendo el lenguaje central** (introducido WWDC25) con guía
  refinada en: **Materials**, **Color**, **Buttons**, **Toolbars**, **Tab bars**,
  **App icons** (íconos en capas, variantes light/dark tints y clear).
- Plataforma actual: iOS/iPadOS 27 y macOS 27 (la guía de iOS 26/macOS Tahoe es de 2025).
- **Icon Composer 2** (jun 2026): íconos en capas de Liquid Glass desde un solo diseño
  para iPhone, iPad, Mac y Watch.
- **Scroll edge effects** (jul 2025): los bordes de scroll bajo barras de vidrio llevan
  un fundido para que el material se lea correctamente.
- Toolbars: agrupación de ítems, símbolos, guía de navigation bar incorporada.
- Sidebars: "adaptable sidebar style"; contenido extendiéndose por debajo de la sidebar.
- **"Design principles" reintroducidas** + video "Principles of great design".
- **Página HIG nueva: Generative AI** (jun 2025): refinamiento de resultados, feedback
  durante la generación, elección de tipo de modelo, revisión humana del contenido generado.
- Dynamic Type movido a **Typography** (con "emphasized weights").
- SF Symbols (7/8): draw animations, gradient rendering, 6.000–7.000+ símbolos.
- UI Kits iOS 27 / macOS 27 para Figma y Sketch con **"liquid glass materials, app
  icons, updated system colors"**.

## 2. Validaciones que Apple nos da (decisiones AbrxsVAV ya tomadas)

| HALLAZGO APPLE | NUESTRA DECISIÓN | ESTADO |
|---|---|---|
| Liquid Glass es material de la **capa funcional** (nav, toolbars, tab bars, sidebars, popovers) — no de contenido | Dos capas: contenido sólido / glass solo en UI layer (`docs/UI_CANON.md` §5) | ✅ Confirmado por Apple — sin cambios |
| Glass necesita contraste dinámico y legibilidad sobre cualquier fondo | Prueba de glass sobre video claro/oscuro/colorido + modo Performance con `prefers-reduced-transparency` | ✅ Ya en canon y QA checklist |
| **Generative AI HIG**: revisión humana antes de usar contenido generado | Human-in-the-loop por diseño: la IA propone (ghost events), el humano aprueba | ✅ Nuestro principio 4 — ahora con respaldo Apple explícito |
| **Feedback durante la generación** (progreso + poder interrumpir) | JobEngine con progress real + cancelación + Activity en vivo | ✅ Ya implementado en core |
| **Refinar resultados** (regenerar con ajustes) | `variants[]` (A/B/C) + regenerar por evento en Dresser/Visual Lab | ✅ Ya en contratos v2.2 |
| **Elegir tipo de modelo** (on-device vs servidor, coste/privacidad) | Provider Registry + STRICT FREE MODE + Auto Model Selection explicable | ✅ Ya decidido en CLOUD_AND_PROVIDERS |
| **Explicar salidas de IA** | `PromptRecord` versionado + "Explica esta decisión" en el Visual Director | ✅ Ya en contratos v2.3 |
| Design principles (claridad, deferencia al contenido, profundidad) | Content-first + dos capas + superficies jerarquizadas | ✅ Ya en canon (§5, §10) |
| Dynamic Type / texto 125–200 % | Checks de zoom de texto en QA checklist | ✅ Ya en canon (§8) |
| Adaptable sidebar; Sidebar \| Workspace \| Inspector | Layout desktop decidido así | ✅ Ya en canon (§8) |

## 3. Cosas NUEVAS que adoptamos (acción concreta)

1. **Scroll edge effects** — todo panel con scroll que pase por debajo de una barra
   glass (TopBar, toolbars, inspectores flotantes) aplica un fundido superior/inferior.
   Nuevo token en `packages/ui`: `--scroll-edge-fade` + utilidad `.u-scroll-edge`.
   Entra con la construcción del shell del paso 1.
2. **Variantes de glass** (como los app icons de Apple): además del glass estándar y el
   strong, definir `--material-glass-tint` (con el accent del brand del proyecto activo)
   para estados seleccionados en navegación. Sutil; nunca en contenido.
3. **Ícono de app en capas** — al llegar al paso 10 (updater/distribución), diseñar el
   ícono de AbrxsVAV con la estética Liquid Glass (referencia Icon Composer; el ícono
   Tauri será estático pero con el mismo lenguaje).
4. **UI Kits Figma macOS/iOS 27 como referencia visual** (no dependencia): medir contra
   ellos densidad, radios y colores del sistema al construir pantallas. SF Symbols como
   referencia semántica de glifos (seguimos usando Lucide por licencia/plataforma web,
   mapeando significado 1:1).
5. **Referencia HIG Generative AI en cada feature de IA**: checklist de 5 puntos
   (revisión humana · feedback de progreso · refinar/regenerar · modelo elegible y
   explicable · salida explicada) añadido al DoD de features con IA.

## 4. Qué NO adoptamos

- Paridad visual literal con macOS (traffic lights falsos, ventanas imitadas) — el canon
  ya prohíbe disfrazar una web/app de Tauri como app nativa Apple: se copian principios,
  no disfraces.
- Swift/SwiftUI (salvo el wrapper .app opcional del companion, ya decidido).
- SF Symbols como set principal (licencia restringida a plataformas Apple; AbrxsVAV es
  Tauri/web → Lucide).
