require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

/**
 * Nexus OS: Image Generation Tool
 * Uses Google's Imagen via the @google/genai SDK.
 */
class ImageGenTool {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not set in the environment.");
        }
        this.ai = new GoogleGenAI({ apiKey: apiKey });
        // Use Imagen 4 (adjust if needed)
        this.modelName = 'imagen-4.0-generate-001';
    }

    /**
     * Refines/Improves an existing image using Imagen's Image-to-Image capability.
     */
    async improveImage(prompt, referenceImagePath, savePath) {
        try {
            console.log(`[ImageGen] Improving image at ${referenceImagePath} with prompt: "${prompt}"...`);
            const fs = require('fs');
            const referenceImage = {
                inlineData: {
                    data: fs.readFileSync(referenceImagePath).toString('base64'),
                    mimeType: "image/png"
                }
            };

            const response = await this.ai.models.generateImages({
                model: this.modelName,
                prompt: prompt, // The improvement instructions
                images: [referenceImage], // The guide image
                parameters: {
                    sampleCount: 1,
                    aspectRatio: "1:1",
                    outputMimeType: "image/png"
                }
            });

            // Re-use logic for extracting image bytes
            let imageData = this._extractImageData(response);
            if (!imageData) throw new Error("No improved images were generated.");

            const dir = path.dirname(savePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            fs.writeFileSync(savePath, Buffer.from(imageData, 'base64'));
            return `Success: Improved image saved to ${savePath}`;
        } catch (error) {
            console.error("[ImageGen Improve Error]", error);
            return `Error improving image: ${error.message}`;
        }
    }

    /**
     * Private helper to extract image bytes from various Imagen response formats.
     */
    _extractImageData(response) {
        if (response.images && response.images[0]) {
            return response.images[0].imageBytes || response.images[0].bytes;
        } else if (response.generatedImages && response.generatedImages[0]) {
            const imgObj = response.generatedImages[0].image;
            return imgObj?.imageBytes || imgObj?.bytes;
        } else if (response.pageInternal && response.pageInternal[0]) {
            const page = response.pageInternal[0];
            return page.image?.bytes || page.images?.[0]?.bytes;
        } else if (response.sdkHttpResponseInternal?.contents) {
            try {
                const contents = JSON.parse(response.sdkHttpResponseInternal.contents);
                return contents.predictions?.[0]?.bytesBase64Encoded;
            } catch (e) { return null; }
        }
        return null;
    }
}

module.exports = new ImageGenTool();
