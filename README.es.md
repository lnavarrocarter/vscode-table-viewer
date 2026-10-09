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
| DBF / FoxPro | Valores de solo lectura; se rechazan campos memo externos |

La primera fila se utiliza como encabezado. Los encabezados vacíos reciben nombres como `Col1`; se omiten las líneas vacías en CSV/TSV.

**Guardado de libros:** los archivos XLSX, XLS y ODS se reconstruyen con una sola hoja llamada `Sheet1`, con valores de texto. No se conservan las demás hojas, las fórmulas, el formato ni los tipos originales de las celdas. Trabaja sobre una copia si necesitas mantener esos elementos.

## Spreadsheet experimental

Ejecuta **Table Viewer: Import into Spreadsheet (Experimental)** desde la paleta de comandos, selecciona un CSV, TSV, TXT tabulado UTF-8, DBF, XLSX, XLS u ODS y crea un documento de trabajo **`.sheet.json`** separado. El archivo de origen no se modifica. El documento de trabajo se abre con **Spreadsheet (Experimental)**.

El motor local Univer OSS incluye selección de rangos, edición con teclado, controles de copiado/pegado, fórmulas, formato, operaciones de hojas y su propio deshacer/rehacer. Guarda el documento con el icono de guardar o **Ctrl+S / Cmd+S**. VS Code también registra los cambios del documento de texto y recarga el spreadsheet ante cambios externos o deshacer. No requiere CDN, licencia Pro ni servidor.

- La importación de libros conserva todas las hojas, tipos escalares, fórmulas, formatos numéricos y combinaciones, no el estilo completo de Excel, gráficos, macros ni tablas dinámicas. Al importar un libro se calculan sus fórmulas compatibles; no se garantiza equivalencia con Excel para funciones no soportadas.
- Los campos CSV/TSV/TXT comienzan como texto para conservar identificadores y ceros iniciales. El texto importado que parece fórmula no se ejecuta. Convierte explícitamente los valores numéricos o utiliza funciones como `VALUE` cuando sea necesario. La importación de texto requiere UTF-8 por ahora.
- Los DBF originales son de solo lectura. La copia nativa es editable y conserva los tipos escalares importados, pero no es un editor DBF. No se admiten campos memo (`M`, `G`, `P`, `W`), archivos externos FPT/DBT, índices ni escritura hacia FoxPro. Las codificaciones antiguas y variantes DBF requieren verificación con archivos reales.
- El icono de exportar escribe **solo valores calculados**: XLSX incluye todas las hojas; CSV/TSV/TXT incluye la hoja activa. Las fórmulas, estilos y configuraciones quedan en `.sheet.json`. El texto que parece fórmula se escapa al exportar a texto. La exportación puede sobrescribir el destino seleccionado explícitamente; elige un archivo nuevo.
- **Copy values / Paste values** en la barra superior usan el portapapeles del sistema mediante VS Code, sin depender de los permisos del navegador. Se copia TSV con comillas; el pegado conserva ceros iniciales, campos multilínea y textos que parecen fórmulas como cadenas literales. Al copiar se escapan las cadenas que parecen fórmulas para proteger las aplicaciones externas. Los números pegados comienzan como texto; conviértelos explícitamente cuando sea necesario. Estos controles transfieren valores, no estilos ni definiciones de fórmulas. Los controles propios de Univer siguen disponibles para edición nativa.
- **Create pivot table** agrupa un rango en una hoja nueva con un campo de filas, otro opcional de columnas, un campo de valores y suma, conteo de no vacíos, promedio, mínimo o máximo. Los totales se calculan sobre los registros de origen. **Refresh pivot table** actualiza los valores de la hoja de resultados y limpia las celdas antiguas; la definición se conserva en `.sheet.json`. El rango requiere encabezados y es fijo: ampliar datos o insertar/eliminar filas o columnas del origen no actualiza la definición automáticamente. Crea un pivot nuevo cuando cambie la estructura. Tanto el origen como el resultado tienen un límite de 100.000 celdas. Las agregaciones numéricas aceptan números y texto decimal/científico con punto; rechazan otro texto no vacío.
- Son tablas de análisis básicas, no objetos PivotTable nativos de Excel. La exportación incluye sus resultados, no definiciones actualizables. Varias medidas, agrupaciones jerárquicas, filtros de pivot, gráficos, exportación enriquecida e integraciones comerciales siguen pendientes. Los snapshots nativos son experimentales y están vinculados a la versión fijada de Univer; conserva originales y respaldos.

Las pruebas cubren activación, apertura, guardado y API del portapapeles en un Extension Host real, además de registros sintéticos dBASE III/FoxPro con CP1252, fechas, decimales, booleanos y registros borrados. El intercambio con Excel/Sheets y tus DBF reales requiere verificación manual. SheetJS CE está fijado a la versión oficial 0.20.3, que corrige los avisos conocidos de 0.18.5; la auditoría de dependencias de producción actualmente no reporta vulnerabilidades. Continúa tratando los archivos importados como datos no confiables.

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

El Table Viewer original se centra en revisar datos y editar celdas existentes. A diferencia del editor spreadsheet experimental separado, no permite seleccionar hojas, calcular fórmulas, editar encabezados ni insertar filas o columnas. Todas las filas se renderizan a la vez, por lo que los archivos muy grandes pueden ser lentos. Deshacer, rehacer y revertir actualizan el modelo del documento, pero la tabla original no se refresca automáticamente con estas operaciones.

## Documentación y soporte

- [Guía de desarrollo, empaquetado y publicación](docs/DEVELOPMENT.es.md)
- [Registro de cambios](docs/es/changelog.md)
- [Documentation in English](README.md)
- [Problemas y sugerencias](https://github.com/lnavarrocarter/vscode-table-viewer/issues): incluye tu versión de VS Code, formato del archivo, pasos para reproducir el problema y una muestra pequeña anonimizada.

## Autor y licencia

Creado por [lnavarrocarter](https://github.com/lnavarrocarter). Distribuido bajo la [licencia MIT](LICENSE).

El editor experimental incluye Univer OSS (Apache-2.0) y otras bibliotecas de terceros. Sus licencias y avisos se incluyen en `media/generated/THIRD_PARTY_LICENSES.txt` dentro del VSIX.
