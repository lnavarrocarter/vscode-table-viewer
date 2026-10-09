import groupBy from 'lodash/groupBy';
import sumBy from 'lodash/sumBy';
import mean from 'lodash/mean';
import min from 'lodash/min';
import max from 'lodash/max';
import type { IWorkbookData, IRange, ICellData } from '@univerjs/presets';

export interface PivotDefinition {
  sourceSheetId: string;
  range: IRange;
  rowField: number;
  columnField: number | null;
  valueField: number;
  aggregation: 'SUM' | 'COUNT' | 'AVERAGE' | 'MIN' | 'MAX';
}

type Scalar = string | number | boolean | null;
interface RecordData { row: Scalar; column: Scalar; value: number | null; present: boolean }

export function cellValue(cell?: ICellData | null): Scalar {
  return cell?.p?.body?.dataStream?.replace(/\r\n$/, '') ?? cell?.v ?? null;
}

export function usedRange(sheet: IWorkbookData['sheets'][string]): IRange {
  let endRow = 0;
  let endColumn = 0;
  for (const [row, cells] of Object.entries(sheet.cellData ?? {})) {
    for (const [column, cell] of Object.entries((cells ?? {}) as Record<string, ICellData>)) {
      const value = cellValue(cell);
      if (value === null || value === '') continue;
      endRow = Math.max(endRow, Number(row));
      endColumn = Math.max(endColumn, Number(column));
    }
  }
  return { startRow: 0, startColumn: 0, endRow, endColumn };
}

export function pivotHeaders(data: IWorkbookData, definition: Pick<PivotDefinition, 'sourceSheetId' | 'range'>): string[] {
  const sheet = data.sheets[definition.sourceSheetId];
  if (!sheet) throw new Error('The pivot source worksheet no longer exists.');
  const range = definition.range;
  if (![range.startRow, range.startColumn, range.endRow, range.endColumn].every(Number.isInteger) ||
      range.startRow < 0 || range.startColumn < 0 || range.endRow <= range.startRow ||
      range.endColumn < range.startColumn || range.endRow >= (sheet.rowCount ?? 0) ||
      range.endColumn >= (sheet.columnCount ?? 0)) {
    throw new Error('Select a valid range containing a header row and at least one data row.');
  }
  if ((range.endRow - range.startRow + 1) * (range.endColumn - range.startColumn + 1) > 100000) {
    throw new Error('Basic pivots support source ranges up to 100,000 cells.');
  }
  return Array.from({ length: range.endColumn - range.startColumn + 1 }, (_, offset) => {
    const value = cellValue(sheet.cellData?.[range.startRow]?.[range.startColumn + offset]);
    return value === null || value === '' ? `Column ${range.startColumn + offset + 1}` : String(value);
  });
}

export function buildPivot(data: IWorkbookData, definition: PivotDefinition): Scalar[][] {
  const headers = pivotHeaders(data, definition);
  const { range, rowField, columnField, valueField, aggregation } = definition;
  for (const index of [rowField, valueField, ...(columnField === null ? [] : [columnField])]) {
    if (!Number.isInteger(index) || index < 0 || index >= headers.length) throw new Error('Invalid pivot field.');
  }
  if (!['SUM', 'COUNT', 'AVERAGE', 'MIN', 'MAX'].includes(aggregation)) throw new Error('Unsupported pivot aggregation.');
  const sheet = data.sheets[definition.sourceSheetId];
  const records: RecordData[] = [];
  for (let row = range.startRow + 1; row <= range.endRow; row++) {
    const cells = Array.from({ length: headers.length }, (_, index) => cellValue(sheet.cellData?.[row]?.[range.startColumn + index]));
    if (cells.every(value => value === null || value === '')) continue;
    const raw = cells[valueField];
    const present = raw !== null && raw !== '' && !(typeof raw === 'string' && raw.trim() === '');
    let value: number | null = null;
    if (present && aggregation !== 'COUNT') {
      if (typeof raw === 'number') value = raw;
      else if (typeof raw === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) value = Number(raw);
      if (value === null || !Number.isFinite(value)) throw new Error(`Non-numeric value in ${headers[valueField]}, row ${row + 1}.`);
    }
    records.push({ row: cells[rowField], column: columnField === null ? null : cells[columnField], value, present });
  }
  if (!records.length) throw new Error('The pivot source range has no data records.');
  const aggregate = (items: RecordData[]): Scalar => {
    if (aggregation === 'COUNT') return sumBy(items, item => item.present ? 1 : 0);
    const numbers = items.flatMap(item => item.value === null ? [] : [item.value]);
    if (!numbers.length) return aggregation === 'SUM' ? 0 : null;
    switch (aggregation) {
      case 'SUM': return sumBy(numbers, value => value);
      case 'AVERAGE': return mean(numbers);
      case 'MIN': return min(numbers) ?? null;
      case 'MAX': return max(numbers) ?? null;
    }
  };
  const rows = groupBy(records, item => JSON.stringify(item.row));
  const columns = groupBy(records, item => JSON.stringify(item.column));
  const groups = groupBy(records, item => JSON.stringify([item.row, item.column]));
  const rowKeys = Object.keys(rows);
  const columnKeys = Object.keys(columns);
  if ((rowKeys.length + 2) * (columnKeys.length + 2) > 100000) throw new Error('The pivot result exceeds 100,000 cells.');
  const label = (value: Scalar) => value === null || value === '' ? '(blank)' : String(value);
  if (columnField === null) {
    return [[headers[rowField], `${aggregation} ${headers[valueField]}`],
      ...rowKeys.map(key => [label(rows[key][0].row), aggregate(rows[key])]),
      ['Grand total', aggregate(records)]];
  }
  return [[headers[rowField], ...columnKeys.map(key => label(columns[key][0].column)), 'Grand total'],
    ...rowKeys.map(key => [label(rows[key][0].row),
      ...columnKeys.map(columnKey => aggregate(groups[JSON.stringify([rows[key][0].row, columns[columnKey][0].column])] ?? [])),
      aggregate(rows[key])]),
    ['Grand total', ...columnKeys.map(key => aggregate(columns[key])), aggregate(records)]];
}