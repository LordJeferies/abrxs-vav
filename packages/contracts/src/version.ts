/* ═══ VERSIÓN DEL PRODUCTO — fuente única (0.5.1) ═══
   ABRXS_VERSION es LA versión del producto AbrxsVAV. Debe coincidir con:
   - package.json raíz y de cada workspace (apps/service, apps/desktop, packages/*)
   - apps/desktop/src-tauri/tauri.conf.json (bundle)
   - /api/health y /api/catalog (apps/service/src/server.ts)
   - scripts/doctor.ts
   - mcp/server.mjs (lo consulta de /api/health al inicializar; no lo hardcodea)
   El test tests/version.test.ts verifica la consistencia; no subas una versión
   solo aquí. Actualiza también CHANGELOG.md y docs/IMPLEMENTATION_STATUS.md. */
export const ABRXS_VERSION = '0.6.0';
