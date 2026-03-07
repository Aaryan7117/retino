/**
 * pdfReport.js
 * Section 5: Elite Medical PDF Report Generator
 * Professional Medical Layout v2.0
 */
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

/* ──────────────────────────────────────────────
   Grade colour map
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
   Helper: Hex → [r,g,b]
   ────────────────────────────────────────────── */
function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ──────────────────────────────────────────────
   Page Constants (mm)
   ────────────────────────────────────────────── */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 15;
const MARGIN_B = 20;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// Shared Y tracker
let yPos = 20;

/**
 * Handle page breaks
 */
function checkPageBreak(pdf, neededHeight, patient, reportId) {
    if (yPos + neededHeight > PAGE_H - MARGIN_B) {
        pdf.addPage();
        yPos = 20; // Reset Y
        addHeader(pdf, patient, reportId); // Re-add header on new page
        return true;
    }
    return false;
}

/* ──────────────────────────────────────────────
   1. HEADER
   ────────────────────────────────────────────── */
function addHeader(pdf, patient, reportId) {
    const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // Logo / Brand
    const [r, g, b] = hexToRgb('#2E75B6');
    pdf.setTextColor(r, g, b);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('RetinaScan AI', MARGIN_X, 22);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(68, 68, 68);
    pdf.text('AI-Powered Diabetic Retinopathy Screening', MARGIN_X, 27);

    // Header Details (Right side)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(34, 34, 34);
    pdf.text(`Report ID: ${reportId}`, PAGE_W - MARGIN_X, 22, { align: 'right' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(102, 102, 102);
    pdf.text(`Printed: ${date} ${time}`, PAGE_W - MARGIN_X, 27, { align: 'right' });

    // Separator line
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.6);
    pdf.line(MARGIN_X, 32, PAGE_W - MARGIN_X, 32);

    yPos = 38;
}

/* ──────────────────────────────────────────────
   2. CLINICAL SUMMARY BOX
   ────────────────────────────────────────────── */
function addClinicalSummary(pdf, grade, confidence, riskScore) {
    const boxH = 38;
    const internalPadding = 8;
    const gradeColor = GRADE_COLORS[grade];
    const [cr, cg, cb] = hexToRgb(gradeColor);

    // Box Background
    pdf.setFillColor(250, 250, 250);
    pdf.setDrawColor(cr, cg, cb);
    pdf.setLineWidth(1.5);
    pdf.roundedRect(MARGIN_X, yPos, CONTENT_W, boxH, 2, 2, 'FD');

    const centerX = PAGE_W / 2;
    let localY = yPos + internalPadding;

    // Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(34, 34, 34);
    pdf.text('CLINICAL SUMMARY', centerX, localY, { align: 'center' });
    localY += 7;

    // Risk Level (High Priority)
    const risk = RISK_LABELS[grade];
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(cr, cg, cb);
    pdf.text(`Risk Level: ${risk}`, centerX, localY, { align: 'center' });
    localY += 8;

    // Diagnosis & Confidence
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(68, 68, 68);
    pdf.text(`${GRADE_LABELS[grade]} (${Math.round(confidence * 100)}% Confidence)`, centerX, localY, { align: 'center' });
    localY += 7;

    // Urgency
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Recommendation: ${URGENCY_LABELS[grade]}`, centerX, localY, { align: 'center' });

    yPos += boxH + 10;
}

/* ──────────────────────────────────────────────
   3. PATIENT INFORMATION TABLE
   ────────────────────────────────────────────── */
function addPatientTable(pdf, patient) {
    const COL1 = 45;
    const COL2 = 120;
    const ROW_H = 7.5;

    const rows = [
        ['Patient Name', patient.name || '—'],
        ['Age / Gender', `${patient.age || '—'} / ${patient.gender || '—'}`],
        ['Patient ID', patient.patientId || '—'],
        ['Contact info', patient.contact || '—'],
        ['History', `Diabetic since ${patient.diabeticSince || '—'} years`],
        ['Screening Camp', patient.campName || 'General Rural Camp']
    ];

    // Table Header
    pdf.setFillColor(46, 117, 182); // #2E75B6
    pdf.rect(MARGIN_X, yPos, CONTENT_W, ROW_H, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('PATIENT DEMOGRAPHICS', MARGIN_X + CONTENT_W / 2, yPos + 5, { align: 'center' });

    yPos += ROW_H;

    rows.forEach(([label, value], idx) => {
        // Row background (alternating)
        if (idx % 2 === 0) {
            pdf.setFillColor(245, 245, 245);
            pdf.rect(MARGIN_X, yPos, CONTENT_W, ROW_H, 'F');
        }

        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.1);
        pdf.rect(MARGIN_X, yPos, COL1, ROW_H);
        pdf.rect(MARGIN_X + COL1, yPos, COL2 + (CONTENT_W - COL1 - COL2), ROW_H);

        // Label
        pdf.setTextColor(80, 80, 80);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text(label, MARGIN_X + 3, yPos + 5);

        // Value
        pdf.setTextColor(34, 34, 34);
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(value), MARGIN_X + COL1 + 3, yPos + 5);

        yPos += ROW_H;
    });

    yPos += 10;
}

/* ──────────────────────────────────────────────
   4. SCAN IMAGES (3-Panel Layout)
   ────────────────────────────────────────────── */
async function addScanImages(pdf, originalUrl, heatmapUrl, yolo) {
    const IMG_SZ = 52;
    const GAP = 8;
    const totalW = (IMG_SZ * 3) + (GAP * 2);
    const startX = MARGIN_X + (CONTENT_W - totalW) / 2;

    const drawPanel = async (url, x, label, isYolo = false) => {
        // Draw Image
        try {
            if (url) {
                pdf.addImage(url, 'JPEG', x, yPos, IMG_SZ, IMG_SZ);
            }
        } catch {
            pdf.setFillColor(240, 240, 240);
            pdf.rect(x, yPos, IMG_SZ, IMG_SZ, 'F');
        }

        // If YOLO, draw bounding boxes manually on top
        if (isYolo && yolo && yolo.detections) {
            yolo.detections.forEach(det => {
                const [x1, y1, x2, y2] = det.bbox;
                const imgW = yolo.image_shape[1];
                const imgH = yolo.image_shape[0];

                // Scale coordinates to PDF panel size
                const pdfX = x + (x1 / imgW) * IMG_SZ;
                const pdfY = yPos + (y1 / imgH) * IMG_SZ;
                const pdfW = ((x2 - x1) / imgW) * IMG_SZ;
                const pdfH = ((y2 - y1) / imgH) * IMG_SZ;

                const colors = ['#FF0000', '#FFCC00', '#0099FF'];
                const rgb = hexToRgb(colors[det.class_id] || '#FFFFFF');
                pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
                pdf.setLineWidth(0.3);
                pdf.rect(pdfX, pdfY, pdfW, pdfH, 'S');
            });
        }

        // Panel Border
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(0.2);
        pdf.rect(x, yPos, IMG_SZ, IMG_SZ);

        // Caption
        pdf.setTextColor(60, 60, 60);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.text(label, x + IMG_SZ / 2, yPos + IMG_SZ + 5, { align: 'center' });
    };

    await drawPanel(originalUrl, startX, 'Original Scan');
    await drawPanel(heatmapUrl, startX + IMG_SZ + GAP, 'AI Heatmap');
    await drawPanel(originalUrl, startX + (IMG_SZ + GAP) * 2, 'Lesion Mapping', true);

    yPos += IMG_SZ + 12;
}

/* ──────────────────────────────────────────────
   5. AI LESION DETECTION INVENTORY
   ────────────────────────────────────────────── */
function addDetectionInventory(pdf, yolo, patient, reportId) {
    if (!yolo || !yolo.detections || yolo.detections.length === 0) return;

    checkPageBreak(pdf, 40, patient, reportId);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(34, 34, 34);
    pdf.text('AI LESION DETECTION INVENTORY (YOLOv8)', MARGIN_X, yPos);
    yPos += 6;

    const COL1 = 70;
    const COL2 = 30;
    const COL3 = 80;
    const ROW_H_BASE = 7;

    // Header
    pdf.setFillColor(235, 241, 248);
    pdf.rect(MARGIN_X, yPos, CONTENT_W, ROW_H_BASE, 'F');
    pdf.setTextColor(46, 117, 182);
    pdf.setFontSize(8.5);
    pdf.text('DETECTED ANOMALY', MARGIN_X + 3, yPos + 5);
    pdf.text('CONFIDENCE', MARGIN_X + COL1 + 3, yPos + 5);
    pdf.text('CLINICAL SIGNIFICANCE', MARGIN_X + COL1 + COL2 + 3, yPos + 5);
    yPos += ROW_H_BASE;

    // Grouping
    const stats = yolo.detections.reduce((acc, det) => {
        if (!acc[det.class_name]) acc[det.class_name] = { count: 0, maxConf: 0 };
        acc[det.class_name].count++;
        acc[det.class_name].maxConf = Math.max(acc[det.class_name].maxConf, det.confidence);
        return acc;
    }, {});

    Object.entries(stats).forEach(([name, data]) => {
        let significance = "General retinal microvascular abnormality.";
        if (name.includes("Bleeding")) significance = "Indicates active hemorrhaging; high risk of vision loss.";
        if (name.includes("Exudates")) significance = "Leakage of lipids/proteins; indicates advanced vessel damage.";

        const sigLines = pdf.splitTextToSize(significance, COL3 - 6);
        const rowH = Math.max(ROW_H_BASE, sigLines.length * 4 + 3);

        checkPageBreak(pdf, rowH, patient, reportId);

        pdf.setDrawColor(220, 220, 220);
        pdf.rect(MARGIN_X, yPos, COL1, rowH);
        pdf.rect(MARGIN_X + COL1, yPos, COL2, rowH);
        pdf.rect(MARGIN_X + COL1 + COL2, yPos, COL3, rowH);

        pdf.setTextColor(34, 34, 34);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${name} (×${data.count})`, MARGIN_X + 3, yPos + 5);
        pdf.text(`${Math.round(data.maxConf * 100)}%`, MARGIN_X + COL1 + 3, yPos + 5);
        pdf.text(sigLines, MARGIN_X + COL1 + COL2 + 3, yPos + 4.5);

        yPos += rowH;
    });

    yPos += 10;
}

/* ──────────────────────────────────────────────
   6. FOLLOW-UP RECOMMENDATIONS
   ────────────────────────────────────────────── */
function addFollowUp(pdf, currentGrade) {
    const COL1 = 40, COL2 = 80, COL3 = 60;
    const ROW_H = 7;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('FOLLOW-UP PROTOCOL', MARGIN_X, yPos);
    yPos += 6;

    const rows = [
        ['Grade 0', 'Routine monitoring', '12 months'],
        ['Grade 1', 'Close observation', '6 months'],
        ['Grade 2', 'Refer to specialist', 'Within 3 months'],
        ['Grade 3', 'Urgent referral', 'Within 2 weeks'],
        ['Grade 4', 'Emergency referral', 'Immediate'],
    ];

    rows.forEach(([gr, act, time], idx) => {
        const isActive = idx === currentGrade;
        if (isActive) {
            pdf.setFillColor(255, 243, 205);
            pdf.rect(MARGIN_X, yPos, CONTENT_W, ROW_H, 'F');
        }

        pdf.setDrawColor(200, 200, 200);
        pdf.rect(MARGIN_X, yPos, COL1, ROW_H);
        pdf.rect(MARGIN_X + COL1, yPos, COL2, ROW_H);
        pdf.rect(MARGIN_X + COL1 + COL2, yPos, COL3, ROW_H);

        pdf.setFont('helvetica', isActive ? 'bold' : 'normal');
        pdf.setTextColor(isActive ? 192 : 34, isActive ? 0 : 34, 0);
        pdf.text(gr, MARGIN_X + 3, yPos + 5);
        pdf.text(act, MARGIN_X + COL1 + 3, yPos + 5);
        pdf.text(time, MARGIN_X + COL1 + COL2 + 3, yPos + 5, { align: 'left' });

        yPos += ROW_H;
    });

    yPos += 12;
}

/* ──────────────────────────────────────────────
   7. FOOTER + QR
   ────────────────────────────────────────────── */
async function addFooter(pdf, reportId, grade, confidence, timestamp) {
    const footerY = PAGE_H - 12;

    // Bottom separator
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN_X, footerY - 5, PAGE_W - MARGIN_X, footerY - 5);

    // AI Attribution (Left)
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(140, 140, 140);
    pdf.text(`AI Engine: EfficientNetB3 + YOLOv8 Offline | Clustrex Hackathon prototype`, MARGIN_X, footerY);

    // Page indicator (Center)
    pdf.text('Page 1 of 1', PAGE_W / 2, footerY, { align: 'center' });

    // QR Code Placement (Floating at bottom right, below the line)
    try {
        const qrSize = 22;
        const qrX = PAGE_W - MARGIN_X - qrSize;
        const qrY = PAGE_H - MARGIN_B - qrSize;

        const qrData = JSON.stringify({ id: reportId, g: grade, c: confidence, t: timestamp });
        const qrUrl = await QRCode.toDataURL(qrData, { width: 100, margin: 1 });
        pdf.addImage(qrUrl, 'PNG', qrX, qrY, qrSize, qrSize);

        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor('#2E75B6');
        pdf.text('REPORT VERIFIED', qrX + qrSize / 2, qrY + qrSize + 4, { align: 'center' });
    } catch (err) {
        console.warn('QR Code generation failed:', err);
    }
}

/* ──────────────────────────────────────────────
   PUBLIC API
   ────────────────────────────────────────────── */
export async function generatePDF({ patient = {}, result = {}, imagePreview = null }) {
    const pdf = new jsPDF('p', 'mm', 'a4');

    const grade = result.grade ?? 0;
    const confidence = result.confidence ?? 0;
    const riskScore = result.risk_score ?? 0;
    const timestamp = result.timestamp ?? new Date().toISOString();

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const patientIdShort = (patient.patientId || 'DEMO').slice(-5);
    const reportId = `RS-${dateStr}-${patientIdShort}`;
    const filename = `RetinaScan_Report_${patient.patientId || 'DEMO'}.pdf`;

    // Process Page 1
    addHeader(pdf, patient, reportId);
    addClinicalSummary(pdf, grade, confidence, riskScore);
    addPatientTable(pdf, patient);

    await addScanImages(pdf, imagePreview, result.heatmap_url || null, result.yolo);

    checkPageBreak(pdf, 40, patient, reportId);
    addDetectionInventory(pdf, result.yolo, patient, reportId);

    checkPageBreak(pdf, 45, patient, reportId);
    addFollowUp(pdf, grade);

    await addFooter(pdf, reportId, grade, confidence, timestamp);

    // Trigger Browser Actions
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    pdf.save(filename);

    return { reportId, filename };
}
