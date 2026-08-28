import hashlib
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user
from app.db.supabase import admin_client, fetch_maybe_single
from app.schemas.common import SendNotificationInput
from app.core.errors import api_error

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("")
def list_notifications(tab: str = Query(default="inbox"), user: dict = Depends(get_current_user)):
    if tab == "sent":
        return list_sent_notifications(user)
    
    rows = admin_client().table("notifications").select("*").eq("user_id", user["id"]).order("created_at", desc=True).execute().data
    return {"success": True, "data": rows}

@router.get("/sent")
def list_sent_notifications(user: dict = Depends(get_current_user)):
    # Match notifications sent by this user via event_key pattern msg:<sender_id>:* or interviewer_msg:<sender_id>:*
    all_notifs = admin_client().table("notifications").select("*").order("created_at", desc=True).execute().data
    sender_prefix_1 = f"msg:{user['id']}:"
    sender_prefix_2 = f"interviewer_msg:{user['id']}:"
    
    sent = [n for n in all_notifs if n.get("event_key") and (n["event_key"].startswith(sender_prefix_1) or n["event_key"].startswith(sender_prefix_2))]
    
    # Enrich with recipient profiles
    if sent:
        recipient_ids = list({n["user_id"] for n in sent if n.get("user_id")})
        if recipient_ids:
            recipients = {p["id"]: p for p in admin_client().table("profiles").select("id,full_name,email,role,company").in_("id", recipient_ids).execute().data}
            for item in sent:
                item["recipient"] = recipients.get(item["user_id"])
    return {"success": True, "data": sent}

@router.post("", status_code=201)
@router.post("/send", status_code=201)
def send_notification(body: SendNotificationInput, user: dict = Depends(get_current_user)):
    sender_role = user.get("role") or user.get("profile", {}).get("role", "candidate")
    
    # Determine recipient id
    recipient_id = body.recipient_id or (body.candidate_id if sender_role == "interviewer" else (body.interviewer_id or body.candidate_id))
    if not recipient_id:
        raise api_error(400, "Recipient ID is required.", "RECIPIENT_REQUIRED")
    
    # Verify recipient profile exists
    recipient = fetch_maybe_single(admin_client().table("profiles").select("id,full_name,email,role").eq("id", recipient_id))
    if not recipient:
        raise api_error(404, "Recipient profile not found.", "RECIPIENT_NOT_FOUND")

    # Generate unique idempotent event_key
    content_hash = hashlib.sha256(f"{body.title.strip()}:{body.message.strip()}".encode()).hexdigest()[:16]
    event_key = f"msg:{user['id']}:{recipient_id}:{int(time.time())}:{content_hash}"

    default_link = "/interviewer/notifications" if sender_role == "candidate" else "/candidate/notifications"
    data = {
        "user_id": recipient_id,
        "event_key": event_key,
        "type": (body.type or "info").strip(),
        "title": body.title.strip(),
        "message": body.message.strip(),
        "link": body.link or default_link,
    }

    client = admin_client()
    try:
        res = client.table("notifications").insert(data).execute()
        created = res.data[0]
    except Exception:
        existing = client.table("notifications").select("id").eq("event_key", event_key).execute().data
        if existing:
            res = client.table("notifications").update(data).eq("id", existing[0]["id"]).execute()
            created = res.data[0]
        else:
            raise api_error(500, "Could not deliver notification.", "NOTIFICATION_FAILED")

    return {"success": True, "data": created}

@router.post("/{notification_id}/read")
def read(notification_id: str, user: dict = Depends(get_current_user)):
    return {"success": True, "data": admin_client().table("notifications").update({"read_at": datetime.now(timezone.utc).isoformat()}).eq("id", notification_id).eq("user_id", user["id"]).execute().data}

@router.post("/read-all")
def read_all(user: dict = Depends(get_current_user)):
    admin_client().table("notifications").update({"read_at": datetime.now(timezone.utc).isoformat()}).eq("user_id", user["id"]).is_("read_at", "null").execute()
    return {"success": True}

