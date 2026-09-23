<div align="center">
  <img src="logo.png" alt="Logo de Table Viewer" width="112" />
  <h1>CSV / XLS Table Viewer</h1>
  <p><strong>Tus datos, más claros. Dentro de VS Code.</strong></p>
  <p>Explora, filtra y edita archivos tabulares sin salir de tu editor.</p>
  <p><a href="README.md">English</a> · <strong>Español</strong></p>
  <p><a href="#primeros-pasos">Primeros pasos</a> · <a href="docs/DEVELOPMENT.es.md">Desarrollo</a> · <a href="https://github.com/lnavarrocarter/vscode-table-viewer/issues">Reportar un problema</a></p>
</div>

---

## Una tabla donde la necesitas

Convierte archivos CSV, TSV, XLSX, XLS y ODS en una tabla interactiva. Revisa una exportación, encuentra un registro o modifica una celda directamente en tu espacio de trabajo de VS Code.

- **Encuentra lo que importa.** Busca en todas las celdas con un filtro global que no distingue mayúsculas de minúsculas.
- **Explora por columna.** Haz clic en un encabezado para ordenar y otra vez para invertir el orden.
- **Edita directamente.** Haz doble clic en una celda, cambia su valor y guarda en el archivo original.
- **Sigue en tu editor.** Estilos adaptados al tema, encabezados fijos, números de fila y desplazamiento horizontal y vertical.
- **Conserva el delimitador.** El delimitador CSV se detecta automáticamente y se conserva al guardar; TSV utiliza tabulaciones.

## Primeros pasos

Requiere **VS Code 1.85 o posterior**. Los nombres de los controles se muestran en inglés, como en la interfaz de la extensión.

1. En VS Code, abre **Extensions** y busca `CSV / XLS Table Viewer` de `lnavarrocarter`.
2. Instala la extensión y abre un archivo compatible.
3. Si aparece como texto, haz clic derecho en su pestaña y elige **Reopen Editor With… → Table Viewer**.
4. Haz doble clic en una celda para editar y usa **Save changes** o **Ctrl+S** / **Cmd+S** para guardar.

También puedes instalar un `.vsix` de [GitHub Releases](https://github.com/lnavarrocarter/vscode-table-viewer/releases) desde **Extensions → … → Install from VSIX…**. Para crear el paquete localmente, consulta la [guía de desarrollo](docs/DEVELOPMENT.es.md).

## Formatos compatibles

| Formato | Lectura y guardado |
| --- | --- |
| CSV | Texto UTF-8; detección automática del delimitador y conservación al guardar |
| TSV | Texto UTF-8 separado por tabulaciones |
| XLSX | Primera hoja, mostrada como valores de texto |
| XLS | Primera hoja, mostrada como valores de texto |
| ODS | Primera hoja, mostrada como valores de texto |

La primera fila se utiliza como encabezado. Los encabezados vacíos reciben nombres como `Col1`; se omiten las líneas vacías en CSV/TSV.

**Guardado de libros:** los archivos XLSX, XLS y ODS se reconstruyen con una sola hoja llamada `Sheet1`, con valores de texto. No se conservan las demás hojas, las fórmulas, el formato ni los tipos originales de las celdas. Trabaja sobre una copia si necesitas mantener esos elementos.

## Controles habituales

| Acción | Control |
| --- | --- |
| Ordenar una columna | Clic en su encabezado; otro clic invierte el orden |
| Filtrar filas | Escribe en **Filter rows** |
| Editar una celda | Doble clic en la celda |
| Confirmar una edición | **Enter** o clic fuera de la celda |
| Cancelar una edición | **Escape** |
| Editar la siguiente celda de la misma fila | **Tab** durante la edición |
| Guardar | **Save changes**, **Ctrl+S** (Windows/Linux) o **Cmd+S** (macOS) |
| Abrir como texto | Clic derecho en la pestaña → **Reopen Editor With… → Text Editor** |

El orden y el filtro solo afectan la vista: no reordenan ni eliminan filas del archivo guardado. La búsqueda encuentra valores de celdas, no encabezados.

## Alcance actual

Table Viewer se centra en revisar datos y editar celdas existentes. No permite seleccionar hojas, calcular fórmulas, editar encabezados ni insertar filas o columnas. Todas las filas se renderizan a la vez, por lo que los archivos muy grandes pueden ser lentos. Deshacer, rehacer y revertir actualizan el modelo del documento, pero la tabla actual no se refresca automáticamente con estas operaciones.

## Documentación y soporte

- [Guía de desarrollo, empaquetado y publicación](docs/DEVELOPMENT.es.md)
- [Documentation in English](README.md)
- [Problemas y sugerencias](https://github.com/lnavarrocarter/vscode-table-viewer/issues): incluye tu versión de VS Code, formato del archivo, pasos para reproducir el problema y una muestra pequeña anonimizada.

## Autor y licencia

Creado por [lnavarrocarter](https://github.com/lnavarrocarter). Distribuido bajo la [licencia MIT](LICENSE).
