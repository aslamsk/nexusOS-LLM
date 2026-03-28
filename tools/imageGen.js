const { GoogleGenAI } = require('@google/genai');
const ConfigService = require('../core/config');
const fs = require('fs');
const path = require('path');

/**
 * Nexus OS: Image Generation Tool
 * Uses Google's Imagen via the @google/genai SDK.
 */
class ImageGenTool {
    constructor() {
        this.modelName = 'imagen-3.0-generate-001';
        this.alternateModels = [
            'imagen-3.0-generate-001',
            'imagen-3.0-generate-002',
            'veo-3.1-fast-generate-preview',
            'image-generation-001',
            'imagen-3.0-fast-generate-001'
        ];
        this.ai = null;
        this.activeApiKey = null;
    }

    async _getClient() {
        const apiKey = await ConfigService.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not configured in Firestore or .env.");
        }
        if (!this.ai || this.activeApiKey !== apiKey) {
            this.ai = new GoogleGenAI({ apiKey });
            this.activeApiKey = apiKey;
        }
        return this.ai;
    }

    /**
     * Generates a new image from a text prompt using Imagen.
     */
    async generateImage(prompt, savePath) {
        const candidates = [this.modelName, ...this.alternateModels];
        let lastError = null;

        for (const modelId of candidates) {
            try {
                const ai = await this._getClient();
                console.log(`[ImageGen] Attempting generation with model: ${modelId}...`);
                const response = await ai.models.generateImages({
                    model: modelId,
                    prompt: prompt,
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: "1:1",
                        outputMimeType: "image/png"
                    }
                });

                let imageData = this._extractImageData(response);
                if (!imageData) continue;

                const dir = path.dirname(savePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                fs.writeFileSync(savePath, Buffer.from(imageData, 'base64'));
                this.modelName = modelId; // Stick with the working one
                return `Success: Image saved to ${savePath}`;
            } catch (error) {
                console.warn(`[ImageGen Warning] Model ${modelId} failed: ${error.message}`);
                lastError = error;
            }
        }

        console.error("[ImageGen Final Error]", lastError);
        return `Error generating image: All models failed. Last error: ${lastError.message}`;
    }

    /**
     * Refines/Improves an existing image using Imagen's Image-to-Image capability.
     */
    async improveImage(prompt, referenceImagePath, savePath) {
        try {
            const ai = await this._getClient();
            console.log(`[ImageGen] Improving image at ${referenceImagePath} with prompt: "${prompt}"...`);
            const referenceImage = {
                inlineData: {
                    data: fs.readFileSync(referenceImagePath).toString('base64'),
                    mimeType: "image/png"
                }
            };

            const response = await ai.models.generateImages({
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
