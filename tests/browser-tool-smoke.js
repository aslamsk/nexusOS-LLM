const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.BROWSER_HEADLESS = process.env.BROWSER_HEADLESS || 'true';

const BrowserTool = require('../tools/browser');

async function main() {
    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Browser Tool Smoke</title>
</head>
<body>
  <h1>Quiz Smoke</h1>
  <p id="question">What is 2 + 2?</p>
  <button id="answer-four" onclick="document.body.setAttribute('data-clicked','yes')">4</button>
</body>
</html>`;

    const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    const screenshotPath = path.join(__dirname, 'tmp-browser-smoke.png');

    try {
        const openResult = await BrowserTool.executeAction({ action: 'open', url });
        assert.match(String(openResult), /Successfully opened/);

        const markdown = await BrowserTool.executeAction({ action: 'getMarkdown' });
        assert.match(String(markdown), /Quiz Smoke/);
        assert.match(String(markdown), /What is 2 \+ 2\?/);

        const active = await BrowserTool.executeAction({ action: 'extractActiveElements' });
        assert.match(String(active), /answer-four|4/);

        const clickResult = await BrowserTool.executeAction({ action: 'clickText', text: '4' });
        assert.match(String(clickResult), /Successfully clicked/);

        const clickedState = await BrowserTool.page.evaluate(() => document.body.getAttribute('data-clicked'));
        assert.equal(clickedState, 'yes');

        const screenshotResult = await BrowserTool.executeAction({ action: 'screenshot', savePath: screenshotPath });
        assert.match(String(screenshotResult), /Saved screenshot/);
        assert.equal(fs.existsSync(screenshotPath), true);

        console.log('PASS browser tool smoke');
    } finally {
        await BrowserTool.close().catch(() => {});
        fs.rmSync(screenshotPath, { force: true });
    }
}

main().catch((error) => {
    console.error('FAIL browser tool smoke');
    console.error(error);
    process.exit(1);
});
