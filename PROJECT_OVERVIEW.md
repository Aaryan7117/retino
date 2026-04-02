# 👁️ RetinaScan AI — Project Overview

> **AI-Powered Diabetic Retinopathy Screening for Rural Indian Eye Camps**
> Offline-first · Multilingual · Explainable AI · Government-Ready (ABDM)

---

## 🎯 Project Mission

RetinaScan AI is a mobile-first Progressive Web Application (PWA) designed to bring automated diabetic retinopathy screening to underserved rural communities in India. The system uses deep learning models to analyze retinal fundus images and provide instant, explainable diagnoses—empowering healthcare workers without specialized ophthalmology training.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (PWA)                          │
│  ┌─────────┐  ┌──────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │Dashboard│  │ Scanner   │  │ ResultsView │  │ CampDashboard│  │
│  └────┬────┘  └────┬─────┘  └──────┬──────┘  └──────┬───────┘  │
│       │            │               │                │          │
│  ┌────▼────────────▼───────────────▼────────────────▼───────┐  │
│  │                    ONNX Runtime Web                        │  │
│  │            (Browser-based AI Inference)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                    IndexedDB (Offline Storage)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Inference   │  │ PDF Report   │  │ ABDM Integration       │  │
│  │ (ONNX)      │  │ Generator    │  │ (ABHA Health ID)       │  │
│  └─────────────┘  └──────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧠 AI Models

| Model | Type | Purpose |
|-------|------|---------|
| `retina_model.onnx` | EfficientNetB3 | Binary classification (DR Present/Absent) |
| `yolo_lesions.onnx` | YOLOv8 | Multi-lesion detection and localization |

**Inference Modes:**
- **Browser (ONNX Runtime Web)** — Works offline, no server required
- **Server (FastAPI + ONNX Runtime)** — Higher accuracy processing

---

## 📁 Project Structure

```
sightsheild-AI/
├── frontend/                    # React 18 + Vite + TailwindCSS PWA
│   ├── src/
│   │   ├── App.jsx             # Main router shell
│   │   ├── components/         # UI components
│   │   │   ├── Auth.jsx        # Authentication (Supabase)
│   │   │   ├── Dashboard.jsx   # Patient queue & stats
│   │   │   ├── Scanner.jsx     # Camera/upload interface
│   │   │   ├── ResultsView.jsx # Diagnosis display
│   │   │   ├── YoloResultsPage.jsx # YOLO lesion detection
│   │   │   ├── CampDashboard.jsx # Eye camp statistics
│   │   │   ├── DoctorPortal.jsx # Doctor review interface
│   │   │   ├── ABDMIntegration.jsx # ABHA health ID linking
│   │   │   ├── BusinessModel.jsx # Sustainability model
│   │   │   ├── ValidationMetrics.jsx # Model performance
│   │   │   ├── VoiceGuide.jsx  # Multilingual TTS
│   │   │   ├── PDFGenerator.jsx # Medical report generation
│   │   │   └── OfflineIndicator.jsx # Network status
│   │   └── utils/
│   │       ├── modelInference.js # ONNX Runtime wrapper
│   │       ├── imagePreprocessing.js # Image normalization
│   │       ├── indexedDB.js # Offline data storage
│   │       ├── pdfReport.js  # PDF generation utilities
│   │       └── supabaseClient.js # Auth database
│   └── public/
│       ├── models/             # ONNX model files
│       ├── wasm/               # ONNX Runtime Web binaries
│       └── sample-data/        # Demo patient data
│
├── backend/                     # FastAPI Python backend
│   ├── main.py                 # Application entry point
│   ├── routes/
│   │   ├── inference.py        # POST /api/inference/
│   │   ├── report.py           # POST /api/report/
│   │   ├── abdm_mock.py        # POST /api/abdm/link-report
│   │   └── tts.py              # Text-to-speech endpoint
│   ├── models/                 # ONNX model files
│   └── requirements.txt        # Python dependencies
│
├── README.md
└── CONTRIBUTING.md
```

---

## 🌟 Key Features

### 1. **Offline-First PWA**
- Full functionality without internet connection
- IndexedDB for local patient data storage
- Automatic sync when connectivity restored
- Service worker for app caching

### 2. **AI-Powered Diagnosis**
- Dual-model approach (classification + detection)
- Browser-based inference using ONNX Runtime Web
- Server-side inference for higher accuracy
- Grad-CAM heatmap visualization for explainability

### 3. **Multilingual Voice Assistant**
- Text-to-speech guidance in multiple Indian languages
- Audio feedback for illiterate users
- Step-by-step scanning instructions

### 4. **Medical PDF Reports**
- Professional-grade diagnostic reports
- QR code linking to digital records
- Print-ready format for patient handoff

### 5. **ABDM Integration**
- ABHA Health ID linking
- Government-compliant data standards
- Secure health record transmission

### 6. **Eye Camp Management**
- Real-time screening statistics
- Patient queue management
- Camp performance analytics

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TailwindCSS v3, React Router |
| **AI Inference** | ONNX Runtime Web, EfficientNetB3, YOLOv8 |
| **Explainability** | Grad-CAM heatmaps |
| **Authentication** | Supabase Auth |
| **Offline Storage** | IndexedDB (idb library) |
| **PDF Generation** | jsPDF, html2canvas |
| **Voice** | Web Speech API |
| **Backend** | FastAPI (Python 3.11+), Uvicorn |
| **Deployment** | Vercel (frontend), Cloud/Local (backend) |

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/inference/` | Run AI inference on fundus image |
| POST | `/api/report/` | Generate PDF medical report |
| POST | `/api/abdm/link-report` | Link report to ABHA Health ID |
| GET | `/api/tts/` | Text-to-speech conversion |

---

## 👥 User Roles

| Role | Capabilities |
|------|-------------|
| **Healthcare Worker** | Scan patients, view results, generate reports |
| **Doctor** | Review flagged cases, provide final diagnosis |
| **Camp Manager** | View statistics, manage patient queue |

---

## 📊 Implementation Status

| Section | Feature | Status |
|---------|---------|--------|
| 1 | Project Foundation | ✅ Complete |
| 2 | AI Model & Inference Engine | ✅ Complete |
| 3 | Frontend UI — Doctor-Grade | ✅ Complete |
| 4 | Voice Assistant (Multilingual) | ✅ Complete |
| 5 | PDF Report — Elite Medical | ✅ Complete |
| 6 | Camp Dashboard | ✅ Complete |
| 7 | ABDM Integration | ✅ Complete |
| 8 | Offline-First PWA | ✅ Complete |
| 9 | Business Model Page | ✅ Complete |
| 10 | Validation Metrics Page | ✅ Complete |

---

## 🚀 Getting Started

### Frontend
```bash
cd frontend
npm install
npm run dev    # → http://localhost:5173
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload    # → http://127.0.0.1:8000
```

---

## ⚠️ Disclaimer

*RetinaScan AI is a prototype developed for the Clestrex Hackathon. It is not a substitute for licensed medical diagnosis. All AI predictions should be reviewed by a qualified healthcare professional.*
