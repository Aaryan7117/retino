# 👁️ RetinaScan AI

> **AI-Powered Diabetic Retinopathy Screening for Rural Indian Eye Camps**
>
> Offline-first · Multilingual · Explainable AI · Government-Ready (ABDM)

---

## 🚀 Quick Start

### Frontend (React 18 + Vite + TailwindCSS)

```bash
cd frontend
npm install       # already done on scaffold
npm run dev       # → http://localhost:5173
```

### Backend (FastAPI Python 3.11+)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload   # → http://127.0.0.1:8000
# Swagger UI: http://127.0.0.1:8000/docs
```

---

## 📁 Project Structure

```
retinopathy/
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # Router shell
│   │   ├── components/
│   │   │   ├── Dashboard.jsx          # Camp stats + patient queue
│   │   │   ├── Scanner.jsx            # Image upload + camera
│   │   │   ├── ResultsView.jsx        # Diagnosis display
│   │   │   ├── HeatmapOverlay.jsx     # Grad-CAM visualization
│   │   │   ├── VoiceGuide.jsx         # Multilingual TTS
│   │   │   ├── PDFGenerator.jsx       # Elite medical report
│   │   │   ├── CampDashboard.jsx      # Today's stats
│   │   │   ├── ABDMIntegration.jsx    # Health ID linking
│   │   │   └── OfflineIndicator.jsx   # Network status
│   │   ├── utils/
│   │   │   ├── modelInference.js      # ONNX Runtime Web
│   │   │   ├── imagePreprocessing.js  # Normalize pipeline
│   │   │   ├── qrGenerator.js         # QR code generation
│   │   │   └── indexedDB.js           # Offline storage
│   │   └── service-worker.js
│   ├── public/
│   │   ├── manifest.json
│   │   ├── models/                    # retina_model.onnx (Section 2)
│   │   └── sample-data/
│   │       └── demo-cases.json        # 5 pre-loaded demo patients
│   └── package.json
├── backend/
│   ├── main.py                        # FastAPI app + CORS
│   ├── models/
│   │   ├── efficientnet_model.py      # EfficientNetB3 wrapper
│   │   └── gradcam.py                 # Grad-CAM heatmap
│   ├── routes/
│   │   ├── inference.py               # POST /api/inference
│   │   ├── report.py                  # POST /api/report
│   │   └── abdm_mock.py               # POST /api/abdm/link-report
│   └── requirements.txt
└── README.md
```

---

## 🗺️ Implementation Roadmap

| Section | Feature                        | Status     |
|---------|-------------------------------|------------|
| 1       | Project Foundation             | ✅ Done    |
| 2       | AI Model & Inference Engine    | ✅ Done    |
| 3       | Frontend UI — Doctor-Grade     | ✅ Done    |
| 4       | Voice Assistant (Multilingual) | ✅ Done    |
| 5       | PDF Report — Elite Medical     | ✅ Done    |
| 6       | Camp Dashboard                 | ✅ Done    |
| 7       | ABDM Integration               | ✅ Done    |
|---------|-------------------------------|------------|
| 8       | Offline-First PWA              | ✅ Done    |
| 9       | Business Model Page            | ✅ Done    |
| 10      | Validation Metrics Page        | ✅ Done    |
| 11      | Demo Script                    | ✅ Done    |
| 12      | Judge Q&A Cheat Sheet          | ✅ Done    |
| 13      | Final Checklist                | ✅ Done    |

---

## 🛠️ Tech Stack

| Layer        | Technology                              |
|--------------|-----------------------------------------|
| Frontend     | React 18, Vite, TailwindCSS v3, PWA     |
| AI Inference | ONNX Runtime Web (browser), EfficientNetB3 |
| Explainability | Grad-CAM heatmaps                     |
| PDF          | jsPDF + html2canvas                     |
| Voice        | Web Speech API                          |
| Storage      | IndexedDB (idb library) — offline-first |
| Backend      | FastAPI (Python 3.11+), PyTorch, ONNX   |
| Deployment   | Vercel (frontend) + Cloud/Local (backend) |

---

## 📋 API Endpoints

| Method | Path                    | Description               |
|--------|------------------------|---------------------------|
| GET    | `/health`              | Health check              |
| POST   | `/api/inference/`      | Run inference on image    |
| POST   | `/api/report/`         | Generate PDF report       |
| POST   | `/api/abdm/link-report`| Link to ABHA Health ID    |

Swagger UI: `http://127.0.0.1:8000/docs`

---

*RetinaScan AI · Clustrex Hackathon Prototype · Not a substitute for licensed medical diagnosis*
