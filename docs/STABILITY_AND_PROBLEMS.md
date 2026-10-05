# Estabilidad, problemas previsibles y soluciones

## 1. Crash durante batch
Solución: Job Engine persistente; checkpoint por etapa; resultados completos reutilizables; atomic state writes.

## 2. Provider/API cambia
Provider Adapter aislado + capability registry. Deshabilitar solo ese provider; fallback configurado.

## 3. Browser UI cambia
Browser adapter falla de forma localizada y pasa a manual handoff; nunca bloquear el proyecto.

## 4. Asset generation falla
Retry limitado + alternate provider + fallback a stock/source/A-roll. No rellenar cuota con visual malo.

## 5. Drift temporal
Production Graph v2 usa frames/timebase racional y source map explícito.

## 6. Master VFR / codecs raros
Probe al ingest; generar proxy CFR para edición; conservar master para render cuando sea seguro; advertir conversiones.

## 7. Podcast grande consume RAM
Range media server/proxy; no cargar master completo.

## 8. Captions chocan con cara/texto
Scene Geometry + constraint solver + visual-type caption policies.

## 9. Master ya tiene captions quemados
PRESERVE/INSERTS_ONLY/SMART.

## 10. Fonts faltantes
Font Registry valida existencia; fallback explícito; package/export puede incluir aviso/licencia, no redistribuir fuentes sin permiso.

## 11. Plugin roto
Plugin sandbox/worker + capability check + error boundary + disable without killing app.

## 12. Client config cambia
Project snapshot + explicit “update to latest client pack” con diff.

## 13. SSD se llena
Preflight disk check, estimates, cache quotas, cleanup policy y preserve-approved-assets.

## 14. Duplicación de assets
SHA-256 content addressing y provenance index.

## 15. Resultado AI inconsistente entre escenas
Continuity Group: reference assets, character/location/style context, start/end frame when supported.

## 16. Render se ve distinto a preview
Pinned renderer versions + visual regression tests + reference frames + QA post-render.

## 17. Audio pops
Crossfade/fade mínimo configurable + QA de boundaries.

## 18. Black frames / missing files
Render QA + asset existence preflight + repair loop limitado.

## 19. Credencial expuesta
Keychain; redact logs; project guarda credential reference, nunca secreto.

## 20. Licencia de stock/modelo incierta
Asset Manifest conserva source/license; export puede generar license report.

## 21. Operación IA destructiva
IA produce `EditProposal/Operation`; validator aplica; master immutable.

## 22. UI lenta
Proxies, virtualization, lazy modules, workers y cache; no ejecutar AI/render en hilo UI.

## 23. GPU saturada
Resource Scheduler para CPU/GPU/VRAM/network; prefetch tareas ligeras mientras render pesado corre.

## 24. Proyecto corrupto
Atomic writes + versioned migrations + rolling snapshots + diagnostic bundle.

## 25. Retry infinito
maxAttempts y backoff; estado terminal claro; manual intervention.

## 26. External AI devuelve otro formato
Response schema validator; adapter/import wizard; no adivinar silenciosamente.
