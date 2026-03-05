/**
 * PDFGenerator.jsx
 * Section 5: Elite medical report button component.
 * Calls the generatePDF() utility from pdfReport.js.
 */
import { useState } from 'react';
import { generatePDF } from '../utils/pdfReport';

export default function PDFGenerator({ patient, result, imagePreview }) {
    const [status, setStatus] = useState('idle'); // idle | generating | done | error

    const handleGenerate = async () => {
        setStatus('generating');
        try {
            await generatePDF({ patient, result, imagePreview });
            setStatus('done');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (err) {
            console.error('PDF generation failed:', err);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    const labels = {
        idle: '📄 Generate PDF Report',
        generating: '⏳ Generating PDF…',
        done: '✅ PDF Generated!',
        error: '❌ Failed — Retry',
    };

    const styles = {
        idle: 'btn-primary',
        generating: 'btn-secondary opacity-70 cursor-not-allowed',
        done: 'btn-primary bg-emerald-600',
        error: 'btn-primary bg-red-700',
    };

    return (
        <button
            onClick={handleGenerate}
            disabled={status === 'generating'}
            className={`${styles[status]} w-full text-sm justify-start transition-all duration-200`}
        >
            {labels[status]}
        </button>
    );
}
