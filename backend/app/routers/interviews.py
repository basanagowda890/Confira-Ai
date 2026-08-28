from datetime import datetime, timezone
from pathlib import PurePosixPath
import secrets
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, require_role
from app.db.supabase import admin_client, fetch_maybe_single
from app.schemas.common import InterviewInput, InterviewUpdate, QuestionInput, MonitoringEventInput, RecommendationInput
from app.core.errors import api_error
from app.services.notifications import notify

router = APIRouter(prefix="/interviews", tags=["interviews", "monitoring"])

def candidate_avatar_url(path: str | None) -> str | None:
    if not path:
        return None
    if path.startswith("http://") or path.startswith("https://"):
        return path
    try:
        parts = PurePosixPath(path).parts
        if len(parts) == 2 and parts[1].startswith("avatar"):
            return admin_client().storage.from_("avatars").create_signed_url(path, 300)["signedURL"]
    except Exception:
        pass
    return None

def interview_for_user(interview_id, user):
    item = fetch_maybe_single(admin_client().table("interviews").select("*").eq("id", interview_id))
    if not item: raise api_error(404, "Interview not found.", "INTERVIEW_NOT_FOUND")
    if user["id"] not in {item["candidate_id"], item["interviewer_id"]}: raise api_error(403, "You cannot access this interview.", "OWNERSHIP_FORBIDDEN")
    return item

@router.post("", status_code=201)
def create(body: InterviewInput, user: dict = Depends(require_role("interviewer"))):
    job = fetch_maybe_single(admin_client().table("jobs").select("id,title,created_by").eq("id", body.job_id))
    if not job:
        raise api_error(404, "Job position not found.", "JOB_NOT_FOUND")
    if job.get("created_by") != user["id"]:
        raise api_error(403, "You can only schedule interviews for your own jobs.", "OWNERSHIP_FORBIDDEN")
    candidate = fetch_maybe_single(admin_client().table("profiles").select("id,full_name,email,role").eq("id", body.candidate_id))
    if not candidate:
        raise api_error(404, "Candidate not found.", "CANDIDATE_NOT_FOUND")
    if candidate.get("role") != "candidate":
        raise api_error(403, "The selected profile is not a candidate.", "INVALID_ROLE")

    iso_scheduled_at = body.scheduled_at.isoformat()

    # Prevent duplicate interviews for the same candidate, job, and schedule slot
    existing = fetch_maybe_single(admin_client().table("interviews").select("id").eq("job_id", body.job_id).eq("candidate_id", body.candidate_id).eq("scheduled_at", iso_scheduled_at).in_("status", ["scheduled", "live"]))
    if existing:
        raise api_error(409, "An interview is already scheduled for this candidate at this time.", "INTERVIEW_CONFLICT")

    data = body.model_dump()
    data.update({
        "interviewer_id": user["id"],
        "meeting_room_id": secrets.token_urlsafe(12),
        "scheduled_at": iso_scheduled_at,
        "status": "scheduled",
    })
    try:
        created = admin_client().table("interviews").insert(data).execute().data[0]
    except Exception as exc:
        raise api_error(409, "This interview could not be scheduled. A conflicting interview may exist.", "INTERVIEW_CONFLICT")

    notify(
        body.candidate_id,
        f"interview:{created['id']}:scheduled",
        "Interview scheduled",
        f"Your interview '{created.get('title', 'Interview')}' for {job.get('title', 'position')} has been scheduled.",
        "/candidate/interviews",
    )
    return {"success": True, "data": created}

@router.get("")
def list_interviews(user: dict = Depends(get_current_user)):
    is_candidate = user["profile"].get("role") == "candidate"
    field = "candidate_id" if is_candidate else "interviewer_id"
    rows = (
        admin_client()
        .table("interviews")
        .select(
            "*,jobs(id,title,department,location),"
            "candidate:profiles!interviews_candidate_id_fkey(id,full_name,email,headline,avatar_url),"
            "interviewer:profiles!interviews_interviewer_id_fkey(id,full_name,email,company,headline,avatar_url),"
            "interview_results(*)"
        )
        .eq(field, user["id"])
        .order("scheduled_at", desc=False)
        .execute()
        .data
    )
    for r in rows:
        if r.get("candidate"):
            if not r.get("profiles"):
                r["profiles"] = r["candidate"]
            if r["candidate"].get("avatar_url"):
                r["candidate"]["avatar_url"] = candidate_avatar_url(r["candidate"]["avatar_url"])
        if r.get("interviewer") and r["interviewer"].get("avatar_url"):
            r["interviewer"]["avatar_url"] = candidate_avatar_url(r["interviewer"]["avatar_url"])
    return {"success": True, "data": rows}

@router.get("/{interview_id}")
def get(interview_id: str, user: dict = Depends(get_current_user)):
    item = (
        admin_client()
        .table("interviews")
        .select(
            "*,jobs(id,title,department,location),"
            "candidate:profiles!interviews_candidate_id_fkey(id,full_name,email,headline,avatar_url),"
            "interviewer:profiles!interviews_interviewer_id_fkey(id,full_name,email,company,headline,avatar_url),"
            "interview_results(*)"
        )
        .eq("id", interview_id)
        .execute()
        .data
    )
    if not item:
        raise api_error(404, "Interview not found.", "INTERVIEW_NOT_FOUND")
    record = item[0]
    if record.get("candidate"):
        if not record.get("profiles"):
            record["profiles"] = record["candidate"]
        if record["candidate"].get("avatar_url"):
            record["candidate"]["avatar_url"] = candidate_avatar_url(record["candidate"]["avatar_url"])
    if record.get("interviewer") and record["interviewer"].get("avatar_url"):
        record["interviewer"]["avatar_url"] = candidate_avatar_url(record["interviewer"]["avatar_url"])
    if user["id"] not in {record["candidate_id"], record["interviewer_id"]}:
        raise api_error(403, "You cannot access this interview.", "OWNERSHIP_FORBIDDEN")
    return {"success": True, "data": record}

@router.put("/{interview_id}")
def update(interview_id: str, body: InterviewUpdate, user: dict = Depends(require_role("interviewer"))):
    item = interview_for_user(interview_id, user)
    if item["interviewer_id"] != user["id"]:
        raise api_error(403, "Only the interviewer can update this interview.", "OWNERSHIP_FORBIDDEN")
    updated = admin_client().table("interviews").update(body.model_dump(exclude_none=True)).eq("id", interview_id).execute().data[0]
    notify(
        item["candidate_id"],
        f"interview:{interview_id}:updated",
        "Interview updated",
        f"Your interview '{updated.get('title', 'Interview')}' schedule or details have been updated.",
        "/candidate/interviews",
    )
    return {"success": True, "data": updated}

@router.delete("/{interview_id}")
def delete(interview_id: str, user: dict = Depends(require_role("interviewer"))):
    item = interview_for_user(interview_id, user)
    if item["interviewer_id"] != user["id"]:
        raise api_error(403, "Only the interviewer can delete this interview.", "OWNERSHIP_FORBIDDEN")

    # Notify candidate of interview cancellation/removal
    try:
        notify(
            item["candidate_id"],
            f"interview:{interview_id}:cancelled",
            "Interview Schedule Cancelled",
            f"Your interview schedule for '{item.get('title', 'Interview')}' has been removed by the interviewer.",
            "/candidate/interviews",
        )
    except Exception:
        pass

    # Clean up any related child records
    try:
        admin_client().table("reports").delete().eq("interview_id", interview_id).execute()
    except Exception:
        pass
    try:
        admin_client().table("interview_answers").delete().eq("interview_id", interview_id).execute()
    except Exception:
        pass
    try:
        admin_client().table("interview_questions").delete().eq("interview_id", interview_id).execute()
    except Exception:
        pass
    try:
        admin_client().table("interview_results").delete().eq("interview_id", interview_id).execute()
    except Exception:
        pass
    try:
        admin_client().table("monitoring_events").delete().eq("interview_id", interview_id).execute()
    except Exception:
        pass

    try:
        admin_client().table("interviews").delete().eq("id", interview_id).execute()
    except Exception:
        admin_client().table("interviews").update({"status": "cancelled"}).eq("id", interview_id).execute()

    return {"success": True, "message": "Interview schedule deleted successfully."}

@router.post("/{interview_id}/start")
def start(interview_id: str, user: dict = Depends(require_role("interviewer"))):
    item = interview_for_user(interview_id, user)
    if item["interviewer_id"] != user["id"]:
        raise api_error(403, "Only the interviewer can start this interview.", "OWNERSHIP_FORBIDDEN")
    updated = admin_client().table("interviews").update({"status": "live"}).eq("id", interview_id).execute().data[0]
    notify(
        item["candidate_id"],
        f"interview:{interview_id}:live",
        "Interviewer has started the interview",
        f"The live interview room for '{item.get('title', 'Interview')}' is now active. Click to join.",
        f"/candidate/live?interview={interview_id}",
    )
    return {"success": True, "data": updated}

@router.post("/{interview_id}/complete")
def complete(interview_id: str, user: dict = Depends(require_role("interviewer"))):
    item = interview_for_user(interview_id, user)
    if item["interviewer_id"] != user["id"]:
        raise api_error(403, "Only the interviewer can complete this interview.", "OWNERSHIP_FORBIDDEN")
    updated = admin_client().table("interviews").update({"status": "completed"}).eq("id", interview_id).execute().data[0]
    notify(
        item["candidate_id"],
        f"interview:{interview_id}:completed",
        "Interview completed",
        f"Your interview '{item.get('title', 'Interview')}' has concluded.",
        f"/candidate/results?interview={interview_id}",
    )
    return {"success": True, "data": updated}

@router.post("/{interview_id}/join")
def join(interview_id: str, user: dict = Depends(get_current_user)):
    item = interview_for_user(interview_id, user)
    if item["status"] == "cancelled":
        raise api_error(409, "This interview has been cancelled.", "INTERVIEW_CANCELLED")
    return {"success": True, "room_id": item["meeting_room_id"], "role": user["profile"]["role"], "status": item["status"]}

DEFAULT_QUESTIONS = [
    {
        "question": "How would you optimize a React application that is becoming slow as the component tree grows?",
        "question_type": "technical",
        "difficulty": "medium",
        "order_index": 1,
        "points": 20,
    },
    {
        "question": "Explain the difference between synchronous and asynchronous programming in JavaScript and how the event loop works.",
        "question_type": "technical",
        "difficulty": "medium",
        "order_index": 2,
        "points": 20,
    },
    {
        "question": "Describe a challenging technical bug or architectural bottleneck you encountered recently and how you resolved it.",
        "question_type": "behavioral_technical",
        "difficulty": "medium",
        "order_index": 3,
        "points": 20,
    },
    {
        "question": "How do you approach database schema design and indexing for high-read vs high-write workloads?",
        "question_type": "system_design",
        "difficulty": "hard",
        "order_index": 4,
        "points": 20,
    },
]

@router.get("/{interview_id}/questions")
def questions(interview_id: str, user: dict = Depends(get_current_user)):
    interview_for_user(interview_id, user)
    existing = admin_client().table("interview_questions").select("*").eq("interview_id", interview_id).order("order_index").execute().data
    if not existing:
        # Seed default questions for this interview
        for q in DEFAULT_QUESTIONS:
            admin_client().table("interview_questions").insert({
                "interview_id": interview_id,
                **q
            }).execute()
        existing = admin_client().table("interview_questions").select("*").eq("interview_id", interview_id).order("order_index").execute().data
    return {"success": True, "data": existing}

@router.get("/{interview_id}/answers")
def answers(interview_id: str, user: dict = Depends(get_current_user)):
    interview_for_user(interview_id, user)
    return {"success": True, "data": admin_client().table("interview_answers").select("*").eq("interview_id", interview_id).order("submitted_at").execute().data}

@router.put("/{interview_id}/answers/{question_id}")
def answer(interview_id: str, question_id: str, body: dict, user: dict = Depends(get_current_user)):
    item = interview_for_user(interview_id, user)
    if item["candidate_id"] != user["id"]:
        raise api_error(403, "You cannot submit this answer.", "OWNERSHIP_FORBIDDEN")
    question = fetch_maybe_single(admin_client().table("interview_questions").select("id").eq("id", question_id).eq("interview_id", interview_id))
    if not question:
        raise api_error(404, "Question not found.", "QUESTION_NOT_FOUND")
    
    text = body.get("answer_text") or ""
    transcript = body.get("answer_transcript") or text
    if not text and transcript:
        text = transcript

    data = {
        "interview_id": interview_id,
        "question_id": question_id,
        "candidate_id": user["id"],
        "answer_text": text,
        "answer_transcript": transcript,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    existing_answer = fetch_maybe_single(
        admin_client()
        .table("interview_answers")
        .select("id")
        .eq("interview_id", interview_id)
        .eq("question_id", question_id)
        .eq("candidate_id", user["id"])
    )

    if existing_answer:
        result = (
            admin_client()
            .table("interview_answers")
            .update(data)
            .eq("id", existing_answer["id"])
            .execute()
            .data[0]
        )
    else:
        result = (
            admin_client()
            .table("interview_answers")
            .insert(data)
            .execute()
            .data[0]
        )
    return {"success": True, "data": result}


@router.post("/{interview_id}/questions", status_code=201)
def add_question(interview_id: str, body: QuestionInput, user: dict = Depends(require_role("interviewer"))):
    item = interview_for_user(interview_id, user)
    if item["interviewer_id"] != user["id"]: raise api_error(403, "Only the interviewer can add questions.", "OWNERSHIP_FORBIDDEN")
    data = body.model_dump(); data["interview_id"] = interview_id
    return {"success": True, "data": admin_client().table("interview_questions").insert(data).execute().data[0]}

@router.post("/{interview_id}/monitoring-events", status_code=201)
def monitor(interview_id: str, body: MonitoringEventInput, user: dict = Depends(get_current_user)):
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

@router.post("/recommendations")
def save_recommendation(body: RecommendationInput, user: dict = Depends(require_role("interviewer"))):
    candidate = fetch_maybe_single(admin_client().table("profiles").select("id").eq("id", body.candidate_id))
    if not candidate:
        raise api_error(404, "Candidate not found.", "CANDIDATE_NOT_FOUND")

    interview_id = body.interview_id
    if not interview_id:
        latest = fetch_maybe_single(admin_client().table("interviews").select("id").eq("candidate_id", body.candidate_id).eq("interviewer_id", user["id"]).order("created_at", desc=True).limit(1))
        if latest:
            interview_id = latest["id"]

    if not interview_id:
        raise api_error(400, "An interview session is required to record a formal hiring recommendation.", "INTERVIEW_REQUIRED")

    rec_val = body.recommendation.lower()
    if rec_val in {"recommended", "strong_hire"}:
        rec_val = "strong_hire"
    elif rec_val in {"hire"}:
        rec_val = "hire"
    elif rec_val in {"review", "maybe"}:
        rec_val = "maybe"
    elif rec_val in {"reject", "no_hire"}:
        rec_val = "no_hire"
    else:
        rec_val = "maybe"

    data = {
        "interview_id": interview_id,
        "candidate_id": body.candidate_id,
        "recommendation": rec_val,
        "summary": body.notes,
    }
    result = admin_client().table("interview_results").upsert(data, on_conflict="interview_id").execute().data[0]
    return {"success": True, "data": result}

@router.post("/{interview_id}/decision")
def record_decision(interview_id: str, body: dict, user: dict = Depends(require_role("interviewer"))):
    item = interview_for_user(interview_id, user)
    if item["interviewer_id"] != user["id"]:
        raise api_error(403, "Only the assigned interviewer can record a candidate decision.", "OWNERSHIP_FORBIDDEN")
    
    decision_val = body.get("decision", "").lower().strip()
    if decision_val not in ("selected", "rejected"):
        raise api_error(400, "Decision must be 'selected' or 'rejected'.", "INVALID_DECISION")
    
    feedback = (body.get("feedback") or "").strip()
    strengths = (body.get("strengths") or "").strip()
    weaknesses = (body.get("weaknesses") or "").strip()
    score = body.get("overall_score")

    # 1. Update interview status to completed
    admin_client().table("interviews").update({"status": "completed"}).eq("id", interview_id).execute()

    # 2. Update job application status if exists
    if item.get("job_id") and item.get("candidate_id"):
        app = fetch_maybe_single(
            admin_client().table("job_applications")
            .select("id")
            .eq("job_id", item["job_id"])
            .eq("candidate_id", item["candidate_id"])
        )
        if app:
            admin_client().table("job_applications").update({
                "status": "selected" if decision_val == "selected" else "rejected"
            }).eq("id", app["id"]).execute()

    # 3. Upsert interview_results
    rec_mapping = "strong_hire" if decision_val == "selected" else "no_hire"
    result_data = {
        "interview_id": interview_id,
        "candidate_id": item["candidate_id"],
        "recommendation": rec_mapping,
        "summary": feedback or f"Candidate was marked {decision_val.upper()} by interviewer.",
    }
    if strengths:
        result_data["strengths"] = strengths
    if weaknesses:
        result_data["weaknesses"] = weaknesses

    if score is not None:
        try:
            result_data["overall_score"] = float(score)
        except (ValueError, TypeError):
            pass
    for score_field in ("technical_score", "communication_score", "problem_solving_score", "confidence_score", "behavioral_score"):
        val = body.get(score_field)
        if val is not None:
            try:
                result_data[score_field] = float(val)
            except (ValueError, TypeError):
                pass

    res = admin_client().table("interview_results").upsert(result_data, on_conflict="interview_id").execute().data[0]

    # 4. Notify Candidate
    job = fetch_maybe_single(admin_client().table("jobs").select("title").eq("id", item.get("job_id")))
    job_title = job.get("title", "the position") if job else "the position"

    if decision_val == "selected":
        notif_title = f"Congratulations! You have been selected for {job_title}"
        notif_msg = f"Great news! The interviewer has concluded your session and marked you SELECTED for '{job_title}'. Feedback: {feedback or strengths or 'Outstanding interview performance.'}".strip()
    else:
        notif_title = f"Interview Outcome Update: {job_title}"
        notif_msg = f"Thank you for interviewing for '{job_title}'. Your evaluation and interviewer feedback are now available.".strip()

    notify(
        item["candidate_id"],
        f"interview:{interview_id}:decision:{decision_val}:{int(datetime.now(timezone.utc).timestamp())}",
        notif_title,
        notif_msg,
        f"/candidate/results?interview={interview_id}"
    )

    return {"success": True, "decision": decision_val, "data": res}


