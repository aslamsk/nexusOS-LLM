const ffmpegPath = require('ffmpeg-static');
const { spawnSync } = require('child_process');
const path = require('path');
const Replicate = require('replicate');

class VideoGenTool {
    constructor() {
        this.replicate = process.env.REPLICATE_API_TOKEN 
            ? new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
            : null;
    }

    /**
     * LOCAL: Convert a static image into a video file (looping for 10 seconds).
     */
    async imageToVideo(imagePath, outputPath) {
        console.log(`[VideoGen] Local fallback: Converting image to video: ${imagePath} -> ${outputPath}`);
        
        const args = [
            '-loop', '1',
            '-i', imagePath,
            '-vf', "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
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
        if (!this.replicate) {
            return { error: "REPLICATE_API_TOKEN not set in environment. Use local imageToVideo instead." };
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
            const output = await this.replicate.run(
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
     * AI GENERATIVE (FREE): Generate video from prompt using Gemini (Imagen) + Local FFmpeg.
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
