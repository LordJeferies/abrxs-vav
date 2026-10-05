# Publicar o integrar Foundation 0.2

Este ZIP es código de producto reproducible, con package-lock, pruebas y docs.
No incluye node_modules, media, datos locales, credenciales ni resultados privados.

## Si quieres un repositorio separado para la fundación

Desde la carpeta extraída:

```bash
git init
git add .
git commit -m "Implement local project persistence and recoverable jobs"
```

Crea un repositorio público vacío en GitHub, sin README generado. Sigue los comandos
que GitHub muestre para conectar ese remote y subir main. Esta entrega no ejecuta push.

## Si continúa dentro de LordJeferies/abraxas-os

No subir esta carpeta reemplazando la raíz: el repo actual tiene editor funcional Alfa.
Crear una rama, integrar packages/contracts y packages/core con namespaces, llevar
apps/service como adapter local y conectar el editor existente después del contrato
Alpha/SourceMap. Las dos shells no deben actuar como autoridades de un mismo proyecto.
Sigue sus reglas PROJECT_CONTROL y gates existentes antes de merge.

## CI

GitHub Actions ejecuta npm ci, check, test y build. El test de navegador es opcional
local con npm run test:ui después de instalar Chromium. No dispara generación ni usa
claves de proveedores. Nada de .abraxas-data entra en Git.
