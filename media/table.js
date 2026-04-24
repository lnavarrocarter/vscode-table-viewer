// @ts-check
(function () {
  const vscode = acquireVsCodeApi();

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

  // ── VS Code messaging ──────────────────────────────────────
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'load') {
      tableData = msg.data;
      sortCol = -1;
      sortDir = 'asc';
      filterText = '';
      filterInput.value = '';
      applyFilterAndSort();
      renderTable();
    } else if (msg.type === 'saved') {
      flashSaved();
    }
  });

  vscode.postMessage({ type: 'ready' });

  // ── Toolbar events ─────────────────────────────────────────
  filterInput.addEventListener('input', () => {
    filterText = filterInput.value.toLowerCase();
    applyFilterAndSort();
    renderTable();
  });

  saveBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'save' });
  });

  // ── Filter & sort logic ────────────────────────────────────
  function applyFilterAndSort() {
    if (!tableData) return;
    let rows = tableData.rows.map((r, i) => ({ row: r, origIndex: i }));

    if (filterText) {
      rows = rows.filter(({ row }) =>
        row.some(cell => cell.toLowerCase().includes(filterText))
      );
    }

    if (sortCol >= 0) {
      rows.sort((a, b) => {
        const av = a.row[sortCol] ?? '';
        const bv = b.row[sortCol] ?? '';
        const numA = parseFloat(av);
        const numB = parseFloat(bv);
        const isNum = !isNaN(numA) && !isNaN(numB);
        const cmp = isNum ? numA - numB : av.localeCompare(bv);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    filteredRows = rows;
    updateRowCount();
  }

  function updateRowCount() {
    if (!tableData) return;
    const total = tableData.rows.length;
    const shown = filteredRows.length;
    rowCountEl.textContent = shown < total
      ? `${shown} / ${total} rows`
      : `${total} rows`;
  }

  // ── Render ─────────────────────────────────────────────────
  function renderTable() {
    if (!tableData) return;

    container.innerHTML = '';
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
        td.textContent = cellVal;
        td.title = cellVal;
        td.addEventListener('dblclick', () => startEdit(td, origIndex, colIdx));
      });
    });

    container.appendChild(table);
  }

  // ── Inline cell editing ────────────────────────────────────
  function startEdit(td, rowIdx, colIdx) {
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
        commit();
        // Move to next cell
        const row = td.parentElement;
        const cells = Array.from(row.cells);
        const nextCell = cells[cells.indexOf(td) + 1];
        if (nextCell && nextCell !== cells[0]) {
          nextCell.dispatchEvent(new MouseEvent('dblclick'));
        }
      }
    });
  }

  function flashSaved() {
    saveBtn.textContent = '✅ Saved';
    saveBtn.classList.add('saved');
    setTimeout(() => {
      saveBtn.textContent = '💾 Save';
      saveBtn.classList.remove('saved');
    }, 1500);
  }
})();
