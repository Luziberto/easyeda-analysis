import { test, expect } from '@playwright/test';

test('carrega o editor e insere LED', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#canvas')).toBeVisible();
  await page.locator('[data-add=led]').click();
  await expect(page.locator('.sym')).toHaveCount(1);
  await expect(page.locator('#status')).toContainText('1 símbolos');
});

test('modo fio: botão ativa e desativa com Escape', async ({ page }) => {
  await page.goto('/index.html');
  const wire = page.locator('#wireBtn');
  await wire.click();
  await expect(wire).toHaveClass(/on/);
  await page.keyboard.press('Escape');
  await expect(wire).not.toHaveClass(/on/);
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
