const browser = require('../tools/browser');
const fs = require('fs');

(async () => {
    try {
        console.log("[Test] Opening product URL...");
        await browser.executeAction({ action: 'open', url: 'https://mkfashion.in/p/qDYrf_Yn-W' });
        
        console.log("[Test] Waiting for page load...");
        await new Promise(r => setTimeout(r, 5000));
        
        console.log("[Test] Scrolling to reveal content...");
        await browser.executeAction({ action: 'scroll', direction: 'down' });
        await new Promise(r => setTimeout(r, 2000));
        
        console.log("[Test] Extracting Markdown...");
        const md = await browser.executeAction({ action: 'getMarkdown' });
        
        fs.writeFileSync('product_dump.md', md);
        console.log("[Test] Markdown saved to product_dump.md");
        
        console.log("[Test] Extracting Active Elements...");
        const elements = await browser.executeAction({ action: 'extractActiveElements' });
        fs.writeFileSync('product_elements.json', JSON.stringify(elements, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error("[Test] Error:", err.message);
        process.exit(1);
    }
})();
