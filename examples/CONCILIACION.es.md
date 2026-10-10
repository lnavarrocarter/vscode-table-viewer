# Ejemplo de conciliacion

Datos totalmente ficticios de una empresa de servicios, cierre de septiembre de 2026. Clientes, documentos y movimientos son inventados; no representan registros reales. Ambas fuentes usan USD y el mismo signo: cobros positivos y devoluciones negativas. No se incluyen datos bancarios ni identificadores personales.

## Archivos

- `conciliacion-facturas.csv`: extracto ERP, 12 registros en total: 11 filas de facturas (incluido un posible duplicado) y una nota de credito.
- `conciliacion-cobros.csv`: extracto de cobros y devoluciones, 12 movimientos.
- `conciliacion-esperada.csv`: resultado de referencia para tolerancia 0.01 y dos decimales; no es una fuente para conciliar.

Las tres tablas tienen encabezados. Importes con punto decimal sin separadores de miles. En las fuentes, Referencia es columna 0 e Importe columna 5 (indices base cero).

## Probar Con MCP

1. Autoriza los dos archivos fuente mediante Connect Sheet Agent (MCP).
2. Crea o autoriza una copia editable `.sheet.json` para recibir el resultado. El MCP puede solicitar `create_working_copy` sobre facturas y usar el documento devuelto como destino.
3. Solicita: "Concilia conciliacion-facturas.csv con conciliacion-cobros.csv por Referencia e Importe. Usa tolerancia 0.01, dos decimales y crea una hoja ConciliacionSeptiembre en la copia editable. Conserva los originales y muestra los estados antes de aplicar".
4. Revisa y confirma el preview. Compara con `conciliacion-esperada.csv`.

Para ambos rangos: startRow 0, startColumn 0, endRow 12, endColumn 7; key 0, amount 5. La primera fila es el encabezado. El identificador de hoja se obtiene con describe_table; no debe suponerse a mano.

## Resultado Esperado

13 claves: 5 MATCHED, 2 DIFFERENCE, 2 DUPLICATE_REVIEW, 2 ONLY_LEFT y 2 ONLY_RIGHT.

- 0903: diferencia 10.00 que debe investigarse; no asumir comision sin evidencia.
- 0904: diferencia -0.01 aceptada por la tolerancia inclusiva. Con tolerancia 0.00 pasa a DIFFERENCE.
- 0905: cobro parcial; quedan 900.00 de diferencia.
- 0906: dos abonos suman 1200.00, pero se marca DUPLICATE_REVIEW porque la herramienta no asigna pagos individuales automaticamente.
- 0910: posible duplicado ERP. Los totales coinciden pero requieren revision; la coincidencia no demuestra que la factura sea correcta.
- 0907 y 0908: sin cobro en este extracto. No implica mora: sus vencimientos son posteriores al cierre.
- 0899 y ANT-0100: cobros sin documento en este conjunto; pueden corresponder a otro periodo o un anticipo.
- NC-0041: reembolso negativo que coincide con la nota de credito.

La conciliacion compara referencias e importes, no fechas, moneda ni cliente. Antes de usar datos reales, filtra periodos y monedas y valida signos. No elimina duplicados ni modifica las fuentes.