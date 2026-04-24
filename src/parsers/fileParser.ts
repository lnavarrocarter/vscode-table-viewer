import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface TableData {
  headers: string[];
  rows: string[][];
  /** Original delimiter detected when parsing (preserved on save) */
  delimiter?: string;
}

export async function parseFile(buffer: Buffer, ext: string): Promise<TableData> {
  switch (ext) {
    case 'csv':
      return parseCsv(buffer.toString('utf8'));
    case 'tsv':
      return parseCsv(buffer.toString('utf8'), '\t');
    case 'xlsx':
    case 'xls':
    case 'ods':
      return parseXlsx(buffer);
    default:
      return parseCsv(buffer.toString('utf8'));
  }
}

/**
 * Parse CSV/TSV text.
 * When no delimiter is given, PapaParse auto-detects from [',', ';', '\t', '|'].
 */
function parseCsv(text: string, forcedDelimiter?: string): TableData {
  const result = Papa.parse<string[]>(text, {
    delimiter: forcedDelimiter ?? '',   // '' = auto-detect
    skipEmptyLines: true,
    header: false
  });

  const detectedDelimiter = (result.meta as any).delimiter as string ?? forcedDelimiter ?? ',';

  const all = result.data as string[][];
  if (all.length === 0) return { headers: [], rows: [], delimiter: detectedDelimiter };

  const headers = all[0].map((h, i) => h !== undefined && h !== '' ? String(h) : `Col${i + 1}`);
  const rows = all.slice(1).map(row => {
    const padded = [...row];
    while (padded.length < headers.length) padded.push('');
    return padded.map(cell => (cell === null || cell === undefined) ? '' : String(cell));
  });

  return { headers, rows, delimiter: detectedDelimiter };
}

function parseXlsx(buffer: Buffer): TableData {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const all: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false
  }) as string[][];

  if (all.length === 0) return { headers: [], rows: [] };

  const headers = all[0].map((h, i) => (h !== undefined && h !== '') ? String(h) : `Col${i + 1}`);
  const rows = all.slice(1).map(row => {
    const padded = [...row];
    while (padded.length < headers.length) padded.push('');
    return padded.map(cell => (cell === null || cell === undefined) ? '' : String(cell));
  });

  return { headers, rows };
}

export async function serializeFile(data: TableData, ext: string): Promise<Uint8Array> {
  switch (ext) {
    case 'csv':
      return serializeCsv(data, data.delimiter ?? ',');
    case 'tsv':
      return serializeCsv(data, '\t');
    case 'xlsx':
    case 'xls':
    case 'ods':
      return serializeXlsx(data, ext);
    default:
      return serializeCsv(data, ',');
  }
}

function serializeCsv(data: TableData, delimiter: string): Uint8Array {
  const rows = [data.headers, ...data.rows];
  const csv = Papa.unparse(rows, { delimiter });
  return Buffer.from(csv, 'utf8');
}

function serializeXlsx(data: TableData, ext: string): Uint8Array {
  const rows = [data.headers, ...data.rows];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');

  const bookType = ext === 'ods' ? 'ods' : ext === 'xls' ? 'biff8' : 'xlsx';
  const buf: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: bookType as XLSX.BookType });
  return new Uint8Array(buf);
}
