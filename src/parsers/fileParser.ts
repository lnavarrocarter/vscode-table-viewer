import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface TableData {
  headers: string[];
  rows: string[][];
  readOnly?: boolean;
  /** Original delimiter detected when parsing (preserved on save) */
  delimiter?: string;
}

export async function parseFile(buffer: Buffer, ext: string): Promise<TableData> {
  switch (ext) {
    case 'csv':
      return parseCsv(buffer.toString('utf8'));
    case 'tsv':
      return parseCsv(buffer.toString('utf8'), '\t');
    case 'txt':
      return parseCsv(buffer.toString('utf8'), '\t');
    case 'dbf': {
      if (buffer.length < 32) throw new Error('Invalid DBF header.');
      if (![0x03, 0x04, 0x05, 0x30, 0x31, 0x32, 0x43, 0x63, 0x83, 0x8b, 0xcb, 0xf5].includes(buffer[0])) {
        throw new Error('Unsupported DBF variant. Expected a dBASE III/IV or Visual FoxPro table.');
      }
      const headerLength = buffer.readUInt16LE(8);
      if (headerLength < 33 || headerLength > buffer.length) throw new Error('Invalid DBF header length.');
      const recordLength = buffer.readUInt16LE(10);
      const recordCount = buffer.readUInt32LE(4);
      if (!recordLength || recordCount > Math.floor((buffer.length - headerLength) / recordLength)) {
        throw new Error('Invalid or truncated DBF records.');
      }
      for (let offset = 32; offset + 32 <= headerLength && buffer[offset] !== 0x0d; offset += 32) {
        const fieldType = String.fromCharCode(buffer[offset + 11]);
        if (['M', 'G', 'P', 'W'].includes(fieldType)) {
          throw new Error('DBF memo fields are not supported yet. Import a CSV export from FoxPro including the memo contents instead.');
        }
      }
      return { ...parseXlsx(buffer), readOnly: true };
    }
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
  if (ext === 'dbf') throw new Error('DBF files are read-only. Export to CSV, TSV or XLSX instead.');
  switch (ext) {
    case 'csv':
      return serializeCsv(data, data.delimiter ?? ',');
    case 'tsv':
      return serializeCsv(data, '\t');
    case 'txt':
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
