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
| `src/spreadsheetEditorProvider.ts` | Experimental native JSON editor, import command and value export |
| `src/parsers/spreadsheetParser.ts` | Typed multi-sheet Univer snapshots and value-only exports |
| `src/pivot.ts` | Validated pivot grouping and aggregate totals using lodash |
| `src/clipboard.ts` | Quoted TSV copy/paste with literal text and bounded ranges |
| `media/spreadsheet.js` | Local Univer OSS spreadsheet and document synchronization |
| `scripts/build-webview.cjs` | Bundles frontend resources and third-party license notices |
| `tests/spreadsheet.test.cjs` | Adapter/protocol tests and browser preview harness |
| `tests/extension-host.test.cjs` | Isolated real VS Code activation, save and clipboard smoke test |
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
npm run test:spreadsheet # Build and test spreadsheet adapters and host protocol
npm run test:extension-host # Real VS Code with a temporary profile
npm run watch:webview # Rebuild Univer resources on frontend changes
npm run preview:spreadsheet # Browser harness after compilation, localhost:39431
```

`npm test` runs spreadsheet adapter/protocol tests and extracts the VSIX into a temporary directory outside the checkout. It checks assets and license notices, activates both editors against a mocked VS Code API, verifies CSV, TSV, TXT, XLSX, XLS, and ODS round trips, and checks read-only DBF and native spreadsheet adapters using only packaged dependencies. It also checks semicolon delimiter preservation.

`npm run compile` builds TypeScript and the Univer webview. The existing `watch` task watches only TypeScript; run `watch:webview` separately for frontend changes. Univer and esbuild are development dependencies: their frontend code is bundled into `media/generated/`, not loaded from Node modules or a CDN at runtime. Keep the generated resources in the VSIX even though Git ignores them. The build collects license texts from packages included in the bundle. Keep all Univer packages pinned to matching versions.

The preview uses the production HTML and CSP with a simulated VS Code host, a synthetic two-sheet workbook and an in-memory clipboard. It does not access the system clipboard. Browser checks cover nonblank rendering, calculation, formatting, undo/redo, pivot creation/refresh/reload, value copy/paste, themes and a narrow viewport. Native documents use VS Code's text lifecycle; edits are versioned snapshots and exports are values-only. Pivot definitions are stored in result-sheet custom metadata, tied to the pinned Univer release. Clipboard values travel through the host's `vscode.env.clipboard` API, preserving explicit user-triggered access.

`test:extension-host` launches the installed VS Code with a temporary profile and extension directory, tests activation, opening, save and system clipboard API, and restores the original clipboard without logging its contents. On macOS it detects standard installations; elsewhere set `VSCODE_TEST_EXECUTABLE` to the application executable. It is separate from `npm test` because it requires a GUI installation. It does not automate Excel/Sheets. DBF unit tests use independent binary fixtures for dBASE III and Visual FoxPro, with CP1252, dates, decimals, booleans and deletion flags; real anonymized DBF variants and external application interchange remain manual checks. Memo imports and DBF writes must fail explicitly.

SheetJS is pinned to the official 0.20.3 tarball because the public npm registry stops at 0.18.5. The lockfile records integrity and the isolated VSIX test asserts the packaged version. Run `npm audit --omit=dev` to check production dependencies; development tooling can still report separate advisories. Do not replace the official source with the old registry package. Sources: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/.

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
