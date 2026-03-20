// pdfReport.js — Generates professional 2-page medical reports in PDF format using jsPDF and QRCode.

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

// Report Layout Configuration (A4 Dimensions in mm)
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

// Medical Branding Color Palette
const COLORS = {
    BLUE_BRAND: [46, 117, 182],   // #2E75B6
    RED_ALERT: [192, 0, 0],       // Urgent Referral
    YELLOW_WARN: [255, 191, 0],    // Monitoring Required
    GREEN_OK: [0, 150, 0],        // Healthy
    GRAY_BG: [245, 245, 245],     // Table zebra striping
    GRAY_TEXT: [100, 100, 100]    // Subtitles
};

const GRADE_DESCRIPTIONS = [
    'No Diabetic Retinopathy',
    'Mild Non-Proliferative DR',
    'Moderate Non-Proliferative DR',
    'Severe Non-Proliferative DR',
    'Proliferative Diabetic Retinopathy'
];

/**
 * Loads an image from a URL and returns an HTMLImageElement.
 * 
 * @param {string} url - Image URL or Base64 string.
 * @returns {Promise<HTMLImageElement|null>}
 */
const loadImageAsync = async (url) => {
    if (!url) return null;
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
};

/**
 * Adds the institutional header to the current PDF page.
 * 
 * @param {jsPDF} pdf - jsPDF instance.
 * @param {string} reportId - Unique identifier for the report.
 * @param {number} yPos - Vertical start position.
 * @returns {number} Updated vertical position.
 */
function drawReportHeader(pdf, reportId, yPos) {
    const now = new Date();
    const dateString = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeString = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(...COLORS.BLUE_BRAND);
    pdf.text('RetinaScan AI', MARGIN, yPos + 4);

    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.GRAY_TEXT);
    pdf.setFont('helvetica', 'normal');
    pdf.text('AI-Powered Diabetic Retinopathy Screening', MARGIN, yPos + 10);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(50, 50, 50);
    pdf.text(`Report ID: ${reportId}`, PAGE_WIDTH - MARGIN, yPos + 2, { align: 'right' });

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Printed: ${dateString} ${timeString}`, PAGE_WIDTH - MARGIN, yPos + 7, { align: 'right' });

    pdf.setDrawColor(...COLORS.BLUE_BRAND);
    pdf.setLineWidth(0.8);
    pdf.line(MARGIN, yPos + 13, PAGE_WIDTH - MARGIN, yPos + 13);
    
    return yPos + 22;
}

/**
 * Adds the report footer to the current PDF page.
 * 
 * @param {jsPDF} pdf - jsPDF instance.
 * @param {number} pageNumber - Current page index.
 * @param {number} totalPages - Total pages in doc.
 */
function drawReportFooter(pdf, pageNumber, totalPages) {
    const footerY = PAGE_HEIGHT - 12;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, footerY - 3, PAGE_WIDTH - MARGIN, footerY - 3);

    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(150, 150, 150);
    pdf.text(`AI Engine: EfficientNetB3 + YOLOv8 Offline | Clustrex Hackathon Prototype  Page ${pageNumber} of ${totalPages}`, MARGIN, footerY + 4);
}

/**
 * Generates and downloads a comprehensive 2-page clinical report.
 * 
 * @param {Object} data - Contains patient details, AI results, and image previews.
 * @returns {Promise<Object>} The generated report metadata.
 */
export async function generatePDF({ patient = {}, result = {}, imagePreview = null }) {
    let currentY = 15;

    try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const reportId = result.report_id || `RS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`;

        // --- PAGE 1: CLINICAL SUMMARY & DEMOGRAPHICS ---
        currentY = drawReportHeader(pdf, reportId, 15);

        // 1. Clinical Summary Box
        const summaryBoxHeight = 32;
        const isHighRisk = result.grade >= 3;
        const riskColor = isHighRisk ? COLORS.RED_ALERT : (result.grade >= 1 ? COLORS.YELLOW_WARN : COLORS.BLUE_BRAND);

        pdf.setDrawColor(...riskColor);
        pdf.setLineWidth(1.5);
        pdf.roundedRect(MARGIN, currentY, CONTENT_WIDTH, summaryBoxHeight, 2, 2, 'S');

        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(40, 40, 40);
        pdf.text('CLINICAL SUMMARY', PAGE_WIDTH / 2, currentY + 8, { align: 'center' });

        pdf.setFontSize(16);
        pdf.setTextColor(...riskColor);
        pdf.text(`Risk Level: ${result.risk_level || (isHighRisk ? 'HIGH' : 'LOW')}`, PAGE_WIDTH / 2, currentY + 16, { align: 'center' });

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${GRADE_DESCRIPTIONS[result.grade]} (${Math.round(result.confidence * 100)}% Confidence)`, PAGE_WIDTH / 2, currentY + 22, { align: 'center' });

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(60, 60, 60);
        pdf.text(`Recommendation: ${result.urgency || 'Monitor closely'}`, PAGE_WIDTH / 2, currentY + 28, { align: 'center' });

        currentY += summaryBoxHeight + 12;

        // 2. Patient Demographics Table
        pdf.setFillColor(...COLORS.BLUE_BRAND);
        pdf.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        pdf.text('PATIENT DEMOGRAPHICS', PAGE_WIDTH / 2, currentY + 5.5, { align: 'center' });
        currentY += 8;

        const demographicData = [
            ['Patient Name', patient.name || 'Anonymous'],
            ['Age / Gender', `${patient.age || '--'} / ${patient.gender || '--'}`],
            ['Patient ID', patient.patientId || reportId],
            ['Contact Info', patient.contact || '--'],
            ['History', `Diabetic since ${patient.diabeticSince || 0} years`],
            ['Screening Camp', patient.campName || 'General Rural Camp']
        ];

        demographicData.forEach(([label, value], index) => {
            pdf.setDrawColor(230, 230, 230);
            pdf.setLineWidth(0.1);
            if (index % 2 === 0) pdf.setFillColor(...COLORS.GRAY_BG);
            else pdf.setFillColor(255, 255, 255);

            pdf.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'F');
            pdf.rect(MARGIN, currentY, 60, 8, 'S');
            pdf.rect(MARGIN + 60, currentY, CONTENT_WIDTH - 60, 8, 'S');

            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80, 80, 80);
            pdf.text(label, MARGIN + 5, currentY + 5.5);

            pdf.setTextColor(30, 30, 30);
            pdf.text(String(value), MARGIN + 65, currentY + 5.5);
            currentY += 8;
        });
        currentY += 12;

        // 3. AI Imaging Panels
        const imagePanelSize = 51;
        const panelGap = 8;
        const panelRowY = currentY;

        const originalImageSource = await loadImageAsync(imagePreview);
        const heatmapImageSource = await loadImageAsync(result.heatmap_url);

        const renderImagePanel = (imgSource, xCoord, label, applyYoloOverlay = false) => {
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.2);
            pdf.rect(xCoord, panelRowY, imagePanelSize, imagePanelSize);
            
            if (imgSource) {
                pdf.addImage(imgSource, 'JPEG', xCoord, panelRowY, imagePanelSize, imagePanelSize);
            }

            if (applyYoloOverlay && result.yolo?.detections) {
                const [sourceH, sourceW] = result.yolo.image_shape;
                result.yolo.detections.forEach(detection => {
                    const [x1, y1, x2, y2] = detection.bbox;
                    const boxX = xCoord + (x1 / sourceW) * imagePanelSize;
                    const boxY = panelRowY + (y1 / sourceH) * imagePanelSize;
                    const boxW = ((x2 - x1) / sourceW) * imagePanelSize;
                    const boxH = ((y2 - y1) / sourceH) * imagePanelSize;

                    // Set box color based on detection type
                    if (detection.class_id === 0) pdf.setDrawColor(255, 0, 0);      // Bleeding/Hemorrhage
                    else if (detection.class_id === 1) pdf.setDrawColor(255, 204, 0); // Exudates
                    else pdf.setDrawColor(255, 255, 0);                              // Other anomalies
                    
                    pdf.setLineWidth(0.4);
                    pdf.rect(boxX, boxY, boxW, boxH, 'S');
                });
            }

            pdf.setFontSize(8);
            pdf.setTextColor(80, 80, 80);
            pdf.setFont('helvetica', 'normal');
            pdf.text(label, xCoord + imagePanelSize / 2, panelRowY + imagePanelSize + 5, { align: 'center' });
        };

        await renderImagePanel(originalImageSource, MARGIN, 'Original Scan');
        await renderImagePanel(heatmapImageSource, MARGIN + imagePanelSize + panelGap, 'AI Heatmap');
        await renderImagePanel(originalImageSource, MARGIN + (imagePanelSize + panelGap) * 2, 'Lesion Mapping', true);

        currentY += imagePanelSize + 15;

        // 4. Lesion Inventory Table
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(40, 40, 40);
        pdf.text('AI LESION DETECTION INVENTORY (YOLOv8)', MARGIN, currentY);
        currentY += 5;

        pdf.setFillColor(235, 243, 250);
        pdf.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'F');
        pdf.setFontSize(8);
        pdf.setTextColor(...COLORS.BLUE_BRAND);
        pdf.text('DETECTED ANOMALY', MARGIN + 5, currentY + 5.5);
        pdf.text('CONFIDENCE', MARGIN + 100, currentY + 5.5);
        pdf.text('CLINICAL SIGNIFICANCE', MARGIN + 140, currentY + 5.5);
        currentY += 8;

        const yoloDetections = result.yolo?.detections || [];
        const summaryStatistics = yoloDetections.reduce((total, det) => {
            if (!total[det.class_name]) total[det.class_name] = { count: 0, maxConfidence: 0 };
            total[det.class_name].count++;
            total[det.class_name].maxConfidence = Math.max(total[det.class_name].maxConfidence, det.confidence);
            return total;
        }, {});

        Object.entries(summaryStatistics).forEach(([anomalyName, stats]) => {
            pdf.setDrawColor(230, 230, 230);
            pdf.line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY);

            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(40, 40, 40);
            pdf.text(`${anomalyName} (×${stats.count})`, MARGIN + 5, currentY + 5);
            pdf.text(`${Math.round(stats.maxConfidence * 100)}%`, MARGIN + 100, currentY + 5);

            let clinicalNote = "Vascular abnormality requiring clinical correlation.";
            if (anomalyName.includes("Bleeding")) clinicalNote = "Intraretinal hemorrhage indicates severe microvascular distress.";
            if (anomalyName.includes("Exudates")) clinicalNote = "Proteinaceous leakage suggesting active retinal edema.";

            const wrappedNote = pdf.splitTextToSize(clinicalNote, CONTENT_WIDTH - 145);
            pdf.text(wrappedNote, MARGIN + 140, currentY + 5);
            currentY += 12;
        });

        drawReportFooter(pdf, 1, 2);

        // --- PAGE 2: PROTOCOLS & VERIFICATION ---
        pdf.addPage();
        currentY = drawReportHeader(pdf, reportId, 15);

        // 5. Follow-Up Protocol Table
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(40, 40, 40);
        pdf.text('FOLLOW-UP PROTOCOL', MARGIN, currentY);
        currentY += 6;

        pdf.setFillColor(...COLORS.GRAY_BG);
        pdf.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'F');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Grade', MARGIN + 5, currentY + 5.5);
        pdf.text('Screening Outcome', MARGIN + 60, currentY + 5.5);
        pdf.text('Timeline', MARGIN + 160, currentY + 5.5);
        currentY += 8;

        const managementProtocols = [
            ['Grade 0', 'Routine annual monitoring', '12 months'],
            ['Grade 1', 'Close clinical observation', '6 months'],
            ['Grade 2', 'Referral to Ophthalmologist', 'Within 3 months'],
            ['Grade 3', 'Urgent Specialist Referral', 'Within 2 weeks'],
            ['Grade 4', 'Emergency Laser Interv.', 'Immediate']
        ];

        managementProtocols.forEach(([gradeName, description, period], idx) => {
            const isPatientGrade = (idx === result.grade);
            if (isPatientGrade) {
                pdf.setFillColor(255, 250, 240);
                pdf.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'F');
                pdf.setTextColor(...COLORS.RED_ALERT);
                pdf.setFont('helvetica', 'bold');
            } else {
                pdf.setTextColor(60, 60, 60);
                pdf.setFont('helvetica', 'normal');
            }
            pdf.setDrawColor(220, 220, 220);
            pdf.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'S');

            pdf.text(gradeName, MARGIN + 5, currentY + 5.5);
            pdf.text(description, MARGIN + 60, currentY + 5.5);
            pdf.text(period, MARGIN + 160, currentY + 5.5);
            currentY += 8;
        });

        // 6. Security & Verification (QR Code)
        const qrDimension = 24;
        const qrPositionX = PAGE_WIDTH - MARGIN - qrDimension;
        const qrPositionY = PAGE_HEIGHT - MARGIN - qrDimension - 10;

        const encryptionData = JSON.stringify({ 
            id: reportId, 
            g: result.grade, 
            ts: new Date().getTime() 
        });
        const qrCodeUrl = await QRCode.toDataURL(encryptionData, { 
            margin: 1, 
            color: { dark: '#2E75B6' } 
        });
        
        pdf.addImage(qrCodeUrl, 'PNG', qrPositionX, qrPositionY, qrDimension, qrDimension);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(...COLORS.BLUE_BRAND);
        pdf.text('DIGITAL VERIFICATION', qrPositionX + qrDimension / 2, qrPositionY + qrDimension + 4, { align: 'center' });

        drawReportFooter(pdf, 2, 2);

        // --- EXPORT & TERMINATION ---
        const downloadFileName = `RetinaScan_Report_${patient.name || 'Anonymous'}.pdf`;
        pdf.save(downloadFileName);

        // Open in new tab for immediate preview
        const pdfBlob = pdf.output('blob');
        const pdfPreviewUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfPreviewUrl, '_blank');

        return { reportId, status: 'Success' };

    } catch (pdfError) {
        console.error("PDF Generation Lifecycle Error:", pdfError);
        throw pdfError;
    }
}
