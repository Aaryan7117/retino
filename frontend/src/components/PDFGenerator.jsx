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

            {/* Feature 3: WhatsApp share — styled to match other action buttons */}
            {(patient?.contact || DOCTOR_PHONE) && (
                <button
                    onClick={shareWA}
                    className="btn-primary w-full text-sm justify-start bg-[#075E54] hover:bg-[#128C7E] shadow-lg shadow-green-900/30 transition-all duration-200"
                >
                    <svg className="w-4 h-4 shrink-0 mr-1" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    </svg>
                    Share via WhatsApp
                </button>
            )}
        </div>
    );
}
