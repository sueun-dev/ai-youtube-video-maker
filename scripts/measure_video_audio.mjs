import { readFile } from "node:fs/promises";
import vm from "node:vm";

const rootUrl = process.env.APP_URL || "http://127.0.0.1:5173";
const voice = process.env.VOICE || "cedar";
const minimumSeconds = Number(process.env.MIN_VIDEO_SECONDS || 300);
const instructions =
  "Speak in natural Korean, like a calm technical narrator. Avoid a customer-service tone. Keep it confident, clear, and slightly documentary.";

function wavDurationSeconds(buffer) {
  if (buffer.subarray(0, 4).toString("ascii") !== "RIFF") {
    throw new Error("expected WAV response");
  }
  const sampleRate = buffer.readUInt32LE(24);
  const channels = buffer.readUInt16LE(22);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataBytes = buffer.length - 44;
  return dataBytes / (sampleRate * channels * (bitsPerSample / 8));
}

async function loadScenes() {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const end = source.indexOf("let sceneDurations");
  if (end === -1) throw new Error("could not find scene boundary in app.js");
  const sceneSource = source.slice(0, end);
  return vm.runInNewContext(`(() => { ${sceneSource}; return scenes; })()`, {});
}

async function main() {
  const scenes = await loadScenes();
  const rows = [];
  let total = 0;

  for (const [index, scene] of scenes.entries()) {
    const response = await fetch(`${rootUrl}/api/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: scene.speech, voice, instructions }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`scene ${index + 1} failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    const audio = Buffer.from(await response.arrayBuffer());
    const duration = wavDurationSeconds(audio);
    total += duration;
    rows.push({
      scene: index + 1,
      caption: scene.caption,
      durationSeconds: Number(duration.toFixed(2)),
      bytes: audio.length,
    });
  }

  console.table(rows);
  console.log(`total=${total.toFixed(2)}s (${Math.floor(total / 60)}m ${Math.round(total % 60)}s)`);
  if (total < minimumSeconds) {
    throw new Error(`measured runtime ${total.toFixed(2)}s is below ${minimumSeconds}s`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
