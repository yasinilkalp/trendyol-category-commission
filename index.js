require("dotenv").config();
const playwright = require("playwright");
const Redis = require("ioredis");
const express = require("express");
var cors = require("cors");

const app = express();
app.use(cors());

const connectRedis = () => {
  let redisConfig = {
    uName: process.env.UPSTASH_REDIS_USERNAME,
    pwd: process.env.UPSTASH_REDIS_PASSWORD,
    host: process.env.UPSTASH_REDIS_HOST,
    port: process.env.UPSTASH_REDIS_PORT,
  };
  let client = new Redis(
    `rediss://${redisConfig.uName}:${redisConfig.pwd}@${redisConfig.host}:${redisConfig.port}/0`
  );
  return client;
};

const run = async () => {
  const browser = await playwright.chromium.launch({
    headless: false,
  });
  const page = await browser.newPage();

  var isLogin = false;
  let tryLoginCount = 0;
  while (!isLogin) {
    console.log("------------ Login olmaya çalışıyoruz.");
    await onLogin(page);

    let url = await page.url();
    console.log("------------ Girdik mi?", url);
    isLogin = url == "https://partner.trendyol.com/dashboard";
    tryLoginCount++;
    if (tryLoginCount === 4) return;
  }
  console.log("------------ Login olduk devam ediyoruz.");

  await page.goto("https://partner.trendyol.com/incentive");

  console.log("------------ Sayfalama 50lik datalara çekiyoruz..");
  await page.selectOption("div.change-size select", "50");

  await delay(1000);

  var dataControl = true;
  var tableData = [];
  while (dataControl) {
    await readTable(page, tableData);
    dataControl = await nextPage(page);
  }

  console.log("------------ Verileri aldık. Redise kaydediyoruz.");

  let client = connectRedis();
  client.del("categories");
  client.set("categories", JSON.stringify(tableData));

  await page.close();
  await browser.close();
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const onLogin = async (page) => {
  await page.goto("https://partner.trendyol.com/account/login", {
    waitUntil: "domcontentloaded",
  });

  console.log("------------ E-posta adresini giriyoruz.");
  let emailInput = page.locator("div.email-phone input");
  await emailInput.fill(process.env.TRENDYOL_USERNAME);

  console.log("------------ Şifreyi giriyoruz.");
  let pwdInput = page.locator("div.password input");
  await pwdInput.fill(process.env.TRENDYOL_PASSWORD);

  console.log("------------ Giriş butonuna bastık.");
  let loginBtn = page.locator("button[type=submit]");
  await loginBtn.click();

  await delay(5000);
};

const readTable = async (page, tableData) => {
  let rowCount = await page
    .locator("div.g-table table tbody")
    .locator("tr")
    .count();
  for (let i = 0; i < rowCount; i++) {
    let td = await page
      .locator("div.g-table table tbody")
      .locator("tr")
      .nth(i)
      .locator("td");
    tableData.push({
      mainCategory: await td.nth(0).innerText(),
      subCategory: await td.nth(1).innerText(),
      commission: await (await td.nth(2).innerText()).replace("% ", ""),
    });
    console.log(`------------ ${i + 1}.Sayfadan Verileri getirdik.`);
  }
};

const nextPage = async (page) => {
  let currentPage = await page
    .locator("div.pagination")
    .locator("div.g-button-group")
    .locator("button.-secondary")
    .innerText();
  const nextButton = await page.getByRole("button", {
    name: (parseInt(currentPage) + 1).toString(),
  });

  try {
    await nextButton.click();
    await delay(100);
    return true;
  } catch (error) {
    `enter code here`;
    return false;
  }
};

app.get("/", async (req, res, next) => {
  let client = connectRedis();
  let categories = await client.get("categories");
  let data = JSON.parse(categories);
  let grouped = groupBy(data, "mainCategory");

  res.json(grouped);
});

function groupBy(objectArray, property) {
  return objectArray.reduce((acc, obj) => {
    const key = obj[property];
    if (!acc[key]) {
      acc[key] = [];
    }
    // acc[key].push(obj);
    return acc;
  }, {});
}

app.get("/run", async (req, res, next) => {
  run();
  res.json("başladı");
});

const port = process.env.PORT || 3000;

app.listen(port, () =>
  console.log(`Server running on ${port}, http://localhost:${port}`)
);
