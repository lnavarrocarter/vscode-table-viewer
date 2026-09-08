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
    for (const asset of [manifest.main, 'media/table.js', 'media/table.css', manifest.icon]) {
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
          window: { registerCustomEditorProvider: (id) => { registrations.push(id); return { dispose() {} }; } },
          commands: { registerCommand: (id) => { registrations.push(id); return { dispose() {} }; } }
        };
        return originalLoad.call(this, id, ...args);
      };
      (async () => {
        const manifest = require('./package.json');
        const context = { subscriptions: [] };
        require(manifest.main).activate(context);
        assert.deepEqual(registrations, [manifest.contributes.customEditors[0].viewType, manifest.contributes.commands[0].command]);
        assert.equal(context.subscriptions.length, 2);
        const { parseFile, serializeFile } = require('./out/parsers/fileParser.js');
        const data = { headers: ['Name', 'Note'], rows: [['José', 'hello, world'], ['Ana', 'line 1\\nline 2']] };
        for (const ext of ['csv', 'tsv', 'xlsx', 'xls', 'ods']) {
          const parsed = await parseFile(Buffer.from(await serializeFile(data, ext)), ext);
          assert.deepEqual(parsed.headers, data.headers, ext);
          assert.deepEqual(parsed.rows, data.rows, ext);
        }
        const csv = await parseFile(Buffer.from('Name;Value\\nJosé;42\\nAna;'), 'csv');
        assert.equal(csv.delimiter, ';');
        assert.deepEqual(csv.rows, [['José', '42'], ['Ana', '']]);
        assert.match(Buffer.from(await serializeFile(csv, 'csv')).toString(), /Name;Value/);
        console.log('Packaged activation and all five format round trips passed');
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
