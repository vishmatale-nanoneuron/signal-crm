"""Signal CRM — Supabase client singleton"""
from supabase import create_client, Client
from app.config import get_settings

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        s = get_settings()
        if not s.SUPABASE_URL or not s.SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set. "
                "Create a project at supabase.com and add env vars."
            )
        _client = create_client(s.SUPABASE_URL, s.SUPABASE_SERVICE_KEY)
    return _client
