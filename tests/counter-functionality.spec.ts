import { test, expect } from '@playwright/test';

const TARGET_URL = process.env.TEST_URL || 'http://localhost:3001';

test.describe('Counter UI Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TARGET_URL);
  });

  test('increment button should increase the count', async ({ page }) => {
    // Using data-testid for robust selection, falling back to text if needed
    const display = page.locator('[data-testid="count-display"], .count-display').first();
    const initialCount = parseInt(await display.innerText(), 10);

    await page.getByRole('button', { name: /increment/i }).click();

    const newCount = parseInt(await display.innerText(), 10);
    expect(newCount).toBe(initialCount + 1);
  });

  test('reset button should set the count to zero', async ({ page }) => {
    await page.getByRole('button', { name: /increment/i }).click();
    await page.getByRole('button', { name: /reset/i }).click();

    const display = page.locator('[data-testid="count-display"], .count-display').first();
    expect(await display.innerText()).toBe('0');
  });

  test('UI responsiveness check', async ({ page }) => {
    // Test Desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole('button', { name: /increment/i })).toBeInViewport();

    // Test Mobile
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(page.getByRole('button', { name: /increment/i })).toBeInViewport();
    await expect(page.getByRole('button', { name: /reset/i })).toBeInViewport();
  });
});