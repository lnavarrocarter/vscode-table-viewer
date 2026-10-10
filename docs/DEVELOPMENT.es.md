# Desarrollo de Table Viewer

[English](DEVELOPMENT.md) · **Español** · [Volver al producto](../README.es.md)

## Preparación local

Utiliza Node.js 20 o posterior, npm y VS Code 1.105 o posterior. La verificación del paquete también requiere `unzip` (disponible en macOS y en el runner Ubuntu de CI). CI utiliza Node.js 22.

```bash
git clone https://github.com/lnavarrocarter/vscode-table-viewer.git
cd vscode-table-viewer
npm ci
npm run compile
```

Abre el repositorio en VS Code y presiona **F5**. Los archivos `.vscode/launch.json` y `.vscode/tasks.json` ya incluidos inician la compilación continua y abren un Extension Development Host. Abre un archivo compatible en esa ventana para probar el editor.

## Arquitectura

| Archivo | Responsabilidad |
| --- | --- |
| `src/extension.ts` | Registra el editor personalizado y el comando de texto |
| `src/tableEditorProvider.ts` | Ciclo del documento, mensajes de la webview, guardado y respaldo |
| `src/parsers/fileParser.ts` | CSV/TSV con PapaParse y libros con SheetJS |
| `media/table.js` | Renderizado de tabla, filtros, orden y edición de celdas |
| `media/table.css` | Interfaz adaptable con los colores del tema de VS Code |
| `src/spreadsheetEditorProvider.ts` | Editor JSON nativo experimental, importación y exportación de valores |
| `src/parsers/spreadsheetParser.ts` | Snapshots Univer con tipos y hojas múltiples; exportación de valores |
| `src/pivot.ts` | Agrupaciones y totales de pivots validados mediante lodash |
| `src/clipboard.ts` | Copiado/pegado TSV con comillas, texto literal y rangos limitados |
| `src/tableAnalysis.ts` | Filtros por columna y resumenes decimales de filas visibles |
| `src/mcp.ts` | MCP HTTP por sesion, autorizacion, previews y escrituras confirmadas |
| `src/tableJoin.ts` | Cruces LEFT/INNER acotados por clave exacta y tipo |
| `src/finance.ts` | Presupuesto/conciliacion decimal, redondeo y duplicados |
| `src/chartOptions.ts`, `media/charts.js` | Chart.js, objetos movibles y exportacion PNG |
| `tests/mcp.test.cjs` | Cliente SDK HTTP real con host VS Code simulado |
| `media/spreadsheet.js` | Spreadsheet Univer OSS local y sincronización del documento |
| `scripts/build-webview.cjs` | Empaqueta recursos frontend y avisos de licencias de terceros |
| `tests/spreadsheet.test.cjs` | Pruebas de adaptadores/protocolo y preview de navegador |
| `tests/extension-host.test.cjs` | Prueba aislada de activación, guardado y portapapeles en VS Code real |
| `tests/package.test.cjs` | Verificación del VSIX independiente y lectura/escritura de formatos |
| `.github/workflows/validate.yml` | Validación del paquete en pushes y pull requests a main |
| `.github/workflows/release.yml` | Validación del tag de versión y publicación |

El proveedor lee el archivo como encabezados y filas de texto. La webview envía mensajes `ready`, `edit` y `save`; el proveedor responde con `load` y `saved`. Los filtros y el orden conservan el índice original de cada fila para editar la fila de origen correcta. El análisis y la serialización se ejecutan en el host de la extensión.

## Compilación y verificación

```bash
npm run compile       # Compilar TypeScript
npm run watch         # Recompilar al modificar archivos
npm test              # Compilar, empaquetar y probar table-viewer.vsix
npm run test:package  # Probar un table-viewer.vsix existente
npm run test:spreadsheet # Compilar y probar adaptadores y protocolo del host
npm run test:mcp       # Compilar y probar autorizacion y analisis HTTP
npm run test:extension-host # VS Code real con perfil temporal
npm run watch:webview # Reconstruir recursos Univer al cambiar el frontend
npm run preview:spreadsheet # Preview: localhost:39431; Table Viewer: /table
```

`npm test` ejecuta pruebas de adaptadores/protocolo y extrae el VSIX fuera del repositorio. Comprueba recursos y avisos de licencias, activa ambos editores con una API de VS Code simulada, verifica lectura/escritura de CSV, TSV, TXT, XLSX, XLS y ODS y comprueba DBF de solo lectura y adaptadores nativos usando solo las dependencias empaquetadas. También verifica la conservación del delimitador punto y coma.

`npm run compile` compila TypeScript y la webview Univer. La tarea `watch` existente observa solo TypeScript; ejecuta `watch:webview` por separado para cambios frontend. Univer y esbuild son dependencias de desarrollo: el frontend se empaqueta en `media/generated/`, sin cargar Node modules ni CDN en ejecución. Incluye los recursos generados en el VSIX aunque Git los ignore. La compilación recopila las licencias de los paquetes incluidos. Mantén todos los paquetes Univer fijados a versiones coincidentes.

El preview utiliza el HTML y la CSP de producción con un host VS Code simulado, el libro ficticio `examples/ventas-demo.xlsx` y un portapapeles en memoria. Abre `http://127.0.0.1:39431/` para Spreadsheet o `/table` para el Table Viewer clásico. No accede al portapapeles del sistema. Las comprobaciones de navegador cubren renderizado no vacío, cálculo, formato, deshacer/rehacer, creación/actualización/recarga de pivots, copiado/pegado de valores, temas y ancho reducido. Los documentos nativos usan el ciclo de vida de texto de VS Code; las ediciones son snapshots versionados y la exportación conserva solo valores. Las definiciones de pivots se guardan en metadatos personalizados de la hoja de resultados, vinculados a la versión fijada de Univer. Los valores del portapapeles pasan por `vscode.env.clipboard` mediante acciones explícitas del usuario.

`test:extension-host` inicia el VS Code instalado con perfil y directorio de extensiones temporales, comprueba activación, apertura, guardado y API del portapapeles, y restaura el contenido original sin registrarlo. En macOS detecta instalaciones habituales; en otros entornos define `VSCODE_TEST_EXECUTABLE` con el ejecutable de la aplicación. Es independiente de `npm test` porque requiere una instalación con GUI. No automatiza Excel/Sheets. Las pruebas DBF usan fixtures binarios independientes de dBASE III y Visual FoxPro, con CP1252, fechas, decimales, booleanos y registros borrados. Los DBF reales anonimizados y el intercambio con aplicaciones externas siguen como comprobaciones manuales. La importación de memos y la escritura DBF deben fallar explícitamente.

SheetJS está fijado al tarball oficial 0.20.3 porque npm permanece en 0.18.5. El lockfile registra integridad y la prueba del VSIX aislado exige esa versión empaquetada. Ejecuta `npm audit --omit=dev` para comprobar producción; las herramientas de desarrollo pueden mantener avisos independientes. No sustituyas la fuente oficial por el paquete antiguo de npm. Fuente: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/.

TypeScript conserva los imports de `papaparse` y `xlsx`, por lo que deben incluirse sus dependencias de producción. No excluyas `node_modules/**` ni uses `--no-dependencies` sin incorporar antes un bundler.

La prueba automática no ejecuta la webview ni un Extension Host real. Antes de publicar, instala el VSIX y verifica:

- Abrir un archivo de cada formato, editar una celda, guardar y volver a abrir.
- Filtrar y ordenar, editar una fila visible y confirmar que cambia la fila de origen correcta.
- Comprobar Enter, Escape y Tab durante la edición.
- Revisar temas claro, oscuro y de alto contraste, un editor estrecho, archivos vacíos y búsquedas sin resultados.
- Usar copias desechables de libros para confirmar las limitaciones de guardado descritas en el README.

## Empaquetado y publicación

```bash
npm run package
code --install-extension csv-xls-table-viewer-0.6.0.vsix
```

El nombre del paquete utiliza la versión de `package.json`; ajusta el comando de instalación cuando cambie.

Para publicar, actualiza `package.json` y `package-lock.json` juntos con `npm version`. El workflow se ejecuta con tags `v*.*.*`, exige que el tag coincida con la versión del manifiesto, ejecuta `npm test` y publica el VSIX validado en Marketplace y GitHub Releases. La publicación en Marketplace requiere el secreto de repositorio `VSCE_PAT`. Enviar un tag coincidente activa la publicación.

## Contribuciones a la documentación

Para reproducir las tres capturas actuales, compila e inicia `npm run preview:spreadsheet`. Con Playwright y su Chromium correspondiente instalados en un directorio externo de herramientas, ejecuta:

```bash
PLAYWRIGHT_MODULE_PATH=/ruta/absoluta/a/node_modules/playwright node scripts/capture-screenshots.cjs
```

Si Node ya puede resolver Playwright, omite la variable. El script comprueba el total del filtro, crea y mueve el grafico mediante la interfaz real, verifica pixeles no vacios, guarda PNGs de escritorio/movil y cierra su navegador. Solo cambia las capturas; los datos ficticios del grafico quedan en memoria. Chromium independiente evita las superficies recortadas de paginas ocultas del navegador integrado. Playwright es opcional para documentacion, no una dependencia de ejecucion.

Capturas actuales: `media/table-filters.png`, `media/table-filters-mobile.png` y `media/spreadsheet-charts.png`. Captura HTML de produccion mediante el preview local con datos ficticios. El filtro selecciona REGION contiene Norte y SUM de CANTIDAD; los importes con separadores de miles se ignoran por las reglas numericas estrictas. El grafico usa un resumen regional ficticio con Units/Target y tipo combinado. Indica que el host es simulado; no presentes el preview como sesion real de Copilot o Extension Host. Mantén ambos README alineados y valida rutas antes de empaquetar.

`npm test` incluye tambien MCP. El servidor arranca explicitamente, solo expone documentos autorizados y escribe mediante previews confirmados. Prueba arranque sin documentos, compartir archivo actual/cancelacion, revision de carpetas, fuentes obsoletas y cambios deshacibles sin guardado automatico. El visor carga `media/generated/table.js`: el fuente importa decimal.js y lucide y no se sirve directamente como script clasico. `watch:webview` observa ambos bundles y compile construye ambas webviews. La importacion DBF llama a `validateDbf` compartido una sola vez antes de decodificar tipos; las pruebas cubren descriptores/registros corruptos y tablas vacias. Verifica variantes reales manualmente antes de ampliar las afirmaciones de compatibilidad.

El inglés es el idioma principal. Mantén alineados `README.md` y `README.es.md`, y actualiza ambas versiones de esta guía cuando cambien los pasos de desarrollo. Las descripciones del producto deben reflejar el comportamiento implementado. Utiliza datos sintéticos o anonimizados en ejemplos y capturas.
