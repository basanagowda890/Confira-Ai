import base64
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.dependencies import get_current_user, require_role
from app.core.errors import api_error
from app.db.supabase import admin_client, fetch_maybe_single
from app.routers.interviews import interview_for_user
from app.services.ml_service import get_ml_service

logger = logging.getLogger("ml_router")

router = APIRouter(prefix="", tags=["ML Monitoring"])


class MLAnalyzePayload(BaseModel):
    image_b64: Optional[str] = None
    audio_b64: Optional[str] = None
    candidate_id: Optional[str] = None
    timestamp: Optional[str] = None


@router.get("/ml/health")
def ml_health():
    """Health check for real ML models (Eye, Voice, YOLO)."""
    service = get_ml_service()
    status = service.get_status()
    return {"success": True, "data": status}


@router.get("/interviews/{interview_id}/ml/latest")
def get_latest_interview_telemetry(
    interview_id: str,
    user: dict = Depends(get_current_user)
):
    """Retrieve latest cached ML telemetry for an interview."""
    interview_for_user(interview_id, user)
    service = get_ml_service()
    telemetry = service.get_latest_telemetry(interview_id)
    return {"success": True, "data": telemetry}


@router.post("/interviews/{interview_id}/ml/analyze")
def analyze_telemetry(
    interview_id: str,
    payload: MLAnalyzePayload,
    user: dict = Depends(get_current_user)
):
    """
    Execute real ML inference for an ongoing interview:
    1. Eye state detection (MobileNetV2 96x48x3)
    2. Voice activity detection (RandomForest 80-MFCCs)
    3. Person & object detection (YOLO11n)
    """
    item = interview_for_user(interview_id, user)
    candidate_id = item["candidate_id"]

    # Decode base64 image if present
    image_bytes = None
    if payload.image_b64:
        try:
            b64_data = payload.image_b64
            if "," in b64_data:
                b64_data = b64_data.split(",", 1)[1]
            image_bytes = base64.b64decode(b64_data)
        except Exception as e:
            logger.warning("Failed to decode image_b64: %s", e)

    # Decode base64 audio if present
    audio_bytes = None
    if payload.audio_b64:
        try:
            b64_data = payload.audio_b64
            if "," in b64_data:
                b64_data = b64_data.split(",", 1)[1]
            audio_bytes = base64.b64decode(b64_data)
        except Exception as e:
            logger.warning("Failed to decode audio_b64: %s", e)

    # Run real ML inference
    service = get_ml_service()
    result = service.analyze_interview_telemetry(
        interview_id=interview_id,
        candidate_id=candidate_id,
        image_bytes=image_bytes,
        audio_bytes=audio_bytes
    )

    # Persist significant monitoring events into `monitoring_events` table
    alerts = result.get("alerts", [])
    now_iso = datetime.now(timezone.utc).isoformat()

    for alert in alerts:
        severity = "info"
        event_type = "ml_detection"
        
        if alert == "multiple_people_detected":
            event_type = "multiple_faces"
            severity = "warning"
        elif alert == "face_not_detected":
            event_type = "face_not_detected"
            severity = "warning"
        elif alert == "gaze_unfocused":
            event_type = "gaze_unfocused"
            severity = "info"
        elif "detected_" in alert:
            event_type = "device_detected"
            severity = "warning"

        # Check throttling: only insert if no same event_type within last 15 seconds
        recent_event = fetch_maybe_single(
            admin_client()
            .table("monitoring_events")
            .select("id, timestamp")
            .eq("interview_id", interview_id)
            .eq("event_type", event_type)
            .order("timestamp", desc=True)
            .limit(1)
        )
        
        should_insert = True
        if recent_event and recent_event.get("timestamp"):
            try:
                ev_time = datetime.fromisoformat(recent_event["timestamp"].replace("Z", "+00:00"))
                delta_sec = (datetime.now(timezone.utc) - ev_time).total_seconds()
                if delta_sec < 15:
                    should_insert = False
            except Exception:
                pass

        if should_insert:
            try:
                admin_client().table("monitoring_events").insert({
                    "interview_id": interview_id,
                    "candidate_id": candidate_id,
                    "event_type": event_type,
                    "severity": severity,
                    "event_data": {
                        "alert": alert,
                        "eye": result.get("eye_detection"),
                        "voice": result.get("voice_detection"),
                        "objects": result.get("object_detection"),
                    },
                    "timestamp": now_iso
                }).execute()
            except Exception as e:
                logger.warning("Failed to insert monitoring_event: %s", e)

    return {"success": True, "data": result}
