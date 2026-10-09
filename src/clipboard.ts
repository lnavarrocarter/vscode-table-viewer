import * as Papa from 'papaparse';
import type { ICellData, CellValue } from '@univerjs/presets';

export function encodeClipboard(values: (CellValue | null)[][]): string {
  if (values.reduce((count, row) => count + row.length, 0) > 100000) throw new Error('Copy supports up to 100,000 cells.');
  return Papa.unparse(values, { delimiter: '\t', escapeFormulae: true });
}

export function clipboardCells(text: string): ICellData[][] {
  if (!text || text.length > 4 * 1024 * 1024) throw new Error('Clipboard is empty or exceeds 4 MB.');
  const parsed = Papa.parse<string[]>(text, { delimiter: '\t', skipEmptyLines: false });
  if (parsed.errors.length) throw new Error('Clipboard contains invalid quoted tabular text.');
  const rows = parsed.data;
  if (/[\r\n]$/.test(text) && rows.at(-1)?.length === 1 && rows.at(-1)?.[0] === '') rows.pop();
  const width = rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  if (!width || rows.length * width > 100000) throw new Error('Paste supports up to 100,000 cells.');
  return rows.map(row => Array.from({ length: width }, (_, index) => ({ v: row[index] ?? '', t: 4 })));
}