const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Handle console messages
  page.on('console', msg => {
    // console.log(`BROWSER CONSOLE: ${msg.text()}`);
  });

  await page.goto('http://localhost:3001');

  // Inject some JSON for the import function
  const mockQueries = Array.from({ length: 50 }, (_, i) => ({
    name: `Song ${i + 1}`,
    artist: `Artist ${i + 1}`
  }));

  await page.evaluate((queries) => {
    document.getElementById('import-json-input').value = JSON.stringify(queries);
    // Open the modal and set correct state
    document.getElementById('import-modal').classList.remove('hidden');
    document.querySelector('.import-tab[data-tab="json"]').click();
  }, mockQueries);

  // Expose a performance.now() to measure the start and end
  await page.evaluate(() => {
    window.benchmarkStart = performance.now();
  });

  // Find the import button and click it
  await page.evaluate(() => {
    const startBtn = document.getElementById('import-start-btn');
    if(startBtn) {
       startBtn.click();
    }
  });

  console.log("Waiting for import to finish...");

  // Wait for it to finish. runImport changes text content to Done ...
  try {
    await page.waitForFunction(() => {
        const text = document.getElementById('import-progress-text')?.textContent || '';
        return text.startsWith('Done');
    }, { timeout: 60000 }); // Increase timeout to 60s
  } catch (e) {
      console.log('Timeout or error waiting for import to finish');
  }

  const duration = await page.evaluate(() => {
    return performance.now() - window.benchmarkStart;
  });

  console.log(`Benchmark completed in ${duration} ms`);

  await browser.close();
})();
