import * as vscode from 'vscode';
import * as path from 'path';
import { parseFile, serializeFile, TableData } from './parsers/fileParser';

export class TableEditorProvider implements vscode.CustomEditorProvider<TableDocument> {
  public static readonly viewType = 'csvXlsTableViewer.tableEditor';

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      TableEditorProvider.viewType,
      new TableEditorProvider(context),
      {
        supportsMultipleEditorsPerDocument: false,
        webviewOptions: { retainContextWhenHidden: true }
      }
    );
  }

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<TableDocument>>();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(uri: vscode.Uri): Promise<TableDocument> {
    console.log('openCustomDocument called for:', uri.fsPath);
    const data = await vscode.workspace.fs.readFile(uri);
    console.log('File read, size:', data.length);
    const ext = path.extname(uri.fsPath).toLowerCase().replace('.', '');
    console.log('File extension:', ext);
    const tableData = await parseFile(Buffer.from(data), ext);
    console.log('File parsed, rows:', tableData.rows.length, 'headers:', tableData.headers.length);
    return new TableDocument(uri, tableData);
  }

  async resolveCustomEditor(
    document: TableDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    console.log('resolveCustomEditor called');
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
    };

    // Register the listener BEFORE setting html to avoid missing the 'ready' message
    const messageListener = webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      console.log('Message received from webview:', msg);
      switch (msg.type) {
        case 'ready':
          console.log('Webview ready, sending table data:', document.tableData);
          webviewPanel.webview.postMessage({ type: 'load', data: document.tableData });
          break;

        case 'importSpreadsheet': {
          const hasUnsavedChanges = vscode.window.tabGroups.all.some(group => group.tabs.some(tab =>
            tab.input instanceof vscode.TabInputCustom &&
            tab.input.uri.toString() === document.uri.toString() && tab.isDirty
          ));
          if (hasUnsavedChanges) {
            await vscode.window.showWarningMessage('Save your changes before opening this file as a spreadsheet.');
            break;
          }
          await vscode.commands.executeCommand('csvXlsTableViewer.importSpreadsheet', document.uri);
          break;
        }

        case 'connectAgent': {
          const connected = await vscode.commands.executeCommand<boolean>('csvXlsTableViewer.connectAgent', document.uri);
          if (connected) webviewPanel.webview.postMessage({ type: 'agentConnected' });
          break;
        }

        case 'edit': {
          if (document.tableData.readOnly) break;
          const { row, col, value } = msg;
          document.tableData.rows[row][col] = value;
          const edit: vscode.CustomDocumentEditEvent<TableDocument> = {
            document,
            undo: () => { document.tableData.rows[row][col] = msg.oldValue; },
            redo: () => { document.tableData.rows[row][col] = value; },
            label: 'Edit Cell'
          };
          this._onDidChangeCustomDocument.fire(edit);
          break;
        }

        case 'save': {
          const cts = new vscode.CancellationTokenSource();
          try {
            await this.saveCustomDocument(document, cts.token);
            webviewPanel.webview.postMessage({ type: 'saved' });
          } finally {
            cts.dispose();
          }
          break;
        }
      }
    });

    // Dispose the listener when the panel closes to avoid memory leaks
    webviewPanel.onDidDispose(() => messageListener.dispose());

    webviewPanel.webview.html = this._getHtml(webviewPanel.webview);
  }

  async saveCustomDocument(document: TableDocument, _token: vscode.CancellationToken): Promise<void> {
    if (document.tableData.readOnly) throw new Error('This file is read-only. Use Save As to export it.');
    const ext = path.extname(document.uri.fsPath).toLowerCase().replace('.', '');
    const bytes = await serializeFile(document.tableData, ext);
    await vscode.workspace.fs.writeFile(document.uri, bytes);
  }

  async saveCustomDocumentAs(document: TableDocument, destination: vscode.Uri, _token: vscode.CancellationToken): Promise<void> {
    const ext = path.extname(destination.fsPath).toLowerCase().replace('.', '');
    const bytes = await serializeFile(document.tableData, ext);
    await vscode.workspace.fs.writeFile(destination, bytes);
  }

  async revertCustomDocument(document: TableDocument, _token: vscode.CancellationToken): Promise<void> {
    const data = await vscode.workspace.fs.readFile(document.uri);
    const ext = path.extname(document.uri.fsPath).toLowerCase().replace('.', '');
    document.tableData = await parseFile(Buffer.from(data), ext);
  }

  async backupCustomDocument(document: TableDocument, context: vscode.CustomDocumentBackupContext, _token: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
    const ext = path.extname(document.uri.fsPath).toLowerCase().replace('.', '');
    const bytes = document.tableData.readOnly
      ? await vscode.workspace.fs.readFile(document.uri)
      : await serializeFile(document.tableData, ext);
    await vscode.workspace.fs.writeFile(context.destination, bytes);
    return { id: context.destination.toString(), delete: async () => { try { await vscode.workspace.fs.delete(context.destination); } catch {} } };
  }

  private _getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'generated', 'table.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'table.css')
    );
    const nonce = getNonce();
    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>Table Viewer</title>
</head>
<body>
  <header id="product-header">
    <div class="product-identity"><span class="product-mark" aria-hidden="true">▦</span><div><h1>Table Viewer</h1><p>A clearer view of your data.</p></div></div>
    <span class="format-label">CSV · TSV · DBF · XLSX · XLS · ODS</span>
  </header>
  <div id="toolbar">
    <input id="filter-input" type="search" aria-label="Filter rows" placeholder="Filter rows…" autocomplete="off" />
    <span id="row-count" role="status" aria-live="polite"></span>
    <button id="connect-agent-btn" type="button" title="Share this saved file with OpenSpreadsheet MCP">Connect Agent</button>
    <button id="spreadsheet-btn" type="button" title="Create an experimental spreadsheet working copy">Open as Spreadsheet</button>
    <button id="save-btn" type="button">Save changes</button>
  </div>
  <section id="analysis-toolbar" aria-label="Filters and aggregation">
    <label>Column <select id="column-filter"><option value="">All columns</option></select></label>
    <select id="filter-operator" aria-label="Filter operator">
      <option value="contains">Contains</option><option value="equals">Equals</option>
      <option value="notEquals">Not equal</option><option value="greater">Greater than</option>
      <option value="less">Less than</option><option value="empty">Empty</option><option value="notEmpty">Not empty</option>
    </select>
    <input id="column-value" type="text" aria-label="Filter value" placeholder="Value" />
    <button id="clear-filters" type="button" title="Clear filters" aria-label="Clear filters"><i data-lucide="filter-x"></i></button>
    <label>Aggregate <select id="aggregate-column"></select></label>
    <select id="aggregate-operation" aria-label="Aggregation">
      <option>COUNT</option><option>SUM</option><option>AVERAGE</option><option>MIN</option><option>MAX</option>
    </select>
    <output id="aggregate-result" aria-live="polite"></output>
  </section>
  <main id="table-container" aria-label="Table data">
    <div id="loading" role="status">Loading your table…</div>
  </main>
  <footer id="editor-footer"><span>Double-click to edit · Enter to apply · Escape to cancel</span><span>Table Viewer</span></footer>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

class TableDocument implements vscode.CustomDocument {
  constructor(
    public readonly uri: vscode.Uri,
    public tableData: TableData
  ) {}
  dispose() {}
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
