import { createUniver, LocaleType, mergeLocales, CommandType } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import enUS from '@univerjs/preset-sheets-core/locales/en-US';
import { createElement, Save, Download, TableProperties, RefreshCw, Copy, ClipboardPaste, Plug } from 'lucide';
import { buildPivot, pivotHeaders, usedRange } from '../src/pivot';
import { encodeClipboard, clipboardCells } from '../src/clipboard';
import '@univerjs/preset-sheets-core/lib/index.css';
import './spreadsheet.css';
import { setupCharts } from './charts';

const vscode = acquireVsCodeApi();
document.getElementById('connect-agent').appendChild(createElement(Plug, { width: 16, height: 16 }));
document.getElementById('connect-agent').addEventListener('click', () => vscode.postMessage({ type: 'connectAgent' }));
const status = document.getElementById('status');
let instance;
let workbook;
let version = 0;
let inFlight = false;
let pending = false;
let timer;
let lastSnapshot = '';
let saveRequested = false;
let clipboardRequestId = 0;
const clipboardRequests = new Map();
const pivotDialog = document.getElementById('pivot-dialog');
const pivotSource = document.getElementById('pivot-source');
const pivotRange = document.getElementById('pivot-range');
const pivotError = document.getElementById('pivot-error');
const renderCharts = setupCharts(() => workbook, queueEdit, text => { status.textContent = text; }, (dataUrl, title) => vscode.postMessage({ type: 'exportChart', dataUrl, title }));

function updatePivotControls() {
  document.getElementById('refresh-pivot').disabled = !workbook?.getActiveSheet()?.getSheet().getCustomMetadata()?.tableViewerPivot;
}

function sourceRange() {
  const source = workbook.getSheetBySheetId(pivotSource.value);
  if (!source) throw new Error('The source worksheet no longer exists.');
  return source.getRange(pivotRange.value).getRange();
}

function updatePivotFields() {
  try {
    const headers = pivotHeaders(workbook.save(), { sourceSheetId: pivotSource.value, range: sourceRange() });
    for (const id of ['pivot-rows', 'pivot-columns', 'pivot-values']) {
      const select = document.getElementById(id);
      const previous = select.value;
      select.replaceChildren();
      if (id === 'pivot-columns') select.add(new Option('None', ''));
      headers.forEach((header, index) => select.add(new Option(`${header} (${index + 1})`, String(index))));
      if ([...select.options].some(option => option.value === previous)) select.value = previous;
      else select.value = id === 'pivot-values' ? String(headers.length - 1) : id === 'pivot-columns' ? '' : '0';
    }
    pivotError.textContent = '';
    document.getElementById('pivot-create').disabled = false;
  } catch (error) {
    pivotError.textContent = error.message;
    document.getElementById('pivot-create').disabled = true;
  }
}

function pivotCells(values) {
  const cellData = {};
  values.forEach((row, rowIndex) => {
    cellData[rowIndex] = {};
    row.forEach((value, columnIndex) => {
      cellData[rowIndex][columnIndex] = { v: value, t: typeof value === 'number' ? 2 : 4 };
    });
  });
  return cellData;
}

async function calculate() {
  const formula = instance.univerAPI.getFormula();
  formula.executeCalculation();
  await formula.onCalculationResultApplied(10000);
}

function selectPivotSource() {
  const snapshot = workbook.save();
  pivotRange.value = workbook.getSheetBySheetId(pivotSource.value).getRange(usedRange(snapshot.sheets[pivotSource.value])).getA1Notation();
  updatePivotFields();
}

function flush() {
  clearTimeout(timer);
  if (!workbook || inFlight) return;
  const data = workbook.save();
  const serialized = JSON.stringify(data);
  if (serialized === lastSnapshot) { pending = false; return; }
  lastSnapshot = serialized;
  pending = false;
  inFlight = true;
  vscode.postMessage({ type: 'edit', data, version });
}

function queueEdit() {
  pending = true;
  clearTimeout(timer);
  timer = setTimeout(flush, 150);
}

function requestClipboard(type, text) {
  return new Promise((resolve, reject) => {
    const requestId = ++clipboardRequestId;
    const timeout = setTimeout(() => {
      clipboardRequests.delete(requestId);
      reject(new Error('Clipboard request timed out.'));
    }, 5000);
    clipboardRequests.set(requestId, { resolve, reject, timeout });
    vscode.postMessage({ type, requestId, text });
  });
}

window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'clipboardResult') {
    const request = clipboardRequests.get(message.requestId);
    if (!request) return;
    clearTimeout(request.timeout);
    clipboardRequests.delete(message.requestId);
    if (message.error) request.reject(new Error(message.error));
    else request.resolve(message.text);
  } else if (message.type === 'ack') {
    version = message.version;
    inFlight = false;
    if (pending) flush();
    if (!inFlight && saveRequested) {
      saveRequested = false;
      vscode.postMessage({ type: 'save' });
    }
  } else if (message.type === 'error') {
    status.textContent = message.message;
  } else if (message.type === 'load') {
    clearTimeout(timer);
    instance?.univer.dispose();
    inFlight = false;
    pending = false;
    saveRequested = false;
    version = message.version;
    try {
      instance = createUniver({
        locale: LocaleType.EN_US, locales: { [LocaleType.EN_US]: mergeLocales(enUS) },
        darkMode: document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast'),
        presets: [UniverSheetsCorePreset({ container: 'spreadsheet' })]
      });
      workbook = instance.univerAPI.createWorkbook(message.data);
      lastSnapshot = JSON.stringify(workbook.save());
      workbook.onCommandExecuted(command => {
        if (command.type === CommandType.MUTATION) queueEdit();
        updatePivotControls();
        renderCharts();
      });
      updatePivotControls();
      renderCharts();
      document.getElementById('document-name').textContent = message.data.name;
      status.textContent = 'Experimental';
      vscode.postMessage({ type: 'loaded' });
    } catch (error) {
      status.textContent = error.message;
      vscode.postMessage({ type: 'error', message: error.message });
    }
  }
});

document.getElementById('save').appendChild(createElement(Save, { width: 16, height: 16 }));
document.getElementById('export').appendChild(createElement(Download, { width: 16, height: 16 }));
document.getElementById('pivot').appendChild(createElement(TableProperties, { width: 16, height: 16 }));
document.getElementById('refresh-pivot').appendChild(createElement(RefreshCw, { width: 16, height: 16 }));
document.getElementById('copy-values').appendChild(createElement(Copy, { width: 16, height: 16 }));
document.getElementById('paste-values').appendChild(createElement(ClipboardPaste, { width: 16, height: 16 }));
document.getElementById('copy-values').addEventListener('click', async () => {
  if (!workbook) return;
  const activeWorkbook = workbook;
  const range = workbook.getActiveSheet().getActiveRange();
  if (!range) { status.textContent = 'Select a cell range.'; return; }
  try {
    await calculate();
    if (workbook !== activeWorkbook) throw new Error('The working document changed.');
    const coordinates = range.getRange();
    if ((coordinates.endRow - coordinates.startRow + 1) * (coordinates.endColumn - coordinates.startColumn + 1) > 100000) {
      throw new Error('Copy supports up to 100,000 cells.');
    }
    await requestClipboard('clipboardWrite', encodeClipboard(range.getValues()));
    status.textContent = 'Values copied';
  } catch (error) { status.textContent = `Copy failed: ${error.message}`; }
});
document.getElementById('paste-values').addEventListener('click', async () => {
  if (!workbook) return;
  const activeWorkbook = workbook;
  const target = workbook.getActiveSheet();
  const selection = target.getActiveRange();
  if (!selection) return;
  try {
    const values = clipboardCells(await requestClipboard('clipboardRead'));
    if (workbook !== activeWorkbook) throw new Error('The working document changed.');
    const coordinates = selection.getRange();
    const height = coordinates.startRow + values.length;
    const width = coordinates.startColumn + values[0].length;
    if (height > 1048576 || width > 16384) throw new Error('Paste exceeds worksheet limits.');
    const existing = workbook.save().sheets[target.getSheetId()];
    if (height > existing.rowCount) target.setRowCount(height);
    if (width > existing.columnCount) target.setColumnCount(width);
    target.getRange(coordinates.startRow, coordinates.startColumn, values.length, values[0].length).setValues(values);
    queueEdit();
    status.textContent = 'Values pasted';
  } catch (error) { status.textContent = `Paste failed: ${error.message}`; }
});
document.getElementById('pivot').addEventListener('click', () => {
  if (!workbook) return;
  const snapshot = workbook.save();
  const activeSheet = workbook.getActiveSheet();
  const activeId = activeSheet.getSheet().getCustomMetadata()?.tableViewerPivot?.definition.sourceSheetId ?? activeSheet.getSheetId();
  pivotSource.replaceChildren();
  snapshot.sheetOrder.filter(id => !snapshot.sheets[id].custom?.tableViewerPivot).forEach(id => {
    pivotSource.add(new Option(snapshot.sheets[id].name, id));
  });
  pivotSource.value = activeId;
  if (!pivotSource.value) pivotSource.selectedIndex = 0;
  if (!pivotSource.value) { status.textContent = 'No source worksheet available.'; return; }
  selectPivotSource();
  const selection = activeSheet.getActiveRange();
  if (activeId === activeSheet.getSheetId() && selection && selection.getRange().endRow > selection.getRange().startRow) {
    pivotRange.value = selection.getA1Notation();
    updatePivotFields();
  }
  pivotDialog.showModal();
});
pivotSource.addEventListener('change', selectPivotSource);
pivotRange.addEventListener('input', updatePivotFields);
document.getElementById('pivot-cancel').addEventListener('click', () => pivotDialog.close());
document.getElementById('pivot-form').addEventListener('submit', async event => {
  event.preventDefault();
  const activeWorkbook = workbook;
  const button = document.getElementById('pivot-create');
  button.disabled = true;
  try {
    const definition = {
      sourceSheetId: pivotSource.value, range: sourceRange(),
      rowField: Number(document.getElementById('pivot-rows').value),
      columnField: document.getElementById('pivot-columns').value === '' ? null : Number(document.getElementById('pivot-columns').value),
      valueField: Number(document.getElementById('pivot-values').value),
      aggregation: document.getElementById('pivot-aggregation').value
    };
    await calculate();
    if (workbook !== activeWorkbook) throw new Error('The working document changed. Reopen the pivot dialog.');
    const values = buildPivot(workbook.save(), definition);
    const names = new Set(Object.values(workbook.save().sheets).map(sheet => sheet.name));
    let index = 1;
    while (names.has(`Pivot ${index}`)) index++;
    pivotDialog.close();
    const target = workbook.create(`Pivot ${index}`, Math.max(100, values.length + 20), Math.max(26, values[0].length + 10), {
      sheet: { cellData: pivotCells(values), custom: { tableViewerPivot: { definition, height: values.length, width: values[0].length } } }
    });
    target.activate();
    queueEdit();
    updatePivotControls();
    status.textContent = 'Experimental';
  } catch (error) {
    pivotError.textContent = error.message;
  } finally { button.disabled = false; }
});
document.getElementById('refresh-pivot').addEventListener('click', async () => {
  if (!workbook) return;
  const activeWorkbook = workbook;
  const target = workbook.getActiveSheet();
  const metadata = target.getSheet().getCustomMetadata();
  const pivot = metadata?.tableViewerPivot;
  if (!pivot) return;
  const button = document.getElementById('refresh-pivot');
  button.disabled = true;
  try {
    await calculate();
    if (workbook !== activeWorkbook) throw new Error('The working document changed.');
    const values = buildPivot(workbook.save(), pivot.definition);
    const height = Math.max(pivot.height, values.length);
    const width = Math.max(pivot.width, values[0].length);
    const existing = workbook.save().sheets[target.getSheetId()];
    if (height > existing.rowCount) target.setRowCount(height + 20);
    if (width > existing.columnCount) target.setColumnCount(width + 10);
    target.getRange(0, 0, height, width).setValues(Array.from({ length: height }, (_, row) =>
      Array.from({ length: width }, (_, column) => ({ v: values[row]?.[column] ?? null, t: typeof values[row]?.[column] === 'number' ? 2 : 4 }))));
    target.setCustomMetadata({ ...metadata, tableViewerPivot: { ...pivot, height: values.length, width: values[0].length } });
    queueEdit();
    status.textContent = 'Experimental';
  } catch (error) { status.textContent = `Pivot refresh failed: ${error.message}`; }
  finally { updatePivotControls(); }
});
document.getElementById('save').addEventListener('click', () => {
  saveRequested = true;
  flush();
  if (!inFlight) {
    saveRequested = false;
    vscode.postMessage({ type: 'save' });
  }
});
document.getElementById('export').addEventListener('click', async () => {
  if (!workbook) return;
  const activeWorkbook = workbook;
  const button = document.getElementById('export');
  button.disabled = true;
  status.textContent = 'Calculating...';
  try {
    await calculate();
    if (workbook !== activeWorkbook) return;
    flush();
    vscode.postMessage({ type: 'export', data: workbook.save(), sheetId: workbook.getActiveSheet().getSheetId() });
    status.textContent = 'Experimental';
  } catch (error) {
    status.textContent = `Export failed: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
window.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    document.getElementById('save').click();
  }
}, true);
window.addEventListener('pagehide', () => { clearTimeout(timer); instance?.univer.dispose(); });
vscode.postMessage({ type: 'ready' });