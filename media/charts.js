import Chart from 'chart.js/auto';
import { createElement, ChartColumn, Pencil, RefreshCw, Trash2, Download } from 'lucide';
import { chartOptions } from '../src/chartOptions';

export function setupCharts(getWorkbook, queueEdit, setStatus, exportImage) {
  const layer = document.getElementById('chart-layer');
  const dialog = document.getElementById('chart-dialog');
  const form = document.getElementById('chart-form');
  const rangeInput = document.getElementById('chart-range');
  const titleInput = document.getElementById('chart-title-input');
  const typeInput = document.getElementById('chart-type');
  const error = document.getElementById('chart-error');
  const instances = [];
  let editingId;
  let editingSheet;
  let signature = '';
  const colors = ['#16846b', '#e3a028', '#397bc0', '#d05b68', '#78704c', '#45a6b0'];
  const records = sheet => sheet.getSheet().getCustomMetadata()?.tableViewerCharts ?? [];
  const store = (sheet, charts) => {
    sheet.setCustomMetadata({ ...sheet.getSheet().getCustomMetadata(), tableViewerCharts: charts });
    queueEdit();
    signature = '';
    render();
  };
  function chartData(sheet, definition) {
    const selected = sheet.getRange(definition.range);
    const coordinates = selected.getRange();
    if ((coordinates.endRow - coordinates.startRow + 1) * (coordinates.endColumn - coordinates.startColumn + 1) > 10000) throw new Error('Charts support up to 10,000 cells.');
    const values = selected.getValues();
    if (values.length < 2 || values[0].length < 2) throw new Error('Select headers, categories and at least one numeric column.');
    if (definition.type === 'pie' && values[0].length !== 2) throw new Error('Pie charts require exactly two columns.');
    const rows = values.slice(1).filter(row => row.some(value => value !== null && value !== ''));
    if (!rows.length) throw new Error('No data rows in this range.');
    const datasets = values[0].slice(1).map((header, index) => {
      const data = rows.map(row => {
        const value = row[index + 1];
        if (value === null || value === '') return null;
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Series must contain numeric cells, not text.');
        if (definition.type === 'pie' && value < 0) throw new Error('Pie charts cannot contain negative values.');
        return value;
      });
      return { label: String(header ?? `Series ${index + 1}`), data, borderColor: colors[index % colors.length],
        backgroundColor: definition.type === 'pie' ? rows.map((_, rowIndex) => colors[rowIndex % colors.length]) : colors[index % colors.length] };
    });
    chartOptions(definition, datasets.length);
    if (definition.type === 'combo') datasets.forEach((dataset, index) => {
      dataset.type = index === datasets.length - 1 ? 'line' : 'bar';
      dataset.yAxisID = index === datasets.length - 1 ? 'y1' : 'y';
    });
    return { labels: rows.map(row => String(row[0] ?? '')), datasets };
  }
  function open(definition) {
    const workbook = getWorkbook();
    if (!workbook) return;
    editingSheet = workbook.getActiveSheet();
    editingId = definition?.id;
    rangeInput.value = definition?.range ?? editingSheet.getActiveRange()?.getA1Notation() ?? 'A1:B5';
    titleInput.value = definition?.title ?? 'Chart';
    typeInput.value = definition?.type ?? 'bar';
    document.getElementById('chart-width').value = definition?.width ?? 440;
    document.getElementById('chart-height').value = definition?.height ?? 300;
    document.getElementById('chart-legend').checked = definition?.legend ?? true;
    document.getElementById('chart-format').value = definition?.format ?? 'number';
    document.getElementById('chart-currency').value = definition?.currency ?? 'USD';
    error.textContent = '';
    dialog.showModal();
  }
  const button = document.getElementById('chart');
  button.appendChild(createElement(ChartColumn, { width: 16, height: 16 }));
  button.addEventListener('click', () => open());
  document.getElementById('chart-cancel').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      if (getWorkbook()?.getActiveSheet().getSheetId() !== editingSheet.getSheetId()) throw new Error('The worksheet changed. Reopen this dialog.');
      const existing = records(editingSheet);
      if (!editingId && existing.length >= 12) throw new Error('Up to 12 charts per worksheet.');
      const definition = { ...(existing.find(item => item.id === editingId) ?? { id: crypto.randomUUID(), x: 24, y: 130 }),
        title: titleInput.value.trim() || 'Chart', type: typeInput.value, range: rangeInput.value.trim(),
        width: Number(document.getElementById('chart-width').value), height: Number(document.getElementById('chart-height').value),
        legend: document.getElementById('chart-legend').checked,
        format: document.getElementById('chart-format').value, currency: document.getElementById('chart-currency').value };
      chartData(editingSheet, definition);
      dialog.close();
      store(editingSheet, [...existing.filter(item => item.id !== definition.id), definition]);
    } catch (failure) { error.textContent = failure.message; }
  });
  function render() {
    const workbook = getWorkbook();
    if (!workbook) return;
    const sheet = workbook.getActiveSheet();
    const charts = records(sheet);
    let computed;
    try {
      computed = charts.map(definition => {
        try { return { definition, data: chartData(sheet, definition) }; }
        catch (failure) { return { definition, error: failure.message }; }
      });
    } catch (failure) { setStatus(failure.message); return; }
    const next = JSON.stringify({ sheet: sheet.getSheetId(), computed });
    if (signature === next) return;
    signature = next;
    instances.splice(0).forEach(chart => chart.destroy());
    layer.replaceChildren();
    computed.forEach(item => {
      const definition = item.definition;
      const panel = document.createElement('section');
      panel.className = 'sheet-chart';
      const width = Math.min(1000, Math.max(280, definition.width ?? 440), layer.clientWidth);
      const height = Math.min(700, Math.max(200, definition.height ?? 300), layer.clientHeight);
      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
      panel.style.left = `${Math.max(0, Math.min(definition.x, layer.clientWidth - width))}px`;
      panel.style.top = `${Math.max(0, Math.min(definition.y, layer.clientHeight - height))}px`;
      const header = document.createElement('header');
      const title = document.createElement('span');
      title.textContent = definition.title;
      header.appendChild(title);
      const action = (icon, label, handler) => {
        const control = document.createElement('button');
        control.type = 'button'; control.title = label; control.setAttribute('aria-label', label);
        control.appendChild(createElement(icon, { width: 16, height: 16 }));
        control.addEventListener('click', handler); header.appendChild(control);
      };
      action(Pencil, 'Edit chart', () => open(definition));
      action(RefreshCw, 'Refresh chart', () => { signature = ''; render(); });
      action(Download, 'Export chart PNG', () => {
        const canvas = panel.querySelector('canvas');
        if (canvas) exportImage(canvas.toDataURL('image/png'), definition.title);
      });
      action(Trash2, 'Delete chart', () => store(sheet, records(sheet).filter(record => record.id !== definition.id)));
      header.addEventListener('pointerdown', event => {
        if (event.target.closest('button')) return;
        const startX = event.clientX; const startY = event.clientY;
        const originalX = parseFloat(panel.style.left); const originalY = parseFloat(panel.style.top);
        header.setPointerCapture(event.pointerId);
        const move = position => {
          panel.style.left = `${Math.max(0, Math.min(originalX + position.clientX - startX, layer.clientWidth - panel.offsetWidth))}px`;
          panel.style.top = `${Math.max(0, Math.min(originalY + position.clientY - startY, layer.clientHeight - panel.offsetHeight))}px`;
        };
        const finish = () => {
          header.removeEventListener('pointermove', move); header.removeEventListener('pointerup', finish); header.removeEventListener('pointercancel', finish);
          store(sheet, records(sheet).map(record => record.id === definition.id ? { ...record, x: parseFloat(panel.style.left), y: parseFloat(panel.style.top) } : record));
        };
        header.addEventListener('pointermove', move); header.addEventListener('pointerup', finish); header.addEventListener('pointercancel', finish);
      });
      panel.appendChild(header);
      const body = document.createElement('div'); body.className = 'sheet-chart-body'; panel.appendChild(body);
      layer.appendChild(panel);
      if (item.error) { body.textContent = item.error; return; }
      const canvas = document.createElement('canvas');
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${definition.title}: ${definition.range}`);
      body.appendChild(canvas);
      const configuration = chartOptions(definition, item.data.datasets.length);
      configuration.options.plugins.legend.labels = { color: getComputedStyle(document.body).color };
      instances.push(new Chart(canvas, { ...configuration, data: item.data }));
    });
  }
  const resize = new ResizeObserver(() => { signature = ''; render(); });
  resize.observe(layer);
  window.addEventListener('pagehide', () => { resize.disconnect(); instances.forEach(chart => chart.destroy()); });
  return render;
}