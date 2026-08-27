from functools import lru_cache
from typing import Any
from app.config import get_settings


@lru_cache
def _create_client() -> Any:
    try:
        from supabase import create_client
        return create_client
    except ImportError as exc:
        raise RuntimeError("Supabase client is not installed. Run: pip install -r requirements.txt") from exc


def anon_client() -> Any:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError("Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.")
    return _create_client()(settings.supabase_url, settings.supabase_anon_key)


@lru_cache
def admin_client() -> Any:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase service access is not configured.")
    return _create_client()(settings.supabase_url, settings.supabase_service_role_key)


def fetch_maybe_single(query: Any) -> Any:
    res = query.maybe_single().execute()
    return res.data if res is not None else None

