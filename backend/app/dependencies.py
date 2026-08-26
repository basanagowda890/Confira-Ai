from typing import Callable
from fastapi import Depends, Header, HTTPException
from app.core.errors import api_error
from app.db.supabase import anon_client, admin_client


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise api_error(401, "Authentication is required.", "AUTH_REQUIRED")
    try:
        user = anon_client().auth.get_user(token.strip()).user
        if not user:
            raise ValueError("No user")
        profile = admin_client().table("profiles").select("*").eq("id", user.id).maybe_single().execute().data
        if not profile:
            # Safe recovery for users created before the profile trigger was installed.
            profile = admin_client().table("profiles").upsert({"id": user.id, "email": user.email, "full_name": user.user_metadata.get("full_name", ""), "role": user.user_metadata.get("requested_role", "candidate")}, on_conflict="id").execute().data[0]
        return {"id": user.id, "email": user.email, "profile": profile}
    except HTTPException:
        raise
    except Exception:
        raise api_error(401, "Your session is invalid or has expired.", "INVALID_SESSION")


def require_role(role: str) -> Callable:
    def check(user: dict = Depends(get_current_user)) -> dict:
        if user["profile"].get("role") != role:
            raise api_error(403, "You do not have permission to perform this action.", "ROLE_FORBIDDEN")
        return user
    return check
