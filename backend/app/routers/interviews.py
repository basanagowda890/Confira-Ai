import secrets
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, require_role
from app.db.supabase import admin_client
from app.schemas.common import InterviewInput, InterviewUpdate, QuestionInput, MonitoringEventInput
from app.core.errors import api_error
from app.services.notifications import notify

router = APIRouter(prefix="/interviews", tags=["interviews", "monitoring"])

def interview_for_user(interview_id, user):
    item = admin_client().table("interviews").select("*").eq("id", interview_id).maybe_single().execute().data
    if not item: raise api_error(404, "Interview not found.", "INTERVIEW_NOT_FOUND")
    if user["id"] not in {item["candidate_id"], item["interviewer_id"]}: raise api_error(403, "You cannot access this interview.", "OWNERSHIP_FORBIDDEN")
    return item

@router.post("", status_code=201)
def create(body: InterviewInput, user: dict = Depends(require_role("interviewer"))):
    job = admin_client().table("jobs").select("id").eq("id", body.job_id).eq("created_by", user["id"]).maybe_single().execute().data
    if not job: raise api_error(403, "You can only schedule interviews for your jobs.", "OWNERSHIP_FORBIDDEN")
    candidate = admin_client().table("profiles").select("id").eq("id", body.candidate_id).eq("role", "candidate").maybe_single().execute().data
    if not candidate: raise api_error(404, "Candidate not found.", "CANDIDATE_NOT_FOUND")
    data = body.model_dump(); data.update({"interviewer_id": user["id"], "meeting_room_id": secrets.token_urlsafe(12)})
    try: created = admin_client().table("interviews").insert(data).execute().data[0]
    except Exception: raise api_error(409, "This interview could not be scheduled.", "INTERVIEW_CONFLICT")
    notify(body.candidate_id, f"interview:{created['id']}:scheduled", "Interview scheduled", f"Your interview, {body.title}, has been scheduled.", f"/candidate/interviews")
    return {"success": True, "data": created}

@router.get("")
def list_interviews(user: dict = Depends(get_current_user)):
    field = "candidate_id" if user["profile"]["role"] == "candidate" else "interviewer_id"
    return {"success": True, "data": admin_client().table("interviews").select("*,jobs(title),profiles!interviews_candidate_id_fkey(full_name,email)").eq(field, user["id"]).order("scheduled_at").execute().data}

@router.get("/{interview_id}")
def get(interview_id: str, user: dict = Depends(get_current_user)): return {"success": True, "data": interview_for_user(interview_id, user)}

@router.put("/{interview_id}")
def update(interview_id: str, body: InterviewUpdate, user: dict = Depends(require_role("interviewer"))):
    item = interview_for_user(interview_id, user)
    if item["interviewer_id"] != user["id"]: raise api_error(403, "Only the interviewer can update this interview.", "OWNERSHIP_FORBIDDEN")
    return {"success": True, "data": admin_client().table("interviews").update(body.model_dump(exclude_none=True)).eq("id", interview_id).execute().data[0]}

@router.delete("/{interview_id}")
def delete(interview_id: str, user: dict = Depends(require_role("interviewer"))):
    item = interview_for_user(interview_id, user)
    if item["interviewer_id"] != user["id"]: raise api_error(403, "Only the interviewer can cancel this interview.", "OWNERSHIP_FORBIDDEN")
    admin_client().table("interviews").update({"status": "cancelled"}).eq("id", interview_id).execute(); return {"success": True}

@router.post("/{interview_id}/start")
def start(interview_id: str, user: dict = Depends(require_role("interviewer"))):
    item = interview_for_user(interview_id, user)
    if item["interviewer_id"] != user["id"]: raise api_error(403, "Only the interviewer can start this interview.", "OWNERSHIP_FORBIDDEN")
    return {"success": True, "data": admin_client().table("interviews").update({"status": "live"}).eq("id", interview_id).execute().data[0]}

@router.post("/{interview_id}/complete")
def complete(interview_id: str, user: dict = Depends(require_role("interviewer"))):
    item = interview_for_user(interview_id, user)
    if item["interviewer_id"] != user["id"]: raise api_error(403, "Only the interviewer can complete this interview.", "OWNERSHIP_FORBIDDEN")
    return {"success": True, "data": admin_client().table("interviews").update({"status": "completed"}).eq("id", interview_id).execute().data[0]}

@router.post("/{interview_id}/join")
def join(interview_id: str, user: dict = Depends(get_current_user)):
    item = interview_for_user(interview_id, user)
    if item["status"] == "cancelled": raise api_error(409, "This interview has been cancelled.", "INTERVIEW_CANCELLED")
    return {"success": True, "room_id": item["meeting_room_id"], "role": user["profile"]["role"], "status": item["status"]}

@router.get("/{interview_id}/questions")
def questions(interview_id: str, user: dict = Depends(get_current_user)):
    interview_for_user(interview_id, user); return {"success": True, "data": admin_client().table("interview_questions").select("*").eq("interview_id", interview_id).order("order_index").execute().data}

@router.get("/{interview_id}/answers")
def answers(interview_id: str, user: dict = Depends(get_current_user)):
    interview_for_user(interview_id, user)
    return {"success": True, "data": admin_client().table("interview_answers").select("*").eq("interview_id", interview_id).order("submitted_at").execute().data}

@router.put("/{interview_id}/answers/{question_id}")
def answer(interview_id: str, question_id: str, body: dict, user: dict = Depends(require_role("candidate"))):
    item = interview_for_user(interview_id, user)
    if item["candidate_id"] != user["id"]: raise api_error(403, "You cannot submit this answer.", "OWNERSHIP_FORBIDDEN")
    question = admin_client().table("interview_questions").select("id").eq("id", question_id).eq("interview_id", interview_id).maybe_single().execute().data
    if not question: raise api_error(404, "Question not found.", "QUESTION_NOT_FOUND")
    data = {"interview_id": interview_id, "question_id": question_id, "candidate_id": user["id"], "answer_text": body.get("answer_text", "")}
    result = admin_client().table("interview_answers").upsert(data, on_conflict="interview_id,question_id,candidate_id").execute().data[0]
    return {"success": True, "data": result}

@router.post("/{interview_id}/questions", status_code=201)
def add_question(interview_id: str, body: QuestionInput, user: dict = Depends(require_role("interviewer"))):
    item = interview_for_user(interview_id, user)
    if item["interviewer_id"] != user["id"]: raise api_error(403, "Only the interviewer can add questions.", "OWNERSHIP_FORBIDDEN")
    data = body.model_dump(); data["interview_id"] = interview_id
    return {"success": True, "data": admin_client().table("interview_questions").insert(data).execute().data[0]}

@router.post("/{interview_id}/monitoring-events", status_code=201)
def monitor(interview_id: str, body: MonitoringEventInput, user: dict = Depends(require_role("candidate"))):
    item = interview_for_user(interview_id, user)
    if item["candidate_id"] != user["id"]: raise api_error(403, "You cannot submit events for this interview.", "OWNERSHIP_FORBIDDEN")
    data = body.model_dump(); data.update({"interview_id": interview_id, "candidate_id": user["id"]})
    return {"success": True, "data": admin_client().table("monitoring_events").insert(data).execute().data[0]}

@router.get("/{interview_id}/monitoring-events")
def events(interview_id: str, user: dict = Depends(get_current_user)):
    interview_for_user(interview_id, user); return {"success": True, "data": admin_client().table("monitoring_events").select("*").eq("interview_id", interview_id).order("timestamp", desc=True).execute().data}

@router.get("/{interview_id}/candidate-comparison")
def comparison(interview_id: str, user: dict = Depends(require_role("interviewer"))):
    item = interview_for_user(interview_id, user)
    if item["interviewer_id"] != user["id"]: raise api_error(403, "Only the interviewer can compare candidates.", "OWNERSHIP_FORBIDDEN")
    rows = admin_client().table("interview_results").select("*,interviews!inner(candidate_id,status,job_id),profiles!interview_results_candidate_id_fkey(full_name,skills)").eq("interviews.job_id", item["job_id"]).order("overall_score", desc=True).execute().data
    return {"success": True, "data": rows}
