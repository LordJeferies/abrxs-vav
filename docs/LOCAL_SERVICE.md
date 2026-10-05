# Servicio local y recuperación

## Arranque

`npm run dev`: Node en 127.0.0.1:4317 y Vite en 127.0.0.1:1420 con proxy API.
`npm run build && npm start`: interfaz compilada y API en 127.0.0.1:4317.
No abrir dist/index.html como archivo local: requiere el servicio.

## Variables

| Variable | Default | Uso |
|---|---|---|
| ABRAXAS_DATA_DIR | .abraxas-data en la raíz del repo | Datos locales en carpeta elegida |
| ABRAXAS_PORT | 4317 | Puerto de API/interfaz compilada |

Vite usa 4317 como target. Si cambias el puerto para desarrollo, actualiza su proxy;
para `npm start` no hace falta cambiar UI. No exponer en interfaces de red.
Las peticiones de escritura requieren header local y origen autorizado. Esto evita
escrituras desde páginas externas; no constituye una autenticación multiusuario.

## API v0.2

| Método | Ruta | Entrada / Resultado |
|---|---|---|
| GET | /api/health | Estado y handlers instalados |
| GET | /api/projects | Proyectos validados |
| POST | /api/projects | name, timebase → proyecto nuevo |
| GET | /api/projects/:id | Proyecto versionado e historial |
| PUT | /api/projects/:id | revision, label, content → commit CAS |
| POST | /api/projects/:id/undo o redo | revision → nuevo commit |
| GET | /api/jobs | Trabajos de todos los proyectos |
| POST | /api/jobs | projectId, revision, kind → snapshot en cola |
| POST | /api/jobs/:id/cancel o retry | Transición validada |

La UI descarga el output textual que ya guarda el job. No hay export de media.
Errores: 409 por revisión obsoleta, 404 por registro ausente, 400 por entrada inválida,
403 por host/origen/petición no autorizada.

## Casos de fallo

- Servicio desconectado: iniciar npm run dev/start; usar Recargar datos.
- Puerto ocupado: cerrar el servicio anterior o usar ABRAXAS_PORT con npm start.
- Conflicto entre ventanas: recargar el proyecto; no sobrescribir revisión obsoleta.
- JSON corrupto: detener app; conservar archivo original; inspeccionar `.json.bak`;
  restaurar esa copia manualmente si es válida. Ejecutar npm run doctor después.
- Lock huérfano: se recupera si el PID ya no existe; si está inválido se pide revisar
  que no haya otro servicio antes de eliminar `.service.lock`.
- Escritura fallida: API no confirma guardado. La UI muestra error. La versión previa
  permanece; si la escritura ya alcanzó rename pero falló fsync, recargar antes de repetir.
- Job interrumpido: fallido con motivo explícito y snapshot; reintentar en Activity.
- Retry agotado: 3 intentos; modificar la entrada solo si corresponde y crear otro job.
- Handler futuro ausente: el job falla de manera aislada, no borra el proyecto.

## Alcance de atomicidad

Atomicidad por registro: proyecto+historial en un archivo; cada job en otro archivo.
No hay transacción distribuida project/job ni side effects externos en los handlers
actuales. Los handlers de generación/render deberán incorporar checkpoints e
idempotency antes de usarse para recuperación automática.

El servicio consume .ts con tsx en Node; npm start usa las dependencias de desarrollo.
No instalar con --omit=dev en esta entrega. El bundle/sidecar de escritorio viene después.
