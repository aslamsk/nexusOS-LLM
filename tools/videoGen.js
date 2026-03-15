const ffmpegPath = require('ffmpeg-static');
const { spawnSync } = require('child_process');
const path = require('path');

class VideoGenTool {
    /**
     * Convert a static image into a video file (looping for 5 seconds).
     * Output is optimized for Facebook/Instagram Reels (H.264, MP4).
     */
    async imageToVideo(imagePath, outputPath) {
        console.log(`[VideoGen] Converting image to Reel-optimized video: ${imagePath} -> ${outputPath}`);
        
        // Command: Scale and pad image to 1080x1920 (9:16 vertical)
        const args = [
            '-loop', '1',
            '-i', imagePath,
            '-vf', "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
            '-c:v', 'libx264',
            '-t', '10', // Increase to 10s
            '-r', '30', // 30 fps
            '-pix_fmt', 'yuv420p',
            '-y',
            outputPath
        ];

        try {
            const result = spawnSync(ffmpegPath, args);
            if (result.error) {
                return { error: "FFmpeg spawn failed", details: result.error.message };
            }
            if (result.status !== 0) {
                return { error: "FFmpeg error", details: result.stderr.toString() };
            }
            return { success: true, path: outputPath };
        } catch (e) {
            return { error: "Video generation failed", details: e.message };
        }
    }
}

module.exports = new VideoGenTool();
