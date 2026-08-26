from fastapi import APIRouter, Depends
from app.dependencies import require_role
from app.db.supabase import admin_client

router = APIRouter(tags=["dashboards"])

@router.get("/candidate/dashboard")
def candidate_dashboard(user: dict = Depends(require_role("candidate"))):
    db = admin_client(); uid = user["id"]
    interviews = db.table("interviews").select("*,jobs(title)").eq("candidate_id", uid).order("scheduled_at").execute().data
    apps = db.table("job_applications").select("status").eq("candidate_id", uid).execute().data
    notes = db.table("notifications").select("*").eq("user_id", uid).order("created_at", desc=True).limit(5).execute().data
    complete = sum(bool(user["profile"].get(k)) for k in ("full_name", "phone", "location", "bio", "resume_path")) * 20
    return {"success": True, "data": {"upcoming_interviews": [x for x in interviews if x["status"] in ("scheduled", "live")], "completed_interviews": [x for x in interviews if x["status"] == "completed"], "application_count": len(apps), "shortlisted_count": len([x for x in apps if x["status"] == "shortlisted"]), "notifications": notes, "profile_completion": complete}}

@router.get("/interviewer/dashboard")
def interviewer_dashboard(user: dict = Depends(require_role("interviewer"))):
    db = admin_client(); uid = user["id"]
    jobs = db.table("jobs").select("id,status").eq("created_by", uid).execute().data
    ints = db.table("interviews").select("id,status,candidate_id").eq("interviewer_id", uid).execute().data
    return {"success": True, "data": {"active_jobs": len([x for x in jobs if x["status"] == "published"]), "total_candidates": len(set(x["candidate_id"] for x in ints)), "upcoming_interviews": len([x for x in ints if x["status"] == "scheduled"]), "completed_interviews": len([x for x in ints if x["status"] == "completed"])}}
