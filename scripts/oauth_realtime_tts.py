from __future__ import annotations

import asyncio
import base64
import json
import os
import sys
import time
from pathlib import Path

BRIDGE_ROOT = Path(os.environ.get("OPENAI_OAUTH_ROOT") or Path(__file__).resolve().parents[2] / "openao-oauth-access")
BRIDGE_SRC = BRIDGE_ROOT / "src"
sys.path.insert(0, str(BRIDGE_SRC))

import websockets  # noqa: E402
from openai_oauth_access import OpenAIOAuthAccess  # noqa: E402
from run_oauth_matrix import sanitize_response_text  # noqa: E402


async def main() -> int:
    if len(sys.argv) != 3:
        print("usage: oauth_realtime_tts.py request.json output.pcm", file=sys.stderr)
        return 2

    request_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    request = json.loads(request_path.read_text())

    text = str(request["input"]).strip()
    model = str(request.get("model") or "gpt-realtime-2")
    reasoning_effort = str(request.get("reasoningEffort") or "xhigh")
    voice = str(request.get("voice") or "marin")
    instructions = str(request.get("instructions") or "").strip()
    if not text:
        raise ValueError("input is empty")

    oauth = OpenAIOAuthAccess()
    secret = oauth.realtime_client_secret(model=model)
    uri = f"wss://api.openai.com/v1/realtime?model={model}"
    audio_chunks: list[bytes] = []

    async with websockets.connect(
        uri,
        additional_headers={"Authorization": f"Bearer {secret}"},
        open_timeout=20,
        max_size=12 * 1024 * 1024,
    ) as ws:
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "type": "realtime",
                "model": model,
                "reasoning": {"effort": reasoning_effort},
                "instructions": instructions,
                "audio": {
                    "output": {
                        "format": {"type": "audio/pcm", "rate": 24000},
                        "voice": voice,
                    },
                },
            },
        }))
        await ws.send(json.dumps({
            "type": "response.create",
            "response": {
                "output_modalities": ["audio"],
                "instructions": f"{instructions}\n\nRead this Korean narration exactly:\n{text}",
            },
        }))

        deadline = time.time() + 90
        while time.time() < deadline:
            message = await asyncio.wait_for(ws.recv(), timeout=max(1.0, deadline - time.time()))
            event = json.loads(message)
            event_type = str(event.get("type", ""))
            if event_type == "error":
                raise RuntimeError(sanitize_response_text(json.dumps(event.get("error", event)), limit=900))
            delta = event.get("delta")
            if isinstance(delta, str) and event_type.endswith("audio.delta"):
                audio_chunks.append(base64.b64decode(delta))
            if event_type in {"response.done", "response.completed"}:
                break

    audio = b"".join(audio_chunks)
    if len(audio) < 1000:
        raise RuntimeError(f"Realtime OAuth returned too little audio: {len(audio)} bytes")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(audio)
    print(json.dumps({
        "ok": True,
        "route": "codex_oauth_realtime",
        "model": model,
        "reasoning_effort": reasoning_effort,
        "voice": voice,
        "format": "pcm16",
        "rate": 24000,
        "bytes": len(audio),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
