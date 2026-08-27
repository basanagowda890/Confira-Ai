from pathlib import PurePosixPath

from fastapi import APIRouter, Depends, File, UploadFile

from app.config import get_settings
from app.core.errors import api_error
from app.db.supabase import admin_client, fetch_maybe_single
from app.dependencies import get_current_user, require_role

router = APIRouter(prefix="/uploads", tags=["uploads"])
RESUME_TYPES = {"application/pdf": ".pdf", "application/msword": ".doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx"}
AVATAR_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
SIGNED_URL_SECONDS = 300
MAX_AVATAR_SIZE_MB = 5


def _safe_path(user_id: str, filename: str) -> str:
    return str(PurePosixPath(user_id) / filename)


def _owned_path(path: str | None, user_id: str, filename_prefix: str) -> bool:
    if not path:
        return False
    candidate = PurePosixPath(path)
    return not candidate.is_absolute() and len(candidate.parts) == 2 and candidate.parts[0] == user_id and candidate.parts[1].startswith(filename_prefix) and ".." not in candidate.parts


async def _validated_content(file: UploadFile, allowed_types: dict[str, str], max_bytes: int, label: str) -> tuple[bytes, str]:
    content_type = (file.content_type or "").lower()
    extension = allowed_types.get(content_type)
    if not extension:
        raise api_error(415, f"Unsupported {label} file type.", "INVALID_FILE_TYPE")
    supplied_extension = PurePosixPath(file.filename or "").suffix.lower()
    if supplied_extension and supplied_extension != extension:
        raise api_error(415, f"The {label} file extension does not match its content type.", "INVALID_FILE_TYPE")
    content = await file.read(max_bytes + 1)
    if not content:
        raise api_error(400, f"The {label} file is empty.", "EMPTY_FILE")
    if len(content) > max_bytes:
        raise api_error(413, f"{label.capitalize()} is too large.", "FILE_TOO_LARGE")
    return content, extension


def _signed_url(bucket: str, path: str) -> str:
    return admin_client().storage.from_(bucket).create_signed_url(path, SIGNED_URL_SECONDS)["signedURL"]


@router.post("/resume")
async def upload_resume(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content, extension = await _validated_content(file, RESUME_TYPES, get_settings().max_resume_size_mb * 1024 * 1024, "resume")
    path = _safe_path(user["id"], f"resume{extension}")
    client, old_path = admin_client(), user["profile"].get("resume_path")
    client.storage.from_("resumes").upload(path, content, {"content-type": file.content_type, "upsert": "true"})
    if _owned_path(old_path, user["id"], "resume") and old_path != path:
        client.storage.from_("resumes").remove([old_path])
    client.table("profiles").update({"resume_path": path}).eq("id", user["id"]).execute()
    return {"success": True, "path": path}


@router.get("/resume")
def get_resume(user: dict = Depends(get_current_user)):
    path = user["profile"].get("resume_path")
    if not _owned_path(path, user["id"], "resume"):
        raise api_error(404, "No resume has been uploaded.", "RESUME_NOT_FOUND")
    return {"success": True, "url": _signed_url("resumes", path), "path": path, "expires_in": SIGNED_URL_SECONDS}


@router.get("/resume/{candidate_id}")
def get_candidate_resume(candidate_id: str, user: dict = Depends(require_role("interviewer"))):
    candidate = fetch_maybe_single(admin_client().table("profiles").select("id,resume_path").eq("id", candidate_id).eq("role", "candidate"))
    if not candidate:
        raise api_error(404, "Candidate profile not found.", "CANDIDATE_NOT_FOUND")
    if not candidate.get("resume_path"):
        raise api_error(404, "No resume has been uploaded for this candidate.", "RESUME_NOT_FOUND")
    path = candidate["resume_path"]
    if not _owned_path(path, candidate_id, "resume"):
        raise api_error(404, "Invalid resume path.", "RESUME_NOT_FOUND")

    has_apps = admin_client().table("job_applications").select("id,jobs!inner(created_by)").eq("candidate_id", candidate_id).eq("jobs.created_by", user["id"]).execute().data
    has_interviews = admin_client().table("interviews").select("id").eq("candidate_id", candidate_id).eq("interviewer_id", user["id"]).execute().data
    interviewer_jobs = admin_client().table("jobs").select("id").eq("created_by", user["id"]).execute().data

    if not has_apps and not has_interviews and not interviewer_jobs:
        raise api_error(403, "You are not authorized to view this candidate's resume.", "OWNERSHIP_FORBIDDEN")

    return {"success": True, "url": _signed_url("resumes", path), "path": path, "expires_in": SIGNED_URL_SECONDS}


@router.delete("/resume")
def delete_resume(user: dict = Depends(get_current_user)):
    path = user["profile"].get("resume_path")
    if not _owned_path(path, user["id"], "resume"):
        raise api_error(404, "No resume has been uploaded.", "RESUME_NOT_FOUND")
    client = admin_client()
    client.storage.from_("resumes").remove([path])
    client.table("profiles").update({"resume_path": None}).eq("id", user["id"]).execute()
    return {"success": True}



@router.post("/avatar")
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content, extension = await _validated_content(file, AVATAR_TYPES, MAX_AVATAR_SIZE_MB * 1024 * 1024, "avatar")
    path = _safe_path(user["id"], f"avatar{extension}")
    client, old_path = admin_client(), user["profile"].get("avatar_url")
    client.storage.from_("avatars").upload(path, content, {"content-type": file.content_type, "upsert": "true"})
    if _owned_path(old_path, user["id"], "avatar") and old_path != path:
        client.storage.from_("avatars").remove([old_path])
    client.table("profiles").update({"avatar_url": path}).eq("id", user["id"]).execute()
    return {"success": True, "path": path}


@router.get("/avatar")
def get_avatar(user: dict = Depends(get_current_user)):
    path = user["profile"].get("avatar_url")
    if not _owned_path(path, user["id"], "avatar"):
        raise api_error(404, "No avatar has been uploaded.", "AVATAR_NOT_FOUND")
    return {"success": True, "url": _signed_url("avatars", path), "expires_in": SIGNED_URL_SECONDS}


@router.delete("/avatar")
def delete_avatar(user: dict = Depends(get_current_user)):
    path = user["profile"].get("avatar_url")
    if not _owned_path(path, user["id"], "avatar"):
        raise api_error(404, "No avatar has been uploaded.", "AVATAR_NOT_FOUND")
    client = admin_client(); client.storage.from_("avatars").remove([path])
    client.table("profiles").update({"avatar_url": None}).eq("id", user["id"]).execute()
    return {"success": True}
