# Generación externa, browser-assisted y handoff

## Materialization strategies

1. LOCAL/NATIVE
2. API/PROVIDER
3. TOOL/MCP adapter cuando sea útil
4. BROWSER_ASSISTED
5. MANUAL_HANDOFF

Los MCP/repos de referencia se estudian para entender capacidades y flujos; no deben volverse dependencias obligatorias.

## Browser-assisted

Es un adapter por sitio y debe ser tolerante a fallos. Flujo típico:

Open URL → verify login → navigate generator → upload refs → paste prompt → set allowed options → generate → poll/wait → download → Asset Manifest.

Si UI cambia, job queda `needs_manual_action` y ofrece prompt/references para completar manualmente.

## AI Package

Cada evento puede exportar:
- `PROMPT.txt`
- `VISUAL_BRIEF.txt`
- `OUTPUT_SPEC.json`
- references
- expected filename
- return instructions

Después “Import result” vincula el archivo al evento sin perder timing.

## Regla

No usar browser automation para evadir CAPTCHA, límites, pago, región o controles de acceso. Solo automatizar acciones que el usuario está autorizado a realizar.
