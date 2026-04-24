import * as vscode from 'vscode';
import { TableEditorProvider } from './tableEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(TableEditorProvider.register(context));

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
