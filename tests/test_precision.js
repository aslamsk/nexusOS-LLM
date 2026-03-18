const FileSystemTool = require('../tools/fileSystem');
const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'dummy.txt');
const initialContent = `Line 1
Line 2
Line 3
Line 4
Line 5`;

async function runTests() {
    console.log("--- Starting Precision Edit Tests ---");

    // 1. Setup
    fs.writeFileSync(testFile, initialContent, 'utf8');

    // 2. Test replaceFileContent
    console.log("Test 1: replaceFileContent (Single Line)");
    const res1 = FileSystemTool.replaceFileContent(testFile, 2, 2, "Line 2", "Line 2 - Modified");
    console.log(res1);

    const content1 = fs.readFileSync(testFile, 'utf8');
    if (content1.includes("Line 2 - Modified") && !content1.includes("Line 2\n")) {
        console.log("✓ Success");
    } else {
        console.log("✗ Failure");
        process.exit(1);
    }

    // 3. Test multiReplaceFileContent
    console.log("\nTest 2: multiReplaceFileContent (Multiple Chunks)");
    const chunks = [
        { startLine: 1, endLine: 1, targetContent: "Line 1", replacementContent: "Line 1 - Updated" },
        { startLine: 4, endLine: 5, targetContent: "Line 4\nLine 5", replacementContent: "Line 4 & 5 - Merged" }
    ];
    const res2 = FileSystemTool.multiReplaceFileContent(testFile, chunks);
    console.log(res2);

    const content2 = fs.readFileSync(testFile, 'utf8');
    if (content2.includes("Line 1 - Updated") && content2.includes("Line 4 & 5 - Merged")) {
        console.log("✓ Success");
    } else {
        console.log("✗ Failure");
        process.exit(1);
    }

    // 4. Test Error Handling
    console.log("\nTest 3: Error on Mismatch");
    const res3 = FileSystemTool.replaceFileContent(testFile, 3, 3, "Wrong Content", "New Content");
    if (res3.startsWith("Error:")) {
        console.log("✓ Correctly caught mismatch");
    } else {
        console.log("✗ Failed to catch mismatch");
        process.exit(1);
    }

    // Cleanup
    fs.unlinkSync(testFile);
    console.log("\n--- All Tests Passed ---");
}

runTests().catch(console.error);
