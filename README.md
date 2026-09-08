# CSV / XLS Table Viewer — VS Code Extension

Visualiza y edita archivos **CSV, TSV, XLSX, XLS y ODS** como una tabla interactiva dentro de VS Code.

## Características

- 📊 Tabla con scroll horizontal y vertical
- 🔃 Ordenar por cualquier columna (click en el header)
- 🔍 Filtrar filas con búsqueda global
- ✏️ Editar celdas con doble click
- 💾 Guardar cambios al archivo original
- ↩️ Soporte para Undo/Redo nativo de VS Code

## Setup e instalación

### 1. Instalar dependencias

```bash
cd vscode-csv-table-extension
npm install
```

### 2. Crear directorio `.vscode` y archivos de debug

```bash
mkdir .vscode
```

Luego crea `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

Y `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "watch",
      "problemMatcher": "$tsc-watch",
      "isBackground": true,
      "presentation": { "reveal": "never" },
      "group": { "kind": "build", "isDefault": true }
    }
  ]
}
```

### 3. Compilar TypeScript

```bash
npm run compile
```

### 4. Probar en modo desarrollo

Abre el directorio en VS Code y presiona **F5**. Se abre una ventana de VS Code en modo Extension Development Host. Abre cualquier archivo `.csv`, `.tsv`, `.xlsx`, `.xls` o `.ods` y se mostrará la tabla.

### 5. Empaquetar la extensión (opcional)

```bash
npm run package
# Genera: csv-xls-table-viewer-<version>.vsix
```

Instala el `.vsix` con:

```bash
code --install-extension csv-xls-table-viewer-<version>.vsix
```

## Estructura del proyecto

```
vscode-csv-table-extension/
├── src/
│   ├── extension.ts              # Entry point
│   ├── tableEditorProvider.ts    # Custom Editor Provider
│   └── parsers/
│       └── fileParser.ts         # Parsers CSV/TSV/XLSX/ODS
├── media/
│   ├── table.css                 # Estilos de la tabla (tema VS Code)
│   └── table.js                  # UI interactiva (sort, filter, edit)
├── .vscode/
│   ├── launch.json               # Configuración de debug F5
│   └── tasks.json                # Build task
├── package.json
└── tsconfig.json
```

## Uso

| Acción | Cómo |
|--------|------|
| Ordenar columna | Click en el header de la columna |
| Invertir orden | Click de nuevo en el mismo header |
| Filtrar filas | Escribe en el campo de búsqueda |
| Editar celda | Doble click en la celda |
| Confirmar edición | `Enter` o click fuera |
| Cancelar edición | `Escape` |
| Navegar celdas | `Tab` mientras editas |
| Guardar | Botón `💾 Save` o `Ctrl+S` |
| Ver como texto | Clic derecho → *Open With* → *Text Editor* |

## Verificación del paquete antes de publicar

```bash
npm ci
npm test
```

`npm test` compila, genera `table-viewer.vsix` y lo extrae en un directorio
temporal fuera del repositorio. Comprueba los recursos, activa la extensión con
una API de VS Code simulada y prueba lectura/escritura de CSV, TSV, XLSX, XLS y ODS
usando exclusivamente las dependencias incluidas en el paquete. Requiere Node.js
20 o superior y `unzip` (disponible en macOS y en el runner Ubuntu de CI).

La compilación TypeScript conserva los imports de `papaparse` y `xlsx`: deben
incluirse sus dependencias de producción. No excluir `node_modules/**` ni usar
`--no-dependencies` sin introducir primero un bundler.

Para verificar también la interfaz real, instala `table-viewer.vsix` mediante
**Extensions → Install from VSIX**, abre un archivo de cada formato, edita una
celda, guarda y vuelve a abrir el archivo. La prueba automática no ejecuta la
interfaz ni un Extension Host real.

El workflow de release verifica que el tag coincida con `package.json`, ejecuta
estas pruebas y publica el mismo VSIX validado. Antes de crear un nuevo tag,
actualiza la versión en `package.json` y `package-lock.json` con `npm version`.
