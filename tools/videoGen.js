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
            // Using 'zeroscope-v2-xl' as a default high-quality text-to-video model
            const output = await this.replicate.run(
                "lucataco/animate-diff:be2271c30c00653510522d08a0d42e20b606869503ebb3ef963ca4fa5c81414c",
                { input: { prompt: prompt, n_frames: 16 } }
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
}

module.exports = new VideoGenTool();
