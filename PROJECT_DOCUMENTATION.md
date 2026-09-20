# SightShield AI / RetinaScan AI — Complete Project Documentation

> **Repository:** `THOUFIKUR/sightsheild-AI`  
> **Product name used in the application:** RetinaScan AI  
> **Purpose:** AI-assisted diabetic-retinopathy screening for rural eye camps.  
> **Status:** Hackathon/prototype application; not a substitute for diagnosis by a licensed clinician.

## 1. Executive summary

SightShield AI is a mobile-first Progressive Web App (PWA) for capturing retinal/fundus images, estimating diabetic-retinopathy severity, highlighting possible lesions, storing screening records, and supporting referral workflows.

The application has two inference paths:

1. **Online path:** the React frontend sends the image to the FastAPI backend. The backend runs `retina_model.onnx` with ONNX Runtime, returns five-class severity grading, and the browser then runs YOLO lesion detection locally.
2. **Offline path:** a browser Web Worker loads both ONNX models from `frontend/public/models/` using `onnxruntime-web`. It performs grading, lesion detection, and heatmap generation without requiring the backend.

The product combines AI inference with authentication, patient onboarding, dual-eye screening, offline IndexedDB storage, Supabase synchronization, PDF reports, voice guidance, ABHA/ABDM linking, doctor review, camp statistics, and referral support.

## 2. Important naming note

The repository is named `sightsheild-AI`, while the UI and documentation call the product **RetinaScan AI**. The project is described as SightShield AI here, with RetinaScan AI used when referring to application labels and API names.

## 3. Repository structure

```text
sightsheild-AI/
├── README.md                         # Quick start, architecture summary, API list, roadmap
├── PROJECT_OVERVIEW.md               # Product mission, feature and architecture overview
├── CONTRIBUTING.md                   # Contribution guidance
├── build_error.txt                   # Captured frontend build output/warnings
├── SightShield_AI_Full_Bug_Report.pdf # Bug-report artifact
├── vercel.json                       # SPA rewrite: every route serves index.html
├── .gitattributes
├── .gitignore
│
├── frontend/                         # React/Vite PWA
│   ├── package.json                  # JavaScript dependencies and npm scripts
│   ├── package-lock.json
│   ├── index.html                    # Browser entry document
│   ├── vite.config.js                # Vite and PWA/build configuration
│   ├── tailwind.config.js            # Tailwind theme configuration
│   ├── postcss.config.js
│   ├── eslint.config.js
│   ├── vercel.json                   # Frontend SPA rewrites
│   ├── README.md                     # Generated Vite starter documentation
│   ├── lint_output.txt               # Captured lint output
│   │
│   ├── public/
│   │   ├── manifest.json             # PWA metadata/install configuration
│   │   ├── models/
│   │   │   ├── retina_model.onnx     # 43.7 MB; EfficientNet-style DR grading model
│   │   │   └── yolo_lesions.onnx     # 45.0 MB; YOLO lesion detector
│   │   ├── wasm/                     # ONNX Runtime Web WASM binaries
│   │   ├── sample-data/
│   │   │   ├── demo-cases.json       # Ten demo patient records
│   │   │   └── grade3.jpg             # Included sample fundus image
│   │   ├── fonts/
│   │   └── icons/
│   │
│   └── src/
│       ├── main.jsx                  # React DOM bootstrap
│       ├── App.jsx                   # Auth gate, routing, profile loading, layout, PWA events
│       ├── App.css
│       ├── index.css
│       ├── service-worker.js          # Workbox/PWA service-worker source
│       │
│       ├── components/
│       │   ├── Auth.jsx               # Supabase authentication UI
│       │   ├── RoleSelect.jsx         # Select doctor/patient role
│       │   ├── DoctorOnboarding.jsx   # Doctor profile setup
│       │   ├── PatientOnboarding.jsx  # Patient profile setup
│       │   ├── ProfilePage.jsx        # Profile management
│       │   ├── ResetPassword.jsx      # Password reset route
│       │   ├── Dashboard.jsx          # Patient history, queue, summary dashboard
│       │   ├── Scanner.jsx            # Dual-eye upload/camera screening workflow
│       │   ├── AutoRetinaCam.jsx      # Camera capture interface
│       │   ├── ResultsView.jsx         # Diagnosis, confidence, heatmaps, actions
│       │   ├── SplitHeatmapView.jsx    # Original-versus-heatmap display
│       │   ├── YoloResultsPage.jsx    # Lesion detection visualization
│       │   ├── CampDashboard.jsx      # Camp statistics and records
│       │   ├── DoctorPortal.jsx       # Doctor review workflow
│       │   ├── LongitudinalChart.jsx  # Patient progression/history chart
│       │   ├── FindDoctors.jsx        # Patient referral/doctor lookup
│       │   ├── ABDMIntegration.jsx    # ABHA report-linking UI
│       │   ├── PDFGenerator.jsx       # Medical PDF export UI
│       │   ├── VoiceGuide.jsx         # Multilingual scan/result guidance
│       │   ├── BusinessModel.jsx      # Sustainability/business presentation page
│       │   ├── ValidationMetrics.jsx  # Model validation/presentation page
│       │   ├── ScreeningModeToggle.jsx# Standard/preventative mode switch
│       │   ├── OfflineIndicator.jsx   # Browser connectivity indicator
│       │   └── BackendIndicator.jsx   # Backend availability/status indicator
│       │
│       └── utils/
│           ├── modelInference.js      # Online-first inference orchestration
│           ├── model.worker.js        # Browser ONNX inference worker
│           ├── imagePreprocessing.js  # Fundus validation, blur, normalization
│           ├── imageUtils.js          # Image and overlay helpers
│           ├── cameraCapture.js       # Camera utilities
│           ├── indexedDB.js           # Offline records, queue, reviews, audit log
│           ├── pdfReport.js            # Client-side PDF report generation
│           ├── pdfFonts.js             # PDF font support
│           ├── voiceAssistant.js       # Voice/text assistance logic
│           ├── hospitalLookup.js      # Hospital/doctor lookup helper
│           ├── supabaseClient.js       # Supabase client initialization
│           ├── auth.js                 # Sign-up, login, logout, current user
│           ├── screeningContext.js     # Screening mode React context
│           ├── screeningMode.js        # Thresholds and mode persistence
│           ├── registerSW.js            # Service-worker registration
│           └── ...                     # Additional utility helpers
│
└── backend/                          # FastAPI Python API
    ├── main.py                       # FastAPI app, CORS, router registration
    ├── requirements.txt              # Python runtime dependencies
    ├── backend_log.txt               # Captured backend log
    ├── test_inference.py             # Manual health/inference request script
    ├── test_yolo.py                  # Manual YOLO ONNX post-processing test
    ├── models/
    │   ├── retina_model.onnx         # Git LFS pointer; backend grading model
    │   └── __init__.py
    ├── routes/
    │   ├── inference.py              # POST /api/inference/
    │   ├── report.py                 # POST /api/report/pdf
    │   ├── abdm_mock.py              # POST /api/abdm/link-report
    │   ├── tts.py                   # GET /api/tts/
    │   └── __init__.py
    └── scripts/                      # Backend scripts directory
```

## 4. Technology stack

### Frontend

- React `19.2.0`
- Vite `7.3.1`
- React Router `7.13.1`
- TailwindCSS `3.4.19`
- `onnxruntime-web` `1.24.2`
- `vite-plugin-pwa` and Workbox
- IndexedDB through `idb`
- Supabase JavaScript client for authentication, database, and storage
- `jsPDF`, `html2canvas`, and QRCode for report generation
- Leaflet/react-leaflet for map/lookup experiences

### Backend

- Python 3.11+
- FastAPI `0.110.0`
- Uvicorn `0.29.0`
- ONNX Runtime `1.23.2`
- OpenCV headless and NumPy for image processing
- Pillow for image support
- ReportLab for server-side PDF generation
- gTTS for server-side speech generation

### Deployment

- Frontend is configured for Vercel/static SPA deployment.
- Backend can run locally or on a separate cloud service.
- `VITE_BACKEND_URL` selects the backend URL; otherwise the frontend uses `http://localhost:8000`.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` configure Supabase.

## 5. High-level architecture

```text
                    ┌─────────────────────────────┐
                    │       User / Eye Camp        │
                    │  healthcare worker / doctor  │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │ React PWA                     │
                    │ App.jsx + route components    │
                    └───────┬──────────────┬────────┘
                            │              │
             online         │              │ offline/backend unavailable
                            ▼              ▼
             ┌────────────────────┐  ┌───────────────────────┐
             │ FastAPI backend     │  │ Browser Web Worker     │
             │ /api/inference/     │  │ onnxruntime-web        │
             │ ONNX Runtime CPU    │  │ WASM execution         │
             └─────────┬──────────┘  └──────────┬────────────┘
                       │                         │
                       └────────────┬────────────┘
                                    ▼
                    ┌─────────────────────────────┐
                    │ Grading + lesion result      │
                    │ grade, confidence, risk,     │
                    │ detections, heatmap          │
                    └──────────────┬──────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │ IndexedDB local record       │
                    │ patients, sync_queue,        │
                    │ doctor_reviews, audit_log    │
                    └──────────────┬──────────────┘
                                   │ when online
                                   ▼
                    ┌─────────────────────────────┐
                    │ Supabase Auth/DB/Storage     │
                    │ profiles, patients, scans    │
                    └──────────────┬──────────────┘
                                   ▼
       ┌──────────────┬──────────────┬──────────────┬──────────────┐
       ▼              ▼              ▼              ▼              ▼
   PDF report     ABHA link      Doctor review   Camp stats    Voice/WhatsApp
```

## 6. Complete user and request flow

### 6.1 Application startup

1. `main.jsx` mounts the React application.
2. `App.jsx` creates the router and screening-mode context.
3. Supabase restores the current auth session.
4. The authenticated user ID is saved as `rs_uid` in local storage.
5. A cached profile is loaded immediately when available.
6. The app attempts to retrieve the profile from the Supabase `profiles` table.
7. If the user has no role, `RoleSelect` is shown.
8. If a role exists but onboarding is incomplete, the user is routed to doctor or patient onboarding.
9. Completed users enter the dashboard.
10. Existing cloud patients are pulled into the user-scoped IndexedDB database.
11. The app pings `/health` periodically to update backend availability.
12. The service worker can notify the user when an update is ready.

### 6.2 Patient screening flow

1. The user opens `/scan`.
2. `Scanner.jsx` requires a right-eye/OD image; left-eye/OS is optional.
3. An image can be uploaded or captured through `AutoRetinaCam`.
4. Uploaded files are resized to a maximum dimension of 1024px and converted to JPEG.
5. Patient metadata is collected: name, age, gender, diabetes duration, phone, and optional ABHA ID.
6. The draft and image previews are kept in `sessionStorage` so a refresh does not immediately discard the active form.
7. The user starts analysis.
8. The app analyzes OD and OS in parallel when both images exist.
9. `analyzeImage()` chooses the backend first when `navigator.onLine` is true.
10. If the backend times out, returns an error, or the browser is offline, inference switches to the Web Worker.
11. The result is normalized into grade, diagnosis, confidence, class probabilities, risk score, urgency, heatmap, and detections.
12. The worse eye grade becomes the combined patient grade.
13. The maximum eye risk becomes the combined risk score.
14. The record is written to IndexedDB and an audit event is recorded.
15. If online, the record is uploaded to Supabase; if upload fails, a symbolic sync request is queued.
16. The app navigates to `/results` with the patient record.

### 6.3 Results and clinical workflow

`ResultsView.jsx` displays:

- Combined/worst-eye grade.
- Per-eye grade and confidence.
- Diagnosis and urgency.
- Grade 0–4 probability bars.
- Risk score meter with standard/preventative thresholds.
- Original image and heatmap comparison.
- Lesion mapping page.
- Longitudinal patient history.
- Voice guidance.
- PDF report generation.
- WhatsApp clinical summary link.
- ABHA report linking.
- Archive to patient registry.

If the route is refreshed and only a patient ID is available, the record is restored from IndexedDB.

### 6.4 Offline synchronization flow

The local database is named `RetinaScanDB_<user-id>`, isolating records by authenticated user. It includes:

- `patients`: patient and screening records.
- `sync_queue`: failed Supabase/API operations waiting for retry.
- `doctor_reviews`: local doctor review data keyed by patient ID.
- `audit_log`: local audit events and generated device ID.

When the browser fires the `online` event, `flushSyncQueue()` retries queued work. Patient images stored as base64 data URLs can be uploaded to Supabase Storage under user/patient-specific names.

### 6.5 Doctor review flow

Doctors are routed to `/doctor` when the authenticated profile role is `doctor`. They can inspect flagged records, add reviews, and use local persistence through the doctor-review IndexedDB store. The code supports review persistence, but production-grade clinical sign-off and server-side authorization must still be implemented and audited.

## 7. AI models and inference details

### 7.1 DR grading model: `retina_model.onnx`

- **Declared architecture:** EfficientNetB3-style image classifier.
- **Input:** `[1, 3, 224, 224]` float32 tensor.
- **Preprocessing:** resize/center crop, RGB channels, ImageNet normalization:
  - mean `[0.485, 0.456, 0.406]`
  - standard deviation `[0.229, 0.224, 0.225]`
- **Output:** logits for five diabetic-retinopathy severity classes.
- **Class mapping:**

| Grade | Meaning | Risk level | Default risk score | Default urgency |
|---:|---|---|---:|---|
| 0 | No Diabetic Retinopathy | LOW | 15 | Annual monitoring |
| 1 | Mild Diabetic Retinopathy | LOW | 35 | Monitor in 6 months |
| 2 | Moderate Diabetic Retinopathy | MEDIUM | 55 | Refer in 3 months |
| 3 | Severe Diabetic Retinopathy | HIGH | 85 | Refer in 2 weeks |
| 4 | Proliferative Diabetic Retinopathy | HIGH | 98 | Emergency referral |

Both backend and browser paths apply softmax to logits and return `class_probabilities`. The predicted grade is the index of the largest probability.

The backend model file is represented by Git LFS metadata in `backend/models/retina_model.onnx`; the browser model is present under `frontend/public/models/retina_model.onnx`.

### 7.2 Lesion model: `yolo_lesions.onnx`

- **Declared architecture:** YOLOv8-style ONNX detector.
- **Execution:** browser-side Web Worker in the normal application path.
- **Input:** `[1, 3, 1024, 1024]` float32 tensor.
- **Confidence threshold:** `0.25`.
- **NMS IoU threshold:** `0.45`.
- **Classes:**
  1. `External Bleeding`
  2. `Exudates / Cotton Wool Spots / Retinal Scarring`
  3. `Microaneurysms / Hemorrhages`
- **Output:** bounding boxes, class IDs, class names, confidence, detection count, and image shape.

The backend explicitly does not run YOLO to reduce memory usage. Its `/api/inference/` response currently returns an empty YOLO result, while the frontend then invokes `runYoloLocally()` in a Web Worker.

### 7.3 Heatmaps and explainability

There are multiple heatmap behaviors:

- **Browser:** attempts Score-CAM using feature-map output from the grading model.
- **Browser fallback:** uses a Sobel edge heatmap if the model has no usable feature map, CAM is flat, or CAM generation fails.
- **Backend:** `generate_mock_heatmap()` uses an inverted image and OpenCV JET colormap blend. This is a visualization fallback, not a faithful Grad-CAM implementation.

Therefore, the UI can show an explanatory overlay, but the current backend overlay must not be represented as model-derived causal attribution without further validation.

## 8. Backend API

### `GET /health`

Returns a simple service health object:

```json
{"status":"ok","service":"RetinaScan AI Backend"}
```

### `GET /`

Returns a basic API-running message and points users to Swagger.

### `POST /api/inference/`

- Accepts multipart form-data field `file`.
- Optional query parameter: `skip_yolo`.
- Decodes the image with OpenCV.
- Checks blur using Laplacian variance.
- Runs the cached ONNX grading session.
- Returns grade, diagnosis, confidence, probabilities, risk, urgency, empty backend YOLO results, heatmap data URL, timestamp, and quality warnings.

The model session is lazy-loaded and cached in `_grading_session`. `WARMUP_MODELS=true` enables startup preloading.

### `POST /api/report/pdf`

Receives a `ReportRequest` containing patient information and inference values, then creates a minimal A4 PDF using ReportLab. The response is streamed as `report.pdf`.

### `POST /api/abdm/link-report`

Receives `abha_id` and `report_id`. It validates that the ABHA value contains 14 digits, waits two seconds to simulate network latency, and returns a success payload.

### `GET /api/tts/`

Receives `text` and `lang` query parameters, calls gTTS, and streams an MP3 response.

## 9. Authentication and data architecture

Supabase is initialized with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY`

Authentication supports email/password sign-up, login, session restoration, auth-state listeners, and logout. Profiles are loaded from the `profiles` table.

The frontend expects or references these Supabase resources:

- `profiles`
- `patients`
- `screening_settings`
- Storage bucket `patient-scans`

Patient records include both legacy single-image columns and per-eye columns:

- `image_url`, `heatmap_url`
- `od_image_url`, `os_image_url`
- `od_heatmap_url`, `os_heatmap_url`

## 10. Screening modes

`screeningMode.js` defines two modes:

| Mode | Referral rule | Risk flag threshold | Intended use |
|---|---|---:|---|
| Standard | Grade 2 or higher | Risk score > 50 | Standard triage |
| Preventative | Grade 1 or higher | Risk score > 35 | More sensitive screening |

The mode changes UI risk flags and is saved in the Supabase `screening_settings` table. It does **not** retrain or alter the neural-network model itself.

## 11. Features in detail

### 11.1 Dual-eye screening

The right eye is mandatory and the left eye is optional. Each eye has independent image, grade, confidence, probabilities, heatmap, quality, and detection data. The final patient result uses the worse grade and highest derived risk.

### 11.2 Image quality and validation

The frontend validates minimum dimensions, extreme aspect ratios, blank/uniform images, suspicious corner brightness, darkness, and unusual color profile. Blur is estimated with a Laplacian variance score. The backend also performs blur detection.

These checks are heuristics and should be treated as warnings/quality gates, not clinically validated image-quality assessment.

### 11.3 Offline-first PWA

The service worker precaches application assets. ONNX models and WASM assets can be cached for future offline inference. IndexedDB stores screening records and sync operations. Session storage preserves active scan drafts and previews.

### 11.4 Reports

Reports can be generated client-side with the large `pdfReport.js` utility or server-side via `/api/report/pdf`. The UI also provides QR/report linking and printable clinical output.

### 11.5 Voice assistance

The UI has a `VoiceGuide` and voice utility for multilingual instructions. The backend gTTS route supplies MP3 generation, while browser capabilities can support local speech behavior.

### 11.6 ABHA/ABDM workflow

The UI collects an optional ABHA ID and can submit a report-link request. The current backend is named `abdm_mock.py` and simulates the external service rather than connecting to the real ABDM infrastructure.

### 11.7 Camp operations

The dashboard and camp pages expose patient queue/history, counts, risk summaries, and screening statistics. Demo data provides representative records for presentations.

### 11.8 Patient and doctor roles

Routing changes by profile role:

- **Patient:** dashboard, scan, history, find doctors, profile.
- **Doctor:** dashboard, scan, review portal, camp records, profile.
- **Unassigned/new account:** role selection and onboarding.

## 12. Demonstration data and fakes

The repository contains intentionally simulated or deterministic behavior. These are useful for a demo but must not be mistaken for production integrations or validated clinical outputs.

### Explicit mocks/simulations

1. **ABDM mock:** `backend/routes/abdm_mock.py` validates an ID and returns success after a fixed two-second delay. It does not transmit anything to ABDM.
2. **Backend heatmap:** `generate_mock_heatmap()` creates a colorized image blend rather than a true Grad-CAM explanation.
3. **Backend YOLO response:** backend inference returns `detections: []`; lesion detection is not performed server-side.
4. **Demo cases:** `frontend/public/sample-data/demo-cases.json` contains ten named sample patients with hard-coded grades, confidence, risk scores, and dates.
5. **Legacy demo result helper:** `get_demo_result()` contains filename-based results for `grade0.jpg` through `grade4.jpg` and a random grade fallback for unknown filenames. It is not the normal real-ONNX path but is a major source of non-production behavior if called.
6. **Synthetic YOLO test image:** `backend/test_yolo.py` creates a black image with artificial bright blocks to test output parsing.
7. **TTS dependency:** gTTS relies on an external service/network and is not fully offline.
8. **Business and validation pages:** these are product/presentation surfaces; displayed metrics should be checked against an actual evaluation report before being used as scientific claims.

### Important distinction

The model files are real ONNX artifacts used by the application, but the repository does not provide training code, dataset provenance, patient-level split methodology, calibration analysis, or a reproducible model evaluation pipeline. The model name and intended architecture are documented, but accuracy claims require independent validation.

## 13. Known problems and risks

### 13.1 Clinical and model risks

- No evidence in this repository establishes clinical validation, regulatory clearance, or safe deployment for diagnosis.
- A confidence score is a softmax probability, not necessarily calibrated clinical confidence.
- The risk score is mapped from grade/probabilities and is not a validated medical risk model.
- The backend heatmap is a mock visualization and can mislead users about model reasoning.
- Heuristic fundus validation can reject valid images or accept invalid images.
- The application should require qualified clinician review for every flagged case and clear escalation for low-quality/low-confidence cases.

### 13.2 Security and privacy risks

- Backend CORS is configured with `allow_origins=["*"]`.
- Patient data and retinal images are sensitive health information; production deployment needs strict authorization, encryption, retention, consent, and audit controls.
- Supabase Storage URLs are generated as public URLs by `getPublicUrl()`, which may expose patient images unless bucket policies prevent it.
- The ABHA/ABDM mock must not be presented as government integration.
- Client-side role checks are not a substitute for server-side authorization policies.
- Local IndexedDB deletion during logout may not instantly guarantee forensic deletion from browser/device storage.
- The frontend sends contact and health metadata to cloud storage without an explicit consent workflow visible in the inspected code.

### 13.3 Reliability and performance risks

- Two model files total roughly 88 MB before WASM/runtime assets.
- The build output shows a JavaScript chunk over 1 MB and a roughly 24.9 MB WASM asset.
- The PWA build precache report shows approximately 224 MB of assets, which can be difficult for low-storage or low-bandwidth devices.
- A first offline model load may take 30–60 seconds on mobile hardware.
- YOLO uses a 1024×1024 tensor and can be memory-intensive in a browser worker.
- `gTTS` requires network access, so voice behavior is not fully offline.
- There is no comprehensive automated frontend test suite visible in the repository.
- `backend/test_inference.py` contains a developer-specific Windows path and manually constructs multipart HTTP; it is not a portable test suite.
- Backend model loading can fail if Git LFS content is not pulled in deployment.

### 13.4 Data consistency risks

- The frontend supports both legacy and per-eye patient schemas, increasing migration complexity.
- Duplicate prevention depends on querying Supabase by `patient_id` and `user_id`; database-level unique constraints should also exist.
- Sync retries can fail repeatedly without a dead-letter queue or user-visible conflict resolution.
- Some result state is passed through React Router, while refresh recovery depends on IndexedDB.
- Deleting/clearing patient data needs coordinated removal from IndexedDB, Supabase rows, and Storage objects.

### 13.5 API and implementation risks

- The README lists endpoints with trailing-slash variations; clients and deployment proxies should standardize paths.
- `skip_yolo` is accepted by the backend but backend YOLO is already disabled.
- The server PDF endpoint is minimal compared with the richer client-side report implementation.
- There is no visible rate limiting, request size limit, file-type security policy, structured logging, tracing, or monitoring.
- Error messages may expose internal model/runtime details.

## 14. Recommended production fixes

### Priority 1 — safety and privacy

- Add a clear “AI screening support only” warning at result and report boundaries.
- Require clinician approval/sign-off for referrals and diagnosis.
- Replace public image URLs with private storage and signed, expiring URLs.
- Add Supabase RLS policies for every table and storage object.
- Remove wildcard CORS and allow only known frontend origins.
- Validate file type, file size, dimensions, and decompression limits server-side.
- Add encryption, consent, retention/deletion policy, and access audit requirements.

### Priority 2 — inference correctness

- Verify the ONNX graph input/output names and shapes during startup.
- Confirm the actual training architecture and class ordering from model metadata.
- Replace the backend mock heatmap with a validated explanation method or label it clearly as visualization-only.
- Add confidence calibration, abstention/“needs review” thresholds, and out-of-distribution detection.
- Add a reproducible evaluation package with sensitivity, specificity, AUROC, per-grade confusion matrix, calibration, subgroup performance, and external validation.
- Keep the browser and backend preprocessing/post-processing implementations in one shared specification and test them against golden fixtures.

### Priority 3 — reliability and performance

- Split large frontend chunks with route-level lazy loading and manual chunks.
- Avoid precaching unnecessary assets and models until requested.
- Add model download progress, checksum/version validation, and storage-quota handling.
- Reuse worker/model sessions instead of creating a new worker for every operation.
- Add offline TTS or a browser-native voice fallback.
- Replace manual scripts with pytest/httpx tests and portable fixtures.
- Add health checks for model availability, not just process availability.

### Priority 4 — maintainability

- Introduce TypeScript or shared runtime schemas for inference and patient records.
- Define a versioned API contract with OpenAPI-generated client types.
- Separate demo data and mock services from production code paths.
- Add migrations and database constraints for patient IDs, roles, reviews, and scan ownership.
- Add end-to-end tests covering sign-in, onboarding, scan, offline save, sync, PDF, and doctor review.

## 15. Local development

### Frontend

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

Optional frontend environment variables:

```bash
VITE_BACKEND_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-public-anon-key
```

Build and preview:

```bash
npm run build
npm run preview
```

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
# http://127.0.0.1:8000
# Swagger: http://127.0.0.1:8000/docs
```

Optional model warmup:

```bash
# Windows PowerShell
$env:WARMUP_MODELS="true"

# macOS/Linux
export WARMUP_MODELS=true
```

### Manual inference test

`backend/test_inference.py` expects a locally running backend and currently contains a machine-specific sample image path. Update that path before running it:

```bash
python test_inference.py
```

## 16. API example

```bash
curl -X POST "http://127.0.0.1:8000/api/inference/" \
  -F "file=@frontend/public/sample-data/grade3.jpg"
```

Expected response concepts:

```json
{
  "grade": 3,
  "grade_label": "Severe Diabetic Retinopathy",
  "diagnosis": "Severe Diabetic Retinopathy",
  "confidence": 0.92,
  "class_probabilities": [0.01, 0.03, 0.08, 0.82, 0.06],
  "risk_level": "HIGH",
  "risk_score": 85,
  "urgency": "Refer in 2 weeks",
  "yolo": {"detections": [], "count": 0},
  "heatmap_url": "data:image/jpeg;base64,...",
  "quality_warnings": []
}
```

The exact values depend on the model output and image; the example is illustrative.

## 17. Current project truth table

| Area | Implemented in repository | Production-ready? |
|---|---:|---:|
| React PWA shell and routing | Yes | Needs hardening |
| Supabase email auth | Yes | Needs RLS/security review |
| Dual-eye capture workflow | Yes | Needs clinical/device testing |
| Browser EfficientNet ONNX grading | Yes | Requires validation |
| Backend EfficientNet ONNX grading | Yes | Requires deployment/model checks |
| Browser YOLO lesion detection | Yes | Requires model/accuracy validation |
| Backend YOLO lesion detection | No; empty result returned | No |
| Browser Score-CAM attempt | Yes | Needs faithful attribution validation |
| Backend heatmap | Mock blend | No |
| IndexedDB offline persistence | Yes | Needs conflict/recovery testing |
| Supabase cloud sync | Yes | Needs RLS, constraints, privacy controls |
| PDF generation | Yes | Needs clinical/legal template review |
| Multilingual TTS | Partially; browser/gTTS | Not fully offline |
| ABDM integration | Mock only | No |
| Demo patient data | Yes | Demo-only |
| Automated clinical validation | Not visible | No |

## 18. Final product flow in one sentence

A healthcare worker authenticates, selects a role, captures OD/OS fundus images, receives online or offline ONNX-based grade and lesion results, reviews explanations and risk, saves the patient locally/cloud, generates a report, optionally links it through the current ABDM mock, and sends flagged cases to a doctor/referral workflow.

## 19. Disclaimer

This repository is a prototype. AI outputs, confidence values, risk scores, lesion boxes, heatmaps, demo records, referral recommendations, and ABHA linking behavior must be independently validated before any real clinical, government, insurance, or patient-care use.
