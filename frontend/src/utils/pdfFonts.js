/**
 * pdfFonts.js — Multi-language font support for PDF generation
 * 
 * Provides language-specific fonts for proper rendering of Indian scripts.
 */

// Track which fonts have been registered
const registeredFonts = new Set();

/**
 * Loads and registers a language-specific font with jsPDF
 * @param {jsPDF} pdf - jsPDF instance
 * @param {string} language - Language code
 * @returns {Promise<{fontFamily: string, isLoaded: boolean}>}
 */
export async function loadLanguageFont(pdf, language) {
    console.log(`[PDF Fonts] Loading font for language: ${language}`);
    
    // English uses built-in helvetica
    if (language === 'en-IN') {
        console.log('[PDF Fonts] Using built-in Helvetica for English');
        return { fontFamily: 'helvetica', isLoaded: true };
    }
    
    const fontConfig = {
        'hi-IN': { name: 'Hind', file: 'Hind-Regular.ttf' },
        'ta-IN': { name: 'NotoSansTamil', file: 'NotoSansTamil-Regular.ttf' },
        'te-IN': { name: 'NotoSansTelugu', file: 'NotoSansTelugu-Regular.ttf' },
        'kn-IN': { name: 'NotoSansKannada', file: 'NotoSansKannada-Regular.ttf' },
        'ml-IN': { name: 'NotoSansMalayalam', file: 'NotoSansMalayalam-Regular.ttf' }
    };
    
    const config = fontConfig[language];
    if (!config) {
        console.warn(`[PDF Fonts] Unknown language: ${language}, using Hind fallback`);
        // Try to load Hind as fallback
        const fallbackLoaded = await loadLocalFont(pdf, 'hi-IN', 'Hind', 'Hind-Regular.ttf');
        return { fontFamily: 'Hind', isLoaded: fallbackLoaded };
    }
    
    // Check if already registered
    if (registeredFonts.has(language)) {
        console.log(`[PDF Fonts] Font already registered for ${language}: ${config.name}`);
        return { fontFamily: config.name, isLoaded: true };
    }
    
    // Try to load from local public folder (Fast & Offline)
    let loaded = await loadLocalFont(pdf, language, config.name, config.file);
    
    // If local fetch fails (unlikely in prod), try Google Fonts CDN
    if (!loaded) {
        console.warn(`[PDF Fonts] Local fetch failed for ${config.name}, trying Google Fonts...`);
        loaded = await loadGoogleFont(pdf, language, config.name);
    }
    
    if (loaded) {
        registeredFonts.add(language);
        return { fontFamily: config.name, isLoaded: true };
    }
    
    return { fontFamily: 'helvetica', isLoaded: false };
}

/**
 * Loads font from local public/fonts directory
 */
async function loadLocalFont(pdf, language, fontName, fileName) {
    try {
        const fontUrl = `/fonts/${fileName}`;
        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const buffer = await response.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        
        pdf.addFileToVFS(fileName, base64);
        pdf.addFont(fileName, fontName, 'normal');
        pdf.addFont(fileName, fontName, 'bold');
        
        console.log(`[PDF Fonts] Local font registered: ${fontName}`);
        return true;
    } catch (error) {
        console.error(`[PDF Fonts] Failed to load local font ${fontName}:`, error);
        return false;
    }
}

/**
 * Load font from Google Fonts
 * Uses Google Fonts API v2 to get the CSS, then extracts the TTF URL
 */
async function loadGoogleFont(pdf, language, fontName) {
    // Google Fonts CSS API URLs
    const cssUrls = {
        'ta-IN': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;700&display=swap',
        'te-IN': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;700&display=swap',
        'kn-IN': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;700&display=swap',
        'ml-IN': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;700&display=swap'
    };
    
    const cssUrl = cssUrls[language];
    if (!cssUrl) {
        console.error(`[PDF Fonts] No CSS URL for language: ${language}`);
        return false;
    }
    
    try {
        console.log(`[PDF Fonts] Fetching CSS from: ${cssUrl}`);
        
        // Fetch with no-cors mode to handle CORS issues
        const cssResponse = await fetch(cssUrl, { 
            method: 'GET',
            headers: { 'Accept': 'text/css' }
        });
        
        if (!cssResponse.ok) {
            throw new Error(`CSS fetch failed: ${cssResponse.status}`);
        }
        
        const cssText = await cssResponse.text();
        console.log(`[PDF Fonts] CSS fetched, length: ${cssText.length}`);
        
        // Extract TTF URLs - Google Fonts CSS contains src: url(...) format('truetype')
        // The CSS format varies, so we try multiple patterns
        let ttfUrlMatch = cssText.match(/src:\s*url\s*\(\s*['"]?([^'"]+\.ttf[^'"]*)['"]?\s*\)/i);
        
        // If no TTF found, try WOFF2 (newer browsers use WOFF2)
        if (!ttfUrlMatch) {
            ttfUrlMatch = cssText.match(/src:\s*url\s*\(\s*['"]?([^'"]+\.woff2[^'"]*)['"]?\s*\)/i);
        }
        
        // Try any URL
        if (!ttfUrlMatch) {
            ttfUrlMatch = cssText.match(/url\s*\(\s*['"]?([^'"]+)['"]?\s*\)/);
        }
        
        if (!ttfUrlMatch) {
            console.error('[PDF Fonts] No font URL found in CSS');
            console.log('[PDF Fonts] CSS content:', cssText.substring(0, 500));
            return false;
        }
        
        const fontUrl = ttfUrlMatch[1];
        console.log(`[PDF Fonts] Font URL found: ${fontUrl}`);
        
        // Fetch the actual font file
        const fontResponse = await fetch(fontUrl);
        if (!fontResponse.ok) {
            throw new Error(`Font fetch failed: ${fontResponse.status}`);
        }
        
        const fontBuffer = await fontResponse.arrayBuffer();
        console.log(`[PDF Fonts] Font fetched, size: ${fontBuffer.byteLength} bytes`);
        
        const fontBase64 = arrayBufferToBase64(fontBuffer);
        
        // Register with jsPDF
        const fileName = `${fontName}-Regular.ttf`;
        pdf.addFileToVFS(fileName, fontBase64);
        pdf.addFont(fileName, fontName, 'normal');
        pdf.addFont(fileName, fontName, 'bold');
        
        console.log(`[PDF Fonts] Font registered: ${fontName}`);
        return true;
        
    } catch (error) {
        console.error(`[PDF Fonts] Error loading font for ${language}:`, error);
        return false;
    }
}

/**
 * Converts ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Gets the appropriate font family for a language
 */
export function getFontFamily(language) {
    const fontMap = {
        'en-IN': 'helvetica',
        'hi-IN': 'Hind',
        'ta-IN': 'NotoSansTamil',
        'te-IN': 'NotoSansTelugu',
        'kn-IN': 'NotoSansKannada',
        'ml-IN': 'NotoSansMalayalam'
    };
    return fontMap[language] || 'Hind';
}

export default {
    loadLanguageFont,
    getFontFamily
};

/**
 * ============================================================
 * TROUBLESHOOTING: NO FONTS VISIBLE
 * ============================================================
 * 
 * If fonts are not showing:
 * 1. Check browser console for error messages
 * 2. Ensure you have internet connection (for CDN fonts)
 * 3. Check if CORS is blocking font loading
 * 
 * FOR 100% OFFLINE SUPPORT:
 * Download fonts from https://fonts.google.com/noto/fonts
 * Convert TTF to Base64 and embed directly in this file.
 */
