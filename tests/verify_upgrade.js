const fs = require('fs');
const path = require('path');
const FileSystemTool = require('../tools/fileSystem');
const TerminalTool = require('../tools/terminal');
const LLMService = require('../core/llm');
const WorktreeTool = require('../tools/worktree');

async function runVerification() {
    console.log("--- Nexus OS: Ultimate Upgrade Verification ---\n");

    const testFile = path.join(__dirname, 'verify_test.js');
    fs.writeFileSync(testFile, "console.log('Original content');\n", 'utf8');

    // 1. Test Staleness Guard
    console.log("[Test 1] Staleness Guard...");
    const llm = new LLMService();
    const readResult = JSON.parse(FileSystemTool.readFile(testFile, llm.readFileState, 1));
    
    // Simulate external edit
    fs.writeFileSync(testFile, "console.log('External edit');\n", 'utf8');
    
    const writeResult = FileSystemTool.writeFile(testFile, "console.log('Agent edit');", llm.readFileState);
    if (String(writeResult).includes('stale') || String(writeResult).includes('modified externally')) {
        console.log("✅ Success: Staleness Guard blocked out-of-sync write.");
    } else {
        console.log("❌ Failure: Staleness Guard did not block the write.");
    }

    // 2. Test runSed
    console.log("\n[Test 2] runSed (Stream Edits)...");
    fs.writeFileSync(testFile, "Hello World\nHello Mars\nHello World", 'utf8');
    llm.readFileState.clear(); // Reset for clean test
    FileSystemTool.readFile(testFile, llm.readFileState, 1);
    
    const sedResult = JSON.parse(FileSystemTool.runSed(testFile, "World", "Nexus", llm.readFileState));
    const finalContent = fs.readFileSync(testFile, 'utf8');
    if (sedResult.ok && finalContent.includes('Nexus') && !finalContent.includes('World')) {
        console.log("✅ Success: runSed applied global replacement.");
    } else {
        console.log("❌ Failure: runSed matches:", sedResult.matches);
    }

    // 3. Test Terminal Backgrounding
    console.log("\n[Test 3] Terminal Backgrounding...");
    const bgResult = JSON.parse(TerminalTool.runCommand('ping localhost -n 5', process.cwd(), true));
    if (bgResult.ok && bgResult.taskId) {
        console.log(`✅ Success: Command started in background (Task: ${bgResult.taskId})`);
        console.log("Checking status immediately...");
        const status = JSON.parse(TerminalTool.checkBackgroundTask(bgResult.taskId));
        console.log(`Status: ${status.isRunning ? 'Running' : 'Done'}`);
    } else {
        console.log("❌ Failure: Backgrounding failed.");
    }

    // 4. Test Context Compaction
    console.log("\n[Test 4] Context Compaction...");
    const dummyMessages = [
        { role: 'system', content: 'You are Nexus.' }
    ];
    for (let i = 0; i < 20; i++) {
        dummyMessages.push({ role: 'user', content: `Message ${i}: This is some long repetitive text that should be summarized to save tokens.` });
        dummyMessages.push({ role: 'assistant', content: `Response ${i}: Acknowledged. I am tracking this redundant data.` });
    }
    
    console.log(`Original Size: ${dummyMessages.length} msgs`);
    const compacted = await llm.compactContext(dummyMessages);
    console.log(`Compacted Size: ${compacted.length} msgs`);
    if (compacted.length < dummyMessages.length) {
        console.log("✅ Success: Context compaction reduced history length.");
    } else {
        console.log("❌ Failure: Compaction did not reduce size.");
    }

    console.log("\n--- Verification Complete ---");
    // Clean up
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
}

runVerification().catch(console.error);
