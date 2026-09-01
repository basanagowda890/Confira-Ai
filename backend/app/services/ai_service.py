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


def analyze_group_discussion_heuristic(topic: str, candidates_data: list) -> dict:
    """
    Intelligent heuristic evaluation of candidates based on their real transcripts,
    speaking turns, speaking time, and chat messages.
    """
    evaluations = {}
    total_group_words = 0
    total_group_turns = 0
    
    for cand in candidates_data:
        transcripts = cand.get("transcripts") or []
        full_text = " ".join([t.get("text", "") for t in transcripts])
        words = len(full_text.split())
        cand["_word_count"] = words
        cand["_full_text"] = full_text
        total_group_words += words
        total_group_turns += int(cand.get("speaking_turns") or len(transcripts))

    for cand in candidates_data:
        cid = cand.get("candidate_id") or cand.get("id")
        name = cand.get("name") or cand.get("full_name") or "Candidate"
        text = cand.get("_full_text", "")
        words = cand.get("_word_count", 0)
        turns = int(cand.get("speaking_turns") or len(cand.get("transcripts") or []))
        speaking_sec = int(cand.get("speaking_time_seconds") or (words * 0.4))
        
        # Word and participation proportions
        participation_ratio = (words / max(total_group_words, 1)) if total_group_words > 0 else 0.5
        turn_ratio = (turns / max(total_group_turns, 1)) if total_group_turns > 0 else 0.5

        # Base scoring calculations
        # Communication: articulation, clarity, volume of thought
        comm_score = min(95, max(40, int(55 + min(30, words * 0.15) + (10 if words > 30 else 0))))
        
        # Leadership: initiating turns, framing arguments, guiding discussion
        leadership_score = min(95, max(35, int(50 + min(30, turns * 6) + (15 if turn_ratio > 0.25 else 5))))
        
        # Teamwork: acknowledging others, moderate turn balance, collaborative phrasing
        has_collab = bool(re.search(r"\b(agree|building on|as mentioned|point made by|together|we can|perspective|collaborate)\b", text, re.IGNORECASE))
        teamwork_score = min(95, max(45, int(60 + (20 if has_collab else 5) + min(15, turns * 3))))
        
        # Relevance: topic keywords matching
        topic_words = set(re.findall(r"\b\w{4,}\b", topic.lower()))
        matched_topic_words = sum(1 for tw in topic_words if tw in text.lower()) if topic_words else 1
        relevance_score = min(96, max(40, int(60 + min(30, matched_topic_words * 12))))
        
        # Critical Thinking: counter-arguments, reasoning keywords (because, therefore, however, impact, trade-off, analysis)
        critical_markers = len(re.findall(r"\b(because|therefore|however|trade-off|consequence|impact|advantage|drawback|on the other hand|alternatively)\b", text, re.IGNORECASE))
        critical_thinking_score = min(95, max(40, int(55 + min(35, critical_markers * 8))))
        
        # Confidence: steady speaking time, active participation
        confidence_score = min(95, max(40, int(55 + min(25, (speaking_sec / 30) * 10) + min(15, turns * 4))))
        
        # Respectful Interaction
        respect_score = min(98, max(60, int(75 + (15 if has_collab else 5))))
        
        # Overall
        overall_score = round(
            (comm_score * 0.20) +
            (leadership_score * 0.15) +
            (teamwork_score * 0.15) +
            (relevance_score * 0.20) +
            (critical_thinking_score * 0.20) +
            (confidence_score * 0.10)
        )

        strengths = []
        if comm_score >= 75:
            strengths.append("Articulate verbal expression and structured explanations.")
        if leadership_score >= 75:
            strengths.append("Demonstrated leadership by initiating speaking turns and framing ideas.")
        if teamwork_score >= 75:
            strengths.append("Actively acknowledged peers and fostered constructive discussion.")
        if critical_thinking_score >= 75:
            strengths.append("Presented analytical reasoning with well-evaluated trade-offs.")
        if not strengths:
            strengths.append("Participated in the discussion and shared relevant viewpoints.")

        weaknesses = []
        if turns <= 1:
            weaknesses.append("Low number of speaking turns; could participate more proactively.")
        if words < 25:
            weaknesses.append("Spoken arguments were brief; can expand more on underlying technical rationales.")
        if critical_markers == 0:
            weaknesses.append("Could incorporate more comparative trade-off analysis.")
        if not weaknesses:
            weaknesses.append("Minor opportunities to synthesize multi-candidate consensus faster.")

        rec = "strong_hire" if overall_score >= 85 else "hire" if overall_score >= 70 else "maybe" if overall_score >= 55 else "no_hire"

        evaluations[cid] = {
            "candidate_id": cid,
            "candidate_name": name,
            "communication_score": comm_score,
            "leadership_score": leadership_score,
            "teamwork_score": teamwork_score,
            "relevance_score": relevance_score,
            "critical_thinking_score": critical_thinking_score,
            "confidence_score": confidence_score,
            "respectful_interaction_score": respect_score,
            "overall_score": overall_score,
            "speaking_turns": turns,
            "speaking_time_seconds": speaking_sec,
            "words_spoken": words,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "feedback": f"{name} contributed {turns} speaking turns with {words} words spoken. Overall performance showed strong domain alignment with a composite score of {overall_score}/100.",
            "recommendation": rec
        }

    return {
        "topic": topic,
        "evaluations": evaluations,
        "overall_summary": f"Completed AI group discussion evaluation for {len(candidates_data)} candidate(s) on topic '{topic}'.",
        "generated_at": None,
        "disclaimer": AI_DISCLAIMER
    }


def analyze_group_discussion_openai(topic: str, candidates_data: list, api_key: str) -> dict:
    prompt = f"""You are an expert hiring committee and AI evaluator for Group Discussion rounds in technical interviews.
Analyze the following candidate transcripts and participation data for the group discussion.

Discussion Topic: "{topic}"

Candidate Transcripts & Metrics:
{json.dumps(candidates_data, indent=2)}

Evaluate each candidate across these core dimensions (scores from 0 to 100):
- communication_score
- leadership_score
- teamwork_score
- relevance_score
- critical_thinking_score
- confidence_score
- respectful_interaction_score
- overall_score
- strengths: array of strings
- weaknesses: array of strings
- feedback: 2-3 sentence personalized evaluation
- recommendation: ("strong_hire" | "hire" | "maybe" | "no_hire")

Return strictly valid JSON with this exact schema:
{{
  "overall_summary": "<summary of the group discussion dynamics>",
  "evaluations": {{
     "<candidate_id>": {{
         "candidate_id": "<candidate_id>",
         "candidate_name": "<name>",
         "communication_score": <int 0-100>,
         "leadership_score": <int 0-100>,
         "teamwork_score": <int 0-100>,
         "relevance_score": <int 0-100>,
         "critical_thinking_score": <int 0-100>,
         "confidence_score": <int 0-100>,
         "respectful_interaction_score": <int 0-100>,
         "overall_score": <int 0-100>,
         "speaking_turns": <int>,
         "speaking_time_seconds": <int>,
         "words_spoken": <int>,
         "strengths": ["..."],
         "weaknesses": ["..."],
         "feedback": "...",
         "recommendation": "strong_hire | hire | maybe | no_hire"
     }}
  }}
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
                    {"role": "system", "content": "You are a senior technical hiring moderator that outputs strict JSON."},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.3,
            },
            timeout=25.0,
        )
        if response.status_code == 200:
            result = json.loads(response.json()["choices"][0]["message"]["content"])
            result["topic"] = topic
            result["disclaimer"] = AI_DISCLAIMER
            return result
    except Exception as e:
        print(f"LLM GD analysis failed, falling back to heuristic: {e}")

    return analyze_group_discussion_heuristic(topic, candidates_data)


def analyze_group_discussion(topic: str, candidates_data: list) -> dict:
    settings = get_settings()
    if settings.openai_api_key:
        return analyze_group_discussion_openai(topic, candidates_data, settings.openai_api_key)
    return analyze_group_discussion_heuristic(topic, candidates_data)


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

