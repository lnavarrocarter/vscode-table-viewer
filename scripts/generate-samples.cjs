const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const directory = path.resolve(__dirname, '../examples');
const excelPath = path.join(directory, 'ventas-demo.xlsx');
const dbfPath = path.join(directory, 'ventas-demo.dbf');
const headers = ['ID', 'FECHA', 'REGION', 'VENDEDOR', 'PRODUCTO', 'CANTIDAD', 'PRECIO', 'TOTAL', 'ACTIVO'];
const regions = ['Norte', 'Centro', 'Sur'];
const sellers = ['Jos\u00e9', 'Mar\u00eda', 'Ana', 'Andr\u00e9s'];
const products = [['Cuaderno', 2490.5], ['L\u00e1piz', 590], ['Carpeta', 1290.75], ['Agenda', 5990]];
const rows = Array.from({ length: 24 }, (_, index) => {
  const product = products[index % products.length];
  const quantity = index === 6 || index === 17 ? -1 : 1 + index % 5;
  return [String(index + 1).padStart(6, '0'), new Date(2026, 9, 1 + index, 12),
    regions[index % regions.length], sellers[Math.floor(index / 3) % sellers.length],
    product[0], quantity, product[1], quantity * product[1], index % 7 !== 0];
});

async function generate() {
  if (fs.existsSync(excelPath) || fs.existsSync(dbfPath)) {
    throw new Error('Sample files already exist. Choose different filenames or move the existing samples before regenerating.');
  }
  const sales = XLSX.utils.aoa_to_sheet([headers, ...rows], { cellDates: true });
  sales['!cols'] = [10, 14, 12, 16, 16, 12, 14, 16, 10].map(width => ({ wch: width }));
  rows.forEach((row, index) => {
    const excelRow = index + 2;
    sales[`B${excelRow}`].z = 'yyyy-mm-dd';
    sales[`G${excelRow}`].z = '#,##0.00';
    sales[`H${excelRow}`] = { t: 'n', v: row[7], f: `F${excelRow}*G${excelRow}`, z: '#,##0.00' };
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sales, 'Ventas');
  const summary = XLSX.utils.aoa_to_sheet([['REGION', 'TOTAL'],
    ...regions.map(region => [region, rows.filter(row => row[2] === region).reduce((total, row) => total + row[7], 0)]),
    ['Total general', rows.reduce((total, row) => total + row[7], 0)]]);
  regions.forEach((region, index) => {
    summary[`B${index + 2}`].f = `SUMIF(Ventas!C2:C25,A${index + 2},Ventas!H2:H25)`;
    summary[`B${index + 2}`].z = '#,##0.00';
  });
  summary.B5.f = 'SUM(Ventas!H2:H25)';
  summary.B5.z = '#,##0.00';
  summary['!cols'] = [{ wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summary, 'Resumen');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['PRODUCTO', 'PRECIO'], ...products]), 'Catalogo');
  workbook.Props = { Title: 'Ventas ficticias para pruebas', Subject: 'Spreadsheet and FoxPro import samples' };
  const dbfWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(dbfWorkbook, XLSX.utils.aoa_to_sheet([headers, ...rows], { cellDates: true }), 'Ventas');
  const excelBytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', cellStyles: true });
  const dbfBytes = XLSX.write(dbfWorkbook, { type: 'buffer', bookType: 'dbf', codepage: 1252 });
  const excel = XLSX.read(excelBytes, { type: 'buffer' });
  const dbf = XLSX.read(dbfBytes, { type: 'buffer' });
  assert.deepEqual(excel.SheetNames, ['Ventas', 'Resumen', 'Catalogo']);
  assert.equal(excel.Sheets.Ventas.H2.f, 'F2*G2');
  assert.equal(excel.Sheets.Resumen.B5.f, 'SUM(Ventas!H2:H25)');
  assert.equal(excel.Sheets.Ventas.A2.v, '000001');
  assert.equal(dbf.Sheets[dbf.SheetNames[0]].A2.v, '000001');
  assert.equal(dbf.Sheets[dbf.SheetNames[0]].D2.v, 'Jos\u00e9');
  const { parseFile } = require('../out/parsers/fileParser');
  const { importSpreadsheet } = require('../out/parsers/spreadsheetParser');
  const table = await parseFile(dbfBytes, 'dbf');
  assert.equal(table.readOnly, true);
  assert.equal(table.rows.length, 24);
  assert.equal((await importSpreadsheet(excelBytes, 'xlsx', 'Demo')).sheetOrder.length, 3);
  assert.equal((await importSpreadsheet(dbfBytes, 'dbf', 'Demo')).sheets['sheet-1'].cellData[1][3].v, 'Jos\u00e9');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(excelPath, excelBytes, { flag: 'wx' });
  fs.writeFileSync(dbfPath, dbfBytes, { flag: 'wx' });
  console.log(`Created and validated: ${excelPath}`);
  console.log(`Created and validated: ${dbfPath}`);
  console.log(`24 sales records; Excel includes 3 sheets and formulas. Grand total: ${summary.B5.v}`);
}

generate().catch(error => { console.error(error.message); process.exitCode = 1; });