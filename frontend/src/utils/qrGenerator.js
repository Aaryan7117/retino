/**
 * qrGenerator.js
 * Generates QR codes for PDF report verification.
 * Full implementation in Section 5.
 */
import QRCode from 'qrcode';

/**
 * Generate a base64 PNG QR code encoding the given data.
 * @param {Object} data - e.g. { report_id, grade, confidence, timestamp }
 * @returns {Promise<string>} data URL (data:image/png;base64,...)
 */
export async function generateQRCode(data) {
    const payload = JSON.stringify(data);
    return QRCode.toDataURL(payload, {
        width: 250,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
    });
}

/**
 * Generate QR from a plain string URL.
 */
export async function generateQRFromURL(url) {
    return QRCode.toDataURL(url, { width: 250, margin: 2 });
}
