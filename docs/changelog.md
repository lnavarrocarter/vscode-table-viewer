# Changelog

All notable changes are documented here. User-facing release notes are mirrored in [Spanish](es/changelog.md).

## Unreleased

## 0.6.0 - 2026-10-10

### Added
- Updated bilingual README, MCP and development guides with current commands, DBF/filter/summary workflows, JSON creation, charts, agent analyses and desktop/mobile preview screenshots.
- Table viewer column filters (contains, equals, not equal, numeric comparisons, empty/nonempty) combined with global search, and COUNT/SUM/AVERAGE/MIN/MAX summaries over visible rows using decimal arithmetic. DBF offers an editable Spreadsheet copy without modifying the original.
- Shared DBF structural validation for the viewer and Spreadsheet/MCP imports: field descriptors, unique names, nonzero widths, record layout, header terminator and deletion markers. Encrypted tables are rejected explicitly; empty tables remain supported.
- Connect Agent in the table viewer directly shares the open file with MCP; Spreadsheet also shares its current document without reopening the file picker.
- Start MCP Server command starts OpenSpreadsheet independently of open editors or shared files.
- Compact MCP confirmation summaries and reviewed folder sharing. Shared-file paths and access modes appear in a VS Code output channel and can be copied for chat; the agent receives paths through list_documents.
- Fictional realistic invoice/receipt reconciliation CSV examples, expected results and a Spanish walkthrough covering partial payments, rounding, duplicates, credit notes and unmatched references.
- MCP actual-versus-budget and reconciliation previews with decimal arithmetic, explicit HALF_UP rounding, configurable tolerance, unmatched-key reporting and duplicate-key review. Results are created in separate editable sheets without changing sources.
- MCP pivot creation and refresh, plus exact-key LEFT/INNER table joins across authorized formats. Results use editable working sheets with confirmed previews, bounded output and source-change detection.
- Horizontal bars, stacked columns and combined charts (last series on a secondary line axis), number/currency/percentage formatting and PNG image export. Styles and formats are also available through MCP chart previews.
- Chart size and legend controls, plus MCP `list_charts` and `preview_chart` for confirmed creation, updates and deletion without changing cells.
- Own in-sheet charts using Chart.js: columns, lines and pie, selected-range data, editable titles/ranges, drag positioning, refresh and deletion. Definitions persist in `.sheet.json`; viewport-relative positioning, no XLSX chart export.
- MCP tools to create a confirmed, automatically authorized editable working copy and preview new worksheets without changing existing sheets.
- Experimental local MCP connector for Copilot: explicitly authorized multiformat reads, value and text-normalization previews, confirmed undoable spreadsheet edits. Requires VS Code 1.105+. See [MCP guide](MCP.md).
- JSON object arrays become spreadsheet columns, including a single-property wrapper such as `[{"users": [...]}]`; nested cell values remain JSON text.
- New OpenSpreadsheet command, automatic initialization of empty `.sheet.json` files, and undoable simple JSON array conversion with explicit confirmation.
- Open as Spreadsheet button in the table viewer creates a separate working copy of the current file. Save pending edits before importing.

## 0.5.0 - 2026-10-09

### Added
- Experimental Univer spreadsheet editor with formulas, cell selection, formatting, worksheet operations, undo and redo.
- Import into a separate `.sheet.json` working document and export calculated values to XLSX, CSV, TSV or tab-delimited TXT.
- Basic pivot summaries with row and optional column grouping, sum, count, average, minimum and maximum, including refreshable saved definitions.
- Copy and paste values through the VS Code system clipboard, preserving leading zeroes and multiline text.
- Read-only DBF/FoxPro import. Memo fields are rejected explicitly.
- Fictional multi-sheet Excel and DBF examples in `examples/`.
- SheetJS 0.20.3 and packaged third-party license notices.
