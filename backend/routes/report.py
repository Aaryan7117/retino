from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from fastapi.responses import StreamingResponse
import io

router = APIRouter()

class ReportRequest(BaseModel):
    patient_name: str
    patient_id: str
    age: int
    gender: str
    diabetic_since: int
    contact: Optional[str] = None
    grade: int
    grade_label: str
    confidence: float
    risk_score: int
    risk_level: str
    urgency: str
    camp_name: Optional[str] = "Eye Camp"
    location: Optional[str] = "Tamil Nadu"

@router.post("/pdf")
async def generate_pdf(request: ReportRequest):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, 780, "RetinaScan AI — Clinical Report")
    c.setFont("Helvetica", 12)
    c.drawString(50, 750, f"Patient: {request.patient_name}")
    c.drawString(50, 730, f"DR Grade: {request.grade} — {request.grade_label}")
    c.drawString(50, 710, f"Confidence: {round(request.confidence*100)}%")
    c.drawString(50, 690, f"Recommendation: {request.urgency}")
    c.save()
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf",
                             headers={"Content-Disposition": "attachment; filename=report.pdf"})
