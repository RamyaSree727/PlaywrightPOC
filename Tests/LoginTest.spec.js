
// tests/login.spec.js
const { expect } = require('@playwright/test');
const { test } = require('../Utils/testData.fixture');

test.describe('Data-driven login from Excel', () => {
  test('sanity: data loaded', async ({ testData }) => {
    expect(Array.isArray(testData)).toBeTruthy();
    expect(testData.length).toBeGreaterThan(0);
  });

  for (const rowIndex of [/* avoids empty loop if needed */]) { /* no-op */ }

  test('run login cases', async ({ page, testData }) => {
    for (const row of testData) {
      await test.step(`Login → ${row.Username} (${row.Expected})`, async () => {
        await page.goto('https://practicetestautomation.com/practice-test-login/');
        await page.getByPlaceholder('Username').fill(String(row.Username));
        await page.getByPlaceholder('Password').fill(String(row.Password));
        await page.getByRole('button', { name: 'Sign in' }).click();

        if (row.Expected === 'Success') {
          await expect(page.getByText('Welcome')).toBeVisible();
        } else {
          await expect(page.getByText('Invalid credentials')).toBeVisible();
        }
      });
    }
  });
});
``
