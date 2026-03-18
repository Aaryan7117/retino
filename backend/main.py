"""
RetinaScan AI — FastAPI Backend Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import inference, report, abdm_mock, tts

app = FastAPI(
    title="RetinaScan AI API",
    description="AI-Powered Diabetic Retinopathy Screening — Backend",
    version="1.0.0",
)

# CORS — allow Vite dev server and Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register routers
app.include_router(inference.router, prefix="/api/inference", tags=["Inference"])
app.include_router(report.router, prefix="/api/report", tags=["Report"])
app.include_router(abdm_mock.router, prefix="/api/abdm", tags=["ABDM"])
app.include_router(tts.router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "RetinaScan AI Backend"}


@app.get("/", tags=["Health"])
async def root():
    return {"message": "RetinaScan AI API is running. Visit /docs for Swagger UI."}
