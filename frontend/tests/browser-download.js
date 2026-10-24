// Called by the opt-in HTTP smoke with live frontend and a completed job.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const [base, id, expectedFile] = process.argv.slice(2);
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({acceptDownloads:true});
    const page = await context.newPage();
    await page.addInitScript(id => localStorage.setItem('ytdown_anon_downloads', JSON.stringify([id])), id);
    // Only history storage is stubbed; file delivery uses the real Next/FastAPI stack.
    const statusResponse = await context.request.get(process.env.API_URL + '/api/downloads/' + id);
    const state = await statusResponse.json();
    await page.route('**/api/downloads?*', route => route.fulfill({json:{downloads:[{
      ...state, original_url:'https://www.youtube.com/watch?v=fixture', format:'mp3',
      quality:'standard', created_at:new Date().toISOString(), user_id:null
    }]}}));
    await page.goto(base);
    const link = page.locator('a[download]').first();
    await link.waitFor({timeout:30000});
    assert.equal(await link.getAttribute('target'), null);
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    assert.equal(await download.failure(), null);
    assert.deepEqual(fs.readFileSync(await download.path()), fs.readFileSync(expectedFile));
    assert.equal(context.pages().length, 1);
    assert.equal(page.url(), base + '/');
    console.log('Browser download OK:', download.suggestedFilename());
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exit(1);});
