const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { prepareSpreadsheet } = require('../out/parsers/spreadsheetParser');
const { chartOptions } = require('../out/chartOptions');
const { joinTables, tableRows } = require('../out/tableJoin');
const { financialAnalysis } = require('../out/finance');

test('fictional reconciliation examples reproduce the documented expected results', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { importSpreadsheet } = require('../out/parsers/spreadsheetParser');
  const load = async name => importSpreadsheet(fs.readFileSync(path.join(__dirname, '../examples', name)), 'csv', name);
  const invoices = await load('conciliacion-facturas.csv');
  const receipts = await load('conciliacion-cobros.csv');
  const expected = await load('conciliacion-esperada.csv');
  const range = { startRow: 0, startColumn: 0, endRow: 12, endColumn: 7 };
  const analysis = financialAnalysis(tableRows(invoices, 'sheet-1', range), tableRows(receipts, 'sheet-1', range), 0, 0, 5, 5,
    { mode: 'reconcile', decimals: 2, tolerance: '0.01', favorable: 'lower' });
  const reference = tableRows(expected, 'sheet-1', { ...range, endRow: 13, endColumn: 6 });
  assert.deepEqual(analysis.values.slice(1), reference.rows.map(row => row.map((value, index) => [1, 2, 3, 5, 6].includes(index) ? Number(value) : value)));
  assert.deepEqual(analysis.statuses, { MATCHED: 5, DIFFERENCE: 2, DUPLICATE_REVIEW: 2, ONLY_LEFT: 2, ONLY_RIGHT: 2 });
});

test('budget and reconciliation use decimal rounding and expose unmatched and duplicate keys', () => {
  const table = rows => ({ headers: ['Key', 'Amount'], rows });
  const options = { mode: 'budget', decimals: 2, tolerance: '0.00', favorable: 'lower' };
  const actual = table([['A', '0.1'], ['A', '0.2'], ['B', '10.005'], ['C', 5], ['OnlyActual', 7]]);
  const budget = table([['A', '0.3'], ['B', '10.00'], ['C', 0], ['OnlyBudget', 8]]);
  const compared = financialAnalysis(actual, budget, 0, 0, 1, 1, options);
  assert.deepEqual(compared.values[1], ['A', 0.3, 0.3, 0, 0, 'ON_BUDGET', 2, 1]);
  assert.equal(compared.values[2][3], 0.01);
  assert.equal(compared.values[2][5], 'UNFAVORABLE');
  assert.equal(compared.values[3][4], null);
  assert.equal(compared.statuses.ONLY_ACTUAL, 1);
  assert.equal(compared.statuses.ONLY_BUDGET, 1);
  const income = financialAnalysis(table([['A', 120]]), table([['A', 100]]), 0, 0, 1, 1, { ...options, favorable: 'higher' });
  assert.equal(income.values[1][4], 0.2);
  assert.equal(income.values[1][5], 'FAVORABLE');
  const reconciled = financialAnalysis(actual, budget, 0, 0, 1, 1, { ...options, mode: 'reconcile', tolerance: '0.01' });
  assert.equal(reconciled.values[1][4], 'DUPLICATE_REVIEW');
  assert.equal(reconciled.values[2][4], 'MATCHED');
  assert.equal(reconciled.values[3][4], 'DIFFERENCE');
  assert.equal(reconciled.statuses.ONLY_LEFT, 1);
  assert.equal(reconciled.statuses.ONLY_RIGHT, 1);
  const typed = financialAnalysis(table([[1, 10]]), table([['1', 10]]), 0, 0, 1, 1, options);
  assert.equal(typed.values.length, 3);
  for (const value of [null, '', '$10', '1,000', true, Infinity]) {
    assert.throws(() => financialAnalysis(table([['A', value]]), budget, 0, 0, 1, 1, options), /Amounts/);
  }
  assert.throws(() => financialAnalysis(table([[null, 1]]), budget, 0, 0, 1, 1, options), /nonblank/);
  assert.throws(() => financialAnalysis(actual, budget, 0, 0, 1, 1, { ...options, tolerance: '-1' }), /negative/);
  assert.throws(() => financialAnalysis(actual, budget, 0, 0, 8, 1, options), /field/);
});

test('table joins preserve duplicates, distinguish key types and never match blank keys', async () => {
  const left = { headers: ['Key', 'Amount'], rows: [['001', 10], [1, 20], [null, 30], ['missing', 40]] };
  const right = { headers: ['Key', 'Client'], rows: [['001', 'A'], ['001', 'B'], ['1', 'C'], [null, 'Blank']] };
  const joined = joinTables(left, right, 0, 0, 'LEFT');
  assert.equal(joined.outputRows, 5);
  assert.equal(joined.matchedLeftRows, 1);
  assert.equal(joined.unmatchedLeftRows, 3);
  assert.deepEqual(joined.values[1], ['001', 10, '001', 'A']);
  assert.deepEqual(joined.values[3], [1, 20, null, null]);
  assert.equal(joinTables(left, right, 0, 0, 'INNER').outputRows, 2);
  assert.throws(() => joinTables(left, right, 5, 0, 'LEFT'), /key/);
  const large = { headers: ['Key'], rows: Array.from({ length: 300 }, () => ['same']) };
  assert.throws(() => joinTables(large, large, 0, 0, 'INNER'), /100,000/);
  const data = await prepareSpreadsheet('[["Key","Amount"],["A",10]]', 'Source');
  data.sheets['sheet-1'].cellData[1][1].f = '=5+5';
  assert.throws(() => tableRows(data, 'sheet-1', { startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 }), /plain values/);
});

test('chart options support horizontal, stacked, combined and numeric formatting', () => {
  assert.equal(chartOptions({ type: 'horizontal' }, 1).options.indexAxis, 'y');
  assert.equal(chartOptions({ type: 'stacked' }, 2).options.scales.y.stacked, true);
  assert.equal(chartOptions({ type: 'combo' }, 2).options.scales.y1.position, 'right');
  assert.throws(() => chartOptions({ type: 'combo' }, 1), /two numeric/);
  const percent = chartOptions({ type: 'bar', format: 'percent' }, 1);
  assert.equal(percent.options.scales.y.ticks.callback(0.25), '25%');
  const money = chartOptions({ type: 'horizontal', format: 'currency', currency: 'USD' }, 1);
  assert.equal(money.options.scales.x.ticks.callback(1250), '$1,250.00');
});

test('MCP requires authorization and confirms versioned unsaved edits over HTTP', async () => {
  const data = await prepareSpreadsheet('[["Name"],[" Ana "]]', 'Test');
  let definition;
  let command;
  let startCommand;
  let consent = 'Apply preview';
  let sourceText = 'Name\nAna';
  const uri = { path: '/test.sheet.json', toString: () => 'file:///test.sheet.json' };
  const copyUri = { path: '/copy.sheet.json', toString: () => 'file:///copy.sheet.json' };
  const source = { path: '/source.csv', toString: () => 'file:///source.csv', with: () => copyUri };
  const document = { uri, version: 1, isClosed: false, text: JSON.stringify(data), getText() { return this.text; }, lineCount: 1 };
  const copyDocument = { ...document, uri: copyUri, text: '' };
  const subscriptions = [];
  let sharingText = '';
  let sharingMode = 'Share folder';
  const folder = { path: '/shared' };
  const nested = { path: '/shared/sub' };
  const api = {
    workspace: {
      isTrusted: true,
      fs: { readFile: async () => Buffer.from(sourceText), readDirectory: async directory => directory === folder
        ? [['test.sheet.json', 1], ['sub', 2], ['secret.txt', 65], ['notes.md', 1], ['.hidden.csv', 1], ['node_modules', 2]]
        : [['source.csv', 1]] },
      openTextDocument: async targetUri => targetUri === copyUri ? copyDocument : document,
      applyEdit: async edit => {
        const targetDocument = edit.uri === copyUri ? copyDocument : document;
        targetDocument.text = edit.text;
        targetDocument.version++;
        return true;
      }
    },
    window: {
      createOutputChannel: () => ({ clear() { sharingText = ''; }, appendLine(text) { sharingText += text; }, show() {}, dispose() {} }),
      showQuickPick: async (items, options) => {
        if (!options.canPickMany) return sharingMode;
        assert.deepEqual(items.map(item => item.uri), [uri, source]);
        return items;
      },
      showOpenDialog: async options => options.canSelectFolders ? [folder] : [uri, source],
      showSaveDialog: async () => copyUri,
      showInformationMessage: async () => {},
      showWarningMessage: async (message, options) => {
        if (options.detail) { assert.ok(options.detail.length < 700); assert.ok(!options.detail.includes('"charts"')); }
        return consent;
      }
    },
    commands: { executeCommand: async () => {}, registerCommand: (id, callback) => { if (id === 'csvXlsTableViewer.startMcp') startCommand = callback; else command = callback; return { dispose() {} }; } },
    Uri: { parse: value => new URL(value), joinPath: (base, name) => name === 'sub' ? nested : name === 'test.sheet.json' ? uri : source },
    FileType: { File: 1, Directory: 2, SymbolicLink: 64 },
    lm: { registerMcpServerDefinitionProvider: (id, provider) => { definition = provider.provideMcpServerDefinitions()[0]; return { dispose() {} }; } },
    McpHttpServerDefinition: class { constructor(label, url, headers) { this.uri = url; this.headers = headers; } },
    WorkspaceEdit: class {
      createFile(uri, options) { assert.equal(options.overwrite, false); this.uri = uri; }
      insert(uri, position, text) { this.uri = uri; this.text = text; }
      replace(uri, range, text) { this.uri = uri; this.text = text; }
    },
    Position: class {},
    Range: class {}
  };
  const originalLoad = Module._load;
  const target = require.resolve('../out/mcp');
  Module._load = function(id, ...args) { return id === 'vscode' ? api : originalLoad.call(this, id, ...args); };
  try { require(target).registerSheetMcp({ subscriptions }); }
  finally { Module._load = originalLoad; delete require.cache[target]; }
  const client = new Client({ name: 'test', version: '1.0.0' });
  try {
    await startCommand();
    assert.ok(definition);
    await client.connect(new StreamableHTTPClientTransport(definition.uri, { requestInit: { headers: definition.headers } }));
    assert.deepEqual(JSON.parse((await client.callTool({ name: 'list_documents', arguments: {} })).content[0].text), []);
    await command();
    assert.ok(sharingText.includes('/test.sheet.json'));
    assert.ok(sharingText.includes('/source.csv'));
    sharingMode = 'Show shared files';
    await command();
    assert.equal((await fetch(definition.uri, { method: 'POST' })).status, 403);
    assert.equal((await fetch(definition.uri, { method: 'POST', headers: { ...definition.headers, Origin: 'https://example.com' } })).status, 403);
    const call = (name, args) => client.callTool({ name, arguments: args });
    const parse = value => JSON.parse(value.content[0].text);
    const listed = parse(await call('list_documents', {}));
    const documentId = listed[0].documentId;
    assert.equal(listed.length, 2);
    assert.equal(listed[0].path, '/test.sheet.json');
    consent = undefined;
    assert.equal(await command(uri), true);
    const extraFile = { path: '/extra.dbf', toString: () => 'file:///extra.dbf' };
    assert.equal(await command(extraFile), false);
    assert.equal(parse(await call('list_documents', {})).length, 2);
    consent = 'Share file';
    assert.equal(await command(extraFile), true);
    assert.ok(parse(await call('list_documents', {})).some(item => item.path === '/extra.dbf' && !item.writable));
    consent = 'Apply preview';
    const sourceId = listed.find(item => !item.writable).documentId;
    assert.equal((await call('preview_create_sheet', { documentId: sourceId, name: 'Analisis' })).isError, true);
    consent = undefined;
    assert.equal(parse(await call('create_working_copy', { documentId: sourceId })).created, false);
    assert.equal(copyDocument.text, '');
    consent = 'Create working copy';
    const copy = parse(await call('create_working_copy', { documentId: sourceId }));
    assert.equal(copy.created, true);
    assert.equal(JSON.parse(copyDocument.text).sheets['sheet-1'].cellData[1][0].v, 'Ana');
    assert.ok(parse(await call('list_documents', {})).some(item => item.documentId === copy.documentId && item.writable));
    consent = 'Apply preview';
    const copySheet = parse(await call('preview_create_sheet', { documentId: copy.documentId, name: 'Analisis' }));
    assert.equal(parse(await call('apply_preview', { previewId: copySheet.previewId })).applied, true);
    assert.ok((await client.listTools()).tools.some(tool => tool.name === 'create_working_copy'));
    const initialText = document.text;
    const newSheet = parse(await call('preview_create_sheet', { documentId, name: 'Analisis' }));
    assert.equal(document.text, initialText);
    const createdSheet = parse(await call('apply_preview', { previewId: newSheet.previewId }));
    assert.equal(createdSheet.applied, true);
    assert.equal(createdSheet.sheetId, newSheet.sheetId);
    assert.equal(JSON.parse(document.text).sheets[newSheet.sheetId].name, 'Analisis');
    assert.deepEqual(JSON.parse(document.text).sheets['sheet-1'], data.sheets['sheet-1']);
    assert.equal((await call('preview_create_sheet', { documentId, name: 'analisis' })).isError, true);
    const cancelledSheet = parse(await call('preview_create_sheet', { documentId, name: 'Cancelada' }));
    consent = undefined;
    assert.equal(parse(await call('apply_preview', { previewId: cancelledSheet.previewId })).applied, false);
    assert.equal(JSON.parse(document.text).sheets[cancelledSheet.sheetId], undefined);
    consent = 'Apply preview';
    const args = { documentId, sheetId: 'sheet-1', row: 1, column: 0, rows: 1, columns: 1 };
    assert.equal((await call('read_range', { ...args, documentId: 'unknown' })).isError, true);
    assert.deepEqual(parse(await call('read_range', args)).values, [[' Ana ']]);
    const preview = parse(await call('preview_transform', { ...args, operation: 'trim' }));
    assert.deepEqual(preview.values, [['Ana']]);
    assert.equal(document.version, 2);
    assert.equal(parse(await call('apply_preview', { previewId: preview.previewId })).applied, true);
    assert.equal(JSON.parse(document.text).sheets['sheet-1'].cellData[1][0].v, 'Ana');
    const stale = parse(await call('preview_write_range', { ...args, values: [['=1+1']] }));
    document.version++;
    assert.equal((await call('apply_preview', { previewId: stale.previewId })).isError, true);
    const cancelled = parse(await call('preview_write_range', { ...args, values: [['Cancelled']] }));
    consent = undefined;
    assert.equal(parse(await call('apply_preview', { previewId: cancelled.previewId })).applied, false);
    assert.equal(JSON.parse(document.text).sheets['sheet-1'].cellData[1][0].v, 'Ana');
    consent = 'Apply preview';
    const chartCells = parse(await call('preview_write_range', { documentId, sheetId: newSheet.sheetId, row: 0, column: 0,
      values: [['Month', 'Sales'], ['Jan', 10], ['Feb', 20]] }));
    await call('apply_preview', { previewId: chartCells.previewId });
    const cellsBefore = JSON.stringify(JSON.parse(document.text).sheets[newSheet.sheetId].cellData);
    const chartArgs = { documentId, sheetId: newSheet.sheetId, action: 'create', range: 'A1:B3', title: 'Sales', type: 'bar', width: 600, height: 350, legend: false };
    assert.equal((await call('preview_chart', { ...chartArgs, range: 'B3:A1' })).isError, true);
    assert.equal((await call('preview_chart', { ...chartArgs, range: 'A1:XFD1048576' })).isError, true);
    const chartPreview = parse(await call('preview_chart', chartArgs));
    assert.deepEqual(parse(await call('list_charts', chartArgs)).charts, []);
    await call('apply_preview', { previewId: chartPreview.previewId });
    const chart = parse(await call('list_charts', chartArgs)).charts[0];
    assert.equal(chart.id, chartPreview.chartId);
    assert.equal(chart.width, 600);
    assert.equal(chart.legend, false);
    for (const type of ['horizontal', 'stacked']) {
      const stylePreview = parse(await call('preview_chart', { ...chartArgs, action: 'update', chartId: chart.id, type, format: 'currency', currency: 'CLP' }));
      await call('apply_preview', { previewId: stylePreview.previewId });
      const styled = parse(await call('list_charts', chartArgs)).charts[0];
      assert.equal(styled.type, type);
      assert.equal(styled.currency, 'CLP');
    }
    assert.equal((await call('preview_chart', { ...chartArgs, type: 'combo' })).isError, true);
    const update = parse(await call('preview_chart', { ...chartArgs, action: 'update', chartId: chart.id, type: 'line' }));
    await call('apply_preview', { previewId: update.previewId });
    assert.equal(parse(await call('list_charts', chartArgs)).charts[0].type, 'line');
    const removal = parse(await call('preview_chart', { ...chartArgs, action: 'delete', chartId: chart.id }));
    consent = undefined;
    await call('apply_preview', { previewId: removal.previewId });
    assert.equal(parse(await call('list_charts', chartArgs)).charts.length, 1);
    const confirmedRemoval = parse(await call('preview_chart', { ...chartArgs, action: 'delete', chartId: chart.id }));
    consent = 'Apply preview';
    await call('apply_preview', { previewId: confirmedRemoval.previewId });
    assert.deepEqual(parse(await call('list_charts', chartArgs)).charts, []);
    assert.equal(JSON.stringify(JSON.parse(document.text).sheets[newSheet.sheetId].cellData), cellsBefore);
    const analysisRange = { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 };
    const pivotArgs = { documentId, sheetId: newSheet.sheetId, range: analysisRange, name: 'Pivot MCP', rowField: 0, valueField: 1, aggregation: 'SUM' };
    const pivotPreview = parse(await call('preview_pivot', pivotArgs));
    assert.deepEqual(pivotPreview.firstRows, [['Month', 'SUM Sales'], ['Jan', 10], ['Feb', 20], ['Grand total', 30]]);
    assert.equal(JSON.parse(document.text).sheets[pivotPreview.sheetId], undefined);
    await call('apply_preview', { previewId: pivotPreview.previewId });
    assert.equal(JSON.parse(document.text).sheets[pivotPreview.sheetId].custom.tableViewerPivot.definition.sourceSheetId, newSheet.sheetId);
    assert.equal(JSON.stringify(JSON.parse(document.text).sheets[newSheet.sheetId].cellData), cellsBefore);
    const changedValues = parse(await call('preview_write_range', { documentId, sheetId: newSheet.sheetId, row: 1, column: 1, values: [[15]] }));
    await call('apply_preview', { previewId: changedValues.previewId });
    const refreshed = parse(await call('preview_refresh_pivot', { documentId, sheetId: pivotPreview.sheetId }));
    assert.deepEqual(refreshed.firstRows.at(-1), ['Grand total', 35]);
    await call('apply_preview', { previewId: refreshed.previewId });
    const joinArgs = { left: { documentId, sheetId: 'sheet-1', range: { startRow: 0, startColumn: 0, endRow: 1, endColumn: 0 }, key: 0 },
      right: { documentId: sourceId, sheetId: 'sheet-1', range: { startRow: 0, startColumn: 0, endRow: 1, endColumn: 0 }, key: 0 },
      targetDocumentId: documentId, name: 'Linked', mode: 'LEFT' };
    const joined = parse(await call('preview_join', joinArgs));
    assert.equal(joined.matchedLeftRows, 1);
    sourceText = 'Name\nOther';
    assert.equal((await call('apply_preview', { previewId: joined.previewId })).isError, true);
    assert.equal(JSON.parse(document.text).sheets[joined.sheetId], undefined);
    sourceText = 'Name\nAna';
    const cancelledJoin = parse(await call('preview_join', joinArgs));
    consent = undefined;
    assert.equal(parse(await call('apply_preview', { previewId: cancelledJoin.previewId })).applied, false);
    consent = 'Apply preview';
    const finalJoin = parse(await call('preview_join', joinArgs));
    await call('apply_preview', { previewId: finalJoin.previewId });
    assert.equal(JSON.parse(document.text).sheets[finalJoin.sheetId].cellData[1][1].v, 'Ana');
    const financeArgs = { left: { documentId, sheetId: newSheet.sheetId, range: analysisRange, key: 0, amount: 1 },
      right: { documentId, sheetId: pivotPreview.sheetId, range: analysisRange, key: 0, amount: 1 },
      targetDocumentId: documentId, name: 'Budget comparison', favorable: 'lower' };
    const financeSourceBefore = JSON.stringify(JSON.parse(document.text).sheets[newSheet.sheetId]);
    const budgetPreview = parse(await call('preview_budget', financeArgs));
    assert.equal(budgetPreview.statuses.ON_BUDGET, 2);
    assert.equal(budgetPreview.rounding, 'HALF_UP');
    assert.equal(JSON.parse(document.text).sheets[budgetPreview.sheetId], undefined);
    await call('apply_preview', { previewId: budgetPreview.previewId });
    assert.equal(JSON.parse(document.text).sheets[budgetPreview.sheetId].cellData[1][5].v, 'ON_BUDGET');
    const reconciliation = parse(await call('preview_reconciliation', { ...financeArgs, name: 'Reconciliation' }));
    assert.equal(reconciliation.statuses.MATCHED, 2);
    consent = undefined;
    assert.equal(parse(await call('apply_preview', { previewId: reconciliation.previewId })).applied, false);
    assert.equal(JSON.parse(document.text).sheets[reconciliation.sheetId], undefined);
    consent = 'Apply preview';
    const reconciled = parse(await call('preview_reconciliation', { ...financeArgs, name: 'Reconciliation' }));
    await call('apply_preview', { previewId: reconciled.previewId });
    assert.equal(JSON.parse(document.text).sheets[reconciled.sheetId].cellData[1][4].v, 'MATCHED');
    assert.equal(JSON.stringify(JSON.parse(document.text).sheets[newSheet.sheetId]), financeSourceBefore);
    const staleBudget = parse(await call('preview_budget', { ...financeArgs, name: 'Stale budget' }));
    document.version++;
    assert.equal((await call('apply_preview', { previewId: staleBudget.previewId })).isError, true);
    api.workspace.isTrusted = false;
    assert.equal((await fetch(definition.uri, { method: 'POST', headers: definition.headers })).status, 403);
  } finally {
    await client.close();
    subscriptions.reverse().forEach(item => item.dispose());
  }
});