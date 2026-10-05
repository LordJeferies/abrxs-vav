# Product Spec

## Definición

Abraxas OS es una aplicación profesional local-first para planificar, cortar, vestir, revisar y entregar contenido audiovisual. Debe permitir que IA, automatización y control humano trabajen sobre un mismo proyecto sin perder editabilidad ni provenance.

## Resultado principal

Un usuario puede:

- entrar con un máster largo y salir con clips terminados;
- entrar con 20 clips verticales y salir con los 20 vestidos y exportados;
- entrar con un guion y salir con un plan visual antes de grabar;
- entrar con un video ya subtitulado y añadir solo B-roll/X-roll;
- añadir captions solo durante inserts si el A-roll ya lleva captions quemados;
- generar B-roll/X-roll dentro de la app o recibir un paquete para generarlo externamente;
- terminar en Abraxas o continuar en DaVinci/CapCut con assets, instrucciones y timeline plan.

## Calidad objetivo

No es “poner fotos encima de un podcast”. El sistema debe modelar ritmo editorial, intención visual, composición, motion, audio, continuidad, branding y QA. La automatización debe poder producir un resultado publicable; el modo manual debe permitir superar la salida automática.

## No objetivos

- No sustituir completamente DaVinci/Fusion/After Effects.
- No ser un Zapier/n8n generalista.
- No duplicar Canter dentro de Dresser.
- No acoplar el core a un proveedor de IA.
- No hacer que el browser automation sea requisito para funcionar.
- No obligar a usar Workflow Studio para tareas comunes.

## Modos de uso

### Auto
Analiza, planifica, materializa, compone, QA y exporta sin revisión obligatoria.

### Assisted
Crea ghost events/propuestas; el usuario aprueba/edita antes de gastar/generar.

### Manual Pro
El usuario crea y ajusta eventos, assets, zoom, posiciones, timing y render.

### Directed
Importa un plan JSON/TXT/IA/humano y lo materializa.

Todos generan los mismos contratos.
