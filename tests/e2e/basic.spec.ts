import { expect, test } from '@playwright/test';

test.describe('Basic Application Test', () => {
  test('should load the application without errors', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/Paddle Roster/);
    await expect(page.getByText('Welcome back!', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Enter your email' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true }).last()).toBeVisible();
    expect(logs).toHaveLength(0);
  });

  test('should switch between sign-in and sign-up', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
    await expect(page.getByText('Create your new account', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Sign In', exact: true }).first().click();
    await expect(page.getByText('Welcome back!', { exact: true })).toBeVisible();
  });
});
