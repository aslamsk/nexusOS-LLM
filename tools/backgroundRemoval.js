const { removeBackground } = require('@imgly/background-removal-node');
const fs = require('fs');
const path = require('path');

/**
 * Nexus OS Tool: Background Removal
 * Removes backgrounds from images using AI.
 */
class BackgroundRemovalTool {
    /**
     * Removes the background from an image.
     * @param {string} inputPath - Absolute path to the source image.
     * @param {string} outputPath - Absolute path where the processed image should be saved.
     */
    async removeBg(inputPath, outputPath) {
        try {
            console.log(`[BG Removal] Processing: ${inputPath}...`);
            
            // Read file into buffer to avoid "Unsupported protocol" errors on Windows
            const inputBuffer = fs.readFileSync(inputPath);
            
            // Generate the transparent image
            const blob = await removeBackground(inputBuffer);
            
            // Convert blob to buffer
            const buffer = Buffer.from(await blob.arrayBuffer());
            
            // Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            fs.writeFileSync(outputPath, buffer);
            console.log(`[BG Removal] Success! Saved to: ${outputPath}`);
            return `Successfully removed background and saved to ${outputPath}`;
        } catch (error) {
            console.error(`[BG Removal] Error:`, error);
            return `Error removing background: ${error.message}`;
        }
    }
}

module.exports = new BackgroundRemovalTool();
