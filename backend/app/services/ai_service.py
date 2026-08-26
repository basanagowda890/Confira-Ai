from app.config import get_settings
from app.core.errors import api_error


def analyze(payload: dict) -> dict:
    # Provider seam: add an approved LLM call here. Never silently fabricate scores.
    if not get_settings().openai_api_key:
        raise api_error(503, "AI analysis is not configured. Set OPENAI_API_KEY on the backend.", "AI_NOT_CONFIGURED")
    return {"message": "AI provider integration is configured but no provider adapter has been enabled.", "decision_support_notice": "AI output is decision support only and must be reviewed by a human."}
