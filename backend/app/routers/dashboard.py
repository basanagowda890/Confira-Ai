from fastapi import APIRouter, Depends
from app.dependencies import require_role
from app.db.supabase import admin_client

router = APIRouter(tags=["dashboards"])

@router.get("/candidate/dashboard")
def candidate_dashboard(user: dict = Depends(require_role("candidate"))):
    db = admin_client()
    uid = user["id"]
    interviews = db.table("interviews").select("*,jobs(id,title,department,location)").eq("candidate_id", uid).order("scheduled_at").execute().data
    apps = db.table("job_applications").select("*,jobs(id,title,department)").eq("candidate_id", uid).order("created_at", desc=True).execute().data
    notes = db.table("notifications").select("*").eq("user_id", uid).order("created_at", desc=True).limit(5).execute().data
    results = db.table("interview_results").select("overall_score,technical_score,communication_score").eq("candidate_id", uid).execute().data
    practice_attempts = db.table("practice_test_attempts").select("id,score,submitted_at").eq("candidate_id", uid).not_.is_("submitted_at", "null").execute().data

    scored_results = []
    for r in results:
        if r.get("overall_score") is not None:
            try:
                scored_results.append(float(r["overall_score"]))
            except (ValueError, TypeError):
                pass

    for p in practice_attempts:
        if p.get("score") is not None:
            try:
                scored_results.append(float(p["score"]))
            except (ValueError, TypeError):
                pass

    avg_score = round(sum(scored_results) / len(scored_results), 1) if scored_results else None

    profile = user["profile"]
    key_fields = ["full_name", "phone", "location", "bio", "headline", "resume_path"]
    skills_filled = bool(profile.get("skills") and len(profile["skills"]) > 0)
    filled_count = sum(bool(profile.get(k)) for k in key_fields) + (1 if skills_filled else 0)
    profile_completion = min(100, int((filled_count / (len(key_fields) + 1)) * 100))

    return {
        "success": True,
        "data": {
            "upcoming_interviews": [x for x in interviews if x["status"] in ("scheduled", "live")],
            "completed_interviews": [x for x in interviews if x["status"] == "completed"],
            "application_count": len(apps),
            "shortlisted_count": len([x for x in apps if x["status"] == "shortlisted"]),
            "average_score": avg_score,
            "practice_count": len(practice_attempts),
            "notifications": notes,
            "profile_completion": profile_completion,
            "recent_applications": apps[:5],
        },
    }

@router.get("/interviewer/dashboard")
def interviewer_dashboard(user: dict = Depends(require_role("interviewer"))):
    db = admin_client()
    uid = user["id"]
    
    # 1. Jobs created by interviewer
    jobs = db.table("jobs").select("id,title,status").eq("created_by", uid).execute().data
    job_ids = [j["id"] for j in jobs]

    # 2. Applications submitted to these jobs
    apps = db.table("job_applications").select("id,job_id,candidate_id,status,created_at").in_("job_id", job_ids).execute().data if job_ids else []
    
    # 3. Interviews (by interviewer_id OR by job_id)
    ints_by_interviewer = db.table("interviews").select("id,status,candidate_id,job_id,scheduled_at").eq("interviewer_id", uid).execute().data
    ints_by_job = db.table("interviews").select("id,status,candidate_id,job_id,scheduled_at").in_("job_id", job_ids).execute().data if job_ids else []
    
    all_ints_dict = {i["id"]: i for i in (ints_by_interviewer + ints_by_job)}
    ints = list(all_ints_dict.values())
    interview_ids = list(all_ints_dict.keys())

    candidate_ids = set([a["candidate_id"] for a in apps if a.get("candidate_id")] + [i["candidate_id"] for i in ints if i.get("candidate_id")])
    candidate_id_list = list(candidate_ids)

    # 4. Scores & Results
    results = db.table("interview_results").select("overall_score,technical_score,communication_score,interview_id,candidate_id").in_("interview_id", interview_ids).execute().data if interview_ids else []
    cand_scores = db.table("candidate_scores").select("score,candidate_id").in_("candidate_id", candidate_id_list).execute().data if candidate_id_list else []
    
    # Collect all numeric scores
    scored = []
    for r in results:
        if r.get("overall_score") is not None:
            try:
                scored.append(float(r["overall_score"]))
            except (ValueError, TypeError):
                pass

    for cs in cand_scores:
        if cs.get("score") is not None:
            try:
                scored.append(float(cs["score"]))
            except (ValueError, TypeError):
                pass

    # If no overall scorecard yet, inspect interview answers for AI analysis scores
    if not scored and interview_ids:
        answers = db.table("interview_answers").select("ai_analysis").in_("interview_id", interview_ids).execute().data
        for a in answers:
            analysis = a.get("ai_analysis")
            if isinstance(analysis, dict) and analysis.get("score") is not None:
                try:
                    scored.append(float(analysis["score"]))
                except (ValueError, TypeError):
                    pass

    avg_score = round(sum(scored) / len(scored), 1) if scored else None

    # 5. Integrity & Monitoring Events
    events = []
    if interview_ids:
        events = db.table("monitoring_events").select("id,severity,event_type,event_data").in_("interview_id", interview_ids).execute().data
    if candidate_id_list:
        cand_events = db.table("monitoring_events").select("id,severity,event_type,event_data").in_("candidate_id", candidate_id_list).execute().data
        events_dict = {e["id"]: e for e in (events + cand_events)}
        events = list(events_dict.values())

    # Count warnings, critical, tab switches, and security alerts
    alert_types = {"tab_switch", "window_blur", "multiple_faces", "face_not_detected", "audio_anomaly", "gaze_unfocused", "ai_assistance_flagged"}
    open_alerts = len([
        e for e in events
        if e.get("severity") in ("warning", "critical") or e.get("event_type") in alert_types
    ])

    all_candidates = db.table("profiles").select("id,full_name,headline,location,avatar_url").eq("role", "candidate").execute().data

    funnel = [
        {"stage": "Applied", "count": len(apps)},
        {"stage": "Screening", "count": len([a for a in apps if a["status"] == "screening"])},
        {"stage": "Interview", "count": len([a for a in apps if a["status"] in ("interview", "shortlisted")])},
        {"stage": "Shortlisted", "count": len([a for a in apps if a["status"] == "shortlisted"])},
        {"stage": "Selected", "count": len([a for a in apps if a["status"] == "selected"])},
    ]

    return {
        "success": True,
        "data": {
            "active_jobs": len([x for x in jobs if x["status"] == "published"]),
            "total_jobs": len(jobs),
            "total_candidates": len(all_candidates),
            "pipeline_candidates": len(candidate_ids),
            "upcoming_interviews": len([x for x in ints if x["status"] in ("scheduled", "live")]),
            "completed_interviews": len([x for x in ints if x["status"] == "completed"]),
            "average_score": avg_score,
            "open_alerts": open_alerts,
            "funnel": funnel,
            "total_applications": len(apps),
        },
    }
