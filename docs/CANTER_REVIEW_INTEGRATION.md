# Integración de Canter 3.8.1 y Review 05

## Estado verificado al preparar este starter

Abrxs-Canter tiene un commit reciente `b6c8e4c` con actualización 3.8.1 y Review 05. Su `Cargo.toml` marca 3.8.1. El README describe Estudio 3.8, cola, fichas, reutilización de exportaciones, word-aligned limits y range media playback.

Abrxs-Review tiene Review 05 con Drive como visor inicial, recovery del reproductor opcional, notas de timing manual y límites explícitos de Safari/Google iframe.

## Estrategia

1. No copiar todo el código dentro de este repo inmediatamente.
2. Crear adapters de import/export.
3. Extraer contratos comunes: project, transcript, source map, fichas, jobs.
4. Conseguir paridad de lectura/escritura.
5. Solo después migrar UI/servicios concretos al shell React/Tauri.
6. Mantener Review web como companion.

## Frontera

Canter = narrativa/source edit.  
Dresser = visual finish.  
Review = feedback/aprobación.  
Delivery = output compilation.
