import { test, expect } from '@playwright/test';

test.describe('Todo App UI Workflow', () => {
  const BASE_URL = 'http://localhost:3000';

  test('full lifecycle: create, view, complete, delete', async ({ page }) => {
    await page.goto(BASE_URL);

    const todoText = 'Automated Test Task';

    // Create
    const input = page.getByPlaceholder(/add a new task|neue aufgabe/i);
    await input.fill(todoText);
    await page.keyboard.press('Enter');

    // View
    const item = page.locator('li').filter({ hasText: todoText });
    await expect(item).toBeVisible();

    // Complete
    const checkbox = item.getByRole('checkbox');
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // Delete
    const deleteBtn = item.getByRole('button', { name: /delete|löschen/i });
    await deleteBtn.click();

    // Verify removal
    await expect(page.getByText(todoText)).not.toBeVisible();
  });
});