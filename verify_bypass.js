const browserTool = require('./tools/browser');

async function test() {
    const url = 'https://mkfashion.in';
    console.log(`Attempting to open ${url} via BrowserTool...`);

    try {
        const result = await browserTool.executeAction({
            action: 'open',
            url: url
        });
        console.log("Result:", result);

        if (result.includes('Bypass active')) {
            console.log("SUCCESS: Automated bypass triggered correctly!");
        } else {
            console.log("Verification failed: Bypass was NOT triggered.");
        }
    } catch (err) {
        console.error("Test failed with error:", err);
    } finally {
        await browserTool.close();
    }
}

test();
