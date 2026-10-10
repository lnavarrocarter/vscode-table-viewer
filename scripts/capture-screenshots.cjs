const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

async function capture() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const output = name => path.join(__dirname, '../media', name);
    await page.goto('http://127.0.0.1:39431/table');
    await page.locator('tbody tr').first().waitFor();
    await page.locator('#column-filter').selectOption('2');
    await page.locator('#column-value').fill('Norte');
    await page.locator('#aggregate-column').selectOption('5');
    await page.locator('#aggregate-operation').selectOption('SUM');
    if (await page.locator('#aggregate-result').textContent() !== 'SUM: 19 (8 numeric, 0 ignored)') {
      throw new Error('The fictional sales fixture changed; review the screenshot recipe.');
    }
    await page.screenshot({ path: output('table-filters.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: output('table-filters-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:39431/');
    await page.getByRole('tab', { name: 'Formulas', exact: true }).waitFor();
    await page.evaluate(() => {
      const data = structuredClone(window.__saved);
      data.name = 'Regional sales summary';
      const sheet = data.sheets[data.sheetOrder[0]];
      sheet.name = 'Regional summary';
      sheet.cellData = {
        0: { 0: { v: 'Region', t: 1 }, 1: { v: 'Units', t: 1 }, 2: { v: 'Target', t: 1 } },
        1: { 0: { v: 'Norte', t: 1 }, 1: { v: 19, t: 2 }, 2: { v: 22, t: 2 } },
        2: { 0: { v: 'Centro', t: 1 }, 1: { v: 24, t: 2 }, 2: { v: 20, t: 2 } },
        3: { 0: { v: 'Sur', t: 1 }, 1: { v: 16, t: 2 }, 2: { v: 18, t: 2 } }
      };
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'load', data, version: 2 } }));
    });
    await page.getByRole('tab', { name: 'Regional summary', exact: true }).waitFor();
    await page.locator('#chart').click();
    await page.locator('#chart-range').fill('A1:C4');
    await page.locator('#chart-title-input').fill('Units by region');
    await page.locator('#chart-type').selectOption('combo');
    await page.locator('#chart-form').evaluate(form => form.requestSubmit());
    await page.locator('.sheet-chart canvas').waitFor();
    await page.getByRole('tab', { name: 'Formulas', exact: true }).waitFor();
    const header = page.locator('.sheet-chart header');
    const bounds = await header.boundingBox();
    await page.mouse.move(bounds.x + 80, bounds.y + 15);
    await page.mouse.down();
    await page.mouse.move(650, 330, { steps: 12 });
    await page.mouse.up();
    const nonblank = await page.locator('.sheet-chart canvas').evaluate(canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return pixels.some((value, index) => index % 4 === 3 && value > 0);
    });
    if (!nonblank) throw new Error('Chart canvas is blank.');
    await page.screenshot({ path: output('spreadsheet-charts.png') });
    console.log('Saved three preview screenshots with fictional data.');
  } finally {
    await browser.close();
  }
}

capture().catch(error => { console.error(error); process.exitCode = 1; });