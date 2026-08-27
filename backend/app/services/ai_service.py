import json
import re
import math
import httpx
from app.config import get_settings
from app.core.errors import api_error

AI_DISCLAIMER = "This analysis provides signals that may indicate AI assistance. It is not definitive proof that AI was used."

# Known phrases often found in generated responses or rigid templates
AI_TEMPLATE_PATTERNS = [
    r"\bin conclusion\b",
    r"\bit is important to note\b",
    r"\bit's worth noting\b",
    r"\bfirstly|secondly|thirdly\b",
    r"\bfurthermore|moreover|in summary\b",
    r"\bto summarize\b",
    r"\bkey takeaways?\b",
    r"\bas an ai\b",
    r"\ba comprehensive approach\b",
    r"\bplays a crucial role\b",
    r"\bin today's fast-paced\b",
    r"\bseamlessly integrate\b",
    r"\bharness the power of\b",
    r"\bdelve into\b",
    r"\ba testament to\b",
    r"\bby leveraging\b",
]

def analyze_heuristic(transcript: str, question_text: str = "") -> dict:
    text = transcript.strip()
    if not text or len(text.split()) < 5:
        return {
            "ai_assistance_score": 10,
            "classification": "low",
            "confidence": "low",
            "signals": ["Brief response with insufficient length for deep analysis"],
            "explanation": "The candidate provided a concise spoken answer without distinctive AI template signatures.",
            "disclaimer": AI_DISCLAIMER,
        }

    words = re.findall(r"\b[a-zA-Z0-9'-]+\b", text.lower())
    total_words = len(words)
    unique_words = len(set(words))
    lexical_diversity = unique_words / max(total_words, 1)

    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    sentence_count = max(len(sentences), 1)
    sentence_lengths = [len(s.split()) for s in sentences]
    avg_sentence_len = sum(sentence_lengths) / sentence_count

    # Variance of sentence length
    variance = sum((l - avg_sentence_len) ** 2 for l in sentence_lengths) / sentence_count
    std_dev = math.sqrt(variance)

    signals = []
    score = 25  # baseline low/natural spoken answer score

    # Check template phrases
    detected_phrases = []
    for pattern in AI_TEMPLATE_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            detected_phrases.extend(matches)

    if len(detected_phrases) >= 3:
        score += 35
        signals.append(f"Contains multiple formal template transitions ({', '.join(set(detected_phrases[:3]))})")
    elif len(detected_phrases) >= 1:
        score += 15
        signals.append(f"Contains formal transition phrasing ('{detected_phrases[0]}')")

    # Check highly uniform sentence lengths (robotic cadence)
    if sentence_count >= 3 and std_dev < 3.5 and avg_sentence_len > 12:
        score += 20
        signals.append("Highly uniform sentence structure and rhythm")

    # Check bullet / enumeration patterns in spoken text
    if re.search(r"\b(point 1|point 2|number 1|number 2|firstly|secondly)\b", text, re.IGNORECASE):
        score += 15
        signals.append("Rigid enumerated outline structure")

    # Check high lexical sophistication with low spoken fillers
    has_spoken_fillers = bool(re.search(r"\b(um|uh|like|you know|i mean|sort of|kind of|basically)\b", text, re.IGNORECASE))
    if not has_spoken_fillers and total_words > 40:
        score += 10
        signals.append("Unusually high formal fluency with minimal natural speech disfluencies")
    elif has_spoken_fillers:
        score = max(5, score - 15)
        signals.append("Natural conversational speech markers present")

    # Clamp score
    score = min(95, max(5, score))

    if score >= 70:
        classification = "high"
        confidence = "medium"
        explanation = "The response exhibits several formal structuring signals and boilerplate patterns commonly associated with AI-assisted answers."
    elif score >= 45:
        classification = "medium"
        confidence = "medium"
        explanation = "The answer displays moderate structural organization and formal tone that warrants casual interviewer review."
    else:
        classification = "low"
        confidence = "low"
        explanation = "The transcript reflects natural conversational phrasing and vocabulary consistent with spontaneous candidate responses."

    if not signals:
        signals.append("Natural vocabulary and spoken sentence cadence")

    return {
        "ai_assistance_score": score,
        "classification": classification,
        "confidence": confidence,
        "signals": signals,
        "explanation": explanation,
        "disclaimer": AI_DISCLAIMER,
    }


def analyze_with_openai(transcript: str, question_text: str, api_key: str) -> dict:
    prompt = f"""You are an AI-assistance linguistic analyzer for technical interviews.
Analyze the following candidate interview answer transcript and evaluate the likelihood that the candidate was using AI assistance (e.g. reading from ChatGPT) versus answering spontaneously.

Question: {question_text or "General Technical Question"}
Candidate Transcript: "{transcript}"

CRITICAL GUIDELINES:
- Do NOT claim to definitively prove AI usage.
- Look for signals like: unnatural structure in spoken speech, excessive bulleted recitation, generic textbook templates, uniform sentence lengths, lack of conversational markers.
- Return ONLY valid JSON with this exact schema:
{{
  "ai_assistance_score": <integer from 0 to 100>,
  "classification": "<low | medium | high>",
  "confidence": "<low | medium | high>",
  "signals": ["<specific signal 1>", "<specific signal 2>"],
  "explanation": "<1-2 sentence human-readable summary of observations>"
}}"""

    is_openrouter = api_key.startswith("sk-or-")
    url = "https://openrouter.ai/api/v1/chat/completions" if is_openrouter else "https://api.openai.com/v1/chat/completions"
    model = "openai/gpt-4o-mini" if is_openrouter else "gpt-4o-mini"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if is_openrouter:
        headers["HTTP-Referer"] = "http://localhost:5173"
        headers["X-Title"] = "Confira-Ai"

    try:
        response = httpx.post(
            url,
            headers=headers,
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are a professional hiring assistant that outputs strict JSON."},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
            },
            timeout=15.0,
        )
        if response.status_code == 200:
            result = json.loads(response.json()["choices"][0]["message"]["content"])
            result["disclaimer"] = AI_DISCLAIMER
            # Ensure valid classification & confidence
            if result.get("classification") not in ("low", "medium", "high"):
                score = result.get("ai_assistance_score", 0)
                result["classification"] = "high" if score >= 70 else "medium" if score >= 40 else "low"
            if result.get("confidence") not in ("low", "medium", "high"):
                result["confidence"] = "medium"
            return result
        else:
            print(f"AI API returned status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print(f"AI API call failed, falling back to heuristic analysis: {e}")

    return analyze_heuristic(transcript, question_text)


def analyze_ai_assistance(transcript: str, question_text: str = "") -> dict:
    settings = get_settings()
    if settings.openai_api_key:
        return analyze_with_openai(transcript, question_text, settings.openai_api_key)
    return analyze_heuristic(transcript, question_text)


def analyze(payload: dict) -> dict:
    # Backwards compatibility for existing general AI endpoint
    transcript = payload.get("answer") or payload.get("transcript") or ""
    question = payload.get("question") or ""
    return analyze_ai_assistance(transcript, question)

