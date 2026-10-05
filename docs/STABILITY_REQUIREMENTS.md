# ABRXSVAV — REQUISITOS DE ESTABILIDAD (P0, mayormente paso 1)

> La regla del addendum ("agregar un X-roll no debe requerir modificar la app") protege
> la arquitectura. Esta capa protege **los datos y los procesos**. Complementa
> `docs/STABILITY_AND_PROBLEMS.md` (problemas conocidos de Foundation) con los requisitos
> que faltan para que la app sea confiable. Ninguno requiere rediseño: son la capa que
> faltaba sobre la arquitectura decidida.

## 1. Integridad de datos

| BRECHA | SOLUCIÓN CONCRETA |
|---|---|
| Escrituras no atómicas | Toda mutación de JSON/DB: escribir a temp → renombrar. Un corte de luz nunca corrompe un proyecto |
| SQLite sin WAL | `PRAGMA journal_mode=WAL` + `integrity_check` al arrancar |
| Sin migraciones | Framework de migraciones versionadas con dry-run + backup automático antes de migrar |
| Apertura doble del mismo proyecto | Lock de proyecto → segunda apertura entra en modo read-only con aviso |
| Corrupción silenciosa | Detección + recuperación desde el último snapshot bueno ("Guardar versión" manual + autosnapshot en hitos: antes de migrar, antes de batch grande) |

Nota: Foundation ya implementa escrituras atómicas + `.bak` + lock de servicio en
filesystem (REAL). Lo que falta se documenta en su IMPLEMENTATION_STATUS (WAL aplica
cuando se migre a SQLite en Tauri; hoy es files-based).

## 2. Procesos y jobs

| BRECHA | SOLUCIÓN CONCRETA |
|---|---|
| FFmpeg/Whisper/MPT colgados | Watchdog: timeout por tipo de job, kill de procesos zombie, reporte a Activity |
| RAM explota con medios largos | Límites LRU en MediaService para buffers decodificados (streaming por rangos de 3.8.1 formalizado como contrato del core) |
| Render se come el disco | Preflight de espacio antes de jobs de render/generación |
| Provider cae o devuelve 429 | Retry con backoff exponencial + jitter, rate limiter por provider, circuit breaker (3 fallos → provider deshabilitado 10 min, explicado en Doctor) |
| Crash a mitad de batch | Al arrancar: jobs "running" → "interrupted" con acciones Reanudar/Reiniciar. Idempotencia vía CacheKey (hash prompt+model+seed+params) |
| Keys inválidas | Validación de credenciales al configurar (test connection obligatorio) — aviso temprano, no a mitad de un batch de 20 |

## 3. Shell de la app

| BRECHA | SOLUCIÓN CONCRETA |
|---|---|
| Un módulo crashea → crashea todo | React Error Boundaries por módulo (versión UI de la regla de plugins aislados) |
| Errores opacos | Pantalla de error global con "Copiar diagnóstico" (logs + estado del Doctor, sin datos sensibles) |
| Logs dispersos | Logging estructurado (módulo, nivel, jobId) con rotación + visor en Activity → Logs |
| Hilo principal bloqueado | Regla dura: todo trabajo pesado en commands de Tauri o workers. La UI jamás procesa medios |
| Crash reporter | Opcional (opt-in), local primero — coherente con el ethos local-first |

## 4. Seguridad

- Keys en Keychain / Credential Store (regla 9 de AGENTS.md) — jamás en proyecto/JSON/logs/Git.
- STRICT FREE MODE como regla del router: sin fallback pagado silencioso.
- Auto Model Selection siempre explicable ("por qué elegí ComfyUI→Wan I2V").
- Canal local del companion: API de acciones tipadas con allowlist; jamás shell passthrough.
- MCP: herramientas tipadas, `confirm:true` en destructivas, resultados sin secretos.

## 5. Feature flags internos

Para desactivar módulos inestables sin rebuild durante esta etapa de desarrollo rápido.
Registro simple en config local; el shell oculta la estación y su ActionCatalog responde
"disabled" con explicación.

## 6. Verificación de estabilidad por paso

- Paso 1: test de crash (matar app a mitad de job → recuperar); Doctor semáforos.
- Paso 2: corte de 90 min sin RAM explota (MediaService rangos).
- Paso 5: batch de 20 con fallo forzado en el 19 → 19 continúan.
- Paso 6: provider caído → circuit breaker visible en Doctor → fallback según strategy.
