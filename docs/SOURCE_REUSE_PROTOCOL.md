# Protocolo para estudiar/copiar repos de referencia

Para cada feature nueva:

1. Definir qué problema concreto de Abraxas se quiere resolver.
2. Identificar 1–3 repos de referencia relevantes.
3. Fijar commit/tag de cada referencia.
4. Leer arquitectura, tests y licencia; no copiar por similitud visual solamente.
5. Clasificar cada hallazgo:
   - IDEA: patrón conceptual;
   - CONTRACT: forma de datos útil;
   - CODE: bloque potencialmente reutilizable;
   - UX: interacción/product behavior;
   - TEST: estrategia de validación.
6. Preferir adaptar la unidad mínima útil, no incorporar la app completa.
7. Si se copia código, registrar URL, commit, licencia y cambios en `THIRD_PARTY_NOTICES.md`.
8. Encapsularlo detrás de una interfaz/adapter Abraxas.
9. Añadir fixture/test propio.
10. Verificar que deshabilitar esa integración no rompe el resto del producto.

Los MCP de referencia (por ejemplo Freepik) se estudian para entender el dominio y la forma de exponer capabilities; no hay obligación de usar MCP en runtime.
