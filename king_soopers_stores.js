const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const zipCodesAdapter = new FileSync('zip_codes.json');
const zipCodesDb = low(zipCodesAdapter);
const zipCodes = zipCodesDb.get('zipCodes').value();

const adapter = new FileSync('king_soopers_stores.json');
const db = low(adapter);
db.defaults({ stores: [], zipCodesLastProcessed: {} }).write();
const stores = db.get('stores');
const zipCodesLastProcessed = db.get('zipCodesLastProcessed');

const puppeteer = require('puppeteer-extra');

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: false, devtools: true });
  const page = await browser.newPage();
  await page.goto('https://www.kingsoopers.com/rx/guest/get-vaccinated', { waitUntil: 'networkidle0' });

  page.on('response', async (response) => {
    console.log('XHR response received: ', response.url());
    if (response.url().includes('/rx/api/anonymous/stores')) {
      const data = await response.json();
      const zipCode = response.url().match(/address=([^&]+)/)[1];

      if (data) {
        for(const store of data) {
          console.log(`Processing ${zipCode}, store ${store.facilityId}`);
          delete store.distance;
          stores.push(store).write();
        }

        db.set('stores', db.get('stores').uniqBy('facilityId').sortBy('facilityId').value()).write();
        db.set(`zipCodesLastProcessed.${zipCode}`, (new Date()).toISOString()).write();
      } else {
        // process.exit();
      }
    }
  });

  for (const zipCode of zipCodes) {
    const lastProcessed = db.get(`zipCodesLastProcessed.${zipCode}`).value();
    if (lastProcessed) {
      console.log(`Skipping ${zipCode}`);
    } else {
      console.log(`Processing ${zipCode}`);
      await page.$eval('h1', el => el.click());
      await page.$eval('[name=findAStore]', el => el.click());
      await page.$eval('[name=findAStore]', el => el.value = '');
      await page.type('[name=findAStore]', zipCode);
      /*
      await page.focus('[name=findAStore]');
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.keyboard.type(zipCode);
      */
      await page.keyboard.press('Enter');
      /*
      await page.goto(`https://www.kingsoopers.com/rx/api/anonymous/stores?address=${zipCode}`, { waitUntil: 'networkidle0' });
      const data = await page.evaluate(() => {
        return JSON.parse(document.querySelector('body').innerText);
      });

      for(const store of data) {
        console.log(`Processing ${zipCode}, store ${store.facilityId}`);
        delete store.distance;
        stores.push(store).write();
      }

      db.set('stores', db.get('stores').uniq().sortBy('facilityId').value()).write();
      db.set(`zipCodesLastProcessed.${zipCode}`, (new Date()).toISOString()).write();
      */

      //await page.waitForNavigation({ waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  await browser.close();
})();

/*
const Apify = require('apify');

Apify.main(async () => {
  const requestQueue = await Apify.openRequestQueue();
  await requestQueue.addRequest({ url: 'https://www.kingsoopers.com/rx/guest/get-vaccinated' });

  const handlePageFunction = async ({ request, page }) => {
    console.log(request.url);
    console.log(request);
    console.log(page);
    await requestQueue.addRequest({ url: 'https://www.kingsoopers.com/rx/api/anonymous/stores?address=80212' });
    /*
    // Add all links from page to RequestQueue
    await Apify.utils.enqueueLinks({
      page,
      requestQueue,
    });
  };

  // Create a PuppeteerCrawler
  const crawler = new Apify.PuppeteerCrawler({
    requestQueue,
    handlePageFunction,
    maxRequestsPerCrawl: 10, // Limitation for only 10 requests (do not use if you want to crawl all links)
  });

  // Run the crawler
  await crawler.run();
});
*/
