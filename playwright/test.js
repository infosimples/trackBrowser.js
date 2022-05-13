const fs         = require('fs');
const path       = require('path');
const playwright = require('playwright');

const logsDir = path.resolve(__dirname, `../reports/${(new Date()).toISOString()}`);
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
const logger = fs.createWriteStream(path.resolve(logsDir, 'log.jsonl'), { flags: 'w'});
console.log("Reports will be saved at:", logsDir);
console.log("Run the command bellow to have your reports analyzed:");
console.log(`ruby reports.rb ${logsDir}`);
console.log("\nHit ctrl + C to close the browser and finish logging events from the browser");

(async () => {
  const browser = await playwright.firefox.launch({headless: false});
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', function(msg) {
    if (msg.type() == 'debug') {
      const msgText = msg.text();
      if (/\"event\":/.test(msgText)) logger.write(`${msg.text()}\n`);
    }
  });

  await page.addInitScript({path: path.resolve(__dirname, '../trackbrowser.js')});

  // await browser.close();
  // logger.end();
})();
