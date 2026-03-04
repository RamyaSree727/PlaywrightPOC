import { test, expect, BrowserContext, Page } from '@playwright/test';
import { allure } from 'allure-playwright';
import { LoginPage } from '../Pages/LoginPage';

test.describe('User lifecycle (dependent)', () => {
  test.describe.configure({ mode: 'serial' });

  let context;
  let page;

  test.beforeAll(async ({ browser, baseURL }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(baseURL);
  });

  test.afterAll(async () => {
    await page?.close();
    await context?.close();
  });

  test('A. Create user @smoke @p0', async () => {
    const loginSteps = new LoginPage(page);
    await loginSteps.navigateToUrlAndEnterDetails();
    await test.info().attach('Result', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('B. Update user (depends on A) @smoke @p0', async () => {
    const loginSteps = new LoginPage(page);
    await loginSteps.performActions();
    await loginSteps.allureScreenshot?.();
  });
});
``