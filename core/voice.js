const axios = require('axios');

/**
 * Nexus OS: Voice Mode Integration
 * Allows for speech-to-text (STT) and text-to-speech (TTS) capabilities.
 * Ported from Claude Code architecture philosophies.
 */
/**
 * Voice System Service: Handles STT and TTS operations.
 */
class VoiceSystem {
    constructor() {
        this.sttProvider = process.env.STT_PROVIDER || 'browser'; // 'openai', 'browser'
        this.ttsProvider = process.env.TTS_PROVIDER || 'browser'; // 'elevenlabs', 'browser'
    }

    /**
     * Transcribe audio to text.
     */
    async transcribe(audioBuffer, options = {}) {
        console.log(`[Voice] Transcribing audio with ${this.sttProvider}...`);

        if (this.sttProvider === 'openai') {
            const formData = new FormData();
            formData.append('file', audioBuffer, 'audio.wav');
            formData.append('model', 'whisper-1');

            const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data.text;
        }

        // Fallback to client-side browser STT (handled in frontend/ChatMissionPanel)
        return null;
    }

    /**
     * Convert text to speech.
     */
    async speak(text, options = {}) {
        console.log(`[Voice] Generating speech for: "${text.substring(0, 30)}..." via ${this.ttsProvider}`);

        if (this.ttsProvider === 'elevenlabs') {
            const response = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpg8nEByWQX7d'}`, {
                text,
                model_id: 'eleven_monolingual_v1'
            }, {
                headers: {
                    'xi-api-key': process.env.ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            });
            return Buffer.from(response.data);
        }

        // Fallback: Browser handles it via window.speechSynthesis
        return null;
    }
}

module.exports = new VoiceSystem();
