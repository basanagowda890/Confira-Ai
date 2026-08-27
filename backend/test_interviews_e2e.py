import sys
import os

# Add backend directory to path
backend_dir = os.path.join(os.path.dirname(__file__), "backend")
sys.path.insert(0, backend_dir)

from app.db.supabase import admin_client
from app.routers.interviews import list_interviews

def run_tests():
    print("Testing interviews list query with joins...")
    client = admin_client()
    
    # 1. Fetch a candidate profile
    candidates = client.table("profiles").select("id,full_name,role").eq("role", "candidate").limit(1).execute().data
    if not candidates:
        print("[SKIP] No candidate profiles found in database.")
        return
    
    candidate = candidates[0]
    print(f"[OK] Found candidate: {candidate['full_name']} ({candidate['id']})")
    
    user_dict = {
        "id": candidate["id"],
        "profile": {"role": "candidate"}
    }
    
    res = list_interviews(user=user_dict)
    assert res["success"] == True
    print(f"[OK] Candidate interviews list retrieved successfully: {len(res['data'])} records found.")
    
    if res["data"]:
        sample = res["data"][0]
        print(f"  - Title: {sample.get('title')}")
        print(f"  - Status: {sample.get('status')}")
        print(f"  - Job: {sample.get('jobs')}")
        print(f"  - Interviewer: {sample.get('interviewer')}")
        print(f"  - Results: {sample.get('interview_results')}")
    
    print("[ALL CHECKS PASSED]")

if __name__ == "__main__":
    run_tests()
