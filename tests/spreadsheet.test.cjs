const assert = require('node:assert/strict');
const { test } = require('node:test');
const XLSX = require('xlsx');
const { parseFile, serializeFile } = require('../out/parsers/fileParser');
const { importSpreadsheet, readSpreadsheet, exportSpreadsheetValues } = require('../out/parsers/spreadsheetParser');
const { buildPivot, usedRange } = require('../out/pivot');
const { clipboardCells, encodeClipboard } = require('../out/clipboard');

function fixture() {
  const workbook = XLSX.utils.book_new();
  const data = XLSX.utils.aoa_to_sheet([['Name', 'Amount', 'Total'], ['Ana', 42], ['Jose', 8]]);
  data.C2 = { t: 'n', v: 50, f: 'SUM(B2:B3)', z: '0.00' };
  data['!ref'] = 'A1:C3';
  XLSX.utils.book_append_sheet(workbook, data, 'Data');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Flag'], [true]]), 'Flags');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function independentDbf(variant) {
  const fields = [{ name: 'Name', type: 'C', width: 12 }, { name: 'Amount', type: 'N', width: 10, decimals: 2 },
    { name: 'Date', type: 'D', width: 8 }, { name: 'Active', type: 'L', width: 1 }];
  const headerLength = 33 + fields.length * 32 + (variant === 0x30 ? 263 : 0);
  const recordLength = 1 + fields.reduce((total, field) => total + field.width, 0);
  const rows = [
    { deleted: false, values: ['Jos\u00e9', '-12.50', '20261009', 'T'] },
    { deleted: false, values: ['Ana', '0.00', '20261010', 'F'] },
    { deleted: true, values: ['Deleted', '999.00', '20261011', 'T'] }
  ];
  const buffer = Buffer.alloc(headerLength + rows.length * recordLength + 1);
  buffer[0] = variant;
  buffer[1] = 126;
  buffer[2] = 10;
  buffer[3] = 9;
  buffer.writeUInt32LE(rows.length, 4);
  buffer.writeUInt16LE(headerLength, 8);
  buffer.writeUInt16LE(recordLength, 10);
  buffer[29] = 0x03;
  fields.forEach((field, index) => {
    const offset = 32 + index * 32;
    buffer.write(field.name, offset, 'ascii');
    buffer[offset + 11] = field.type.charCodeAt(0);
    buffer[offset + 16] = field.width;
    buffer[offset + 17] = field.decimals ?? 0;
  });
  buffer[32 + fields.length * 32] = 0x0d;
  rows.forEach((row, index) => {
    let offset = headerLength + index * recordLength;
    buffer[offset++] = row.deleted ? 0x2a : 0x20;
    row.values.forEach((value, column) => {
      const field = fields[column];
      const padded = field.type === 'N' ? value.padStart(field.width, ' ') : value.padEnd(field.width, ' ');
      Buffer.from(padded, 'latin1').copy(buffer, offset);
      offset += field.width;
    });
  });
  buffer[buffer.length - 1] = 0x1a;
  return buffer;
}

if (!process.argv.includes('--preview')) {
  test('clipboard TSV handles quoted newlines, ragged rows and literal formulas', () => {
    const text = encodeClipboard([['Code', 'Note'], ['0012', 'first\nsecond'], ['=1+1', 'text\twith tab']]);
    const values = clipboardCells(text);
    assert.equal(values[1][0].v, '0012');
    assert.equal(values[1][1].v, 'first\nsecond');
    assert.equal(values[2][0].v, "'=1+1");
    assert.equal(values[2][1].v, 'text\twith tab');
    assert.equal(clipboardCells('=1+1')[0][0].t, 4);
    assert.deepEqual(clipboardCells('a\tb\nc\n'), [[{ v: 'a', t: 4 }, { v: 'b', t: 4 }], [{ v: 'c', t: 4 }, { v: '', t: 4 }]]);
    assert.throws(() => clipboardCells(''), /empty/);
    assert.throws(() => clipboardCells('"unclosed'), /invalid/);
  });
  test('basic pivot grouping handles every aggregation and weighted grand totals', async () => {
    const data = await importSpreadsheet(Buffer.from('Team;Quarter;Amount\nA;Q1;10\nA;Q1;30\nA;Q2;100\nB;Q2;20'), 'csv', 'Pivot');
    const definition = { sourceSheetId: 'sheet-1', range: usedRange(data.sheets['sheet-1']), rowField: 0, columnField: 1, valueField: 2, aggregation: 'SUM' };
    assert.deepEqual(buildPivot(data, definition), [['Team', 'Q1', 'Q2', 'Grand total'], ['A', 40, 100, 140], ['B', 0, 20, 20], ['Grand total', 40, 120, 160]]);
    const average = buildPivot(data, { ...definition, aggregation: 'AVERAGE' });
    assert.equal(average[1][1], 20);
    assert.equal(average[1][3], 140 / 3);
    assert.deepEqual(average.at(-1), ['Grand total', 20, 60, 40]);
    assert.equal(buildPivot(data, { ...definition, aggregation: 'COUNT' }).at(-1).at(-1), 4);
    assert.equal(buildPivot(data, { ...definition, aggregation: 'MIN' }).at(-1).at(-1), 10);
    assert.equal(buildPivot(data, { ...definition, aggregation: 'MAX' }).at(-1).at(-1), 100);
    assert.deepEqual(buildPivot(data, { ...definition, columnField: null }), [['Team', 'SUM Amount'], ['A', 140], ['B', 20], ['Grand total', 160]]);
    const invalid = structuredClone(data);
    invalid.sheets['sheet-1'].cellData[1][2].v = 'not a number';
    assert.throws(() => buildPivot(invalid, definition), /Non-numeric/);
    assert.equal(buildPivot(invalid, { ...definition, aggregation: 'COUNT' }).at(-1).at(-1), 4);
    assert.throws(() => buildPivot(data, { ...definition, sourceSheetId: 'missing' }), /no longer exists/);
    assert.throws(() => buildPivot(data, { ...definition, valueField: 9 }), /Invalid pivot field/);
    assert.throws(() => buildPivot(data, { ...definition, aggregation: 'EVAL' }), /Unsupported/);
  });

  test('pivots preserve blank groups and do not collide on delimiter-like labels', async () => {
    const data = await importSpreadsheet(Buffer.from('Team;Quarter;Amount\n;Q1;\nx|y;z;5\nx;y|z;7'), 'csv', 'Pivot');
    const definition = { sourceSheetId: 'sheet-1', range: usedRange(data.sheets['sheet-1']), rowField: 0, columnField: 1, valueField: 2, aggregation: 'COUNT' };
    const counted = buildPivot(data, definition);
    assert.equal(counted[1][0], '(blank)');
    assert.equal(counted[1].at(-1), 0);
    assert.equal(counted.at(-1).at(-1), 2);
    const summed = buildPivot(data, { ...definition, aggregation: 'SUM' });
    assert.equal(summed[2].at(-1), 5);
    assert.equal(summed[3].at(-1), 7);
  });

  test('imports all sheets, types, formulas and number formats into native snapshots', async () => {
    const data = await importSpreadsheet(fixture(), 'xlsx', 'Example');
    assert.equal(data.sheetOrder.length, 2);
    assert.equal(data.sheets['sheet-1'].cellData[1][1].v, 42);
    assert.equal(data.sheets['sheet-1'].cellData[1][2].f, '=SUM(B2:B3)');
    assert.deepEqual(data.sheets['sheet-1'].cellData[1][2].s, { n: { pattern: '0.00' } });
    assert.equal(data.sheets['sheet-2'].cellData[1][0].v, true);
    data.styles = { bold: { bl: 1 } };
    assert.deepEqual(readSpreadsheet(JSON.stringify(data)), data);
    assert.throws(() => readSpreadsheet('{}'), /Invalid spreadsheet/);
  });

  test('text import preserves identifiers and formula-like text without execution', async () => {
    for (const ext of ['csv', 'tsv', 'txt']) {
      const delimiter = ext === 'csv' ? ';' : '\t';
      const data = await importSpreadsheet(Buffer.from(`Code${delimiter}Value\n00123${delimiter}=1+1`), ext, 'Text');
      assert.equal(data.sheets['sheet-1'].cellData[1][0].v, '00123');
      assert.equal(data.sheets['sheet-1'].cellData[1][1].v, '=1+1');
      assert.equal(data.sheets['sheet-1'].cellData[1][1].f, undefined);
      const exported = Buffer.from(exportSpreadsheetValues(data, ext, 'sheet-1')).toString();
      assert.match(exported, /00123/);
      assert.match(exported, /'=1\+1/);
    }
  });

  test('DBF is read-only, typed on import and rejects memo fields and malformed headers', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Name', 'Amount'], ['Ana', 42]]), 'Data');
    const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'dbf' });
    const table = await parseFile(bytes, 'dbf');
    assert.equal(table.readOnly, true);
    assert.deepEqual(table.rows, [['Ana', '42']]);
    await assert.rejects(serializeFile(table, 'dbf'), /read-only/);
    const data = await importSpreadsheet(bytes, 'dbf', 'DBF copy');
    assert.equal(data.sheets['sheet-1'].cellData[1][1].v, 42);
    assert.match(Buffer.from(exportSpreadsheetValues(data, 'csv', 'sheet-1')).toString(), /Ana,42/);
    for (const type of ['M', 'G', 'P', 'W']) {
      const memo = Buffer.from(bytes);
      memo[43] = type.charCodeAt(0);
      await assert.rejects(importSpreadsheet(memo, 'dbf', 'Memo'), /memo/);
    }
    await assert.rejects(parseFile(Buffer.alloc(8), 'dbf'), /header/);
    await assert.rejects(parseFile(bytes.subarray(0, bytes.length - 10), 'dbf'), /truncated/);
    const invalid = Buffer.from(bytes);
    invalid[0] = 0;
    await assert.rejects(parseFile(invalid, 'dbf'), /variant/);
  });

  test('independent dBASE III and FoxPro fixtures preserve codepage, dates, decimals and deletion flags', async () => {
    for (const variant of [0x03, 0x30]) {
      const bytes = independentDbf(variant);
      const table = await parseFile(bytes, 'dbf');
      assert.equal(table.readOnly, true);
      assert.equal(table.rows.length, 2);
      assert.equal(table.rows[0][0], 'Jos\u00e9');
      const data = await importSpreadsheet(bytes, 'dbf', 'Independent DBF');
      const cells = data.sheets['sheet-1'].cellData;
      assert.equal(cells[1][1].v, -12.5);
      assert.equal(cells[2][1].v, 0);
      assert.equal(cells[1][3].v, true);
      assert.equal(cells[2][3].v, false);
      const date = XLSX.SSF.parse_date_code(cells[1][2].v);
      assert.deepEqual([date.y, date.m, date.d], [2026, 10, 9]);
      assert.equal(cells[3], undefined);
      assert.equal(Buffer.compare(bytes, independentDbf(variant)), 0);
    }
  });

  test('value-only exports preserve sheets and scalar types, but never formula definitions', async () => {
    const data = await importSpreadsheet(fixture(), 'xlsx', 'Example');
    const workbook = XLSX.read(exportSpreadsheetValues(data, 'xlsx', 'sheet-1'), { type: 'array' });
    assert.deepEqual(workbook.SheetNames, ['Data', 'Flags']);
    assert.equal(workbook.Sheets.Data.C2.v, 50);
    assert.equal(workbook.Sheets.Data.C2.f, undefined);
    assert.equal(workbook.Sheets.Data.B2.t, 'n');
    assert.equal(workbook.Sheets.Flags.A2.t, 'b');
    const csv = Buffer.from(exportSpreadsheetValues(data, 'csv', 'sheet-2')).toString();
    assert.match(csv, /Flag/);
    assert.doesNotMatch(csv, /Ana/);
    assert.throws(() => exportSpreadsheetValues(data, 'dbf', 'sheet-1'), /Export supports/);
    assert.throws(() => exportSpreadsheetValues(data, 'csv', 'missing'), /no longer exists/);
  });

  test('tabulated TXT round trip keeps tabs', async () => {
    const data = await parseFile(Buffer.from('Name\tAmount\nAna\t42'), 'txt');
    assert.deepEqual(data.rows, [['Ana', '42']]);
    assert.match(Buffer.from(await serializeFile(data, 'txt')).toString(), /Name\tAmount/);
    await assert.rejects(importSpreadsheet(Buffer.from('Name\tAmount', 'utf16le'), 'txt', 'Wrong encoding'), /UTF-8/);
    await assert.rejects(importSpreadsheet(Buffer.from([0xff, 0xfe, 0x41, 0x00]), 'txt', 'Wrong encoding'), /UTF-8/);
    await assert.rejects(importSpreadsheet(Buffer.from('Name;Note\nAna;"unterminated'), 'csv', 'Invalid quotes'), /quoted/);
  });

  test('native editor synchronizes edits, external undo and stale versions', async () => {
    const Module = require('node:module');
    const originalLoad = Module._load;
    const messages = [];
    const listeners = {};
    const data = await importSpreadsheet(fixture(), 'xlsx', 'Host test');
    let text = JSON.stringify(data);
    let savedText;
    const document = {
      uri: { toString: () => 'test.sheet.json' }, version: 1, lineCount: 1,
      getText: () => text, save: async () => { savedText = text; return true; }
    };
    const api = {
      env: { clipboard: {
        readText: async () => '0012\t7', writeText: async value => { listeners.clipboard = value; }
      } },
      Uri: { joinPath: (base, ...parts) => `${base}/${parts.join('/')}` },
      Range: class {},
      WorkspaceEdit: class { replace(uri, range, value) { this.value = value; } },
      workspace: {
        onDidChangeTextDocument: listener => { listeners.change = listener; return { dispose() {} }; },
        applyEdit: async edit => {
          await Promise.resolve();
          text = edit.value;
          document.version++;
          listeners.change({ document });
          return true;
        }
      },
      window: { showErrorMessage: message => { throw new Error(message); } }
    };
    Module._load = function (id, ...args) { return id === 'vscode' ? api : originalLoad.call(this, id, ...args); };
    const providerPath = require.resolve('../out/spreadsheetEditorProvider');
    delete require.cache[providerPath];
    let SpreadsheetEditorProvider;
    try { ({ SpreadsheetEditorProvider } = require(providerPath)); }
    finally { Module._load = originalLoad; delete require.cache[providerPath]; }
    const panel = {
      webview: {
        cspSource: "'self'", asWebviewUri: value => value,
        postMessage: message => messages.push(message),
        onDidReceiveMessage: listener => { listeners.message = listener; return { dispose() {} }; }
      }, onDidDispose: listener => { listeners.dispose = listener; }
    };
    await new SpreadsheetEditorProvider({ extensionUri: '/extension' }).resolveCustomTextEditor(document, panel);
    await listeners.message({ type: 'ready' });
    assert.equal(messages.at(-1).type, 'load');
    await listeners.message({ type: 'clipboardRead', requestId: 1 });
    assert.deepEqual(messages.at(-1), { type: 'clipboardResult', requestId: 1, text: '0012\t7' });
    await listeners.message({ type: 'clipboardWrite', requestId: 2, text: 'Name\tAmount\nAna\t42' });
    assert.equal(listeners.clipboard, 'Name\tAmount\nAna\t42');
    assert.equal(messages.at(-1).requestId, 2);
    const edited = structuredClone(data);
    edited.sheets['sheet-1'].cellData[1][1].v = 20;
    const editing = listeners.message({ type: 'edit', data: edited, version: 1 });
    const saving = listeners.message({ type: 'save' });
    await Promise.all([editing, saving]);
    assert.equal(JSON.parse(savedText).sheets['sheet-1'].cellData[1][1].v, 20);
    assert.equal(messages.at(-1).type, 'ack');
    assert.equal(messages.at(-1).version, 2);
    text = JSON.stringify(data);
    document.version++;
    listeners.change({ document });
    assert.equal(messages.at(-1).type, 'load');
    assert.equal(messages.at(-1).data.sheets['sheet-1'].cellData[1][1].v, 42);
    await listeners.message({ type: 'edit', data: edited, version: 2 });
    assert.equal(JSON.parse(text).sheets['sheet-1'].cellData[1][1].v, 42);
    assert.equal(messages.at(-1).version, 3);
    listeners.dispose();
  });
} else {
  const http = require('node:http');
  const fs = require('node:fs');
  const path = require('node:path');
  const Module = require('node:module');
  const originalLoad = Module._load;
  Module._load = function (id, ...args) {
    if (id === 'vscode') return { Uri: { joinPath: (base, ...parts) => path.join(base, ...parts) } };
    return originalLoad.call(this, id, ...args);
  };
  const { SpreadsheetEditorProvider } = require('../out/spreadsheetEditorProvider');
  Module._load = originalLoad;
  const provider = new SpreadsheetEditorProvider({ extensionUri: '/' });
  importSpreadsheet(fixture(), 'xlsx', 'Spreadsheet test').then(data => {
    let html = provider.getHtml({ cspSource: "'self'", asWebviewUri: value => value });
    const nonce = html.match(/script-src 'nonce-([^']+)'/)[1];
    const bootstrap = `<script nonce="${nonce}">
      let version = 1;
      window.__messages = [];
      window.__saved = ${JSON.stringify(data)};
      window.__clipboard = '';
      window.acquireVsCodeApi = () => ({ postMessage(message) {
        window.__messages.push(message);
        if (message.type === 'ready') queueMicrotask(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'load', data: window.__saved, version } })));
        if (message.type === 'edit') {
          window.__saved = message.data;
          queueMicrotask(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'ack', version: ++version } })));
        }
        if (message.type === 'clipboardWrite') {
          window.__clipboard = message.text;
          queueMicrotask(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'clipboardResult', requestId: message.requestId } })));
        }
        if (message.type === 'clipboardRead') queueMicrotask(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'clipboardResult', requestId: message.requestId, text: window.__clipboard } })));
      }});
      window.addEventListener('error', event => { window.__error = event.message; });
    </script>`;
    html = html.replace('<main id="spreadsheet">', `${bootstrap}<main id="spreadsheet">`);
    const assets = new Map([
      ['/media/generated/spreadsheet.js', ['application/javascript', path.join(__dirname, '../media/generated/spreadsheet.js')]],
      ['/media/generated/spreadsheet.css', ['text/css', path.join(__dirname, '../media/generated/spreadsheet.css')]]
    ]);
    http.createServer((request, response) => {
      if (request.url === '/') { response.setHeader('Content-Type', 'text/html'); response.end(html); return; }
      const asset = assets.get(request.url);
      if (!asset) { response.writeHead(404); response.end(); return; }
      response.setHeader('Content-Type', asset[0]);
      fs.createReadStream(asset[1]).pipe(response);
    }).listen(39431, '127.0.0.1', () => console.log('Spreadsheet preview: http://127.0.0.1:39431'));
  }).catch(error => { console.error(error); process.exitCode = 1; });
}