from __future__ import annotations

import json
import os
import sys
from pathlib import Path

BRIDGE_ROOT = Path(os.environ.get("OPENAI_OAUTH_ROOT") or Path(__file__).resolve().parents[2] / "openao-oauth-access")
BRIDGE_SRC = BRIDGE_ROOT / "src"
sys.path.insert(0, str(BRIDGE_SRC))

from codex_oauth import (  # noqa: E402
    DEFAULT_CODEX_MODEL,
    choose_runtime_source,
    codex_openai_client,
    fetch_codex_models,
    load_sources,
)


def topic_type_for(topic: str, style: str) -> str:
    text = f"{topic} {style}".lower()
    if any(key in text for key in ["뉴스", "최신", "오늘", "어제", "이번", "현재", "발표", "출시", "공개", "latest", "news", "announced", "released", "launch"]):
        return "current-news"
    if any(key in text for key in ["비교", "차이", "vs", "versus", "compare", "better"]):
        return "comparison"
    if any(key in text for key in ["튜토리얼", "방법", "하는 법", "how to", "guide", "setup", "사용법"]):
        return "tutorial"
    if style == "story" or any(key in text for key in ["story", "스토리", "사례", "case study"]):
        return "story-case"
    if style == "emotional" or any(key in text for key in ["감정", "인생", "불안", "관계", "emotional"]):
        return "human-stakes"
    if style == "documentary" or any(key in text for key in ["왜", "이유", "원인", "documentary", "다큐"]):
        return "documentary-analysis"
    return "evergreen-explainer"


def topic_type_guidance(topic_type: str) -> str:
    return {
        "current-news": "Lead with confirmed facts, separate uncertainty, name who is affected, and end with source-backed next checks.",
        "comparison": "Define decision criteria, compare tradeoffs, give bounded judgment.",
        "tutorial": "Show end state, prerequisites, steps, failure points, verification.",
        "documentary-analysis": "Build cause and effect: context, pressure, mechanism, consequence, counterpoint, synthesis.",
        "story-case": "Use setup, tension, failed assumption, turning point, lesson, payoff.",
        "human-stakes": "Start from human consequence, then ground emotion in concrete evidence.",
        "evergreen-explainer": "Teach mechanism with one strong example, one limitation, and one takeaway.",
    }.get(topic_type, "Teach mechanism with one strong example, one limitation, and one takeaway.")


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: oauth_manifest.py request.json", file=sys.stderr)
        return 2

    request = json.loads(Path(sys.argv[1]).read_text())
    topic = str(request.get("topic") or "").strip()
    scene_count = int(request.get("sceneCount") or 30)
    target_seconds = int(request.get("targetSeconds") or 300)
    style = str(request.get("style") or "explainer").strip().lower()
    notes = str(request.get("notes") or "").strip()
    sources = request.get("sources") if isinstance(request.get("sources"), list) else []
    research_required = bool(request.get("researchRequired"))
    critique = str(request.get("critique") or "").strip()
    if not topic:
        raise ValueError("topic is empty")

    style_guidance = {
        "explainer": "Direct explainer. Clear hook, context, mechanism, examples, risks, synthesis, conclusion.",
        "documentary": "Documentary. Evidence first, sober narration, timeline logic, explicit uncertainty, source-backed claims.",
        "story": "Story. Follow a problem, tension, attempts, turning point, practical lesson, and payoff.",
        "emotional": "Emotional. Human stakes, contrast, sensory but restrained language, then concrete insight.",
    }.get(style, "Direct explainer. Clear hook, context, mechanism, examples, risks, synthesis, conclusion.")
    topic_type = topic_type_for(topic, style)

    source_lines = []
    for index, source in enumerate(sources[:6], 1):
        source_id = str(source.get("id") or f"S{index}").strip()
        title = str(source.get("title") or source.get("host") or source.get("url") or "source").strip()
        url = str(source.get("url") or "").strip()
        host = str(source.get("host") or "").strip()
        snippet = str(source.get("snippet") or "").strip()
        tier = str(source.get("tier") or "secondary").strip()
        reliability = source.get("reliability") or "?"
        reason = str(source.get("reason") or "").strip()
        source_lines.append(f"{source_id} [{tier} {reliability}/100] {title} | {host} | {url} | {snippet or reason}")
    source_text = "\n".join(source_lines) if source_lines else "No verified web sources were provided."
    source_rule = (
        "Sources are provided. Use them for factual/current claims. Do not add specific dates, numbers, product claims, or benchmarks unless they are supported by these sources. "
        "Prefer primary/trusted source IDs for central claims. Weak sources can only support context. "
        "The final scene must be layout \"sources\" and list the same source objects. The second-to-last scene must be the conclusion."
        if source_lines
        else "No sources are provided. Avoid claims that sound like recent verified news. Keep wording conceptual unless the user topic itself provides the facts."
    )
    critique_rule = f"\nPrevious attempt failed quality checks. Fix this specifically: {critique}\n" if critique else ""

    instructions = """
You are a senior Korean producer for HTML + TTS explainer videos.
Return only valid JSON. No markdown fences. No comments.
The video must be clear enough to render as HTML scenes and natural enough for TTS narration.
Do not invent private facts. If the topic is factual or current, stay source-bounded and use cautious wording.
""".strip()

    prompt = f"""
Create a complete Korean HTML+TTS video manifest.

Topic: {topic}
Template style: {style}
Style guidance: {style_guidance}
Topic type: {topic_type}
Topic type guidance: {topic_type_guidance(topic_type)}
User discussion notes:
{notes if notes else "No extra user notes were provided."}
Target runtime: at least {target_seconds} seconds.
Scene count: exactly {scene_count}.
Rhythm: one page every about 10 seconds, one idea per page.
Voice rule: a whole rendered version uses one fixed voice.
Research required: {research_required}
Source rule: {source_rule}
Sources:
{source_text}
{critique_rule}

Return this JSON shape:
{{
  "title": "short Korean video title",
  "subtitle": "short Korean subtitle",
  "topic": "{topic}",
  "style": "{style}",
  "sources": [{{"title":"source title","url":"https://...","host":"example.com","snippet":"short evidence note"}}],
  "scenes": [
    {{
      "duration": 10,
      "layout": "hero | compare | spec | cards | flow | clock | metrics | code | pipeline | qa | spectrum | clean | render | final | sources",
      "kicker": "short uppercase label when useful",
      "title": "short Korean screen title",
      "mark": "one exact substring from title to highlight",
      "subtitle": "only for hero",
      "caption": "short Korean timeline caption, no timestamp",
      "claim": "one concrete claim this scene makes",
      "evidenceRefs": ["S1"],
      "speech": "Korean narration, 1 or 2 compact sentences, about 70-115 Korean characters, matched 1:1 with this page",
      "delivery": {{
        "role": "hook | context | evidence | tension | transition | synthesis | conclusion | sources",
        "tone": "short voice tone, e.g. quiet tension or neutral evidence",
        "pace": "slow opening | steady | measured | slightly tighter | clean and forward | slightly slower",
        "energy": "controlled | neutral | restrained | serious | focused | confident | certain",
        "pause": "short pause guidance for this page",
        "instruction": "one short English TTS direction for gpt-realtime-2"
      }},
      "panels": [{{"title":"short","lines":["short","short","short"],"tone":"muted"}}, {{"title":"short","lines":["short","short","short"],"tone":"hot"}}],
      "specs": [["label","value"],["label","value"],["label","value"],["label","value"]],
      "cards": [["A","title","body"],["B","title","body"],["C","title","body"]],
      "nodes": ["step","step","step","step","step"],
      "activeNode": 2,
      "metrics": [["label","value"],["label","value"],["label","value"],["label","value"]],
      "code": ["line","line","line","line","line"],
      "steps": ["step","step","step","step","step"],
      "rows": [["check","result"],["check","result"],["check","result"]],
      "decision": "short sentence",
      "frames": [["head","body"],["head","body"],["head","body"]],
      "route": ["step","step","step","step","step"],
      "stamp": "short uppercase closing stamp",
      "sources": [{{"title":"source title","url":"https://...","host":"example.com"}}]
    }}
  ]
}}

Rules:
- Use only the fields needed by each layout, but every scene must include duration, layout, title, mark, caption, speech.
- Every non-source scene should include claim and evidenceRefs. Use source IDs like S1 and S2 from the source list.
- Do not use weak sources for central claims. If a claim has only weak support, phrase it cautiously or remove it.
- The first scene must be hero.
- If sources were provided, the last scene must be sources and the second-to-last scene must be final. If no sources were provided, the last scene must be final.
- Do not repeat the same visual layout in adjacent scenes. Do not let any normal layout dominate the video.
- Screen text must be short. Put details in speech, not huge captions.
- Captions must not include timecodes like 0:10 or 00:10.
- Speech must not be a title repeat. It should explain, transition, and make the next page feel natural, but stay around 70-130 Korean characters for about 10 seconds of TTS.
- Delivery must default to a restrained Korean documentary narrator. Vary emotion through pace, pauses, quiet tension, source-neutral precision, and resolved certainty. Do not write theatrical acting directions.
- Every scene needs a specific angle. Avoid generic repeated titles like "핵심 정리", "중요한 변화", or "이해하기" unless the wording is made specific.
- Internally reject boring drafts before final output: repeated sentence openings, vague claims, repeated visual logic, and low-density filler must be rewritten.
- Make the flow feel like a real 5 minute YouTube video: hook, context, rising questions, evidence or examples, tension, synthesis, conclusion, then sources when available.
""".strip()

    source = choose_runtime_source(load_sources())
    models = fetch_codex_models(source.access_token or "")
    model = DEFAULT_CODEX_MODEL if DEFAULT_CODEX_MODEL in models or not models else models[0]
    client = codex_openai_client(source.access_token or "")
    chunks: list[str] = []
    final = None
    with client.responses.stream(
        model=model,
        store=False,
        reasoning={"effort": "xhigh"},
        instructions=instructions,
        input=[{
            "type": "message",
            "role": "user",
            "content": [{"type": "input_text", "text": prompt}],
        }],
    ) as stream:
        for event in stream:
            event_type = getattr(event, "type", "")
            if "output_text.delta" in event_type:
                delta = getattr(event, "delta", "")
                if isinstance(delta, str):
                    chunks.append(delta)
        final = stream.get_final_response()
    text = "".join(chunks).strip() or getattr(final, "output_text", "") or ""
    if not text and final is not None:
        fallback_chunks: list[str] = []
        for item in getattr(final, "output", []) or []:
            for content in getattr(item, "content", []) or []:
                value = getattr(content, "text", None)
                if isinstance(value, str):
                    fallback_chunks.append(value)
        text = "\n".join(fallback_chunks)
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
