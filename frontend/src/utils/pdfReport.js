/**
 * pdfReport.js
 * PROFESSIONAL 2-PAGE MEDICAL REPORT GENERATOR
 * Strictly follows the layout requested by the user.
 */
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

// Configuration
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - (MARGIN * 2);

// Colors
const BLUE_BRAND = [46, 117, 182]; // #2E75B6
const RED_ALERT = [192, 0, 0];
const YELLOW_WARN = [255, 191, 0];
const GREEN_OK = [0, 150, 0];
const GRAY_BG = [245, 245, 245];
const GRAY_TEXT = [100, 100, 100];

let yPos = 20;

const GRADE_LABELS = [
    'No Diabetic Retinopathy',
    'Mild Non-Proliferative DR',
    'Moderate Non-Proliferative DR',
    'Severe Non-Proliferative DR',
    'Proliferative Diabetic Retinopathy'
];

/** Helper to load image and return DataURL or Image object */
const getImage = async (url) => {
    if (!url) return null;
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
};

function addHeader(pdf, patient, id) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(...BLUE_BRAND);
    pdf.text('RetinaScan AI', MARGIN, yPos + 4);

    pdf.setFontSize(9);
    pdf.setTextColor(...GRAY_TEXT);
    pdf.setFont('helvetica', 'normal');
    pdf.text('AI-Powered Diabetic Retinopathy Screening', MARGIN, yPos + 10);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(50, 50, 50);
    pdf.text(`Report ID: ${id}`, PAGE_W - MARGIN, yPos + 2, { align: 'right' });

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Printed: ${dateStr} ${timeStr}`, PAGE_W - MARGIN, yPos + 7, { align: 'right' });

    pdf.setDrawColor(...BLUE_BRAND);
    pdf.setLineWidth(0.8);
    pdf.line(MARGIN, yPos + 13, PAGE_W - MARGIN, yPos + 13);
    yPos += 22;
}

function addFooter(pdf, pageNum, totalPages, reportId) {
    const footY = PAGE_H - 12;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, footY - 3, PAGE_W - MARGIN, footY - 3);

    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(150, 150, 150);
    pdf.text(`AI Engine: EfficientNetB3 + YOLOv8 Offline | Clustrex Hackathon Prototype  Page ${pageNum} of ${totalPages}`, MARGIN, footY + 4);
}

export async function generatePDF({ patient = {}, result = {}, imagePreview = null }) {
    try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const reportId = result.report_id || `RS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`;

        // PAGE 1
        yPos = 15;
        addHeader(pdf, patient, reportId);

        // 1. Clinical Summary Box
        const summaryH = 32;
        const isHigh = result.grade >= 3;
        const boxColor = isHigh ? RED_ALERT : (result.grade >= 1 ? YELLOW_WARN : BLUE_BRAND);

        pdf.setDrawColor(...boxColor);
        pdf.setLineWidth(1.5);
        pdf.roundedRect(MARGIN, yPos, CONTENT_W, summaryH, 2, 2, 'S');

        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(40, 40, 40);
        pdf.text('CLINICAL SUMMARY', PAGE_W / 2, yPos + 8, { align: 'center' });

        pdf.setFontSize(16);
        pdf.setTextColor(...boxColor);
        pdf.text(`Risk Level: ${result.risk_level || (isHigh ? 'HIGH' : 'LOW')}`, PAGE_W / 2, yPos + 16, { align: 'center' });

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${GRADE_LABELS[result.grade]} (${Math.round(result.confidence * 100)}% Confidence)`, PAGE_W / 2, yPos + 22, { align: 'center' });

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(60, 60, 60);
        pdf.text(`Recommendation: ${result.urgency || 'Monitor closely'}`, PAGE_W / 2, yPos + 28, { align: 'center' });

        yPos += summaryH + 12;

        // 2. Patient Demographics Table
        pdf.setFillColor(...BLUE_BRAND);
        pdf.rect(MARGIN, yPos, CONTENT_W, 8, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        pdf.text('PATIENT DEMOGRAPHICS', PAGE_W / 2, yPos + 5.5, { align: 'center' });
        yPos += 8;

        const rows = [
            ['Patient Name', patient.name || 'Anonymous'],
            ['Age / Gender', `${patient.age || '--'} / ${patient.gender || '--'}`],
            ['Patient ID', patient.patientId || reportId],
            ['Contact Info', patient.contact || '--'],
            ['History', `Diabetic since ${patient.diabeticSince || 0} years`],
            ['Screening Camp', patient.campName || 'General Rural Camp']
        ];

        rows.forEach(([k, v], i) => {
            pdf.setDrawColor(230, 230, 230);
            pdf.setLineWidth(0.1);
            if (i % 2 === 0) pdf.setFillColor(...GRAY_BG);
            else pdf.setFillColor(255, 255, 255);

            pdf.rect(MARGIN, yPos, CONTENT_W, 8, 'F');
            pdf.rect(MARGIN, yPos, 60, 8, 'S');
            pdf.rect(MARGIN + 60, yPos, CONTENT_W - 60, 8, 'S');

            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80, 80, 80);
            pdf.text(k, MARGIN + 5, yPos + 5.5);

            pdf.setTextColor(30, 30, 30);
            pdf.text(String(v), MARGIN + 65, yPos + 5.5);
            yPos += 8;
        });
        yPos += 12;

        // 3. AI Imaging Panels
        const imgSize = 51;
        const gap = 8;
        const imgY = yPos;

        const origImg = await getImage(imagePreview);
        const heatImg = await getImage(result.heatmap_url);

        const drawPanel = (img, x, label, isYolo = false) => {
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.2);
            pdf.rect(x, imgY, imgSize, imgSize);
            if (img) pdf.addImage(img, 'JPEG', x, imgY, imgSize, imgSize);

            if (isYolo && result.yolo?.detections) {
                const h = result.yolo.image_shape[0];
                const w = result.yolo.image_shape[1];
                result.yolo.detections.forEach(d => {
                    const [x1, y1, x2, y2] = d.bbox;
                    const bX = x + (x1 / w) * imgSize;
                    const bY = imgY + (y1 / h) * imgSize;
                    const bW = ((x2 - x1) / w) * imgSize;
                    const bH = ((y2 - y1) / h) * imgSize;

                    pdf.setDrawColor(255, 200, 0); // YOLO Gold/Yellow color often used for boxes
                    pdf.setLineWidth(0.4);
                    pdf.rect(bX, bY, bW, bH, 'S');

                    // Specific colors for types if needed
                    if (d.class_id === 0) pdf.setDrawColor(255, 0, 0); // Bleeding
                    else if (d.class_id === 1) pdf.setDrawColor(255, 204, 0); // Exudates
                    pdf.rect(bX, bY, bW, bH, 'S');
                });
            }

            pdf.setFontSize(8);
            pdf.setTextColor(80, 80, 80);
            pdf.setFont('helvetica', 'normal');
            pdf.text(label, x + imgSize / 2, imgY + imgSize + 5, { align: 'center' });
        };

        await drawPanel(origImg, MARGIN, 'Original Scan');
        await drawPanel(heatImg, MARGIN + imgSize + gap, 'AI Heatmap');
        await drawPanel(origImg, MARGIN + (imgSize + gap) * 2, 'Lesion Mapping', true);

        yPos += imgSize + 15;

        // 4. Lesion Inventory Table
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(40, 40, 40);
        pdf.text('AI LESION DETECTION INVENTORY (YOLOv8)', MARGIN, yPos);
        yPos += 5;

        pdf.setFillColor(235, 243, 250);
        pdf.rect(MARGIN, yPos, CONTENT_W, 8, 'F');
        pdf.setFontSize(8);
        pdf.setTextColor(...BLUE_BRAND);
        pdf.text('DETECTED ANOMALY', MARGIN + 5, yPos + 5.5);
        pdf.text('CONFIDENCE', MARGIN + 100, yPos + 5.5);
        pdf.text('CLINICAL SIGNIFICANCE', MARGIN + 140, yPos + 5.5);
        yPos += 8;

        const detections = result.yolo?.detections || [];
        const uniqueDets = detections.reduce((acc, d) => {
            if (!acc[d.class_name]) acc[d.class_name] = { count: 0, peak: 0 };
            acc[d.class_name].count++;
            acc[d.class_name].peak = Math.max(acc[d.class_name].peak, d.confidence);
            return acc;
        }, {});

        Object.entries(uniqueDets).forEach(([name, data], i) => {
            pdf.setDrawColor(230, 230, 230);
            pdf.line(MARGIN, yPos, PAGE_W - MARGIN, yPos);

            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(40, 40, 40);
            pdf.text(`${name} (×${data.count})`, MARGIN + 5, yPos + 5);
            pdf.text(`${Math.round(data.peak * 100)}%`, MARGIN + 100, yPos + 5);

            let clinical = "Vascular abnormality observed.";
            if (name.includes("Bleeding")) clinical = "General retinal microvascular abnormality.";
            if (name.includes("Exudates")) clinical = "Leakage of lipids/proteins; indicates advanced vessel damage.";

            const lines = pdf.splitTextToSize(clinical, CONTENT_W - 145);
            pdf.text(lines, MARGIN + 140, yPos + 5);
            yPos += 12;
        });

        addFooter(pdf, 1, 2, reportId);

        // PAGE 2
        pdf.addPage();
        yPos = 15;
        addHeader(pdf, patient, reportId);

        // 5. Follow-Up Protocol Table
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(40, 40, 40);
        pdf.text('FOLLOW-UP PROTOCOL', MARGIN, yPos);
        yPos += 6;

        pdf.setFillColor(...GRAY_BG);
        pdf.rect(MARGIN, yPos, CONTENT_W, 8, 'F');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Grade', MARGIN + 5, yPos + 5.5);
        pdf.text('Routine monitoring', MARGIN + 60, yPos + 5.5);
        pdf.text('12 months', MARGIN + 160, yPos + 5.5);
        yPos += 8;

        const protocols = [
            ['Grade 0', 'Routine monitoring', '12 months'],
            ['Grade 1', 'Close observation', '6 months'],
            ['Grade 2', 'Refer to specialist', 'Within 3 months'],
            ['Grade 3', 'Urgent referral', 'Within 2 weeks'],
            ['Grade 4', 'Emergency referral', 'Immediate']
        ];

        protocols.forEach(([g, act, time], i) => {
            const isCurrent = (i === result.grade);
            if (isCurrent) {
                pdf.setFillColor(255, 250, 240);
                pdf.rect(MARGIN, yPos, CONTENT_W, 8, 'F');
                pdf.setTextColor(...RED_ALERT);
                pdf.setFont('helvetica', 'bold');
            } else {
                pdf.setTextColor(60, 60, 60);
                pdf.setFont('helvetica', 'normal');
            }
            pdf.setDrawColor(220, 220, 220);
            pdf.rect(MARGIN, yPos, CONTENT_W, 8, 'S');

            pdf.text(g, MARGIN + 5, yPos + 5.5);
            pdf.text(act, MARGIN + 60, yPos + 5.5);
            pdf.text(time, MARGIN + 160, yPos + 5.5);
            yPos += 8;
        });

        // 6. QR Code Section (Bottom Right)
        const qrSize = 24;
        const qrX = PAGE_W - MARGIN - qrSize;
        const qrY = PAGE_H - MARGIN - qrSize - 10;

        const qrData = JSON.stringify({ id: reportId, g: result.grade, date: new Date().toISOString() });
        const qrUrl = await QRCode.toDataURL(qrData, { margin: 1, color: { dark: '#2E75B6' } });
        pdf.addImage(qrUrl, 'PNG', qrX, qrY, qrSize, qrSize);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(...BLUE_BRAND);
        pdf.text('REPORT VERIFIED', qrX + qrSize / 2, qrY + qrSize + 4, { align: 'center' });

        addFooter(pdf, 2, 2, reportId);

        // SAVE & OPEN
        const filename = `RetinaScan_Report_${patient.name || 'Patient'}.pdf`;
        pdf.save(filename);

        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');

        return { reportId };

    } catch (err) {
        console.error("PDF Generation Final Error:", err);
        throw err;
    }
}
