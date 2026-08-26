from fastapi import APIRouter, Depends
from pathlib import PurePosixPath
from app.dependencies import get_current_user, require_role
from app.db.supabase import admin_client
from app.schemas.common import ProfileUpdate

router = APIRouter(prefix="/profiles", tags=["profiles"])

def candidate_avatar_url(path: str | None) -> str | None:
    if not path or len(PurePosixPath(path).parts) != 2 or not PurePosixPath(path).parts[1].startswith("avatar"):
        return None
    try:
        return admin_client().storage.from_("avatars").create_signed_url(path, 300)["signedURL"]
    except Exception:
        return None

@router.get("/me")
def get_profile(user: dict = Depends(get_current_user)): return {"success": True, "data": user["profile"]}

@router.get("/candidates")
def list_candidates(user: dict = Depends(require_role("interviewer"))):
    rows = admin_client().table("profiles").select("id,email,full_name,phone,headline,bio,location,skills,education,experience,avatar_url,updated_at").eq("role", "candidate").order("created_at", desc=True).execute().data
    for row in rows:
        row["avatar_url"] = candidate_avatar_url(row.get("avatar_url"))
    return {"success": True, "data": rows}

@router.put("/me")
def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if data: admin_client().table("profiles").update(data).eq("id", user["id"]).execute()
    return {"success": True, "data": admin_client().table("profiles").select("*").eq("id", user["id"]).single().execute().data}

@router.post("/ensure")
def ensure_profile(user: dict = Depends(get_current_user)):
    profile = admin_client().table("profiles").upsert({"id": user["id"], "email": user["email"], "full_name": user["profile"].get("full_name", ""), "role": user["profile"].get("role", "candidate")}, on_conflict="id").execute().data[0]
    return {"success": True, "data": profile}
