# Abraxas OS

Lee AGENTS.md, docs/IMPLEMENTATION_STATUS.md y docs/CONVERSATION_DECISIONS.md.
El Production Graph es canónico. Trabaja en una tarea acotada por rama/PR.
Core no importa UI ni Node. El servicio implementa Repository y la UI consume API.
No escribas directo en archivos desde handlers o componentes: usa el propietario
transaccional y expected revision. Masters/secretos no entran en graph, logs ni Git.
No presentes estaciones pendientes como funcionales. No introduzcas providers,
renderers o automatización de navegador para arreglar persistencia.
Conserva frames enteros y final exclusivo. Respeta FPS racional.
No modifiques Canter/Review ni sustituyas el editor Alfa actual.
Antes de reutilizar código de references/: fija commit, comprueba licencia y registra origen.
Verifica npm run check, npm test y npm run build. Actualiza implementation status.
