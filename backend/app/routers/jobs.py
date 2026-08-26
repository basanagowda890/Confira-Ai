from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, require_role
from app.db.supabase import admin_client
from app.schemas.common import JobInput, ApplicationStatusInput
from app.core.errors import api_error
from app.services.notifications import notify

router = APIRouter(tags=["jobs", "applications"])

def own_job(job_id, user):
    job = admin_client().table("jobs").select("*").eq("id", job_id).maybe_single().execute().data
    if not job: raise api_error(404, "Job not found.", "JOB_NOT_FOUND")
    if job["created_by"] != user["id"]: raise api_error(403, "You do not own this job.", "OWNERSHIP_FORBIDDEN")
    return job

@router.get("/jobs")
def list_jobs(status: str | None = None, user: dict = Depends(get_current_user)):
    query = admin_client().table("jobs").select("*").order("created_at", desc=True)
    if user["profile"]["role"] == "interviewer": query = query.eq("created_by", user["id"])
    else: query = query.eq("status", status or "published")
    return {"success": True, "data": query.execute().data}

@router.post("/jobs", status_code=201)
def create_job(body: JobInput, user: dict = Depends(require_role("interviewer"))):
    data = body.model_dump(); data["created_by"] = user["id"]
    return {"success": True, "data": admin_client().table("jobs").insert(data).execute().data[0]}

@router.get("/jobs/{job_id}")
def get_job(job_id: str, user: dict = Depends(get_current_user)):
    job = admin_client().table("jobs").select("*").eq("id", job_id).maybe_single().execute().data
    if not job: raise api_error(404, "Job not found.", "JOB_NOT_FOUND")
    return {"success": True, "data": job}

@router.put("/jobs/{job_id}")
def update_job(job_id: str, body: JobInput, user: dict = Depends(require_role("interviewer"))):
    own_job(job_id, user); return {"success": True, "data": admin_client().table("jobs").update(body.model_dump()).eq("id", job_id).execute().data[0]}

@router.delete("/jobs/{job_id}")
def delete_job(job_id: str, user: dict = Depends(require_role("interviewer"))):
    own_job(job_id, user); admin_client().table("jobs").delete().eq("id", job_id).execute(); return {"success": True}

@router.post("/jobs/{job_id}/{action}")
def set_job_status(job_id: str, action: str, user: dict = Depends(require_role("interviewer"))):
    if action not in {"publish", "close"}: raise api_error(404, "Action not found.", "NOT_FOUND")
    own_job(job_id, user); status = "published" if action == "publish" else "closed"
    return {"success": True, "data": admin_client().table("jobs").update({"status": status}).eq("id", job_id).execute().data[0]}

@router.post("/jobs/{job_id}/apply", status_code=201)
def apply(job_id: str, user: dict = Depends(require_role("candidate"))):
    job = admin_client().table("jobs").select("id,status").eq("id", job_id).maybe_single().execute().data
    if not job or job["status"] != "published": raise api_error(404, "This job is not available.", "JOB_NOT_AVAILABLE")
    try: data = admin_client().table("job_applications").upsert({"job_id": job_id, "candidate_id": user["id"]}, on_conflict="job_id,candidate_id").execute().data[0]
    except Exception: raise api_error(409, "Application could not be created.", "APPLICATION_FAILED")
    notify(user["id"], f"application:{job_id}:{user['id']}", "Application submitted", "Your application was submitted successfully.", f"/candidate/jobs/{job_id}")
    return {"success": True, "data": data}

@router.get("/candidate/applications")
def my_apps(user: dict = Depends(require_role("candidate"))): return {"success": True, "data": admin_client().table("job_applications").select("*,jobs(*)").eq("candidate_id", user["id"]).execute().data}

@router.get("/interviewer/applications")
def interviewer_apps(user: dict = Depends(require_role("interviewer"))): return {"success": True, "data": admin_client().table("job_applications").select("*,jobs!inner(*),profiles!job_applications_candidate_id_fkey(*)").eq("jobs.created_by", user["id"]).execute().data}

@router.put("/applications/{application_id}/status")
def app_status(application_id: str, body: ApplicationStatusInput, user: dict = Depends(require_role("interviewer"))):
    app = admin_client().table("job_applications").select("*,jobs!inner(created_by)").eq("id", application_id).maybe_single().execute().data
    if not app or app["jobs"]["created_by"] != user["id"]: raise api_error(404, "Application not found.", "APPLICATION_NOT_FOUND")
    updated = admin_client().table("job_applications").update({"status": body.status}).eq("id", application_id).execute().data[0]
    notify(app["candidate_id"], f"application-status:{application_id}:{body.status}", "Application status updated", f"Your application status is now {body.status}.", "/candidate/interviews")
    return {"success": True, "data": updated}
