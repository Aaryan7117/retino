/**
 * Wrapper for the native Web Speech API (window.speechSynthesis)
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
 * Generates the translated localized script.
 * In a full production app with a backend, we might use i18next or an LLM API.
 * For the hackathon demo, we hardcode the structural templates.
 */
export const generateScript = (patient, result, langCode) => {
    const { name, age } = patient;
    const { grade_label, confidence, urgency } = result;
    const confScore = Math.round(confidence * 100);

    switch (langCode) {
        case 'ta-IN': // Tamil
            return `நோயாளி பெயர்: ${name}. வயது: ${age}. நோய் கண்டறிதல்: ${grade_label}. கணினி நம்பிக்கை: ${confScore} சதவீதம். பரிந்துரை: ${urgency}.`;
        case 'hi-IN': // Hindi
            return `मरीज़ का नाम: ${name}। उम्र: ${age}। निदान: ${grade_label}। एआई का भरोसा: ${confScore} प्रतिशत। सलाह: ${urgency}।`;
        case 'te-IN': // Telugu
            return `రోగి పేరు: ${name}. వయస్సు: ${age}. వ్యాధి నిర్ధారణ: ${grade_label}. విశ్వాసం: ${confScore} శాతం. సిఫార్సు: ${urgency}.`;
        case 'kn-IN': // Kannada
            return `ರೋಗಿಯ ಹೆಸರು: ${name}. ವಯಸ್ಸು: ${age}. ರೋಗನಿರ್ಣಯ: ${grade_label}. ವಿಶ್ವಾಸ: ${confScore} ಶೇಕಡಾ. ಶಿಫಾರಸು: ${urgency}.`;
        case 'ml-IN': // Malayalam
            return `രോഗിയുടെ പേര്: ${name}. പ്രായം: ${age}. രോഗനിർണയം: ${grade_label}. ഉറപ്പ്: ${confScore} ശതമാനം. നിർദ്ദേശം: ${urgency}.`;
        case 'en-IN': // English
        default:
            return `Patient name: ${name}. Age: ${age}. Diagnosis: ${grade_label}. Artificial Intelligence Confidence: ${confScore} percent. Recommendation: ${urgency}.`;
    }
};

let currentAudio = null;

/**
 * Speaks the given text, falling back to Google Cloud TTS if a local native voice is missing.
 */
export const speakText = (text, langCode, onEnd, onBoundary) => {
    stopSpeaking(); // Cancel any ongoing speech

    if (!('speechSynthesis' in window)) {
        console.warn("Web Speech API not supported in this browser.");
        if (onEnd) onEnd();
        return null;
    }

    const isChrome = !!window.chrome;
    const voices = window.speechSynthesis.getVoices();

    // 1. Try to find an exact or partial native voice for the language (excluding generic English voices that claim to speak everything)
    let targetVoice = voices.find(v => v.lang === langCode && !v.name.includes("English"));
    if (!targetVoice) {
        targetVoice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]) && !v.name.includes("English"));
    }

    // 2. Google provides high quality "Google हिन्दी", "Google தமிழ்" etc. on Chrome
    if (!targetVoice && isChrome) {
        if (langCode.startsWith('ta')) targetVoice = voices.find(v => v.name.includes('தமிழ்') || v.name.includes('Tamil'));
        else if (langCode.startsWith('hi')) targetVoice = voices.find(v => v.name.includes('हिन्दी') || v.name.includes('Hindi'));
        else if (langCode.startsWith('te')) targetVoice = voices.find(v => v.name.includes('తెలుగు') || v.name.includes('Telugu'));
        else if (langCode.startsWith('kn')) targetVoice = voices.find(v => v.name.includes('ಕನ್ನಡ') || v.name.includes('Kannada'));
        else if (langCode.startsWith('ml')) targetVoice = voices.find(v => v.name.includes('മലയാളം') || v.name.includes('Malayalam'));
    }

    // 3. FALLBACK: If NO native voice is found for the Indic language, fallback to Cloud TTS API
    // This solves the issue on Windows where regional language packs aren't installed by default.
    if (!targetVoice && !langCode.startsWith('en')) {
        console.log(`No local voice found for ${langCode}. Falling back to Cloud TTS to ensure demo works...`);

        const shortLang = langCode.split('-')[0];
        const encodedText = encodeURIComponent(text);

        // Use our robust FastAPI backend proxy instead of hitting Google directly from the browser
        // This completely bypasses CORS and Origin blocks enforced by modern browsers.
        const url = `http://localhost:8000/api/tts/?lang=${shortLang}&text=${encodedText}`;

        currentAudio = new Audio(url);

        currentAudio.onended = () => {
            currentAudio = null;
            if (onEnd) onEnd();
        };
        currentAudio.onerror = () => {
            console.error("Cloud Audio fallback failed (offline?).");
            currentAudio = null;
            if (onEnd) onEnd();
        };

        // We can't do exact word boundaries on pure audio tracks, so simulate start
        if (onBoundary) {
            onBoundary({ name: 'word', charIndex: 0 });
        }

        currentAudio.play().catch(e => {
            console.error("Audio play failed:", e);
            currentAudio = null;
            if (onEnd) onEnd();
        });

        return null; // Return null since it's not a SpeechSynthesisUtterance
    }

    // 4. STANDARD Native Web Speech API
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0;

    if (targetVoice) {
        utterance.voice = targetVoice;
    }

    if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
    }

    if (onBoundary) {
        // Triggers when speaking crosses a word or sentence boundary
        utterance.onboundary = onBoundary;
    }

    window.speechSynthesis.speak(utterance);
    return utterance;
};

export const pauseSpeaking = () => {
    if (currentAudio) {
        currentAudio.pause();
    } else if ('speechSynthesis' in window) {
        window.speechSynthesis.pause();
    }
};

export const resumeSpeaking = () => {
    if (currentAudio) {
        currentAudio.play();
    } else if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
    }
};

export const stopSpeaking = () => {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
};

// Ensure voices are loaded (Chrome loads them asynchronously)
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        // Trigger load
        window.speechSynthesis.getVoices();
    };
}
