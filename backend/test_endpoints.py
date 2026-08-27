import urllib.request, json

# Test 1: No auth header → expect 401
req = urllib.request.Request(
    'http://localhost:8001/api/interviews',
    data=json.dumps({
        "job_id": "test",
        "candidate_id": "test",
        "title": "Test",
        "type": "technical",
        "scheduled_at": "2026-09-28T10:00:00",
        "duration_minutes": 60
    }).encode(),
    headers={'Content-Type': 'application/json'}
)
req.get_method = lambda: 'POST'
try:
    r = urllib.request.urlopen(req, timeout=5)
    print("Status:", r.status)
    print("Body:", r.read().decode())
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"Status: {e.code}")
    print(f"Body: {body}")
except Exception as e:
    print(f"Connection error: {e}")

# Test 2: Health check
req2 = urllib.request.Request('http://localhost:8001/api/health')
try:
    r2 = urllib.request.urlopen(req2, timeout=5)
    print("\nHealth:", r2.read().decode())
except Exception as e:
    print(f"Health failed: {e}")
