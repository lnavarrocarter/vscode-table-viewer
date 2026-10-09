const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Extract outside the checkout: Node must not find the development node_modules.
test('VSIX runs with only its packaged dependencies and assets', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'table-viewer-test-'));
  try {
    execFileSync('unzip', ['-q', path.resolve(process.env.VSIX_PATH || 'table-viewer.vsix'), '-d', dir]);
    const root = path.join(dir, 'extension');
    const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    for (const asset of [manifest.main, 'media/table.js', 'media/table.css', 'media/generated/spreadsheet.js', 'media/generated/spreadsheet.css', 'media/generated/THIRD_PARTY_LICENSES.txt', manifest.icon]) {
      assert.ok(existsSync(path.join(root, asset)), `Missing packaged asset: ${asset}`);
    }
    const script = `
      const assert = require('node:assert/strict');
      const Module = require('node:module');
      const originalLoad = Module._load;
      const registrations = [];
      // Only the API supplied by the VS Code host is mocked; libraries load normally.
      Module._load = function(id, ...args) {
        if (id === 'vscode') return {
          EventEmitter: class { event = () => {}; },
          window: {
            registerCustomEditorProvider: (id) => { registrations.push(id); return { dispose() {} }; },
            registerCustomTextEditorProvider: (id) => { registrations.push(id); return { dispose() {} }; }
          },
          commands: { registerCommand: (id) => { registrations.push(id); return { dispose() {} }; } }
        };
        return originalLoad.call(this, id, ...args);
      };
      (async () => {
        const manifest = require('./package.json');
        const context = { subscriptions: [] };
        require(manifest.main).activate(context);
        assert.deepEqual(registrations, [manifest.contributes.customEditors[0].viewType, manifest.contributes.customEditors[1].viewType, manifest.contributes.commands[1].command, manifest.contributes.commands[0].command]);
        assert.equal(context.subscriptions.length, 4);
        const { parseFile, serializeFile } = require('./out/parsers/fileParser.js');
        const data = { headers: ['Name', 'Note'], rows: [['José', 'hello, world'], ['Ana', 'line 1\\nline 2']] };
        for (const ext of ['csv', 'tsv', 'txt', 'xlsx', 'xls', 'ods']) {
          const parsed = await parseFile(Buffer.from(await serializeFile(data, ext)), ext);
          assert.deepEqual(parsed.headers, data.headers, ext);
          assert.deepEqual(parsed.rows, data.rows, ext);
        }
        const csv = await parseFile(Buffer.from('Name;Value\\nJosé;42\\nAna;'), 'csv');
        assert.equal(csv.delimiter, ';');
        assert.deepEqual(csv.rows, [['José', '42'], ['Ana', '']]);
        assert.match(Buffer.from(await serializeFile(csv, 'csv')).toString(), /Name;Value/);
        const XLSX = require('xlsx');
        assert.equal(XLSX.version, '0.20.3');
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Name', 'Amount'], ['Ana', 42]]), 'Data');
        const dbfBytes = XLSX.write(workbook, { type: 'buffer', bookType: 'dbf' });
        const dbf = await parseFile(dbfBytes, 'dbf');
        assert.equal(dbf.readOnly, true);
        await assert.rejects(serializeFile(dbf, 'dbf'), /read-only/);
        const { importSpreadsheet, readSpreadsheet, exportSpreadsheetValues } = require('./out/parsers/spreadsheetParser.js');
        const snapshot = await importSpreadsheet(dbfBytes, 'dbf', 'DBF copy');
        assert.deepEqual(readSpreadsheet(JSON.stringify(snapshot)), snapshot);
        assert.match(Buffer.from(exportSpreadsheetValues(snapshot, 'csv', snapshot.sheetOrder[0])).toString(), /Ana,42/);
        const { buildPivot } = require('./out/pivot.js');
        assert.deepEqual(buildPivot(snapshot, { sourceSheetId: snapshot.sheetOrder[0], range: { startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 }, rowField: 0, columnField: null, valueField: 1, aggregation: 'SUM' }), [['Name', 'SUM Amount'], ['Ana', 42], ['Grand total', 42]]);
        const { clipboardCells } = require('./out/clipboard.js');
        assert.equal(clipboardCells('0012\t7')[0][0].v, '0012');
        console.log('Packaged activation, six format round trips, DBF protection, pivots and clipboard passed with SheetJS 0.20.3');
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `;
    const env = { ...process.env };
    delete env.NODE_PATH;
    delete env.NODE_OPTIONS;
    const output = execFileSync(process.execPath, ['-e', script], { cwd: root, env, encoding: 'utf8' });
    console.log(output.trim());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
