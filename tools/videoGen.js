const ConfigService = require('../core/config');
const ffmpegPath = require('ffmpeg-static');
const { spawnSync } = require('child_process');
const path = require('path');
const Replicate = require('replicate');

class VideoGenTool {
    constructor() {}

    /**
     * Get an initialized Replicate client with the latest API token.
     */
    async _getReplicate() {
        const token = await ConfigService.get('REPLICATE_API_TOKEN');
        if (!token) return null;
        return new Replicate({ auth: token });
    }

    /**
     * LOCAL: Convert a static image into a video file (looping for 10 seconds).
     */
    async imageToVideo(imagePath, outputPath) {
        console.log(`[VideoGen] Local fallback: Converting image to video: ${imagePath} -> ${outputPath}`);
        
        const args = [
            '-loop', '1',
            '-i', imagePath,
            '-vf', "scale=1920:1920,zoompan=z='min(zoom+0.0015,1.5)':d=300:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920,setsar=1",
            '-c:v', 'libx264',
            '-t', '10',
            '-r', '30',
            '-pix_fmt', 'yuv420p',
            '-y',
            outputPath
        ];

        try {
            const result = spawnSync(ffmpegPath, args);
            if (result.error) return { error: "FFmpeg spawn failed", details: result.error.message };
            if (result.status !== 0) return { error: "FFmpeg error", details: result.stderr.toString() };
            return { success: true, path: outputPath };
        } catch (e) {
            return { error: "Video generation failed", details: e.message };
        }
    }

    /**
     * AI GENERATIVE: Generate video from a text prompt using Replicate.
     */
    async generateFromPrompt(prompt, outputPath) {
        const replicate = await this._getReplicate();
        if (!replicate) {
            return { error: "REPLICATE_API_TOKEN not set in Firestore. Use local imageToVideo instead." };
        }

        console.log(`[VideoGen] Generating video from prompt: "${prompt}"`);
        try {
            // Robust version fetching: Try models.get first, then fallback to listing versions
            let versionHash;
            try {
                const model = await this.replicate.models.get("anotherjesse/zeroscope-v2-xl");
                versionHash = model.latest_version ? model.latest_version.id : null;
                
                if (!versionHash) {
                    const versions = await this.replicate.models.versions.list("anotherjesse", "zeroscope-v2-xl");
                    versionHash = versions.results[0].id;
                }
            } catch (err) {
                // Final hardcoded fallback if everything fails
                versionHash = "9f7430067c36cdac3f9bcbc1ec778433dafb01c40f5a720df5df756cadf284fc";
            }
            
            console.log(`[VideoGen] Using model version: ${versionHash}`);
            const output = await replicate.run(
                `anotherjesse/zeroscope-v2-xl:${versionHash}`,
                { input: { prompt: prompt, num_frames: 24 } }
            );

            // Replicate returns a URL to the video file
            const videoUrl = Array.isArray(output) ? output[0] : output;
            
            // Download the file
            const axios = require('axios');
            const fs = require('fs');
            const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
            const writer = fs.createWriteStream(outputPath);
            
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve({ success: true, path: outputPath }));
                writer.on('error', (err) => reject({ error: "Download failed", details: err.message }));
            });
        } catch (e) {
            return { error: "Generative video failed", details: e.message };
        }
    }

    /**
     * GOOGLE VEO / GEMINI VIDEO: High-fidelity generative video (Ad Quality).
     */
    async generateWithVeo(prompt, outputPath, imagePath = null) {
        console.log(`[VideoGen] Initiating Google Veo generation: "${prompt}" ${imagePath ? '(Image-to-Video)' : '(Text-to-Video)'}`);
        try {
            const { GoogleGenAI } = require('@google/genai');
            const apiKey = await ConfigService.get('GEMINI_API_KEY');
            if (!apiKey) throw new Error("GEMINI_API_KEY missing in Firestore");
            const genAI = new GoogleGenAI({ apiKey });
            
            // In 2026, Veo 3.1 is the latest cinematic model
            const model = genAI.getGenerativeModel({ model: "veo-3.1-generate-001" });

            const parts = [{ text: prompt }];
            if (imagePath) {
                const fs = require('fs');
                parts.push({
                    inlineData: {
                        data: fs.readFileSync(imagePath).toString('base64'),
                        mimeType: 'image/png' // Assuming PNG
                    }
                });
            }

            const result = await model.generateContent({
                contents: [{ role: 'user', parts }],
                generationConfig: {
                    videoGenerationConfig: {
                        durationSeconds: 10,
                        aspectRatio: "9:16", // Commercial/Reel format
                        fps: 30
                    }
                }
            });

            const videoPart = result.response.candidates[0].content.parts.find(p => p.videoMetadata);
            if (!videoPart) throw new Error("Veo failed to return video data.");

            // Download the generated video bytes
            const videoBytes = videoPart.inlineData.data;
            const fs = require('fs');
            const path = require('path');
            
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            fs.writeFileSync(outputPath, Buffer.from(videoBytes, 'base64'));
            return { success: true, path: outputPath };
        } catch (e) {
            console.error("[VideoGen Veo Error]", e);
            return { error: "Google Veo generation failed", details: e.message };
        }
    }

    /**
     * AI GENERATIVE (FREE FALLBACK): Generate video from prompt using Gemini (Imagen) + Local FFmpeg.
     */
    async generateFromPromptFree(prompt, outputPath) {
        console.log(`[VideoGen] Using FREE Gemini+FFmpeg fallback for: "${prompt}"`);
        try {
            const ImageGenTool = require('./imageGen');
            const tempImagePath = outputPath.replace('.mp4', '.png');
            
            // 1. Generate core image using Gemini/Imagen
            const imgResult = await ImageGenTool.generateImage(`Cinematic keyframe: ${prompt}`, tempImagePath);
            if (imgResult.includes('Error')) return { error: "Initial image generation failed", details: imgResult };

            // 2. Convert to video using local FFmpeg
            return await this.imageToVideo(tempImagePath, outputPath);
        } catch (e) {
            return { error: "Free video generation failed", details: e.message };
        }
    }
}

module.exports = new VideoGenTool();
