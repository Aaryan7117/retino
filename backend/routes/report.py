"""
report.py
POST /api/report — PDF report generation endpoint.
Full implementation in Section 5.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

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


@router.post("/")
async def generate_report(request: ReportRequest):
    """
    Section 5 will implement server-side PDF generation using WeasyPrint.
    For now return a stub response.
    """
    report_id = f"RS-2026-TN-{request.patient_id[-5:]}"
    return {
        "report_id": report_id,
        "status": "stub",
        "message": "PDF generation implemented in Section 5",
        "pdf_url": None,
    }
