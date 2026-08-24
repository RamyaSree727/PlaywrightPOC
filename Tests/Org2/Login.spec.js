import { test, expect } from '@playwright/test';
import AllureReporter, { allure } from "allure-playwright";
import { LoginPage } from '../../Pages/LoginPage';
let context;
let page;

test.describe.configure({mode: 'parallel'})

test.beforeAll(async ({ browser, baseURL }) => {
    context = await browser.newContext();
    page = await context.newPage();
    //const url = test.info().project.use.baseURL;
    await page.goto(baseURL);
});


test.afterAll(async () => {
    const screenshot = await page.screenshot();
    await test.info().attach('Final Result', {
        body: screenshot,
        contentType: 'image/png'
    });

    await page.close();
    await context.close();
});


test('Functional validation @p0 @smoke', async () => {

    const loginSteps = new LoginPage(page);
    await loginSteps.navigateToUrlAndEnterDetails();
    await page.waitForTimeout(5000);
    const screenshot = await page.screenshot();
    await test.info().attach('Result', {
        body: screenshot,
        contentType: 'image/png'
    });
});

test('Test Actions @p0 @smoke', async () => {
    //page1 = await context.newPage();
    const loginSteps = new LoginPage(page);
    await loginSteps.navigateToUrlAndEnterDetails();
    await loginSteps.performActions();
    await page.waitForTimeout(5000);
    await loginSteps.allureScreenshot();

});

test('validate makemytrip', async () => {
    const loginSteps = new LoginPage(page);
    await loginSteps.makemytrip();
    await loginSteps.chooseDate();
    await page.waitForTimeout(5000);
    await loginSteps.allureScreenshot();
});


