from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, require_role
from app.db.supabase import admin_client, fetch_maybe_single
from app.schemas.common import JobInput, ApplicationStatusInput
from app.core.errors import api_error
from app.services.notifications import notify

router = APIRouter(tags=["jobs", "applications"])

def own_job(job_id, user):
    job = fetch_maybe_single(admin_client().table("jobs").select("*").eq("id", job_id))
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
    # Check for duplicate job with identical title and department by this interviewer
    existing = fetch_maybe_single(admin_client().table("jobs").select("id").eq("created_by", user["id"]).eq("title", body.title.strip()).eq("department", (body.department or "").strip()).in_("status", ["draft", "published"]))
    if existing:
        raise api_error(409, "A position with this title and department already exists in your workspace.", "DUPLICATE_JOB")

    data = body.model_dump()
    data["created_by"] = user["id"]
    data["title"] = body.title.strip()
    return {"success": True, "data": admin_client().table("jobs").insert(data).execute().data[0]}

@router.get("/jobs/{job_id}")
def get_job(job_id: str, user: dict = Depends(get_current_user)):
    job = fetch_maybe_single(admin_client().table("jobs").select("*").eq("id", job_id))
    if not job: raise api_error(404, "Job not found.", "JOB_NOT_FOUND")
    return {"success": True, "data": job}

@router.put("/jobs/{job_id}")
def update_job(job_id: str, body: JobInput, user: dict = Depends(require_role("interviewer"))):
    own_job(job_id, user)
    data = body.model_dump(exclude_none=True)
    return {"success": True, "data": admin_client().table("jobs").update(data).eq("id", job_id).execute().data[0]}

@router.delete("/jobs/{job_id}")
def delete_job(job_id: str, user: dict = Depends(require_role("interviewer"))):
    own_job(job_id, user)
    try:
        admin_client().table("jobs").delete().eq("id", job_id).execute()
    except Exception:
        raise api_error(409, "Cannot delete position because active interviews or candidate applications exist. Please archive the position instead.", "JOB_IN_USE")
    return {"success": True, "message": "Position deleted successfully."}

@router.post("/jobs/{job_id}/apply", status_code=201)
def apply(job_id: str, user: dict = Depends(get_current_user)):
    job = fetch_maybe_single(admin_client().table("jobs").select("*").eq("id", job_id))
    if not job or job["status"] != "published":
        raise api_error(404, "This job is not available for applications.", "JOB_NOT_AVAILABLE")

    # Check if application already exists
    existing = fetch_maybe_single(
        admin_client()
        .table("job_applications")
        .select("*")
        .eq("job_id", job_id)
        .eq("candidate_id", user["id"])
    )
    if existing:
        return {"success": True, "data": existing, "message": "You have already applied for this position."}

    try:
        data = admin_client().table("job_applications").insert({
            "job_id": job_id,
            "candidate_id": user["id"],
            "status": "applied"
        }).execute().data[0]
    except Exception as e:
        raise api_error(409, f"Application could not be created: {str(e)}", "APPLICATION_FAILED")

    candidate_profile = user.get("profile") or {}
    candidate_name = candidate_profile.get("full_name") or user.get("email") or "A candidate"
    headline = candidate_profile.get("headline")
    candidate_desc = f"{candidate_name} ({headline})" if headline else candidate_name
    job_title = job.get("title", "Position")
    import time
    ts = int(time.time())

    # 1. Notify Candidate of successful application submission
    notify(
        user["id"],
        f"application:{job_id}:{user['id']}:{ts}",
        f"Application Submitted: {job_title}",
        f"Your application for '{job_title}' was submitted successfully. The company and hiring team have been notified.",
        "/candidate/jobs",
    )

    # 2. Notify the Interviewer/Company who posted the job (or all company interviewers)
    interviewers_to_notify = []
    if job.get("created_by"):
        interviewers_to_notify.append(job["created_by"])
    else:
        all_interviewers = admin_client().table("profiles").select("id").eq("role", "interviewer").execute().data or []
        interviewers_to_notify = [i["id"] for i in all_interviewers]

    for interviewer_id in interviewers_to_notify:
        notify(
            interviewer_id,
            f"job_app:{job_id}:{user['id']}:{ts}",
            f"New Candidate Application: {job_title}",
            f"{candidate_desc} has applied for '{job_title}'. Click to review profile and schedule an interview.",
            f"/interviewer/interviews?schedule=true&candidate={user['id']}&job={job_id}",
        )

    return {"success": True, "data": data}


@router.post("/jobs/{job_id}/{action}")
def set_job_status(job_id: str, action: str, user: dict = Depends(require_role("interviewer"))):
    if action not in {"publish", "close", "archive", "draft"}:
        raise api_error(404, "Action not supported.", "INVALID_ACTION")
    own_job(job_id, user)
    status = "published" if action == "publish" else "closed" if action in {"close", "archive"} else "draft"
    return {"success": True, "data": admin_client().table("jobs").update({"status": status}).eq("id", job_id).execute().data[0]}

@router.get("/candidate/applications")
def my_apps(user: dict = Depends(get_current_user)): return {"success": True, "data": admin_client().table("job_applications").select("*,jobs(*)").eq("candidate_id", user["id"]).execute().data}

@router.get("/interviewer/applications")
def interviewer_apps(user: dict = Depends(require_role("interviewer"))): return {"success": True, "data": admin_client().table("job_applications").select("*,jobs!inner(*),profiles!job_applications_candidate_id_fkey(*)").eq("jobs.created_by", user["id"]).execute().data}

@router.put("/applications/{application_id}/status")
def app_status(application_id: str, body: ApplicationStatusInput, user: dict = Depends(require_role("interviewer"))):
    app = fetch_maybe_single(admin_client().table("job_applications").select("*,jobs!inner(created_by)").eq("id", application_id))
    if not app or app["jobs"]["created_by"] != user["id"]: raise api_error(404, "Application not found.", "APPLICATION_NOT_FOUND")
    updated = admin_client().table("job_applications").update({"status": body.status}).eq("id", application_id).execute().data[0]
    notify(app["candidate_id"], f"application-status:{application_id}:{body.status}", "Application status updated", f"Your application status is now {body.status}.", "/candidate/interviews")
    return {"success": True, "data": updated}
