from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.db.supabase import admin_client

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("")
def list_notifications(user: dict = Depends(get_current_user)):
    return {"success": True, "data": admin_client().table("notifications").select("*").eq("user_id", user["id"]).order("created_at", desc=True).execute().data}

@router.post("/{notification_id}/read")
def read(notification_id: str, user: dict = Depends(get_current_user)):
    return {"success": True, "data": admin_client().table("notifications").update({"read_at": datetime.now(timezone.utc).isoformat()}).eq("id", notification_id).eq("user_id", user["id"]).execute().data}

@router.post("/read-all")
def read_all(user: dict = Depends(get_current_user)):
    admin_client().table("notifications").update({"read_at": datetime.now(timezone.utc).isoformat()}).eq("user_id", user["id"]).is_("read_at", "null").execute(); return {"success": True}
