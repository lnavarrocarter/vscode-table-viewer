# Registro de cambios

Aquí se documentan los cambios importantes. Las notas de publicación en inglés están en el [changelog inglés](../changelog.md).

## 0.5.0 - 2026-10-09

### Añadido
- Editor spreadsheet experimental con Univer: fórmulas, selección de celdas, formato, operaciones de hojas y deshacer/rehacer.
- Importación a un documento de trabajo `.sheet.json` separado y exportación de valores calculados a XLSX, CSV, TSV o TXT tabulado.
- Resúmenes tipo tabla dinámica con agrupación por filas y columnas opcionales, suma, conteo, promedio, mínimo y máximo, con definiciones guardadas que se pueden actualizar.
- Copiado y pegado de valores mediante el portapapeles de VS Code, conservando ceros iniciales y texto multilínea.
- Importación de DBF/FoxPro de solo lectura; los campos memo se rechazan explícitamente.
- Ejemplos ficticios de Excel con varias hojas y DBF en `examples/`.
- Actualización de SheetJS a 0.20.3 y avisos de licencias de dependencias incluidos en el paquete.
