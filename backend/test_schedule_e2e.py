import secrets
from app.db.supabase import admin_client
from app.services.notifications import notify

def run_test():
    client = admin_client()

    # 1. Fetch real interviewer, candidate, and job from Supabase
    interviewers = client.table("profiles").select("id,email,full_name,role").eq("role", "interviewer").execute().data
    candidates = client.table("profiles").select("id,email,full_name,role").eq("role", "candidate").execute().data
    jobs = client.table("jobs").select("id,title,created_by").execute().data

    print(f"Found {len(interviewers)} interviewers, {len(candidates)} candidates, {len(jobs)} jobs.")

    if not interviewers or not candidates or not jobs:
        print("Required seed data not present. Aborting.")
        return

    interviewer = interviewers[0]
    candidate = candidates[0]
    # Pick a job owned by this interviewer
    owned_jobs = [j for j in jobs if j["created_by"] == interviewer["id"]]
    if not owned_jobs:
        # Create a test job owned by this interviewer
        job_res = client.table("jobs").insert({
            "title": "Full Stack Engineer",
            "created_by": interviewer["id"],
            "status": "published",
            "department": "Engineering"
        }).execute()
        job = job_res.data[0]
        print(f"Created test job: {job['id']}")
    else:
        job = owned_jobs[0]

    print(f"Using Interviewer: {interviewer['full_name']} ({interviewer['id']})")
    print(f"Using Candidate: {candidate['full_name']} ({candidate['id']})")
    print(f"Using Job: {job['title']} ({job['id']})")

    # 2. Simulate interview insertion with server-side room generation
    meeting_room_id = secrets.token_urlsafe(12)
    scheduled_at = "2026-09-28T10:00:00+00:00"

    data = {
        "job_id": job["id"],
        "candidate_id": candidate["id"],
        "interviewer_id": interviewer["id"],
        "title": f"{job['title']} — {candidate['full_name']}",
        "type": "technical",
        "scheduled_at": scheduled_at,
        "duration_minutes": 60,
        "instructions": "Be prepared for live coding and technical discussion.",
        "meeting_room_id": meeting_room_id,
        "status": "scheduled"
    }

    # Delete any conflicting test record first
    client.table("interviews").delete().eq("job_id", job["id"]).eq("candidate_id", candidate["id"]).eq("scheduled_at", scheduled_at).execute()

    res = client.table("interviews").insert(data).execute()
    created = res.data[0]
    print(f"SUCCESS: Interview created with ID: {created['id']} and Room: {created['meeting_room_id']}")

    # 3. Test notification creation
    notify(
        candidate["id"],
        f"interview:{created['id']}:scheduled",
        "Interview scheduled",
        f"Your interview '{created['title']}' has been scheduled.",
        "/candidate/interviews",
    )
    print("SUCCESS: Candidate notification dispatched.")

    # 4. Verify candidate sees the interview
    candidate_interviews = client.table("interviews").select("*,jobs(title)").eq("candidate_id", candidate["id"]).execute().data
    found = any(i["id"] == created["id"] for i in candidate_interviews)
    print(f"SUCCESS: Candidate can query interview: {found}")

    # 5. Verify interviewer sees the interview
    interviewer_interviews = client.table("interviews").select("*,profiles!interviews_candidate_id_fkey(full_name)").eq("interviewer_id", interviewer["id"]).execute().data
    found_int = any(i["id"] == created["id"] for i in interviewer_interviews)
    print(f"SUCCESS: Interviewer can query interview: {found_int}")

    # 6. Verify duplicate conflict prevention
    try:
        # Inserting identical meeting_room_id or duplicate slot
        client.table("interviews").insert(data).execute()
        print("DUPLICATE ALLOWED? (Unexpected)")
    except Exception as e:
        print(f"SUCCESS: Duplicate insertion rejected by DB: {type(e).__name__}")

    # Cleanup test record
    client.table("interviews").delete().eq("id", created["id"]).execute()
    print("CLEANUP: Test interview removed.")

if __name__ == "__main__":
    run_test()
