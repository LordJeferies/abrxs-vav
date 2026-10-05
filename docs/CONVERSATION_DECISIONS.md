# Decisiones de producto consolidadas · 2026-10-02

Esta implementación parte del ZIP Foundation y de la conversación suministrada.
Es una entrega de fundación, no una certificación de todas las capacidades futuras.

## Visión aceptada

Una aplicación local de producción editorial y audiovisual: idea/guion/transcript,
master largo o clips → plan → cortes → dressing → QA/revisión → final o kit de edición.
La visión también incluye carruseles, imágenes, copies y planificación multired.
El primer milestone de código se concentra en la fundación audiovisual.

- Production Graph canónico; render y planes NLE son proyecciones.
- Plan, Canter, Dresser, Visual Lab, Workflow Studio, Review, Delivery, Clients,
  Library y Activity conservan límites y contratos públicos.
- Sol Blanco informa marca, audiencia, objetivos y restricciones; Sol Negro define
  estructuras y estilos; Beta/Alfa/Omega representan madurez editorial, no jobs.
- IA, ejecución automática, propuestas asistidas, control manual y planes importados
  deben converger al mismo estado editable.
- Canter selecciona narrativa; Dresser viste; Visual Lab busca/fabrica assets.
- Review es transversal; Workflow Studio orquesta producción audiovisual.
- Entrada master o 20+ clips. Coherencia narrativa y cierre preceden a cuota/duración.
- Tiempo canónico entero con FPS racional; cortes no destructivos.
- Stock, local, generación API/local, navegador o paquete manual son estrategias
  intercambiables que registran el mismo asset y su provenance.
- LiquidGlass interesa tanto para UI como para efectos de video, como capas distintas.
- Render final y assets/instrucciones DaVinci/CapCut deben derivar del mismo graph.
- Providers y claves se seleccionarán dentro de la app; las claves no se guardan
  en graph, logs ni repositorio. Endpoints gratuitos requieren verificación por proveedor.

## Qué implementa esta entrega

ProjectStore en archivos, historial undo/redo atómico con el proyecto, revisión optimista,
JobEngine de un worker, recuperación explícita, dos handlers reales y shell conectada.
El trabajo de validación es estructural; no equivale a QA audiovisual.
El trabajo TXT describe colocación y recursos, no es un plan ejecutable de DaVinci MCP.

## Decisión de persistencia

Servicio Node local (127.0.0.1) y repositorios intercambiables detrás de interfaces core.
Escritura: archivo temporal exclusivo → fsync → rename → fsync del directorio.
Proyecto y OperationLog se guardan juntos; no hay commit parcial de graph/historial.
Se conserva la versión anterior en .bak. Un archivo corrupto bloquea lectura/escritura
con error explícito, sin restauración silenciosa ni pérdida de evidence.

La primera versión admite proyecto v1 y graph v2. Versiones desconocidas se rechazan;
las migraciones futuras se implementarán con fixtures del formato real.
Los jobs capturan una revisión inmutable. Ejecutar uno no modifica el graph.
Running al reiniciar pasa a failed/interrupted; queued se procesa al recuperar.
Retry manual, máximo 3 intentos, progreso persistente y cancelación cooperativa.
El cache solo reutiliza el mismo kind/revisión/contenido dentro de este milestone.

## Lo descubierto al revisar repos actuales

`references/OWN_REPOS_AUDIT.md` fija los commits leídos. El Abraxas existente ya tiene
Alfa/Ficha Studio y VideoFlow: no se debe sustituir su carpeta app por esta shell.
Los servicios de fundación se integrarán por adapter y gate de paridad.
