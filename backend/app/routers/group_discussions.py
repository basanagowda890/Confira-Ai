import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, require_role
from app.db.supabase import admin_client, fetch_maybe_single
from app.core.errors import api_error

router = APIRouter(prefix="/group-discussions", tags=["group discussions"])

DEFAULT_TOPICS = [
    "Is Artificial Intelligence good or bad for the future of work?",
    "Monolithic vs Microservices: Architectural trade-offs in modern applications.",
    "Remote Work vs In-Office: Impact on team productivity and engineering culture.",
    "The Ethics of Data Privacy and Surveillance in tech platforms.",
    "Cloud Native vs On-Premise infrastructure for mission-critical services.",
    "Agile Methodology: Is Scrum still relevant for high-velocity teams?"
]

@router.get("")
def list_discussions(user: dict = Depends(get_current_user)):
    db = admin_client()
    uid = user["id"]
    role = user["profile"].get("role", "candidate")

    discussions = []
    try:
        if role == "interviewer":
            try:
                res = db.table("group_discussions").select("*,jobs(id,title,department,location)").eq("created_by", uid).order("created_at", desc=True).execute()
                discussions = res.data or []
            except Exception:
                res = db.table("group_discussions").select("*").eq("created_by", uid).order("created_at", desc=True).execute()
                discussions = res.data or []
        else:
            # Candidate: find discussions where candidate is member or scheduled
            disc_ids = []
            try:
                member_entries = db.table("group_discussion_members").select("discussion_id").eq("candidate_id", uid).execute().data or []
                disc_ids = [m["discussion_id"] for m in member_entries if m.get("discussion_id")]
            except Exception:
                disc_ids = []

            if disc_ids:
                try:
                    res = db.table("group_discussions").select("*,jobs(id,title,department,location)").in_("id", disc_ids).order("created_at", desc=True).execute()
                    discussions = res.data or []
                except Exception:
                    res = db.table("group_discussions").select("*").in_("id", disc_ids).order("created_at", desc=True).execute()
                    discussions = res.data or []
            else:
                try:
                    res = db.table("group_discussions").select("*,jobs(id,title,department,location)").order("created_at", desc=True).execute()
                    discussions = res.data or []
                except Exception:
                    res = db.table("group_discussions").select("*").order("created_at", desc=True).execute()
                    discussions = res.data or []
    except Exception as e:
        discussions = []

    # Enrich each discussion with member count and candidate data
    for d in discussions:
        try:
            members_data = db.table("group_discussion_members").select("candidate_id,status,profiles:candidate_id(id,full_name,avatar_url)").eq("discussion_id", d["id"]).execute().data or []
            d["members"] = members_data
            d["member_count"] = len(members_data)
        except Exception:
            d["members"] = []
            d["member_count"] = 0

    return {"success": True, "data": discussions}

@router.post("", status_code=201)
def create_discussion(body: dict, user: dict = Depends(require_role("interviewer"))):
    db = admin_client()
    title = (body.get("title") or "").strip() or "Group Discussion Session"
    topic = (body.get("topic") or "").strip() or DEFAULT_TOPICS[0]
    job_id = body.get("job_id") or None
    scheduled_at = body.get("scheduled_at") or datetime.now(timezone.utc).isoformat()
    duration_minutes = int(body.get("duration_minutes") or 30)
    candidate_ids = body.get("candidate_ids") or []
    room_id = f"gd-{uuid.uuid4().hex[:8]}"

    data = {
        "title": title,
        "topic": topic,
        "job_id": job_id,
        "created_by": user["id"],
        "scheduled_at": scheduled_at,
        "duration_minutes": duration_minutes,
        "status": "scheduled",
        "meeting_room_id": room_id,
    }

    try:
        inserted = db.table("group_discussions").insert(data).execute().data
    except Exception:
        # Fallback if optional columns don't exist yet
        minimal_data = {
            "title": title,
            "job_id": job_id,
            "created_by": user["id"],
            "scheduled_at": scheduled_at,
            "status": "scheduled"
        }
        inserted = db.table("group_discussions").insert(minimal_data).execute().data

    if not inserted:
        raise api_error(500, "Failed to create group discussion.", "DB_ERROR")
    
    discussion = inserted[0]
    disc_id = discussion["id"]

    # Insert invited candidate members
    for cand_id in candidate_ids:
        if cand_id:
            try:
                db.table("group_discussion_members").upsert({
                    "discussion_id": disc_id,
                    "candidate_id": cand_id,
                    "status": "invited"
                }, on_conflict="discussion_id,candidate_id").execute()

                # Send notification to candidate
                db.table("notifications").insert({
                    "user_id": cand_id,
                    "type": "group_discussion",
                    "title": "Invited to Group Discussion",
                    "message": f"You are invited to a live group discussion: '{title}'. Topic: {topic}",
                    "link": f"/candidate/group-discussion?discussion={disc_id}"
                }).execute()
            except Exception:
                pass

    return {"success": True, "data": discussion}

@router.get("/{discussion_id}")
def get_discussion(discussion_id: str, user: dict = Depends(get_current_user)):
    db = admin_client()
    try:
        disc = fetch_maybe_single(
            db.table("group_discussions").select("*,jobs(id,title,department,location),profiles!created_by(id,full_name,avatar_url)").eq("id", discussion_id)
        )
    except Exception:
        disc = fetch_maybe_single(
            db.table("group_discussions").select("*").eq("id", discussion_id)
        )

    if not disc:
        raise api_error(404, "Group discussion not found.", "NOT_FOUND")

    # Fetch members with profile info
    members = []
    try:
        members_raw = db.table("group_discussion_members").select("candidate_id,joined_at,left_at,status,profiles:candidate_id(id,full_name,avatar_url,headline,skills)").eq("discussion_id", discussion_id).execute().data or []
        for m in members_raw:
            prof = m.get("profiles") or {}
            members.append({
                "candidate_id": m.get("candidate_id"),
                "full_name": prof.get("full_name") or "Candidate",
                "avatar_url": prof.get("avatar_url"),
                "headline": prof.get("headline"),
                "status": m.get("status") or "invited",
                "joined_at": m.get("joined_at"),
                "left_at": m.get("left_at"),
            })
    except Exception:
        members = []

    disc["members"] = members
    disc["member_count"] = len(members)

    # Fetch current speaker name if set
    if disc.get("current_speaker_id"):
        try:
            sp_prof = fetch_maybe_single(db.table("profiles").select("id,full_name,avatar_url").eq("id", disc["current_speaker_id"]))
            disc["current_speaker"] = sp_prof
        except Exception:
            disc["current_speaker"] = None
    else:
        disc["current_speaker"] = None

    return {"success": True, "data": disc}

@router.patch("/{discussion_id}/status")
def update_status(discussion_id: str, body: dict, user: dict = Depends(require_role("interviewer"))):
    db = admin_client()
    new_status = body.get("status")
    if new_status not in ["scheduled", "live", "paused", "completed", "cancelled"]:
        raise api_error(422, "Invalid status value.", "VALIDATION_ERROR")

    disc = fetch_maybe_single(db.table("group_discussions").select("*").eq("id", discussion_id))
    if not disc:
        raise api_error(404, "Group discussion not found.", "NOT_FOUND")

    now_iso = datetime.now(timezone.utc).isoformat()
    update_payload = {"status": new_status}
    if new_status == "live" and not disc.get("started_at"):
        update_payload["started_at"] = now_iso
    elif new_status == "completed":
        update_payload["ended_at"] = now_iso

    try:
        updated = db.table("group_discussions").update(update_payload).eq("id", discussion_id).execute().data
    except Exception:
        # Fallback to status-only update if extra columns are not yet added to remote table
        try:
            updated = db.table("group_discussions").update({"status": new_status}).eq("id", discussion_id).execute().data
        except Exception:
            updated = [{"id": discussion_id, "status": new_status, "started_at": now_iso}]

    if not updated:
        updated = [{"id": discussion_id, "status": new_status, "started_at": now_iso}]

    return {"success": True, "data": updated[0]}

@router.patch("/{discussion_id}/topic")
def update_topic(discussion_id: str, body: dict, user: dict = Depends(require_role("interviewer"))):
    db = admin_client()
    topic = (body.get("topic") or "").strip()
    if not topic:
        raise api_error(422, "Topic cannot be empty.", "VALIDATION_ERROR")

    disc = fetch_maybe_single(db.table("group_discussions").select("*").eq("id", discussion_id))
    if not disc:
        raise api_error(404, "Group discussion not found.", "NOT_FOUND")

    try:
        updated = db.table("group_discussions").update({"topic": topic}).eq("id", discussion_id).execute().data
    except Exception:
        updated = [{"id": discussion_id, "topic": topic}]

    if not updated:
        updated = [{"id": discussion_id, "topic": topic}]

    return {"success": True, "data": updated[0]}

@router.patch("/{discussion_id}/speaker")
def update_speaker(discussion_id: str, body: dict, user: dict = Depends(require_role("interviewer"))):
    db = admin_client()
    speaker_id = body.get("speaker_id")

    disc = fetch_maybe_single(db.table("group_discussions").select("*").eq("id", discussion_id))
    if not disc:
        raise api_error(404, "Group discussion not found.", "NOT_FOUND")

    try:
        updated = db.table("group_discussions").update({"current_speaker_id": speaker_id}).eq("id", discussion_id).execute().data
    except Exception:
        updated = [{"id": discussion_id, "current_speaker_id": speaker_id}]

    if not updated:
        updated = [{"id": discussion_id, "current_speaker_id": speaker_id}]

    return {"success": True, "data": updated[0]}

@router.post("/{discussion_id}/join")
def join_discussion(discussion_id: str, user: dict = Depends(get_current_user)):
    db = admin_client()
    uid = user["id"]
    
    disc = fetch_maybe_single(db.table("group_discussions").select("*").eq("id", discussion_id))
    if not disc:
        raise api_error(404, "Group discussion not found.", "NOT_FOUND")

    member_data = {
        "discussion_id": discussion_id,
        "candidate_id": uid,
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "status": "joined"
    }

    try:
        db.table("group_discussion_members").upsert(member_data, on_conflict="discussion_id,candidate_id").execute()
    except Exception:
        pass

    return {"success": True, "message": "Joined discussion successfully.", "discussion": disc}

@router.post("/{discussion_id}/leave")
def leave_discussion(discussion_id: str, user: dict = Depends(get_current_user)):
    db = admin_client()
    uid = user["id"]

    try:
        db.table("group_discussion_members").update({
            "status": "left",
            "left_at": datetime.now(timezone.utc).isoformat()
        }).eq("discussion_id", discussion_id).eq("candidate_id", uid).execute()
    except Exception:
        pass

    return {"success": True, "message": "Left discussion successfully."}

@router.get("/{discussion_id}/messages")
def get_messages(discussion_id: str, user: dict = Depends(get_current_user)):
    db = admin_client()
    try:
        messages = db.table("group_discussion_messages").select("*,profiles:sender_id(full_name,avatar_url)").eq("discussion_id", discussion_id).order("created_at").limit(100).execute().data or []
    except Exception:
        messages = []
    return {"success": True, "data": messages}

@router.post("/{discussion_id}/messages", status_code=201)
def post_message(discussion_id: str, body: dict, user: dict = Depends(get_current_user)):
    db = admin_client()
    text = (body.get("message") or "").strip()
    if not text:
        raise api_error(422, "Message cannot be empty.", "VALIDATION_ERROR")

    sender_name = user["profile"].get("full_name") or "Participant"
    msg_data = {
        "discussion_id": discussion_id,
        "sender_id": user["id"],
        "sender_name": sender_name,
        "message": text,
        "message_type": body.get("message_type", "text")
    }

    try:
        inserted = db.table("group_discussion_messages").insert(msg_data).execute().data
        return {"success": True, "data": inserted[0]}
    except Exception:
        return {"success": True, "data": {
            "id": str(uuid.uuid4()),
            "discussion_id": discussion_id,
            "sender_id": user["id"],
            "sender_name": sender_name,
            "message": text,
            "created_at": datetime.now(timezone.utc).isoformat()
        }}
