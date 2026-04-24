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
    webviewPanel.webview.options = { enableScripts: true };

    // Register the listener BEFORE setting html to avoid missing the 'ready' message
    const messageListener = webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      console.log('Message received from webview:', msg);
      switch (msg.type) {
        case 'ready':
          console.log('Webview ready, sending table data:', document.tableData);
          webviewPanel.webview.postMessage({ type: 'load', data: document.tableData });
          break;

        case 'edit': {
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
    const bytes = await serializeFile(document.tableData, ext);
    await vscode.workspace.fs.writeFile(context.destination, bytes);
    return { id: context.destination.toString(), delete: async () => { try { await vscode.workspace.fs.delete(context.destination); } catch {} } };
  }

  private _getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'table.js')
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
  <div id="toolbar">
    <input id="filter-input" type="text" placeholder="🔍 Filter rows..." autocomplete="off" />
    <span id="row-count"></span>
    <button id="save-btn">💾 Save</button>
  </div>
  <div id="table-container">
    <div id="loading">Loading…</div>
  </div>
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
