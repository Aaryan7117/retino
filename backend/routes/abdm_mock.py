"""
abdm_mock.py
POST /api/abdm/link-report — mock ABDM integration.
Implements exactly the spec from Section 7.
"""

import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import re

router = APIRouter()


class ABDMLinkRequest(BaseModel):
    abha_id: str  # Format: 91-1234-5678-9012 (14 digits with hyphens)
    report_id: str


def validate_abha_id(abha_id: str) -> bool:
    """ABHA ID must be 14 digits (hyphens optional)."""
    digits = re.sub(r"\D", "", abha_id)
    return len(digits) == 14


@router.post("/link-report")
async def link_report_to_abdm(request: ABDMLinkRequest):
    """
    Simulate linking a RetinaScan report to an ABHA Health ID.
    2-second delay mimics real ABDM API latency.
    """
    if not validate_abha_id(request.abha_id):
        raise HTTPException(
            status_code=422,
            detail="Invalid ABHA ID format. Must be 14 digits (e.g. 91-1234-5678-9012).",
        )

    await asyncio.sleep(2)  # Simulate API network delay

    return {
        "success": True,
        "abha_id": request.abha_id,
        "report_id": request.report_id,
        "message": "Report successfully linked to ABHA",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
