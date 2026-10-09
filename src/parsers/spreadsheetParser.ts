import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { IWorkbookData, ICellData } from '@univerjs/presets';
import { parseFile } from './fileParser';

export function readSpreadsheet(text: string): IWorkbookData {
  const data = JSON.parse(text) as IWorkbookData;
  if (!data || typeof data !== 'object' || !Array.isArray(data.sheetOrder) || !data.sheetOrder.length ||
      !data.sheets || typeof data.sheets !== 'object' || typeof data.id !== 'string' ||
      typeof data.name !== 'string' || data.sheetOrder.some(id => typeof id !== 'string' || !data.sheets[id])) {
    throw new Error('Invalid spreadsheet document. Expected a Univer workbook snapshot.');
  }
  return data;
}

export async function importSpreadsheet(buffer: Buffer, ext: string, name: string): Promise<IWorkbookData> {
  if (ext === 'json') return readSpreadsheet(buffer.toString('utf8'));
  if (!['csv', 'tsv', 'txt', 'dbf', 'xlsx', 'xls', 'ods'].includes(ext)) {
    throw new Error('Supported imports: CSV, TSV, tabulated TXT, DBF, XLSX, XLS and ODS.');
  }
  if (ext === 'dbf') await parseFile(buffer, ext);
  const isText = ['csv', 'tsv', 'txt'].includes(ext);
  let workbook: XLSX.WorkBook;
  if (isText) {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      if (text.includes('\0')) throw new Error('Null bytes in text input.');
    } catch {
      throw new Error('Text import requires UTF-8. Convert the source encoding before importing.');
    }
    const parsed = Papa.parse<string[]>(text, {
      delimiter: ext === 'csv' ? '' : '\t', skipEmptyLines: true
    });
    if (parsed.errors.some(error => error.type === 'Quotes')) throw new Error('Invalid quoted text in the input file.');
    workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(parsed.data), 'Data');
  } else {
    workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellNF: true });
  }
  const data: IWorkbookData = {
    id: 'workbook', name, appVersion: '1.0.3', locale: 'enUS' as IWorkbookData['locale'],
    styles: {}, sheetOrder: [], sheets: {}
  };
  workbook.SheetNames.forEach((sheetName, index) => {
    const id = `sheet-${index + 1}`;
    const source = workbook.Sheets[sheetName];
    const cellData: Record<number, Record<number, ICellData>> = {};
    const range = XLSX.utils.decode_range(source['!ref'] ?? 'A1');
    for (const [address, cell] of Object.entries(source)) {
      if (address.startsWith('!')) continue;
      const position = XLSX.utils.decode_cell(address);
      const target: ICellData = { v: cell.v ?? null };
      if (cell.t === 's') target.t = 1;
      if (cell.t === 'n') target.t = 2;
      if (cell.t === 'b') target.t = 3;
      if (cell.t === 'e') { target.v = cell.w ?? '#VALUE!'; target.t = 4; }
      if (cell.f) target.f = `=${cell.f}`;
      if (cell.z) target.s = { n: { pattern: cell.z } };
      (cellData[position.r] ??= {})[position.c] = target;
    }
    data.sheetOrder.push(id);
    data.sheets[id] = {
      id, name: sheetName, rowCount: Math.max(100, range.e.r + 20),
      columnCount: Math.max(26, range.e.c + 10), cellData,
      mergeData: (source['!merges'] ?? []).map(merge => ({
        startRow: merge.s.r, startColumn: merge.s.c, endRow: merge.e.r, endColumn: merge.e.c
      }))
    };
  });
  if (!data.sheetOrder.length) throw new Error('No worksheets found in the input file.');
  return data;
}

export function exportSpreadsheetValues(data: IWorkbookData, ext: string, sheetId: string): Uint8Array {
  if (!['csv', 'tsv', 'txt', 'xlsx'].includes(ext)) throw new Error('Export supports CSV, TSV, TXT and XLSX only.');
  const workbook = XLSX.utils.book_new();
  const ids = ext === 'xlsx' ? data.sheetOrder : [sheetId];
  for (const id of ids) {
    const source = data.sheets[id];
    if (!source) throw new Error('The selected worksheet no longer exists.');
    const sheet: XLSX.WorkSheet = {};
    let lastRow = 0;
    let lastColumn = 0;
    for (const [row, cells] of Object.entries(source.cellData ?? {})) {
      for (const [column, cell] of Object.entries((cells ?? {}) as Record<string, ICellData | null>)) {
        if (!cell) continue;
        const rowIndex = Number(row);
        const columnIndex = Number(column);
        if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= 1048576 ||
            !Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= 16384) {
          throw new Error('Cell coordinates exceed XLSX limits.');
        }
        const richText = cell.p?.body?.dataStream?.replace(/\r\n$/, '');
        const value = richText ?? cell.v ?? '';
        sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })] = {
          v: value, t: typeof value === 'number' ? 'n' : typeof value === 'boolean' ? 'b' : 's'
        };
        lastRow = Math.max(lastRow, rowIndex);
        lastColumn = Math.max(lastColumn, columnIndex);
      }
    }
    sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastColumn } });
    XLSX.utils.book_append_sheet(workbook, sheet, source.name ?? id);
  }
  if (ext === 'xlsx') return new Uint8Array(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '', raw: true });
  return Buffer.from(Papa.unparse(rows, { delimiter: ext === 'csv' ? ',' : '\t', escapeFormulae: true }), 'utf8');
}