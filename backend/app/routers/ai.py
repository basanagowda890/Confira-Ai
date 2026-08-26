from fastapi import APIRouter, Depends
from app.dependencies import require_role
from app.schemas.common import AIRequest
from app.services.ai_service import analyze

router = APIRouter(prefix="/ai", tags=["AI analysis"])

@router.post("/analyze-interview")
def analyze_interview(body: AIRequest, user: dict = Depends(require_role("interviewer"))): return {"success": True, "data": analyze(body.model_dump())}
@router.post("/analyze-answer")
def analyze_answer(body: AIRequest, user: dict = Depends(require_role("interviewer"))): return {"success": True, "data": analyze(body.model_dump())}
@router.post("/score-candidate")
def score_candidate(body: AIRequest, user: dict = Depends(require_role("interviewer"))): return {"success": True, "data": analyze(body.model_dump())}
