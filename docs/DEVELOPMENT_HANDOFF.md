# Continuación de desarrollo

## Entrega actual

Foundation 0.2 amplía el ZIP original. Núcleo y servicio probados, interfaz conectada.
La integración con el editor Alfa v0.19.3 es trabajo siguiente; no sustituir su app.
Los proyectos privados se guardan fuera del código público.

## Próximos tickets con aceptación

1. **Contrato Project/Piece/SourceMap + Alpha adapter.**
   Fijar fixture real del repo actual, preservar multi-content, staticGraph, sourcePayload,
   grupos y parent-child. Frame conversion declara redondeo y timebase. Roundtrip no
   descarta ningún recurso ni instruction. No tocar renderer para arreglar contrato.
2. **Integrar ProjectStore en editor existente.**
   Rama del repo actual; una autoridad de escritura. Crear/reabrir la misma ficha
   conserva timeline T1–T9, overrides y raw provenance. Mantener gates existentes.
3. **AssetStore mínimo.**
   Import local, SHA-256, metadata/provenance/licencia, vínculo a evento, existencia
   validada y referencia inmutable a master. Nada de API keys en registro.
4. **Primer clip completo.**
   Master local + B-roll local + captions → preview → MP4 con timings correctos.
   Output y estado persistentes, cancelación y recuperación. Gate en Mac del usuario.
5. **Canter/Review adapter.**
   Import decisiones/transcript sin volver a transcribir; source mapping exacto;
   notas y decisiones de corte siguen siendo entidades distintas.
6. **Dresser batch.**
   Repetir el recorrido certificado en 20 clips con fallos aislados y QA audiovisual.

## Trabajo con Copilot

Cada ticket: objetivo, archivos autorizados, contrato, fixture y criterio verificable.
Una rama por cambio. Un responsable integra contratos compartidos. Copilot puede
resolver UI/validadores/tests acotados; evitar encargos de toda la app en una sola sesión.
Usar AGENTS.md y .github/copilot-instructions.md como instrucciones compartidas.
El proyecto no depende de cuotas o rotación de cuentas de ningún asistente.

## Fuentes

La lista del usuario es biblioteca de ingeniería: REFERENCES/ADAPT/REUSE/INTEGRATE
se decide por unidad útil y licencia fijada. Ver research plan. En esta entrega solo
se auditó a profundidad lo necesario de los repos propios y los archivos Foundation;
no se afirma haber revisado todas las 46 referencias externas.
