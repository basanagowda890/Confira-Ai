from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, require_role
from app.db.supabase import admin_client
from app.core.errors import api_error

router = APIRouter(tags=["practice tests", "reports", "group discussions", "results"])

@router.get("/practice-tests")
def practice_tests(user: dict = Depends(require_role("candidate"))):
    return {"success": True, "data": admin_client().table("practice_tests").select("id,title,description,duration_minutes").eq("is_published", True).execute().data}

@router.get("/practice-tests/attempts")
def attempts(user: dict = Depends(require_role("candidate"))):
    return {"success": True, "data": admin_client().table("practice_test_attempts").select("*,practice_tests(title)").eq("candidate_id", user["id"]).execute().data}

@router.get("/practice-tests/{test_id}")
def practice_test(test_id: str, user: dict = Depends(require_role("candidate"))):
    data = admin_client().table("practice_tests").select("*").eq("id", test_id).eq("is_published", True).maybe_single().execute().data
    if not data: raise api_error(404, "Practice test not found.", "TEST_NOT_FOUND")
    return {"success": True, "data": data}

@router.post("/practice-tests/{test_id}/start", status_code=201)
def start_test(test_id: str, user: dict = Depends(require_role("candidate"))):
    return {"success": True, "data": admin_client().table("practice_test_attempts").insert({"test_id": test_id, "candidate_id": user["id"]}).execute().data[0]}

@router.post("/practice-tests/{test_id}/submit")
def submit_test(test_id: str, body: dict, user: dict = Depends(require_role("candidate"))):
    attempt_id = body.get("attempt_id")
    if not attempt_id: raise api_error(422, "attempt_id is required.", "VALIDATION_ERROR")
    data = admin_client().table("practice_test_attempts").update({"answers": body.get("answers", []), "submitted_at": datetime.now(timezone.utc).isoformat()}).eq("id", attempt_id).eq("test_id", test_id).eq("candidate_id", user["id"]).execute().data
    if not data: raise api_error(404, "Practice attempt not found.", "ATTEMPT_NOT_FOUND")
    return {"success": True, "data": data[0]}

@router.get("/reports/{interview_id}")
def get_report(interview_id: str, user: dict = Depends(require_role("interviewer"))):
    data = admin_client().table("reports").select("*").eq("interview_id", interview_id).eq("owner_id", user["id"]).maybe_single().execute().data
    if not data: raise api_error(404, "Report not found.", "REPORT_NOT_FOUND")
    return {"success": True, "data": data}

@router.get("/results/{interview_id}")
def get_result(interview_id: str, user: dict = Depends(get_current_user)):
    interview = admin_client().table("interviews").select("candidate_id,interviewer_id").eq("id", interview_id).maybe_single().execute().data
    if not interview or user["id"] not in {interview["candidate_id"], interview["interviewer_id"]}: raise api_error(404, "Interview result not found.", "RESULT_NOT_FOUND")
    data = admin_client().table("interview_results").select("*").eq("interview_id", interview_id).maybe_single().execute().data
    if not data: raise api_error(404, "Interview result not found.", "RESULT_NOT_FOUND")
    return {"success": True, "data": data}

@router.post("/reports/{interview_id}/generate")
def report(interview_id: str, user: dict = Depends(require_role("interviewer"))):
    interview = admin_client().table("interviews").select("*").eq("id", interview_id).eq("interviewer_id", user["id"]).maybe_single().execute().data
    if not interview: raise api_error(404, "Interview not found.", "INTERVIEW_NOT_FOUND")
    result = admin_client().table("interview_results").select("*").eq("interview_id", interview_id).maybe_single().execute().data
    events = admin_client().table("monitoring_events").select("event_type,severity,timestamp").eq("interview_id", interview_id).execute().data
    content = {"interview": interview, "scores": result or {}, "monitoring_summary": events, "notice": "AI and score outputs are decision-support signals requiring human review."}
    data = admin_client().table("reports").upsert({"interview_id": interview_id, "owner_id": user["id"], "content": content}, on_conflict="interview_id").execute().data[0]
    return {"success": True, "data": data}

@router.post("/group-discussions", status_code=201)
def create_discussion(body: dict, user: dict = Depends(require_role("interviewer"))):
    data = {"title": body.get("title", "Group discussion"), "job_id": body.get("job_id"), "scheduled_at": body.get("scheduled_at"), "created_by": user["id"]}
    return {"success": True, "data": admin_client().table("group_discussions").insert(data).execute().data[0]}

@router.get("/group-discussions")
def discussions(user: dict = Depends(get_current_user)):
    query = admin_client().table("group_discussions").select("*,group_discussion_members(*)")
    if user["profile"]["role"] == "interviewer": query = query.eq("created_by", user["id"])
    else: query = query.eq("group_discussion_members.candidate_id", user["id"])
    return {"success": True, "data": query.execute().data}

@router.post("/group-discussions/{discussion_id}/join")
def join_discussion(discussion_id: str, user: dict = Depends(require_role("candidate"))):
    return {"success": True, "data": admin_client().table("group_discussion_members").upsert({"discussion_id": discussion_id, "candidate_id": user["id"]}, on_conflict="discussion_id,candidate_id").execute().data[0]}
