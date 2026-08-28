from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, require_role
from app.db.supabase import admin_client

router = APIRouter(tags=["dashboards"])

@router.get("/candidate/dashboard")
def candidate_dashboard(user: dict = Depends(get_current_user)):
    db = admin_client()
    uid = user["id"]

    # 1. Interviews for candidate
    try:
        interviews = db.table("interviews").select(
            "*,jobs(id,title,department,location),"
            "interviewer:profiles!interviews_interviewer_id_fkey(id,full_name,avatar_url,company)"
        ).eq("candidate_id", uid).order("scheduled_at").execute().data or []
    except Exception:
        try:
            interviews = db.table("interviews").select("*,jobs(id,title,department,location)").eq("candidate_id", uid).order("scheduled_at").execute().data or []
        except Exception:
            try:
                interviews = db.table("interviews").select("*").eq("candidate_id", uid).execute().data or []
            except Exception:
                interviews = []

    # 2. Job Applications for candidate
    try:
        apps = db.table("job_applications").select(
            "*,jobs(id,title,department,location,employment_type,salary_range)"
        ).eq("candidate_id", uid).order("created_at", desc=True).execute().data or []
    except Exception:
        try:
            apps = db.table("job_applications").select("*").eq("candidate_id", uid).execute().data or []
        except Exception:
            apps = []

    # 3. Notifications for candidate
    try:
        notes = db.table("notifications").select("*").eq("user_id", uid).order("created_at", desc=True).limit(5).execute().data or []
    except Exception:
        notes = []

    # 4. Interview Results for candidate
    try:
        results = db.table("interview_results").select(
            "*,interviews(id,title,type,scheduled_at,jobs(id,title,department))"
        ).eq("candidate_id", uid).order("created_at", desc=True).execute().data or []
    except Exception:
        try:
            results = db.table("interview_results").select("*").eq("candidate_id", uid).execute().data or []
        except Exception:
            results = []

    # 5. Practice attempts
    practice_attempts = []
    try:
        practice_attempts = db.table("practice_test_attempts").select("id,score,submitted_at,test_id").eq("candidate_id", uid).execute().data or []
        practice_attempts = [p for p in practice_attempts if p.get("submitted_at")]
    except Exception:
        practice_attempts = []

    # 6. Group Discussions for candidate
    try:
        member_entries = db.table("group_discussion_members").select("discussion_id").eq("candidate_id", uid).execute().data or []
        disc_ids = [m["discussion_id"] for m in member_entries if m.get("discussion_id")]
        if disc_ids:
            gds = db.table("group_discussions").select("*,jobs(id,title,department)").in_("id", disc_ids).order("scheduled_at", desc=True).execute().data or []
        else:
            gds = db.table("group_discussions").select("*,jobs(id,title,department)").in_("status", ["live", "scheduled"]).order("scheduled_at", desc=True).execute().data or []
    except Exception:
        gds = []

    # 7. Scores calculation
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

    # 8. Profile Readiness Calculation
    profile = user.get("profile") or {}
    key_fields = ["full_name", "phone", "location", "bio", "headline", "resume_path"]
    skills = profile.get("skills")
    skills_filled = bool(skills and (isinstance(skills, list) and len(skills) > 0 or isinstance(skills, str) and len(skills) > 2))
    filled_count = sum(bool(profile.get(k)) for k in key_fields) + (1 if skills_filled else 0)
    profile_completion = min(100, int((filled_count / (len(key_fields) + 1)) * 100))

    # 9. Application counts by status
    applied_count = len([a for a in apps if a.get("status") == "applied"])
    screening_count = len([a for a in apps if a.get("status") == "screening"])
    shortlisted_count = len([a for a in apps if a.get("status") == "shortlisted"])
    interviewing_count = len([a for a in apps if a.get("status") == "interview"])
    selected_count = len([a for a in apps if a.get("status") == "selected"])
    rejected_count = len([a for a in apps if a.get("status") == "rejected"])

    upcoming_ints = [x for x in interviews if x.get("status") in ("scheduled", "live")]
    completed_ints = [x for x in interviews if x.get("status") == "completed"]

    return {
        "success": True,
        "data": {
            # Core metrics
            "applications_count": len(apps),
            "total_applications": len(apps),
            "applied_count": applied_count,
            "screening_count": screening_count,
            "shortlisted_count": shortlisted_count,
            "interviewing_count": interviewing_count,
            "selected_count": selected_count,
            "rejected_count": rejected_count,
            "scheduled_interviews": len(upcoming_ints),
            "completed_interviews": len(completed_ints),
            "average_score": avg_score,
            "practice_count": len(practice_attempts),
            "profile_completion": profile_completion,
            # Structured records
            "upcoming_interviews": upcoming_ints,
            "completed_interviews": completed_ints,
            "recent_applications": apps[:10],
            "recent_results": results[:5],
            "group_discussions": gds,
            "notifications": notes,
            "profile": profile,
        },
    }

@router.get("/interviewer/dashboard")
def interviewer_dashboard(user: dict = Depends(require_role("interviewer"))):
    db = admin_client()
    uid = user["id"]
    
    # 1. Jobs created by interviewer
    try:
        jobs = db.table("jobs").select("id,title,status").eq("created_by", uid).execute().data or []
    except Exception:
        jobs = []
    job_ids = [j["id"] for j in jobs if j.get("id")]

    # 2. Applications submitted to these jobs
    apps = []
    if job_ids:
        try:
            apps = db.table("job_applications").select("id,job_id,candidate_id,status,created_at").in_("job_id", job_ids).execute().data or []
        except Exception:
            apps = []
    
    # 3. Interviews (by interviewer_id OR by job_id)
    ints = []
    try:
        ints_by_interviewer = db.table("interviews").select("id,status,candidate_id,job_id,scheduled_at").eq("interviewer_id", uid).execute().data or []
    except Exception:
        ints_by_interviewer = []

    ints_by_job = []
    if job_ids:
        try:
            ints_by_job = db.table("interviews").select("id,status,candidate_id,job_id,scheduled_at").in_("job_id", job_ids).execute().data or []
        except Exception:
            ints_by_job = []
    
    all_ints_dict = {i["id"]: i for i in (ints_by_interviewer + ints_by_job) if i.get("id")}
    ints = list(all_ints_dict.values())
    interview_ids = list(all_ints_dict.keys())

    candidate_ids = set([a["candidate_id"] for a in apps if a.get("candidate_id")] + [i["candidate_id"] for i in ints if i.get("candidate_id")])
    candidate_id_list = list(candidate_ids)

    # 4. Scores & Results
    scored = []
    if interview_ids:
        try:
            results = db.table("interview_results").select("overall_score,technical_score,communication_score,interview_id,candidate_id").in_("interview_id", interview_ids).execute().data or []
            for r in results:
                if r.get("overall_score") is not None:
                    try:
                        scored.append(float(r["overall_score"]))
                    except (ValueError, TypeError):
                        pass
        except Exception:
            pass

    if candidate_id_list:
        try:
            cand_scores = db.table("candidate_scores").select("score,candidate_id").in_("candidate_id", candidate_id_list).execute().data or []
            for cs in cand_scores:
                if cs.get("score") is not None:
                    try:
                        scored.append(float(cs["score"]))
                    except (ValueError, TypeError):
                        pass
        except Exception:
            pass

    if not scored and interview_ids:
        try:
            answers = db.table("interview_answers").select("ai_assistance_score").in_("interview_id", interview_ids).execute().data or []
            for a in answers:
                if a.get("ai_assistance_score") is not None:
                    try:
                        scored.append(float(a["ai_assistance_score"]))
                    except (ValueError, TypeError):
                        pass
        except Exception:
            pass

    avg_score = round(sum(scored) / len(scored), 1) if scored else None

    # 5. Integrity & Monitoring Events
    events = []
    if interview_ids:
        try:
            events = db.table("monitoring_events").select("id,severity,event_type").in_("interview_id", interview_ids).execute().data or []
        except Exception:
            events = []

    if candidate_id_list:
        try:
            cand_events = db.table("monitoring_events").select("id,severity,event_type").in_("candidate_id", candidate_id_list).execute().data or []
            events_dict = {e["id"]: e for e in (events + cand_events) if e.get("id")}
            events = list(events_dict.values())
        except Exception:
            pass

    alert_types = {"tab_switch", "window_blur", "multiple_faces", "face_not_detected", "audio_anomaly", "gaze_unfocused", "ai_assistance_flagged"}
    open_alerts = len([
        e for e in events
        if e.get("severity") in ("warning", "critical") or e.get("event_type") in alert_types
    ])

    try:
        all_candidates = db.table("profiles").select("id,full_name,headline,location,avatar_url").eq("role", "candidate").execute().data or []
    except Exception:
        all_candidates = []

    # Recent notifications for interviewer
    try:
        notes = db.table("notifications").select("*").eq("user_id", uid).order("created_at", desc=True).limit(6).execute().data or []
    except Exception:
        notes = []

    # Enriched recent applications
    recent_apps = []
    if apps:
        try:
            cand_map = {c["id"]: c for c in all_candidates}
            job_map = {j["id"]: j for j in jobs}
            for app_item in sorted(apps, key=lambda x: x.get("created_at", ""), reverse=True)[:6]:
                app_copy = dict(app_item)
                app_copy["candidate"] = cand_map.get(app_item.get("candidate_id"), {})
                app_copy["job"] = job_map.get(app_item.get("job_id"), {})
                recent_apps.append(app_copy)
        except Exception:
            recent_apps = apps[:6]

    funnel = [
        {"stage": "Applied", "count": len(apps)},
        {"stage": "Screening", "count": len([a for a in apps if a.get("status") == "screening"])},
        {"stage": "Interview", "count": len([a for a in apps if a.get("status") in ("interview", "shortlisted")])},
        {"stage": "Shortlisted", "count": len([a for a in apps if a.get("status") == "shortlisted"])},
        {"stage": "Selected", "count": len([a for a in apps if a.get("status") == "selected"])},
    ]

    return {
        "success": True,
        "data": {
            "active_jobs": len([x for x in jobs if x.get("status") == "published"]),
            "total_jobs": len(jobs),
            "total_candidates": len(all_candidates),
            "pipeline_candidates": len(candidate_ids),
            "upcoming_interviews": len([x for x in ints if x.get("status") in ("scheduled", "live")]),
            "completed_interviews": len([x for x in ints if x.get("status") == "completed"]),
            "average_score": avg_score,
            "open_alerts": open_alerts,
            "funnel": funnel,
            "total_applications": len(apps),
            "notifications": notes,
            "recent_applications": recent_apps,
        },
    }
