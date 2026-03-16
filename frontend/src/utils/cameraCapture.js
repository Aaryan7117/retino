export async function startCamera(videoEl, facingMode = 'environment') {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1920 } }
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    return stream;
  } catch (e) {
    if (e.name === 'NotAllowedError') throw new Error('Camera permission denied. Please allow camera access in browser settings.');
    if (e.name === 'NotFoundError') throw new Error('No camera found on this device.');
    throw new Error('Camera error: ' + e.message);
  }
}

export function captureFrame(videoEl) {
  const c = document.createElement('canvas');
  c.width = videoEl.videoWidth;
  c.height = videoEl.videoHeight;
  c.getContext('2d').drawImage(videoEl, 0, 0);
  const previewUrl = c.toDataURL('image/jpeg', 0.92);
  return new Promise(resolve =>
    c.toBlob(blob =>
      resolve({ file: new File([blob], 'retina_capture.jpg', { type: 'image/jpeg' }), previewUrl }),
    'image/jpeg', 0.92)
  );
}

export function stopCamera(stream) {
  stream?.getTracks().forEach(t => t.stop());
}
