import { useState, useEffect, useRef } from 'react';
import { SUPPORTED_LANGUAGES, generateScript, speakText, stopSpeaking, pauseSpeaking, resumeSpeaking } from '../utils/voiceAssistant';

export default function VoiceGuide({ patient, result }) {
    const [language, setLanguage] = useState('en-IN');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [wordIndex, setWordIndex] = useState(0);

    const textToSpeak = generateScript(patient, result, language);

    // Stop speaking when component unmounts
    useEffect(() => {
        return () => {
            stopSpeaking();
        };
    }, []);

    // Update transcript when language changes
    useEffect(() => {
        setTranscript(textToSpeak);
        stopSpeaking();
        setIsPlaying(false);
        setIsPaused(false);
        setWordIndex(0);
    }, [language, textToSpeak]);

    const handlePlay = () => {
        if (isPaused) {
            resumeSpeaking();
            setIsPaused(false);
            setIsPlaying(true);
            return;
        }

        setIsPlaying(true);
        setIsPaused(false);
        setWordIndex(0);

        speakText(
            textToSpeak,
            language,
            () => {
                // onEnd
                setIsPlaying(false);
                setIsPaused(false);
            },
            (e) => {
                // onBoundary (highlighting words)
                if (e.name === 'word') {
                    setWordIndex(e.charIndex);
                }
            }
        );
    };

    const handlePause = () => {
        if (isPlaying) {
            pauseSpeaking();
            setIsPaused(true);
            setIsPlaying(false);
        }
    };

    const handleStop = () => {
        stopSpeaking();
        setIsPlaying(false);
        setIsPaused(false);
        setWordIndex(0);
    };

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {/* Controls Bar */}
            <div className="bg-slate-900/50 p-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                    {isPlaying ? (
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center animate-pulse">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                    <span className="text-sm font-bold text-white">Voice Guide</span>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="bg-slate-800 border-none text-xs text-white rounded-lg focus:ring-0 py-1.5 px-3 cursor-pointer"
                    >
                        {SUPPORTED_LANGUAGES.map(lang => (
                            <option key={lang.code} value={lang.code}>{lang.label}</option>
                        ))}
                    </select>

                    <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
                        {!isPlaying ? (
                            <button onClick={handlePlay} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors" title="Play">
                                <svg className="w-5 h-5 pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                            </button>
                        ) : (
                            <button onClick={handlePause} className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-slate-700 rounded-md transition-colors" title="Pause">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            </button>
                        )}
                        <button onClick={handleStop} disabled={!isPlaying && !isPaused} className={`p-1.5 rounded-md transition-colors ${isPlaying || isPaused ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-700 cursor-not-allowed'}`} title="Stop">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Transcript Area */}
            <div className="p-4 bg-slate-800/50 min-h-24 max-h-32 overflow-y-auto">
                <p className="text-sm leading-relaxed text-slate-300 font-medium">
                    {/* Basic highlighting for English, mostly generic display for complex Indic scripts */}
                    {isPlaying && wordIndex > 0 ? (
                        <>
                            <span className="text-slate-500">{transcript.substring(0, wordIndex)}</span>
                            <span className="text-white bg-blue-900/40 rounded px-0.5">{transcript.substring(wordIndex, transcript.indexOf(' ', wordIndex) > -1 ? transcript.indexOf(' ', wordIndex) : transcript.length)}</span>
                            <span className="text-slate-300">{transcript.substring(transcript.indexOf(' ', wordIndex) > -1 ? transcript.indexOf(' ', wordIndex) : transcript.length)}</span>
                        </>
                    ) : (
                        transcript
                    )}
                </p>
            </div>
        </div>
    );
}
