import { test, expect } from '@playwright/test';

test.describe('Inventory Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as manager
    await page.goto('/login');
    await page.fill('input[name="username"]', 'manager');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create stock adjustment', async ({ page }) => {
    // Navigate to inventory
    await page.goto('/inventory');

    // Click stock adjustment button
    await page.click('[data-testid="stock-adjustment-button"]');

    // Select product
    await page.click('[data-testid="product-select"]');
    await page.click('text=PROD001');

    // Enter adjustment details
    await page.selectOption('[data-testid="adjustment-type"]', 'ADD');
    await page.fill('[data-testid="quantity"]', '10');
    await page.fill('[data-testid="unit-cost"]', '50.00');
    await page.fill('[data-testid="notes"]', 'Initial stock');

    // Submit adjustment
    await page.click('[data-testid="submit-adjustment"]');

    // Verify success
    await expect(page.locator('[data-testid="adjustment-success"]')).toBeVisible();
  });

  test('should create stock transfer', async ({ page }) => {
    // Navigate to inventory
    await page.goto('/inventory');

    // Click transfer button
    await page.click('[data-testid="stock-transfer-button"]');

    // Select source and destination
    await page.selectOption('[data-testid="source-location"]', 'WAREHOUSE-1');
    await page.selectOption('[data-testid="destination-location"]', 'BRANCH-1');

    // Add product to transfer
    await page.click('[data-testid="add-product-button"]');
    await page.fill('[data-testid="product-sku"]', 'PROD001');
    await page.fill('[data-testid="transfer-quantity"]', '5');

    // Submit transfer
    await page.click('[data-testid="submit-transfer"]');

    // Verify success
    await expect(page.locator('[data-testid="transfer-success"]')).toBeVisible();
  });

  test('should prevent negative stock', async ({ page }) => {
    // Navigate to inventory
    await page.goto('/inventory');

    // Click stock adjustment button
    await page.click('[data-testid="stock-adjustment-button"]');

    // Select product
    await page.click('[data-testid="product-select"]');
    await page.click('text=PROD001');

    // Try to remove more than available
    await page.selectOption('[data-testid="adjustment-type"]', 'REMOVE');
    await page.fill('[data-testid="quantity"]', '1000');

    // Submit adjustment
    await page.click('[data-testid="submit-adjustment"]');

    // Verify error message
    await expect(page.locator('[data-testid="insufficient-stock-error"]')).toBeVisible();
  });
});
