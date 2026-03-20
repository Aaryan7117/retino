// voiceAssistant.js — Provides voice-based assistance for clinical reports using Web Speech API and Cloud TTS fallback.

/**
 * List of languages supported for localized voice feedback.
 */
export const SUPPORTED_LANGUAGES = [
    { code: 'ta-IN', label: 'Tamil' },
    { code: 'hi-IN', label: 'Hindi' },
    { code: 'te-IN', label: 'Telugu' },
    { code: 'kn-IN', label: 'Kannada' },
    { code: 'ml-IN', label: 'Malayalam' },
    { code: 'en-IN', label: 'English' },
];

/**
 * Generates a localized clinical summary script from patient data and scan results.
 * 
 * @param {Object} patient - The patient record (name, age).
 * @param {Object} result - The AI inference result (grade, confidence, urgency).
 * @param {string} langCode - The target BCP-47 language code.
 * @returns {string} The formatted script for text-to-speech.
 */
export const generateScript = (patient, result, langCode) => {
    const { name, age } = patient;
    const { grade_label, confidence, urgency } = result;
    const confidencePercentage = Math.round(confidence * 100);

    switch (langCode) {
        case 'ta-IN': // Tamil
            return `நோயாளி பெயர்: ${name}. வயது: ${age}. நோய் கண்டறிதல்: ${grade_label}. கணினி நம்பிக்கை: ${confidencePercentage} சதவீதம். பரிந்துரை: ${urgency}.`;
        case 'hi-IN': // Hindi
            return `मरीज का नाम: ${name}। उम्र: ${age}। निदान: ${grade_label}। एआई का भरोसा: ${confidencePercentage} प्रतिशत। सलाह: ${urgency}।`;
        case 'te-IN': // Telugu
            return `రోగి పేరు: ${name}. వయస్సు: ${age}. వ్యాధి నిర్ధారణ: ${grade_label}. విశ్వాసం: ${confidencePercentage} శాతం. సిఫార్సు: ${urgency}.`;
        case 'kn-IN': // Kannada
            return `ರೋಗಿಯ ಹೆಸರು: ${name}. ವಯಸ್ಸು: ${age}. ರೋಗನಿರ್ಣಯ: ${grade_label}. ವಿಶ್ವಾಸ: ${confidencePercentage} ಶೇಕಡಾ. ಶಿಫಾರಸು: ${urgency}.`;
        case 'ml-IN': // Malayalam
            return `രോഗിയുടെ പേര്: ${name}. പ്രായം: ${age}. രോഗനിർണയം: ${grade_label}. ഉറപ്പ്: ${confidencePercentage} ശതമാനം. നിർദ്ദേശം: ${urgency}.`;
        case 'en-IN': // English
        default:
            return `Patient name: ${name}. Age: ${age}. Diagnosis: ${grade_label}. Artificial Intelligence Confidence: ${confidencePercentage} percent. Recommendation: ${urgency}.`;
    }
};

let activeAudioHandle = null;

/**
 * Initiates text-to-speech for the provided script.
 * 
 * Strategy:
 * 1. Attempt to find a high-quality native voice in the browser.
 * 2. If no native voice matches (e.g., specific Indian regional languages), 
 *    fall back to the backend's Cloud TTS (gTTS) via an Audio stream.
 * 
 * @param {string} text - The script to be spoken.
 * @param {string} langCode - The target BCP-47 language code.
 * @param {Function} [onEnd] - Callback triggered when speech completes.
 * @param {Function} [onBoundary] - Callback for word/sentence boundaries (Native API only).
 * @returns {SpeechSynthesisUtterance|null} The utterance object if using Native API, else null.
 */
export const speakText = (text, langCode, onEnd, onBoundary) => {
    stopSpeaking(); 

    if (!('speechSynthesis' in window)) {
        console.warn("Web Speech API not supported in this browser.");
        if (onEnd) onEnd();
        return null;
    }

    const isChrome = !!window.chrome;
    const availableVoices = window.speechSynthesis.getVoices();

    // 1. Precise Language Match
    const searchCode = langCode.toLowerCase().replace('_', '-');
    let selectedVoice = availableVoices.find(v => {
        const vLang = v.lang.toLowerCase().replace('_', '-');
        return vLang === searchCode || vLang.startsWith(searchCode.split('-')[0]);
    });

    // 2. Google High-Quality Voice Match (Chrome specific)
    if (!selectedVoice && isChrome) {
        selectedVoice = availableVoices.find(v =>
            v.name.includes('தமிழ்') || v.name.includes('Tamil') ||
            v.name.includes('हिन्दी') || v.name.includes('Hindi') ||
            v.name.includes('తెలుగు') || v.name.includes('Telugu') ||
            v.name.includes('ಕನ್ನಡ') || v.name.includes('Kannada') ||
            v.name.includes('മലയാളം') || v.name.includes('Malayalam')
        );
    }

    // 3. Backend Fallback (Cloud TTS / gTTS)
    // Used when the device lacks local voices for the requested language.
    if (!selectedVoice && !langCode.startsWith('en')) {
        console.log(`No native voice found for ${langCode}. Using Cloud fallback...`);
        const languagePrefix = langCode.split('-')[0];
        const encodedQuery = encodeURIComponent(text);

        // Fallback to local server endpoint for high-quality Indian regional voices
        const fallbackUrl = `http://localhost:8000/api/tts/?lang=${languagePrefix}&text=${encodedQuery}`;
        activeAudioHandle = new Audio(fallbackUrl);

        activeAudioHandle.onended = () => {
            activeAudioHandle = null;
            if (onEnd) onEnd();
        };
        activeAudioHandle.onerror = () => {
            console.error("Cloud TTS fallback failed (Server unreachable or offline).");
            activeAudioHandle = null;
            if (onEnd) onEnd();
        };

        if (onBoundary) {
            onBoundary({ name: 'word', charIndex: 0 });
        }

        activeAudioHandle.play().catch(error => {
            console.error("Audio playback error:", error);
            activeAudioHandle = null;
            if (onEnd) onEnd();
        });

        return null;
    }

    // 4. Native Browser Implementation
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.9; 
    utterance.pitch = 1.0;

    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }

    if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
    }

    if (onBoundary) {
        utterance.onboundary = onBoundary;
    }

    window.speechSynthesis.speak(utterance);
    return utterance;
};

/**
 * Pauses active speech.
 */
export const pauseSpeaking = () => {
    if (activeAudioHandle) {
        activeAudioHandle.pause();
    } else if ('speechSynthesis' in window) {
        window.speechSynthesis.pause();
    }
};

/**
 * Resumes paused speech.
 */
export const resumeSpeaking = () => {
    if (activeAudioHandle) {
        activeAudioHandle.play();
    } else if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
    }
};

/**
 * Stops all active speech and resets state.
 */
export const stopSpeaking = () => {
    if (activeAudioHandle) {
        activeAudioHandle.pause();
        activeAudioHandle.currentTime = 0;
        activeAudioHandle = null;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
};

// Initialize voices: Chrome and other browsers load voices asynchronously.
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}
