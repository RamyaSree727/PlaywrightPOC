import AllureReporter from 'allure-playwright';
import Data from '../TestData/Data.json';
import { test, expect } from '@playwright/test';
const loginLocators = require('../ObjectRepo/LoginOR');

export class LoginPage {
    constructor(page) {
        this.page = page;
    }

    async allureScreenshot() {
        const screenshot = await this.page.screenshot();
        await test.info().attach('Result', {
            body: screenshot,
            contentType: 'image/png'
        });
    }
    async navigateToUrlAndEnterDetails() {
        await this.page.fill(loginLocators.usernameTextBox, Data.username);
        await this.page.fill(loginLocators.passwordTextBox, Data.password);
        await this.page.click(loginLocators.submitButton);
    }

    async performActions() {
        await this.page.click(loginLocators.homeTab);

    }
    //---------------------------------------------------------------------------------------

    async makemytrip() {
        //await this.page.waitForTimeout(5000);
        // await this.page.click(loginLocators.botCloseButton);
        await this.page.waitForTimeout(5000);
        await this.page.click(loginLocators.closeButton);
        await this.page.waitForTimeout(5000);

        await this.page.click(loginLocators.selectTrain);
        await this.page.waitForTimeout(5000);
        await this.page.click(loginLocators.selectBookTrainTickets);
        await this.page.waitForTimeout(5000);
        await this.page.click(loginLocators.fromCity);
        await this.page.fill(loginLocators.enterFromCity, Data.fromCity);
        await this.page.waitForTimeout(5000);
        await this.page.click(loginLocators.fromCitySuggestion);
        await this.page.click(loginLocators.fromCity);
        await this.page.waitForTimeout(5000);
        await this.page.click(loginLocators.toCity);
        await this.page.fill(loginLocators.enterToCity, Data.toCity);
        await this.page.waitForTimeout(5000);
        await this.page.click(loginLocators.toCitySuggestion);
        await this.page.click(loginLocators.searchButton);

    }

    async chooseDate() {
        await this.page.waitForTimeout(5000);
        await this.page.click(loginLocators.travelDateText);

        const text = await this.page.locator(loginLocators.dateText).textContent();
        await test.step(text, async () => { });
        const now = new Date();
        const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        await test.step("monthYear:" + monthYear, async () => { });
        if (text === Data.travelDate) {
            console.log("Test passed");
        } else {
            console.log("Test failed");
        }

    }

}
