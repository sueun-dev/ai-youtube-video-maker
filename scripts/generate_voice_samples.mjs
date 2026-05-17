import { mkdir, writeFile } from "node:fs/promises";

const rootUrl = process.env.APP_URL || "http://127.0.0.1:5173";
const outDir = new URL("../voice-samples/", import.meta.url);
const sampleText =
  "이 문장은 목소리 비교용 샘플입니다. 같은 원고를 열 개의 목소리로 생성해서, 설명형 HTML 영상에 가장 자연스럽게 맞는 톤을 고릅니다.";

const instructions =
  "Speak in natural Korean, like a calm technical narrator. Keep it clear, steady, and not rushed. Do not sound like a customer-service greeting.";

async function main() {
  await mkdir(outDir, { recursive: true });

  const statusResponse = await fetch(`${rootUrl}/api/status`, { cache: "no-store" });
  if (!statusResponse.ok) throw new Error(`status failed: ${statusResponse.status}`);
  const status = await statusResponse.json();
  const voices = Array.isArray(status.voices) ? status.voices.slice(0, 10) : [];
  if (voices.length !== 10) throw new Error(`expected 10 voices, got ${voices.length}`);

  const generated = [];
  for (const [index, voice] of voices.entries()) {
    const response = await fetch(`${rootUrl}/api/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: sampleText, voice, instructions }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${voice} failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    const filename = `${String(index + 1).padStart(2, "0")}-${voice}.wav`;
    await writeFile(new URL(filename, outDir), audio);
    generated.push({
      index: index + 1,
      voice,
      file: `voice-samples/${filename}`,
      bytes: audio.length,
      model: response.headers.get("x-tts-model") || status.model,
      route: response.headers.get("x-tts-route") || status.provider,
    });
    console.log(`${voice}: ${audio.length} bytes`);
  }

  await writeFile(
    new URL("manifest.json", outDir),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        rootUrl,
        provider: status.provider,
        model: status.model,
        sampleText,
        voices: generated,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
