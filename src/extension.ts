import * as vscode from 'vscode';
import { TableEditorProvider } from './tableEditorProvider';
import { SpreadsheetEditorProvider } from './spreadsheetEditorProvider';
import { registerSheetMcp } from './mcp';

export function activate(context: vscode.ExtensionContext) {
  registerSheetMcp(context);
  context.subscriptions.push(TableEditorProvider.register(context));
  context.subscriptions.push(SpreadsheetEditorProvider.register(context));
  context.subscriptions.push(vscode.commands.registerCommand(
    'csvXlsTableViewer.newSpreadsheet', () => SpreadsheetEditorProvider.createFile()
  ));
  context.subscriptions.push(vscode.commands.registerCommand(
    'csvXlsTableViewer.importSpreadsheet', (uri?: vscode.Uri) => SpreadsheetEditorProvider.importFile(uri)
  ));

  context.subscriptions.push(
    vscode.commands.registerCommand('csvXlsTableViewer.openAsText', () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        vscode.commands.executeCommand(
          'vscode.openWith',
          activeEditor.document.uri,
          'default'
        );
      }
    })
  );
}

export function deactivate() {}
