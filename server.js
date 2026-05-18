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
const manifestHelperTimeoutMs = Math.max(15000, Number(process.env.OPENAI_MANIFEST_TIMEOUT_MS) || 45000);
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
  const provider = ["google", "macos"].includes(String(body.provider || "").toLowerCase())
    ? String(body.provider).toLowerCase()
    : "openai";
  const openaiVoice = [...realtimeVoices, ...openaiApiVoices].includes(body.voice) ? body.voice : "cedar";
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

  const response = await fetch(googleTtsRequestUrl(), {
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
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

function stripHtml(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
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

async function verifySources(sources) {
  const checked = await Promise.all(sources.map((source) => verifySource(source)));
  const verified = checked.filter((source) => source.verified);
  return (verified.length ? verified : checked).slice(0, 5);
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
  const query = topic;
  const research = { required, query, sources: [], warnings: [] };
  if (!required) return research;

  try {
    const topicTokens = topic.split(/\s+/).filter(Boolean);
    const latinQuery = topicTokens
      .filter((token) => /[a-z0-9]/i.test(token))
      .slice(0, 4)
      .join(" ");
    const shortQuery = topicTokens.slice(0, 3).join(" ");
    const queries = [
      ...new Set(
        [topic, shortQuery, latinQuery, latinQuery ? `${latinQuery} official` : "", `${shortQuery} 공식 발표`].filter(
          (item) => item && item.length >= 3,
        ),
      ),
    ];
    const byUrl = new Map();
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
      if (byUrl.size >= 5) break;
    }
    const officialHostScore = (host) =>
      /openai\.com|platform\.openai\.com|model-spec\.openai\.com|blog\.google|android\.com|android-developers\.googleblog\.com|developers\.google\.com/.test(
        host,
      )
        ? 1
        : 0;
    const candidates = [...byUrl.values()]
      .sort((a, b) => officialHostScore(b.host) - officialHostScore(a.host))
      .slice(0, 5);
    research.sources = await verifySources(candidates);
    if (!research.sources.length) research.warnings.push("No search results parsed.");
    if (research.sources.some((source) => !source.verified))
      research.warnings.push("Some source URLs could not be verified as reachable.");
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
  const scene = {
    duration: 10,
    layout,
    title,
    mark,
    caption: cleanCaption(raw?.caption, `${title}.`) || `${title}.`,
    speech: clipText(
      raw?.speech,
      `${topic}에서 이 장면은 ${title}를 설명합니다. 화면의 핵심 문장과 음성이 같은 내용을 가리키도록 구성해서, 다음 장면으로 자연스럽게 이어지게 합니다.`,
      520,
    ),
  };
  scene.delivery = normalizeDelivery(raw?.delivery, layout, index, sceneCount, options.style);

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

function normalizeSources(value) {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  return list
    .map((source) => {
      const url = clipText(source?.url, "", 500);
      const host = clipText(source?.host || hostOf(url), "", 80);
      const title = clipText(source?.title, host || url || "source", 140);
      const snippet = clipText(source?.snippet, "", 240);
      const normalized = { title, url, host, snippet };
      if (source?.verified !== undefined) normalized.verified = Boolean(source.verified);
      if (source?.status !== undefined) normalized.status = Number(source.status) || 0;
      if (source?.checkedAt) normalized.checkedAt = clipText(source.checkedAt, "", 40);
      return normalized;
    })
    .filter((source) => source.url && source.host && !seen.has(source.url) && seen.add(source.url))
    .slice(0, 5);
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

function scoreManifest(manifest, research) {
  let score = 100;
  const issues = [];
  const scenes = Array.isArray(manifest.scenes) ? manifest.scenes : [];

  if (scenes.length !== manifest.sceneCount) {
    score -= 24;
    issues.push(`Scene count is ${scenes.length}, expected ${manifest.sceneCount}.`);
  }

  const sourceRequired = Boolean(research?.required);
  const sourceCount = Array.isArray(manifest.sources) ? manifest.sources.length : 0;
  if (sourceRequired && sourceCount === 0) {
    score -= 30;
    issues.push("Factual/current topic needs verified sources.");
  }
  if (sourceCount > 0 && scenes.at(-1)?.layout !== "sources") {
    score -= 24;
    issues.push("Sources must be the final scene.");
  }

  const layoutCounts = new Map();
  let adjacentRepeats = 0;
  let adjacentDeliveryRepeats = 0;
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

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score,
    passed: score >= 82 && (!sourceRequired || sourceCount > 0) && adjacentRepeats === 0,
    issues: issues.slice(0, 8),
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
  );
  const sourceIndex = sourceList.length ? sceneCount - 1 : undefined;
  const finalIndex = sourceList.length ? sceneCount - 2 : sceneCount - 1;
  const options = { sourceIndex, finalIndex, style };
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

function fallbackSpeech(topicLabel, title, source, index, hasSources) {
  const angles = [
    "사용자가 실제로 느낄 변화",
    "제품 구조가 바뀌는 지점",
    "출시와 지원 범위",
    "개인정보와 통제권",
    "개발자와 생태계 영향",
  ];
  const angle = angles[index % angles.length];
  if (/결론|정리/.test(title)) {
    return `정리하면 ${topicLabel}은 단순 기능 추가가 아니라 플랫폼 방향 변화입니다. 마지막 판단은 출처와 출시 범위를 기준으로 둡니다.`;
  }
  if (source) {
    const snippet = clipText(source.snippet, "", 86);
    if (snippet) {
      return `${title} 장면은 ${source.host}의 확인된 내용에서 출발합니다. ${snippet} 이 근거를 화면의 한 문장과 연결해 다음 질문으로 넘깁니다.`;
    }
    return `이 장면에서는 ${topicLabel}을 ${angle} 관점에서 봅니다. ${source.host} 기준으로 확인된 변화와 해석을 분리합니다.`;
  }
  const sourceLine = hasSources ? "확인된 출처와 맞지 않는 추측은 빼고," : "최신 사실처럼 보이는 단정은 피하고,";
  return `이 장면에서는 ${topicLabel}을 ${angle} 관점에서 봅니다. ${sourceLine} 한 가지 질문만 다음 장면으로 넘깁니다.`;
}

function fallbackManifest(topic, sceneCount = 30, style = "explainer", research = { required: false, sources: [] }) {
  const topicLabel = shortTopicLabel(topic);
  const sourceList = normalizeSources(research.sources);
  const hasSources = sourceList.length > 0;
  const plan = [
    ["hero", `${topicLabel}의 핵심 변화`, topicLabel.split(/\s+/)[0] || topicLabel],
    ["compare", "단순 업데이트인지 플랫폼 전환인지 가른다", "플랫폼 전환"],
    ["spec", "공식 출처를 먼저 기준으로 둔다", "공식 출처"],
    ["cards", "변화는 경험, 기기, 개발자 흐름으로 나뉜다", "세 갈래"],
    ["flow", "기능 발표에서 사용 장면으로 이동한다", "사용 장면"],
    ["metrics", "확인된 일정과 적용 범위를 분리한다", "적용 범위"],
    ["code", "AI 기능은 화면보다 조건이 중요하다", "조건"],
    ["qa", "과장된 해석은 실패 조건으로 둔다", "실패 조건"],
    ["pipeline", "출처에서 장면까지 한 방향으로 만든다", "출처"],
    ["clean", "화면은 한 주장만 보여준다", "한 주장"],
    ["clock", "도입 뒤에는 긴장감을 남긴다", "긴장감"],
    ["compare", "사용자에게 보이는 변화와 내부 변화를 나눈다", "보이는 변화"],
    ["spec", "개인정보와 온디바이스 경계를 따로 본다", "경계"],
    ["cards", "새 기능은 맥락, 행동, 제한으로 설명한다", "제한"],
    ["flow", "전화기에서 자동차와 노트북까지 흐름을 넓힌다", "흐름"],
    ["metrics", "지원 기기와 출시 시점은 숫자로 고정한다", "숫자"],
    ["qa", "출처가 약한 주장은 화면에서 낮춘다", "낮춘다"],
    ["pipeline", "내레이션은 근거 다음에 해석을 붙인다", "근거"],
    ["clean", "긴 설명은 음성으로 보내고 화면은 줄인다", "줄인다"],
    ["render", "장면 변화는 10초 단위로 유지한다", "10초"],
    ["compare", "편리함과 통제권을 같이 놓고 본다", "통제권"],
    ["spec", "개발자 관점의 변화도 한 장면으로 분리한다", "개발자"],
    ["cards", "시청자가 기억할 세 문장을 만든다", "세 문장"],
    ["flow", "마지막 전에는 왜 중요한지 다시 묶는다", "다시 묶는다"],
    ["metrics", "볼만한 영상은 길이와 밀도를 함께 맞춘다", "밀도"],
    ["qa", "마지막 검수는 출처와 말의 일치다", "일치"],
    ["pipeline", "생성 실패 시에도 템플릿은 멈추지 않는다", "멈추지 않는다"],
    ["clean", "정리는 짧게, 출처는 분명하게 둔다", "분명하게"],
    ["final", `${topicLabel}의 결론`, "결론"],
  ];
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
        speech: fallbackSpeech(topicLabel, title, source, index, hasSources),
      },
      index,
      sceneCount,
      topic,
      { style },
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

function buildGenerationPrompt({ topic, style, notes, sceneCount, targetSeconds, research }) {
  const sources = normalizeSources(research.sources);
  const sourceText = sources.length
    ? sources.map((source, index) => `${index + 1}. ${source.title} (${source.host}) ${source.url}`).join("\n")
    : "No verified sources yet. Avoid current/factual claims unless the user provides evidence.";
  const noteText = notes || "No extra user notes yet.";
  return [
    "Create a Korean HTML + OAuth TTS video manifest.",
    "",
    `Topic: ${topic}`,
    `Template: ${style}`,
    `Style guidance: ${styleGuidanceFor(style)}`,
    `Scene count: exactly ${sceneCount}`,
    `Minimum runtime: ${targetSeconds} seconds`,
    "Rhythm: about 10 seconds per page, one idea per page, one fixed voice per full version.",
    "",
    "User discussion notes:",
    noteText,
    "",
    "Verified sources:",
    sourceText,
    "",
    "Hard rules:",
    "- Show short screen text; put detail in narration.",
    "- If sources exist, the final scene must be a sources scene and the second-to-last scene must be the conclusion.",
    "- Do not repeat adjacent visual layouts.",
    "- Do not use generic repeated titles.",
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

  const topic = String(body.topic || "")
    .replace(/\s+/g, " ")
    .trim();
  const style = normalizeStyle(body.style);
  const notes = clipText(body.notes, "", 1200);
  const sceneCount = Math.max(20, Math.min(36, Number(body.sceneCount) || 30));
  const targetSeconds = Math.max(300, Number(body.targetSeconds) || 300);

  if (topic.length < 2) {
    json(res, 400, { error: "Missing topic." });
    return;
  }

  const research = await researchTopic(topic, style);
  const sources = normalizeSources(research.sources);
  const brief = {
    topic,
    style,
    notes,
    sceneCount,
    targetSeconds,
    research: { ...research, sources },
    sources,
    prompts: {
      generation: buildGenerationPrompt({
        topic,
        style,
        notes,
        sceneCount,
        targetSeconds,
        research: { ...research, sources },
      }),
      voice: buildVoicePrompt(style),
    },
    discussionQuestions: buildDiscussionQuestions(style, research),
    route: "local-topic-brief",
  };
  json(res, 200, brief);
}

async function createManifest(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    json(res, 400, { error: error.message });
    return;
  }

  const topic = String(body.topic || "")
    .replace(/\s+/g, " ")
    .trim();
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
      .update(JSON.stringify({ topic, sceneCount, style, notesHash, researchHash, helper: "oauth-manifest-v10-xhigh" }))
      .digest("hex");
    const cacheDir = join(root, ".cache/manifests");
    const requestPath = join(cacheDir, `${cacheKey}.request.json`);
    const manifestPath = join(cacheDir, `${cacheKey}.manifest.json`);
    await mkdir(cacheDir, { recursive: true });
    if (existsSync(manifestPath)) {
      const cached = JSON.parse(await readFile(manifestPath, "utf8"));
      json(res, 200, { ...cached, route: "codex-oauth-text-cache" });
      return;
    }
    try {
      let bestManifest = null;
      let critique = "";
      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
          }),
        );
        const { stdout } = await runProcess(oauthPython, [oauthManifestHelper, requestPath], {
          cwd: oauthRoot,
          env: { ...process.env, PYTHONPATH: `${oauthRoot}/src` },
          timeoutMs: manifestHelperTimeoutMs,
        });
        const manifest = normalizeManifest(extractJson(stdout), topic, sceneCount, style, research);
        const quality = scoreManifest(manifest, research);
        manifest.quality = { ...quality, attempts: attempt, maxAttempts };
        if (!bestManifest || quality.score > bestManifest.quality.score) bestManifest = manifest;
        if (quality.passed) break;
        critique = quality.issues.join(" ");
      }
      const manifest = bestManifest || fallbackManifest(topic, sceneCount, style, research);
      if (!manifest.quality) manifest.quality = { ...scoreManifest(manifest, research), attempts: 0, maxAttempts: 2 };
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      json(res, 200, { ...manifest, route: "codex-oauth-text" });
      return;
    } catch (error) {
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
