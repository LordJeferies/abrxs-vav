# ABRXSVAV — QA CHECKLIST DE UI (Definition of Done visual)

> Obligatorio antes de dar cualquier vista por terminada. Complementa
> `docs/UI_CANON.md` (normas) y `docs/TESTING_AND_QA.md` (QA funcional existente).

## 1. Viewports de QA (no son breakpoints, son pruebas)

```
Desktop:  1280×800 · 1440×900 · 1728×1117 · 1920×1080
Tablet:   768×1024 · 1024×768
Mobile:   320×568 · 375×812 · 390×844 · 430×932   (companion PWA)
```

## 2. Prueba de densidad

La vista con 1 / 10 / 50 / 500 elementos. Una interfaz que luce preciosa con tres tarjetas
pero colapsa con 80 no está terminada. Timeline y Library: virtualización obligatoria
(500+ sin lag, objetivo < 16 ms/frame de interacción).

## 3. Prueba de texto

Nombre corto · nombre extremadamente largo · copy de 1 línea y de 10 · idioma con palabras
largas · zoom de texto 125/150/200 %. Sin overflow ni truncamiento sin intención.

## 4. Prueba de glass/material (solo superficies del UI layer)

Light mode y dark mode × fondo muy claro / muy oscuro / imagen detrás / video detrás /
contenido colorido. Verificar: glass se entiende, texto se lee, borders aparecen, sombras
no ensucian, controles no se pierden. Con `prefers-reduced-transparency`: modo
Performance sin pérdida de comprensión.

## 5. Matriz de estados por componente

default · hover · focus · active/pressed · selected · disabled · loading · success ·
warning · error · empty. Cada uno diseñado y verificado. Click → feedback inmediato.

## 6. Accesibilidad mínima

Contraste suficiente · focus visible con teclado · labels y roles correctos · aria cuando
haga falta · reduced motion respetado · targets: 44 px en companion touch, densos en
desktop · navegación completa por teclado en desktop.

## 7. Performance percibida y real

Skeletons en cargas > 300 ms · optimistic UI donde sea seguro · thumbnails cacheados ·
lazy modules · presupuesto: shell < 2 s, cambio de módulo < 300 ms, scrub 60 fps.
Sin blur en 100 cards; sin loops de render; sin listeners duplicados.

## 8. Flujo y UX

¿Se entiende qué hacer en < 5 s? ¿La acción principal es obvia? ¿Se puede volver atrás?
¿Se sabe qué está pasando / si se guardó / qué está seleccionado? ¿Funciona con 1
elemento y con 1000? ¿Los errores son humanos con salida (reintentar/copiar diagnóstico)?

## 9. Registro honesto

Lo que no se probó de verdad se declara PENDIENTE con evidencia de qué se revisó solo en
código. Jamás afirmar pruebas no hechas (regla 116 del canon).
