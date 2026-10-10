import type { IWorkbookData, IRange } from '@univerjs/presets';
import { cellValue, pivotHeaders } from './pivot';

export function tableRows(data: IWorkbookData, sheetId: string, range: IRange) {
  const headers = pivotHeaders(data, { sourceSheetId: sheetId, range });
  const sheet = data.sheets[sheetId];
  const rows = [];
  for (let row = range.startRow + 1; row <= range.endRow; row++) {
    const values = headers.map((_, index) => {
      const cell = sheet.cellData?.[row]?.[range.startColumn + index];
      if (cell?.f) throw new Error('Analysis requires plain values. Recalculate and export formula results first.');
      return cellValue(cell);
    });
    if (values.some(value => value !== null && value !== '')) rows.push(values);
  }
  return { headers, rows };
}

export function joinTables(left: ReturnType<typeof tableRows>, right: ReturnType<typeof tableRows>, leftKey: number, rightKey: number, mode: 'LEFT' | 'INNER') {
  if (![leftKey, rightKey].every(Number.isInteger) || leftKey < 0 || leftKey >= left.headers.length || rightKey < 0 || rightKey >= right.headers.length) throw new Error('Invalid join key index.');
  if (!['LEFT', 'INNER'].includes(mode)) throw new Error('Unsupported join mode.');
  const key = (value: unknown) => value === null || value === '' ? null : JSON.stringify([typeof value, value]);
  const index = new Map<string, typeof right.rows>();
  for (const row of right.rows) {
    const value = key(row[rightKey]);
    if (value !== null) {
      if (!index.has(value)) index.set(value, []);
      index.get(value)!.push(row);
    }
  }
  const values: Array<Array<string | number | boolean | null>> = [[...left.headers.map(header => `left.${header}`), ...right.headers.map(header => `right.${header}`)]];
  const width = values[0].length;
  let matched = 0;
  let unmatched = 0;
  for (const row of left.rows) {
    const value = key(row[leftKey]);
    const matches = value === null ? [] : index.get(value) ?? [];
    if (matches.length) matched++; else unmatched++;
    for (const match of matches.length ? matches : mode === 'LEFT' ? [right.headers.map(() => null)] : []) {
      if ((values.length + 1) * width > 100000) throw new Error('Join result exceeds 100,000 cells. Narrow the ranges or remove duplicate keys.');
      values.push([...row, ...match]);
    }
  }
  return { values, matchedLeftRows: matched, unmatchedLeftRows: unmatched, outputRows: values.length - 1 };
}