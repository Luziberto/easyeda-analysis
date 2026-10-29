import { test, expect } from '@playwright/test';

test('carrega o editor e insere LED', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#canvas')).toBeVisible();
  await page.locator('[data-add=led]').click();
  await expect(page.locator('.sym')).toHaveCount(1);
  await expect(page.locator('#status')).toContainText('símbolos');
});

test('modo PCB: sync a partir do esquemático', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('[data-add=resistor]').click();
  await page.locator('#modePcb').click();
  await page.locator('#pcbSync').click();
  await expect(page.locator('#pcbStatus')).toContainText(/fp|footprint/i, { timeout: 5000 });
});

test('modo PCB: DRC sem erros num board vazio sincronizado', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('[data-add=resistor]').click();
  await page.locator('#modePcb').click();
  await page.locator('#pcbSync').click();
  await page.locator('#pcbDrc').click();
  await expect(page.locator('#pcbDrcOut')).toContainText(/DRC|sem rede|nenhum/i, { timeout: 5000 });
});

test('segunda folha e export SVG', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#sheetTabs .add').click();
  await expect(page.locator('#sheetTabs .sheet-tab')).toHaveCount(3);
  await page.locator('[data-add=resistor]').click();
  await page.locator('.export-menu summary').click();
  await page.locator('#exportSvg').click();
  await expect(page.locator('#status')).toContainText('2 folha');
});

test('modo fio: botão ativa e desativa com Escape', async ({ page }) => {
  await page.goto('/index.html');
  const wire = page.locator('#wireBtn');
  await wire.click();
  await expect(wire).toHaveClass(/\bon\b/);
  await page.keyboard.press('Escape');
  await expect(wire).not.toHaveClass(/\bon\b/);
});

test('netlist abre painel lateral', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#netlistBtn').click();
  await expect(page.locator('#panel-netlist')).toHaveClass(/active/);
  await expect(page.locator('#out')).toContainText(/Sem avisos|AVISOS/);
});

test('import EasyEDA sintético', async ({ page }) => {
  await page.goto('/index.html');
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('#importStdBtn').click(),
  ]);
  await fileChooser.setFiles('../examples/synthetic-schematic.json');
  await expect(page.locator('#warnings')).toContainText(/Importado/i, { timeout: 5000 });
  await expect(page.locator('.sym')).not.toHaveCount(0);
});

test('Sim SPICE ngspice wasm no browser', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/index.html');
  const summary = await page.evaluate(async () => {
    const { runSpiceOperatingPoint, formatSpiceOpSummary } = await import('./dist/sim/spice-runner.js');
    const r = await runSpiceOperatingPoint('V1 1 0 10\nR1 1 2 1k\nR2 2 0 1k\n.op\n.end\n');
    return formatSpiceOpSummary(r);
  });
  expect(summary).toMatch(/ngspice-wasm/);
  expect(summary).toMatch(/2:/);
});
