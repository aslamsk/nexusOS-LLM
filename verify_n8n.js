const n8nDiscover = require('./tools/n8nDiscover');

async function test() {
    console.log("Testing n8nSearch with query: 'Slack'...");
    const results = await n8nDiscover.searchWorkflows('Slack');
    console.log(`Found ${results.length} results.`);
    if (results.length > 0) {
        console.log("First result:", JSON.stringify(results[0], null, 2));
    } else {
        console.log("No results found. Checking directory structure...");
        const fs = require('fs');
        const path = require('path');
        const workflowsDir = path.join(__dirname, 'external', 'n8n-workflows', 'workflows');
        if (fs.existsSync(workflowsDir)) {
            console.log(`Workflows directory exists: ${workflowsDir}`);
        } else {
            console.log(`Workflows directory NOT found: ${workflowsDir}`);
        }
    }
}

test().catch(console.error);
