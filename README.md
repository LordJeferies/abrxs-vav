# AbrxsVAV · 0.3.0

**AbrxsVAV** (Video · Audio · Visual) es un sistema operativo de producción de contenido
de la familia Abraxas: una app de escritorio donde un proyecto va desde un guion o un
podcast crudo hasta piezas terminadas, vestidas, revisadas y entregadas — sin saltar entre
herramientas, con la IA proponiendo y el humano aprobando, y **todo el core operable por
MCP** (para agentes y para probar la app por código).

```
HUB · PLAN · CANTER · DRESSER · VISUAL LAB · WORKFLOWS
REVIEW · DELIVERY · CLIENTS · LIBRARY · ACTIVITY
```

> **Empieza por `docs/00_ABRSX_VAV_ADDENDUM.md`** — gana sobre cualquier otro doc donde
> haya conflicto. Este repo es la evolución de `abraxas-os-foundation` (Foundation 0.2),
> cuyo núcleo (ProjectStore, OperationLog, JobEngine) es REAL y no se re-implementa.

## Mapa de documentación

| PREGUNTA | DOC |
|---|---|
| Qué es, qué NO es, principios, prohibiciones | `docs/00_ABRSX_VAV_ADDENDUM.md` |
| Qué hace y cómo se construye CADA estación | `docs/STATIONS_SPEC.md` |
| En qué orden se construye (11 pasos, verificación por paso) | `docs/BUILD_PLAN_11_STEPS.md` |
| Contratos v2.2/v2.3 (schemas Zod listos para implementar) | `docs/CONTRACTS_V2_SPEC.md` |
| MCP: patrones, arquitectura, tools por paso, testing | `docs/MCP_INTEGRATION.md` |
| Exportar prompts para IA externa (copiar · TXT · batch) | `docs/HANDOFF_UX.md` |
| Supabase / Drive / NVIDIA / Firebase | `docs/CLOUD_AND_PROVIDERS.md` |
| Estabilidad: atomicidad, watchdog, circuit breakers | `docs/STABILITY_REQUIREMENTS.md` |
| Canon visual (tokens, dos capas, glass, estados) | `docs/UI_CANON.md` |
| Checklist de aceptación visual por pantalla | `docs/UI_QA_CHECKLIST.md` |
| Qué se copia de cada repo (licencias, provenance) | `docs/SOURCES_AND_REUSE.md` |
| Estado real: REAL / MOCK / PENDIENTE | `docs/IMPLEMENTATION_STATUS.md` |

## Probar

Node 22 o superior (recomendado Node 24). Desde esta carpeta:

```bash
npm ci
npm run dev
```

Abre http://127.0.0.1:1420 (UI + servicio local). Compilado: `npm run build && npm start`
→ http://127.0.0.1:4317. El servicio solo escucha en tu equipo.

## Qué funciona hoy (v0.3.0 = paso 0 del plan)

Núcleo Foundation REAL: crear/abrir proyectos por frames, eventos editables con
undo/redo persistente, import/export graph v2, JobEngine con recuperación post-crash,
Activity, Doctor básico. Pendiente: adapters (Canter/Review), Dresser, Visual Lab,
providers, MCP scaffold — ver `docs/IMPLEMENTATION_STATUS.md` y el plan de 11 pasos.

## Datos y verificación

Datos en `.abraxas-data/` (local, ignorada por Git; `ABRAXAS_DATA_DIR` para redirigir).
Escrituras atómicas con `.bak`. Verificación:

```bash
npm run check && npm test && npm run build && npm run doctor
```

## Reglas de oro (resumen — completo en AGENTS.md y addendum)

1. El Production Graph es la única verdad; el NlePlan se compila desde él.
2. Tiempo canónico = frames; los timestamps del transcript son pista, no autoridad.
3. Toda acción de IA crea una operación registrada (undo/redo gratis).
4. Canter 3.8.1 y Review 05 no se reescriben — adapters primero.
5. MoneyPrinterTurbo es motor, jamás director creativo (⛔ `task.py`).
6. MCP-first: cada acción vive en un ActionCatalog único → UI / PWA / MCP / tests.
7. Prohibido saltar a providers de IA antes de completar el paso 1 (core).

## Integración con tus proyectos actuales

El repositorio https://github.com/LordJeferies/abraxas-os contiene el editor
Alfa/VideoFlow v0.19.3 — no sustituir su `app/` por esta shell; integración por rama y
adapters (ver `references/OWN_REPOS_AUDIT.md`). Canter y Review se conectan gradualmente
como módulos/companion.
