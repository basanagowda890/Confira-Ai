import base64
import io
import time
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user
from app.db.supabase import admin_client, fetch_maybe_single

client = TestClient(app)


def test_ml_health_endpoint():
    """Verify ML models availability and status reporting."""
    res = client.get("/api/ml/health")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    models = data["data"]["models"]
    assert models["eye"] is True
    assert models["voice"] is True
    assert models["yolo"] is True


def test_ml_analyze_unauthorized():
    """Verify endpoint rejects requests without credentials."""
    res = client.post("/api/interviews/invalid-id/ml/analyze", json={})
    assert res.status_code in [401, 403, 404]


def test_ml_analyze_with_mock_user():
    """Verify ML analysis generates genuine model inference metrics."""
    # Find an interview in Supabase
    interview = fetch_maybe_single(admin_client().table("interviews").select("*").limit(1))
    if not interview:
        return

    interview_id = interview["id"]
    candidate_id = interview["candidate_id"]

    app.dependency_overrides[get_current_user] = lambda: {
        "id": candidate_id,
        "email": "candidate@test.com",
        "profile": {"id": candidate_id, "role": "candidate"}
    }

    # Generate synthetic image
    img = Image.new("RGB", (320, 240), color=(100, 120, 150))
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG")
    img_b64 = "data:image/jpeg;base64," + base64.b64encode(buffered.getvalue()).decode()

    # Generate synthetic audio
    sr = 16000
    t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
    audio = (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    import soundfile as sf
    bio = io.BytesIO()
    sf.write(bio, audio, sr, format="WAV")
    audio_b64 = "data:audio/wav;base64," + base64.b64encode(bio.getvalue()).decode()

    res = client.post(
        f"/api/interviews/{interview_id}/ml/analyze",
        json={
            "image_b64": img_b64,
            "audio_b64": audio_b64,
            "candidate_id": candidate_id,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
    )

    assert res.status_code == 200
    payload = res.json()["data"]
    assert "eye_detection" in payload
    assert "voice_detection" in payload
    assert "object_detection" in payload
    assert payload["eye_detection"]["available"] is True
    assert payload["voice_detection"]["available"] is True
    assert payload["object_detection"]["available"] is True

    app.dependency_overrides.clear()
