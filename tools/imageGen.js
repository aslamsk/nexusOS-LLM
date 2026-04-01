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
        this.modelName = 'imagen-4.0-ultra-generate-001';
        this.alternateModels = [
            'imagen-4.0-ultra-generate-001',
            'imagen-4.0-generate-001',
            'imagen-4.0-fast-generate-001',
            'gemini-3.1-flash-image-preview',
            'gemini-3-pro-image-preview',
            'gemini-2.5-flash-image'
        ];
        this.failedModels = new Set();
        this.ai = null;
        this.activeApiKey = null;
    }

    async _getClient() {
        const apiKey =
            (await ConfigService.get('GEMINI_API_KEY')) ||
            (await ConfigService.get('GEMINI_API_KEY_2')) ||
            (await ConfigService.get('GEMINI_API_KEY_3')) ||
            process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not configured in Firestore or .env.");
        }
        if (!this.ai || this.activeApiKey !== apiKey) {
            this.ai = new GoogleGenAI({ apiKey });
            this.activeApiKey = apiKey;
            // New key means previous model failures may not apply (quota/permissions differ).
            this.failedModels.clear();
        }
        return this.ai;
    }

    /**
     * Generates a new image from a text prompt using Imagen.
     */
    async generateImage(prompt, savePath, options = {}) {
        let finalPrompt = prompt;
        if (options.refine !== false) {
            finalPrompt = await this.refinePrompt(prompt);
        }

        const buildCandidates = () =>
            [this.modelName, ...this.alternateModels].filter((m) => !this.failedModels.has(m));
        let candidates = buildCandidates();

        // If we somehow exhausted every model (often due to transient quota/auth), reset once and retry.
        if (candidates.length === 0) {
            this.failedModels.clear();
            candidates = buildCandidates();
        }

        let lastError = null;

        for (const modelId of candidates) {
            try {
                const ai = await this._getClient();
                console.log(`[ImageGen] Attempting generation with model: ${modelId}...`);
                const response = await ai.models.generateImages({
                    model: modelId,
                    prompt: finalPrompt,
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: options.aspectRatio || "1:1",
                        outputMimeType: "image/png"
                    }
                });

                let imageData = this._extractImageData(response);
                if (!imageData) {
                    this.failedModels.add(modelId);
                    continue;
                }

                const dir = path.dirname(savePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                fs.writeFileSync(savePath, Buffer.from(imageData, 'base64'));
                this.modelName = modelId; // Stick with the working one
                return `Success: Image saved to ${savePath}`;
            } catch (error) {
                console.warn(`[ImageGen Warning] Model ${modelId} failed: ${error.message}. Blacklisting for this session.`);
                this.failedModels.add(modelId);
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
     * Refines a simple user prompt into a high-fidelity, descriptive prompt for the image model.
     * Uses the LLM to inject cinematic lighting, composition, and professional detail.
     */
    async refinePrompt(userPrompt) {
        try {
            const LLMService = require('../core/llm');
            const llm = new LLMService();
            const systemPrompt = `You are an expert prompt engineer for professional image generation models like Imagen 4.0 and Midjourney.
Your mission is to transform a simple user request into a high-fidelity, premium prompt that delivers "WOW" results.

Follow these rules:
1. Maintain the core intent (e.g., if they asked for a "blue car", it must be a blue car).
2. Add professional descriptors: lighting (volumetric, cinematic, soft), texture (8k, high-fidelity), composition (wide angle, bokeh, rule of thirds).
3. If it is for a business (like fashion), inject brand-appropriate aesthetics.
4. Keep the result under 75 words.
5. Provide ONLY the expanded prompt text. No conversational filler.

USER REQUEST: "${userPrompt}"`;

            console.log(`[ImageGen] Refining prompt for better "WOW" factor...`);
            const response = await llm.generateResponse([{ role: 'user', content: systemPrompt }], { mode: 'chat' });
            const refined = response.text || userPrompt;
            console.log(`[ImageGen] Expanded Prompt: "${refined}"`);
            return refined;
        } catch (error) {
            console.warn(`[ImageGen Warning] Prompt refinement failed, using raw prompt: ${error.message}`);
            return userPrompt;
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
