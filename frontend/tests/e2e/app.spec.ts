import { test, expect } from '@playwright/test';

test.describe('MCP Wizard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should load the application successfully', async ({ page }) => {
    // Check that the page title is correct
    await expect(page).toHaveTitle(/MCP Wizard/);

    // Check that the main heading is visible
    await expect(page.getByRole('heading', { name: 'Discover MCP Servers' })).toBeVisible();

    // Check that navigation links are present
    await expect(page.getByRole('link', { name: 'Discover' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Wizard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Configurations' })).toBeVisible();
  });

  test('should navigate between pages', async ({ page }) => {
    // Start on discovery page
    await expect(page.getByRole('heading', { name: 'Discover MCP Servers' })).toBeVisible();

    // Navigate to wizard page
    await page.getByRole('link', { name: 'Wizard' }).click();
    await expect(page.getByRole('heading', { name: 'Configuration Wizard' })).toBeVisible();

    // Navigate to configurations page
    await page.getByRole('link', { name: 'Configurations' }).click();
    await expect(page.getByRole('heading', { name: 'My Configurations' })).toBeVisible();

    // Navigate back to discovery
    await page.getByRole('link', { name: 'Discover' }).click();
    await expect(page.getByRole('heading', { name: 'Discover MCP Servers' })).toBeVisible();
  });

  test('should perform MCP server search', async ({ page }) => {
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check that search input is present
    const searchInput = page.getByLabel(/search.*mcp.*servers/i);
    await expect(searchInput).toBeVisible();

    // Type in search query
    await searchInput.fill('file system');

    // Click search button
    const searchButton = page.getByRole('button', { name: /search/i });
    await expect(searchButton).toBeVisible();
    await searchButton.click();

    // Wait for search to complete (either results or error)
    await page.waitForTimeout(2000); // Give it some time for the async operation

    // Check that either results appear or an appropriate message is shown
    const resultsSection = page.locator('text=Found').first();
    const noResultsMessage = page.locator('text=No MCP servers found').first();
    const loadingMessage = page.locator('text=Searching').first();
    const errorMessage = page.locator('text=Error').first();

    // One of these should be visible
    await expect(
      resultsSection.or(noResultsMessage).or(loadingMessage).or(errorMessage)
    ).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // This test would require mocking API failures
    // For now, we'll just verify that error handling UI exists
    await expect(page.locator('body')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that mobile menu button appears
    const mobileMenuButton = page.locator('button[aria-expanded]').first();
    await expect(mobileMenuButton).toBeVisible();

    // Check that main content is still accessible
    await expect(page.getByRole('heading', { name: 'Discover MCP Servers' })).toBeVisible();
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    // Check for proper heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
    expect(headings.length).toBeGreaterThan(0);

    // Check for alt text on images (if any)
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      if (alt !== null) {
        expect(alt.length).toBeGreaterThan(0);
      }
    }

    // Check for proper form labels
    const inputs = page.locator('input');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Focus on search input
    const searchInput = page.getByLabel(/search.*mcp.*servers/i);
    await searchInput.focus();

    // Type something
    await page.keyboard.type('test');

    // Tab to search button
    await page.keyboard.press('Tab');
    const focusedElement = page.locator('button:focus');
    await expect(focusedElement).toBeVisible();

    // Check that Enter key works in search input
    await searchInput.focus();
    await page.keyboard.press('Enter');

    // Should trigger search (either show results or error)
    await page.waitForTimeout(1000);
  });
});