from typing import Any
import logging
from app.db.supabase import admin_client

logger = logging.getLogger("notifications")

def notify(user_id: str, event_key: str, title: str, message: str, link: str | None = None) -> None:
    try:
        client = admin_client()
        type_val = event_key.split(":", 1)[0] if event_key else "info"
        data = {
            "user_id": user_id,
            "event_key": event_key,
            "type": type_val,
            "title": title,
            "message": message,
            "link": link
        }
        if event_key:
            existing = client.table("notifications").select("id").eq("event_key", event_key).execute().data
            if existing:
                client.table("notifications").update(data).eq("id", existing[0]["id"]).execute()
                return
        client.table("notifications").insert(data).execute()
    except Exception as exc:
        # Notifications are side effects; log error but do not disrupt primary user workflows
        logger.warning("Failed to dispatch notification to %s: %s", user_id, exc)

