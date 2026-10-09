import * as vscode from 'vscode';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { importSpreadsheet, readSpreadsheet, exportSpreadsheetValues } from './parsers/spreadsheetParser';

export class SpreadsheetEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = 'csvXlsTableViewer.spreadsheetEditor';

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(this.viewType, new SpreadsheetEditorProvider(context), {
      supportsMultipleEditorsPerDocument: false, webviewOptions: { retainContextWhenHidden: true }
    });
  }

  static async importFile(uri?: vscode.Uri): Promise<void> {
    const source = uri ?? (await vscode.window.showOpenDialog({
      canSelectMany: false, filters: { 'Tabular files': ['csv', 'tsv', 'txt', 'dbf', 'xlsx', 'xls', 'ods'] }
    }))?.[0];
    if (!source) return;
    try {
      const ext = path.extname(source.path).slice(1).toLowerCase();
      const bytes = await vscode.workspace.fs.readFile(source);
      const data = await importSpreadsheet(Buffer.from(bytes), ext, path.basename(source.path));
      const accepted = await vscode.window.showWarningMessage(
        'Experimental import copies values, formulas, number formats and merges, not full Excel formatting. The original stays unchanged. DBF memo fields are unsupported. Text imports currently require UTF-8.',
        { modal: true }, 'Create working copy'
      );
      if (!accepted) return;
      const destination = await vscode.window.showSaveDialog({
        defaultUri: source.with({ path: `${source.path}.sheet.json` }),
        filters: { 'Spreadsheet working document': ['sheet.json'] }
      });
      if (!destination) return;
      if (destination.toString() === source.toString()) throw new Error('Choose a different file. The import cannot overwrite its source.');
      if (!destination.path.endsWith('.sheet.json')) throw new Error('Use the .sheet.json extension for the working document.');
      await vscode.workspace.fs.writeFile(destination, Buffer.from(JSON.stringify(data, null, 2)));
      await vscode.commands.executeCommand('vscode.openWith', destination, this.viewType);
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    panel.webview.options = {
      enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
    };
    let applyingEdit = false;
    let writes = Promise.resolve();
    const load = () => {
      try {
        panel.webview.postMessage({ type: 'load', data: readSpreadsheet(document.getText()), version: document.version });
      } catch (error) {
        panel.webview.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
      }
    };
    const changeListener = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.uri.toString() === document.uri.toString() && !applyingEdit) load();
    });
    const messageListener = panel.webview.onDidReceiveMessage(async message => {
      try {
        switch (message.type) {
          case 'ready': load(); break;
          case 'edit': {
            const write = writes.then(async () => {
              if (message.version !== document.version) { load(); return; }
              readSpreadsheet(JSON.stringify(message.data));
              const edit = new vscode.WorkspaceEdit();
              edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), JSON.stringify(message.data, null, 2));
              applyingEdit = true;
              try {
                const applied = await vscode.workspace.applyEdit(edit);
                if (!applied) { load(); return; }
                panel.webview.postMessage({ type: 'ack', version: document.version });
              } finally { applyingEdit = false; }
            });
            writes = write.catch(() => {});
            await write;
            break;
          }
          case 'save': await writes; await document.save(); break;
          case 'clipboardRead': {
            const text = await vscode.env.clipboard.readText();
            panel.webview.postMessage({ type: 'clipboardResult', requestId: message.requestId, text });
            break;
          }
          case 'clipboardWrite': {
            if (typeof message.text !== 'string' || message.text.length > 4 * 1024 * 1024) throw new Error('Clipboard text exceeds 4 MB.');
            await vscode.env.clipboard.writeText(message.text);
            panel.webview.postMessage({ type: 'clipboardResult', requestId: message.requestId });
            break;
          }
          case 'export': {
            const data = readSpreadsheet(JSON.stringify(message.data));
            const accepted = await vscode.window.showWarningMessage(
              'Export writes calculated values only. Formulas, styles and spreadsheet settings stay in the .sheet.json document. CSV/TSV/TXT export only the active sheet and escape formula-like text.',
              { modal: true }, 'Export values'
            );
            if (!accepted) break;
            const destination = await vscode.window.showSaveDialog({
              defaultUri: document.uri.with({ path: document.uri.path.replace(/\.sheet\.json$/, '.values.xlsx') }),
              filters: { 'Excel values': ['xlsx'], 'CSV values': ['csv'], 'Tab-separated values': ['tsv', 'txt'] }
            });
            if (!destination) break;
            if (destination.toString() === document.uri.toString()) throw new Error('Export cannot overwrite the working document.');
            const ext = path.extname(destination.path).slice(1).toLowerCase();
            await vscode.workspace.fs.writeFile(destination, exportSpreadsheetValues(data, ext, message.sheetId));
            break;
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
        if (message.type === 'clipboardRead' || message.type === 'clipboardWrite') {
          panel.webview.postMessage({ type: 'clipboardResult', requestId: message.requestId, error: error instanceof Error ? error.message : String(error) });
          return;
        }
        load();
      }
    });
    panel.onDidDispose(() => { changeListener.dispose(); messageListener.dispose(); });
    panel.webview.html = this.getHtml(panel.webview);
  }

  getHtml(webview: vscode.Webview): string {
    const nonce = randomBytes(16).toString('hex');
    const resource = (file: string) => webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', file));
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${resource('generated/spreadsheet.css')}">
<title>Spreadsheet</title></head><body>
<header id="spreadsheet-toolbar"><span id="document-name">Spreadsheet</span><span id="status" role="status">Loading...</span>
<button id="copy-values" type="button" title="Copy values" aria-label="Copy values"></button>
<button id="paste-values" type="button" title="Paste values" aria-label="Paste values"></button>
<button id="pivot" type="button" title="Create pivot table" aria-label="Create pivot table"></button>
<button id="refresh-pivot" type="button" title="Refresh pivot table" aria-label="Refresh pivot table" disabled></button>
<button id="save" type="button" title="Save working document" aria-label="Save working document"></button>
<button id="export" type="button" title="Export values" aria-label="Export values"></button></header>
<dialog id="pivot-dialog" aria-labelledby="pivot-title"><form id="pivot-form">
<h2 id="pivot-title">Pivot table</h2>
<label for="pivot-source">Source sheet</label><select id="pivot-source" required></select>
<label for="pivot-range">Source range</label><input id="pivot-range" required autocomplete="off">
<label for="pivot-rows">Rows</label><select id="pivot-rows" required></select>
<label for="pivot-columns">Columns</label><select id="pivot-columns"></select>
<label for="pivot-values">Values</label><select id="pivot-values" required></select>
<label for="pivot-aggregation">Aggregation</label><select id="pivot-aggregation">
<option value="SUM">Sum</option><option value="COUNT">Count non-empty</option>
<option value="AVERAGE">Average</option><option value="MIN">Minimum</option><option value="MAX">Maximum</option></select>
<p id="pivot-error" role="alert"></p><div class="dialog-actions">
<button id="pivot-cancel" type="button">Cancel</button><button id="pivot-create" type="submit">Create</button>
</div></form></dialog>
<main id="spreadsheet"></main><script nonce="${nonce}" src="${resource('generated/spreadsheet.js')}"></script>
</body></html>`;
  }
}