# Developing Table Viewer

**English** · [Español](DEVELOPMENT.es.md) · [Back to product overview](../README.md)

## Local setup

Use Node.js 20 or later, npm, and VS Code 1.85 or later. Package verification also requires `unzip` (available on macOS and the Ubuntu CI runner). CI uses Node.js 22.

```bash
git clone https://github.com/lnavarrocarter/vscode-table-viewer.git
cd vscode-table-viewer
npm ci
npm run compile
```

Open the repository in VS Code and press **F5**. The checked-in `.vscode/launch.json` and `.vscode/tasks.json` start the watch build and open an Extension Development Host. Open a supported file in that window to try the editor.

## Architecture

| File | Responsibility |
| --- | --- |
| `src/extension.ts` | Registers the custom editor and plain-text command |
| `src/tableEditorProvider.ts` | Document lifecycle, webview messages, save and backup |
| `src/parsers/fileParser.ts` | CSV/TSV parsing with PapaParse; workbook parsing with SheetJS |
| `media/table.js` | Table rendering, filtering, sorting, and cell editing |
| `media/table.css` | Responsive UI using VS Code theme colors |
| `tests/package.test.cjs` | Checks the standalone VSIX and format round trips |
| `.github/workflows/validate.yml` | Package validation on pushes and pull requests to main |
| `.github/workflows/release.yml` | Version-tag validation and publication |

The provider reads a file into headers and string rows. The webview sends `ready`, `edit`, and `save` messages; the provider sends `load` and `saved`. Filtering and sorting preserve each row's original index so edits target the source row. Parsing and serialization run in the extension host.

## Build and verify

```bash
npm run compile       # Compile TypeScript
npm run watch         # Recompile on changes
npm test              # Build, package, and test table-viewer.vsix
npm run test:package  # Test an existing table-viewer.vsix
```

`npm test` extracts the VSIX into a temporary directory outside the checkout. It checks assets, activates the extension against a mocked VS Code API, and verifies CSV, TSV, XLSX, XLS, and ODS round trips using only packaged dependencies. It also checks semicolon delimiter preservation.

TypeScript retains imports of `papaparse` and `xlsx`, so production dependencies must be included. Do not exclude `node_modules/**` or use `--no-dependencies` without first adding a bundler.

The automated check does not run the webview or a real Extension Host. Before release, install the VSIX and check:

- Open a file of each supported format, edit a cell, save, and reopen it.
- Filter and sort, then edit a visible row and confirm the correct source row changes.
- Confirm Enter, Escape, and Tab behavior during editing.
- Inspect light, dark, and high-contrast themes, a narrow editor, empty files, and searches with no results.
- Use disposable workbook copies to confirm the saving limitations described in the README.

## Package and release

```bash
npm run package
code --install-extension csv-xls-table-viewer-0.4.1.vsix
```

The package filename uses the version in `package.json`; adjust the install command after changing it.

For a release, update `package.json` and `package-lock.json` together with `npm version`. The release workflow runs on `v*.*.*` tags, requires the tag to match the manifest version, executes `npm test`, then publishes the validated VSIX to the Marketplace and GitHub Releases. Marketplace publishing requires the repository secret `VSCE_PAT`. Pushing a matching tag triggers publication.

## Documentation contributions

English is the primary language. Keep `README.md` and `README.es.md` aligned, and update both versions of this guide when development steps change. Product claims should describe behavior implemented in the current code. Use synthetic or anonymized data in examples and screenshots.
