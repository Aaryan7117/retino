// pdfReport.js — Generates professional clinical reports in PDF format using jsPDF and QRCode.

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { loadLanguageFont } from './pdfFonts';

const PDF_TRANSLATIONS = {
'en-IN': {
    title: 'RetinaScan AI+', sub: 'AI-Powered Diabetic Retinopathy Screening',
    clinicalSummary: 'CLINICAL SUMMARY', riskLevel: 'Risk Level:',
    recommendation: 'Recommendation:', demographics: 'PATIENT DEMOGRAPHICS',
    patientName: 'Patient Name', ageGender: 'Age / Gender', contact: 'Contact',
    history: 'Diabetic History', followUp: 'FOLLOW-UP PROTOCOL',
    lesionTitle: 'AI LESION DETECTION INVENTORY',
    rightEye: 'Right Eye (OD)', leftEye: 'Left Eye (OS)',
    original: 'Original Scan', heatmap: 'AI Heatmap', lesion: 'Lesion Mapping',
    analyzedImage: 'Analyzed Image',
    reportId: 'Report ID', printed: 'Printed', patientId: 'Patient ID',
    camp: 'Screening Camp', confidence: 'CONFIDENCE', significance: 'CLINICAL SIGNIFICANCE',
    grade: 'Grade', outcome: 'Screening Outcome', timeline: 'Timeline',
    verification: 'DIGITAL VERIFICATION', notAvailable: 'Not Available',
    diabeticSince: 'Diabetic since', years: 'years',
    grades: [
        'No Diabetic Retinopathy', 'Mild Non-Proliferative DR',
        'Moderate Non-Proliferative DR', 'Severe Non-Proliferative DR',
        'Proliferative Diabetic Retinopathy'
    ],
    protocols: [
        ['Grade 0', 'Routine annual monitoring', '12 months'],
        ['Grade 1', 'Close clinical observation', '6 months'],
        ['Grade 2', 'Referral to Ophthalmologist', 'Within 3 months'],
        ['Grade 3', 'Urgent Specialist Referral', 'Within 2 weeks'],
        ['Grade 4', 'Emergency Laser Interv.', 'Immediate']
    ],
    notes: {
        vascular: 'Vascular abnormality requiring clinical correlation.',
        hemorrhage: 'Intraretinal hemorrhage indicates severe microvascular distress.',
        exudates: 'Proteinaceous leakage suggesting active retinal edema.'
    }
},
'ta-IN': {
    title: 'ரெடினாஸ்கேன் ஏஐ+', sub: 'AI-ஆல் இயங்கும் நீரிழிவு விழித்திரை நோய் கண்டறிதல்',
    clinicalSummary: 'மருத்துவ சுருக்கம்', riskLevel: 'ஆபத்து நிலை:',
    recommendation: 'பரிந்துரை:', demographics: 'நோயாளி விவரங்கள்',
    patientName: 'நோயாளி பெயர்', ageGender: 'வயது / பாலினம்', contact: 'தொடர்பு எண்',
    history: 'நீரிழிவு வரலாறு', followUp: 'பின்தொடர்தல் நெறிமுறை',
    lesionTitle: 'AI புண் கண்டறிதல் பட்டியல்',
    rightEye: 'வலது கண் (OD)', leftEye: 'இடது கண் (OS)',
    original: 'அசல் ஸ்கேன்', heatmap: 'AI வெப்ப வரைபடம்', lesion: 'புண் வரைபடமாக்கல்',
    analyzedImage: 'பகுப்பாய்வு செய்யப்பட்ட படம்',
    reportId: 'அறிக்கை ஐடி', printed: 'அச்சிடப்பட்டது', patientId: 'நோயாளி ஐடி',
    camp: 'திரையிடல் முகாம்', confidence: 'சட்டபூர்வமான தன்மை', significance: 'மருத்துவ முக்கியத்துவம்',
    grade: 'தரம்', outcome: 'திரையிடல் முடிவு', timeline: 'காலவரிசை',
    verification: 'டிஜிட்டல் சரிபார்ப்பு', notAvailable: 'கிடைக்கவில்லை',
    diabeticSince: 'நீரிழிவு நோய் பாதிப்பு', years: 'ஆண்டுகள்',
    grades: [
        'நீரிழிவு விழித்திரை நோய் இல்லை', 'லேசான விழித்திரை நோய்',
        'மிதமான விழித்திரை நோய்', 'கடுமையான விழித்திரை நோய்',
        'தீவிர நீரிழிவு விழித்திரை நோய்'
    ],
    protocols: [
        ['தரம் 0', 'ஆண்டுதோறும் வழக்கமான கண்காணிப்பு', '12 மாதங்கள்'],
        ['தரம் 1', 'நெருக்கமான மருத்துவ கவனிப்பு', '6 மாதங்கள்'],
        ['தரம் 2', 'கண் மருத்துவரிடம் பரிந்துரை', '3 மாதங்களுக்குள்'],
        ['தரம் 3', 'அவசர சிகிச்சை பரிந்துரை', '2 வாரங்களுக்குள்'],
        ['தரம் 4', 'அவசர லேசர் சிகிச்சை', 'உடனடியாக']
    ],
    notes: {
        vascular: 'மருத்துவ தொடர்பு தேவைப்படும் வாஸ்குலர் அசாதாரணம்.',
        hemorrhage: 'கடுமையான மைக்ரோவாஸ்குலர் துயரத்தைக் குறிக்கிறது.',
        exudates: 'செயலில் உள்ள விழித்திரை எடிமாவைக் குறிக்கிறது.'
    }
},
'hi-IN': {
    title: 'रेटिनास्कैन एआई+', sub: 'एआई-संचालित डायबिटिक रेटिनोपैथी स्क्रीनिंग',
    clinicalSummary: 'नैदानिक सारांश', riskLevel: 'जोखिम स्तर:',
    recommendation: 'सुझाव:', demographics: 'रोगी जनसांख्यिकी',
    patientName: 'रोगी का नाम', ageGender: 'आयु / लिंग', contact: 'संपर्क',
    history: 'मधुमेह का इतिहास', followUp: 'फॉलो-अप प्रोटोकॉल',
    lesionTitle: 'एआई घाव पहचान सूची',
    rightEye: 'दाहिनी आँख (OD)', leftEye: 'बाईं आँख (OS)',
    original: 'मूल स्कैन', heatmap: 'एआई हीटमैप', lesion: 'घाव मैपिंग',
    analyzedImage: 'विश्लेषण की गई छवि',
    reportId: 'रिपोर्ट आईडी', printed: 'मुद्रित तिथि', patientId: 'रोगी आईडी',
    camp: 'स्क्रीनिंग कैंप', confidence: 'सटीकता', significance: 'नैदानिक महत्व',
    grade: 'श्रेणी', outcome: 'स्क्रीनिंग परिणाम', timeline: 'समय सीमा',
    verification: 'डिजिटल सत्यापन', notAvailable: 'उपलब्ध नहीं',
    diabeticSince: 'मधुमेह से पीड़ित', years: 'वर्ष',
    grades: [
        'कोई डायबिटिक रेटिनोपैथी नहीं', 'हल्का गैर-प्रोलिफ़ेरेटिव डी.आर.',
        'मध्यम गैर-प्रोलिफ़ेरेटिव डी.आर.', 'गंभीर गैर-प्रोलिफ़ेरेटिव डी.आर.',
        'प्रोलिफ़ेरेटिव डायबिटिक रेटिनोपैथी'
    ],
    protocols: [
        ['ग्रेड 0', 'नियमित वार्षिक निगरानी', '12 महीने'],
        ['ग्रेड 1', 'करीब से नैदानिक अवलोकन', '6 महीने'],
        ['ग्रेड 2', 'नेत्र रोग विशेषज्ञ को रेफरल', '3 महीने के भीतर'],
        ['ग्रेड 3', 'तत्काल विशेषज्ञ रेफरल', '2 सप्ताह के भीतर'],
        ['ग्रेड 4', 'आपातकालीन लेजर हस्तक्षेप', 'तुरंत']
    ],
    notes: {
        vascular: 'नैदानिक सहसंबंध की आवश्यकता वाली संवहनी असामान्यता।',
        hemorrhage: 'इंट्रारेटिनल रक्तस्राव गंभीर सूक्ष्म संवहनी संकट को दर्शाता है।',
        exudates: 'सक्रिय रेटिनल एडिमा का सुझाव देने वाला रिसाव।'
    }
},
'te-IN': {
    title: 'రెటినాస్కాన్ AI+', sub: 'AI-ఆధారిత డయాబెటిక్ రెటినోపతి స్క్రీనింగ్',
    clinicalSummary: 'క్లినికల్ సారాంశం', riskLevel: 'ప్రమాద స్థాయి:',
    recommendation: 'సిఫార్సు:', demographics: 'రోగి వివరాలు',
    patientName: 'రోగి పేరు', ageGender: 'వయస్సు / లింగం', contact: 'సంప్రదింపు',
    history: 'డయాబెటిక్ చరిత్ర', followUp: 'తదుపరి ప్రోటోకాల్',
    lesionTitle: 'AI గాయం గుర్తింపు జాబితా',
    rightEye: 'కుడి కన్ను (OD)', leftEye: 'ఎడమ కన్ను (OS)',
    original: 'అసలు స్కాన్', heatmap: 'AI హీట్‌మ్యాప్', lesion: 'గాయం మ్యాపింగ్',
    analyzedImage: 'విశ్లేషించబడిన చిత్రం',
    reportId: 'రిపోర్ట్ ఐడి', printed: 'ముద్రించబడింది', patientId: 'రోగి ఐడి',
    camp: 'స్క్రీనింగ్ క్యాంప్', confidence: 'ఖచ్చితత్వం', significance: 'క్లినికల్ ప్రాముఖ్యత',
    grade: 'గ్రేడ్', outcome: 'స్క్రీనింగ్ ఫలితం', timeline: 'సమయ వ్యవధి',
    verification: 'డిజిటల్ వెరిఫికేషన్', notAvailable: 'అందుబాటులో లేదు',
    diabeticSince: 'డయాబెటిస్ ఉన్న కాలం', years: 'సంవత్సరాలు',
    grades: [
        'డయాబెటిక్ రెటినోపతి లేదు', 'తేలికపాటి రెటినోపతి',
        'మితమైన రెటినోపతి', 'తీవ్రమైన రెటినోపతి',
        'ప్రొలిఫెరేటివ్ రెటినోపతి'
    ],
    protocols: [
        ['గ్రేడ్ 0', 'రెగ్యులర్ వార్షిక పర్యవేక్షణ', '12 నెలలు'],
        ['గ్రేడ్ 1', 'క్లినికల్ పరిశీలన', '6 నెలలు'],
        ['గ్రేడ్ 2', 'నేత్ర వైద్యుని వద్దకు రిఫరల్', '3 నెలల లోపు'],
        ['గ్రేడ్ 3', 'తక్షణ నిపుణుల రిఫరల్', '2 వారాల లోపు'],
        ['గ్రేడ్ 4', 'ఎమర్జెన్సీ లేజర్ చికిత్స', 'తక్షణం']
    ],
    notes: {
        vascular: 'క్లినికల్ కోరిలేషన్ అవసరమయ్యే వాస్కులర్ అసాధారణత.',
        hemorrhage: 'తీవ్రమైన మైక్రోవాస్కులర్ ఇబ్బందిని సూచిస్తుంది.',
        exudates: 'రెటినల్ ఎడెమాను సూచించే ప్రోటీన్ లీకేజీ.'
    }
},
'kn-IN': {
    title: 'ರೆಟಿನಾ ಸ್ಕ್ಯಾನ್ AI+', sub: 'AI-ಚಾಲಿತ ಮಧುಮೇಹ ರೆಟಿನೋಪತಿ ಸ್ಕ್ರೀನಿಂಗ್',
    clinicalSummary: 'ಕ್ಲಿನಿಕಲ್ ಸಾರಾಂಶ', riskLevel: 'ಅಪಾಯದ ಮಟ್ಟ:',
    recommendation: 'ಶಿಫಾರಸು:', demographics: 'ರೋಗಿಯ ಜನಸಂಖ್ಯಾಶಾಸ್ತ್ರ',
    patientName: 'ರೋಗಿಯ ಹೆಸರು', ageGender: 'ವಯಸ್ಸು / ಲಿಂಗ', contact: 'ಸಂಪರ್ಕಿಸಿ',
    history: 'ಮಧುಮೇಹ ಇತಿಹಾಸ', followUp: 'ಫಾಲೋ-ಅಪ್ ಪ್ರೋಟೋಕಾಲ್',
    lesionTitle: 'AI ಗಾಯದ ಪತ್ತೆ ಪಟ್ಟಿ',
    rightEye: 'ಬಲ ಕಣ್ಣು (OD)', leftEye: 'ಎಡ ಕಣ್ಣು (OS)',
    original: 'ಮೂಲ ಸ್ಕ್ಯಾನ್', heatmap: 'AI ಶಾಖ ನಕ್ಷೆ', lesion: 'ಗಾಯದ ಮ್ಯಾಪಿಂಗ್',
    analyzedImage: 'ವಿಶ್ಲೇಷಿಸಿದ ಚಿತ್ರ',
    reportId: 'ವರದಿ ಐಡಿ', printed: 'ಮುದ್ರಿಸಲಾಗಿದೆ', patientId: 'ರೋಗಿಯ ಐಡಿ',
    camp: 'ತಪಾಸಣಾ ಶಿಬಿರ', confidence: 'ನಿಖರತೆ', significance: 'ಕ್ಲಿನಿಕಲ್ ಮಹತ್ವ',
    grade: 'ಶ್ರೇಣಿ', outcome: 'ತಪಾಸಣಾ ಫಲಿತಾಂಶ', timeline: 'ಸಮಯದ ಮಿತಿ',
    verification: 'ಡಿಜಿಟಲ್ ಪರಿಶೀಲನೆ', notAvailable: 'ಲಭ್ಯವಿಲ್ಲ',
    diabeticSince: 'ಮಧುಮೇಹ ಇರುವ ವರ್ಷಗಳು', years: 'ವರ್ಷಗಳು',
    grades: [
        'ಮಧುಮೇಹ ರೆಟಿನೋಪತಿ ಇಲ್ಲ', 'ಸೌಮ್ಯ ರೆಟಿನೋಪತಿ',
        'ಮಧ್ಯಮ ರೆಟಿನೋಪತಿ', 'ತೀವ್ರ ರೆಟಿನೋಪತಿ',
        'ಪ್ರೊಲಿಫೆರೇಟಿವ್ ರೆಟಿನೋಪತಿ'
    ],
    protocols: [
        ['ಶ್ರೇಣಿ 0', 'ನಿಯಮಿತ ವಾರ್ಷಿಕ ಮೇಲ್ವಿಚಾರಣೆ', '12 ತಿಂಗಳು'],
        ['ಶ್ರೇಣಿ 1', 'ನಿಕಟ ಕ್ಲಿನಿಕಲ್ ವೀಕ್ಷಣೆ', '6 ತಿಂಗಳು'],
        ['ಶ್ರೇಣಿ 2', 'ನೇತ್ರತಜ್ಞರ ಬಳಿಗೆ ಉಲ್ಲೇಖ', '3 ತಿಂಗಳೊಳಗೆ'],
        ['ಶ್ರೇಣಿ 3', 'ತುರ್ತು ತಜ್ಞರ ಉಲ್ಲೇಖ', '2 ವಾರಗಳೊಳಗೆ'],
        ['ಶ್ರೇಣಿ 4', 'ತುರ್ತು ಲೇಸರ್ ಚಿಕಿತ್ಸೆ', 'ತಕ್ಷಣ']
    ],
    notes: {
        vascular: 'ಕ್ಲಿನಿಕಲ್ ಪರಸ್ಪರ ಸಂಬಂಧ ಅಗತ್ಯವಿರುವ ನಾಳೀಯ ಅಸಹಜತೆ.',
        hemorrhage: 'ತೀವ್ರವಾದ ಮೈಕ್ರೋವಾಸ್ಕುಲರ್ ಸಂಕಟವನ್ನು ಸೂಚಿಸುತ್ತದೆ.',
        exudates: 'ರೆಟಿನಾ ಎಡಿಮಾವನ್ನು ಸೂಚಿಸುವ ಸೋರಿಕೆ.'
    }
},
'ml-IN': {
    title: 'റെറ്റിനസ്കാൻ AI+', sub: 'എഐ-അധിഷ്ഠിത ഡയബറ്റിക് റെറ്റിനോപ്പതി സ്ക്രീനിംഗ്',
    clinicalSummary: 'ക്ലിനിക്കൽ സംഗ്രഹം', riskLevel: 'അപകടസാധ്യതാ നില:',
    recommendation: 'ശുപാർശ:', demographics: 'രോഗിയുടെ വിവരങ്ങൾ',
    patientName: 'രോഗിയുടെ പേര്', ageGender: 'പ്രായം / ലിംഗം', contact: 'ബന്ധപ്പെടുക',
    history: 'പ്രമേഹ ചരിത്രം', followUp: 'തുടർനടപടി പ്രോട്ടോക്കോൾ',
    lesionTitle: 'AI പ്യൂൺ കണ്ടെത്തൽ പട്ടിക',
    rightEye: 'വലത് കണ്ണ് (OD)', leftEye: 'ഇടത് കണ്ണ് (OS)',
    original: 'യഥാർത്ഥ സ്കാൻ', heatmap: 'AI ഹീറ്റ്മാപ്പ്', lesion: 'ലെസിയോൻ മാപ്പിംഗ്',
    analyzedImage: 'വിശകലനം ചെയ്ത ചിത്രം',
    reportId: 'റിപ്പോർട്ട് ഐഡി', printed: 'അച്ചടിച്ചത്', patientId: 'രോഗി ഐഡി',
    camp: 'സ്ക്രീനിംഗ് ക്യാമ്പ്', confidence: 'കൃത്യത', significance: 'ക്ലിനിക്കൽ പ്രാധാന്യം',
    grade: 'ഗ്രേഡ്', outcome: 'സ്ക്രീനിംഗ് ഫലം', timeline: 'സമയപരിധി',
    verification: 'ഡിജിറ്റൽ വെരിഫിക്കേഷൻ', notAvailable: 'ലഭ്യമല്ല',
    diabeticSince: 'പ്രമേഹം ബാധിച്ച വർഷം', years: 'വർഷങ്ങൾ',
    grades: [
        'ഡയബറ്റിക് റെറ്റിനോപ്പതി ഇല്ല', 'നേരിയ റെറ്റിനോപ്പതി',
        'മിതമായ റെറ്റിനോപ്പതി', 'കഠിനമായ റെറ്റിനോപ്പതി',
        'പ്രോലിഫെറേറ്റീവ് റെറ്റിനോപ്പതി'
    ],
    protocols: [
        ['ഗ്രേഡ് 0', 'വാർഷിക നിരീക്ഷണം', '12 മാസം'],
        ['ഗ്രേഡ് 1', 'ക്ലിനിക്കൽ നിരീക്ഷണം', '6 മാസം'],
        ['ഗ്രേഡ് 2', 'നേത്രരോഗ വിദഗ്ദ്ധനെ കാണുക', '3 മാസത്തിനുള്ളിൽ'],
        ['ഗ്രേഡ് 3', 'അടിയന്തിര വിദഗ്ദ്ധ പരിശോധന', '2 ആഴ്ചയ്ക്കുള്ളിൽ'],
        ['ഗ്രേഡ് 4', 'അടിയന്തിര ലേസർ ചികിത്സ', 'ഉടൻ']
    ],
    notes: {
        vascular: 'ക്ലിനിക്കൽ പരിശോധന ആവശ്യമായ രക്തക്കുഴലുകളിലെ തകരാർ.',
        hemorrhage: 'കഠിനമായ മൈക്രോവാസ്കുലർ പ്രശ്നത്തെ സൂചിപ്പിക്കുന്നു.',
        exudates: 'റെറ്റിനൽ എഡിമയെ സൂചിപ്പിക്കുന്ന ദ്രാവകം.'
    }
},
};

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

// Grade descriptions are now localized within the translation object.

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
function drawReportHeader(pdf, reportId, yPos, T, fontFamily = 'helvetica') {
    const now = new Date();
    const dateString = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeString = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    pdf.setFont(fontFamily, 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(...COLORS.BLUE_BRAND);
    pdf.text(T.title, MARGIN, yPos + 4);

    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.GRAY_TEXT);
    pdf.setFont(fontFamily, 'normal');
    pdf.text(T.sub, MARGIN, yPos + 10);

    pdf.setFont(fontFamily, 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(50, 50, 50);
    pdf.text(`${T.reportId}: ${reportId}`, PAGE_WIDTH - MARGIN, yPos + 2, { align: 'right' });

    pdf.setFontSize(8);
    pdf.setFont(fontFamily, 'normal');
    pdf.text(`${T.printed}: ${dateString} ${timeString}`, PAGE_WIDTH - MARGIN, yPos + 7, { align: 'right' });

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
function drawReportFooter(pdf, pageNumber, totalPages, fontFamily = 'helvetica') {
    const footerY = PAGE_HEIGHT - 12;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, footerY - 3, PAGE_WIDTH - MARGIN, footerY - 3);

    pdf.setFontSize(7);
    pdf.setFont(fontFamily, 'normal');
    pdf.setTextColor(150, 150, 150);
    // Keeping technical labels clearly visible in English as requested, while footer itself is paginated
    pdf.text(`AI Engine: EfficientNetB3 + YOLOv8 Offline | Powered by Clustrex  Page ${pageNumber} of ${totalPages}`, MARGIN, footerY + 4);
}

/**
 * Generates and downloads a comprehensive 2-page clinical report.
 * 
 * @param {Object} data - Contains patient details, AI results, and image previews.
 * @returns {Promise<Object>} The generated report metadata.
 */
export async function generatePDF({ patient = {}, result = {}, imagePreview = null, record = null, language = 'en-IN' }) {
    const T = PDF_TRANSLATIONS[language] || PDF_TRANSLATIONS['en-IN'];
    let currentY = 15;

    try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const reportId = result.report_id || `RS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`;
        
        let fontFamily = 'helvetica';
        let currentPage = 1;
        
        // --- MULTI-LANGUAGE FONT SUPPORT ---
        // Load language-specific fonts dynamically
        const fontResult = await loadLanguageFont(pdf, language);
        fontFamily = fontResult.fontFamily;

        // --- PAGE 1: CLINICAL SUMMARY & DEMOGRAPHICS ---
        currentY = drawReportHeader(pdf, reportId, 15, T, fontFamily);

        // 1. Clinical Summary Box
        const summaryBoxHeight = 32;
        const isHighRisk = result.grade >= 3;
        const riskColor = isHighRisk ? COLORS.RED_ALERT : (result.grade >= 1 ? COLORS.YELLOW_WARN : COLORS.BLUE_BRAND);

        pdf.setDrawColor(...riskColor);
        pdf.setLineWidth(1.5);
        pdf.roundedRect(MARGIN, currentY, CONTENT_WIDTH, summaryBoxHeight, 2, 2, 'S');

        pdf.setFontSize(13);
        pdf.setFont(fontFamily, 'bold');
        pdf.setTextColor(40, 40, 40);
        pdf.text(T.clinicalSummary, PAGE_WIDTH / 2, currentY + 8, { align: 'center' });

        pdf.setFontSize(16);
        pdf.setTextColor(...riskColor);
        pdf.text(`${T.riskLevel} ${result.risk_level || (isHighRisk ? 'HIGH' : 'LOW')}`, PAGE_WIDTH / 2, currentY + 16, { align: 'center' });

        pdf.setFontSize(10);
        pdf.setFont(fontFamily, 'normal');
        pdf.setTextColor(100, 100, 100);
        // Using localized grade descriptions
        const gradeDesc = T.grades[result.grade || 0] || T.grades[0];
        const confidenceVal = isNaN(result.confidence) ? (result.grade ? 0.95 : 0.99) : (result.confidence || 0.99);
        pdf.text(`${gradeDesc} (${Math.round(confidenceVal * 100)}% Confidence)`, PAGE_WIDTH / 2, currentY + 22, { align: 'center' });

        pdf.setFont(fontFamily, 'bold');
        pdf.setTextColor(60, 60, 60);
        // Localizing recommendation if possible, otherwise keeping provided
        pdf.text(`${T.recommendation} ${result.urgency || 'Monitor closely'}`, PAGE_WIDTH / 2, currentY + 28, { align: 'center' });

        currentY += summaryBoxHeight + 12;

        // 2. Patient Demographics Table
        pdf.setFillColor(...COLORS.BLUE_BRAND);
        pdf.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'F');
        pdf.setFont(fontFamily, 'bold'); // FIXED: Was 'helvetica'
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        pdf.text(T.demographics, PAGE_WIDTH / 2, currentY + 5.5, { align: 'center' });
        currentY += 8;

        const demographicData = [
            [T.patientName, patient.name || 'Anonymous'],
            [T.ageGender, `${patient.age || '--'} / ${patient.gender || '--'}`],
            [T.patientId, patient.patientId || reportId],
            [T.contact, patient.contact || '--'],
            [T.history, `${T.diabeticSince} ${patient.diabeticSince || 0} ${T.years}`],
            [T.camp, patient.campName || 'Rural Outpost']
        ];

        demographicData.forEach(([label, value], index) => {
            pdf.setDrawColor(230, 230, 230);
            pdf.setLineWidth(0.1);
            if (index % 2 === 0) pdf.setFillColor(...COLORS.GRAY_BG);
            else pdf.setFillColor(255, 255, 255);

            pdf.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'F');
            pdf.rect(MARGIN, currentY, 60, 8, 'S');
            pdf.rect(MARGIN + 60, currentY, CONTENT_WIDTH - 60, 8, 'S');

            pdf.setFont(fontFamily, 'normal');
            pdf.setTextColor(80, 80, 80);
            pdf.text(label, MARGIN + 5, currentY + 5.5);

            pdf.setTextColor(30, 30, 30);
            pdf.text(String(value), MARGIN + 65, currentY + 5.5);
            currentY += 8;
        });
        currentY += 12;

        // 3. AI Imaging Panels
        // Layout: up to 2 rows (Right Eye + Left Eye), each with 3 panels:
        //   [Original Scan] [AI Heatmap] [Lesion Mapping]
        const imagePanelSize = 55;  // panel side length in mm
        const panelGap = 5;         // gap between panels
        const labelHeight = 8;      // height reserved for panel label below image
        const eyeRowHeight = imagePanelSize + labelHeight + 6; // total height per eye row

        // Determine images for right eye (OD)
        const odOrigSrc  = record?.rightEye?.image_url  || imagePreview;
        const odHeatSrc  = record?.rightEye?.heatmap_url || result.heatmap_url;
        const odYoloDet  = record?.rightEye?.yoloDetections || result.yolo;

        // Determine images for left eye (OS)
        const osOrigSrc  = record?.leftEye?.image_url  || null;
        const osHeatSrc  = record?.leftEye?.heatmap_url || null;
        const osYoloDet  = record?.leftEye?.yoloDetections || null;

        const hasLeftEye = !!(osOrigSrc);

        // Load all images in parallel
        const [odOrigImg, odHeatImg, osOrigImg, osHeatImg] = await Promise.all([
            loadImageAsync(odOrigSrc),
            loadImageAsync(odHeatSrc),
            loadImageAsync(osOrigSrc),
            loadImageAsync(osHeatSrc),
        ]);

        /**
         * Draw one row of 3 image panels for a single eye.
         * @param {number} rowY - Top-left Y position for this row
         * @param {string} eyeLabel - e.g. "Right Eye (OD)"
         * @param {HTMLImageElement|null} origImg
         * @param {HTMLImageElement|null} heatImg
         * @param {Object|null} yoloData - yolo detection result with detections + image_shape
         */
        const drawEyeRow = (rowY, eyeLabel, origImg, heatImg, yoloData) => {
            // Row eye label
            pdf.setFont(fontFamily, 'bold');
            pdf.setFontSize(9);
            pdf.setTextColor(46, 117, 182);
            pdf.text(eyeLabel, MARGIN, rowY - 1);

            const panels = [
                { img: origImg,  label: T.original, applyYolo: false },
                { img: heatImg,  label: T.heatmap,    applyYolo: false },
                { img: origImg,  label: T.lesion, applyYolo: true  },
            ];

            panels.forEach(({ img, label, applyYolo }, panelIdx) => {
                const xCoord = MARGIN + panelIdx * (imagePanelSize + panelGap);

                pdf.setDrawColor(200, 200, 200);
                pdf.setLineWidth(0.2);
                pdf.rect(xCoord, rowY, imagePanelSize, imagePanelSize);

                if (img) {
                    pdf.addImage(img, 'JPEG', xCoord, rowY, imagePanelSize, imagePanelSize);
                } else {
                    // No image placeholder
                    pdf.setFillColor(240, 240, 240);
                    pdf.rect(xCoord, rowY, imagePanelSize, imagePanelSize, 'F');
                    pdf.setFont(fontFamily, 'normal');
                    pdf.setFontSize(7);
                    pdf.setTextColor(160, 160, 160);
                    pdf.text(T.notAvailable, xCoord + imagePanelSize / 2, rowY + imagePanelSize / 2, { align: 'center' });
                }

                // YOLO bounding box overlay on the Lesion Mapping panel
                if (applyYolo && yoloData?.detections?.length > 0) {
                    const [sourceH, sourceW] = yoloData.image_shape || [640, 640];
                    yoloData.detections.forEach(detection => {
                        const bbox = detection.bbox || [0, 0, 0, 0];
                        const [x1, y1, x2, y2] = bbox;
                        const boxX = xCoord + (x1 / sourceW) * imagePanelSize;
                        const boxY = rowY   + (y1 / sourceH) * imagePanelSize;
                        const boxW = Math.max(0.5, ((x2 - x1) / sourceW) * imagePanelSize);
                        const boxH = Math.max(0.5, ((y2 - y1) / sourceH) * imagePanelSize);
                        if (detection.class_id === 0)      pdf.setDrawColor(255, 0, 0);
                        else if (detection.class_id === 1) pdf.setDrawColor(255, 204, 0);
                        else                               pdf.setDrawColor(255, 255, 0);
                        pdf.setLineWidth(0.4);
                        pdf.rect(boxX, boxY, boxW, boxH, 'S');
                    });
                }

                // Panel label below image
                pdf.setFontSize(8);
                pdf.setTextColor(80, 80, 80);
                pdf.setFont(fontFamily, 'normal');
                pdf.text(label, xCoord + imagePanelSize / 2, rowY + imagePanelSize + 5, { align: 'center' });
            });
        };

        // --- CLINICAL IMAGING SECTION ---
        // We always show both eyes (Right OD and Left OS) for a professional clinical layout.
        const labelOD = (record?.rightEye || !record?.leftEye) ? T.rightEye : T.rightEye; // Simplified to always label OD
        
        drawEyeRow(currentY + 5, T.rightEye, odOrigImg, odHeatImg, odYoloDet);
        currentY += eyeRowHeight;

        drawEyeRow(currentY, T.leftEye, osOrigImg, osHeatImg, osYoloDet);
        currentY += eyeRowHeight;

        // --- LAYOUT CHECK FOR INVENTORY ---
        const yoloDetections = result.yolo?.detections || [];
        const summaryStatistics = yoloDetections.reduce((total, det) => {
            if (!total[det.class_name]) total[det.class_name] = { count: 0, maxConfidence: 0 };
            total[det.class_name].count++;
            total[det.class_name].maxConfidence = Math.max(total[det.class_name].maxConfidence, det.confidence);
            return total;
        }, {});
        const statsRows = Object.entries(summaryStatistics);
        const inventoryHeaderHeight = 20;
        const inventoryRowHeight = 12;
        const totalInventoryHeight = inventoryHeaderHeight + (statsRows.length * inventoryRowHeight);

        if (currentY + totalInventoryHeight > 270) {
           drawReportFooter(pdf, currentPage, 2, fontFamily);
           pdf.addPage();
           currentPage++;
           currentY = drawReportHeader(pdf, reportId, 15, T, fontFamily);
        }

        // 4. Lesion Inventory Table
        pdf.setFont(fontFamily, 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(40, 40, 40);
        pdf.text(T.lesionTitle, MARGIN, currentY);
        currentY += 5;

        pdf.setFillColor(235, 243, 250);
        pdf.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'F');
        pdf.setFontSize(8);
        pdf.setTextColor(...COLORS.BLUE_BRAND);
        pdf.text('YOLOv8 DETECTION', MARGIN + 5, currentY + 5.5);
        pdf.text(T.confidence, MARGIN + 100, currentY + 5.5);
        pdf.text(T.significance, MARGIN + 140, currentY + 5.5);
        currentY += 8;

        statsRows.forEach(([anomalyName, stats]) => {
            pdf.setDrawColor(230, 230, 230);
            pdf.line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY);

            pdf.setFont(fontFamily, 'normal');
            pdf.setTextColor(40, 40, 40);
            pdf.text(`${anomalyName} (×${stats.count})`, MARGIN + 5, currentY + 5);
            pdf.text(`${Math.round(stats.maxConfidence * 100)}%`, MARGIN + 100, currentY + 5);

            let clinicalNote = T.notes.vascular;
            if (anomalyName.includes("Bleeding") || anomalyName.includes("Hemorrhage")) clinicalNote = T.notes.hemorrhage;
            if (anomalyName.includes("Exudates")) clinicalNote = T.notes.exudates;

            const wrappedNote = pdf.splitTextToSize(clinicalNote, CONTENT_WIDTH - 145);
            pdf.text(wrappedNote, MARGIN + 140, currentY + 5);
            currentY += inventoryRowHeight;
        });

        // --- FOLLOW-UP PROTOCOL (flows continuously on same page) ---
        currentY += 10;

        // Check if Follow-Up table fits (~60mm needed for header + 5 rows + spacing)
        const followUpHeight = 60;
        if (currentY + followUpHeight > 270) {
            drawReportFooter(pdf, currentPage, 2, fontFamily);
            pdf.addPage();
            currentPage++;
            currentY = drawReportHeader(pdf, reportId, 15, T, fontFamily);
        }

        // 5. Follow-Up Protocol Table
        pdf.setFont(fontFamily, 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(40, 40, 40);
        pdf.text(T.followUp, MARGIN, currentY);
        currentY += 6;

        pdf.setFillColor(...COLORS.GRAY_BG);
        pdf.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'F');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(T.grade, MARGIN + 5, currentY + 5.5);
        pdf.text(T.outcome, MARGIN + 60, currentY + 5.5);
        pdf.text(T.timeline, MARGIN + 160, currentY + 5.5);
        currentY += 8;

        const managementProtocols = T.protocols;

        managementProtocols.forEach(([gradeName, description, period], idx) => {
            const isPatientGrade = (idx === result.grade);
            if (isPatientGrade) {
                pdf.setFillColor(255, 250, 240);
                pdf.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'F');
                pdf.setTextColor(...COLORS.RED_ALERT);
                pdf.setFont(fontFamily, 'bold');
            } else {
                pdf.setTextColor(60, 60, 60);
                pdf.setFont(fontFamily, 'normal');
            }
            pdf.setDrawColor(220, 220, 220);
            pdf.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'S');

            pdf.text(gradeName, MARGIN + 5, currentY + 5.5);
            pdf.text(description, MARGIN + 60, currentY + 5.5);
            pdf.text(period, MARGIN + 160, currentY + 5.5);
            currentY += 8;
        });

        // 6. Security & Verification (QR Code) — placed after protocol table
        currentY += 8;
        const qrDimension = 20;
        const qrPositionX = MARGIN;
        const qrPositionY = currentY;

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

        pdf.setFont(fontFamily, 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(...COLORS.BLUE_BRAND);
        pdf.text(T.verification, qrPositionX + qrDimension / 2, qrPositionY + qrDimension + 4, { align: 'center' });

        // Determine total pages used
        const totalPages = pdf.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            pdf.setPage(p);
            drawReportFooter(pdf, p, totalPages, fontFamily);
        }

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
