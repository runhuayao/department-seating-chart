
import { test } from '@playwright/test';
import { expect } from '@playwright/test';

test('FigmaIntegrationTest_2025-09-30', async ({ page, context }) => {
  
    // Navigate to URL
    await page.goto('http://localhost:5173');

    // Take screenshot
    await page.screenshot({ path: 'homepage-initial-load.png', { fullPage: true } });

    // Click element
    await page.click('button:has-text("网格")');

    // Click element
    await page.click('button[title*="网格"], button:has([data-testid*="grid"])');

    // Click element
    await page.click('button:has-text("查看详情")');

    // Take screenshot
    await page.screenshot({ path: 'department-detail-page.png', { fullPage: true } });

    // Click element
    await page.click('button:has-text("Figma编辑")');

    // Click element
    await page.click('button:has-text("返回总览")');

    // Take screenshot
    await page.screenshot({ path: 'back-to-overview.png', { fullPage: true } });
});