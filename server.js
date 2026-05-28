import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
loadDotEnv();

const port = Number(process.env.PORT || 5173);
const oauthRoot = process.env.OPENAI_OAUTH_ROOT || join(root, "../openao-oauth-access");
const oauthPython = `${oauthRoot}/.venv/bin/python`;
const oauthHelper = join(root, "scripts/oauth_realtime_tts.py");
const oauthManifestHelper = join(root, "scripts/oauth_manifest.py");
const realtimeModel = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2";
const realtimeReasoningEffort = process.env.OPENAI_REALTIME_REASONING_EFFORT || "xhigh";
const manifestHelperTimeoutMs = Math.max(60000, Number(process.env.OPENAI_MANIFEST_TIMEOUT_MS) || 180000);
const allowTemplateFallback = process.env.ALLOW_TEMPLATE_FALLBACK === "1";
const manifestReasoningEfforts = (
  process.env.OPENAI_MANIFEST_REASONING_EFFORTS ||
  process.env.OPENAI_MANIFEST_REASONING_EFFORT ||
  "low,medium"
)
  .split(",")
  .map((item) => item.trim())
  .filter(
    (item, index, list) =>
      item && ["minimal", "low", "medium", "high", "xhigh"].includes(item) && list.indexOf(item) === index,
  );
if (!manifestReasoningEfforts.length) manifestReasoningEfforts.push("high");
const ttsRequestTimeoutMs = Math.max(10000, Number(process.env.TTS_REQUEST_TIMEOUT_MS) || 45000);
const realtimeVoices = ["marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"];
const openaiApiVoices = [
  "marin",
  "cedar",
  "coral",
  "ballad",
  "verse",
  "sage",
  "nova",
  "shimmer",
  "alloy",
  "ash",
  "echo",
  "fable",
  "onyx",
];
const googleTtsEndpoint = process.env.GOOGLE_TTS_ENDPOINT || "https://texttospeech.googleapis.com/v1/text:synthesize";
const googleTtsApiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_CLOUD_TTS_API_KEY || "";
const googleTtsAccessToken = process.env.GOOGLE_TTS_ACCESS_TOKEN || process.env.GOOGLE_CLOUD_ACCESS_TOKEN || "";
const googleTtsProject = process.env.GOOGLE_TTS_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "";
const googleTtsUseGcloud = process.env.GOOGLE_TTS_USE_GCLOUD === "1";
const geminiTtsApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "";
const geminiTtsModel = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
const geminiTtsEndpoint =
  process.env.GEMINI_TTS_ENDPOINT ||
  `https://generativelanguage.googleapis.com/v1beta/models/${geminiTtsModel}:generateContent`;
const geminiTtsDefaultVoice = process.env.GEMINI_TTS_VOICE || "Charon";
const geminiTtsVoices = [
  "Zephyr",
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Leda",
  "Orus",
  "Aoede",
  "Callirrhoe",
  "Autonoe",
  "Enceladus",
  "Iapetus",
  "Umbriel",
  "Algieba",
  "Despina",
  "Erinome",
  "Algenib",
  "Rasalgethi",
  "Laomedeia",
  "Achernar",
  "Alnilam",
  "Schedar",
  "Gacrux",
  "Pulcherrima",
  "Achird",
  "Zubenelgenubi",
  "Vindemiatrix",
  "Sadachbia",
  "Sadaltager",
  "Sulafat",
];
const googleTtsDefaultVoice = process.env.GOOGLE_TTS_VOICE || "ko-KR-Chirp3-HD-Charon";
const googleTtsSpeakingRate = Number(process.env.GOOGLE_TTS_SPEAKING_RATE || 0.94);
const googleTtsPitch = Number(process.env.GOOGLE_TTS_PITCH || -1);
const googleTtsVoices = [
  "ko-KR-Chirp3-HD-Charon",
  "ko-KR-Chirp3-HD-Achird",
  "ko-KR-Chirp3-HD-Algenib",
  "ko-KR-Chirp3-HD-Puck",
  "ko-KR-Chirp3-HD-Aoede",
  "ko-KR-Chirp3-HD-Kore",
  "ko-KR-Neural2-A",
  "ko-KR-Neural2-B",
  "ko-KR-Neural2-C",
  "ko-KR-Wavenet-A",
  "ko-KR-Wavenet-B",
  "ko-KR-Wavenet-C",
  "ko-KR-Wavenet-D",
  "ko-KR-Standard-A",
  "ko-KR-Standard-B",
  "ko-KR-Standard-C",
  "ko-KR-Standard-D",
];
const macosSayPath = process.env.MACOS_SAY_PATH || "/usr/bin/say";
const macosAfconvertPath = process.env.MACOS_AFCONVERT_PATH || "/usr/bin/afconvert";
const macosTtsDefaultVoice = process.env.MACOS_TTS_VOICE || "Yuna";
const macosTtsRate = String(Number(process.env.MACOS_TTS_RATE || 170) || 170);
let cachedMacosVoices = null;

function hasOAuthRealtime() {
  return existsSync(oauthPython) && existsSync(oauthHelper);
}

function hasGoogleTts() {
  return Boolean(googleTtsApiKey || googleTtsAccessToken || googleTtsUseGcloud);
}

function hasGeminiTts() {
  return Boolean(geminiTtsApiKey);
}

function hasMacosTts() {
  return existsSync(macosSayPath) && existsSync(macosAfconvertPath);
}

function loadDotEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [rawKey, ...rawValue] = trimmed.split("=");
    const key = rawKey.trim();
    const value = rawValue
      .join("=")
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 12000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

async function createSpeech(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    json(res, 400, { error: error.message });
    return;
  }

  const input = String(body.input || "").trim();
  const provider = ["gemini", "google", "macos"].includes(String(body.provider || "").toLowerCase())
    ? String(body.provider).toLowerCase()
    : "openai";
  const openaiVoice = [...realtimeVoices, ...openaiApiVoices].includes(body.voice) ? body.voice : "cedar";
  const geminiVoice = geminiTtsVoices.includes(body.voice) ? body.voice : geminiTtsDefaultVoice;
  const googleVoice = googleTtsVoices.includes(body.voice) ? body.voice : googleTtsDefaultVoice;
  const macosVoices = await listMacosKoreanVoices();
  const macosVoice = macosVoices.includes(body.voice) ? body.voice : macosTtsDefaultVoice;
  const instructions =
    typeof body.instructions === "string" && body.instructions.trim()
      ? body.instructions.trim()
      : "Speak in natural Korean, like a calm technical narrator. Keep the pacing steady, confident, and not overly cheerful.";

  if (!input) {
    json(res, 400, { error: "Missing input." });
    return;
  }
  if (input.length > 2400) {
    json(res, 400, { error: "Input is too long for this local demo." });
    return;
  }

  if (provider === "gemini") {
    if (!hasGeminiTts()) {
      json(res, 501, {
        error: "Gemini TTS is not configured.",
        detail: "Set GEMINI_API_KEY from Google AI Studio.",
      });
      return;
    }

    const started = Date.now();
    try {
      const wav = await createGeminiSpeech({ input, voice: geminiVoice, instructions });
      res.writeHead(200, {
        "content-type": "audio/wav",
        "content-length": wav.length,
        "cache-control": "no-store",
        "x-tts-route": "gemini-tts",
        "x-tts-model": geminiTtsModel,
        "x-tts-voice": geminiVoice,
        "x-tts-ms": String(Date.now() - started),
      });
      res.end(wav);
      return;
    } catch (error) {
      json(res, 502, {
        error: "Gemini TTS request failed.",
        detail: String(error.message || error).slice(0, 800),
      });
      return;
    }
  }

  if (provider === "google") {
    if (!hasGoogleTts()) {
      json(res, 501, {
        error: "Google Cloud TTS is not configured.",
        detail:
          "Set GOOGLE_TTS_API_KEY, GOOGLE_TTS_ACCESS_TOKEN, or GOOGLE_TTS_USE_GCLOUD=1 with a working gcloud login.",
      });
      return;
    }

    const started = Date.now();
    try {
      const audio = await createGoogleCloudSpeech({ input, voice: googleVoice });
      res.writeHead(200, {
        "content-type": "audio/mpeg",
        "content-length": audio.length,
        "cache-control": "no-store",
        "x-tts-route": "google-cloud-tts",
        "x-tts-model": "google-cloud-text-to-speech-v1",
        "x-tts-voice": googleVoice,
        "x-tts-ms": String(Date.now() - started),
      });
      res.end(audio);
      return;
    } catch (error) {
      json(res, 502, {
        error: "Google Cloud TTS request failed.",
        detail: String(error.message || error).slice(0, 800),
      });
      return;
    }
  }

  if (provider === "macos") {
    if (!hasMacosTts()) {
      json(res, 501, {
        error: "macOS TTS is not available.",
        detail: "This provider needs /usr/bin/say and /usr/bin/afconvert on macOS.",
      });
      return;
    }

    const started = Date.now();
    try {
      const wav = await createMacosSpeech({ input, voice: macosVoice });
      res.writeHead(200, {
        "content-type": "audio/wav",
        "content-length": wav.length,
        "cache-control": "no-store",
        "x-tts-route": "macos-system-voice",
        "x-tts-model": "say-afconvert",
        "x-tts-voice": macosVoice,
        "x-tts-ms": String(Date.now() - started),
      });
      res.end(wav);
      return;
    } catch (error) {
      json(res, 502, {
        error: "macOS TTS request failed.",
        detail: String(error.message || error).slice(0, 800),
      });
      return;
    }
  }

  const voice = openaiVoice;
  if (hasOAuthRealtime()) {
    try {
      const wav = await createOAuthRealtimeSpeech({ input, voice, instructions });
      res.writeHead(200, {
        "content-type": "audio/wav",
        "content-length": wav.length,
        "cache-control": "no-store",
        "x-tts-route": "codex-oauth-realtime",
        "x-tts-model": realtimeModel,
        "x-tts-reasoning-effort": realtimeReasoningEffort,
        "x-tts-voice": voice,
      });
      res.end(wav);
      return;
    } catch (error) {
      if (!process.env.OPENAI_API_KEY) {
        json(res, 502, {
          error: "OAuth Realtime TTS failed.",
          detail: String(error.message || error).slice(0, 800),
        });
        return;
      }
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    json(res, 501, {
      error: "No OAuth Realtime route or OPENAI_API_KEY is available. Using browser TTS fallback.",
    });
    return;
  }

  const started = Date.now();
  const apiRes = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice,
      input,
      instructions,
      response_format: "mp3",
    }),
  }).catch((error) => ({ ok: false, status: 502, text: async () => error.message }));

  if (!apiRes.ok) {
    const detail = await apiRes.text();
    json(res, apiRes.status || 502, {
      error: "OpenAI TTS request failed.",
      detail: detail.slice(0, 500),
    });
    return;
  }

  const audio = Buffer.from(await apiRes.arrayBuffer());
  res.writeHead(200, {
    "content-type": "audio/mpeg",
    "content-length": audio.length,
    "cache-control": "no-store",
    "x-tts-model": "gpt-4o-mini-tts",
    "x-tts-voice": voice,
    "x-tts-ms": String(Date.now() - started),
  });
  res.end(audio);
}

function pcm16ToWav(pcm, sampleRate = 24000, channels = 1) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const { timeoutMs = 120000, ...spawnOptions } = options;
    const child = spawn(command, args, { ...spawnOptions, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Child process timed out."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || `process exited ${code}`).slice(0, 1200)));
    });
  });
}

async function fetchWithAbort(url, options = {}, timeoutMs = ttsRequestTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function createOAuthRealtimeSpeech({ input, voice, instructions }) {
  const cacheKey = createHash("sha256")
    .update(
      JSON.stringify({ input, voice, instructions, model: realtimeModel, reasoningEffort: realtimeReasoningEffort }),
    )
    .digest("hex");
  const cacheDir = join(root, ".cache/tts");
  const requestPath = join(cacheDir, `${cacheKey}.json`);
  const pcmPath = join(cacheDir, `${cacheKey}.pcm`);
  const wavPath = join(cacheDir, `${cacheKey}.wav`);

  await mkdir(cacheDir, { recursive: true });
  if (existsSync(wavPath)) return readFile(wavPath);

  await writeFile(
    requestPath,
    JSON.stringify({
      input,
      voice,
      instructions,
      model: realtimeModel,
      reasoningEffort: realtimeReasoningEffort,
    }),
  );
  await runProcess(oauthPython, [oauthHelper, requestPath, pcmPath], {
    cwd: oauthRoot,
    env: { ...process.env, PYTHONPATH: `${oauthRoot}/src` },
  });
  const pcm = await readFile(pcmPath);
  const wav = pcm16ToWav(pcm);
  await writeFile(wavPath, wav);
  return wav;
}

function geminiTtsPrompt(input, instructions) {
  return [
    "Synthesize speech as audio only.",
    "Language: Korean.",
    "Do not read section labels, markdown labels, or these production directions aloud.",
    "Use a calm, articulate Korean documentary narrator voice with precise pronunciation.",
    "Keep a steady medium pace, short natural pauses, restrained emotion, and clear consonants.",
    instructions,
    "### TRANSCRIPT TO READ EXACTLY",
    input,
  ].join("\n");
}

async function createGeminiSpeech({ input, voice, instructions }) {
  const normalizedVoice = geminiTtsVoices.includes(voice) ? voice : geminiTtsDefaultVoice;
  const prompt = geminiTtsPrompt(input, instructions);
  const cacheKey = createHash("sha256")
    .update(
      JSON.stringify({
        provider: "gemini-tts",
        endpoint: geminiTtsEndpoint,
        model: geminiTtsModel,
        input,
        instructions,
        voice: normalizedVoice,
      }),
    )
    .digest("hex");
  const cacheDir = join(root, ".cache/tts");
  const wavPath = join(cacheDir, `${cacheKey}.gemini.wav`);
  await mkdir(cacheDir, { recursive: true });
  if (existsSync(wavPath)) return readFile(wavPath);

  const response = await fetchWithAbort(geminiTtsEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-goog-api-key": geminiTtsApiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: normalizedVoice,
            },
          },
        },
      },
      model: geminiTtsModel,
    }),
  });

  const rawPayload = await response.text();
  let payload;
  try {
    payload = rawPayload ? JSON.parse(rawPayload) : {};
  } catch {
    payload = { error: { message: rawPayload } };
  }
  const audioContent = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData?.data;
  if (!response.ok || !audioContent) {
    const reason = payload.promptFeedback?.blockReason ? `Blocked: ${payload.promptFeedback.blockReason}. ` : "";
    throw new Error(reason + (payload.error?.message || `Gemini TTS HTTP ${response.status}`));
  }

  const pcm = Buffer.from(audioContent, "base64");
  const wav = pcm16ToWav(pcm, 24000, 1);
  await writeFile(wavPath, wav);
  return wav;
}

async function googleTtsHeaders() {
  const headers = { "content-type": "application/json; charset=utf-8" };
  if (googleTtsAccessToken) {
    headers.authorization = `Bearer ${googleTtsAccessToken}`;
  } else if (googleTtsUseGcloud) {
    const { stdout } = await runProcess("gcloud", ["auth", "print-access-token"], { timeoutMs: 12000 });
    const token = stdout.trim();
    if (!token) throw new Error("gcloud did not return an access token.");
    headers.authorization = `Bearer ${token}`;
  }
  if (googleTtsProject) headers["x-goog-user-project"] = googleTtsProject;
  return headers;
}

function googleTtsRequestUrl() {
  if (!googleTtsApiKey) return googleTtsEndpoint;
  const url = new URL(googleTtsEndpoint);
  url.searchParams.set("key", googleTtsApiKey);
  return url.href;
}

async function createGoogleCloudSpeech({ input, voice }) {
  const normalizedVoice = googleTtsVoices.includes(voice) ? voice : googleTtsDefaultVoice;
  const cacheKey = createHash("sha256")
    .update(
      JSON.stringify({
        provider: "google-cloud-tts",
        endpoint: googleTtsEndpoint,
        input,
        voice: normalizedVoice,
        speakingRate: googleTtsSpeakingRate,
        pitch: googleTtsPitch,
      }),
    )
    .digest("hex");
  const cacheDir = join(root, ".cache/tts");
  const audioPath = join(cacheDir, `${cacheKey}.mp3`);
  await mkdir(cacheDir, { recursive: true });
  if (existsSync(audioPath)) return readFile(audioPath);

  const response = await fetchWithAbort(googleTtsRequestUrl(), {
    method: "POST",
    headers: await googleTtsHeaders(),
    body: JSON.stringify({
      input: { text: input },
      voice: {
        languageCode: "ko-KR",
        name: normalizedVoice,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: Number.isFinite(googleTtsSpeakingRate) ? googleTtsSpeakingRate : 0.94,
        pitch: Number.isFinite(googleTtsPitch) ? googleTtsPitch : -1,
      },
    }),
  });

  const rawPayload = await response.text();
  let payload;
  try {
    payload = rawPayload ? JSON.parse(rawPayload) : {};
  } catch {
    payload = { error: { message: rawPayload } };
  }
  if (!response.ok || !payload.audioContent) {
    throw new Error(payload.error?.message || `Google Cloud TTS HTTP ${response.status}`);
  }

  const audio = Buffer.from(payload.audioContent, "base64");
  await writeFile(audioPath, audio);
  return audio;
}

async function listMacosKoreanVoices() {
  if (cachedMacosVoices) return cachedMacosVoices;
  if (!hasMacosTts()) {
    cachedMacosVoices = [];
    return cachedMacosVoices;
  }
  try {
    const { stdout } = await runProcess(macosSayPath, ["-v", "?"], { timeoutMs: 12000 });
    cachedMacosVoices = stdout
      .split(/\r?\n/)
      .filter((line) => /\bko_KR\b/.test(line))
      .map((line) => line.match(/^(.+?)\s+ko_KR\b/)?.[1]?.trim())
      .filter(Boolean);
  } catch {
    cachedMacosVoices = [macosTtsDefaultVoice];
  }
  if (!cachedMacosVoices.includes(macosTtsDefaultVoice)) cachedMacosVoices.unshift(macosTtsDefaultVoice);
  return cachedMacosVoices;
}

async function createMacosSpeech({ input, voice }) {
  const voices = await listMacosKoreanVoices();
  const normalizedVoice = voices.includes(voice) ? voice : macosTtsDefaultVoice;
  const cacheKey = createHash("sha256")
    .update(
      JSON.stringify({
        provider: "macos-system-tts",
        input,
        voice: normalizedVoice,
        rate: macosTtsRate,
      }),
    )
    .digest("hex");
  const cacheDir = join(root, ".cache/tts");
  const aiffPath = join(cacheDir, `${cacheKey}.aiff`);
  const wavPath = join(cacheDir, `${cacheKey}.macos.wav`);
  await mkdir(cacheDir, { recursive: true });
  if (existsSync(wavPath)) return readFile(wavPath);

  await runProcess(macosSayPath, ["-v", normalizedVoice, "-r", macosTtsRate, "-o", aiffPath, input], {
    timeoutMs: 120000,
  });
  await runProcess(macosAfconvertPath, ["-f", "WAVE", "-d", "LEI16@24000", aiffPath, wavPath], {
    timeoutMs: 120000,
  });
  return readFile(wavPath);
}

function extractJson(text) {
  const trimmed = String(text || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Manifest response did not contain JSON.");
  return JSON.parse(trimmed.slice(start, end + 1));
}

function clipText(value, fallback, max = 320) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  return (text || fallback).slice(0, max);
}

function cleanCaption(value, fallback) {
  return clipText(value, fallback, 96)
    .replace(/^(\d{1,2}:)?\d{1,2}:\d{2}\s*/, "")
    .replace(/^\d{1,2}:\d{2}\s*/, "")
    .replace(/^[-–—]\s*/, "")
    .trim();
}

function normalizeStyle(value) {
  const style = String(value || "explainer").toLowerCase();
  return ["explainer", "documentary", "story", "emotional"].includes(style) ? style : "explainer";
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

function stripHtml(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTopicText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/블럭체인/g, "블록체인")
    .trim();
}

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const weakSourceHostPatterns = [
  /^community\.openai\.com$/i,
  /(^|\.)tistory\.com$/i,
  /(^|\.)blog\.naver\.com$/i,
  /(^|\.)naver\.com$/i,
  /(^|\.)medium\.com$/i,
  /(^|\.)reddit\.com$/i,
  /(^|\.)quora\.com$/i,
  /(^|\.)wikipedia\.org$/i,
];

const primarySourceHostPatterns = [
  /^(openai\.com|platform\.openai\.com|developers\.openai\.com|help\.openai\.com|deploymentsafety\.openai\.com|model-spec\.openai\.com)$/i,
  /(^|\.)googleblog\.com$/i,
  /^blog\.google$/i,
  /(^|\.)google\.com$/i,
  /(^|\.)android\.com$/i,
  /(^|\.)kisa\.or\.kr$/i,
  /(^|\.)ethereum\.org$/i,
  /(^|\.)bitcoin\.org$/i,
  /(^|\.)anthropic\.com$/i,
  /(^|\.)microsoft\.com$/i,
  /(^|\.)apple\.com$/i,
  /(^|\.)nvidia\.com$/i,
  /(^|\.)meta\.com$/i,
  /(^|\.)github\.com$/i,
  /(^|\.)arxiv\.org$/i,
  /(^|\.)acm\.org$/i,
  /(^|\.)ieee\.org$/i,
];

const trustedSourceHostPatterns = [
  /(^|\.)theverge\.com$/i,
  /(^|\.)techcrunch\.com$/i,
  /(^|\.)wired\.com$/i,
  /(^|\.)technologyreview\.com$/i,
  /(^|\.)reuters\.com$/i,
  /(^|\.)chainalysis\.com$/i,
  /(^|\.)apnews\.com$/i,
  /(^|\.)bloomberg\.com$/i,
  /(^|\.)ft\.com$/i,
  /(^|\.)wsj\.com$/i,
];

function matchesAnyHost(host, patterns) {
  return patterns.some((pattern) => pattern.test(host));
}

function sourceLooksPrimaryForTopic(host, topic) {
  const text = `${topic} ${host}`.toLowerCase();
  return (
    (/openai|chatgpt|gpt/.test(text) &&
      /^(openai\.com|platform\.openai\.com|developers\.openai\.com|help\.openai\.com|deploymentsafety\.openai\.com|model-spec\.openai\.com)$/.test(
        host,
      )) ||
    (/google|gemini|android/.test(text) && /(google\.com|googleblog\.com|blog\.google|android\.com)$/.test(host)) ||
    (/블록체인|블럭체인|blockchain|bitcoin|ethereum|crypto|암호화폐/.test(text) &&
      /(blockchain\.kisa\.or\.kr|kisa\.or\.kr|ethereum\.org|bitcoin\.org)$/.test(host)) ||
    (/anthropic|claude/.test(text) && /anthropic\.com$/.test(host)) ||
    (/microsoft|windows|azure|copilot/.test(text) && /microsoft\.com$/.test(host)) ||
    (/apple|ios|macos|vision/.test(text) && /apple\.com$/.test(host)) ||
    (/nvidia|cuda|gb200|gb300/.test(text) && /nvidia\.com$/.test(host)) ||
    (/meta|llama|facebook|instagram|threads/.test(text) && /meta\.com$/.test(host)) ||
    (/paper|논문|research|model|benchmark/.test(text) && /(arxiv\.org|acm\.org|ieee\.org)$/.test(host))
  );
}

function sourceReliability(source, topic = "") {
  const host = hostOf(source?.url) || String(source?.host || "").replace(/^www\./, "");
  const haystack = `${source?.title || ""} ${source?.snippet || ""} ${host}`.toLowerCase();
  let score = 45;
  const reasons = [];

  if (source?.verified) {
    score += 15;
    reasons.push("reachable");
  } else if (source?.verified === false) {
    score -= 18;
    reasons.push("not verified");
  }

  if (sourceLooksPrimaryForTopic(host, topic) || matchesAnyHost(host, primarySourceHostPatterns)) {
    score += 32;
    reasons.push("primary/official host");
  } else if (/docs?\.|developers?\.|developer\.|research\.|press\.|newsroom\./.test(host)) {
    score += 22;
    reasons.push("official-looking documentation host");
  } else if (matchesAnyHost(host, trustedSourceHostPatterns)) {
    score += 16;
    reasons.push("trusted editorial source");
  }

  if (/official|공식|announcement|announced|release|blog|docs?|documentation|developer/.test(haystack)) {
    score += 8;
    reasons.push("official/source wording");
  }
  if (matchesAnyHost(host, weakSourceHostPatterns)) {
    score -= 28;
    reasons.push("secondary or user-generated host");
  }
  if (/rumor|leak|추측|루머|anonymous|unconfirmed/.test(haystack)) {
    score -= 20;
    reasons.push("speculative wording");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = score >= 84 ? "primary" : score >= 70 ? "trusted" : score >= 52 ? "secondary" : "weak";
  const reason =
    reasons.length > 0
      ? reasons.slice(0, 3).join(", ")
      : tier === "weak"
        ? "weak or indirect source"
        : "reachable secondary source";
  return { reliability: score, tier, reason };
}

function rankSourceCandidates(sources, topic = "") {
  return [...sources]
    .map((source) => ({ ...source, ...sourceReliability(source, topic) }))
    .sort((a, b) => {
      if ((b.reliability || 0) !== (a.reliability || 0)) return (b.reliability || 0) - (a.reliability || 0);
      return String(a.host || "").localeCompare(String(b.host || ""));
    });
}

function sourceQualitySummary(sources) {
  const list = Array.isArray(sources) ? sources : [];
  const average = list.length
    ? Math.round(list.reduce((sum, source) => sum + (Number(source.reliability) || 0), 0) / list.length)
    : 0;
  return {
    average,
    primaryCount: list.filter((source) => source.tier === "primary").length,
    trustedCount: list.filter((source) => source.tier === "trusted").length,
    secondaryCount: list.filter((source) => source.tier === "secondary").length,
    weakCount: list.filter((source) => source.tier === "weak").length,
  };
}

function decodeDuckDuckGoUrl(rawHref) {
  const href = decodeHtml(rawHref || "");
  try {
    const url = new URL(href.startsWith("//") ? `https:${href}` : href);
    return url.searchParams.get("uddg") || url.href;
  } catch {
    return href;
  }
}

async function fetchTextWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function verifySource(source) {
  const checkedAt = new Date().toISOString();
  for (const method of ["HEAD", "GET"]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(source.url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "Mozilla/5.0" },
      });
      clearTimeout(timer);
      if (response.ok || (response.status >= 300 && response.status < 500 && response.status !== 404)) {
        return { ...source, verified: true, status: response.status, checkedAt };
      }
      if (method === "GET") return { ...source, verified: false, status: response.status, checkedAt };
    } catch (error) {
      clearTimeout(timer);
      if (method === "GET") {
        return {
          ...source,
          verified: false,
          status: 0,
          checkedAt,
          warning: String(error.message || error).slice(0, 120),
        };
      }
    }
  }
  return { ...source, verified: false, status: 0, checkedAt };
}

async function verifySources(sources, topic = "") {
  const checked = await Promise.all(sources.map((source) => verifySource(source)));
  const verified = checked.filter((source) => source.verified);
  const ranked = rankSourceCandidates(verified.length ? verified : checked, topic);
  const strong = ranked.filter((source) => ["primary", "trusted"].includes(source.tier));
  const usable = strong.length >= 3 ? strong : ranked.filter((source) => source.tier !== "weak");
  return (usable.length ? usable : ranked).slice(0, 5);
}

function researchRequiredFor(topic, style) {
  const text = `${topic} ${style}`.toLowerCase();
  return (
    style === "documentary" ||
    /뉴스|최신|오늘|어제|이번|현재|발표|출시|공개|사건|속보|팩트|사실|공식|리서치|근거|검증/.test(text) ||
    /\b(latest|news|today|yesterday|announced|released|launch|official|fact|research|source|verified)\b/.test(text) ||
    /\b20(2[4-9]|3\d)\b/.test(text)
  );
}

function officialSearchQueries(topic, latinQuery, shortQuery) {
  const text = topic.toLowerCase();
  const base = latinQuery || shortQuery || topic;
  if (/openai|chatgpt|gpt/.test(text)) {
    return [
      `site:openai.com ${base}`,
      `site:developers.openai.com ${base}`,
      `site:deploymentsafety.openai.com ${base}`,
      `site:help.openai.com ${base}`,
    ];
  }
  if (/google|gemini|android/.test(text)) {
    return [
      `site:blog.google ${base}`,
      `site:developers.google.com ${base}`,
      `site:android.com ${base}`,
      `site:android-developers.googleblog.com ${base}`,
    ];
  }
  if (/블록체인|블럭체인|blockchain|bitcoin|ethereum|crypto|암호화폐/.test(text)) {
    return [
      `site:blockchain.kisa.or.kr ${base}`,
      `site:kisa.or.kr ${base}`,
      `site:ethereum.org ${base}`,
      `site:bitcoin.org ${base}`,
      `site:chainalysis.com ${base}`,
    ];
  }
  if (/anthropic|claude/.test(text)) return [`site:anthropic.com ${base}`];
  if (/microsoft|azure|copilot|windows/.test(text))
    return [`site:microsoft.com ${base}`, `site:azure.microsoft.com ${base}`];
  if (/nvidia|cuda|gb200|gb300/.test(text)) return [`site:nvidia.com ${base}`];
  if (/apple|ios|macos|vision/.test(text)) return [`site:apple.com ${base}`];
  return [];
}

function officialSourceSeeds(topic) {
  const text = normalizeTopicText(topic).toLowerCase();
  if (!/블록체인|blockchain|bitcoin|ethereum|crypto|암호화폐/.test(text)) return [];
  return [
    {
      title: "블록체인 기술 및 산업 정보 - KISA",
      url: "https://blockchain.kisa.or.kr/",
      host: "blockchain.kisa.or.kr",
      snippet: "KISA가 제공하는 블록체인 기술, 정책, 산업 정보 포털입니다.",
    },
    {
      title: "Intro to Ethereum - ethereum.org",
      url: "https://ethereum.org/en/developers/docs/intro-to-ethereum/",
      host: "ethereum.org",
      snippet: "Ethereum documentation explains blockchain, blocks, transactions, nodes, and the Ethereum network.",
    },
    {
      title: "Bitcoin: A Peer-to-Peer Electronic Cash System",
      url: "https://bitcoin.org/bitcoin.pdf",
      host: "bitcoin.org",
      snippet:
        "The Bitcoin whitepaper describes a peer-to-peer electronic cash system using proof-of-work and a chain of blocks.",
    },
  ];
}

function parseSearchResults(html) {
  const results = [];
  const seen = new Set();
  const text = String(html || "");
  const anchors = [...text.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  for (let index = 0; index < anchors.length; index += 1) {
    const href = anchors[index][1];
    const title = anchors[index][2];
    if (!href || !title) continue;
    const url = decodeDuckDuckGoUrl(href).split("#")[0];
    const host = hostOf(url);
    if (!host || seen.has(url) || url.includes("duckduckgo.com")) continue;
    const end = anchors[index].index + anchors[index][0].length;
    const nextStart = anchors[index + 1]?.index || end + 1800;
    const block = text.slice(end, Math.min(nextStart, end + 1800));
    const snippet =
      block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ||
      block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
      "";
    seen.add(url);
    results.push({
      title: clipText(stripHtml(title), host, 120),
      url,
      host,
      snippet: clipText(stripHtml(snippet), "", 220),
    });
    if (results.length >= 6) break;
  }
  return results;
}

async function researchTopic(topic, style) {
  const required = researchRequiredFor(topic, style);
  const query = normalizeTopicText(topic);
  const research = { required, query, sources: [], sourceQuality: sourceQualitySummary([]), warnings: [] };
  if (!required) return research;

  try {
    const topicTokens = query.split(/\s+/).filter(Boolean);
    const latinQuery = topicTokens
      .filter((token) => /[a-z0-9]/i.test(token))
      .slice(0, 4)
      .join(" ");
    const shortQuery = topicTokens.slice(0, 3).join(" ");
    const queries = [
      ...new Set(
        [
          ...officialSearchQueries(query, latinQuery, shortQuery),
          query,
          shortQuery,
          latinQuery,
          latinQuery ? `${latinQuery} official announcement` : "",
          latinQuery ? `${latinQuery} official blog` : "",
          latinQuery ? `${latinQuery} documentation` : "",
          `${shortQuery} 공식 발표`,
          `${shortQuery} 공식 문서`,
        ].filter((item) => item && item.length >= 3),
      ),
    ];
    const byUrl = new Map();
    for (const seed of officialSourceSeeds(query)) {
      byUrl.set(seed.url, seed);
    }
    for (const nextQuery of queries) {
      const html = await fetchTextWithTimeout(`https://duckduckgo.com/html/?q=${encodeURIComponent(nextQuery)}`, {
        headers: {
          "user-agent": "Mozilla/5.0",
          accept: "text/html,application/xhtml+xml",
        },
      });
      for (const result of parseSearchResults(html)) {
        if (!byUrl.has(result.url)) byUrl.set(result.url, result);
      }
      const ranked = rankSourceCandidates([...byUrl.values()], query);
      if (byUrl.size >= 12 && sourceQualitySummary(ranked.slice(0, 5)).primaryCount > 0) break;
    }
    const candidates = rankSourceCandidates([...byUrl.values()], query).slice(0, 10);
    research.sources = await verifySources(candidates, query);
    research.sourceQuality = sourceQualitySummary(research.sources);
    if (!research.sources.length) research.warnings.push("No search results parsed.");
    if (research.sources.some((source) => !source.verified))
      research.warnings.push("Some source URLs could not be verified as reachable.");
    if (research.sourceQuality.primaryCount === 0)
      research.warnings.push("No official or primary source was found; factual claims must stay cautious.");
    if (research.sourceQuality.weakCount > 0)
      research.warnings.push("Weak secondary sources are present and should not carry central claims.");
  } catch (error) {
    research.warnings.push(`Search failed: ${String(error.message || error).slice(0, 160)}`);
  }
  return research;
}

function arrayOfPairs(value, fallback, size = 4) {
  const pairs = Array.isArray(value)
    ? value
        .filter((item) => Array.isArray(item) && item.length >= 2)
        .map((item) => [clipText(item[0], "label", 34), clipText(item[1], "value", 48)])
    : [];
  return pairs.length ? pairs.slice(0, size) : fallback;
}

function normalizePanelList(value, topic) {
  if (!Array.isArray(value) || value.length < 2) {
    return [
      { title: "Before", lines: ["흩어진 정보", "낮은 집중", "느린 이해"], tone: "muted" },
      { title: "After", lines: [topic.slice(0, 18), "핵심 구조", "다음 행동"], tone: "hot" },
    ];
  }
  return value.slice(0, 2).map((panel, index) => ({
    title: clipText(panel?.title, index === 0 ? "Before" : "After", 36),
    lines: Array.isArray(panel?.lines)
      ? panel.lines.slice(0, 3).map((line) => clipText(line, "point", 34))
      : ["point", "point", "point"],
    tone: panel?.tone === "hot" || index === 1 ? "hot" : "muted",
  }));
}

function normalizeCards(value, topic) {
  const cards = Array.isArray(value)
    ? value
        .filter((item) => Array.isArray(item) && item.length >= 3)
        .map((item) => [clipText(item[0], "A", 8), clipText(item[1], "핵심", 28), clipText(item[2], topic, 48)])
    : [];
  return cards.length
    ? cards.slice(0, 3)
    : [
        ["1", "맥락", "왜 지금 중요한지"],
        ["2", "구조", "어떤 흐름으로 작동하는지"],
        ["3", "판단", "무엇을 확인해야 하는지"],
      ];
}

function normalizeStringList(value, fallback, size = 5, max = 34) {
  const list = Array.isArray(value) ? value.map((item) => clipText(item, "step", max)).filter(Boolean) : [];
  return list.length ? list.slice(0, size) : fallback;
}

const deliveryProfiles = {
  hook: {
    tone: "quiet tension",
    pace: "slow opening",
    energy: "controlled",
    pause: "short pause before the key claim",
    instruction: "Start low and controlled, with documentary tension. Do not sound dramatic or promotional.",
  },
  context: {
    tone: "clear context",
    pace: "steady",
    energy: "neutral",
    pause: "light pause between ideas",
    instruction: "Explain the context cleanly. Keep the voice grounded and easy to follow.",
  },
  evidence: {
    tone: "neutral evidence",
    pace: "measured",
    energy: "restrained",
    pause: "pause around numbers or source-backed claims",
    instruction: "Sound precise and careful. Do not add emotional color to factual or source-backed claims.",
  },
  tension: {
    tone: "rising concern",
    pace: "slightly tighter",
    energy: "serious",
    pause: "hold briefly before the consequence",
    instruction: "Increase tension slightly while staying documentary. Avoid acting, shouting, or melodrama.",
  },
  transition: {
    tone: "curious transition",
    pace: "clean and forward",
    energy: "focused",
    pause: "brief reset at the end",
    instruction: "Carry the viewer into the next idea. Keep momentum without rushing.",
  },
  synthesis: {
    tone: "connected insight",
    pace: "steady",
    energy: "confident",
    pause: "pause before the synthesis",
    instruction: "Connect the earlier points with calm confidence. Make the logic feel complete.",
  },
  conclusion: {
    tone: "resolved conclusion",
    pace: "slightly slower",
    energy: "certain",
    pause: "longer pause before the final sentence",
    instruction: "Sound resolved and certain. Slow down slightly in the last sentence so the ending lands.",
  },
  sources: {
    tone: "source note",
    pace: "neutral",
    energy: "low",
    pause: "clean pauses between source groups",
    instruction: "Read this as a source note. Keep it neutral, factual, and concise.",
  },
};

const deliveryAlternates = {
  evidence: ["tension", "context", "transition"],
  synthesis: ["transition", "context", "evidence"],
  transition: ["synthesis", "evidence", "context"],
  tension: ["evidence", "transition", "context"],
  context: ["evidence", "transition", "synthesis"],
  conclusion: ["synthesis", "transition", "evidence"],
};

function deliveryRoleFor(layout, index) {
  if (index === 0 || layout === "hero") return "hook";
  if (layout === "sources") return "sources";
  if (layout === "final") return "conclusion";
  if (["spec", "metrics", "qa", "code"].includes(layout)) return "evidence";
  if (["compare", "spectrum", "clock"].includes(layout)) return "tension";
  if (["flow", "pipeline", "render"].includes(layout)) return "transition";
  if (["cards", "clean"].includes(layout)) return "synthesis";
  return "context";
}

function normalizeDelivery(value, layout, index, sceneCount, style = "explainer") {
  const raw = typeof value === "object" && value ? value : {};
  let role = typeof value === "string" ? value : raw.role;
  role = deliveryProfiles[role] ? role : deliveryRoleFor(layout, index, sceneCount);
  const profile = deliveryProfiles[role] || deliveryProfiles.context;
  const styleHint =
    style === "story"
      ? "Keep story tension controlled, not theatrical."
      : style === "emotional"
        ? "Allow warmth and human weight, but avoid melodrama."
        : style === "documentary"
          ? "Keep the delivery restrained and documentary."
          : "Keep the explanation direct and clear.";
  return {
    role,
    tone: clipText(raw.tone, profile.tone, 60),
    pace: clipText(raw.pace, profile.pace, 60),
    energy: clipText(raw.energy, profile.energy, 60),
    pause: clipText(raw.pause, profile.pause, 90),
    instruction: clipText(raw.instruction, `${profile.instruction} ${styleHint}`, 220),
  };
}

function normalizeEvidenceRefs(value, sources, index, layout) {
  if (!Array.isArray(sources) || sources.length === 0 || layout === "sources") return [];
  const sourceIds = sources.map((source, sourceIndex) => source.id || `S${sourceIndex + 1}`);
  const rawRefs = Array.isArray(value) ? value : [];
  const refs = rawRefs
    .map((item) => {
      if (typeof item === "number") return `S${item}`;
      if (typeof item === "string") {
        const trimmed = item.trim().toUpperCase();
        if (/^\d+$/.test(trimmed)) return `S${trimmed}`;
        if (/^S\d+$/.test(trimmed)) return trimmed;
      }
      if (item && typeof item === "object") {
        if (item.id) return String(item.id).trim().toUpperCase();
        if (item.sourceId) return String(item.sourceId).trim().toUpperCase();
      }
      return "";
    })
    .filter((ref, refIndex, list) => sourceIds.includes(ref) && list.indexOf(ref) === refIndex)
    .slice(0, 2);
  if (refs.length) return refs;
  if (["final", "hero"].includes(layout)) return sourceIds.slice(0, Math.min(2, sourceIds.length));
  return [sourceIds[index % sourceIds.length]];
}

function normalizeScene(raw, index, sceneCount, topic, options = {}) {
  const layouts = [
    "hero",
    "compare",
    "spec",
    "cards",
    "flow",
    "clock",
    "metrics",
    "code",
    "pipeline",
    "qa",
    "spectrum",
    "clean",
    "render",
    "final",
    "sources",
  ];
  const layoutCycle = ["hero", "compare", "spec", "cards", "flow", "metrics", "code", "qa", "pipeline", "clean"];
  let layout = layouts.includes(raw?.layout) ? raw.layout : layoutCycle[index % layoutCycle.length];
  if (index === 0) layout = "hero";
  if (index === options.sourceIndex) layout = "sources";
  else if (index === options.finalIndex || (index === sceneCount - 1 && options.sourceIndex !== index))
    layout = "final";

  const title = clipText(raw?.title, index === 0 ? `${topic} 한 번에 보기` : `${topic} 핵심 ${index + 1}`, 72);
  const markCandidate = clipText(raw?.mark, title.split(/\s+/)[0] || topic.slice(0, 8), 24);
  const mark = title.includes(markCandidate) ? markCandidate : title.split(/\s+/)[0] || markCandidate;
  const speech = clipText(
    raw?.speech,
    `${topic}에서 이 장면은 ${title}를 설명합니다. 화면의 핵심 문장과 음성이 같은 내용을 가리키도록 구성해서, 다음 장면으로 자연스럽게 이어지게 합니다.`,
    520,
  );
  const scene = {
    duration: Math.max(10, Math.min(24, Math.max(Number(raw?.duration) || 0, estimateSceneSeconds(speech)))),
    layout,
    title,
    mark,
    caption: cleanCaption(raw?.caption, `${title}.`) || `${title}.`,
    speech,
  };
  scene.delivery = normalizeDelivery(raw?.delivery, layout, index, sceneCount, options.style);
  scene.claim = clipText(raw?.claim, scene.caption || title, 150);
  scene.evidenceRefs = normalizeEvidenceRefs(raw?.evidenceRefs, options.sources || [], index, layout);

  if (layout === "hero") {
    scene.kicker = clipText(raw?.kicker, "HTML TTS VIDEO", 32).toUpperCase();
    scene.subtitle = clipText(raw?.subtitle, "주제, 원고, 화면, 음성을 한 번에 맞춘 5분 설명 영상", 96);
  }
  if (layout === "compare") scene.panels = normalizePanelList(raw?.panels, topic);
  if (layout === "spec") {
    scene.specs = arrayOfPairs(raw?.specs, [
      ["topic", topic.slice(0, 24)],
      ["runtime", "5 min"],
      ["voice", "fixed"],
      ["format", "16:9"],
    ]);
  }
  if (layout === "cards") scene.cards = normalizeCards(raw?.cards, topic);
  if (layout === "flow") {
    scene.nodes = normalizeStringList(raw?.nodes, ["hook", "context", "mechanism", "proof", "next"]);
    scene.activeNode = Number.isInteger(raw?.activeNode) ? Math.max(0, Math.min(4, raw.activeNode)) : 2;
  }
  if (layout === "clock") {
    scene.clock = clipText(raw?.clock, "10s", 16);
    scene.note = clipText(raw?.note, "audio duration controls the scene transition", 72);
  }
  if (layout === "metrics") {
    scene.metrics = arrayOfPairs(raw?.metrics, [
      ["pages", String(sceneCount)],
      ["target", "300s"],
      ["voice", "one"],
      ["export", "1080p"],
    ]);
  }
  if (layout === "code") {
    scene.code = normalizeStringList(raw?.code, ["topic", "outline", "scene json", "voice wav", "video export"], 5, 64);
  }
  if (layout === "pipeline")
    scene.steps = normalizeStringList(raw?.steps, ["topic", "script", "html", "voice", "export"]);
  if (layout === "qa") {
    scene.rows = arrayOfPairs(
      raw?.rows,
      [
        ["claim", "check"],
        ["screen", "match"],
        ["audio", "sync"],
      ],
      3,
    );
  }
  if (layout === "spectrum")
    scene.decision = clipText(raw?.decision, "한 버전 안에서는 같은 목소리를 끝까지 유지한다.", 96);
  if (layout === "clean") {
    scene.frames = arrayOfPairs(
      raw?.frames,
      [
        ["hook", "한 문장으로 시작"],
        ["body", "근거와 구조"],
        ["close", "명확한 결론"],
      ],
      3,
    );
  }
  if (layout === "final") {
    scene.route = normalizeStringList(raw?.route, ["topic", "voice", "preview", "1080p", "done"]);
    scene.stamp = clipText(raw?.stamp, "YOUTUBE READY", 32).toUpperCase();
  }
  if (layout === "sources") {
    scene.sources = Array.isArray(raw?.sources) ? raw.sources.slice(0, 5) : [];
  }
  return scene;
}

function normalizeSources(value, topic = "") {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  return list
    .map((source) => {
      const url = clipText(source?.url, "", 500);
      const host = clipText(source?.host || hostOf(url), "", 80);
      const title = clipText(source?.title, host || url || "source", 140);
      const snippet = clipText(source?.snippet, "", 240);
      const enriched = sourceReliability({ ...source, title, url, host, snippet }, topic);
      const normalized = {
        title,
        url,
        host,
        snippet,
        reliability: Number(source?.reliability) || enriched.reliability,
        tier: clipText(source?.tier, enriched.tier, 24),
        reason: clipText(source?.reason, enriched.reason, 140),
      };
      if (source?.verified !== undefined) normalized.verified = Boolean(source.verified);
      if (source?.status !== undefined) normalized.status = Number(source.status) || 0;
      if (source?.checkedAt) normalized.checkedAt = clipText(source.checkedAt, "", 40);
      if (source?.id) normalized.id = clipText(source.id, "", 12).toUpperCase();
      return normalized;
    })
    .filter((source) => source.url && source.host && !seen.has(source.url) && seen.add(source.url))
    .slice(0, 5)
    .map((source, index) => ({ ...source, id: source.id || `S${index + 1}` }));
}

function makeSourcesScene(topic, sources) {
  return normalizeScene(
    {
      duration: 10,
      layout: "sources",
      title: "출처와 확인한 근거",
      mark: "출처",
      caption: "출처와 확인한 근거.",
      speech:
        "마지막으로 이 영상의 사실 기반 주장은 화면에 보이는 출처를 기준으로 정리했습니다. 최신 내용은 원문 발표와 공식 문서를 다시 확인하는 흐름으로 마무리합니다.",
      sources,
    },
    999,
    1000,
    topic,
    { sourceIndex: 999 },
  );
}

function layoutCycleFor(style) {
  if (style === "documentary")
    return ["hero", "metrics", "flow", "compare", "spec", "qa", "pipeline", "cards", "code", "clean", "render"];
  if (style === "story")
    return ["hero", "cards", "flow", "compare", "clock", "clean", "spec", "metrics", "pipeline", "render"];
  if (style === "emotional")
    return ["hero", "compare", "cards", "clock", "clean", "flow", "metrics", "spec", "qa", "render"];
  return ["hero", "compare", "spec", "cards", "flow", "metrics", "code", "qa", "pipeline", "clean", "clock", "render"];
}

function repairLayoutVariety(scenes, topic, sceneCount, style, options) {
  const cycle = layoutCycleFor(style).filter((layout) => layout !== "hero");
  const protectedIndexes = new Set([0, options.finalIndex, options.sourceIndex].filter(Number.isInteger));
  const usage = new Map();
  const repaired = scenes.map((scene) => ({ ...scene }));

  for (let index = 0; index < repaired.length; index += 1) {
    const scene = repaired[index];
    if (protectedIndexes.has(index)) {
      usage.set(scene.layout, (usage.get(scene.layout) || 0) + 1);
      continue;
    }

    const previous = repaired[index - 1]?.layout;
    const twoBack = repaired[index - 2]?.layout;
    const next = repaired[index + 1]?.layout;
    const tooSoon = scene.layout === previous || scene.layout === twoBack;
    const tooCommon = (usage.get(scene.layout) || 0) >= 4;

    if (tooSoon || tooCommon) {
      const replacement = cycle.find(
        (layout) => layout !== previous && layout !== twoBack && layout !== next && (usage.get(layout) || 0) < 4,
      );
      if (replacement) {
        repaired[index] = normalizeScene({ ...scene, layout: replacement }, index, sceneCount, topic, options);
      }
    }
    usage.set(repaired[index].layout, (usage.get(repaired[index].layout) || 0) + 1);
  }
  return repaired;
}

function canShiftDeliveryRole(role, index) {
  return index > 0 && !["hook", "sources"].includes(role);
}

function alternateDeliveryRole(role, previousRole) {
  return (
    (deliveryAlternates[role] || ["context", "evidence", "transition"]).find(
      (candidate) => candidate !== previousRole,
    ) || role
  );
}

function repairDeliveryVariety(scenes, style) {
  let previousRole = "";
  return scenes.map((scene, index) => {
    let delivery = normalizeDelivery(scene.delivery, scene.layout, index, scenes.length, style);
    if (delivery.role === previousRole && canShiftDeliveryRole(delivery.role, index)) {
      delivery = normalizeDelivery(
        { role: alternateDeliveryRole(delivery.role, previousRole) },
        scene.layout,
        index,
        scenes.length,
        style,
      );
    }
    previousRole = delivery.role;
    return { ...scene, delivery };
  });
}

const topicKeywordStopwords = new Set([
  "영상",
  "설명",
  "내용",
  "정리",
  "분석",
  "만들기",
  "방법",
  "이유",
  "원인",
  "작동",
  "원리",
  "최신",
  "발표",
  "공개",
  "about",
  "video",
  "explain",
  "explainer",
  "documentary",
  "why",
  "how",
  "what",
  "and",
  "the",
]);

function normalizeKeywordText(value) {
  return normalizeTopicText(stripHtml(value))
    .toLowerCase()
    .replace(/[^\d.a-z가-힣]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function topicKeywords(topic) {
  const normalized = normalizeKeywordText(topic);
  const keywords = normalized
    .split(/\s+/)
    .map((token) => token.replace(/^[^\d.a-z가-힣]+|[^\d.a-z가-힣]+$/gi, ""))
    .filter((token) => token.length >= 2 && !topicKeywordStopwords.has(token));

  if (/블록체인|blockchain|bitcoin|ethereum|crypto|암호화폐/.test(normalized)) {
    keywords.push("블록체인", "blockchain", "블록", "분산", "합의", "원장", "노드", "해시", "채굴");
  }

  return [...new Set(keywords)].slice(0, 12);
}

function topicAlignmentSummary(scenes, topic) {
  const keywords = topicKeywords(topic);
  const contentScenes = scenes.filter((scene) => !["sources", "final"].includes(scene.layout));
  if (!keywords.length || !contentScenes.length) {
    return { keywords, contentCount: contentScenes.length, bodyRatio: 1, titleRatio: 1 };
  }

  let bodyMatches = 0;
  let titleMatches = 0;
  for (const scene of contentScenes) {
    const body = normalizeKeywordText(
      `${scene.title || ""} ${scene.caption || ""} ${scene.speech || ""} ${scene.claim || ""} ${scene.mark || ""}`,
    );
    const title = normalizeKeywordText(`${scene.title || ""} ${scene.mark || ""}`);
    if (keywords.some((keyword) => body.includes(keyword))) bodyMatches += 1;
    if (keywords.some((keyword) => title.includes(keyword))) titleMatches += 1;
  }

  return {
    keywords,
    contentCount: contentScenes.length,
    bodyRatio: bodyMatches / contentScenes.length,
    titleRatio: titleMatches / contentScenes.length,
  };
}

function scoreManifest(manifest, research) {
  let score = 100;
  const issues = [];
  const scenes = Array.isArray(manifest.scenes) ? manifest.scenes : [];
  const alignment = topicAlignmentSummary(scenes, manifest.topic || research?.query || "");

  if (scenes.length !== manifest.sceneCount) {
    score -= 24;
    issues.push(`Scene count is ${scenes.length}, expected ${manifest.sceneCount}.`);
  }

  const sourceRequired = Boolean(research?.required);
  const sourceCount = Array.isArray(manifest.sources) ? manifest.sources.length : 0;
  const sourceQuality = sourceQualitySummary(manifest.sources || []);
  if (sourceRequired && sourceCount === 0) {
    score -= 30;
    issues.push("Factual/current topic needs verified sources.");
  }
  if (sourceRequired && sourceCount > 0 && sourceQuality.primaryCount === 0) {
    score -= 14;
    issues.push("No official or primary source supports the core claims.");
  }
  if (sourceRequired && sourceQuality.weakCount >= Math.ceil(sourceCount / 2)) {
    score -= 10;
    issues.push("Too many weak or indirect sources.");
  }
  if (sourceCount > 0 && scenes.at(-1)?.layout !== "sources") {
    score -= 24;
    issues.push("Sources must be the final scene.");
  }

  const layoutCounts = new Map();
  let adjacentRepeats = 0;
  let adjacentDeliveryRepeats = 0;
  let missingEvidenceRefs = 0;
  let invalidEvidenceRefs = 0;
  let genericNarrationScenes = 0;
  const validSourceRefs = new Set((manifest.sources || []).map((source, index) => source.id || `S${index + 1}`));
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index] || {};
    layoutCounts.set(scene.layout, (layoutCounts.get(scene.layout) || 0) + 1);
    if (index > 0 && scene.layout === scenes[index - 1]?.layout) adjacentRepeats += 1;
    if (index > 0 && scene.delivery?.role && scene.delivery.role === scenes[index - 1]?.delivery?.role)
      adjacentDeliveryRepeats += 1;
    if (/^(\d{1,2}:)?\d{1,2}:\d{2}/.test(scene.caption || "")) {
      score -= 4;
      issues.push(`Scene ${index + 1} caption still has a timestamp.`);
    }
    const speechLength = String(scene.speech || "").length;
    if (speechLength < 45) {
      score -= 3;
      issues.push(`Scene ${index + 1} narration is too thin.`);
    }
    if (speechLength > 210) {
      score -= 2;
      issues.push(`Scene ${index + 1} narration is likely too long for the 10s rhythm.`);
    }
    if (sourceRequired && !["sources"].includes(scene.layout)) {
      const refs = Array.isArray(scene.evidenceRefs) ? scene.evidenceRefs : [];
      if (!refs.length) missingEvidenceRefs += 1;
      invalidEvidenceRefs += refs.filter((ref) => !validSourceRefs.has(ref)).length;
    }
    if (
      /중요합니다|살펴봅니다|알아봅니다|핵심입니다|이 장면은|자연스럽게 이어|한 가지 질문만 남기고|기준으로 확인합니다|사실은 짧게 고정/.test(
        scene.speech || "",
      )
    ) {
      genericNarrationScenes += 1;
    }
  }
  if (missingEvidenceRefs) {
    score -= Math.min(18, missingEvidenceRefs * 2);
    issues.push(`Scene evidence references missing: ${missingEvidenceRefs}.`);
  }
  if (invalidEvidenceRefs) {
    score -= Math.min(12, invalidEvidenceRefs * 3);
    issues.push(`Invalid evidence references: ${invalidEvidenceRefs}.`);
  }
  if (adjacentRepeats) {
    score -= Math.min(24, adjacentRepeats * 8);
    issues.push(`Adjacent layout repeats: ${adjacentRepeats}.`);
  }
  if (adjacentDeliveryRepeats) {
    score -= Math.min(12, adjacentDeliveryRepeats * 4);
    issues.push(`Adjacent delivery-role repeats: ${adjacentDeliveryRepeats}.`);
  }

  const titles = scenes
    .map((scene) =>
      String(scene.title || "")
        .replace(/\s+/g, "")
        .toLowerCase(),
    )
    .filter(Boolean);
  const uniqueTitleRatio = titles.length ? new Set(titles).size / titles.length : 0;
  if (uniqueTitleRatio < 0.9) {
    score -= 14;
    issues.push("Scene titles are too repetitive.");
  }

  const overusedLayouts = [...layoutCounts.entries()].filter(
    ([layout, count]) => !["hero", "final", "sources"].includes(layout) && count > 5,
  );
  if (overusedLayouts.length) {
    score -= 8;
    issues.push(`Overused layout: ${overusedLayouts.map(([layout]) => layout).join(", ")}.`);
  }

  const genericTitles = scenes.filter((scene) => /핵심|정리|중요|이해|변화/.test(scene.title || "")).length;
  if (genericTitles > Math.ceil(scenes.length * 0.45)) {
    score -= 10;
    issues.push("Too many generic scene titles.");
  }
  if (genericNarrationScenes > Math.ceil(scenes.length * 0.25)) {
    score -= 12;
    issues.push("Narration sounds too templated or boring.");
  }
  if (alignment.keywords.length && alignment.contentCount > 4 && alignment.bodyRatio < 0.65) {
    score -= 18;
    issues.push(`Topic alignment is weak in narration: ${Math.round(alignment.bodyRatio * 100)}%.`);
  }
  if (alignment.keywords.length && alignment.contentCount > 4 && alignment.titleRatio < 0.3) {
    score -= 12;
    issues.push(`Topic alignment is weak on screen titles: ${Math.round(alignment.titleRatio * 100)}%.`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score,
    passed:
      score >= 82 &&
      (!sourceRequired || (sourceCount > 0 && sourceQuality.average >= 52 && missingEvidenceRefs === 0)) &&
      adjacentRepeats === 0,
    issues: issues.slice(0, 8),
    sourceQuality,
    topicAlignment: {
      keywords: alignment.keywords.slice(0, 8),
      bodyRatio: Math.round(alignment.bodyRatio * 100) / 100,
      titleRatio: Math.round(alignment.titleRatio * 100) / 100,
    },
  };
}

function normalizeManifest(
  payload,
  topic,
  sceneCount = 30,
  style = "explainer",
  research = { required: false, sources: [] },
) {
  const sourceList = normalizeSources(
    research.required ? research.sources : research.sources?.length ? research.sources : payload?.sources,
    topic,
  );
  const sourceIndex = sourceList.length ? sceneCount - 1 : undefined;
  const finalIndex = sourceList.length ? sceneCount - 2 : sceneCount - 1;
  const options = { sourceIndex, finalIndex, style, sources: sourceList };
  const rawScenes = Array.isArray(payload?.scenes) ? payload.scenes : [];
  const padded = rawScenes.slice(0, sceneCount);
  while (padded.length < sceneCount) padded.push({});
  let normalizedScenes = padded.map((scene, index) => normalizeScene(scene, index, sceneCount, topic, options));

  if (sourceList.length) {
    normalizedScenes[finalIndex] = normalizeScene(
      {
        ...normalizedScenes[finalIndex],
        layout: "final",
        title: normalizedScenes[finalIndex]?.title || `${topic}의 결론`,
        mark: normalizedScenes[finalIndex]?.mark || "결론",
        caption: normalizedScenes[finalIndex]?.caption || `${topic}의 결론.`,
      },
      finalIndex,
      sceneCount,
      topic,
      options,
    );
    normalizedScenes[sourceIndex] = makeSourcesScene(topic, sourceList);
  }

  normalizedScenes = repairLayoutVariety(normalizedScenes, topic, sceneCount, style, options);
  normalizedScenes = repairDeliveryVariety(normalizedScenes, style);

  return {
    title: clipText(payload?.title, `${topic} 설명 영상`, 96),
    subtitle: clipText(payload?.subtitle, "HTML + OAuth TTS로 만든 5분 영상", 140),
    topic,
    style,
    targetSeconds: 300,
    sceneCount,
    sources: sourceList,
    research: {
      required: Boolean(research.required),
      query: research.query || "",
      sources: sourceList,
      sourceQuality: sourceQualitySummary(sourceList),
      warnings: Array.isArray(research.warnings) ? research.warnings : [],
    },
    scenes: normalizedScenes,
  };
}

function sourceHintAt(sources, index) {
  if (!sources.length) return null;
  const source = sources[index % sources.length];
  return {
    title: stripHtml(source.title || source.host || "검증된 출처"),
    host: stripHtml(source.host || hostOf(source.url) || "source"),
    snippet: stripHtml(source.snippet || ""),
  };
}

function shortTopicLabel(topic) {
  const clean = stripHtml(topic);
  const beforeColon = clean.split(/[:：-]/)[0]?.trim();
  const candidate = beforeColon && beforeColon.length >= 8 ? beforeColon : clean;
  return clipText(candidate, "이 주제", 42);
}

function hasFinalConsonant(value) {
  const chars = [...stripHtml(value)].reverse();
  const hangul = chars.find((char) => /[가-힣]/.test(char));
  if (!hangul) return false;
  return (hangul.charCodeAt(0) - 0xac00) % 28 !== 0;
}

function josa(value, consonantForm, vowelForm) {
  return hasFinalConsonant(value) ? consonantForm : vowelForm;
}

function estimateSceneSeconds(speech) {
  const length = stripHtml(speech).length;
  return Math.max(10, Math.min(20, Math.round(length / 6)));
}

function sourceSpeechFragment(source) {
  if (!source) return "";
  const title = stripHtml(source.title || "");
  const snippet = stripHtml(source.snippet || "");
  const candidate = title.length >= 12 ? title : snippet;
  return clipText(candidate, source.host || "출처", 62);
}

function fallbackSpeech(topicLabel, title, source, index, hasSources, topicType = "evergreen-explainer") {
  const angleByType = {
    "current-news": [
      "확인된 사실",
      "사용자에게 보이는 변화",
      "개발자가 확인할 조건",
      "아직 불확실한 부분",
      "다음에 확인할 지점",
    ],
    comparison: ["판단 기준", "장점", "제한", "실제 선택", "예외 상황"],
    tutorial: ["목표 상태", "준비 조건", "실행 순서", "실패 지점", "검증 방법"],
    "documentary-analysis": ["배경 압력", "작동 원리", "결과", "반론", "의미"],
    "story-case": ["출발점", "긴장", "오판", "전환", "교훈"],
    "human-stakes": ["사람의 체감", "불안의 원인", "통제권", "회복", "선택"],
    "evergreen-explainer": ["핵심 원리", "대표 예시", "오해", "한계", "정리"],
  };
  const angles = angleByType[topicType] || angleByType["evergreen-explainer"];
  const angle = angles[index % angles.length];
  const fragment = sourceSpeechFragment(source);
  const sourceName = source?.host || "확인된 출처";
  const sourceLead = source ? `${sourceName}에서 확인되는 단서` : "사용자가 준 주제";
  const transitions = [
    `먼저 ${topicLabel}${josa(topicLabel, "을", "를")} ${angle} 관점에서 좁혀 봅니다.`,
    `여기서 중요한 건 ${title}${josa(title, "을", "를")} 하나의 주장으로 고정하는 일입니다.`,
    `이 장면은 ${sourceLead}${josa(sourceLead, "을", "를")} 바탕으로, 화면에는 결론만 남기고 설명은 음성으로 넘깁니다.`,
    `다음 판단은 ${angle}${josa(angle, "을", "를")} 기준으로 갈립니다.`,
  ];
  if (/결론|정리/.test(title)) {
    return `정리하면 ${topicLabel}${josa(topicLabel, "은", "는")} 한 문장으로 단정할 주제가 아닙니다. 확인된 근거, 적용 범위, 남은 불확실성을 나눠 봐야 판단이 흔들리지 않습니다.`;
  }
  if (source) {
    const evidenceSentence = fragment
      ? `${sourceName}의 "${fragment}"를 확인 기준으로 둡니다.`
      : `${sourceName}의 확인 가능한 내용만 중심에 둡니다.`;
    return `${transitions[index % transitions.length]} ${evidenceSentence} 추측은 낮추고, 확인된 범위만 다음 장면으로 넘깁니다.`;
  }
  const sourceLine = hasSources ? "확인된 출처와 맞지 않는 추측은 빼고," : "최신 사실처럼 보이는 단정은 피하고,";
  return `${transitions[index % transitions.length]} ${sourceLine} 시청자가 다음 장면에서 확인할 질문을 하나만 남깁니다.`;
}

function fallbackManifest(topic, sceneCount = 30, style = "explainer", research = { required: false, sources: [] }) {
  const topicLabel = shortTopicLabel(topic);
  const sourceList = normalizeSources(research.sources, topic);
  const hasSources = sourceList.length > 0;
  const topicType = topicTypeFor(topic, style);
  const planByType = {
    "current-news": [
      ["hero", `${topicLabel}: 확인된 변화부터 본다`, "확인된 변화"],
      ["compare", "소문과 공식 발표를 먼저 분리한다", "분리"],
      ["spec", "공식 문서가 말한 범위를 고정한다", "공식 범위"],
      ["cards", "영향은 사용자, 개발자, 기업으로 갈린다", "세 갈래"],
      ["flow", "기능 이름보다 사용 흐름이 중요하다", "사용 흐름"],
      ["metrics", "일정과 제공 범위는 숫자로 따로 둔다", "숫자"],
      ["qa", "출처가 약한 문장은 주장으로 쓰지 않는다", "약한 출처"],
      ["pipeline", "근거에서 해석으로 한 단계씩 이동한다", "근거"],
      ["clean", "화면은 확인된 한 문장만 보여준다", "한 문장"],
      ["clock", "아직 모르는 부분을 중간에 남긴다", "불확실성"],
    ],
    comparison: [
      ["hero", `${topicLabel}: 무엇을 선택할지부터 정한다`, "선택"],
      ["compare", "비교 기준 없이는 결론이 흔들린다", "기준"],
      ["spec", "가격, 성능, 제한을 분리한다", "분리"],
      ["cards", "누구에게 맞는지가 핵심이다", "대상"],
      ["flow", "결정은 사용 상황에서 시작한다", "상황"],
      ["qa", "과장된 장점은 바로 걸러낸다", "걸러낸다"],
    ],
    tutorial: [
      ["hero", `${topicLabel}: 끝 상태를 먼저 보여준다`, "끝 상태"],
      ["spec", "준비 조건을 놓치면 흐름이 깨진다", "준비"],
      ["pipeline", "단계는 짧고 검증은 자주 한다", "검증"],
      ["qa", "실패 지점은 미리 분리한다", "실패"],
      ["clean", "화면은 지금 해야 할 일만 남긴다", "지금"],
    ],
  };
  const defaultPlan = [
    ["hero", `${topicLabel}: 왜 지금 중요한가`, "왜 지금"],
    ["compare", "겉으로 보이는 변화와 실제 구조를 나눈다", "구조"],
    ["spec", "주장을 작게 쪼개면 검증이 쉬워진다", "검증"],
    ["cards", "핵심은 맥락, 원리, 한계로 나뉜다", "맥락"],
    ["flow", "좋은 설명은 질문을 따라 이동한다", "질문"],
    ["metrics", "시청자가 기억할 숫자를 따로 둔다", "숫자"],
    ["qa", "약한 근거는 낮은 확신으로 말한다", "낮은 확신"],
    ["pipeline", "사실, 해석, 결론을 섞지 않는다", "분리"],
    ["clean", "한 장면에는 한 주장만 남긴다", "한 주장"],
    ["clock", "전환 전에는 다음 질문을 만든다", "다음 질문"],
  ];
  const basePlan = planByType[topicType] || defaultPlan;
  const plan = Array.from({ length: Math.max(1, sceneCount - 1) }, (_, index) => basePlan[index % basePlan.length]);
  plan[sceneCount - 2] = ["final", `${topicLabel}의 결론`, "결론"];
  const scenes = Array.from({ length: sceneCount }, (_, index) => {
    const [layout, title, mark] =
      index === sceneCount - 1 ? ["final", `${topicLabel}의 결론`, "결론"] : plan[index % plan.length];
    const source = sourceHintAt(sourceList, index);
    return normalizeScene(
      {
        layout,
        title,
        mark,
        caption: `${title}.`,
        speech: fallbackSpeech(topicLabel, title, source, index, hasSources, topicType),
      },
      index,
      sceneCount,
      topic,
      { style, sources: sourceList },
    );
  });
  return normalizeManifest(
    { title: `${topic} 설명 영상`, subtitle: "로컬 템플릿으로 만든 5분 HTML TTS 영상", scenes },
    topic,
    sceneCount,
    style,
    research,
  );
}

function styleGuidanceFor(style) {
  if (style === "documentary")
    return "Evidence-first documentary. Use verified claims, measured narration, clear uncertainty, and a final source page.";
  if (style === "story")
    return "Story arc. Define a character or decision-maker, tension, failed attempts, turning point, lesson, and payoff.";
  if (style === "emotional")
    return "Emotional but restrained. Start from human stakes, use contrast, then land each beat in a concrete insight.";
  return "Direct explainer. Hook fast, explain mechanism, show examples, name risks, then synthesize clearly.";
}

function topicTypeFor(topic, style) {
  const text = `${topic} ${style}`.toLowerCase();
  if (/뉴스|최신|오늘|어제|이번|현재|발표|출시|공개|속보|latest|news|announced|released|launch/.test(text))
    return "current-news";
  if (/비교|vs|versus|차이|대안|better|compare/.test(text)) return "comparison";
  if (/튜토리얼|방법|하는 법|how to|guide|setup|만드는 법|사용법/.test(text)) return "tutorial";
  if (/왜|이유|원인|history|documentary|다큐/.test(text) || style === "documentary") return "documentary-analysis";
  if (/story|스토리|실패|성공|case study|사례/.test(text) || style === "story") return "story-case";
  if (/감정|인생|동기|관계|불안|emotional/.test(text) || style === "emotional") return "human-stakes";
  return "evergreen-explainer";
}

function topicTypeGuidanceFor(topicType) {
  const guidance = {
    "current-news":
      "Lead with what is confirmed, what changed, who is affected, what is still uncertain, and what viewers should verify next.",
    comparison:
      "Define the decision criteria first, compare tradeoffs with concrete examples, then give a bounded recommendation.",
    tutorial: "Explain the end state, prerequisites, steps, common failure points, and a quick verification checklist.",
    "documentary-analysis":
      "Build a cause-and-effect arc: context, pressure, mechanism, consequence, counterpoint, synthesis, and source-backed ending.",
    "story-case": "Use a controlled story arc: setup, tension, failed assumption, turning point, lesson, and payoff.",
    "human-stakes":
      "Start with a real human consequence, then ground emotion in specific evidence and a practical insight.",
    "evergreen-explainer": "Teach the core mechanism with one strong example, one limitation, and one clear takeaway.",
  };
  return guidance[topicType] || guidance["evergreen-explainer"];
}

function buildGenerationPrompt({ topic, style, notes, sceneCount, targetSeconds, research }) {
  const sources = normalizeSources(research.sources, topic);
  const topicType = topicTypeFor(topic, style);
  const sourceQuality = sourceQualitySummary(sources);
  const sourceText = sources.length
    ? sources
        .map(
          (source) =>
            `${source.id}. [${source.tier} ${source.reliability}/100] ${source.title} (${source.host}) ${source.url} -- ${source.snippet || source.reason}`,
        )
        .join("\n")
    : "No verified sources yet. Avoid current/factual claims unless the user provides evidence.";
  const noteText = notes || "No extra user notes yet.";
  return [
    "Create a Korean HTML + OAuth TTS video manifest.",
    "",
    `Topic: ${topic}`,
    `Template: ${style}`,
    `Style guidance: ${styleGuidanceFor(style)}`,
    `Topic type: ${topicType}`,
    `Topic type guidance: ${topicTypeGuidanceFor(topicType)}`,
    `Scene count: exactly ${sceneCount}`,
    `Minimum runtime: ${targetSeconds} seconds`,
    "Rhythm: about 10 seconds per page, one idea per page, one fixed voice per full version.",
    "",
    "User discussion notes:",
    noteText,
    "",
    "Verified sources:",
    sourceText,
    `Source quality: avg ${sourceQuality.average}, primary ${sourceQuality.primaryCount}, trusted ${sourceQuality.trustedCount}, weak ${sourceQuality.weakCount}`,
    "",
    "Hard rules:",
    "- Show short screen text; put detail in narration.",
    "- If sources exist, the final scene must be a sources scene and the second-to-last scene must be the conclusion.",
    '- Each non-source scene must include a concrete claim and evidenceRefs like ["S1"] or ["S1", "S2"].',
    "- Do not use weak sources for central claims. Weak/secondary sources can only provide context or wording checks.",
    "- If no primary or trusted source supports a claim, phrase it as uncertainty or remove it.",
    "- Do not repeat adjacent visual layouts.",
    "- Do not use generic repeated titles.",
    "- Reject boring drafts internally: repeated titles, repeated sentence openings, shallow claims, and scenes that do not move the story forward must be rewritten before output.",
    "- Add delivery for each scene: role, tone, pace, energy, pause, instruction.",
    "- Default voice direction is restrained Korean documentary narration, with scene-level variation through pace, pauses, tension, and certainty.",
    "- Fail boring drafts and regenerate with critique.",
    "- Output only JSON for the renderer.",
  ].join("\n");
}

function buildVoicePrompt(style) {
  const base = [
    "Speak in natural Korean as a restrained documentary narrator.",
    "Use the same voice for the whole video, but vary delivery by scene.",
    "Control emotion through pace, pauses, tension, certainty, and warmth.",
    "Avoid customer-service warmth, overacting, shouting, or promotional excitement.",
    "Read the provided narration exactly; do not add new words.",
  ].join(" ");
  if (style === "documentary")
    return `${base} Default to neutral evidence, quiet tension in hooks, and resolved certainty in conclusions.`;
  if (style === "story")
    return `${base} Carry controlled story tension while keeping the delivery documentary, not theatrical.`;
  if (style === "emotional")
    return `${base} Add human weight and warmth where useful, but keep the voice grounded and unsentimental.`;
  return `${base} Make mechanism scenes clear, transitions forward-moving, and conclusions settled.`;
}

function buildDiscussionQuestions(style, research) {
  const questions = [
    "이 영상에서 가장 설득해야 하는 시청자는 누구인가?",
    "처음 10초에 어떤 오해나 긴장감을 잡아야 하는가?",
    "반드시 넣어야 하는 주장, 숫자, 예시가 있는가?",
    "절대 말하면 안 되는 추측이나 과장 표현은 무엇인가?",
  ];
  if (style === "story") questions.splice(2, 0, "주인공이나 관찰자의 관점은 누구로 잡을 것인가?");
  if (style === "emotional") questions.splice(2, 0, "시청자가 감정적으로 붙잡혀야 하는 순간은 어디인가?");
  if (research.required) questions.push("출처 목록 중 공식/1차 자료를 우선하고, 낮은 신뢰도 출처는 빼도 되는가?");
  return questions;
}

async function createBrief(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    json(res, 400, { error: error.message });
    return;
  }

  const topic = normalizeTopicText(body.topic);
  const style = normalizeStyle(body.style);
  const notes = clipText(body.notes, "", 1200);
  const sceneCount = Math.max(20, Math.min(36, Number(body.sceneCount) || 30));
  const targetSeconds = Math.max(300, Number(body.targetSeconds) || 300);

  if (topic.length < 2) {
    json(res, 400, { error: "Missing topic." });
    return;
  }

  const research = await researchTopic(topic, style);
  const sources = normalizeSources(research.sources, topic);
  const sourceQuality = sourceQualitySummary(sources);
  const brief = {
    topic,
    style,
    topicType: topicTypeFor(topic, style),
    notes,
    sceneCount,
    targetSeconds,
    research: { ...research, sources, sourceQuality },
    sources,
    sourceQuality,
    prompts: {
      generation: buildGenerationPrompt({
        topic,
        style,
        notes,
        sceneCount,
        targetSeconds,
        research: { ...research, sources, sourceQuality },
      }),
      voice: buildVoicePrompt(style),
    },
    discussionQuestions: buildDiscussionQuestions(style, research),
    route: "local-topic-brief",
  };
  json(res, 200, brief);
}

function manifestFailurePayload({ error, route, warning = "", research, manifest = null, quality = null }) {
  const topic = manifest?.topic || research?.query || "";
  const sources = normalizeSources(manifest?.sources?.length ? manifest.sources : research?.sources || [], topic);
  const sourceQuality = sourceQualitySummary(sources);
  return {
    error,
    route,
    warning,
    quality: quality || manifest?.quality || null,
    research: {
      required: Boolean(research?.required),
      query: research?.query || topic,
      sources,
      sourceQuality,
      warnings: Array.isArray(research?.warnings) ? research.warnings : [],
    },
  };
}

function qualityFailureMessage(quality) {
  const issues = Array.isArray(quality?.issues) ? quality.issues.filter(Boolean).slice(0, 4) : [];
  return issues.length ? issues.join(" ") : "Quality gate failed.";
}

async function createManifest(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    json(res, 400, { error: error.message });
    return;
  }

  const topic = normalizeTopicText(body.topic);
  const sceneCount = Math.max(20, Math.min(36, Number(body.sceneCount) || 30));
  if (topic.length < 2) {
    json(res, 400, { error: "Missing topic." });
    return;
  }
  if (topic.length > 300) {
    json(res, 400, { error: "Topic is too long." });
    return;
  }

  const style = normalizeStyle(body.style);
  const notes = clipText(body.notes, "", 1200);
  const research = await researchTopic(topic, style);
  const notesHash = createHash("sha256").update(notes).digest("hex").slice(0, 12);
  const researchHash = createHash("sha256")
    .update(
      JSON.stringify({
        required: research.required,
        urls: research.sources.map((source) => source.url),
      }),
    )
    .digest("hex")
    .slice(0, 16);

  if (hasOAuthRealtime() && existsSync(oauthManifestHelper)) {
    const cacheKey = createHash("sha256")
      .update(
        JSON.stringify({
          topic,
          sceneCount,
          style,
          notesHash,
          researchHash,
          sourceQuality: sourceQualitySummary(research.sources),
          efforts: manifestReasoningEfforts,
          helper: "oauth-manifest-v14-compact-topic-gated-effort-retry",
        }),
      )
      .digest("hex");
    const cacheDir = join(root, ".cache/manifests");
    const requestPath = join(cacheDir, `${cacheKey}.request.json`);
    const manifestPath = join(cacheDir, `${cacheKey}.manifest.json`);
    await mkdir(cacheDir, { recursive: true });
    if (existsSync(manifestPath)) {
      const cached = JSON.parse(await readFile(manifestPath, "utf8"));
      const quality = { ...scoreManifest(cached, research), attempts: cached.quality?.attempts || 0, maxAttempts: 2 };
      cached.quality = quality;
      if (!quality.passed) {
        json(
          res,
          422,
          manifestFailurePayload({
            error: "Cached manifest failed the topic quality gate. No fallback video was rendered.",
            route: "quality-gate-failed-cache",
            warning: qualityFailureMessage(quality),
            research,
            manifest: cached,
            quality,
          }),
        );
        return;
      }
      json(res, 200, { ...cached, route: "codex-oauth-text-cache" });
      return;
    }
    try {
      let bestManifest = null;
      let critique = "";
      let lastGenerationError = null;
      const maxAttempts = manifestReasoningEfforts.length;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const reasoningEffort = manifestReasoningEfforts[attempt - 1] || manifestReasoningEfforts.at(-1) || "high";
        await writeFile(
          requestPath,
          JSON.stringify({
            topic,
            sceneCount,
            targetSeconds: 300,
            style,
            notes,
            researchRequired: research.required,
            sources: research.sources,
            critique,
            reasoningEffort,
          }),
        );
        try {
          const { stdout } = await runProcess(oauthPython, [oauthManifestHelper, requestPath], {
            cwd: oauthRoot,
            env: { ...process.env, PYTHONPATH: `${oauthRoot}/src` },
            timeoutMs: manifestHelperTimeoutMs,
          });
          const manifest = normalizeManifest(extractJson(stdout), topic, sceneCount, style, research);
          const quality = scoreManifest(manifest, research);
          manifest.quality = { ...quality, attempts: attempt, maxAttempts, reasoningEffort };
          if (!bestManifest || quality.score > bestManifest.quality.score) bestManifest = manifest;
          if (quality.passed) break;
          critique = quality.issues.join(" ");
        } catch (error) {
          lastGenerationError = error;
          critique = `The previous ${reasoningEffort} attempt failed: ${String(error.message || error).slice(0, 180)}`;
        }
      }
      if (!bestManifest && lastGenerationError) throw lastGenerationError;
      const manifest = bestManifest || fallbackManifest(topic, sceneCount, style, research);
      if (!manifest.quality) manifest.quality = { ...scoreManifest(manifest, research), attempts: 0, maxAttempts };
      if (!manifest.quality.passed) {
        json(
          res,
          422,
          manifestFailurePayload({
            error: "Generated manifest failed the topic quality gate. No fallback video was rendered.",
            route: "quality-gate-failed",
            warning: qualityFailureMessage(manifest.quality),
            research,
            manifest,
          }),
        );
        return;
      }
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      json(res, 200, { ...manifest, route: "codex-oauth-text" });
      return;
    } catch (error) {
      if (!allowTemplateFallback) {
        const message = String(error.message || error).slice(0, 500);
        json(
          res,
          /timed out/i.test(message) ? 504 : 502,
          manifestFailurePayload({
            error: /timed out/i.test(message)
              ? "AI manifest generation timed out. No fallback video was rendered."
              : "AI manifest generation failed. No fallback video was rendered.",
            route: /timed out/i.test(message) ? "manifest-timeout" : "manifest-generation-failed",
            warning: message,
            research,
          }),
        );
        return;
      }
      const manifest = fallbackManifest(topic, sceneCount, style, research);
      manifest.quality = { ...scoreManifest(manifest, research), attempts: 0, maxAttempts: 2 };
      json(res, 200, {
        ...manifest,
        route: "local-template-fallback",
        warning: String(error.message || error).slice(0, 500),
      });
      return;
    }
  }

  if (!allowTemplateFallback) {
    json(
      res,
      503,
      manifestFailurePayload({
        error: "AI manifest generator is unavailable. No fallback video was rendered.",
        route: "manifest-unavailable",
        warning: "OpenAI OAuth helper is not available in this runtime.",
        research,
      }),
    );
    return;
  }

  const manifest = fallbackManifest(topic, sceneCount, style, research);
  manifest.quality = { ...scoreManifest(manifest, research), attempts: 0, maxAttempts: 2 };
  json(res, 200, { ...manifest, route: "local-template-fallback" });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".wav": "audio/wav",
  };

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url?.startsWith("/api/status")) {
    const openaiAvailable = hasOAuthRealtime() || Boolean(process.env.OPENAI_API_KEY);
    const openaiProvider = hasOAuthRealtime() ? "codex-oauth-realtime" : "openai-api-key";
    const openaiModel = hasOAuthRealtime() ? realtimeModel : "gpt-4o-mini-tts";
    const openaiVoices = hasOAuthRealtime() ? realtimeVoices : openaiApiVoices;
    const macosVoices = await listMacosKoreanVoices();
    json(res, 200, {
      openaiTts: openaiAvailable,
      geminiTts: hasGeminiTts(),
      googleTts: hasGoogleTts(),
      macosTts: hasMacosTts(),
      provider: openaiProvider,
      model: openaiModel,
      reasoningEffort: hasOAuthRealtime() ? realtimeReasoningEffort : null,
      bestVoice: "cedar",
      recommendedVoices: ["cedar", "marin"],
      voices: openaiVoices,
      providers: [
        {
          id: "openai",
          label: hasOAuthRealtime() ? "OpenAI Realtime OAuth" : "OpenAI Audio API",
          available: openaiAvailable,
          provider: openaiProvider,
          model: openaiModel,
          reasoningEffort: hasOAuthRealtime() ? realtimeReasoningEffort : null,
          bestVoice: "cedar",
          recommendedVoices: ["cedar", "marin"],
          voices: openaiVoices,
        },
        {
          id: "gemini",
          label: "Gemini 3.1 Flash TTS",
          available: hasGeminiTts(),
          provider: geminiTtsApiKey ? "gemini-api-key" : "not-configured",
          model: geminiTtsModel,
          bestVoice: geminiTtsDefaultVoice,
          recommendedVoices: [geminiTtsDefaultVoice, "Kore", "Schedar", "Sadaltager"],
          voices: geminiTtsVoices,
          languageCode: "ko",
        },
        {
          id: "google",
          label: "Google Cloud TTS",
          available: hasGoogleTts(),
          provider: googleTtsUseGcloud
            ? "gcloud-oauth"
            : googleTtsAccessToken
              ? "google-oauth-token"
              : googleTtsApiKey
                ? "google-api-key"
                : "not-configured",
          model: "cloud-text-to-speech-v1",
          bestVoice: googleTtsDefaultVoice,
          recommendedVoices: [googleTtsDefaultVoice, "ko-KR-Neural2-C", "ko-KR-Wavenet-C"],
          voices: googleTtsVoices,
          languageCode: "ko-KR",
        },
        {
          id: "macos",
          label: "macOS Korean TTS",
          available: hasMacosTts(),
          provider: "local-say-afconvert",
          model: "macOS say",
          bestVoice: macosTtsDefaultVoice,
          recommendedVoices: [macosTtsDefaultVoice, "Eddy (Korean (South Korea))", "Reed (Korean (South Korea))"],
          voices: macosVoices,
          languageCode: "ko-KR",
        },
        {
          id: "browser",
          label: "Browser system TTS",
          available: true,
          provider: "web-speech-api",
          model: "speechSynthesis",
          bestVoice: "",
          voices: [],
        },
      ],
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/tts") {
    await createSpeech(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/brief") {
    await createBrief(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/generate") {
    await createManifest(req, res);
    return;
  }

  if (req.method !== "GET") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  await serveStatic(req, res);
});

server.listen(port, () => {
  const mode = hasOAuthRealtime()
    ? `Codex OAuth Realtime enabled (${realtimeModel})`
    : process.env.OPENAI_API_KEY
      ? "OpenAI API TTS enabled"
      : "browser TTS fallback";
  console.log(`Serving on http://127.0.0.1:${port}/ (${mode})`);
});
