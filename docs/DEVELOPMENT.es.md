# Desarrollo de Table Viewer

[English](DEVELOPMENT.md) · **Español** · [Volver al producto](../README.es.md)

## Preparación local

Utiliza Node.js 20 o posterior, npm y VS Code 1.85 o posterior. La verificación del paquete también requiere `unzip` (disponible en macOS y en el runner Ubuntu de CI). CI utiliza Node.js 22.

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
```

`npm test` extrae el VSIX en un directorio temporal fuera del repositorio. Comprueba recursos, activa la extensión con una API de VS Code simulada y verifica lectura/escritura de CSV, TSV, XLSX, XLS y ODS utilizando solo las dependencias empaquetadas. También verifica la conservación del delimitador punto y coma.

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
code --install-extension csv-xls-table-viewer-0.4.1.vsix
```

El nombre del paquete utiliza la versión de `package.json`; ajusta el comando de instalación cuando cambie.

Para publicar, actualiza `package.json` y `package-lock.json` juntos con `npm version`. El workflow se ejecuta con tags `v*.*.*`, exige que el tag coincida con la versión del manifiesto, ejecuta `npm test` y publica el VSIX validado en Marketplace y GitHub Releases. La publicación en Marketplace requiere el secreto de repositorio `VSCE_PAT`. Enviar un tag coincidente activa la publicación.

## Contribuciones a la documentación

El inglés es el idioma principal. Mantén alineados `README.md` y `README.es.md`, y actualiza ambas versiones de esta guía cuando cambien los pasos de desarrollo. Las descripciones del producto deben reflejar el comportamiento implementado. Utiliza datos sintéticos o anonimizados en ejemplos y capturas.
