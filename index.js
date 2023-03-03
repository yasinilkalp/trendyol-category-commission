require('dotenv').config();
const playwright = require('playwright');
const Redis = require("ioredis");

(async () => {
    const browser = await playwright.chromium.launch({
        headless: false
    });
    const page = await browser.newPage();

    let redisConfig = {
        uName: process.env.REDIS_USERNAME,
        pwd: process.env.REDIS_PASSWORD,
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
    let client = new Redis(`rediss://${redisConfig.uName}:${redisConfig.pwd}@${redisConfig.host}:${redisConfig.port}/0`);

    await onLogin(page);

    await page.goto("https://partner.trendyol.com/incentive");

    await page.selectOption("div.change-size select", "50");

    await delay(1000);

    var dataControl = true;
    var tableData = [];
    while (dataControl) {
        await readTable(page, tableData);
        dataControl = await nextPage(page);
    }

    client.set("categories", JSON.stringify(tableData));

    await browser.close();

})();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const onLogin = async (page) => {
    await page.goto('https://partner.trendyol.com/account/login');

    let emailInput = page.locator("div.email-phone input");
    await emailInput.fill(process.env.TRENDYOL_USERNAME);

    let pwdInput = page.locator("div.password input");
    await pwdInput.fill(process.env.TRENDYOL_PASSWORD);

    let loginBtn = page.locator("button[type=submit]");
    await loginBtn.click();

    await delay(5000);
};

const readTable = async (page, tableData) => {
    let rowCount = await page.locator('div.g-table table tbody').locator('tr').count();
    for (let i = 0; i < rowCount; i++) {
        let td = await page.locator('div.g-table table tbody').locator('tr').nth(i).locator('td');
        tableData.push({
            mainCategory: await td.nth(0).innerText(),
            subCategory: await td.nth(1).innerText(),
            commission: await (await td.nth(2).innerText()).replace('% ', ''),
        });
    }
};

const nextPage = async (page) => {
    let currentPage = await page.locator('div.pagination').locator('div.g-button-group').locator('button.-secondary').innerText();
    const nextButton = await page.getByRole('button', { name: (parseInt(currentPage) + 1).toString() });

    try {
        await nextButton.click();
        await delay(100);
        return true;
    } catch (error) {
        `enter code here`
        return false;
    }
};