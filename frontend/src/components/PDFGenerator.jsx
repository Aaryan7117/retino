/**
 * PDFGenerator.jsx — Feature 3: WhatsApp share + PDF generation
 *
 * ── HOW TO ADD YOUR OWN WHATSAPP NUMBER ──────────────────────────────────────
 * Set DOCTOR_PHONE below to your 10-digit mobile number (without +91).
 * The report will be sent to the PATIENT's number by default.
 * If you also want a copy sent to yourself, set DOCTOR_PHONE.
 * Example:  const DOCTOR_PHONE = '9876543210';
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from 'react';
import { generatePDF } from '../utils/pdfReport';

// ← Set your 10-digit WhatsApp number here (without country code / spaces)
const DOCTOR_PHONE = ''; // e.g. '9876543210'

export default function PDFGenerator({ patient, result, imagePreview, record, language = 'en-IN' }) {
    const [status, setStatus] = useState('idle'); // idle | generating | done | error

    const handleGenerate = async () => {
        setStatus('generating');
        try {
            await generatePDF({ patient, result, imagePreview, record, language, abhaId: patient?.abhaId || '', patientState: patient?.state || '' });
            setStatus('done');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (err) {
            console.error('PDF generation failed:', err);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    // Feature 3: WhatsApp Share
    const shareWA = () => {
        const msg =
            `*RetinaScan AI Report* — ${new Date().toLocaleDateString('en-IN')}\n`
            + `Patient: ${patient?.name || 'Patient'}\n`
            + `Diagnosis: ${result?.grade_label || result?.diagnosis || ''}\n`
            + `Risk: *${result?.risk_level || ''}*\n`
            + `Action: ${result?.urgency || 'Consult ophthalmologist'}\n`
            + `_AI-assisted screening only. Consult a licensed ophthalmologist._`;

        // Send to patient number if available, otherwise to doctor number, otherwise generic
        const patientPh = (patient?.contact || '').replace(/\D/g, '').slice(-10);
        const targetPh = patientPh || DOCTOR_PHONE;
        const url = targetPh
            ? `https://wa.me/91${targetPh}?text=${encodeURIComponent(msg)}`
            : `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
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
        <div className="space-y-2">
            <button
                onClick={handleGenerate}
                disabled={status === 'generating'}
                className={`${styles[status]} w-full text-sm justify-start transition-all duration-200`}
            >
                {labels[status]}
            </button>
        </div>
    );
}
