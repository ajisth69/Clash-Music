const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3001');

  // Inject some JSON for the import function
  const mockQueries = Array.from({ length: 50 }, (_, i) => ({
    name: `Song ${i + 1}`,
    artist: `Artist ${i + 1}`
  }));

  await page.evaluate((queries) => {
    // Make sure we have the elements needed, open import modal
    const importModal = document.getElementById('import-modal');
    if (!importModal) {
      document.body.innerHTML += `
        <div id="import-modal" class="hidden">
          <textarea id="import-json-input"></textarea>
          <div class="import-tab active" data-tab="json"></div>
          <button id="import-start-btn"></button>
          <div id="import-progress"></div>
          <div id="import-progress-fill"></div>
          <div id="import-progress-text"></div>
          <input id="import-name-input" value="Test Playlist" />
        </div>
      `;
    }

    document.getElementById('import-json-input').value = JSON.stringify(queries);
  }, mockQueries);

  // Expose a performance.now() to measure the start and end

  await page.evaluate(() => {
    window.benchmarkStart = performance.now();
  });

  // We need to trigger the runImport somehow
  await page.evaluate(() => {
    // Assuming runImport is global or accessible
    // It's defined as an async function runImport() in ui.js
    if (typeof runImport === 'function') {
      runImport().then(() => {
        window.benchmarkEnd = performance.now();
      });
    } else {
        // Find the import button or any element that triggers it
        const startBtn = document.getElementById('import-start-btn');
        if(startBtn) {
           startBtn.click();
        }
    }
  });

  // Wait for it to finish. runImport changes text content to Done ...
  try {
    await page.waitForFunction(() => {
        const text = document.getElementById('import-progress-text')?.textContent || '';
        return text.startsWith('Done') || document.getElementById('import-start-btn')?.disabled === false;
    }, { timeout: 30000 });
  } catch (e) {
      console.log('Timeout or error waiting for import to finish');
  }

  const duration = await page.evaluate(() => {
    if (window.benchmarkEnd && window.benchmarkStart) {
        return window.benchmarkEnd - window.benchmarkStart;
    }
    return -1;
  });

  console.log(`Benchmark completed in ${duration} ms`);

  await browser.close();
})();
