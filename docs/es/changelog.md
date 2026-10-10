# Registro de cambios

Aquí se documentan los cambios importantes. Las notas de publicación en inglés están en el [changelog inglés](../changelog.md).

## En desarrollo

## 0.6.0 - 2026-10-10

### Añadido
- README y guias MCP/desarrollo bilingues actualizados con comandos actuales, flujos DBF/filtros/resumenes, creacion JSON, graficos, analisis con agentes y capturas del preview en escritorio/movil.
- Filtros por columna en el visor (contiene, igual, distinto, comparaciones numericas, vacio/no vacio) combinados con busqueda global, y COUNT/SUM/AVERAGE/MIN/MAX sobre filas visibles con aritmetica decimal. DBF ofrece una copia Spreadsheet editable sin modificar el original.
- Validacion estructural DBF compartida por el visor y las importaciones Spreadsheet/MCP: descriptores, nombres unicos, anchos no nulos, estructura de registros, terminador y marcadores de borrado. Rechazo explicito de tablas cifradas y soporte de tablas vacias.
- Boton Connect Agent en el visor de tablas para compartir directamente el archivo abierto con MCP; Spreadsheet tambien comparte su documento actual sin buscarlo de nuevo.
- Comando Start MCP Server para activar OpenSpreadsheet sin abrir hojas ni compartir archivos previamente.
- Confirmaciones MCP resumidas y carpetas compartidas con revision de archivos. Rutas y permisos visibles en la salida de VS Code y copiables para chat; el agente obtiene rutas mediante list_documents.
- Ejemplos CSV ficticios y verosimiles de facturas y cobros, resultado esperado y guia de conciliacion con pagos parciales, redondeo, duplicados, notas de credito y referencias sin correspondencia.
- Previews MCP de real frente a presupuesto y conciliacion con aritmetica decimal, redondeo HALF_UP explicito, tolerancia configurable, claves sin correspondencia y revision de duplicados. Resultados en hojas editables separadas sin modificar fuentes.
- Creacion y refresco de pivots MCP y enlaces LEFT/INNER por clave exacta entre formatos autorizados. Resultados en hojas editables con previews confirmados, limites y deteccion de cambios en las fuentes.
- Barras horizontales, columnas apiladas y graficos combinados (ultima serie como linea en eje secundario), formatos numericos, monetarios y porcentuales, y exportacion PNG. Estilos y formatos disponibles tambien en previews MCP.
- Controles de tamaño y leyenda del grafico y herramientas MCP `list_charts` y `preview_chart` para creacion, edicion y eliminacion confirmadas sin modificar celdas.
- Graficos propios dentro de la hoja con Chart.js: columnas, lineas y circular, datos desde un rango, titulo y rango editables, movimiento, actualizacion y eliminacion. Se guardan en `.sheet.json`; posicion relativa al visor, sin exportacion de graficos XLSX.
- Herramientas MCP para crear una copia editable confirmada y autorizada automaticamente, y agregar hojas mediante preview sin cambiar las hojas existentes.
- Conector MCP local experimental para Copilot: lectura multiformato autorizada, previews de valores y normalizacion de texto, y ediciones confirmadas y deshacibles. Requiere VS Code 1.105+. Ver [guia MCP](../MCP.es.md).
- Conversión de arrays de objetos JSON a columnas, incluyendo contenedores de una única propiedad como `[{"users": [...]}]`; los valores anidados se conservan como texto JSON.
- Comando New OpenSpreadsheet, inicialización automática de archivos `.sheet.json` vacíos y conversión deshacible de arrays JSON simples con confirmación explícita.
- Botón Open as Spreadsheet en el visor de tablas para crear una copia de trabajo del archivo actual. Las ediciones pendientes deben guardarse antes de importar.

## 0.5.0 - 2026-10-09

### Añadido
- Editor spreadsheet experimental con Univer: fórmulas, selección de celdas, formato, operaciones de hojas y deshacer/rehacer.
- Importación a un documento de trabajo `.sheet.json` separado y exportación de valores calculados a XLSX, CSV, TSV o TXT tabulado.
- Resúmenes tipo tabla dinámica con agrupación por filas y columnas opcionales, suma, conteo, promedio, mínimo y máximo, con definiciones guardadas que se pueden actualizar.
- Copiado y pegado de valores mediante el portapapeles de VS Code, conservando ceros iniciales y texto multilínea.
- Importación de DBF/FoxPro de solo lectura; los campos memo se rechazan explícitamente.
- Ejemplos ficticios de Excel con varias hojas y DBF en `examples/`.
- Actualización de SheetJS a 0.20.3 y avisos de licencias de dependencias incluidos en el paquete.
