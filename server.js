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
const manifestHelperTimeoutMs = Math.max(30000, Number(process.env.OPENAI_MANIFEST_TIMEOUT_MS) || 60000);
const allowTemplateFallback = process.env.ALLOW_TEMPLATE_FALLBACK === "1";
const pageSeconds = 10;
const minSceneCount = 10;
const maxSceneCount = 36;
const manifestReasoningEfforts = (
  process.env.OPENAI_MANIFEST_REASONING_EFFORTS ||
  process.env.OPENAI_MANIFEST_REASONING_EFFORT ||
  "low"
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
    const researchDeadline = Date.now() + 28000;
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
    const seeded = rankSourceCandidates([...byUrl.values()], query);
    const seededQuality = sourceQualitySummary(seeded.slice(0, 5));
    if (seededQuality.primaryCount >= 2) {
      research.sources = await verifySources(seeded.slice(0, 5), query);
      research.sourceQuality = sourceQualitySummary(research.sources);
      research.warnings.push("Official seed sources were strong enough; web search was skipped to avoid slow generation.");
      return research;
    }
    for (const nextQuery of queries) {
      const timeLeft = researchDeadline - Date.now();
      if (timeLeft <= 1200) {
        research.warnings.push("Source search deadline reached; using the best sources collected so far.");
        break;
      }
      try {
        const html = await fetchTextWithTimeout(
          `https://duckduckgo.com/html/?q=${encodeURIComponent(nextQuery)}`,
          {
            headers: {
              "user-agent": "Mozilla/5.0",
              accept: "text/html,application/xhtml+xml",
            },
          },
          Math.min(4500, timeLeft),
        );
        for (const result of parseSearchResults(html)) {
          if (!byUrl.has(result.url)) byUrl.set(result.url, result);
        }
      } catch (error) {
        research.warnings.push(`Search query failed: ${String(error.message || error).slice(0, 100)}`);
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
        .filter(([label, value]) => !isGenericVisualText(label) && !isGenericVisualText(value))
    : [];
  return pairs.length ? pairs.slice(0, size) : fallback;
}

const genericVisualTextPatterns = [
  /audio duration/i,
  /scene transition/i,
  /scene json/i,
  /voice wav/i,
  /video export/i,
  /source backed/i,
  /desktop 16:9/i,
  /tablet crop/i,
  /mobile stack/i,
  /^topic$/i,
  /^outline$/i,
  /^runtime$/i,
  /^preview$/i,
  /^export$/i,
  /^format$/i,
  /^voice$/i,
  /^fixed$/i,
  /^one$/i,
  /^before$/i,
  /^after$/i,
  /^point$/i,
  /^label$/i,
  /^value$/i,
  /^step$/i,
  /^main point$/i,
  /^10s$/i,
  /^300s$/i,
  /^5 min$/i,
  /^16:9$/i,
  /^documentary$/i,
  /^검증된 출처$/,
  /^다음 질문$/,
  /^범위를 나눠 본다$/,
];

const visualTokenStopwords = new Set([
  "그",
  "이",
  "저",
  "것",
  "수",
  "있다",
  "있는",
  "합니다",
  "입니다",
  "그리고",
  "하지만",
  "영상",
  "장면",
  "화면",
  "설명",
  "핵심",
  "정리",
  "기준",
  "흐름",
  "구조",
  "확인",
  "근거",
  "주제",
  "내용",
  "블록체인",
  "blockchain",
  "작동",
  "원리",
  "topic",
  "scene",
  "video",
  "voice",
  "html",
  "tts",
]);

function isGenericVisualText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return genericVisualTextPatterns.some((pattern) => pattern.test(text));
}

function flattenStrings(value) {
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => flattenStrings(item));
  if (value && typeof value === "object") return Object.values(value).flatMap((item) => flattenStrings(item));
  return [];
}

function hasGenericVisualValue(value) {
  return flattenStrings(value).some((item) => isGenericVisualText(item));
}

function isStructuralRepeatText(value) {
  const text = stripHtml(value);
  return (
    /^(겉으로 보이는 점|실제로 봐야 할 점|핵심|근거|의미|주장|다음)$/.test(text) ||
    /^S\d+\s/.test(text) ||
    /\b[a-z0-9-]+\.(org|com|io|net|kr|dev)\b/i.test(text) ||
    /에서 확인한 범위 안에서 설명한다/.test(text)
  );
}

function contentPhrasesFrom(value, max = 6) {
  const text = stripHtml(value)
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return [];
  const pieces = text
    .split(/[.!?。！？\n]+|(?<=다)\s+|(?<=요)\s+/)
    .map((item) => item.replace(/^(먼저|여기서|그리고|하지만|정리하면|즉)\s*/g, "").trim())
    .filter((item) => item.length >= 6 && !isGenericVisualText(item));
  const compact = pieces.length ? pieces : [text];
  return compact
    .map((item) => clipText(item, "", 34))
    .filter((item, index, list) => item && list.indexOf(item) === index)
    .slice(0, max);
}

function contentTermsFrom(value, max = 6) {
  const text = normalizeTopicText(stripHtml(value))
    .toLowerCase()
    .replace(/[^\d.a-z가-힣]+/gi, " ");
  const terms = text
    .split(/\s+/)
    .map((item) =>
      item
        .trim()
        .replace(/(으로|에서|에게|부터|까지|처럼|보다|이며|하고|되는|한다|합니다|입니다|이다)$/g, "")
        .replace(/(은|는|이|가|을|를|의|와|과|로|에)$/g, ""),
    )
    .filter((item) => item.length >= 2 && item.length <= 12 && !visualTokenStopwords.has(item))
    .filter((item) => !/^\d+$/.test(item) && !isGenericVisualText(item));
  return [...new Set(terms)].slice(0, max);
}

function sourceLabelFromRefs(refs, sources) {
  if (!Array.isArray(refs) || !refs.length || !Array.isArray(sources) || !sources.length) return "";
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  return refs
    .map((ref) => sourceMap.get(ref))
    .filter(Boolean)
    .map((source) => `${source.id} ${source.host || hostOf(source.url) || "source"}`)
    .slice(0, 2)
    .join(" · ");
}

function sceneVisualContext(scene, topic, sources = []) {
  const text = `${scene.title || ""} ${scene.claim || ""} ${scene.caption || ""} ${scene.speech || ""} ${topic}`;
  const phrases = contentPhrasesFrom(`${scene.claim || ""}. ${scene.speech || ""}. ${scene.caption || ""}`, 6);
  const terms = contentTermsFrom(text, 8);
  const sourceLabel = sourceLabelFromRefs(scene.evidenceRefs, sources);
  const topicLabel = shortTopicLabel(topic);
  const primary = terms[0] || clipText(scene.mark || scene.title, topicLabel, 16);
  return {
    topicLabel,
    sourceLabel,
    terms: terms.length ? terms : [topicLabel, "구조", "원리", "한계", "결론"],
    phrases: phrases.length ? phrases : [scene.claim || scene.caption || scene.title, scene.speech || topicLabel],
    primary,
  };
}

function visualFallbacksFor(scene, topic, sources, index, sceneCount) {
  const context = sceneVisualContext(scene, topic, sources);
  const [first, second, third, fourth, fifth] = context.terms;
  const [p1, p2, p3, p4] = context.phrases;
  const source = context.sourceLabel || `${context.topicLabel} 맥락`;
  return {
    panels: [
      { title: "겉으로 보이는 점", lines: [first, p1, source], tone: "muted" },
      { title: "실제로 봐야 할 점", lines: [second || first, p2 || p1, third || context.topicLabel], tone: "hot" },
    ],
    specs: [
      ["핵심", first],
      ["근거", source],
      ["작동", second || p1],
      ["주의", p2 || "범위를 나눠 본다"],
    ],
    cards: [
      ["1", first || "출발점", p1],
      ["2", second || "검증", p2 || p1],
      ["3", third || "결론", p3 || p2 || p1],
    ],
    nodes: [first, second, third, fourth, fifth].filter(Boolean).slice(0, 5),
    clock: clipText(first, context.topicLabel, 14),
    note: clipText(p1, scene.title, 72),
    metrics: [
      ["핵심", first],
      ["근거", source.replace(/^S\d+\s*/, "")],
      ["범위", second || context.topicLabel],
      ["질문", third || "다음 판단"],
    ],
    code: [
      clipText(scene.claim || p1, scene.title, 54),
      clipText(source, context.topicLabel, 54),
      clipText(`${first || context.topicLabel} -> ${second || context.topicLabel}`, context.topicLabel, 54),
      clipText(p2 || p1, scene.title, 54),
      clipText(p3 || scene.caption, context.topicLabel, 54),
    ],
    steps: [p1, p2, p3, p4, scene.title]
      .filter(Boolean)
      .map((item) => clipText(item, "", 28))
      .slice(0, 5),
    rows: [
      ["주장", clipText(scene.claim || p1, scene.title, 34)],
      ["근거", source],
      ["다음", clipText(p2 || scene.caption, scene.title, 34)],
    ],
    decision: clipText(scene.claim || p1 || scene.speech, scene.title, 96),
    stamp: clipText(
      `${first || context.topicLabel} ${index >= sceneCount - 2 ? "결론" : "확인"}`,
      context.topicLabel,
      32,
    ),
    frames: [
      ["핵심", clipText(first, context.topicLabel, 36)],
      ["근거", clipText(source, context.topicLabel, 36)],
      ["의미", clipText(p2 || p1, scene.title, 48)],
    ],
    route: [
      context.topicLabel,
      first,
      second,
      third,
      index >= sceneCount - 2 ? `${context.topicLabel} 결론` : "다음 판단",
    ]
      .filter(Boolean)
      .slice(0, 5),
  };
}

function visualFieldsForLayout(layout, visualFallbacks) {
  if (layout === "hero") {
    return {
      kicker: visualFallbacks.primary,
      subtitle: visualFallbacks.note,
    };
  }
  if (layout === "compare") return { panels: visualFallbacks.panels };
  if (layout === "spec") return { specs: visualFallbacks.specs };
  if (layout === "cards") return { cards: visualFallbacks.cards };
  if (layout === "flow")
    return { nodes: visualFallbacks.nodes, activeNode: Math.min(2, visualFallbacks.nodes.length - 1) };
  if (layout === "clock") return { clock: visualFallbacks.clock, note: visualFallbacks.note };
  if (layout === "metrics") return { metrics: visualFallbacks.metrics };
  if (layout === "code") return { code: visualFallbacks.code };
  if (layout === "pipeline") return { steps: visualFallbacks.steps };
  if (layout === "qa") return { rows: visualFallbacks.rows };
  if (layout === "spectrum") {
    return {
      decision: visualFallbacks.decision,
      scale: [visualFallbacks.nodes[0] || visualFallbacks.clock, visualFallbacks.nodes[1] || visualFallbacks.stamp],
    };
  }
  if (layout === "clean" || layout === "render") return { frames: visualFallbacks.frames };
  if (layout === "final") return { route: visualFallbacks.route, stamp: visualFallbacks.stamp };
  return {};
}

function normalizePanelList(value, fallbackPanels) {
  if (!Array.isArray(value) || value.length < 2) {
    return fallbackPanels;
  }
  return value.slice(0, 2).map((panel, index) => ({
    title: clipText(panel?.title, fallbackPanels[index]?.title || `관점 ${index + 1}`, 36),
    lines: Array.isArray(panel?.lines)
      ? panel.lines
          .filter((line) => !isGenericVisualText(line))
          .slice(0, 3)
          .map((line, lineIndex) => clipText(line, fallbackPanels[index]?.lines?.[lineIndex] || "", 34))
      : fallbackPanels[index]?.lines || fallbackPanels[0]?.lines || [],
    tone: panel?.tone === "hot" || index === 1 ? "hot" : "muted",
  }));
}

function normalizeCards(value, fallbackCards) {
  const cards = Array.isArray(value)
    ? value
        .filter((item) => Array.isArray(item) && item.length >= 3)
        .map((item, index) => {
          const fallback = fallbackCards[index] || fallbackCards[0] || ["", "", ""];
          return [
            clipText(item[0], fallback[0], 8),
            clipText(item[1], fallback[1], 28),
            clipText(item[2], fallback[2], 48),
          ];
        })
        .filter((item) => item.some((part) => !isGenericVisualText(part)))
    : [];
  return cards.length ? cards.slice(0, 3) : fallbackCards;
}

function normalizeStringList(value, fallback, size = 5, max = 34) {
  const list = Array.isArray(value)
    ? value.map((item) => clipText(item, "step", max)).filter((item) => item && !isGenericVisualText(item))
    : [];
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

function usefulText(value, minLength = 2) {
  const text = stripHtml(value).trim();
  return text.length >= minLength && !isGenericVisualText(text);
}

function usefulStringList(value, minCount = 3) {
  if (!Array.isArray(value)) return false;
  const usable = value.filter((item) => usefulText(item, 2));
  return usable.length >= minCount;
}

function usefulPairList(value, minCount = 3) {
  if (!Array.isArray(value)) return false;
  const usable = value.filter(
    (item) => Array.isArray(item) && item.length >= 2 && usefulText(item[0], 1) && usefulText(item[1], 2),
  );
  return usable.length >= minCount;
}

function usefulCards(value) {
  if (!Array.isArray(value)) return false;
  const usable = value.filter(
    (item) =>
      Array.isArray(item) &&
      item.length >= 3 &&
      usefulText(item[0], 1) &&
      usefulText(item[1], 2) &&
      usefulText(item[2], 3),
  );
  return usable.length >= 3;
}

function usefulPanels(value) {
  if (!Array.isArray(value) || value.length < 2) return false;
  return value
    .slice(0, 2)
    .every(
      (panel) =>
        panel &&
        usefulText(panel.title, 2) &&
        Array.isArray(panel.lines) &&
        panel.lines.filter((line) => usefulText(line, 2)).length >= 2,
    );
}

function usefulEvidenceRefs(value, sources) {
  if (!Array.isArray(sources) || !sources.length) return true;
  if (!Array.isArray(value) || !value.length) return false;
  const sourceIds = new Set(sources.map((source, sourceIndex) => source.id || `S${sourceIndex + 1}`));
  return value.some((item) => {
    const ref =
      typeof item === "number"
        ? `S${item}`
        : typeof item === "string"
          ? item
              .trim()
              .toUpperCase()
              .replace(/^(\d+)$/, "S$1")
          : item?.id || item?.sourceId || "";
    return sourceIds.has(String(ref).trim().toUpperCase());
  });
}

const layoutVisualValidators = {
  hero: {
    kicker: (value) => usefulText(value, 2),
    subtitle: (value) => usefulText(value, 6),
  },
  compare: {
    panels: usefulPanels,
  },
  spec: {
    specs: (value) => usefulPairList(value, 4),
  },
  cards: {
    cards: usefulCards,
  },
  flow: {
    nodes: (value) => usefulStringList(value, 4),
  },
  clock: {
    clock: (value) => usefulText(value, 2),
    note: (value) => usefulText(value, 8),
  },
  metrics: {
    metrics: (value) => usefulPairList(value, 4),
  },
  code: {
    code: (value) => usefulStringList(value, 4),
  },
  pipeline: {
    steps: (value) => usefulStringList(value, 4),
  },
  qa: {
    rows: (value) => usefulPairList(value, 3),
  },
  spectrum: {
    decision: (value) => usefulText(value, 10),
    scale: (value) => usefulStringList(value, 2),
  },
  clean: {
    frames: (value) => usefulPairList(value, 3),
  },
  render: {
    frames: (value) => usefulPairList(value, 3),
  },
  final: {
    route: (value) => usefulStringList(value, 4),
    stamp: (value) => usefulText(value, 3),
  },
  sources: {
    sources: (value) => Array.isArray(value) && value.length > 0,
  },
};

function mergeGenerationAudit(existing, next) {
  return {
    repairedFields: [
      ...new Set([...(existing?.repairedFields || []), ...(next?.repairedFields || [])].filter(Boolean)),
    ],
    genericFields: [...new Set([...(existing?.genericFields || []), ...(next?.genericFields || [])].filter(Boolean))],
  };
}

function generationAuditForScene(raw, layout, sources) {
  const audit = { repairedFields: [], genericFields: [] };
  const requireField = (field, validator) => {
    const value = raw?.[field];
    if (!validator(value)) audit.repairedFields.push(field);
    if (hasGenericVisualValue(value)) audit.genericFields.push(field);
  };

  if (layout === "sources") {
    return mergeGenerationAudit(raw?.generationAudit, audit);
  }

  requireField("layout", (value) => value === layout);
  requireField("title", (value) => usefulText(value, 4));
  requireField("mark", (value) => usefulText(value, 1));
  requireField("caption", (value) => usefulText(value, 4));
  requireField("claim", (value) => usefulText(value, 8));
  requireField("speech", (value) => usefulText(value, 45));
  requireField(
    "delivery",
    (value) =>
      value &&
      typeof value === "object" &&
      usefulText(value.role, 3) &&
      usefulText(value.tone, 4) &&
      usefulText(value.pace, 4) &&
      usefulText(value.energy, 4) &&
      usefulText(value.pause, 8) &&
      usefulText(value.instruction, 16),
  );
  if (Array.isArray(sources) && sources.length) {
    requireField("evidenceRefs", (value) => usefulEvidenceRefs(value, sources));
  }

  for (const [field, validator] of Object.entries(layoutVisualValidators[layout] || {})) {
    requireField(field, validator);
  }

  return mergeGenerationAudit(raw?.generationAudit, audit);
}

function sceneVisualQualitySummary(scenes) {
  const criticalGeneratedFields = new Set(["title", "caption", "claim", "speech", "delivery", "evidenceRefs"]);
  const repairedFields = [];
  const criticalRepairedFields = [];
  const missingVisualFields = [];
  const genericVisualFields = [];
  const duplicateVisualValues = [];
  const seenVisualValues = new Map();

  scenes.forEach((scene, index) => {
    const sceneLabel = `scene ${index + 1} ${scene.layout || "scene"}`;
    const audit = scene.generationAudit || {};
    if (audit.repairedFields?.length) {
      repairedFields.push(`${sceneLabel}: ${audit.repairedFields.slice(0, 8).join(", ")}`);
      const critical = audit.repairedFields.filter((field) => criticalGeneratedFields.has(field));
      if (critical.length) criticalRepairedFields.push(`${sceneLabel}: ${critical.join(", ")}`);
    }
    if (audit.genericFields?.length) {
      genericVisualFields.push(`${sceneLabel}: ${audit.genericFields.slice(0, 8).join(", ")}`);
    }

    for (const [field, validator] of Object.entries(layoutVisualValidators[scene.layout] || {})) {
      const value = scene[field];
      if (!validator(value)) missingVisualFields.push(`${sceneLabel}: ${field}`);
      if (hasGenericVisualValue(value)) genericVisualFields.push(`${sceneLabel}: ${field}`);
      for (const text of flattenStrings(value)) {
        if (isStructuralRepeatText(text)) continue;
        const compact = normalizeKeywordText(text).replace(/\s+/g, "");
        if (compact.length < 6 || isGenericVisualText(compact)) continue;
        const previous = seenVisualValues.get(compact);
        if (previous !== undefined && previous !== index) {
          duplicateVisualValues.push(`${sceneLabel}: repeated "${clipText(text, "", 28)}"`);
          break;
        }
        seenVisualValues.set(compact, index);
      }
    }
  });

  return {
    repairedFields: repairedFields.slice(0, 12),
    criticalRepairedFields: criticalRepairedFields.slice(0, 12),
    missingVisualFields: missingVisualFields.slice(0, 12),
    genericVisualFields: [...new Set(genericVisualFields)].slice(0, 12),
    duplicateVisualValues: duplicateVisualValues.slice(0, 12),
  };
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

  const generationAudit = generationAuditForScene(raw, layout, options.sources || []);
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
  const visualFallbacks = visualFallbacksFor(scene, topic, options.sources || [], index, sceneCount);

  if (layout === "hero") {
    scene.kicker = clipText(
      isGenericVisualText(raw?.kicker) ? "" : raw?.kicker,
      visualFallbacks.primary || shortTopicLabel(topic),
      32,
    ).toUpperCase();
    scene.subtitle = clipText(
      isGenericVisualText(raw?.subtitle) ? "" : raw?.subtitle,
      visualFallbacks.note || "핵심 흐름을 근거와 함께 따라간다",
      96,
    );
  }
  if (layout === "compare") scene.panels = normalizePanelList(raw?.panels, visualFallbacks.panels);
  if (layout === "spec") {
    scene.specs = arrayOfPairs(raw?.specs, visualFallbacks.specs);
  }
  if (layout === "cards") scene.cards = normalizeCards(raw?.cards, visualFallbacks.cards);
  if (layout === "flow") {
    scene.nodes = normalizeStringList(raw?.nodes, visualFallbacks.nodes);
    scene.activeNode = Number.isInteger(raw?.activeNode) ? Math.max(0, Math.min(4, raw.activeNode)) : 2;
  }
  if (layout === "clock") {
    scene.clock = clipText(isGenericVisualText(raw?.clock) ? "" : raw?.clock, visualFallbacks.clock, 16);
    scene.note = clipText(isGenericVisualText(raw?.note) ? "" : raw?.note, visualFallbacks.note, 72);
  }
  if (layout === "metrics") {
    scene.metrics = arrayOfPairs(raw?.metrics, visualFallbacks.metrics);
  }
  if (layout === "code") {
    scene.code = normalizeStringList(raw?.code, visualFallbacks.code, 5, 64);
  }
  if (layout === "pipeline") scene.steps = normalizeStringList(raw?.steps, visualFallbacks.steps);
  if (layout === "qa") {
    scene.rows = arrayOfPairs(raw?.rows, visualFallbacks.rows, 3);
  }
  if (layout === "spectrum") {
    scene.decision = clipText(isGenericVisualText(raw?.decision) ? "" : raw?.decision, visualFallbacks.decision, 96);
    scene.scale = normalizeStringList(
      raw?.scale,
      [visualFallbacks.nodes[0] || "기준", visualFallbacks.nodes[1] || "결론"],
      2,
      18,
    );
  }
  if (layout === "render") {
    scene.frames = arrayOfPairs(raw?.frames, visualFallbacks.frames, 3);
  }
  if (layout === "clean") {
    scene.frames = arrayOfPairs(raw?.frames, visualFallbacks.frames, 3);
  }
  if (layout === "final") {
    scene.route = normalizeStringList(raw?.route, visualFallbacks.route);
    scene.stamp = clipText(isGenericVisualText(raw?.stamp) ? "" : raw?.stamp, visualFallbacks.stamp, 32).toUpperCase();
  }
  if (layout === "sources") {
    scene.sources = Array.isArray(raw?.sources) ? raw.sources.slice(0, 5) : [];
  }
  if (generationAudit.repairedFields.length || generationAudit.genericFields.length) {
    scene.generationAudit = generationAudit;
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

function repairNarrationVariety(scenes, topic, topicType, sources, hasSources) {
  const topicLabel = shortTopicLabel(topic);
  return scenes.map((scene, index) => {
    if (scene.layout === "sources") return scene;
    const next = { ...scene };
    const source = sourceHintAt(sources, index);
    if (narrationLooksTemplated(next.speech)) {
      next.speech = fallbackSpeech(topicLabel, next.title, source, index, hasSources, topicType, next.layout);
    }
    if (/확인한 범위 안에서 설명한다|확인 가능한 자료|확인된 출처|source-aware/i.test(next.claim || "")) {
      next.claim = fallbackClaim(topicLabel, next.title, index, topicType);
    }
    return next;
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
      ) ||
      narrationLooksTemplated(scene.speech)
    ) {
      genericNarrationScenes += 1;
    }
  }

  const visualQuality = sceneVisualQualitySummary(scenes);
  if (visualQuality.criticalRepairedFields.length) {
    score -= Math.min(42, visualQuality.criticalRepairedFields.length * 10);
    issues.push(`Core generated fields are missing: ${visualQuality.criticalRepairedFields.slice(0, 3).join(" | ")}.`);
  }
  if (visualQuality.missingVisualFields.length) {
    score -= Math.min(36, visualQuality.missingVisualFields.length * 8);
    issues.push(`Layout visual fields are missing: ${visualQuality.missingVisualFields.slice(0, 3).join(" | ")}.`);
  }
  if (visualQuality.genericVisualFields.length) {
    score -= Math.min(32, visualQuality.genericVisualFields.length * 8);
    issues.push(`Generic/default visual fields remain: ${visualQuality.genericVisualFields.slice(0, 3).join(" | ")}.`);
  }
  if (visualQuality.duplicateVisualValues.length > 4) {
    score -= Math.min(12, visualQuality.duplicateVisualValues.length * 2);
    issues.push(
      `Repeated visual values are too common: ${visualQuality.duplicateVisualValues.slice(0, 3).join(" | ")}.`,
    );
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
  const speechJoined = scenes.map((scene) => scene.speech || "").join(" ");
  const overusedNarrationPhrases = templatedNarrationPatterns
    .map((pattern) => ({ label: pattern.source.replaceAll("\\", ""), regex: new RegExp(pattern.source, "g") }))
    .filter(({ regex }) => (speechJoined.match(regex) || []).length > 3)
    .map(({ label }) => label);
  if (overusedNarrationPhrases.length) {
    score -= 16;
    issues.push(`Narration repeats fallback phrases: ${overusedNarrationPhrases.slice(0, 3).join(", ")}.`);
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
      adjacentRepeats === 0 &&
      visualQuality.criticalRepairedFields.length === 0 &&
      visualQuality.missingVisualFields.length === 0 &&
      visualQuality.genericVisualFields.length === 0,
    issues: issues.slice(0, 8),
    sourceQuality,
    visualQuality,
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
  targetSeconds = sceneCount * pageSeconds,
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
  normalizedScenes = repairNarrationVariety(
    normalizedScenes,
    topic,
    topicTypeFor(topic, style),
    sourceList,
    sourceList.length > 0,
  );

  return {
    title: clipText(payload?.title, `${topic} 설명 영상`, 96),
    subtitle: clipText(payload?.subtitle, "주제와 출처를 기반으로 만든 HTML TTS 영상", 140),
    topic,
    style,
    targetSeconds,
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

const templatedNarrationPatterns = [
  /확인한 범위 안에서 설명한다/,
  /다음 장면/,
  /확인 기준/,
  /확인된 범위/,
  /관점에서 좁혀/,
  /하나의 주장으로 고정/,
  /확인된 단서와 해석/,
  /추측은 낮추고/,
  /기준으로 갈립니다/,
];

function narrationLooksTemplated(value) {
  const text = stripHtml(value || "");
  return templatedNarrationPatterns.some((pattern) => pattern.test(text));
}

function titleNarrationParts(title, topicLabel) {
  const clean = stripHtml(title).replace(/\s+/g, " ").trim();
  const [rawSubject, ...rest] = clean.split(/[:：]/);
  const subject = clipText(rawSubject || topicLabel, topicLabel, 20);
  const point = clipText(rest.join(":").trim() || clean.replace(subject, "").trim() || topicLabel, topicLabel, 52);
  return { subject, point };
}

function fallbackClaim(topicLabel, title, index, topicType = "evergreen-explainer") {
  const { subject, point } = titleNarrationParts(title, topicLabel);
  const claims = [
    `${subject}${josa(subject, "은", "는")} ${point}${josa(point, "을", "를")} 이해하는 출발점이다.`,
    `${point}${josa(point, "은", "는")} ${topicLabel}의 흐름을 실제 기록 문제로 바꿔 준다.`,
    `${subject}${josa(subject, "은", "는")} 신뢰가 만들어지는 위치를 보여 준다.`,
    `${point}${josa(point, "은", "는")} 장점보다 조건을 먼저 봐야 흔들리지 않는다.`,
    `${subject}${josa(subject, "에서", "에서")} 보이지 않던 비용과 한계가 드러난다.`,
    `${topicLabel}${josa(topicLabel, "은", "는")} ${subject}${josa(subject, "을", "를")} 지나며 더 구체적인 판단이 된다.`,
  ];
  if (topicType === "current-news") {
    claims.push(`${subject}${josa(subject, "은", "는")} 확인된 사실과 아직 빈칸인 정보를 나누는 장면이다.`);
  }
  return clipText(claims[index % claims.length], title, 150);
}

function fallbackSpeech(topicLabel, title, source, index, hasSources, _topicType = "evergreen-explainer", layout = "") {
  const { subject, point } = titleNarrationParts(title, topicLabel);
  const sourceName = source?.host || "";
  const fragment = sourceSpeechFragment(source);
  const sourceCue =
    source && index % 7 === 0
      ? `하단 출처의 ${sourceName}${josa(sourceName, "은", "는")} 이 설명이 벗어나지 않게 잡아 주는 배경입니다.`
      : source && index % 11 === 0 && fragment
        ? `문서 표현은 "${fragment}" 쪽에 가깝지만, 여기서는 초보자가 따라갈 수 있는 흐름으로 풀어 봅니다.`
        : "";
  const transitions = [
    `${subject}${josa(subject, "은", "는")} 이름보다 역할이 먼저입니다. ${point}${josa(point, "을", "를")} 실제 기록이 움직이는 장면으로 바꿔 보면 훨씬 덜 추상적으로 보입니다.`,
    `${point}${josa(point, "은", "는")} 갑자기 생기는 결론이 아닙니다. 누가 보고, 누가 받아들이고, 어떤 흔적이 남는지 순서대로 이어질 때 의미가 생깁니다.`,
    `${subject}${josa(subject, "을", "를")} 볼 때는 멋진 단어보다 실패 지점을 먼저 떠올리는 편이 낫습니다. 그래야 장점과 한계가 같은 화면 안에서 보입니다.`,
    `겉으로는 ${subject}${josa(subject, "이", "가")} 단순한 기능처럼 보입니다. 하지만 실제로는 기록을 바꾸기 어렵게 만드는 약속들이 여러 겹으로 쌓입니다.`,
    `${point}${josa(point, "은", "는")} 사용자가 직접 느끼기 어려운 부분입니다. 대신 결과가 늦어지거나 비용이 생기거나 되돌리기 어려운 순간에 드러납니다.`,
    `여기서는 ${subject}${josa(subject, "을", "를")} 믿는다고 말하지 않습니다. 어떤 조건에서 믿을 만해지고, 어디서 다시 사람의 판단이 필요한지를 나눠 봅니다.`,
    `${topicLabel}${josa(topicLabel, "은", "는")} 한 번에 이해되는 구조가 아닙니다. ${subject}${josa(subject, "을", "를")} 지나며 기록, 검증, 합의가 서로 다른 역할을 맡는다는 점이 보입니다.`,
    `${point}${josa(point, "을", "를")} 놓치면 블록체인은 그냥 어려운 장부처럼 들립니다. 이 장면에서는 그 장부가 왜 쉽게 고쳐지지 않는지에 집중합니다.`,
  ];
  if (/결론|정리/.test(title)) {
    return `정리하면 ${topicLabel}${josa(topicLabel, "은", "는")} 기술 이름이 아니라 기록을 신뢰하게 만드는 절차입니다. 강점은 투명성에 있고, 한계는 속도와 책임의 경계에서 다시 드러납니다.`;
  }
  const layoutClose =
    layout === "qa"
      ? " 그래서 질문은 더 많아지지만, 판단은 오히려 선명해집니다."
      : layout === "clock"
        ? " 시간 순서를 놓치지 않으면 왜 되돌리기 어려운지도 같이 보입니다."
        : "";
  const base = transitions[index % transitions.length];
  const caution = hasSources && !sourceCue && index % 6 === 3 ? " 사실처럼 들리는 비유는 여기서 한 번 멈춰 세웁니다." : "";
  return clipText(`${base}${layoutClose} ${sourceCue || caution}`.replace(/\s+/g, " ").trim(), base, 190);
}

const fallbackLayoutFlow = [
  "compare",
  "spec",
  "flow",
  "cards",
  "metrics",
  "qa",
  "pipeline",
  "clean",
  "clock",
  "render",
  "code",
];

const fallbackBeatPhrases = {
  "current-news": [
    "공식 확인과 해석을 먼저 분리한다",
    "사용자에게 바로 보이는 변화를 좁힌다",
    "기업과 개발자가 확인할 조건을 본다",
    "숫자로 말할 수 있는 범위만 남긴다",
    "아직 비어 있는 정보를 따로 둔다",
    "다음 발표에서 확인할 질문을 만든다",
  ],
  comparison: [
    "선택 기준을 먼저 고정한다",
    "장점이 실제 사용에서 바뀌는 지점을 본다",
    "제한이 드러나는 조건을 분리한다",
    "누구에게 맞는 선택인지 좁힌다",
    "예외 상황에서 결론이 흔들리는지 본다",
    "마지막 판단 기준을 한 문장으로 남긴다",
  ],
  tutorial: [
    "끝 상태를 먼저 고정한다",
    "준비 조건이 빠지면 막히는 지점을 본다",
    "첫 실행에서 확인할 신호를 정한다",
    "실패했을 때 돌아갈 기준을 남긴다",
    "검증 결과가 맞는지 다시 좁힌다",
    "다음 단계로 넘어갈 조건을 만든다",
  ],
  default: [
    "처음에 무엇이 바뀌는지 본다",
    "작은 단위가 전체 판단을 만드는 방식을 본다",
    "참여자가 맡는 역할을 나눈다",
    "검증이 필요한 순간을 고정한다",
    "연결이 다음 결과를 만드는 조건을 본다",
    "속도와 비용이 생기는 이유를 분리한다",
    "강점이 약점으로 바뀌는 조건을 찾는다",
    "실패하거나 공격받을 수 있는 지점을 본다",
    "사용자가 실제로 체감하는 변화를 좁힌다",
    "비유로 이해하면 맞는 부분을 남긴다",
    "비유가 틀리는 부분을 걷어낸다",
    "규칙 하나가 전체 신뢰로 커지는 과정을 본다",
    "숫자가 말해 주는 운영 현실을 분리한다",
    "큰 시스템으로 커질 때 생기는 병목을 본다",
    "누가 무엇을 확인할 수 있는지 나눈다",
    "확인하지 못하는 영역을 따로 둔다",
    "기술보다 중요한 경계 조건을 본다",
    "가장 흔한 오해를 한 번 끊는다",
    "현실에서 작동하려면 필요한 조건을 본다",
    "남는 한계와 다음 질문을 분리한다",
    "초보자가 기억할 한 문장을 만든다",
    "실제 사례로 돌아와 흐름을 다시 본다",
    "중요한 단어를 행동 흐름으로 바꾼다",
    "결론 전에 반대 질문을 먼저 세운다",
    "마지막 판단을 적용 범위 안에 묶는다",
    "다음 장면으로 넘길 핵심만 남긴다",
    "보이는 결과와 보이지 않는 처리를 나눈다",
    "작동 순서를 다시 이어 붙인다",
    "신뢰가 생기는 순간과 사라지는 순간을 비교한다",
    "끝까지 남는 현실적 제약을 확인한다",
  ],
};

function fallbackBeatPhrase(topicType, index) {
  const list =
    fallbackBeatPhrases[topicType] ||
    (["documentary-analysis", "story-case", "human-stakes", "evergreen-explainer"].includes(topicType)
      ? fallbackBeatPhrases.default
      : fallbackBeatPhrases.default);
  return list[index % list.length];
}

function fallbackPlanItem(topicLabel, variantTerms, topicType, index) {
  if (index === 0) return ["hero", `${topicLabel}: 실제 흐름으로 본다`, "실제 흐름"];
  const layout = fallbackLayoutFlow[(index - 1) % fallbackLayoutFlow.length];
  const term = variantTerms[(index - 1) % variantTerms.length] || topicLabel;
  const phrase = fallbackBeatPhrase(topicType, index - 1);
  const title = clipText(`${term}: ${phrase}`, `${topicLabel}: ${phrase}`, 72);
  const mark = title.includes(term) ? term : title.split(/\s+/)[0] || topicLabel;
  return [layout, title, mark];
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
      ["qa", "확실한 사실과 아직 모르는 부분을 나눈다", "불확실성"],
      ["pipeline", "근거에서 해석으로 한 단계씩 이동한다", "근거"],
      ["clean", "큰 변화는 사용자의 다음 행동으로 좁혀진다", "다음 행동"],
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
    ["hero", `${topicLabel}: 실제 흐름으로 본다`, "실제 흐름"],
    ["compare", "겉으로 보이는 모습과 내부 구조를 나눈다", "내부 구조"],
    ["spec", "가장 작은 단위가 전체 신뢰를 만든다", "작은 단위"],
    ["cards", "참여자, 기록, 검증이 서로 다른 역할을 맡는다", "세 역할"],
    ["flow", "하나의 사건은 다음 단계의 조건이 된다", "다음 단계"],
    ["metrics", "속도, 비용, 신뢰의 균형이 매번 바뀐다", "균형"],
    ["qa", "강점보다 먼저 깨질 수 있는 지점을 확인한다", "깨질 지점"],
    ["pipeline", "입력, 처리, 확인, 기록이 순서대로 이어진다", "순서"],
    ["clean", "복잡한 구조는 하나의 변화로 압축된다", "압축"],
    ["clock", "마지막에는 남는 질문과 한계가 드러난다", "한계"],
  ];
  const basePlan = planByType[topicType] || defaultPlan;
  const fallbackTermStopwords = new Set(["작동", "원리", "방법", "이유", "소개", "정리", "guide", "how"]);
  const variantTerms = topicKeywords(topic).filter((term) => !fallbackTermStopwords.has(term.toLowerCase()));
  const heroPlan = basePlan.find(([layout]) => layout === "hero") || [
    "hero",
    `${topicLabel}: 왜 지금 중요한가`,
    "왜 지금",
  ];
  const plan = Array.from({ length: Math.max(1, sceneCount - 1) }, (_, index) =>
    index === 0
      ? heroPlan
      : fallbackPlanItem(topicLabel, variantTerms.length ? variantTerms : [topicLabel], topicType, index),
  );
  plan[sceneCount - 2] = ["final", `${topicLabel}의 결론`, "결론"];
  const scenes = Array.from({ length: sceneCount }, (_, index) => {
    const [layout, baseTitle, baseMark] =
      index === sceneCount - 1 ? ["final", `${topicLabel}의 결론`, "결론"] : plan[index % plan.length];
    const title = baseTitle;
    const titleTerms = contentTermsFrom(`${title} ${topic}`, 6).filter((term) => title.includes(term));
    const mark =
      !isGenericVisualText(baseMark) && title.includes(baseMark)
        ? baseMark
        : titleTerms[0] || title.split(/\s+/)[0] || topicLabel;
    const source = sourceHintAt(sourceList, index);
    const sourceIds = sourceList.map((item, sourceIndex) => item.id || `S${sourceIndex + 1}`);
    const refs = sourceIds.length
      ? index >= sceneCount - 2
        ? sourceIds.slice(0, Math.min(2, sourceIds.length))
        : [sourceIds[index % sourceIds.length]]
      : [];
    const speech = fallbackSpeech(topicLabel, title, source, index, hasSources, topicType, layout);
    const role = deliveryRoleFor(layout, index);
    const delivery = normalizeDelivery(
      { role, ...(deliveryProfiles[role] || deliveryProfiles.context) },
      layout,
      index,
      sceneCount,
      style,
    );
    const claim = clipText(
      fallbackClaim(topicLabel, title, index, topicType),
      title,
      150,
    );
    const rawScene = {
      layout,
      title,
      mark,
      caption: `${title}.`,
      claim,
      evidenceRefs: refs,
      speech,
      delivery,
    };
    const visualFields = visualFieldsForLayout(
      layout,
      visualFallbacksFor({ ...rawScene, duration: 10 }, topic, sourceList, index, sceneCount),
    );
    return normalizeScene(
      {
        ...rawScene,
        ...visualFields,
      },
      index,
      sceneCount,
      topic,
      { style, sources: sourceList },
    );
  });
  return normalizeManifest(
    { title: `${topic} 설명 영상`, subtitle: "주제와 출처를 기반으로 만든 HTML TTS 영상", scenes },
    topic,
    sceneCount,
    style,
    research,
    sceneCount * pageSeconds,
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

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || min)));
}

function requestedRuntimeSeconds(text) {
  const source = String(text || "").toLowerCase();
  const minuteMatch =
    source.match(/(\d+(?:\.\d+)?)\s*(?:분짜리|분\s*정도|분)/i) ||
    source.match(/(\d+(?:\.\d+)?)\s*(?:minute|minutes|min)\b/i);
  if (minuteMatch) return Math.round(Number(minuteMatch[1]) * 60);
  const secondMatch = source.match(/(\d+(?:\.\d+)?)\s*(?:초|second|seconds|sec)\b/i);
  if (secondMatch) return Math.round(Number(secondMatch[1]));
  return 0;
}

function resolveVideoPlan({ topic, style, notes = "", research = {}, requestedSceneCount, requestedTargetSeconds }) {
  const combined = `${topic} ${notes}`.replace(/\s+/g, " ").trim();
  const explicitRuntime = requestedRuntimeSeconds(combined);
  const numericTarget = Number(requestedTargetSeconds);
  const runtime = explicitRuntime || (Number.isFinite(numericTarget) && numericTarget > 0 ? numericTarget : 0);
  const numericSceneCount = Number(requestedSceneCount);

  if (Number.isFinite(numericSceneCount) && numericSceneCount > 0) {
    const sceneCount = clampInteger(numericSceneCount, minSceneCount, maxSceneCount);
    return {
      sceneCount,
      targetSeconds: runtime
        ? clampInteger(runtime, sceneCount * 7, sceneCount * 14)
        : sceneCount * pageSeconds,
      lengthMode: "requested-scenes",
    };
  }

  if (runtime) {
    const sceneCount = clampInteger(runtime / pageSeconds, minSceneCount, maxSceneCount);
    return {
      sceneCount,
      targetSeconds: sceneCount * pageSeconds,
      lengthMode: "requested-runtime",
    };
  }

  const commaParts = combined.split(/[,，、·/]|그리고|또는|및|\s-\s/g).filter((part) => part.trim().length >= 2);
  let score = 0;
  score += Math.min(5, Math.floor(combined.length / 80));
  score += Math.min(6, Math.max(0, commaParts.length - 2));
  if (style === "documentary") score += 2;
  else if (["story", "emotional"].includes(style)) score += 1;
  if (research.required) score += 2;
  if ((research.sources || []).length >= 3) score += 1;
  if (/초보자|순서대로|원리|구조|과정|흐름|비교|한계|위험|리스크|왜|how|why|deep|detail/i.test(combined))
    score += 2;
  if (/간단|짧게|요약|핵심만|short|quick|brief/i.test(combined)) score -= 4;

  const sceneCount = clampInteger(11 + score, minSceneCount, 28);
  return {
    sceneCount,
    targetSeconds: sceneCount * pageSeconds,
    lengthMode: "content-fit",
  };
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
    `Target runtime: about ${targetSeconds} seconds`,
    "Length policy: choose only the amount of material the topic needs. Do not pad toward 5 minutes, do not add filler scenes, and do not stretch simple ideas.",
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
    "- Make it feel like a natural documentary video, not a PowerPoint deck. Think b-roll, lower-third context, slow camera movement, sparse screen text, and one visual focus point per scene.",
    "- Frontend aesthetic baseline: avoid generic AI-looking clutter; commit to one cohesive visual mood, contextual background depth, restrained typography, and one deliberate motion idea per scene.",
    "- Claude-style frontend direction: make frames feel like a designed editorial documentary, not a dashboard. Use warm editorial neutrals with terracotta, muted sage, and blue-gray accents; distinctive serif/sans pairing; sparse lower-thirds; subtle paper/film texture; no default Inter/Roboto look, purple-blue gradients, empty gray cards, or predictable SaaS component layouts.",
    "- Frame density gate: each scene may show only title, one short claim, one visual anchor, and one tiny lower-third. No scattered keyword clouds, card grids, or busy dashboard compositions.",
    "- Screen text must be extremely short: 2-8 words for the main overlay when possible. Put detail in narration, not on the frame.",
    "- Visual fields should describe subject objects, mechanisms, people, documents, signals, maps, interfaces, or physical metaphors from the topic. Do not write labels about the video-making system.",
    "- There are no static/default visuals. Every scene must generate its own topic-specific content, narration, and delivery.",
    "- Optional visual fields by layout: hero=kicker+subtitle; compare=panels; spec=specs; cards=cards; flow=nodes+activeNode; clock=clock+note; metrics=metrics; code=code; pipeline=steps; qa=rows; spectrum=decision+scale; clean/render=frames; final=route+stamp; sources=sources. Include them only when useful; otherwise the renderer derives visual micro-fields only from your scene claim/speech.",
    '- Never use production/system placeholder text as visual content: "audio duration", "scene json", "voice wav", "video export", "desktop 16:9", "tablet crop", "mobile stack", "10s", "300s", "SOURCE BACKED", or generic "DOCUMENTARY".',
    "- If sources exist, the final scene must be a sources scene and the second-to-last scene must be the conclusion.",
    '- Each non-source scene must include a concrete claim and evidenceRefs like ["S1"] or ["S1", "S2"].',
    "- Do not use weak sources for central claims. Weak/secondary sources can only provide context or wording checks.",
    "- If no primary or trusted source supports a claim, phrase it as uncertainty or remove it.",
    "- Do not repeat adjacent visual layouts.",
    "- Do not use generic repeated titles.",
    "- Avoid slide-deck language and production-system language. The viewer should feel they are watching a finished video, not a prompt, renderer demo, or presentation.",
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

  if (topic.length < 2) {
    json(res, 400, { error: "Missing topic." });
    return;
  }

  const research = await researchTopic(topic, style);
  const sources = normalizeSources(research.sources, topic);
  const sourceQuality = sourceQualitySummary(sources);
  const videoPlan = resolveVideoPlan({
    topic,
    style,
    notes,
    research: { ...research, sources, sourceQuality },
    requestedSceneCount: body.sceneCount,
    requestedTargetSeconds: body.targetSeconds,
  });
  const { sceneCount, targetSeconds } = videoPlan;
  const brief = {
    topic,
    style,
    topicType: topicTypeFor(topic, style),
    notes,
    sceneCount,
    targetSeconds,
    lengthMode: videoPlan.lengthMode,
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

function createSourceAwareSynthesis(topic, sceneCount, style, research, warning = "") {
  const manifest = fallbackManifest(topic, sceneCount, style, research);
  const quality = {
    ...scoreManifest(manifest, research),
    attempts: 0,
    maxAttempts: 0,
    reasoningEffort: "local-synthesis",
  };
  manifest.quality = quality;
  const warningText = /429|Too Many Requests/i.test(warning)
    ? "AI manifest route is rate-limited; source-aware local synthesis was used."
    : /timed out|timeout/i.test(warning)
      ? "AI manifest route timed out; source-aware local synthesis was used."
      : warning
        ? "AI manifest route failed; source-aware local synthesis was used."
        : "";
  return {
    manifest,
    response: {
      ...manifest,
      route: "source-aware-local-synthesis",
      warning: warningText,
    },
  };
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
  const videoPlan = resolveVideoPlan({
    topic,
    style,
    notes,
    research,
    requestedSceneCount: body.sceneCount,
    requestedTargetSeconds: body.targetSeconds,
  });
  const { sceneCount, targetSeconds } = videoPlan;
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
          targetSeconds,
          lengthMode: videoPlan.lengthMode,
          efforts: manifestReasoningEfforts,
          helper: "oauth-manifest-v22-adaptive-length",
        }),
      )
      .digest("hex");
    const cacheDir = join(root, ".cache/manifests");
    const requestPath = join(cacheDir, `${cacheKey}.request.json`);
    const manifestPath = join(cacheDir, `${cacheKey}.manifest.json`);
    await mkdir(cacheDir, { recursive: true });
    if (existsSync(manifestPath)) {
      const cached = normalizeManifest(
        JSON.parse(await readFile(manifestPath, "utf8")),
        topic,
        sceneCount,
        style,
        research,
        targetSeconds,
      );
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
            targetSeconds,
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
          const manifest = normalizeManifest(extractJson(stdout), topic, sceneCount, style, research, targetSeconds);
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
      if (!bestManifest) throw new Error("AI manifest did not return a usable candidate.");
      const manifest = bestManifest;
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
        const { manifest, response } = createSourceAwareSynthesis(topic, sceneCount, style, research, message);
        if (manifest.quality.passed) {
          json(res, 200, response);
        } else {
          json(
            res,
            /timed out/i.test(message) ? 504 : 502,
            manifestFailurePayload({
              error: /timed out/i.test(message)
                ? "AI manifest generation timed out and local synthesis failed quality checks."
                : "AI manifest generation failed and local synthesis failed quality checks.",
              route: /timed out/i.test(message) ? "manifest-timeout" : "manifest-generation-failed",
              warning: `${message} ${qualityFailureMessage(manifest.quality)}`,
              research,
              manifest,
            }),
          );
        }
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
    const { manifest, response } = createSourceAwareSynthesis(
      topic,
      sceneCount,
      style,
      research,
      "OpenAI OAuth helper is not available in this runtime.",
    );
    if (manifest.quality.passed) {
      json(res, 200, response);
    } else {
      json(
        res,
        503,
        manifestFailurePayload({
          error: "AI manifest generator is unavailable and local synthesis failed quality checks.",
          route: "manifest-unavailable",
          warning: qualityFailureMessage(manifest.quality),
          research,
          manifest,
        }),
      );
    }
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
