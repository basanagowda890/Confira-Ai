from fastapi import APIRouter, Depends
from app.db.supabase import anon_client, admin_client
from app.dependencies import get_current_user
from app.core.errors import api_error
from app.schemas.common import RegisterInput, LoginInput, ForgotPasswordInput
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", status_code=201)
def register(body: RegisterInput):
    try:
        result = anon_client().auth.sign_up({"email": body.email, "password": body.password, "options": {"data": {"full_name": body.full_name, "requested_role": body.role}}})
        user = result.user
        if not user:
            raise api_error(400, "We could not create your account.", "REGISTER_FAILED")
        # Upsert deliberately uses auth.users.id, making retry/repair idempotent.
        admin_client().table("profiles").upsert({"id": user.id, "email": body.email, "full_name": body.full_name, "role": body.role}, on_conflict="id").execute()
        return {"success": True, "message": "Account created. Check your email if confirmation is enabled.", "session": result.session, "user": {"id": user.id, "email": user.email}}
    except Exception as exc:
        if getattr(exc, "status", None) == 422 or "already" in str(exc).lower():
            raise api_error(409, "An account with this email already exists.", "EMAIL_EXISTS")
        if isinstance(exc, Exception) and getattr(exc, "status_code", None):
            raise exc
        raise api_error(400, "Unable to create your account. Please check your details and try again.", "REGISTER_FAILED")

@router.post("/login")
def login(body: LoginInput):
    try:
        result = anon_client().auth.sign_in_with_password({"email": body.email, "password": body.password})
        if not result.session or not result.user:
            raise api_error(401, "Invalid email or password.", "INVALID_CREDENTIALS")
        profile = admin_client().table("profiles").select("*").eq("id", result.user.id).maybe_single().execute().data
        if not profile:
            profile = admin_client().table("profiles").upsert({"id": result.user.id, "email": result.user.email, "full_name": result.user.user_metadata.get("full_name", ""), "role": result.user.user_metadata.get("requested_role", "candidate")}, on_conflict="id").execute().data[0]
        return {"success": True, "session": result.session, "profile": profile}
    except Exception as exc:
        if getattr(exc, "status_code", None): raise exc
        raise api_error(401, "Invalid email or password.", "INVALID_CREDENTIALS")

@router.post("/logout")
def logout(user: dict = Depends(get_current_user)):
    try: anon_client().auth.sign_out()
    except Exception: pass
    return {"success": True, "message": "Signed out."}

@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return {"success": True, "user": {"id": user["id"], "email": user["email"]}, "profile": user["profile"]}

@router.post("/refresh")
def refresh():
    return {"success": False, "message": "Refresh tokens are handled securely by the Supabase browser client.", "code": "USE_SUPABASE_CLIENT"}

@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordInput):
    try:
        anon_client().auth.reset_password_email(body.email, {"redirect_to": f"{get_settings().frontend_url}/auth"})
    except Exception: pass
    return {"success": True, "message": "If an account exists, password reset instructions have been sent."}
