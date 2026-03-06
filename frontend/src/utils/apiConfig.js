export const API_BASE_URL = import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8000'
        : 'https://retinopathy-api.onrender.com'); // Update this with your actual production backend URL if deployed
