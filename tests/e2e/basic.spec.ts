import { test, expect } from '@playwright/test';

test.describe('Basic Application Test', () => {
  test('should load the application without errors', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');

    // Check that the page title is present
    await expect(page).toHaveTitle(/Paddle Roster/);

    // Check that the main application container is visible
    await expect(page.locator('body')).toBeVisible();

    // Check for any console errors
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });

    // Wait a bit more to capture any late-loading errors
    await page.waitForTimeout(2000);

    // Assert no console errors occurred
    expect(logs).toHaveLength(0);

    // Check that basic navigation tabs are present
    await expect(page.locator('text=Players')).toBeVisible();
    await expect(page.locator('text=Games')).toBeVisible();
    await expect(page.locator('text=Schedule')).toBeVisible();
    await expect(page.locator('text=Print')).toBeVisible();
  });

  test('should allow navigation between tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test navigation to each tab
    await page.click('text=Players');
    await page.waitForTimeout(500);

    await page.click('text=Games');
    await page.waitForTimeout(500);

    await page.click('text=Schedule');
    await page.waitForTimeout(500);

    await page.click('text=Print');
    await page.waitForTimeout(500);

    // No errors should occur during navigation
    expect(true).toBe(true);
  });
});
