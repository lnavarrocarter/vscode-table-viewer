// @ts-check
import { matchesFilter, aggregateValues } from '../src/tableAnalysis';
import { createIcons, FilterX } from 'lucide';
(function () {
  console.log('Table.js loading...');
  const vscode = acquireVsCodeApi();
  console.log('VS Code API acquired');

  /** @type {{ headers: string[], rows: string[][] } | null} */
  let tableData = null;
  let filteredRows = [];
  let sortCol = -1;
  let sortDir = 'asc'; // 'asc' | 'desc'
  let filterText = '';

  const container = document.getElementById('table-container');
  const filterInput = document.getElementById('filter-input');
  const rowCountEl = document.getElementById('row-count');
  const saveBtn = document.getElementById('save-btn');
  const columnFilter = document.getElementById('column-filter');
  const filterOperator = document.getElementById('filter-operator');
  const columnValue = document.getElementById('column-value');
  const aggregateColumn = document.getElementById('aggregate-column');
  const aggregateOperation = document.getElementById('aggregate-operation');
  const aggregateResult = document.getElementById('aggregate-result');
  createIcons({ icons: { FilterX } });

  // ── VS Code messaging ──────────────────────────────────────
  window.addEventListener('message', (event) => {
    console.log('Message received:', event.data);
    const msg = event.data;
    if (msg.type === 'load') {
      console.log('Loading table data:', msg.data);
      tableData = msg.data;
      saveBtn.disabled = !!tableData.readOnly;
      saveBtn.title = tableData.readOnly ? 'Read-only DBF. Use Save As to export.' : '';
      sortCol = -1;
      sortDir = 'asc';
      filterText = '';
      filterInput.value = '';
      columnFilter.replaceChildren(new Option('All columns', ''));
      aggregateColumn.replaceChildren();
      tableData.headers.forEach((header, index) => {
        columnFilter.add(new Option(header, String(index)));
        aggregateColumn.add(new Option(header, String(index)));
      });
      columnValue.value = '';
      filterOperator.value = 'contains';
      updateFilterControls();
      document.getElementById('spreadsheet-btn').textContent = tableData.readOnly ? 'Create editable copy' : 'Open as Spreadsheet';
      document.querySelector('#editor-footer span').textContent = tableData.readOnly ? 'Read-only DBF' : 'Table Viewer';
      applyFilterAndSort();
      renderTable();
    } else if (msg.type === 'saved') {
      flashSaved();
    } else if (msg.type === 'agentConnected') {
      document.getElementById('connect-agent-btn').textContent = 'Shared with Agent';
    }
  });

  console.log('Sending ready message...');
  vscode.postMessage({ type: 'ready' });
  console.log('Ready message sent');

  // ── Toolbar events ─────────────────────────────────────────
  filterInput.addEventListener('input', () => {
    filterText = filterInput.value.toLowerCase();
    applyFilterAndSort();
    renderTable();
  });

  saveBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'save' });
  });

  document.getElementById('spreadsheet-btn').addEventListener('click', () => {
    vscode.postMessage({ type: 'importSpreadsheet' });
  });
  document.getElementById('connect-agent-btn')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'connectAgent' });
  });
  function updateFilterControls() {
    filterOperator.disabled = columnFilter.value === '';
    columnValue.disabled = columnFilter.value === '' || ['empty', 'notEmpty'].includes(filterOperator.value);
  }
  for (const control of [columnFilter, filterOperator, columnValue]) {
    control.addEventListener('input', () => {
      updateFilterControls();
      applyFilterAndSort();
      renderTable();
    });
  }
  for (const control of [aggregateColumn, aggregateOperation]) control.addEventListener('change', updateAggregation);
  document.getElementById('clear-filters').addEventListener('click', () => {
    filterInput.value = filterText = columnFilter.value = columnValue.value = '';
    filterOperator.value = 'contains';
    updateFilterControls();
    applyFilterAndSort();
    renderTable();
  });
  function updateAggregation() {
    if (!tableData || aggregateColumn.value === '') { aggregateResult.textContent = ''; return; }
    const result = aggregateValues(filteredRows.map(({ row }) => row[Number(aggregateColumn.value)] ?? ''), aggregateOperation.value);
    aggregateResult.textContent = `${aggregateOperation.value}: ${result.value || 'N/A'}`;
    if (aggregateOperation.value !== 'COUNT') {
      aggregateResult.textContent += ` (${result.numericCount} numeric, ${result.ignoredCount} ignored)`;
    }
  }

  // ── Filter & sort logic ────────────────────────────────────
  function applyFilterAndSort() {
    if (!tableData) return;
    let rows = tableData.rows.map((r, i) => ({ row: r, origIndex: i }));

    if (filterText) {
      rows = rows.filter(({ row }) =>
        row.some(cell => cell.toLowerCase().includes(filterText))
      );
    }
    if (columnFilter.value !== '') {
      rows = rows.filter(({ row }) => matchesFilter(row[Number(columnFilter.value)] ?? '', filterOperator.value, columnValue.value));
    }

    if (sortCol >= 0) {
      rows.sort((a, b) => {
        const av = a.row[sortCol] ?? '';
        const bv = b.row[sortCol] ?? '';
        const numA = Number(av);
        const numB = Number(bv);
        const isNum = av.trim() !== '' && bv.trim() !== '' && Number.isFinite(numA) && Number.isFinite(numB);
        const cmp = isNum ? numA - numB : av.localeCompare(bv);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    filteredRows = rows;
    updateRowCount();
    updateAggregation();
  }

  function updateRowCount() {
    if (!tableData) return;
    const total = tableData.rows.length;
    const shown = filteredRows.length;
    rowCountEl.textContent = shown < total
      ? `${shown} of ${total} rows · ${tableData.headers.length} columns`
      : `${total} rows · ${tableData.headers.length} columns`;
  }

  // ── Render ─────────────────────────────────────────────────
  function renderTable() {
    if (!tableData) return;

    container.innerHTML = '';
    if (!tableData.headers.length || !filteredRows.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.setAttribute('role', 'status');
      const heading = document.createElement('h2');
      heading.textContent = filterText || columnFilter.value !== '' ? 'No matching rows' : 'No data rows yet';
      const hint = document.createElement('p');
      hint.textContent = filterText
        ? 'Try a different search or clear the filter to see all rows.'
        : 'Open a file with a header row and data to start exploring.';
      empty.append(heading, hint);
      container.appendChild(empty);
      if (!tableData.headers.length) return;
    }
    const table = document.createElement('table');

    // thead
    const thead = table.createTHead();
    const headerRow = thead.insertRow();

    // row-number corner cell
    const cornerTh = document.createElement('th');
    cornerTh.textContent = '#';
    headerRow.appendChild(cornerTh);

    tableData.headers.forEach((h, colIdx) => {
      const th = document.createElement('th');
      const label = document.createElement('span');
      label.textContent = h;
      const indicator = document.createElement('span');
      indicator.className = 'sort-indicator';
      th.appendChild(label);
      th.appendChild(indicator);

      if (sortCol === colIdx) {
        th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      }

      th.addEventListener('click', () => {
        if (sortCol === colIdx) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortCol = colIdx;
          sortDir = 'asc';
        }
        applyFilterAndSort();
        renderTable();
      });
      headerRow.appendChild(th);
    });

    // tbody
    const tbody = table.createTBody();
    filteredRows.forEach(({ row, origIndex }, displayIdx) => {
      const tr = tbody.insertRow();

      // row number
      const numTd = tr.insertCell();
      numTd.textContent = String(origIndex + 1);

      row.forEach((cellVal, colIdx) => {
        const td = tr.insertCell();
        td.dataset.row = String(origIndex);
        td.dataset.column = String(colIdx);
        td.textContent = cellVal;
        td.title = cellVal;
        td.addEventListener('dblclick', () => startEdit(td, origIndex, colIdx));
      });
    });

    container.appendChild(table);
  }

  // ── Inline cell editing ────────────────────────────────────
  function startEdit(td, rowIdx, colIdx) {
    if (tableData.readOnly) return;
    if (td.classList.contains('editing')) return;
    const oldValue = tableData.rows[rowIdx][colIdx];

    td.classList.add('editing');
    td.title = '';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldValue;
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();

    function commit() {
      const newValue = input.value;
      td.classList.remove('editing');
      td.textContent = newValue;
      td.title = newValue;

      if (newValue !== oldValue) {
        tableData.rows[rowIdx][colIdx] = newValue;
        // Update filteredRows reference too
        const fr = filteredRows.find(r => r.origIndex === rowIdx);
        if (fr) fr.row[colIdx] = newValue;

        vscode.postMessage({ type: 'edit', row: rowIdx, col: colIdx, value: newValue, oldValue });
        applyFilterAndSort();
        if (filterText || columnFilter.value !== '' || sortCol >= 0) renderTable();
      }
    }

    function cancel() {
      td.classList.remove('editing');
      td.textContent = oldValue;
      td.title = oldValue;
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.removeEventListener('blur', commit); cancel(); }
      if (e.key === 'Tab') {
        e.preventDefault();
        // Remove blur listener first to prevent double-commit when focus leaves
        input.removeEventListener('blur', commit);
        commit();
        // Move to next cell
        const nextCell = container.querySelector(`td[data-row="${rowIdx}"][data-column="${colIdx + 1}"]`);
        if (nextCell) {
          nextCell.dispatchEvent(new MouseEvent('dblclick'));
        }
      }
    });
  }

  function flashSaved() {
    saveBtn.textContent = 'Saved';
    saveBtn.classList.add('saved');
    setTimeout(() => {
      saveBtn.textContent = 'Save changes';
      saveBtn.classList.remove('saved');
    }, 1500);
  }
})();
