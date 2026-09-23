import { test, expect } from '@playwright/test';

test.describe('Sales Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as cashier
    await page.goto('/login');
    await page.fill('input[name="username"]', 'cashier');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/pos');
  });

  test('should create a new sale', async ({ page }) => {
    // Navigate to POS
    await page.goto('/pos');

    // Add product to cart
    await page.click('[data-testid="product-search"]');
    await page.fill('[data-testid="product-search"]', 'PROD001');
    await page.press('[data-testid="product-search"]', 'Enter');

    // Verify product added
    await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1);

    // Complete sale
    await page.click('[data-testid="checkout-button"]');
    await page.click('[data-testid="payment-method-cash"]');
    await page.fill('[data-testid="cash-amount"]', '100.00');
    await page.click('[data-testid="complete-sale"]');

    // Verify success
    await expect(page.locator('[data-testid="sale-success"]')).toBeVisible();
  });

  test('should void a sale on same day', async ({ page }) => {
    // Create sale first
    await page.goto('/pos');
    await page.click('[data-testid="product-search"]');
    await page.fill('[data-testid="product-search"]', 'PROD001');
    await page.press('[data-testid="product-search"]', 'Enter');
    await page.click('[data-testid="checkout-button"]');
    await page.click('[data-testid="payment-method-cash"]');
    await page.fill('[data-testid="cash-amount"]', '100.00');
    await page.click('[data-testid="complete-sale"]');

    // Get sale ID from success message
    const saleId = await page.locator('[data-testid="sale-id"]').textContent();

    // Navigate to sales history
    await page.goto('/sales');
    await page.fill('[data-testid="search-input"]', saleId || '');
    await page.press('[data-testid="search-input"]', 'Enter');

    // Void the sale
    await page.click('[data-testid="void-sale-button"]');
    await page.fill('[data-testid="void-reason"]', 'Customer request');
    await page.click('[data-testid="confirm-void"]');

    // Verify voided
    await expect(page.locator('[data-testid="sale-status"]')).toHaveText('VOIDED');
  });

  test('should process a return', async ({ page }) => {
    // Navigate to returns
    await page.goto('/returns');

    // Enter sale number
    await page.fill('[data-testid="sale-number-input"]', 'SALE-001');
    await page.click('[data-testid="lookup-sale"]');

    // Select items to return
    await page.click('[data-testid="select-item-0"]');
    await page.fill('[data-testid="return-quantity-0"]', '1');
    await page.fill('[data-testid="return-reason"]', 'Defective product');

    // Process return
    await page.click('[data-testid="process-return"]');

    // Verify success
    await expect(page.locator('[data-testid="return-success"]')).toBeVisible();
  });
});
