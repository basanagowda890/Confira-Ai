from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, require_role
from app.db.supabase import admin_client, fetch_maybe_single
from app.core.errors import api_error

router = APIRouter(tags=["practice tests", "reports", "group discussions", "results"])

DEFAULT_PRACTICE_TESTS = [
    {
        "title": "React Fundamentals",
        "description": "20 questions on React component lifecycle, hooks, state management, and performance optimization.",
        "duration_minutes": 25,
        "is_published": True,
        "questions": [
            {
                "id": "q1",
                "question": "What is the primary purpose of React hooks such as useEffect and useState?",
                "options": [
                    "To use state and lifecycle features without writing class components",
                    "To compile JSX into HTML directly in Node",
                    "To manage relational databases in the browser",
                    "To handle DNS resolution in the network tab",
                ],
                "correct_answer": "To use state and lifecycle features without writing class components",
                "points": 20,
            },
            {
                "id": "q2",
                "question": "Which React API prevents unnecessary re-renders of a functional component when props do not change?",
                "options": ["React.memo", "React.useState", "React.forwardRef", "React.Fragment"],
                "correct_answer": "React.memo",
                "points": 20,
            },
            {
                "id": "q3",
                "question": "What happens when you update state in React using a state setter function?",
                "options": [
                    "React schedules a re-render of the component",
                    "The entire browser webpage reloads",
                    "The component unmounts permanently",
                    "The DOM is synchronously overwritten without diffing",
                ],
                "correct_answer": "React schedules a re-render of the component",
                "points": 20,
            },
            {
                "id": "q4",
                "question": "Why should keys be unique among sibling elements when rendering lists in React?",
                "options": [
                    "To help React identify which items have changed, been added, or been removed",
                    "To apply unique CSS styles to each list element",
                    "To encrypt the data in the browser memory",
                    "To guarantee alphabetical sorting of items",
                ],
                "correct_answer": "To help React identify which items have changed, been added, or been removed",
                "points": 20,
            },
            {
                "id": "q5",
                "question": "How does React Context help solve the problem of prop drilling?",
                "options": [
                    "It provides a way to share values deep in the component tree without passing props manually at every level",
                    "It replaces the virtual DOM with a direct canvas renderer",
                    "It automatically caches all fetch requests in IndexedDB",
                    "It eliminates the need for JavaScript in production builds",
                ],
                "correct_answer": "It provides a way to share values deep in the component tree without passing props manually at every level",
                "points": 20,
            },
        ],
    },
    {
        "title": "JavaScript Core & Problem Solving",
        "description": "25 questions on closures, async/await, event loop, and data structures.",
        "duration_minutes": 30,
        "is_published": True,
        "questions": [
            {
                "id": "q1",
                "question": "What is the return value of `typeof null` in JavaScript?",
                "options": ["'object'", "'null'", "'undefined'", "'boolean'"],
                "correct_answer": "'object'",
                "points": 20,
            },
            {
                "id": "q2",
                "question": "What is a closure in JavaScript?",
                "options": [
                    "A function bundled together with references to its surrounding lexical environment",
                    "A browser API for closing active popup windows",
                    "A try/catch statement used for closing database connections",
                    "An immutable object declared with Object.freeze()",
                ],
                "correct_answer": "A function bundled together with references to its surrounding lexical environment",
                "points": 20,
            },
            {
                "id": "q3",
                "question": "Which operator performs strict equality comparison without type coercion?",
                "options": ["===", "==", "=", "!=="],
                "correct_answer": "===",
                "points": 20,
            },
            {
                "id": "q4",
                "question": "What happens when one Promise in `Promise.all([p1, p2, p3])` rejects?",
                "options": [
                    "The returned promise immediately rejects with that error",
                    "It ignores the error and waits for the remaining promises to resolve",
                    "It retries the rejected promise automatically up to 3 times",
                    "It returns null for the rejected item in the result array",
                ],
                "correct_answer": "The returned promise immediately rejects with that error",
                "points": 20,
            },
            {
                "id": "q5",
                "question": "Which data structure follows the Last-In, First-Out (LIFO) principle?",
                "options": ["Stack", "Queue", "Linked List", "Binary Search Tree"],
                "correct_answer": "Stack",
                "points": 20,
            },
        ],
    },
    {
        "title": "SQL & Relational Databases",
        "description": "20 questions on joins, indexing, transactions, and aggregate queries.",
        "duration_minutes": 20,
        "is_published": True,
        "questions": [
            {
                "id": "q1",
                "question": "Which SQL clause is used to filter groups created by the GROUP BY statement?",
                "options": ["HAVING", "WHERE", "ORDER BY", "FILTER"],
                "correct_answer": "HAVING",
                "points": 25,
            },
            {
                "id": "q2",
                "question": "What records does an INNER JOIN between Table A and Table B return?",
                "options": [
                    "Only records that have matching keys in both Table A and Table B",
                    "All records from Table A and only matched records from Table B",
                    "All records from both tables regardless of match",
                    "Only records where the join key is NULL in both tables",
                ],
                "correct_answer": "Only records that have matching keys in both Table A and Table B",
                "points": 25,
            },
            {
                "id": "q3",
                "question": "In database ACID properties, what does Atomicity guarantee?",
                "options": [
                    "All operations in a transaction succeed, or the entire transaction is rolled back",
                    "Transactions execute concurrently without interference",
                    "Data remains intact even during hardware power failures",
                    "Database constraints are verified periodically in the background",
                ],
                "correct_answer": "All operations in a transaction succeed, or the entire transaction is rolled back",
                "points": 25,
            },
            {
                "id": "q4",
                "question": "Which index data structure is the default and most versatile for B-tree range queries in PostgreSQL?",
                "options": ["B-Tree", "Hash index", "GIN index", "BRIN index"],
                "correct_answer": "B-Tree",
                "points": 25,
            },
        ],
    },
    {
        "title": "Technical Communication & Behavioral",
        "description": "15 questions on the STAR framework, stakeholder communication, and engineering trade-offs.",
        "duration_minutes": 15,
        "is_published": True,
        "questions": [
            {
                "id": "q1",
                "question": "What does the STAR framework stand for in behavioral interviews?",
                "options": [
                    "Situation, Task, Action, Result",
                    "Strategy, Theory, Analysis, Review",
                    "Structure, Tone, Answer, Reaction",
                    "System, Target, Approach, Report",
                ],
                "correct_answer": "Situation, Task, Action, Result",
                "points": 34,
            },
            {
                "id": "q2",
                "question": "When presenting technical architecture to product and business stakeholders, what is most effective?",
                "options": [
                    "Focus on business impact, trade-offs, reliability, and timelines rather than implementation minutiae",
                    "Use maximum technical jargon and memory offsets to prove expertise",
                    "Instruct stakeholders to inspect the pull requests themselves",
                    "Avoid discussing architecture entirely",
                ],
                "correct_answer": "Focus on business impact, trade-offs, reliability, and timelines rather than implementation minutiae",
                "points": 33,
            },
            {
                "id": "q3",
                "question": "How should engineers handle technical disagreements during architecture reviews?",
                "options": [
                    "Gather concrete metrics, benchmark performance, evaluate maintainability, and align on project goals",
                    "Escalate immediately to the CEO for a decision",
                    "Refuse to write code until the other engineer concedes",
                    "Silently alter the merged code without discussion",
                ],
                "correct_answer": "Gather concrete metrics, benchmark performance, evaluate maintainability, and align on project goals",
                "points": 33,
            },
        ],
    },
]

def ensure_seed_tests():
    try:
        existing = admin_client().table("practice_tests").select("id").limit(1).execute().data
        if not existing:
            for test in DEFAULT_PRACTICE_TESTS:
                admin_client().table("practice_tests").insert(test).execute()
    except Exception:
        pass

@router.get("/practice-tests")
def practice_tests(user: dict = Depends(get_current_user)):
    ensure_seed_tests()
    return {"success": True, "data": admin_client().table("practice_tests").select("id,title,description,duration_minutes,questions").eq("is_published", True).order("created_at").execute().data}

@router.get("/practice-tests/attempts")
def attempts(user: dict = Depends(get_current_user)):
    return {"success": True, "data": admin_client().table("practice_test_attempts").select("*,practice_tests(title,duration_minutes)").eq("candidate_id", user["id"]).order("started_at", desc=True).execute().data}

@router.get("/practice-tests/{test_id}")
def practice_test(test_id: str, user: dict = Depends(get_current_user)):
    ensure_seed_tests()
    data = fetch_maybe_single(admin_client().table("practice_tests").select("*").eq("id", test_id).eq("is_published", True))
    if not data: raise api_error(404, "Practice test not found.", "TEST_NOT_FOUND")
    return {"success": True, "data": data}

@router.post("/practice-tests/{test_id}/start", status_code=201)
def start_test(test_id: str, user: dict = Depends(get_current_user)):
    ensure_seed_tests()
    test = fetch_maybe_single(admin_client().table("practice_tests").select("id").eq("id", test_id))
    if not test:
        raise api_error(404, "Practice test not found.", "TEST_NOT_FOUND")
    attempt = admin_client().table("practice_test_attempts").insert({"test_id": test_id, "candidate_id": user["id"], "answers": []}).execute().data[0]
    return {"success": True, "data": attempt}

@router.post("/practice-tests/{test_id}/submit")
def submit_test(test_id: str, body: dict, user: dict = Depends(get_current_user)):
    attempt_id = body.get("attempt_id")
    if not attempt_id: raise api_error(422, "attempt_id is required.", "VALIDATION_ERROR")
    answers = body.get("answers", [])

    test = fetch_maybe_single(admin_client().table("practice_tests").select("*").eq("id", test_id))
    if not test:
        raise api_error(404, "Practice test not found.", "TEST_NOT_FOUND")

    questions = test.get("questions", [])
    total_score = 0
    max_score = 0

    answer_map = {}
    for a in answers:
        if isinstance(a, dict) and "question_id" in a:
            answer_map[a["question_id"]] = a.get("selected_answer", "")

    for q in questions:
        q_id = q.get("id")
        q_points = q.get("points", 1)
        max_score += q_points
        correct = q.get("correct_answer", "").strip()
        user_ans = str(answer_map.get(q_id, "")).strip()
        if correct and user_ans and correct.lower() == user_ans.lower():
            total_score += q_points

    score_percentage = round((total_score / max_score) * 100, 1) if max_score > 0 else 100

    data = admin_client().table("practice_test_attempts").update({
        "answers": answers,
        "score": score_percentage,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", attempt_id).eq("test_id", test_id).eq("candidate_id", user["id"]).execute().data

    if not data: raise api_error(404, "Practice attempt not found.", "ATTEMPT_NOT_FOUND")
    return {"success": True, "data": data[0], "score": score_percentage}


@router.get("/reports/{interview_id}")
def get_report(interview_id: str, user: dict = Depends(require_role("interviewer"))):
    data = fetch_maybe_single(admin_client().table("reports").select("*").eq("interview_id", interview_id).eq("owner_id", user["id"]))
    if not data: raise api_error(404, "Report not found.", "REPORT_NOT_FOUND")
    return {"success": True, "data": data}

@router.get("/results/{interview_id}")
def get_result(interview_id: str, user: dict = Depends(get_current_user)):
    interview = fetch_maybe_single(admin_client().table("interviews").select("candidate_id,interviewer_id").eq("id", interview_id))
    if not interview or user["id"] not in {interview["candidate_id"], interview["interviewer_id"]}: raise api_error(404, "Interview result not found.", "RESULT_NOT_FOUND")
    data = fetch_maybe_single(admin_client().table("interview_results").select("*").eq("interview_id", interview_id))
    if not data: raise api_error(404, "Interview result not found.", "RESULT_NOT_FOUND")
    return {"success": True, "data": data}

@router.post("/reports/{interview_id}/generate")
def report(interview_id: str, user: dict = Depends(require_role("interviewer"))):
    interview = fetch_maybe_single(admin_client().table("interviews").select("*").eq("id", interview_id).eq("interviewer_id", user["id"]))
    if not interview: raise api_error(404, "Interview not found.", "INTERVIEW_NOT_FOUND")
    result = fetch_maybe_single(admin_client().table("interview_results").select("*").eq("interview_id", interview_id))
    events = admin_client().table("monitoring_events").select("event_type,severity,timestamp").eq("interview_id", interview_id).execute().data
    content = {"interview": interview, "scores": result or {}, "monitoring_summary": events, "notice": "AI and score outputs are decision-support signals requiring human review."}
    data = admin_client().table("reports").upsert({"interview_id": interview_id, "owner_id": user["id"], "content": content}, on_conflict="interview_id").execute().data[0]
    return {"success": True, "data": data}
