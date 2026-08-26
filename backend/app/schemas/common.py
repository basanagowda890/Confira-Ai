from pydantic import BaseModel, Field
from typing import Any, Literal
from datetime import datetime

Role = Literal["candidate", "interviewer"]

class RegisterInput(BaseModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=120)
    role: Role

class LoginInput(BaseModel):
    email: str
    password: str

class ForgotPasswordInput(BaseModel):
    email: str

class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    phone: str | None = None
    location: str | None = None
    headline: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=3000)
    skills: list[str] | None = None
    education: list[dict[str, Any]] | None = None
    experience: list[dict[str, Any]] | None = None
    company: str | None = None
    company_description: str | None = None

class JobInput(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: str = ""
    department: str | None = None
    location: str | None = None
    employment_type: str = "full_time"
    experience_level: str | None = None
    required_skills: list[str] = []
    preferred_skills: list[str] = []
    salary_range: str | None = None
    status: Literal["draft", "published", "closed"] = "draft"

class ApplicationStatusInput(BaseModel):
    status: Literal["applied", "screening", "shortlisted", "interview", "selected", "rejected", "withdrawn"]

class InterviewInput(BaseModel):
    job_id: str
    candidate_id: str
    title: str
    type: str = "technical"
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=10, le=480)
    instructions: str | None = None

class InterviewUpdate(BaseModel):
    title: str | None = None
    type: str | None = None
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=10, le=480)
    status: Literal["scheduled", "live", "completed", "cancelled"] | None = None
    instructions: str | None = None

class QuestionInput(BaseModel):
    question: str = Field(min_length=2)
    question_type: str = "custom"
    difficulty: str = "medium"
    expected_answer: str | None = None
    points: int = Field(default=1, ge=0)
    order_index: int = Field(default=0, ge=0)

class MonitoringEventInput(BaseModel):
    event_type: str
    severity: str = "info"
    event_data: dict[str, Any] = {}

class AIRequest(BaseModel):
    interview_id: str | None = None
    question: str | None = None
    answer: str | None = None
    candidate_id: str | None = None
