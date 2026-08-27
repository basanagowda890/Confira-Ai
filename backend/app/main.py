from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.routers import health, auth, profiles, jobs, interviews, uploads, notifications, dashboard, ai, features

settings = get_settings()
app = FastAPI(title="Confira API", version="1.0.0", docs_url="/docs", redoc_url="/redoc")

origins = list(set([
    settings.frontend_url,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def unhandled_error(_: Request, __: Exception):
    return JSONResponse(status_code=500, content={"success": False, "message": "An unexpected server error occurred.", "code": "INTERNAL_ERROR"})

for router in (health.router, auth.router, profiles.router, jobs.router, interviews.router, uploads.router, notifications.router, dashboard.router, ai.router, features.router):
    app.include_router(router, prefix="/api")

