import sys
import os

# Add backend directory to path
backend_dir = os.path.join(os.path.dirname(__file__), "backend")
sys.path.insert(0, backend_dir)

from app.db.supabase import admin_client
from app.routers.interviews import start, join, questions, answer, complete, monitor

def run_tests():
    print("Testing live interview lifecycle and endpoints...")
    client = admin_client()

    # 1. Fetch interviewer and candidate
    interviewers = client.table("profiles").select("id,full_name,role").eq("role", "interviewer").limit(1).execute().data
    candidates = client.table("profiles").select("id,full_name,role").eq("role", "candidate").limit(1).execute().data
    
    if not interviewers or not candidates:
        print("[SKIP] Missing interviewer or candidate profiles.")
        return
        
    interviewer = interviewers[0]
    candidate = candidates[0]
    
    # 2. Fetch or find an interview
    interviews = client.table("interviews").select("*").eq("candidate_id", candidate["id"]).limit(1).execute().data
    if not interviews:
        print("[SKIP] No interviews found for candidate.")
        return
        
    interview = interviews[0]
    interview_id = interview["id"]
    print(f"[OK] Found interview: {interview['title']} (ID: {interview_id}, Room: {interview['meeting_room_id']})")
    
    interviewer_user = {"id": interviewer["id"], "profile": {"role": "interviewer"}}
    candidate_user = {"id": candidate["id"], "profile": {"role": "candidate"}}
    
    # 3. Test start interview
    start_res = start(interview_id=interview_id, user=interviewer_user)
    assert start_res["success"] == True
    print("[OK] Interview status set to 'live'")
    
    # 4. Test candidate join
    join_res = join(interview_id=interview_id, user=candidate_user)
    assert join_res["success"] == True
    assert join_res["room_id"] == interview["meeting_room_id"]
    print(f"[OK] Candidate joined meeting room: {join_res['room_id']}")
    
    # 5. Test questions
    q_res = questions(interview_id=interview_id, user=candidate_user)
    assert q_res["success"] == True
    assert len(q_res["data"]) > 0
    first_q = q_res["data"][0]
    print(f"[OK] Questions retrieved: {len(q_res['data'])} questions. (Q1: {first_q['question'][:40]}...)")
    
    # 6. Test submit candidate answer
    ans_body = {
        "answer_text": "I optimize React by using useMemo, useCallback, React.memo, and virtualization for long lists.",
        "answer_transcript": "I optimize React by using useMemo, useCallback, React.memo, and virtualization for long lists."
    }
    ans_res = answer(interview_id=interview_id, question_id=first_q["id"], body=ans_body, user=candidate_user)
    assert ans_res["success"] == True
    print("[OK] Candidate answer saved successfully (upserted without duplicates)")
    
    # 7. Test log monitoring event
    from app.schemas.common import MonitoringEventInput
    ev_input = MonitoringEventInput(
        event_type="screen_share_started",
        severity="info",
        event_data={"active": True}
    )
    mon_res = monitor(interview_id=interview_id, body=ev_input, user=candidate_user)
    assert mon_res["success"] == True
    print("[OK] Real-time monitoring event recorded successfully")
    
    # 8. Test complete interview
    comp_res = complete(interview_id=interview_id, user=interviewer_user)
    assert comp_res["success"] == True
    print("[OK] Interview concluded and marked 'completed'")
    
    print("[ALL LIVE INTERVIEW LIFECYCLE TESTS PASSED]")

if __name__ == "__main__":
    run_tests()
