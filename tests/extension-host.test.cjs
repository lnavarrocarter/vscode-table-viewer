const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

exports.run = async function () {
  const vscode = require('vscode');
  const manifest = require('../package.json');
  const { importSpreadsheet } = require('../out/parsers/spreadsheetParser');
  const extension = vscode.extensions.getExtension(`${manifest.publisher}.${manifest.name}`);
  assert.ok(extension, 'Development extension must be registered');
  await extension.activate();
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('csvXlsTableViewer.importSpreadsheet'));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'table-viewer-host-files-'));
  const originalClipboard = await vscode.env.clipboard.readText();
  try {
    const clipboard = 'Code\tAmount\r\n0012\t7';
    await vscode.env.clipboard.writeText(clipboard);
    assert.ok(await vscode.env.clipboard.readText() === clipboard, 'Native VS Code clipboard round trip failed');
    const data = await importSpreadsheet(Buffer.from('Name;Amount\nAna;42'), 'csv', 'Host workbook');
    const uri = vscode.Uri.file(path.join(directory, 'host.sheet.json'));
    fs.writeFileSync(uri.fsPath, JSON.stringify(data));
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.commands.executeCommand('vscode.openWith', uri, 'csvXlsTableViewer.spreadsheetEditor');
    data.sheets['sheet-1'].cellData[1][1].v = '20';
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), JSON.stringify(data));
    assert.ok(await vscode.workspace.applyEdit(edit));
    assert.ok(document.isDirty);
    assert.ok(await document.save());
    assert.equal(JSON.parse(fs.readFileSync(uri.fsPath, 'utf8')).sheets['sheet-1'].cellData[1][1].v, '20');
    assert.ok(!document.isDirty);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    console.log('Real Extension Host: activation, native spreadsheet opening, save and system clipboard passed');
  } finally {
    await vscode.env.clipboard.writeText(originalClipboard);
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

if (require.main === module) {
  const { spawnSync } = require('node:child_process');
  const candidates = process.env.VSCODE_TEST_EXECUTABLE ? [process.env.VSCODE_TEST_EXECUTABLE] : [
    '/Applications/Visual Studio Code 2.app/Contents/MacOS/Code',
    '/Applications/Visual Studio Code.app/Contents/MacOS/Code',
    '/Applications/Visual Studio Code 2.app/Contents/MacOS/Electron',
    '/Applications/Visual Studio Code.app/Contents/MacOS/Electron'
  ];
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  if (!executable) throw new Error('Set VSCODE_TEST_EXECUTABLE to the VS Code executable to run real Extension Host tests.');
  const directory = fs.mkdtempSync(path.join(process.platform === 'darwin' ? '/tmp' : os.tmpdir(), 'tv-host-'));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  try {
    const result = spawnSync(executable, [
      '--user-data-dir', path.join(directory, 'profile'), '--extensions-dir', path.join(directory, 'extensions'),
      '--extensionDevelopmentPath', path.resolve(__dirname, '..'), '--extensionTestsPath', __filename,
      '--disable-extensions', '--disable-extension', 'github.copilot-chat', '--disable-extension', 'github.copilot',
      '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--new-window'
    ], { env, stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}