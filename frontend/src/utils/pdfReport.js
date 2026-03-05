/**
 * pdfReport.js
 * Section 5: Elite Medical PDF Report Generator
 * Generates a professional A4 PDF using jsPDF + qrcode.
 */
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

/* ──────────────────────────────────────────────
   Grade colour map  (hex strings consumed by jsPDF)
   ────────────────────────────────────────────── */
const GRADE_COLORS = ['#00B050', '#FFC000', '#FF9900', '#FF0000', '#C00000'];
const GRADE_LABELS = [
    'No Diabetic Retinopathy',
    'Mild Non-Proliferative DR',
    'Moderate Non-Proliferative DR',
    'Severe Non-Proliferative DR',
    'Proliferative Diabetic Retinopathy',
];
const URGENCY_LABELS = [
    'Annual checkup recommended',
    'Monitor closely — 6 months',
    'Refer to specialist within 3 months',
    'Urgent referral — within 2 weeks',
    'Emergency referral — Immediate',
];
const RISK_LABELS = ['LOW', 'LOW', 'MEDIUM', 'HIGH', 'HIGH'];

/* ──────────────────────────────────────────────
   Hex → [r,g,b]
   ────────────────────────────────────────────── */
function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ──────────────────────────────────────────────
   Set draw colour from hex
   ────────────────────────────────────────────── */
function setFill(pdf, hex) {
    const [r, g, b] = hexToRgb(hex);
    pdf.setFillColor(r, g, b);
}
function setDraw(pdf, hex) {
    const [r, g, b] = hexToRgb(hex);
    pdf.setDrawColor(r, g, b);
}
function setTextColor(pdf, hex) {
    const [r, g, b] = hexToRgb(hex);
    pdf.setTextColor(r, g, b);
}

/* ──────────────────────────────────────────────
   Page constants (mm)
   ────────────────────────────────────────────── */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;

/* ──────────────────────────────────────────────
   1. HEADER
   ────────────────────────────────────────────── */
function addHeader(pdf, patient, reportId) {
    const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // LEFT column
    setTextColor(pdf, '#2E75B6');
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RetinaScan AI', MARGIN, 25);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    setTextColor(pdf, '#444444');
    pdf.text('AI-Powered Diabetic Retinopathy Screening', MARGIN, 31);
    pdf.text(`Camp: ${patient.campName || 'Rural Eye Camp'}`, MARGIN, 36);
    pdf.text(`Date: ${date}`, MARGIN, 41);
    pdf.text(`Location: ${patient.location || 'Tamil Nadu'}`, MARGIN, 46);

    // RIGHT column (align right)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    setTextColor(pdf, '#222222');
    pdf.text(`Report ID: ${reportId}`, PAGE_W - MARGIN, 25, { align: 'right' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    setTextColor(pdf, '#666666');
    pdf.text(`Scan Time: ${time}`, PAGE_W - MARGIN, 31, { align: 'right' });
    pdf.text(`Device ID: RS-DEV-001`, PAGE_W - MARGIN, 36, { align: 'right' });

    // Separator line
    setDraw(pdf, '#2E75B6');
    pdf.setLineWidth(0.8);
    pdf.line(MARGIN, 52, PAGE_W - MARGIN, 52);
}

/* ──────────────────────────────────────────────
   2. CLINICAL SUMMARY BOX
   ────────────────────────────────────────────── */
function addClinicalSummary(pdf, grade, confidence, riskScore) {
    const y = 55;
    const boxH = 32;
    const gradeColor = GRADE_COLORS[grade];
    const [r, g, b] = hexToRgb(gradeColor);

    // Background
    pdf.setFillColor(255, 242, 204); // #FFF2CC
    setDraw(pdf, gradeColor);
    pdf.setLineWidth(2.5);
    pdf.roundedRect(MARGIN, y, CONTENT_W, boxH, 3, 3, 'FD');

    // Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    setTextColor(pdf, '#222222');
    pdf.text('CLINICAL SUMMARY', PAGE_W / 2, y + 7, { align: 'center' });

    // Risk Level (colored)
    const risk = RISK_LABELS[grade];
    pdf.setFontSize(10);
    pdf.setTextColor(r, g, b);
    pdf.text(`Risk Level: ${risk}`, PAGE_W / 2, y + 13, { align: 'center' });

    // Grade label
    setTextColor(pdf, '#333333');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`AI Grade: ${GRADE_LABELS[grade]}  |  Confidence: ${Math.round(confidence * 100)}%`, PAGE_W / 2, y + 20, { align: 'center' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(r, g, b);
    pdf.text(`Urgency: ${URGENCY_LABELS[grade]}`, PAGE_W / 2, y + 27, { align: 'center' });
}

/* ──────────────────────────────────────────────
   3. PATIENT INFO TABLE
   ────────────────────────────────────────────── */
function addPatientTable(pdf, patient, startY) {
    const FIELD_W = 50;
    const VAL_W = CONTENT_W - FIELD_W;
    const ROW_H = 7;

    const rows = [
        ['Patient Name', patient.name || '—'],
        ['Age', patient.age ? `${patient.age} years` : '—'],
        ['Gender', patient.gender || '—'],
        ['Patient ID', patient.patientId || '—'],
        ['Diabetic Since', patient.diabeticSince ? `${patient.diabeticSince} years` : '—'],
        ['Contact Number', patient.contact || '—'],
    ];

    // Header row
    setFill(pdf, '#2E75B6');
    setDraw(pdf, '#2E75B6');
    pdf.setLineWidth(0.3);
    pdf.rect(MARGIN, startY, CONTENT_W, ROW_H, 'F');

    setTextColor(pdf, '#FFFFFF');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('PATIENT INFORMATION', MARGIN + CONTENT_W / 2, startY + 5.5, { align: 'center' });

    let y = startY + ROW_H;

    rows.forEach(([field, value], idx) => {
        const bg = idx % 2 === 0 ? '#F7F9FC' : '#FFFFFF';
        setFill(pdf, bg);
        setDraw(pdf, '#CCCCCC');
        pdf.setLineWidth(0.2);
        pdf.rect(MARGIN, y, FIELD_W, ROW_H, 'FD');
        pdf.rect(MARGIN + FIELD_W, y, VAL_W, ROW_H, 'FD');

        setTextColor(pdf, '#555555');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.text(field, MARGIN + 2, y + 5.5);

        setTextColor(pdf, '#222222');
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(value), MARGIN + FIELD_W + 3, y + 5.5);

        y += ROW_H;
    });

    return y + 4; // return next Y
}

/* ──────────────────────────────────────────────
   4. SCAN IMAGES
   ────────────────────────────────────────────── */
async function addImages(pdf, originalUrl, heatmapUrl, startY) {
    const IMG_SIZE = 55;
    const GAP = 10;
    const totalW = IMG_SIZE * 2 + GAP;
    const startX = MARGIN + (CONTENT_W - totalW) / 2;

    // Helper: draw one image panel
    const drawPanel = async (dataUrl, x, y, label) => {
        try {
            if (dataUrl) {
                pdf.addImage(dataUrl, 'JPEG', x, y, IMG_SIZE, IMG_SIZE);
            }
        } catch {
            // Fallback grey box
            setFill(pdf, '#EEEEEE');
            pdf.rect(x, y, IMG_SIZE, IMG_SIZE, 'F');
            setTextColor(pdf, '#999999');
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'italic');
            pdf.text('Image unavailable', x + IMG_SIZE / 2, y + IMG_SIZE / 2, { align: 'center' });
        }
        // Border
        setDraw(pdf, '#CCCCCC');
        pdf.setLineWidth(0.4);
        pdf.rect(x, y, IMG_SIZE, IMG_SIZE);
        // Label
        setTextColor(pdf, '#444444');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(label, x + IMG_SIZE / 2, y + IMG_SIZE + 5, { align: 'center' });
    };

    await drawPanel(originalUrl, startX, startY, 'Original Fundus Image');
    await drawPanel(heatmapUrl, startX + IMG_SIZE + GAP, startY, 'AI Heatmap Analysis');

    return startY + IMG_SIZE + 10;
}

/* ──────────────────────────────────────────────
   5. DIAGNOSIS & HEATMAP (Side-by-Side)
   ────────────────────────────────────────────── */
function addDiagnosisAndHeatmap(pdf, grade, confidence, riskScore, startY) {
    // Left Side: Diagnosis
    setTextColor(pdf, '#222222');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('Diagnosis:', MARGIN, startY);

    pdf.setFont('helvetica', 'normal');
    setTextColor(pdf, '#333333');
    const desc = `${GRADE_LABELS[grade]}. ${URGENCY_LABELS[grade]}.`;
    pdf.text(desc, MARGIN, startY + 6);

    pdf.setFont('helvetica', 'bold');
    setTextColor(pdf, '#222222');
    pdf.text('AI Confidence:', MARGIN, startY + 13);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${Math.round(confidence * 100)}%`, MARGIN + 28, startY + 13);

    pdf.setFont('helvetica', 'bold');
    pdf.text('Risk Score:', MARGIN, startY + 19);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${riskScore} / 100`, MARGIN + 22, startY + 19);

    // Right Side: Heatmap Explanation
    const rightX = PAGE_W / 2 + 5;
    setFill(pdf, '#2E75B6');
    pdf.rect(rightX, startY - 2, 2.5, 22, 'F');

    const text = 'The highlighted regions in the AI heatmap indicate areas of abnormal microvascular leakage and retinal lesions. This Grad-CAM visualization assists clinicians in understanding the AI decision pathway.';
    setTextColor(pdf, '#555555');
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    const lines = pdf.splitTextToSize(text, CONTENT_W / 2 - 12);
    pdf.text(lines, rightX + 5, startY + 1);

    return startY + 24;
}

/* ──────────────────────────────────────────────
   7. FOLLOW-UP RECOMMENDATIONS TABLE
   ────────────────────────────────────────────── */
function addFollowUpTable(pdf, currentGrade, startY) {
    const COL1 = 30, COL2 = 90, COL3 = CONTENT_W - COL1 - COL2;
    const ROW_H = 7;

    const rows = [
        ['Grade 0', 'Routine monitoring', '12 months'],
        ['Grade 1', 'Close observation', '6 months'],
        ['Grade 2', 'Refer to specialist', 'Within 3 months'],
        ['Grade 3', 'Urgent referral', 'Within 2 weeks'],
        ['Grade 4', 'Emergency referral', 'Immediate'],
    ];

    // Section heading
    setTextColor(pdf, '#222222');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('Follow-up Recommendations', MARGIN, startY);
    startY += 4;

    // Header row
    setFill(pdf, '#2E75B6');
    setDraw(pdf, '#2E75B6');
    pdf.setLineWidth(0.2);
    pdf.rect(MARGIN, startY, COL1, ROW_H, 'F');
    pdf.rect(MARGIN + COL1, startY, COL2, ROW_H, 'F');
    pdf.rect(MARGIN + COL1 + COL2, startY, COL3, ROW_H, 'F');

    setTextColor(pdf, '#FFFFFF');
    pdf.setFontSize(8);
    pdf.text('DR Grade', MARGIN + 2, startY + 4.5);
    pdf.text('Recommended Action', MARGIN + COL1 + 2, startY + 4.5);
    pdf.text('Timeline', MARGIN + COL1 + COL2 + 2, startY + 4.5);

    let y = startY + ROW_H;
    rows.forEach(([grade, action, timeline], idx) => {
        const isActive = idx === currentGrade;
        const bg = isActive ? '#FFF3CD' : (idx % 2 === 0 ? '#F7F9FC' : '#FFFFFF');
        setFill(pdf, bg);
        setDraw(pdf, '#CCCCCC');
        pdf.rect(MARGIN, y, COL1, ROW_H, 'FD');
        pdf.rect(MARGIN + COL1, y, COL2, ROW_H, 'FD');
        pdf.rect(MARGIN + COL1 + COL2, y, COL3, ROW_H, 'FD');

        setTextColor(pdf, isActive ? '#C00000' : '#333333');
        pdf.setFont('helvetica', isActive ? 'bold' : 'normal');
        pdf.setFontSize(8);
        pdf.text(grade, MARGIN + 2, y + 4.5);
        pdf.text(action, MARGIN + COL1 + 2, y + 4.5);
        pdf.text(timeline, MARGIN + COL1 + COL2 + 2, y + 4.5);
        y += ROW_H;
    });

    return y + 4;
}

/* ──────────────────────────────────────────────
   8. DATA SECURITY NOTICE
   ────────────────────────────────────────────── */
function addSecurityNotice(pdf, startY) {
    setDraw(pdf, '#CCCCCC');
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN, startY, PAGE_W - MARGIN, startY);
    startY += 4;

    setTextColor(pdf, '#333333');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('Data Privacy Notice', MARGIN, startY);

    const notice =
        'This screening report is generated and stored locally on the device. No patient data is ' +
        'transmitted to cloud servers unless explicitly enabled by authorized personnel. All stored ' +
        'data is encrypted using AES-256 encryption standards.';

    setTextColor(pdf, '#666666');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    const lines = pdf.splitTextToSize(notice, CONTENT_W);
    pdf.text(lines, MARGIN, startY + 6);

    return startY + 6 + lines.length * 4.5;
}

/* ──────────────────────────────────────────────
   9. QR CODE
   ────────────────────────────────────────────── */
async function addQRCode(pdf, reportId, grade, confidence, timestamp) {
    const qrData = JSON.stringify({ report_id: reportId, grade, confidence, timestamp });
    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 100, margin: 1 });

    const qrSize = 28;
    const qrX = PAGE_W - MARGIN - qrSize;
    const qrY = PAGE_H - MARGIN - qrSize - 8;

    pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    setTextColor(pdf, '#888888');
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Scan to Verify Report', qrX + qrSize / 2, qrY + qrSize + 4, { align: 'center' });
}

/* ──────────────────────────────────────────────
   10. FOOTER + WATERMARK
   ────────────────────────────────────────────── */
function addFooter(pdf) {
    const y = PAGE_H - MARGIN + 3;

    setDraw(pdf, '#CCCCCC');
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN, y - 5, PAGE_W - MARGIN, y - 5);

    setTextColor(pdf, '#888888');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.text('RetinaScan AI | Clustrex Hackathon Prototype', MARGIN, y);
    pdf.setFont('helvetica', 'italic');
    pdf.text('AI-Assisted Screening Tool — Not a substitute for licensed medical diagnosis', PAGE_W / 2, y, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.text('Page 1 of 1', PAGE_W - MARGIN, y, { align: 'right' });

    // AI model info (bottom-left, very small)
    setTextColor(pdf, '#AAAAAA');
    pdf.setFontSize(6.5);
    pdf.text('Model: EfficientNetB3  |  Dataset: APTOS 2019  |  Version: 1.0  |  Updated: March 2026', MARGIN, y + 5);

    // Diagonal watermark
    pdf.saveGraphicsState();
    pdf.setGState(pdf.GState({ opacity: 0.04 }));
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(72);
    setTextColor(pdf, '#000000');
    pdf.text('RetinaScan AI', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 45 });
    pdf.restoreGraphicsState();
}

/* ──────────────────────────────────────────────
   MAIN EXPORT
   ────────────────────────────────────────────── */
export async function generatePDF({ patient = {}, result = {}, imagePreview = null }) {
    const pdf = new jsPDF('p', 'mm', 'a4');

    const grade = result.grade ?? 0;
    const confidence = result.confidence ?? 0;
    const riskScore = result.risk_score ?? 0;
    const timestamp = result.timestamp ?? new Date().toISOString();

    // Build a deterministic Report ID
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const patientIdShort = (patient.patientId || 'DEMO').slice(-5);
    const reportId = `RS-${dateStr}-${patientIdShort}`;
    const filename = `RetinaScan_Report_${patient.patientId || 'DEMO'}_${dateStr}.pdf`;

    // ── 1. Header ──────────────────────────────
    addHeader(pdf, patient, reportId);

    // ── 2. Clinical Summary Box ────────────────
    addClinicalSummary(pdf, grade, confidence, riskScore);

    // ── 3. Patient Table ───────────────────────
    let curY = addPatientTable(pdf, patient, 92);

    // ── 4. Scan Images ─────────────────────────
    curY = await addImages(pdf, imagePreview, result.heatmap_url || null, curY);

    // ── 5. Diagnosis & Heatmap ─────────────────
    curY = addDiagnosisAndHeatmap(pdf, grade, confidence, riskScore, curY);

    // ── 6. Follow-Up Table ─────────────────────
    curY = addFollowUpTable(pdf, grade, curY);

    // ── 8. Security Notice ─────────────────────
    addSecurityNotice(pdf, curY);

    // ── 9. QR Code ─────────────────────────────
    await addQRCode(pdf, reportId, grade, confidence, timestamp);

    // ── 10. Footer + Watermark ─────────────────
    addFooter(pdf);

    // Open in new tab + trigger download
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // Also save file
    pdf.save(filename);

    return { reportId, filename };
}
