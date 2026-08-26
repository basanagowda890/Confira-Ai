from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.routers import health, auth, profiles, jobs, interviews, uploads, notifications, dashboard, ai, features

settings = get_settings()
app = FastAPI(title="Confira API", version="1.0.0", docs_url="/docs", redoc_url="/redoc")
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_url], allow_credentials=True, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])

@app.exception_handler(Exception)
async def unhandled_error(_: Request, __: Exception):
    return JSONResponse(status_code=500, content={"success": False, "message": "An unexpected server error occurred.", "code": "INTERNAL_ERROR"})

for router in (health.router, auth.router, profiles.router, jobs.router, interviews.router, uploads.router, notifications.router, dashboard.router, ai.router, features.router):
    app.include_router(router, prefix="/api")
