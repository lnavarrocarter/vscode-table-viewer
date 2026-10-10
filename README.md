<div align="center">
  <img src="logo.png" alt="Table Viewer logo" width="112" />
  <h1>CSV / XLS Table Viewer</h1>
  <p><strong>Explore a table or work in a spreadsheet. Stay in VS Code.</strong></p>
  <p>Preview tabular files in place, or import a separate working copy with formulas, formatting, and pivot summaries.</p>
  <p><strong>English</strong> · <a href="README.es.md">Español</a></p>
  <p><a href="#get-started">Get started</a> · <a href="#screenshots">Screenshots</a> · <a href="docs/changelog.md">Changelog</a> · <a href="https://github.com/lnavarrocarter/vscode-table-viewer/issues">Report an issue</a></p>
</div>

<p align="center">
  <a href="https://github.com/lnavarrocarter/vscode-table-viewer/releases/latest"><img src="https://img.shields.io/github/v/release/lnavarrocarter/vscode-table-viewer?label=latest%20release" alt="Latest GitHub release" /></a>
  <img src="https://img.shields.io/badge/VS%20Code-1.105%2B-007ACC?logo=visualstudiocode&logoColor=white" alt="Requires VS Code 1.105 or later" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license" />
</p>

---

## Choose your workflow

| Table Viewer | Spreadsheet (Experimental) |
| --- | --- |
| Open CSV, TSV, XLSX, XLS, ODS, or DBF as a searchable and sortable table. Edit existing cells and save. | Import CSV, TSV, tab-delimited TXT, XLSX, XLS, ODS, or DBF into a separate `.sheet.json` working copy. Edit cells, use formulas and formatting, and create basic pivot summaries. |

The original file stays unchanged when you import into Spreadsheet. The experimental editor is powered by the local Univer OSS engine; it does not need a server or CDN.

## Screenshots

**Table Viewer:** filter and edit a familiar tabular file.

![Table Viewer showing fictional sales records in the VS Code dark theme](media/table-viewer.png)

**Spreadsheet editor:** formulas and fictional sales data.

![Spreadsheet editor showing the sample sales workbook](media/spreadsheet-editor.png)

**Pivot summary:** sales totals grouped by region and seller.

![Pivot summary of sample sales grouped by region and seller](media/spreadsheet-pivot.png)

### Column filters and summaries

![Column filter for Norte and sum of visible quantities](media/table-filters.png)

<img src="media/table-filters-mobile.png" alt="Column filters and summary in a narrow editor" width="390" />

### Movable charts

![Combined column and line chart in Spreadsheet](media/spreadsheet-charts.png)

The new captures use the local browser preview with a simulated VS Code host, fictional sales records and a fictional regional summary. They do not show a live Copilot connection. The sales fixture is [examples/ventas-demo.xlsx](examples/ventas-demo.xlsx).

## Get started

Requires **VS Code 1.105 or later**.

1. In VS Code, open **Extensions**, search for `CSV / XLS Table Viewer`, and install it.
2. Open a CSV, TSV, XLSX, XLS, ODS, or DBF file to use **Table Viewer**. If needed, right-click the tab and select **Reopen Editor With… → Table Viewer**.
3. To use formulas or pivot summaries, run **Table Viewer: Import into Spreadsheet (Experimental)** from the Command Palette and save a separate `.sheet.json` working copy.
4. In Table Viewer, double-click a cell to edit and press **Save changes** or **Ctrl+S** / **Cmd+S**. In Spreadsheet, use the toolbar or the same save shortcut.

You can also install a `.vsix` from [GitHub Releases](https://github.com/lnavarrocarter/vscode-table-viewer/releases) using **Extensions → … → Install from VSIX…**. To build a package locally, see the [development guide](docs/DEVELOPMENT.md).

### Sample files

- [Sales workbook](examples/ventas-demo.xlsx)
- [Matching read-only DBF/FoxPro table](examples/ventas-demo.dbf)

All sample records are fictional. For an agent-assisted financial example, see the [reconciliation walkthrough](examples/CONCILIACION.es.md), [invoices](examples/conciliacion-facturas.csv), [receipts](examples/conciliacion-cobros.csv) and [expected results](examples/conciliacion-esperada.csv).

## Column filters, summaries and DBF

Use **Column**, an operator and a value to combine a single column filter with global search. Operators: Contains, Equals, Not equal, Greater than, Less than, Empty and Not empty. Text comparisons ignore case; equality preserves leading zeros (`0012` differs from `12`). Empty checks whitespace. Numeric comparisons accept plain decimal/scientific text with a dot, not currency symbols or thousands separators. Clear the filters with the filter-reset icon.

Choose **Aggregate** and COUNT, SUM, AVERAGE, MIN or MAX. Results follow the visible rows and update after cell edits. COUNT counts rows, including blanks; the other operations use decimal arithmetic and report numeric and ignored values. Blank or nonnumeric values are ignored, and no numeric data yields N/A. Formatted workbook values such as `2,490.50` are not numeric inputs for these summaries; use a typed Spreadsheet copy for analysis instead. The summary is not a saved result sheet or a grouped pivot.

DBF stays read-only. **Create editable copy** imports it into a separate `.sheet.json`; make changes or add rows/columns there, then export values to CSV/TSV/TXT/XLSX. There is no DBF write-back. The reader checks field descriptors, unique names, widths, header terminator, record layout and deletion markers; encrypted and truncated tables are rejected. Memo fields and external FPT/DBT remain unsupported. Independent dBASE III/FoxPro fixtures test CP1252, dates, decimals, booleans and deleted records; real-file compatibility still needs verification.

## New documents and JSON arrays

Run **Table Viewer: New OpenSpreadsheet** to create a `.sheet.json`, or use **Open as Spreadsheet** in a table. Opening an empty `.sheet.json` initializes a blank workbook. A JSON array requires explicit conversion consent: scalar arrays become one column, row arrays become a grid, and object arrays use the union of keys as headers. A single wrapper such as `[{"users":[{"id":1,"name":"Ana"}]}]` is also accepted. Nested objects remain JSON text; arbitrary JSON objects are not workbook snapshots. Cancel conversion to open the text editor.

## Charts

Use **Insert chart** with an A1 range containing headers, categories in the first column and numeric series in the remaining columns. Types: column, horizontal bar, stacked column, combined column/line, line and pie. Combined charts need at least two series; the last uses a secondary numeric axis. Pie needs exactly two columns and nonnegative values.

Edit title, range, type, size, legend, number/currency/percent format and currency (USD, CLP, EUR, MXN, ARS, PEN). Percent uses fractions: `0.25` displays as `25%`. Drag the chart header to move it; edit, refresh, delete or **Export chart PNG** from its controls. Limits: 10,000 source cells and 12 charts per sheet. Charts live in `.sheet.json`, positioned relative to the viewport, not anchored to cells; they do not follow grid scrolling or zoom. Value exports do not include native Excel charts.

## Copilot and MCP

Run **Table Viewer: Start MCP Server** without opening a document, then enable **OpenSpreadsheet** in Copilot. Use **Connect Agent** in the table or the plug in Spreadsheet to share the current file with confirmation. From the Command Palette, **Connect Sheet Agent (MCP)** offers Share files, Share folder and Show shared files. Folder sharing reviews existing files only; new files are not automatically shared.

The shared inventory appears in **Output > OpenSpreadsheet - Shared files**; **Copy list for chat** copies it. The extension does not inject chat messages. Only explicitly shared files are accessible, workspace trust is required, and restarting clears sharing. Original formats are read from disk, so save pending changes first; only native `.sheet.json` documents accept confirmed, undoable agent writes, which are not saved automatically. Although the server is local, the AI client may send shared data to its provider.

Tools cover reading, literal writes, trim/uppercase, working copies, new sheets, chart create/update/delete, pivots and refresh, cross-file LEFT/INNER joins, actual versus budget and reconciliation by exact typed key. Financial analyses use decimal summation, configurable rounding/tolerance and duplicate review; they are snapshots, not live links, fuzzy matching or payment allocation. Claude automatic setup, reusable/batch workflows, an installable skill and paid activation are not implemented. See the [MCP guide](docs/MCP.md) for tools, limits and prompts.

## Supported formats

| Format | Reading and saving |
| --- | --- |
| CSV | UTF-8 text; automatic delimiter detection, retained on save |
| TSV | UTF-8 text with tab separators |
| XLSX | First worksheet, displayed as text values |
| XLS | First worksheet, displayed as text values |
| ODS | First worksheet, displayed as text values |
| DBF / FoxPro | Read-only values; external memo fields are rejected |

The first row becomes the column headers. Empty headers receive names such as `Col1`; blank CSV/TSV lines are skipped.

**Workbook saving:** XLSX, XLS, and ODS files are rebuilt as a single worksheet named `Sheet1`, containing text values. Other worksheets, formulas, formatting, and original cell types are not preserved. Work on a copy when you need to keep those features.

## Experimental spreadsheet

Run **Table Viewer: Import into Spreadsheet (Experimental)** from the Command Palette, choose a CSV, TSV, UTF-8 tabulated TXT, DBF, XLSX, XLS, or ODS file, then create a separate **`.sheet.json`** working document. The source file is not changed. Opening the working document uses the **Spreadsheet (Experimental)** editor.

The local Univer OSS engine provides range selection, keyboard editing, copy/paste controls, formulas, formatting, worksheet operations, and its own undo/redo. Save the working document with the save icon or **Ctrl+S / Cmd+S**. VS Code also tracks text-document changes and reloads the spreadsheet on external changes or undo. No CDN, Pro license, or server is required.

- Workbook imports retain all worksheets, scalar types, formulas, number formats and merges, not full Excel styling, charts, macros or pivot tables. Importing a workbook calculates its supported formulas; unsupported functions are not guaranteed to match Excel.
- CSV/TSV/TXT fields initially stay as text, preserving identifiers and leading zeros. Formula-like imported text is not executed. Convert numeric inputs explicitly or use functions such as `VALUE` when needed. Text import currently requires UTF-8.
- DBF originals are read-only. A native working copy is editable and retains imported scalar types, but it is not a DBF editor. Memo fields (`M`, `G`, `P`, `W`), external FPT/DBT files, indexes, and writing back to FoxPro are not supported. Legacy code pages and DBF variants still need real-file verification.
- The export icon writes **calculated values only**: XLSX includes all sheets; CSV/TSV/TXT includes only the active sheet. Formula definitions, styles and settings remain in `.sheet.json`. Formula-like text is escaped in text exports. Export can overwrite the destination you explicitly select, so choose a new output file.
- **Copy values / Paste values** in the top toolbar use VS Code's system clipboard, not browser clipboard permissions. Values are copied as quoted TSV; paste preserves leading zeros, multiline fields and formula-like text as literal strings. Formula-like strings are escaped when copying to protect external spreadsheet applications. Pasted numbers initially remain text; convert them explicitly when needed. These controls transfer values, not styles or formula definitions. Univer's own clipboard controls remain available for native editing.
- **Create pivot table** groups a source range into a new worksheet with one row field, an optional column field, one value field, and Sum, Count non-empty, Average, Minimum or Maximum. Grand totals are computed over source records. **Refresh pivot table** on its result sheet updates values and clears old result cells; the definition is retained in `.sheet.json`. Source ranges require headers and are fixed: expanding the data or inserting/deleting source rows or columns does not automatically update the definition. Create a new pivot when the source structure changes. Source and result sizes are limited to 100,000 cells each. Numeric aggregations accept numbers and decimal/scientific numeric text with a dot; other non-empty text is rejected.
- These are basic analysis tables, not native Excel PivotTable objects. Export includes their resulting values, not refreshable pivot definitions. Multiple measures, hierarchical grouping, pivot filters, native Excel chart export and commercial integrations remain future work. Native snapshots are experimental and tied to the pinned Univer version; keep source files and backups.

Tests cover the real VS Code Extension Host's activation, opening, save and system clipboard API, as well as synthetic dBASE III/FoxPro records with CP1252, dates, decimals, booleans and deleted records. Interchange with Excel/Sheets and your own DBF files still require manual verification. SheetJS CE is pinned to official version 0.20.3, addressing the known advisories in 0.18.5; production dependency auditing currently reports no vulnerabilities. Continue treating imported files as untrusted data.

## Everyday controls

| Action | Control |
| --- | --- |
| Sort a column | Click its header; click again to reverse |
| Filter rows | **Filter rows**, plus **Column**, operator and value |
| Summarize visible rows | **Aggregate**, then COUNT/SUM/AVERAGE/MIN/MAX |
| Modify a DBF | **Create editable copy**, edit the native copy and export values |
| Share with an agent | **Connect Agent** or the Spreadsheet plug |
| Edit a cell | Double-click the cell |
| Confirm an edit | Press **Enter** or click outside |
| Cancel an edit | Press **Escape** |
| Edit the next cell in the same row | Press **Tab** while editing |
| Save | **Save changes**, **Ctrl+S** (Windows/Linux), or **Cmd+S** (macOS) |
| Open as text | Right-click the tab → **Reopen Editor With… → Text Editor** |

Sorting and filtering affect the view only; they do not reorder or remove saved rows. Search matches cell values, not column headers.

## Current scope

The original Table Viewer focuses on inspecting data and editing existing cells. Unlike the separate experimental spreadsheet editor, it does not provide worksheet selection, formula calculation, header editing, or row/column insertion. All rows render at once, so very large files may be slow. Undo/redo and revert update the document model, but the original table view does not refresh automatically for those operations.

## Documentation and support

- [Release notes](docs/changelog.md)
- [Development, packaging, and release guide](docs/DEVELOPMENT.md)
- [MCP tools, security and analysis guide](docs/MCP.md)
- [Documentación en español](README.es.md)
- [Issues and feature requests](https://github.com/lnavarrocarter/vscode-table-viewer/issues) — include your VS Code version, file format, reproduction steps, and a small anonymized sample.

## Author and license

Created by [lnavarrocarter](https://github.com/lnavarrocarter). Released under the [MIT License](LICENSE).

The experimental editor bundles Univer OSS (Apache-2.0) and other third-party libraries. Their license texts and notices are included in `media/generated/THIRD_PARTY_LICENSES.txt` in the VSIX.
