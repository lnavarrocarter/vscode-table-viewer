<div align="center">
  <img src="logo.png" alt="Table Viewer logo" width="112" />
  <h1>CSV / XLS Table Viewer</h1>
  <p><strong>Your data. A clearer view. Inside VS Code.</strong></p>
  <p>Explore, filter, and edit tabular files without leaving your editor.</p>
  <p><strong>English</strong> · <a href="README.es.md">Español</a></p>
  <p><a href="#get-started">Get started</a> · <a href="docs/DEVELOPMENT.md">Development</a> · <a href="https://github.com/lnavarrocarter/vscode-table-viewer/issues">Report an issue</a></p>
</div>

---

## A table where you need it

Turn CSV, TSV, XLSX, XLS, and ODS files into an interactive table. Inspect an export, find a record, or make a quick cell edit in your existing VS Code workspace.

- **Find what matters.** Search across all cells with a global, case-insensitive filter.
- **Explore by column.** Click a header to sort; click again to reverse the order.
- **Edit in place.** Double-click a cell, update its value, and save to the original file.
- **Stay in your editor.** Theme-aware styling, sticky column headers, row numbers, and horizontal and vertical scrolling.
- **Keep your delimiter.** CSV delimiters are detected automatically and retained when saving; TSV uses tabs.

## Get started

Requires **VS Code 1.85 or later**.

1. In VS Code, open **Extensions** and search for `CSV / XLS Table Viewer` by `lnavarrocarter`.
2. Install the extension and open a supported file.
3. If it opens as text, right-click its editor tab and choose **Reopen Editor With… → Table Viewer**.
4. Double-click a cell to edit, then use **Save changes** or **Ctrl+S** / **Cmd+S**.

You can also install a `.vsix` from [GitHub Releases](https://github.com/lnavarrocarter/vscode-table-viewer/releases) using **Extensions → … → Install from VSIX…**. To build a package locally, see the [development guide](docs/DEVELOPMENT.md).

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
- These are basic analysis tables, not native Excel PivotTable objects. Export includes their resulting values, not refreshable pivot definitions. Multiple measures, hierarchical grouping, pivot filters, charts, rich Excel export and commercial integrations remain future work. Native snapshots are experimental and tied to the pinned Univer version; keep source files and backups.

Tests cover the real VS Code Extension Host's activation, opening, save and system clipboard API, as well as synthetic dBASE III/FoxPro records with CP1252, dates, decimals, booleans and deleted records. Interchange with Excel/Sheets and your own DBF files still require manual verification. SheetJS CE is pinned to official version 0.20.3, addressing the known advisories in 0.18.5; production dependency auditing currently reports no vulnerabilities. Continue treating imported files as untrusted data.

## Everyday controls

| Action | Control |
| --- | --- |
| Sort a column | Click its header; click again to reverse |
| Filter rows | Type in **Filter rows** |
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

- [Development, packaging, and release guide](docs/DEVELOPMENT.md)
- [Changelog](docs/changelog.md)
- [Documentación en español](README.es.md)
- [Issues and feature requests](https://github.com/lnavarrocarter/vscode-table-viewer/issues) — include your VS Code version, file format, reproduction steps, and a small anonymized sample.

## Author and license

Created by [lnavarrocarter](https://github.com/lnavarrocarter). Released under the [MIT License](LICENSE).

The experimental editor bundles Univer OSS (Apache-2.0) and other third-party libraries. Their license texts and notices are included in `media/generated/THIRD_PARTY_LICENSES.txt` in the VSIX.
