from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, require_role
from app.schemas.common import AIRequest, AnalyzeAnswerInput
from app.services.ai_service import analyze, analyze_ai_assistance
from app.db.supabase import admin_client, fetch_maybe_single
from app.core.errors import api_error
from app.routers.interviews import interview_for_user

router = APIRouter(prefix="/ai", tags=["AI analysis"])

@router.post("/analyze-interview")
def analyze_interview(body: AIRequest, user: dict = Depends(require_role("interviewer"))):
    return {"success": True, "data": analyze(body.model_dump())}

@router.post("/analyze-answer")
def analyze_answer(body: AnalyzeAnswerInput, user: dict = Depends(get_current_user)):
    interview = interview_for_user(body.interview_id, user)
    
    # Fetch question text if available
    question_text = ""
    question = fetch_maybe_single(admin_client().table("interview_questions").select("question").eq("id", body.question_id))
    if question:
        question_text = question.get("question", "")

    # Retrieve answer record from Supabase
    query = admin_client().table("interview_answers").select("*").eq("interview_id", body.interview_id).eq("question_id", body.question_id)
    if user["profile"]["role"] == "candidate":
        query = query.eq("candidate_id", user["id"])
    elif body.answer_id:
        query = query.eq("id", body.answer_id)

    answer_record = fetch_maybe_single(query)
    if not answer_record:
        raise api_error(404, "Answer not found for this interview question.", "ANSWER_NOT_FOUND")

    transcript = answer_record.get("answer_transcript") or answer_record.get("answer_text") or ""
    
    # Run analysis
    analysis = analyze_ai_assistance(transcript, question_text)

    # Persist analysis to interview_answers
    update_data = {
        "ai_assistance_score": analysis.get("ai_assistance_score"),
        "ai_assistance_classification": analysis.get("classification"),
        "ai_assistance_confidence": analysis.get("confidence"),
        "ai_assistance_signals": analysis.get("signals", []),
        "ai_assistance_explanation": analysis.get("explanation"),
    }
    admin_client().table("interview_answers").update(update_data).eq("id", answer_record["id"]).execute()

    return {
        "success": True,
        "data": {
            **analysis,
            "answer_id": answer_record["id"],
            "interview_id": body.interview_id,
            "question_id": body.question_id,
        },
    }

@router.post("/score-candidate")
def score_candidate(body: AIRequest, user: dict = Depends(require_role("interviewer"))):
    return {"success": True, "data": analyze(body.model_dump())}

