/**
 * cameraCapture.js — Utility functions for managing browser camera streams and frame capture.
 */

/**
 * Starts the camera stream and attaches it to a video element.
 * @param {HTMLVideoElement} videoElement - The video element to display the stream.
 * @param {string} facingMode - 'user' or 'environment'.
 * @returns {Promise<MediaStream>} The started media stream.
 */
export async function startCamera(videoElement, facingMode = 'environment') {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser.');
    }

    const constraints = {
        video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (videoElement) {
        videoElement.srcObject = stream;
    }
    return stream;
}

/**
 * Captures a single frame from a video element and returns it as a File and preview URL.
 * @param {HTMLVideoElement} videoElement - The source video element.
 * @returns {Promise<{file: File, previewUrl: string}>}
 */
export async function captureFrame(videoElement) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0);

        canvas.toBlob((blob) => {
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const previewUrl = URL.createObjectURL(blob);
            resolve({ file, previewUrl });
        }, 'image/jpeg', 0.9);
    });
}

/**
 * Stops all tracks in a media stream.
 * @param {MediaStream} stream - The stream to stop.
 */
export function stopCamera(stream) {
    if (stream && stream.getTracks) {
        stream.getTracks().forEach(track => track.stop());
    }
}
