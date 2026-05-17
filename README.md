# AI YouTube Video Maker

Create YouTube-ready videos from a topic using AI scripts, HTML scenes, and TTS narration.

AI YouTube Video Maker is a browser-native video generator for turning a topic into a narrated, YouTube-size video. It plans a scene manifest, renders each page as HTML/CSS, generates spoken narration with TTS, syncs scene changes to real audio duration, and exports a 1080p WebM video.

Related keywords: AI video generator, AI YouTube video maker, YouTube video generator, script to video, topic to video, text to video, TTS video generator, HTML video generator, browser video renderer, OpenAI TTS, Realtime TTS, creator tools, YouTube automation, WebM export.

## What It Does

- Generates a video plan from a topic, template, voice, and discussion notes.
- Supports explainer, documentary, story, and emotional video structures.
- Builds source-aware prompts for current or factual topics and places verified sources at the end.
- Renders clean HTML scenes instead of static slides.
- Uses one fixed voice per full video version so the narration does not drift.
- Measures real TTS audio duration and advances scenes after the narration finishes.
- Targets long-form YouTube videos with a minimum measured runtime of 5 minutes.
- Exports YouTube-ready 1080p video from the browser.

## Why HTML Video

Most simple AI video workflows produce a script first and then force visuals around it. This project treats the browser as the video engine: each scene has layout, motion, text, narration, timing, and quality checks. That makes the output easier to inspect, edit, replay, and export.

## Features

- Topic discussion step before generation
- AI scene manifest generation
- Verified source collection for news or factual topics
- 36-scene long-form planning model
- TTS narration with voice-specific full versions
- Audio-first timeline sync
- OpenAI Realtime voice support through a local OAuth bridge
- OpenAI API key fallback for TTS
- Voice sample page
- 1080p WebM export
- GitHub-ready README, metadata, and smoke tests

## Quick Start

```bash
npm install
npm start
```

Then open:

```text
http://127.0.0.1:5173/
```

This project has no frontend build step. The server is a small Node.js static/API server.

## Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Optional settings:

```bash
OPENAI_API_KEY=
OPENAI_OAUTH_ROOT=/absolute/path/to/openao-oauth-access
OPENAI_REALTIME_MODEL=gpt-realtime-2
OPENAI_REALTIME_REASONING_EFFORT=xhigh
```

The local Codex OAuth bridge enables GPT-5.5 manifest generation and OpenAI Realtime TTS without placing an OpenAI API key in this project. If the OAuth bridge is not available, the app can still run with local fallback manifests and the API-key TTS route when `OPENAI_API_KEY` is set.

## Recommended Voices

The app defaults to `cedar` and also recommends `marin` for high-quality narration. A generated video version should use one voice from start to finish. Changing the voice creates a separate full version of the same scene plan.

## GitHub Topics

Use these topics on the GitHub repository for search discovery:

```text
ai-video-generator
youtube-video-maker
youtube-video-generator
text-to-video
script-to-video
topic-to-video
tts
text-to-speech
openai
openai-api
gpt-5
gpt-realtime
html-video
browser-video
webm
video-automation
youtube-automation
content-creation
creator-tools
generative-ai
```

## Project Structure

```text
.
|-- index.html                  # Main video maker UI
|-- app.js                      # Scene rendering, timeline sync, export logic
|-- styles.css                  # Video scene and app styling
|-- server.js                   # Local API, research, manifest, and TTS routes
|-- scripts/
|   |-- oauth_manifest.py       # OAuth-backed GPT-5.5 manifest generation
|   |-- oauth_realtime_tts.py   # OAuth-backed Realtime TTS generation
|   |-- generate_voice_samples.mjs
|   `-- measure_video_audio.mjs
|-- voice-samples.html
`-- VIDEO_SYSTEM_PROMPT.md
```

## Quality Checks

Run the smoke test:

```bash
npm test
```

The test checks JavaScript syntax and Python syntax for the local server and OAuth helper scripts.

## Safety Note

TTS output should be disclosed as AI-generated audio when published. Do not use this project to impersonate a real person or clone a private voice.

## License

MIT
