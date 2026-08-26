from typing import Any

from app.db.supabase import admin_client


def notify(user_id: str, event_key: str, title: str, message: str, link: str | None = None) -> None:
    try:
        admin_client().table("notifications").upsert(
            {"user_id": user_id, "event_key": event_key, "type": event_key.split(":", 1)[0], "title": title, "message": message, "link": link},
            on_conflict="event_key",
        ).execute()
    except Exception:
        # Notifications are side effects; do not fail the primary operation if an older schema is still deployed.
        return
