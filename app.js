const scenes = [];
let activeVisualTheme = "claude";

const PAGE_SECONDS = 10;
const CINEMATIC_THEME_IDS = new Set(["claude", "cinematic", "studio", "blueprint", "minimal"]);
const CINEMA_BLOCKED_TERMS = [
  /audio duration/gi,
  /scene transition/gi,
  /scene json/gi,
  /voice wav/gi,
  /video export/gi,
  /desktop 16:9/gi,
  /tablet crop/gi,
  /mobile stack/gi,
  /source backed/gi,
  /renderer/gi,
  /template/gi,
  /HTML/gi,
  /TTS/gi,
  /렌더러/g,
  /제작\s*시스템/g,
  /장면\s*전환/g,
  /동영상\s*화면/g,
  /페이지/g,
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTitle(scene) {
  const title = escapeHtml(scene.title);
  const mark = escapeHtml(scene.mark);
  if (!mark || !title.includes(mark)) return title;
  return title.replace(mark, `<mark>${mark}</mark>`);
}

function renderCards(cards = []) {
  return `
    <div class="repo-row">
      ${cards
        .map(
          ([icon, title, body]) => `
            <article>
              <span class="repo-icon">${escapeHtml(icon)}</span>
              <strong>${escapeHtml(title)}</strong>
              <small>${escapeHtml(body)}</small>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function flattenSceneValues(value) {
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => flattenSceneValues(item));
  if (value && typeof value === "object") return Object.values(value).flatMap((item) => flattenSceneValues(item));
  return [];
}

function cleanCinemaText(value, max = 42) {
  return CINEMA_BLOCKED_TERMS.reduce((text, pattern) => text.replace(pattern, " "), String(value || ""))
    .replace(/[{}:[\]",]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cinemaTerms(scene, max = 7) {
  const stopwords = new Set([
    "scene",
    "source",
    "video",
    "voice",
    "html",
    "tts",
    "renderer",
    "template",
    "topic",
    "영상",
    "화면",
    "장면",
    "제작",
    "시스템",
    "프롬프트",
    "렌더러",
    "페이지",
    "음성",
    "목소리",
    "전환",
    "핵심",
    "근거",
    "의미",
    "주장",
    "다음",
    "관점",
    "설명",
    "확인",
  ]);
  const rawValues = flattenSceneValues([
    scene?.mark,
    scene?.title,
    scene?.claim,
    scene?.caption,
    scene?.subtitle,
    scene?.panels,
    scene?.specs,
    scene?.cards,
    scene?.nodes,
    scene?.metrics,
    scene?.steps,
    scene?.rows,
    scene?.frames,
    scene?.route,
    scene?.decision,
    scene?.stamp,
  ]);
  const terms = rawValues
    .flatMap((value) => cleanCinemaText(value, 56).split(/[\s·:—|/]+/))
    .map((value) => value.replace(/^[^0-9a-z가-힣]+|[^0-9a-z가-힣]+$/gi, ""))
    .filter((value) => value.length >= 2 && value.length <= 16 && !stopwords.has(value.toLowerCase()))
    .filter((value) => !/^S\d+$/i.test(value) && !/^(org|com|kr|io|net)$/i.test(value));
  return [...new Set(terms)].slice(0, max);
}

function isCinematicTheme() {
  return CINEMATIC_THEME_IDS.has(activeVisualTheme);
}

function evidenceLabel(scene) {
  const refs = evidenceRefsForScene(scene);
  if (!refs.length) return "";
  return refs
    .map((ref) => {
      const source = sourceById(ref);
      return source ? `${ref} · ${source.host}` : ref;
    })
    .slice(0, 2)
    .join(" / ");
}

function cinemaCaption(scene, max = 54) {
  return cleanCinemaText(scene.caption || scene.claim || scene.title, max);
}

function renderCinematicVisual(scene, terms) {
  if (scene.layout === "sources") {
    const sources = normalizeSourceItems(scene.sources);
    return `
      <div class="cinema-documents">
        ${sources
          .slice(0, 4)
          .map(
            (source) => `
              <article>
                <b>${escapeHtml(source.id)}</b>
                <span>${escapeHtml(source.title)}</span>
                <small>${escapeHtml(source.host)}</small>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }

  if (["flow", "pipeline", "final"].includes(scene.layout)) {
    const items =
      (scene.layout === "flow" ? scene.nodes : scene.layout === "pipeline" ? scene.steps : scene.route) || terms;
    return `
      <div class="cinema-trace">
        ${items
          .slice(0, 3)
          .map(
            (item, index) => `
              <span class="${index === (scene.activeNode ?? 2) || scene.layout === "final" ? "active" : ""}">
                <i></i><em>${escapeHtml(cleanCinemaText(item, 28))}</em>
              </span>
            `,
          )
          .join("")}
      </div>
    `;
  }

  if (scene.layout === "clock") {
    return `
      <div class="cinema-timecut">
        <b>${escapeHtml(cleanCinemaText(scene.clock || terms[0] || scene.mark, 12))}</b>
        <span>${escapeHtml(cleanCinemaText(scene.note || scene.claim || scene.caption, 48))}</span>
        <i></i>
      </div>
    `;
  }

  if (scene.layout === "compare") {
    const panels = Array.isArray(scene.panels) ? scene.panels.slice(0, 2) : [];
    return `
      <div class="cinema-split">
        ${panels
          .slice(0, 2)
          .map(
            (panel) => `
              <section>
                <b>${escapeHtml(cleanCinemaText(panel.title, 24))}</b>
              </section>
            `,
          )
          .join("")}
      </div>
    `;
  }

  if (scene.layout === "spec" || scene.layout === "metrics") {
    const pairs = Array.isArray(scene.layout === "spec" ? scene.specs : scene.metrics)
      ? (scene.layout === "spec" ? scene.specs : scene.metrics).slice(0, 3)
      : terms.slice(0, 3).map((term, index) => [`0${index + 1}`, term]);
    return `
      <div class="cinema-statline">
        ${pairs
          .map(
            ([label, value]) => `
              <span>
                <b>${escapeHtml(cleanCinemaText(label, 16))}</b>
                <em>${escapeHtml(cleanCinemaText(value, 30))}</em>
              </span>
            `,
          )
          .join("")}
      </div>
    `;
  }

  if (["cards", "clean", "render"].includes(scene.layout)) {
    const items = Array.isArray(scene.layout === "cards" ? scene.cards : scene.frames)
      ? (scene.layout === "cards" ? scene.cards : scene.frames).slice(0, 3)
      : terms.slice(0, 3).map((term, index) => [String(index + 1), term, ""]);
    return `
      <div class="cinema-notes">
        ${items
          .map((item, index) => {
            const label = Array.isArray(item) ? item[0] : String(index + 1);
            const head = Array.isArray(item) ? item[1] : item;
            const body = Array.isArray(item) ? item[2] : "";
            return `
              <article>
                <b>${escapeHtml(cleanCinemaText(label, 10))}</b>
                <span>${escapeHtml(cleanCinemaText(head, 24))}</span>
                ${body ? `<small>${escapeHtml(cleanCinemaText(body, 34))}</small>` : ""}
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  if (scene.layout === "qa") {
    const rows = Array.isArray(scene.rows) ? scene.rows.slice(0, 3) : terms.slice(0, 3).map((term) => [term, "check"]);
    return `
      <div class="cinema-questions">
        ${rows
          .map(
            ([check, result]) => `
              <span>
                <b>${escapeHtml(cleanCinemaText(check, 30))}</b>
                <em>${escapeHtml(cleanCinemaText(result, 20))}</em>
              </span>
            `,
          )
          .join("")}
      </div>
    `;
  }

  if (scene.layout === "spectrum") {
    return `
      <div class="cinema-spectrum">
        <span>${escapeHtml(cleanCinemaText(scene.decision || scene.claim || terms[0], 42))}</span>
        <i></i>
        <small>${escapeHtml(cleanCinemaText(scene.scale || scene.caption || terms.slice(0, 3).join(" · "), 48))}</small>
      </div>
    `;
  }

  if (scene.layout === "code") {
    return `<div class="cinema-terminal">${(scene.code || terms)
      .slice(0, 2)
      .map((line) => `<span>${escapeHtml(cleanCinemaText(line, 46))}</span>`)
      .join("")}</div>`;
  }

  const lead = terms[0] || scene.mark || scene.title;
  return `
    <div class="cinema-field">
      <b>${escapeHtml(cleanCinemaText(lead, 18))}</b>
      <i></i>
    </div>
  `;
}

function renderCinematicSceneBody(scene) {
  const terms = cinemaTerms(scene);
  const focus = scene.mark || terms[0] || scene.title;
  const source = evidenceLabel(scene);
  const claim = scene.claim || scene.subtitle || scene.caption || scene.speech;
  const kicker = scene.layout === "hero" ? scene.kicker || currentManifest.title || "OPENING" : scene.layout || "scene";
  return `
    <div class="cinema-scene cinema-${escapeHtml(scene.layout || "scene")}">
      <div class="cinema-backdrop" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="cinema-copy">
        <span class="cinema-kicker">${escapeHtml(cleanCinemaText(kicker, 30))}</span>
        ${scene.layout === "hero" ? `<h1>${renderTitle(scene)}</h1>` : `<h2>${renderTitle(scene)}</h2>`}
        <p>${escapeHtml(cleanCinemaText(claim, scene.layout === "hero" ? 58 : 72))}</p>
      </div>
      <div class="cinema-focus" aria-hidden="true">${escapeHtml(cleanCinemaText(focus, 12))}</div>
      <div class="cinema-visual">${renderCinematicVisual(scene, terms)}</div>
      <div class="cinema-lower">
        <span>${escapeHtml(source || scene.layout || "scene")}</span>
        <b>${escapeHtml(cinemaCaption(scene))}</b>
      </div>
    </div>
  `;
}

function normalizeSourceItems(sources = []) {
  const hostFor = (source) => {
    if (source.host) return source.host;
    try {
      return new URL(source.url || "https://example.com").host;
    } catch {
      return "source";
    }
  };
  return Array.isArray(sources)
    ? sources
        .filter((source) => source && (source.title || source.url || source.host))
        .slice(0, 5)
        .map((source, index) => ({
          id: source.id || `S${index + 1}`,
          title: source.title || source.host || source.url || "source",
          host: hostFor(source),
          url: source.url || "",
          reliability: Number(source.reliability) || 0,
          tier: source.tier || "secondary",
          reason: source.reason || "",
        }))
    : [];
}

function sourceById(id) {
  const normalized = String(id || "").toUpperCase();
  const sources = normalizeSourceItems(currentManifest.sources || []);
  return sources.find((source) => String(source.id || "").toUpperCase() === normalized) || null;
}

function evidenceRefsForScene(scene) {
  return Array.isArray(scene?.evidenceRefs)
    ? scene.evidenceRefs
        .map((ref) => String(ref).toUpperCase())
        .filter(Boolean)
        .slice(0, 3)
    : [];
}

function renderEvidenceLine(scene) {
  const refs = evidenceRefsForScene(scene);
  if (!refs.length) return "";
  const labels = refs.map((ref) => {
    const source = sourceById(ref);
    return source ? `${ref} ${source.host}` : ref;
  });
  return `<div class="script-evidence"><b>Evidence</b><span>${escapeHtml(labels.join(" · "))}</span></div>`;
}

function renderSceneBody(scene) {
  if (isCinematicTheme()) return renderCinematicSceneBody(scene);
  const title = `<h2>${renderTitle(scene)}</h2>`;
  if (scene.layout === "hero") {
    return `
      <div class="title-lockup">
        <span class="eyebrow">${escapeHtml(scene.kicker)}</span>
        <h1>${renderTitle(scene)}</h1>
        <p>${escapeHtml(scene.subtitle)}</p>
      </div>
    `;
  }
  if (scene.layout === "compare") {
    return `
      ${title}
      <div class="split-board">
        ${(scene.panels || [])
          .map(
            (panel) => `
              <div class="board-item ${panel.tone === "hot" ? "hot" : "muted"}">
                <b>${escapeHtml(panel.title)}</b>
                ${(panel.lines || []).map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }
  if (scene.layout === "spec") {
    return `
      ${title}
      <div class="spec-grid">
        ${(scene.specs || [])
          .map(([key, value]) => `<article><span>${escapeHtml(key)}</span><b>${escapeHtml(value)}</b></article>`)
          .join("")}
      </div>
    `;
  }
  if (scene.layout === "cards") return `${title}${renderCards(scene.cards)}`;
  if (scene.layout === "flow") {
    return `
      ${title}
      <div class="signal-map">
        ${(scene.nodes || [])
          .map(
            (node, index) => `
              <span class="node ${index === 0 ? "start" : ""} ${index === scene.activeNode ? "active-node" : ""} ${
                index === (scene.nodes || []).length - 1 ? "end" : ""
              }">${escapeHtml(node)}</span>
            `,
          )
          .join("")}
        <i></i><i></i><i></i><i></i>
      </div>
    `;
  }
  if (scene.layout === "clock") {
    return `
      ${title}
      <div class="clock-panel">
        <div class="clock-face"><i></i><b>${escapeHtml(scene.clock)}</b></div>
        <div class="wave-bars" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <p>${escapeHtml(scene.note)}</p>
      </div>
    `;
  }
  if (scene.layout === "metrics") {
    return `
      ${title}
      <div class="metric-grid">
        ${(scene.metrics || [])
          .map(
            ([label, value], index) =>
              `<div class="${index === 1 ? "selected" : ""}"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`,
          )
          .join("")}
      </div>
    `;
  }
  if (scene.layout === "code") {
    return `${title}<div class="code-board">${(scene.code || []).map((line) => `<span>${escapeHtml(line)}</span>`).join("")}</div>`;
  }
  if (scene.layout === "pipeline") {
    return `${title}<div class="pipeline">${(scene.steps || []).map((step) => `<span>${escapeHtml(step)}</span>`).join("")}</div>`;
  }
  if (scene.layout === "qa") {
    return `
      ${title}
      <div class="qa-table">
        <div><b>Check</b><b>Action</b></div>
        ${(scene.rows || []).map(([check, action]) => `<div><span>${escapeHtml(check)}</span><span>${escapeHtml(action)}</span></div>`).join("")}
      </div>
    `;
  }
  if (scene.layout === "spectrum") {
    const scale = scene.scale?.length ? scene.scale : ["기준", "결론"];
    return `
      ${title}
      <div class="spectrum"><span>${escapeHtml(scale[0])}</span><div class="bar"><i></i></div><span>${escapeHtml(scale[1] || scale[0])}</span></div>
      <div class="decision-card"><b>${escapeHtml(scene.mark || "판단")}</b><p>${escapeHtml(scene.decision)}</p></div>
    `;
  }
  if (scene.layout === "clean") {
    return `
      ${title}
      <div class="frame-stack">
        ${(scene.frames || []).map(([head, body]) => `<article><b>${escapeHtml(head)}</b><span>${escapeHtml(body)}</span></article>`).join("")}
      </div>
    `;
  }
  if (scene.layout === "render") {
    const frames = Array.isArray(scene.frames) ? scene.frames : [];
    return `
      ${title}
      <div class="viewport-wall">
        ${frames
          .slice(0, 3)
          .map(
            ([head, body], index) =>
              `<div class="viewport ${index === 0 ? "desktop" : index === 1 ? "tablet" : "phone"}"><span>${escapeHtml(head)}</span><b>${escapeHtml(body)}</b></div>`,
          )
          .join("")}
      </div>
    `;
  }
  if (scene.layout === "sources") {
    const sources = normalizeSourceItems(scene.sources);
    return `
      ${title}
      <div class="source-list">
        ${sources
          .map(
            (source, index) => `
              <article>
                <b>${escapeHtml(source.id || String(index + 1))}</b>
                <span>${escapeHtml(source.title)}</span>
                <small>${escapeHtml(`${source.host} · ${source.tier} ${source.reliability || "?"}/100`)}</small>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }
  if (scene.layout === "final") {
    return `
      ${title}
      <div class="route-line">${(scene.route || []).map((step) => `<span>${escapeHtml(step)}</span>`).join("")}</div>
      <div class="final-stamp">${escapeHtml(scene.stamp)}</div>
    `;
  }
  return title;
}

function renderSceneDeck() {
  document.querySelectorAll(".scene").forEach((sceneEl) => sceneEl.remove());
  const captionNode = document.querySelector("#caption");
  const emptyStage = document.querySelector("#emptyStage");
  if (emptyStage) emptyStage.hidden = scenes.length > 0;
  if (!captionNode || scenes.length === 0) return;
  captionNode.insertAdjacentHTML(
    "beforebegin",
    scenes
      .map(
        (scene, index) => `
          <div class="scene scene-${escapeHtml(scene.layout)} ${index === 0 ? "active" : ""}" data-scene="${index}">
            ${renderSceneBody(scene)}
          </div>
        `,
      )
      .join(""),
  );
}

let sceneDurations = scenes.map((scene) => scene.duration || PAGE_SECONDS);
let sceneStarts = [];
let totalDuration = 0;

function rebuildTimeline() {
  totalDuration = 0;
  sceneStarts = sceneDurations.map((duration) => {
    const start = totalDuration;
    totalDuration += duration;
    return start;
  });
}

function updateSceneDuration(index, rawDuration) {
  if (!Number.isInteger(index) || index < 0 || index >= sceneDurations.length) return;
  if (!Number.isFinite(rawDuration) || rawDuration <= 0) return;
  const syncedDuration = Math.max(PAGE_SECONDS, Math.ceil((rawDuration + 0.35) * 10) / 10);
  if (Math.abs(sceneDurations[index] - syncedDuration) < 0.05) return;
  sceneDurations[index] = syncedDuration;
  rebuildTimeline();
  renderScriptList();
  updateView({ suppressSpeech: true });
}

rebuildTimeline();

const appShell = document.querySelector(".app-shell");
renderSceneDeck();
let sceneEls = [...document.querySelectorAll(".scene")];
const captionEl = document.querySelector("#caption");
const timecodeEl = document.querySelector("#timecode");
const progressEl = document.querySelector("#stageProgress");
const playBtn = document.querySelector("#playBtn");
const playIcon = document.querySelector("#playIcon");
const prevSceneBtn = document.querySelector("#prevSceneBtn");
const nextSceneBtn = document.querySelector("#nextSceneBtn");
const sceneCounter = document.querySelector("#sceneCounter");
const restartBtn = document.querySelector("#restartBtn");
const muteBtn = document.querySelector("#muteBtn");
const cleanBtn = document.querySelector("#cleanBtn");
const generatorForm = document.querySelector("#generatorForm");
const topicInput = document.querySelector("#topicInput");
const topicNotes = document.querySelector("#topicNotes");
const builderVoiceSelect = document.querySelector("#builderVoiceSelect");
const styleSelect = document.querySelector("#styleSelect");
const visualThemeSelect = document.querySelector("#visualThemeSelect");
const prepareBtn = document.querySelector("#prepareBtn");
const generateBtn = document.querySelector("#generateBtn");
const buildStatus = document.querySelector("#buildStatus");
const briefPanel = document.querySelector("#briefPanel");
const briefTitle = document.querySelector("#briefTitle");
const briefRoute = document.querySelector("#briefRoute");
const promptPreview = document.querySelector("#promptPreview");
const voicePromptPreview = document.querySelector("#voicePromptPreview");
const discussionList = document.querySelector("#discussionList");
const briefSources = document.querySelector("#briefSources");
const downloadBtn = document.querySelector("#downloadBtn");
const downloadLink = document.querySelector("#downloadLink");
const downloadStatus = document.querySelector("#downloadStatus");
const ttsProviderSelect = document.querySelector("#ttsProviderSelect");
const playbackTtsProviderSelect = document.querySelector("#playbackTtsProviderSelect");
const voiceSelect = document.querySelector("#voiceSelect");
const rateInput = document.querySelector("#rateInput");
const scriptList = document.querySelector("#scriptList");
const scriptTitle = document.querySelector("#scriptTitle");
const versionLinks = document.querySelector("#versionLinks");
const ttsStatus = document.querySelector("#ttsStatus");
const params = new URLSearchParams(window.location.search);
const BEST_OPENAI_VOICE = "cedar";
const BACKUP_OPENAI_VOICE = "marin";
const BEST_GEMINI_TTS_VOICE = "Charon";
const BEST_GOOGLE_TTS_VOICE = "ko-KR-Chirp3-HD-Charon";
const BEST_MACOS_TTS_VOICE = "Yuna";
const VOICE_PREVIEW_TEXT =
  "이 문장은 목소리 비교용 샘플입니다. 같은 원고를 열 개의 목소리로 생성해서, 설명형 HTML 영상에 가장 자연스럽게 맞는 톤을 고릅니다.";
const VOICE_PREVIEW_INSTRUCTIONS =
  "Speak in natural Korean, like a calm technical narrator. Keep it clear, steady, and not rushed. Do not sound like a customer-service greeting.";
const VISUAL_THEME_IDS = ["claude", "cinematic", "studio", "blueprint", "paper", "terminal", "minimal"];
const VISUAL_THEME_PALETTES = {
  claude: {
    accent: "#c36f53",
    cool: "#637f8b",
    green: "#768b67",
    gold: "#bf8a4d",
    ink: "#2a241d",
    bg: ["#f4eadb", "#e5d7c2", "#cdbda3"],
    gridAlpha: 0.07,
    gridStep: 210,
    codeFill: "rgba(250,241,225,0.78)",
    codeText: "#36464b",
  },
  cinematic: {
    accent: "#e7a35d",
    cool: "#7aa7c7",
    green: "#90c69a",
    gold: "#f4d18c",
    ink: "#f5f0e8",
    bg: ["#080a0d", "#12100d", "#06080b"],
    gridAlpha: 0.06,
    gridStep: 220,
    codeFill: "rgba(8,10,14,0.9)",
    codeText: "#d7e5f2",
  },
  studio: {
    accent: "#e88b61",
    cool: "#8fb7ff",
    green: "#8ad89e",
    gold: "#ffca75",
    ink: "#f4f1ea",
    bg: ["#151411", "#101116", "#17130f"],
    gridAlpha: 0.16,
    gridStep: 160,
    codeFill: "rgba(10,14,20,0.88)",
    codeText: "#cfe0ff",
  },
  blueprint: {
    accent: "#73a7ff",
    cool: "#9bc7ff",
    green: "#8fd5bd",
    gold: "#f4d38e",
    ink: "#f3f7ff",
    bg: ["#07111f", "#0b1d33", "#081522"],
    gridAlpha: 0.22,
    gridStep: 140,
    codeFill: "rgba(6,17,32,0.9)",
    codeText: "#cde3ff",
  },
  paper: {
    accent: "#b65f3c",
    cool: "#5577aa",
    green: "#4f8b68",
    gold: "#a56d2b",
    ink: "#181512",
    bg: ["#f5efe3", "#eadfca", "#f7f2e8"],
    gridAlpha: 0.18,
    gridStep: 155,
    codeFill: "rgba(255,248,235,0.84)",
    codeText: "#31435f",
  },
  terminal: {
    accent: "#69d38b",
    cool: "#62c7d9",
    green: "#9bdc7a",
    gold: "#d4e06f",
    ink: "#eaffec",
    bg: ["#07100a", "#08180d", "#0b1209"],
    gridAlpha: 0.2,
    gridStep: 128,
    codeFill: "rgba(2,12,7,0.9)",
    codeText: "#a8ffc2",
  },
  minimal: {
    accent: "#d8d8d8",
    cool: "#9aa5b1",
    green: "#c7d0b4",
    gold: "#f0d080",
    ink: "#f7f7f5",
    bg: ["#070707", "#111111", "#050505"],
    gridAlpha: 0.08,
    gridStep: 190,
    codeFill: "rgba(6,6,6,0.9)",
    codeText: "#e6e6e6",
  },
};

let currentTime = 0;
let isPlaying = false;
let ttsEnabled = true;
let useOpenAiTts = false;
let activeSceneIndex = 0;
let rafId = 0;
let lastFrameTime = 0;
let activeUtterance = null;
let activeAudio = null;
let activeAudioUrl = "";
let audioContext = null;
let activeAudioSource = null;
let activeAudioSceneIndex = -1;
let activeAudioStartedAt = 0;
let speechRunId = 0;
let isLoadingSpeech = false;
let backendLabel = "OpenAI voice ready";
let sceneAdvanceTimer = 0;
let voices = [];
let ttsProviders = [];
let providerVoices = {
  openai: [],
  gemini: [],
  google: [],
  macos: [],
};
let providerBestVoices = {
  openai: BEST_OPENAI_VOICE,
  gemini: BEST_GEMINI_TTS_VOICE,
  google: BEST_GOOGLE_TTS_VOICE,
  macos: BEST_MACOS_TTS_VOICE,
};
let selectedTtsProvider = normalizeTtsProvider(params.get("tts") || "gemini");
let selectedOpenAiVoice = BEST_OPENAI_VOICE;
let selectedVisualTheme = normalizeVisualTheme(params.get("theme") || "claude");
let warmupToken = 0;
const audioBufferCache = new Map();
const audioBufferPromises = new Map();
const previewBufferCache = new Map();
const previewBufferPromises = new Map();
let currentManifest = {
  title: "No generated video yet",
  subtitle: "",
  topic: "",
  style: "documentary",
  sources: [],
  scenes,
};
applyInitialBuilderParams();
appShell.dataset.template = currentManifest.style;
applyVisualTheme(selectedVisualTheme, { updateUrl: false });
let initialAutoGenerateStarted = false;
let currentBrief = null;

function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const min = String(Math.floor(whole / 60)).padStart(2, "0");
  const sec = String(whole % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

const DELIVERY_FALLBACKS = {
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

const DELIVERY_ALTERNATES = {
  evidence: ["tension", "context", "transition"],
  synthesis: ["transition", "context", "evidence"],
  transition: ["synthesis", "evidence", "context"],
  tension: ["evidence", "transition", "context"],
  context: ["evidence", "transition", "synthesis"],
  conclusion: ["synthesis", "transition", "evidence"],
};

function fallbackDeliveryRole(scene, index) {
  const layout = scene?.layout || "";
  if (index === 0 || layout === "hero") return "hook";
  if (layout === "sources") return "sources";
  if (layout === "final") return "conclusion";
  if (["spec", "metrics", "qa", "code"].includes(layout)) return "evidence";
  if (["compare", "spectrum", "clock"].includes(layout)) return "tension";
  if (["flow", "pipeline", "render"].includes(layout)) return "transition";
  if (["cards", "clean"].includes(layout)) return "synthesis";
  return "context";
}

function baseDeliveryRole(scene, index) {
  const raw = scene?.delivery && typeof scene.delivery === "object" ? scene.delivery : {};
  return DELIVERY_FALLBACKS[raw.role] ? raw.role : fallbackDeliveryRole(scene, index);
}

function deliveryRoleCanShift(role, index) {
  return index > 0 && !["hook", "sources"].includes(role);
}

function alternateDeliveryRole(role, previousRole) {
  return (
    (DELIVERY_ALTERNATES[role] || ["context", "evidence", "transition"]).find(
      (candidate) => candidate !== previousRole,
    ) || role
  );
}

function deliveryRoleAt(index) {
  let previousRole = "";
  let role = "context";
  for (let currentIndex = 0; currentIndex <= index; currentIndex += 1) {
    role = baseDeliveryRole(scenes[currentIndex], currentIndex);
    if (role === previousRole && deliveryRoleCanShift(role, currentIndex)) {
      role = alternateDeliveryRole(role, previousRole);
    }
    previousRole = role;
  }
  return role;
}

function sceneDelivery(scene, index) {
  const raw = scene?.delivery && typeof scene.delivery === "object" ? scene.delivery : {};
  const rawRole = DELIVERY_FALLBACKS[raw.role] ? raw.role : "";
  const role = deliveryRoleAt(index);
  const fallback = DELIVERY_FALLBACKS[role] || DELIVERY_FALLBACKS.context;
  const useRawProfile = rawRole === role;
  return {
    role,
    tone: useRawProfile && raw.tone ? raw.tone : fallback.tone,
    pace: useRawProfile && raw.pace ? raw.pace : fallback.pace,
    energy: useRawProfile && raw.energy ? raw.energy : fallback.energy,
    pause: useRawProfile && raw.pause ? raw.pause : fallback.pause,
    instruction: useRawProfile && raw.instruction ? raw.instruction : fallback.instruction,
  };
}

function buildSceneVoiceInstructions(scene, index) {
  const delivery = sceneDelivery(scene, Math.max(0, index));
  const style = currentManifest?.style || "documentary";
  const styleLine =
    style === "story"
      ? "Keep story tension controlled, but keep the voice documentary rather than theatrical."
      : style === "emotional"
        ? "Allow restrained warmth and human weight, but avoid melodrama."
        : style === "documentary"
          ? "Use a restrained Korean documentary narrator tone."
          : "Use a clear Korean explainer narrator tone.";
  return [
    "Speak in natural Korean.",
    styleLine,
    "Use the same voice identity for the whole video.",
    "Vary delivery only through pace, pauses, quiet tension, certainty, and emphasis.",
    "Avoid customer-service warmth, overacting, shouting, and promotional excitement.",
    `Scene delivery role: ${delivery.role}.`,
    `Tone: ${delivery.tone}. Pace: ${delivery.pace}. Energy: ${delivery.energy}.`,
    `Pause direction: ${delivery.pause}.`,
    delivery.instruction,
    "Read the supplied Korean narration exactly. Do not add, remove, or translate words.",
  ].join(" ");
}

function renderScriptList() {
  if (!scenes.length) {
    scriptList.innerHTML = '<li class="script-empty">생성된 내레이션 원고가 아직 없습니다.</li>';
    return;
  }
  scriptList.innerHTML = scenes
    .map((scene, index) => {
      const delivery = sceneDelivery(scene, index);
      return `
        <li data-script-index="${index}">
          <div class="script-meta">
            <time>${formatTime(sceneStarts[index] || 0)}</time>
            <span>${escapeHtml(scene.layout || "scene")}</span>
            <span>${escapeHtml(delivery.role)}</span>
          </div>
          <strong>${escapeHtml(scene.caption || scene.title || `Scene ${index + 1}`)}</strong>
          ${renderEvidenceLine(scene)}
          <p>${escapeHtml(scene.speech || "")}</p>
        </li>
      `;
    })
    .join("");
}

function normalizeTtsProvider(value) {
  const provider = String(value || "openai").toLowerCase();
  return ["openai", "gemini", "google", "macos", "browser"].includes(provider) ? provider : "openai";
}

function currentTtsProvider() {
  return ttsProviders.find((provider) => provider.id === selectedTtsProvider) || null;
}

function currentTtsProviderLabel() {
  const provider = currentTtsProvider();
  if (provider?.label) return provider.label;
  if (selectedTtsProvider === "gemini") return "Gemini 3.1 Flash TTS";
  if (selectedTtsProvider === "google") return "Google Cloud TTS";
  if (selectedTtsProvider === "macos") return "macOS Korean TTS";
  if (selectedTtsProvider === "browser") return "Browser system TTS";
  return "OpenAI TTS";
}

function currentProviderVoices() {
  return Array.isArray(providerVoices[selectedTtsProvider]) ? providerVoices[selectedTtsProvider] : [];
}

function currentBestVoice() {
  const voicesForProvider = currentProviderVoices();
  const best = currentTtsProvider()?.bestVoice || providerBestVoices[selectedTtsProvider];
  return voicesForProvider.includes(best) ? best : voicesForProvider[0] || best || BEST_OPENAI_VOICE;
}

function shouldWarmFullAudio() {
  return ["openai", "macos"].includes(selectedTtsProvider);
}

function shouldPrefetchAudio() {
  return ["openai", "macos"].includes(selectedTtsProvider);
}

function clearAudioCaches() {
  warmupToken += 1;
  audioBufferCache.clear();
  audioBufferPromises.clear();
  previewBufferCache.clear();
  previewBufferPromises.clear();
}

function updateVoiceUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("tts", selectedTtsProvider);
  if (selectedOpenAiVoice) url.searchParams.set("voice", selectedOpenAiVoice);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function normalizeVisualTheme(value) {
  return VISUAL_THEME_IDS.includes(value) ? value : "claude";
}

function applyVisualTheme(theme, options = {}) {
  selectedVisualTheme = normalizeVisualTheme(theme);
  activeVisualTheme = selectedVisualTheme;
  appShell.dataset.visualTheme = selectedVisualTheme;
  if (visualThemeSelect) visualThemeSelect.value = selectedVisualTheme;
  if (options.updateUrl === false) return;
  const url = new URL(window.location.href);
  url.searchParams.set("theme", selectedVisualTheme);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function currentVisualPalette() {
  return VISUAL_THEME_PALETTES[selectedVisualTheme] || VISUAL_THEME_PALETTES.claude;
}

function colorWithAlpha(color, alpha) {
  if (!color?.startsWith("#")) return color;
  const hex = color.slice(1);
  const value =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex;
  const int = Number.parseInt(value, 16);
  if (!Number.isFinite(int)) return color;
  const red = (int >> 16) & 255;
  const green = (int >> 8) & 255;
  const blue = int & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}

function currentCanvasTheme() {
  const palette = currentVisualPalette();
  return {
    ...palette,
    muted: colorWithAlpha(palette.ink, 0.72),
    softText: colorWithAlpha(palette.ink, 0.76),
    faintText: colorWithAlpha(palette.ink, 0.58),
    progressTrack: colorWithAlpha(palette.ink, 0.14),
    gridLine: colorWithAlpha(palette.ink, 0.15),
    panelStroke: colorWithAlpha(palette.ink, 0.16),
    panelFill: colorWithAlpha(palette.ink, 0.055),
    accentStroke: colorWithAlpha(palette.accent, 0.62),
    accentFill: colorWithAlpha(palette.accent, 0.12),
    coolStroke: colorWithAlpha(palette.cool, 0.34),
    coolFill: colorWithAlpha(palette.cool, 0.08),
    greenStroke: colorWithAlpha(palette.green, 0.58),
    greenFill: colorWithAlpha(palette.green, 0.08),
  };
}

function renderTtsProviderSelects() {
  const providerList = ttsProviders.length
    ? ttsProviders
    : [
        { id: "openai", label: "OpenAI TTS", available: useOpenAiTts },
        { id: "gemini", label: "Gemini 3.1 Flash TTS", available: false },
        { id: "macos", label: "macOS Korean TTS", available: false },
        { id: "browser", label: "Browser system TTS", available: true },
      ];
  const html = providerList
    .map((provider) => {
      const disabled = provider.available ? "" : " disabled";
      const suffix = provider.available ? "" : " (not configured)";
      return `<option value="${escapeHtml(provider.id)}"${disabled}>${escapeHtml(provider.label || provider.id)}${suffix}</option>`;
    })
    .join("");
  [ttsProviderSelect, playbackTtsProviderSelect].forEach((selectEl) => {
    if (!selectEl) return;
    selectEl.innerHTML = html;
    selectEl.value = selectedTtsProvider;
  });
}

function renderVersionLinks() {
  const voicesForProvider = currentProviderVoices();
  if (!versionLinks) return;
  if (!voicesForProvider.length) {
    versionLinks.innerHTML = "";
    return;
  }
  const bestVoice = currentBestVoice();
  versionLinks.innerHTML = voicesForProvider
    .map((voice) => {
      const url = new URL(window.location.href);
      url.searchParams.set("tts", selectedTtsProvider);
      url.searchParams.set("voice", voice);
      url.searchParams.delete("clean");
      const active = voice === selectedOpenAiVoice ? "active" : "";
      const label = voice === bestVoice ? `${voice} best` : voice;
      return `<a class="${active}" href="${url.pathname}${url.search}">${escapeHtml(label)}</a>`;
    })
    .join("");
}

function renderOpenAiVoiceOptions(selectEl) {
  if (!selectEl) return;
  const voicesForProvider = currentProviderVoices();
  const bestVoice = currentBestVoice();
  const providerLabel =
    selectedTtsProvider === "gemini"
      ? "Gemini"
      : selectedTtsProvider === "google"
        ? "Google"
        : selectedTtsProvider === "macos"
          ? "macOS"
          : "GPT";
  selectEl.disabled = !voicesForProvider.length;
  if (!voicesForProvider.length) {
    selectEl.innerHTML = '<option value="">No server voices available</option>';
    return;
  }
  selectEl.innerHTML = voicesForProvider
    .map((voice) => {
      const label = voice === bestVoice ? `${voice} full version (${providerLabel} best)` : `${voice} full version`;
      return `<option value="${voice}">${label}</option>`;
    })
    .join("");
  selectEl.value = selectedOpenAiVoice;
}

function setBuildStatus(message, tone = "ok") {
  if (!buildStatus) return;
  buildStatus.textContent = message;
  buildStatus.dataset.tone = tone;
}

function manifestBlockReason(manifest) {
  const route = String(manifest?.route || "");
  if (/fallback|local-synthesis|source-aware-local-synthesis|local-template/i.test(route)) {
    return "AI 생성이 로컬/템플릿 합성으로 떨어졌습니다. 모든 영상 내용은 AI manifest에서 와야 해서 막았습니다.";
  }
  if (manifest?.quality?.passed === false) {
    const issues = Array.isArray(manifest.quality.issues) ? manifest.quality.issues.slice(0, 4).join(" · ") : "";
    return issues ? `품질 게이트 실패: ${issues}` : "품질 게이트를 통과하지 못했습니다.";
  }
  return "";
}

function generationErrorMessage(payload, fallback = "Generate failed.") {
  const parts = [payload?.error || fallback, payload?.warning, payload?.quality?.issues?.slice?.(0, 4)?.join(" · ")]
    .filter(Boolean)
    .map((part) => String(part).trim())
    .filter(Boolean);
  return parts.join(" ");
}

function topicSignature() {
  return JSON.stringify({
    topic: topicInput?.value.replace(/\s+/g, " ").trim() || "",
    style: styleSelect?.value || "explainer",
    notes: topicNotes?.value.replace(/\s+/g, " ").trim() || "",
  });
}

function applyInitialBuilderParams() {
  const topicParam = params.get("topic")?.replace(/\s+/g, " ").trim();
  const notesParam = params.get("notes")?.replace(/\s+/g, " ").trim();
  const styleParam = params.get("style");
  if (topicParam && topicInput) {
    topicInput.value = topicParam;
    currentManifest.topic = topicParam;
  }
  if (notesParam && topicNotes) topicNotes.value = notesParam;
  if (styleParam && ["explainer", "documentary", "story", "emotional"].includes(styleParam)) {
    if (styleSelect) styleSelect.value = styleParam;
    currentManifest.style = styleParam;
  }
}

function resetBriefReview() {
  if (briefPanel) briefPanel.hidden = false;
  if (briefTitle) briefTitle.textContent = "Review generation plan";
  if (briefRoute) briefRoute.textContent = "not prepared";
  if (promptPreview) {
    promptPreview.textContent = "Discuss Topic을 누르면 AI가 사용할 제작 프롬프트가 여기에 표시됩니다.";
  }
  if (voicePromptPreview) {
    voicePromptPreview.textContent = "목소리 톤 지시문이 여기에 표시됩니다.";
  }
  if (discussionList) {
    discussionList.innerHTML = "<li>주제 방향을 먼저 확인합니다.</li>";
  }
  if (briefSources) {
    briefSources.innerHTML =
      "<span><b>0</b><span>Discuss Topic 후 검증된 출처가 표시됩니다.</span><small>pending</small></span>";
  }
}

function setCleanMode(enabled, options = {}) {
  const next = Boolean(enabled);
  appShell.dataset.clean = String(next);
  cleanBtn.textContent = next ? "Exit Clean" : "Clean View";
  cleanBtn.setAttribute("aria-pressed", String(next));
  if (options.updateUrl === false) return;
  const url = new URL(window.location.href);
  if (next) url.searchParams.set("clean", "1");
  else url.searchParams.delete("clean");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function invalidateBrief() {
  currentBrief = null;
  if (generateBtn) generateBtn.disabled = true;
  resetBriefReview();
  setBuildStatus("Discuss the topic first, then generate.", "warn");
}

function renderBrief(brief) {
  if (!briefPanel) return;
  briefPanel.hidden = false;
  if (briefTitle) briefTitle.textContent = `${brief.topic} · ${brief.style}`;
  if (briefRoute) {
    const sourceCount = Array.isArray(brief.sources) ? brief.sources.length : 0;
    const quality = brief.sourceQuality || brief.research?.sourceQuality || {};
    const qualityText = Number.isFinite(quality.average)
      ? ` · avg ${quality.average} · primary ${quality.primaryCount || 0}`
      : "";
    briefRoute.textContent = `${sourceCount} sources${qualityText} · ${brief.topicType || brief.route || "brief"}`;
  }
  if (promptPreview) promptPreview.textContent = brief.prompts?.generation || "";
  if (voicePromptPreview) voicePromptPreview.textContent = brief.prompts?.voice || "";
  if (discussionList) {
    discussionList.innerHTML = (brief.discussionQuestions || [])
      .map((question) => `<li>${escapeHtml(question)}</li>`)
      .join("");
  }
  if (briefSources) {
    const sources = Array.isArray(brief.sources) ? brief.sources : [];
    briefSources.innerHTML = sources.length
      ? sources
          .map((source, index) => {
            const label = source.id || `S${index + 1}`;
            const status = source.verified ? `checked ${source.status || ""}`.trim() : "unverified";
            const quality = `${source.tier || "secondary"} ${source.reliability || "?"}/100`;
            return `
              <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
                <b>${label}</b>
                <span>${escapeHtml(source.title || source.host || source.url)}</span>
                <small>${escapeHtml(`${source.host || status} · ${quality}`)}</small>
              </a>
            `;
          })
          .join("")
      : "<span><b>0</b><span>No verified sources for this topic yet.</span><small>conceptual</small></span>";
  }
}

function syncBuilderVoice() {
  if (builderVoiceSelect && builderVoiceSelect.value !== selectedOpenAiVoice) {
    builderVoiceSelect.value = selectedOpenAiVoice;
  }
}

function applyManifest(manifest, voice = selectedOpenAiVoice) {
  pause();
  const nextScenes = Array.isArray(manifest?.scenes) ? manifest.scenes : [];
  if (!nextScenes.length) throw new Error("Generated manifest has no scenes.");

  currentManifest = {
    title: manifest.title || "Generated HTML TTS video",
    subtitle: manifest.subtitle || "",
    topic: manifest.topic || topicInput?.value || "Generated topic",
    style: manifest.style || styleSelect?.value || "explainer",
    sources: Array.isArray(manifest.sources) ? manifest.sources : [],
    research: manifest.research || null,
    sourceQuality: manifest.quality?.sourceQuality || manifest.research?.sourceQuality || null,
    quality: manifest.quality || null,
    route: manifest.route || "",
    warning: manifest.warning || "",
    scenes,
  };
  appShell.dataset.template = currentManifest.style;
  if (styleSelect && styleSelect.value !== currentManifest.style) styleSelect.value = currentManifest.style;
  scenes.splice(0, scenes.length, ...nextScenes);
  currentManifest.scenes = scenes;
  warmupToken += 1;
  audioBufferCache.clear();
  audioBufferPromises.clear();
  previewBufferCache.clear();
  previewBufferPromises.clear();
  sceneDurations = scenes.map((scene) => scene.duration || PAGE_SECONDS);
  rebuildTimeline();
  currentTime = 0;
  activeSceneIndex = 0;
  activeAudioSceneIndex = -1;
  renderSceneDeck();
  sceneEls = [...document.querySelectorAll(".scene")];
  if (scriptTitle) scriptTitle.textContent = currentManifest.title;

  if (useOpenAiTts && currentProviderVoices().includes(voice)) {
    selectedOpenAiVoice = voice;
    voiceSelect.value = voice;
    syncBuilderVoice();
    updateVoiceUrl();
  }
  renderScriptList();
  renderVersionLinks();
  updateView({ suppressSpeech: true });
  if (useOpenAiTts) {
    ttsStatus.textContent = `Preparing ${selectedOpenAiVoice} via ${currentTtsProviderLabel()}`;
    ttsStatus.className = "tts-status openai";
    if (shouldWarmFullAudio()) warmAllSceneAudio(selectedOpenAiVoice);
    else if (shouldPrefetchAudio()) prefetchScene(0, selectedOpenAiVoice);
  }
}

function sceneForTime(time) {
  for (let index = sceneStarts.length - 1; index >= 0; index -= 1) {
    if (time >= sceneStarts[index]) return index;
  }
  return 0;
}

function updateSkipControls() {
  if (!scenes.length) {
    if (prevSceneBtn) prevSceneBtn.disabled = true;
    if (nextSceneBtn) nextSceneBtn.disabled = true;
    if (sceneCounter) sceneCounter.textContent = "00 / 00";
    return;
  }
  if (prevSceneBtn) prevSceneBtn.disabled = activeSceneIndex <= 0;
  if (nextSceneBtn) nextSceneBtn.disabled = activeSceneIndex >= scenes.length - 1;
  if (sceneCounter) {
    sceneCounter.textContent = `${String(activeSceneIndex + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}`;
  }
}

function updateView(options = {}) {
  if (!scenes.length || totalDuration <= 0) {
    activeSceneIndex = 0;
    sceneEls.forEach((el) => el.classList.remove("active"));
    if (captionEl) captionEl.textContent = "생성 전";
    if (timecodeEl) timecodeEl.textContent = "00:00 / 00:00";
    if (progressEl) progressEl.style.width = "0%";
    if (playBtn) playBtn.disabled = true;
    if (restartBtn) restartBtn.disabled = true;
    if (downloadBtn) downloadBtn.disabled = true;
    updateSkipControls();
    return;
  }
  if (playBtn) playBtn.disabled = false;
  if (restartBtn) restartBtn.disabled = false;
  if (downloadBtn) downloadBtn.disabled = false;
  const nextIndex = Math.max(0, sceneForTime(currentTime));
  if (nextIndex !== activeSceneIndex) {
    activeSceneIndex = nextIndex;
    if (!options.suppressSpeech) speakActiveScene();
  }

  sceneEls.forEach((el, index) => {
    el.classList.toggle("active", index === activeSceneIndex);
  });

  document.querySelectorAll("[data-script-index]").forEach((el, index) => {
    el.classList.toggle("active", index === activeSceneIndex);
  });

  captionEl.textContent = scenes[activeSceneIndex].caption;
  timecodeEl.textContent = `${formatTime(currentTime)} / ${formatTime(totalDuration)}`;
  progressEl.style.width = `${Math.min(100, (currentTime / totalDuration) * 100)}%`;
  updateSkipControls();
}

function selectedVoice() {
  if (useOpenAiTts) return selectedOpenAiVoice || voiceSelect.value || currentBestVoice();
  const selectedName = voiceSelect.value;
  return (
    voices.find((voice) => voice.name === selectedName) ||
    voices.find((voice) => voice.lang.startsWith("ko")) ||
    voices[0]
  );
}

async function ensureAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Web Audio API is unavailable.");
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") await audioContext.resume();
  return audioContext;
}

function stopSpeech() {
  speechRunId += 1;
  isLoadingSpeech = false;
  if (sceneAdvanceTimer) {
    clearTimeout(sceneAdvanceTimer);
    sceneAdvanceTimer = 0;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  activeUtterance = null;
  if (activeAudioSource) {
    try {
      activeAudioSource.stop();
    } catch {}
    activeAudioSource.disconnect();
  }
  activeAudioSource = null;
  activeAudioSceneIndex = -1;
  activeAudioStartedAt = 0;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
  }
  if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
  activeAudio = null;
  activeAudioUrl = "";
}

async function fetchOpenAiAudioBuffer(scene, options = {}) {
  const provider = selectedTtsProvider;
  const voice = options.voice || selectedVoice();
  const sceneIndex = scenes.indexOf(scene);
  const instructions = buildSceneVoiceInstructions(scene, sceneIndex);
  const cacheKey = JSON.stringify({ provider, text: scene.speech, voice, instructions });
  if (audioBufferCache.has(cacheKey)) {
    const cached = audioBufferCache.get(cacheKey);
    if (voice === selectedVoice()) updateSceneDuration(sceneIndex, cached.duration);
    return cached;
  }
  if (audioBufferPromises.has(cacheKey)) {
    const pending = await audioBufferPromises.get(cacheKey);
    if (voice === selectedVoice()) updateSceneDuration(sceneIndex, pending.duration);
    return pending;
  }

  const loadPromise = (async () => {
    if (!options.background) {
      ttsStatus.textContent = `Generating ${currentTtsProviderLabel()} voice`;
      ttsStatus.className = "tts-status openai";
    }
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider,
        input: scene.speech,
        voice,
        instructions,
      }),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || "TTS failed.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!audioContext && AudioContextClass) audioContext = new AudioContextClass();
    if (!audioContext) throw new Error("Web Audio API is unavailable.");
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    audioBufferCache.set(cacheKey, decoded);
    if (voice === selectedVoice()) updateSceneDuration(sceneIndex, decoded.duration);
    if (!options.background) ttsStatus.textContent = backendLabel;
    return decoded;
  })();

  audioBufferPromises.set(cacheKey, loadPromise);
  try {
    return await loadPromise;
  } finally {
    audioBufferPromises.delete(cacheKey);
  }
}

function prefetchScene(index, voice = selectedVoice()) {
  if (!useOpenAiTts || index < 0 || index >= scenes.length) return;
  fetchOpenAiAudioBuffer(scenes[index], { background: true, voice }).catch(() => {});
}

async function warmAllSceneAudio(voice = selectedVoice()) {
  if (!useOpenAiTts) return;
  const token = ++warmupToken;
  for (let index = 0; index < scenes.length; index += 1) {
    if (token !== warmupToken || voice !== selectedVoice()) return;
    try {
      await fetchOpenAiAudioBuffer(scenes[index], { background: true, voice });
    } catch {
      return;
    }
  }
  if (!isPlaying && token === warmupToken && voice === selectedVoice()) {
    ttsStatus.textContent = `Voice synced (${currentTtsProviderLabel()} ${voice}): ${formatTime(totalDuration)}`;
    ttsStatus.className = "tts-status openai";
  }
}

async function speakWithOpenAi(scene) {
  const runId = speechRunId;
  const sceneIndex = activeSceneIndex;
  const voice = selectedVoice();
  const context = await ensureAudioContext();
  const audioBuffer = await fetchOpenAiAudioBuffer(scene, { voice });
  if (runId !== speechRunId || !isPlaying || voice !== selectedVoice()) return false;

  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  source.playbackRate.value = Number(rateInput.value);
  source.connect(context.destination);
  activeAudioSource = source;
  activeAudioSceneIndex = sceneIndex;
  activeAudioStartedAt = context.currentTime;
  source.onended = () => {
    if (activeAudioSource === source) activeAudioSource = null;
    if (ttsStatus.classList.contains("openai")) ttsStatus.textContent = backendLabel;
    if (!isPlaying || runId !== speechRunId) return;
    sceneAdvanceTimer = setTimeout(() => {
      if (!isPlaying || runId !== speechRunId) return;
      currentTime = (sceneStarts[sceneIndex] || 0) + sceneDurations[sceneIndex];
      if (sceneIndex >= scenes.length - 1) {
        pause();
        return;
      }
      activeSceneIndex = sceneIndex + 1;
      currentTime = sceneStarts[activeSceneIndex] || 0;
      updateView({ suppressSpeech: true });
      speakActiveScene();
    }, 250);
  };
  source.start();
  ttsStatus.textContent = `Playing ${voice} via ${currentTtsProviderLabel()}`;
  ttsStatus.className = "tts-status openai";
  prefetchScene(activeSceneIndex + 1, voice);
  return true;
}

async function fetchOpenAiPreviewBuffer(voice) {
  const provider = selectedTtsProvider;
  const cacheKey = JSON.stringify({ provider, text: VOICE_PREVIEW_TEXT, voice, preview: true });
  if (previewBufferCache.has(cacheKey)) return previewBufferCache.get(cacheKey);
  if (previewBufferPromises.has(cacheKey)) return previewBufferPromises.get(cacheKey);

  const loadPromise = (async () => {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider,
        input: VOICE_PREVIEW_TEXT,
        voice,
        instructions: VOICE_PREVIEW_INSTRUCTIONS,
      }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || "TTS preview failed.");
    }
    const arrayBuffer = await response.arrayBuffer();
    const context = await ensureAudioContext();
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    previewBufferCache.set(cacheKey, decoded);
    return decoded;
  })();

  previewBufferPromises.set(cacheKey, loadPromise);
  try {
    return await loadPromise;
  } finally {
    previewBufferPromises.delete(cacheKey);
  }
}

async function previewSelectedOpenAiVoice(voice) {
  if (!useOpenAiTts || isPlaying) return;
  stopSpeech();
  const runId = speechRunId;
  ttsStatus.textContent = `Previewing ${voice}`;
  ttsStatus.className = "tts-status openai";
  try {
    const context = await ensureAudioContext();
    const audioBuffer = await fetchOpenAiPreviewBuffer(voice);
    if (runId !== speechRunId || isPlaying || voice !== selectedVoice()) return;
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = Number(rateInput.value);
    source.connect(context.destination);
    activeAudioSource = source;
    source.onended = () => {
      if (activeAudioSource === source) activeAudioSource = null;
      if (!isPlaying && voice === selectedVoice()) {
        ttsStatus.textContent = `Selected ${voice}. Preparing full voice manifest`;
        ttsStatus.className = "tts-status openai";
      }
    };
    source.start();
  } catch (error) {
    console.warn(error);
    ttsStatus.textContent = `Selected ${voice}. Preview failed`;
    ttsStatus.className = "tts-status fallback";
  }
}

async function speakActiveScene() {
  if (!ttsEnabled || !isPlaying) return false;
  const scene = scenes[activeSceneIndex];
  if (!scene) return false;
  isLoadingSpeech = true;
  stopSpeech();
  isLoadingSpeech = true;
  if (useOpenAiTts) {
    try {
      const started = await speakWithOpenAi(scene);
      isLoadingSpeech = false;
      lastFrameTime = 0;
      return started;
    } catch (error) {
      const failedProvider = currentTtsProviderLabel();
      isLoadingSpeech = false;
      useOpenAiTts = false;
      selectedTtsProvider = "browser";
      renderTtsProviderSelects();
      loadVoices();
      ttsStatus.textContent = `${failedProvider} failed, browser fallback`;
      ttsStatus.className = "tts-status fallback";
      console.warn(error);
      return speakActiveScene();
    }
  }

  if (!("speechSynthesis" in window)) {
    isLoadingSpeech = false;
    return false;
  }
  activeUtterance = new SpeechSynthesisUtterance(scene.speech);
  activeUtterance.lang = "ko-KR";
  activeUtterance.rate = Number(rateInput.value);
  activeUtterance.pitch = 0.94;
  activeUtterance.volume = 1;
  const voice = selectedVoice();
  if (voice) activeUtterance.voice = voice;
  window.speechSynthesis.speak(activeUtterance);
  isLoadingSpeech = false;
  return true;
}

function tick(timestamp) {
  if (!isPlaying) return;
  if (isLoadingSpeech) {
    lastFrameTime = timestamp;
    rafId = requestAnimationFrame(tick);
    return;
  }
  if (useOpenAiTts) {
    if (activeAudioSource && audioContext && activeAudioSceneIndex >= 0) {
      const sceneStart = sceneStarts[activeAudioSceneIndex] || 0;
      const elapsed = Math.max(0, audioContext.currentTime - activeAudioStartedAt);
      currentTime = Math.min(sceneStart + elapsed, sceneStart + sceneDurations[activeAudioSceneIndex]);
      updateView({ suppressSpeech: true });
    }
    rafId = requestAnimationFrame(tick);
    return;
  }
  if (!lastFrameTime) lastFrameTime = timestamp;
  const delta = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;
  currentTime += delta;
  if (currentTime >= totalDuration) {
    currentTime = totalDuration;
    pause();
  }
  updateView();
  rafId = requestAnimationFrame(tick);
}

async function play() {
  if (!scenes.length || totalDuration <= 0) {
    setBuildStatus("먼저 주제로 새 영상을 생성해야 합니다.", "warn");
    return;
  }
  if (currentTime >= totalDuration) currentTime = 0;
  activeSceneIndex = Math.max(0, sceneForTime(currentTime));
  currentTime = sceneStarts[activeSceneIndex] || 0;
  updateView();
  isPlaying = true;
  lastFrameTime = 0;
  playIcon.textContent = useOpenAiTts && ttsEnabled ? "Loading" : "Pause";
  if (useOpenAiTts && ttsEnabled) ttsStatus.textContent = `Loading ${currentTtsProviderLabel()} voice before timeline`;
  const started = await speakActiveScene();
  if (!isPlaying) return;
  if (ttsEnabled && !started) {
    playIcon.textContent = "Play";
    isPlaying = false;
    return;
  }
  playIcon.textContent = "Pause";
  rafId = requestAnimationFrame(tick);
}

function pause() {
  isPlaying = false;
  playIcon.textContent = "Play";
  cancelAnimationFrame(rafId);
  stopSpeech();
  updateView();
}

async function restart() {
  if (!scenes.length) return;
  pause();
  currentTime = 0;
  activeSceneIndex = 0;
  updateView();
  await play();
}

async function jumpToScene(index, options = {}) {
  if (!scenes.length) return;
  const targetIndex = Math.max(0, Math.min(scenes.length - 1, index));
  const wasPlaying = isPlaying;
  if (wasPlaying) pause();
  else stopSpeech();
  activeSceneIndex = targetIndex;
  activeAudioSceneIndex = -1;
  currentTime = sceneStarts[targetIndex] || 0;
  updateView({ suppressSpeech: true });
  if (wasPlaying && options.resume !== false) await play();
}

async function jumpSceneBy(delta) {
  await jumpToScene(activeSceneIndex + delta);
}

function downloadFilename() {
  const base = (currentManifest.topic || topicInput?.value || "html-tts-video")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `${base || "html-tts-video"}-${selectedTtsProvider}-${selectedOpenAiVoice || "voice"}-1080p.webm`;
}

function canvasFont(size, weight = 800) {
  return `${weight} ${size}px Inter, Apple SD Gothic Neo, Noto Sans KR, sans-serif`;
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function drawTextBlock(ctx, text, x, y, maxWidth, size, options = {}) {
  ctx.font = canvasFont(size, options.weight || 850);
  ctx.fillStyle = options.color || currentCanvasTheme().ink;
  ctx.textAlign = options.align || "center";
  ctx.textBaseline = "top";
  const lineHeight = options.lineHeight || size * 1.18;
  const lines = wrapCanvasText(ctx, text, maxWidth);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return lines.length * lineHeight;
}

function roundRect(ctx, x, y, width, height, radius = 16) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillCard(ctx, x, y, width, height, stroke, fill) {
  const theme = currentCanvasTheme();
  roundRect(ctx, x, y, width, height, 18);
  ctx.fillStyle = fill || theme.panelFill;
  ctx.fill();
  ctx.strokeStyle = stroke || theme.panelStroke;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawCanvasTitle(ctx, scene, y = 145) {
  drawTextBlock(ctx, scene.title, 960, y, 1380, scene.layout === "hero" ? 104 : 78, { weight: 900 });
}

function drawCinematicSceneCanvas(ctx, scene, index, sceneProgress, totalProgress) {
  const width = 1920;
  const height = 1080;
  const theme = currentCanvasTheme();
  const { accent, cool, gold, ink, muted, softText } = theme;
  const isClaudeEditorial = selectedVisualTheme === "claude";
  const terms = cinemaTerms(scene, 4);
  const focus = cleanCinemaText(scene.mark || terms[0] || scene.title, 12);
  const claim = cleanCinemaText(scene.claim || scene.subtitle || scene.caption || scene.speech, 72);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, theme.bg[0]);
  bg.addColorStop(0.5, theme.bg[1]);
  bg.addColorStop(1, theme.bg[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = isClaudeEditorial ? 0.08 : 0.16;
  ctx.translate(Math.sin(sceneProgress * Math.PI * 2) * 18, Math.cos(sceneProgress * Math.PI * 2) * 10);
  for (let i = -3; i < 14; i += 1) {
    const x = i * 190;
    const line = ctx.createLinearGradient(x, 0, x + 580, height);
    line.addColorStop(0, colorWithAlpha(cool, 0));
    line.addColorStop(0.48, colorWithAlpha(i % 2 ? cool : accent, isClaudeEditorial ? 0.28 : 0.58));
    line.addColorStop(1, colorWithAlpha(accent, 0));
    ctx.strokeStyle = line;
    ctx.lineWidth = isClaudeEditorial ? 1.1 : i % 3 === 0 ? 4 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, height + 120);
    ctx.lineTo(x + 620, -120);
    ctx.stroke();
  }
  ctx.restore();

  const side = ctx.createLinearGradient(980, 0, width, 0);
  side.addColorStop(0, colorWithAlpha(cool, 0.02));
  side.addColorStop(1, colorWithAlpha(cool, 0.16));
  ctx.fillStyle = side;
  ctx.fillRect(1040, 0, width - 1040, height);

  ctx.fillStyle = isClaudeEditorial ? "rgba(255,249,240,0.12)" : "rgba(0,0,0,0.32)";
  ctx.fillRect(0, 0, width, height);
  const vignette = ctx.createRadialGradient(960, 530, 180, 960, 540, 970);
  vignette.addColorStop(0, isClaudeEditorial ? "rgba(255,255,255,0)" : "rgba(0,0,0,0)");
  vignette.addColorStop(1, isClaudeEditorial ? "rgba(76,51,32,0.24)" : "rgba(0,0,0,0.54)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = canvasFont(scene.layout === "hero" ? 112 : 92, 950);
  ctx.fillStyle = colorWithAlpha(ink, 0.075);
  wrapCanvasText(ctx, focus, 660)
    .slice(0, 2)
    .forEach((line, lineIndex) => ctx.fillText(line, width - 104, 440 + lineIndex * 118));

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = gold;
  ctx.font = canvasFont(24, 950);
  ctx.fillText(cleanCinemaText(scene.kicker || currentManifest.title || scene.layout, 42).toUpperCase(), 96, 72);
  ctx.textAlign = "right";
  ctx.fillStyle = colorWithAlpha(ink, 0.7);
  ctx.fillText(`${String(index + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}`, width - 96, 72);

  ctx.textAlign = "left";
  const titleSize = scene.layout === "hero" ? 58 : 44;
  const titleHeight = drawTextBlock(ctx, scene.title, 110, 250, 760, titleSize, {
    align: "left",
    color: ink,
    weight: 950,
    lineHeight: titleSize * 1.14,
  });
  drawTextBlock(ctx, claim, 112, Math.min(560, 286 + titleHeight), 620, 24, {
    align: "left",
    color: muted,
    weight: 690,
    lineHeight: 35,
  });

  if (scene.layout === "sources") {
    normalizeSourceItems(scene.sources)
      .slice(0, 5)
      .forEach((source, sourceIndex) => {
        const y = 400 + sourceIndex * 88;
        ctx.strokeStyle = colorWithAlpha(cool, 0.28);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(1050, y + 2);
        ctx.lineTo(1720, y - 18 + (sourceIndex % 2) * 26);
        ctx.lineTo(1740, y + 52);
        ctx.lineTo(1070, y + 72);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = gold;
        ctx.font = canvasFont(24, 950);
        ctx.fillText(source.id || String(sourceIndex + 1), 1078, y + 18);
        ctx.fillStyle = ink;
        ctx.font = canvasFont(24, 850);
        wrapCanvasText(ctx, source.title, 510)
          .slice(0, 1)
          .forEach((line) => ctx.fillText(line, 1145, y + 16));
      });
  } else if (["flow", "pipeline", "final"].includes(scene.layout)) {
    const items =
      (scene.layout === "flow" ? scene.nodes : scene.layout === "pipeline" ? scene.steps : scene.route) || terms;
    items.slice(0, 4).forEach((item, itemIndex) => {
      const x = 1080 + itemIndex * 154;
      const y = 620 - Math.sin((sceneProgress + itemIndex / 8) * Math.PI * 2) * 18;
      ctx.fillStyle =
        itemIndex === (scene.activeNode ?? 2) || scene.layout === "final"
          ? colorWithAlpha(accent, 0.22)
          : colorWithAlpha(ink, 0.065);
      ctx.beginPath();
      ctx.arc(x, y, itemIndex === (scene.activeNode ?? 2) ? 32 : 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colorWithAlpha(cool, 0.36);
      ctx.lineWidth = 2;
      ctx.stroke();
      if (itemIndex < 3) {
        ctx.beginPath();
        ctx.moveTo(x + 34, y);
        ctx.lineTo(x + 112, 620 - Math.sin((sceneProgress + (itemIndex + 1) / 8) * Math.PI * 2) * 18);
        ctx.stroke();
      }
      drawTextBlock(ctx, cleanCinemaText(item, 24), x, y + 45, 136, 18, { color: softText, weight: 720 });
    });
  } else if (scene.layout === "clock") {
    ctx.strokeStyle = colorWithAlpha(cool, 0.48);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(1390, 560, 180, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(1390, 560, 118, -Math.PI / 2, -Math.PI / 2 + sceneProgress * Math.PI * 2);
    ctx.strokeStyle = colorWithAlpha(accent, 0.74);
    ctx.stroke();
    drawTextBlock(ctx, scene.clock || focus, 1390, 505, 310, 46, { color: gold, weight: 950 });
    drawTextBlock(ctx, scene.note || claim, 1390, 640, 360, 26, { color: muted, weight: 730 });
  } else {
    terms.slice(0, 1).forEach((term, itemIndex) => {
      const x = 1120;
      const y = 490 + itemIndex * 72 - Math.sin((sceneProgress + itemIndex / 7) * Math.PI * 2) * 10;
      ctx.strokeStyle = colorWithAlpha(itemIndex === 0 ? accent : cool, itemIndex === 0 ? 0.74 : 0.42);
      ctx.lineWidth = itemIndex === 0 ? 2.4 : 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 58, y + 18);
      ctx.lineTo(x + 360, y - 6);
      ctx.stroke();
      ctx.fillStyle = itemIndex === 0 ? colorWithAlpha(accent, 0.86) : colorWithAlpha(cool, 0.58);
      ctx.beginPath();
      ctx.arc(x - 58, y + 18, itemIndex === 0 ? 9 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = itemIndex === 0 ? gold : softText;
      ctx.font = canvasFont(itemIndex === 0 ? 24 : 20, 800);
      ctx.textAlign = "left";
      ctx.fillText(cleanCinemaText(term, 18), x - 32, y - 2);
    });
  }

  ctx.fillStyle = colorWithAlpha(ink, 0.13);
  ctx.fillRect(96, height - 136, width - 192, 1);
  ctx.fillStyle = muted;
  ctx.font = canvasFont(18, 760);
  ctx.textAlign = "left";
  ctx.fillText(evidenceLabel(scene) || scene.layout || "scene", 96, height - 102);
  ctx.textAlign = "right";
  ctx.fillStyle = ink;
  ctx.fillText(cleanCinemaText(scene.caption || scene.title, 54), width - 96, height - 102);

  const progress = Math.max(0, Math.min(1, totalProgress));
  ctx.fillStyle = colorWithAlpha(ink, 0.14);
  ctx.fillRect(96, height - 70, width - 192, 5);
  ctx.fillStyle = accent;
  ctx.fillRect(96, height - 70, (width - 192) * progress, 5);
}

function drawSceneCanvas(ctx, scene, index, sceneProgress, totalProgress) {
  if (isCinematicTheme()) {
    drawCinematicSceneCanvas(ctx, scene, index, sceneProgress, totalProgress);
    return;
  }
  const width = 1920;
  const height = 1080;
  const theme = currentCanvasTheme();
  const { accent, cool, green, gold, ink, muted, softText, faintText } = theme;

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, theme.bg[0]);
  bg.addColorStop(0.55, theme.bg[1]);
  bg.addColorStop(1, theme.bg[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = theme.gridAlpha;
  for (let x = 120; x < width; x += theme.gridStep) {
    ctx.strokeStyle = x % (theme.gridStep * 2) === 0 ? cool : theme.gridLine;
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(sceneProgress * Math.PI * 2) * 12, 0);
    ctx.lineTo(x - 60, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = gold;
  ctx.font = canvasFont(24, 900);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText((scene.kicker || currentManifest.title || "HTML TTS VIDEO").toUpperCase(), 96, 70);

  ctx.textAlign = "right";
  ctx.fillStyle = muted;
  ctx.fillText(`${String(index + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}`, width - 96, 70);

  drawCanvasTitle(ctx, scene);

  if (scene.layout === "hero") {
    ctx.strokeStyle = colorWithAlpha(accent, 0.45);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(960, 560, 520, 210, sceneProgress * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(960, 560, 360, 132, -sceneProgress * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    drawTextBlock(ctx, scene.subtitle || currentManifest.subtitle, 960, 680, 1040, 36, {
      color: muted,
      weight: 760,
    });
  } else if (scene.layout === "compare") {
    (scene.panels || []).slice(0, 2).forEach((panel, i) => {
      const x = i === 0 ? 330 : 1010;
      fillCard(
        ctx,
        x,
        470,
        580,
        310,
        i === 1 ? theme.accentStroke : theme.panelStroke,
        i === 1 ? theme.accentFill : theme.panelFill,
      );
      drawTextBlock(ctx, panel.title, x + 290, 505, 450, 38, { color: i === 1 ? gold : ink, weight: 900 });
      (panel.lines || []).slice(0, 3).forEach((line, j) => {
        drawTextBlock(ctx, line, x + 290, 585 + j * 54, 440, 30, { color: softText, weight: 760 });
      });
    });
  } else if (scene.layout === "spec" || scene.layout === "metrics") {
    const items = scene.layout === "spec" ? scene.specs : scene.metrics;
    (items || []).slice(0, 4).forEach(([label, value], i) => {
      const x = 210 + i * 380;
      fillCard(
        ctx,
        x,
        515,
        320,
        230,
        i === 1 ? theme.greenStroke : theme.panelStroke,
        i === 1 ? theme.greenFill : theme.panelFill,
      );
      drawTextBlock(ctx, label, x + 160, 550, 250, 24, { color: faintText, weight: 850 });
      drawTextBlock(ctx, value, x + 160, 620, 270, 48, { color: i === 1 ? green : ink, weight: 920 });
    });
  } else if (scene.layout === "cards" || scene.layout === "clean") {
    const items = scene.layout === "cards" ? scene.cards : scene.frames;
    (items || []).slice(0, 3).forEach((item, i) => {
      const x = 310 + i * 430;
      fillCard(ctx, x, 500, 360, 270, theme.coolStroke, theme.coolFill);
      const icon = Array.isArray(item) ? item[0] : String(i + 1);
      const head = Array.isArray(item) ? item[1] : "point";
      const body = Array.isArray(item) ? item[2] : "";
      drawTextBlock(ctx, icon, x + 180, 530, 260, 42, { color: accent, weight: 950 });
      drawTextBlock(ctx, head, x + 180, 600, 280, 34, { color: gold, weight: 900 });
      drawTextBlock(ctx, body, x + 180, 670, 280, 27, { color: softText, weight: 760 });
    });
  } else if (scene.layout === "sources") {
    const sourceItems = normalizeSourceItems(scene.sources);
    sourceItems.slice(0, 5).forEach((source, i) => {
      const y = 450 + i * 86;
      fillCard(ctx, 285, y, 1350, 64, colorWithAlpha(cool, 0.24), theme.panelFill);
      drawTextBlock(ctx, String(i + 1), 340, y + 16, 60, 30, { color: gold, weight: 950 });
      ctx.textAlign = "left";
      ctx.font = canvasFont(27, 840);
      ctx.fillStyle = ink;
      wrapCanvasText(ctx, source.title, 850)
        .slice(0, 1)
        .forEach((line) => ctx.fillText(line, 410, y + 17));
      ctx.textAlign = "right";
      ctx.font = canvasFont(24, 780);
      ctx.fillStyle = faintText;
      ctx.fillText(source.host, 1580, y + 20);
    });
  } else if (scene.layout === "flow" || scene.layout === "pipeline" || scene.layout === "final") {
    const items = scene.layout === "flow" ? scene.nodes : scene.layout === "pipeline" ? scene.steps : scene.route;
    (items || []).slice(0, 5).forEach((item, i) => {
      const x = 185 + i * 330;
      const active = i === (scene.activeNode ?? 2) || scene.layout === "final";
      fillCard(
        ctx,
        x,
        560,
        250,
        120,
        active ? theme.accentStroke : theme.panelStroke,
        active ? theme.accentFill : theme.panelFill,
      );
      drawTextBlock(ctx, item, x + 125, 595, 190, 29, {
        color: active ? ink : muted,
        weight: 880,
      });
      if (i < 4) {
        ctx.strokeStyle = colorWithAlpha(accent, 0.6);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 260, 620);
        ctx.lineTo(x + 318, 620);
        ctx.stroke();
      }
    });
    if (scene.layout === "final") drawTextBlock(ctx, scene.stamp, 960, 760, 900, 50, { color: accent, weight: 950 });
  } else if (scene.layout === "code") {
    fillCard(ctx, 440, 480, 1040, 340, colorWithAlpha(cool, 0.32), theme.codeFill);
    ctx.textAlign = "left";
    (scene.code || []).slice(0, 6).forEach((line, i) => {
      ctx.fillStyle = i === 0 ? gold : theme.codeText;
      ctx.font = canvasFont(32, 760);
      ctx.fillText(String(line), 510, 530 + i * 48);
    });
  } else if (scene.layout === "qa") {
    fillCard(ctx, 430, 475, 1060, 350, theme.panelStroke, theme.panelFill);
    (scene.rows || []).slice(0, 3).forEach(([check, result], i) => {
      drawTextBlock(ctx, check, 700, 535 + i * 86, 420, 32, { color: softText, weight: 820 });
      drawTextBlock(ctx, result, 1210, 535 + i * 86, 420, 32, { color: green, weight: 880 });
    });
  } else if (scene.layout === "spectrum") {
    drawTextBlock(ctx, scene.decision, 960, 530, 960, 40, { color: ink, weight: 850 });
    const gradient = ctx.createLinearGradient(460, 670, 1460, 670);
    gradient.addColorStop(0, green);
    gradient.addColorStop(0.5, gold);
    gradient.addColorStop(1, accent);
    roundRect(ctx, 460, 670, 1000, 34, 17);
    ctx.fillStyle = gradient;
    ctx.fill();
  } else if (scene.layout === "render") {
    const frameItems = Array.isArray(scene.frames) ? scene.frames : [];
    [
      [360, 500, 650, 300],
      [1060, 535, 410, 265],
      [1510, 575, 210, 225],
    ].forEach(([x, y, cardWidth, cardHeight], i) => {
      const [head, body] = frameItems[i] || ["", ""];
      fillCard(
        ctx,
        x,
        y,
        cardWidth,
        cardHeight,
        i === 1 ? colorWithAlpha(green, 0.34) : theme.coolStroke,
        i === 1 ? theme.greenFill : theme.coolFill,
      );
      drawTextBlock(ctx, head, x + cardWidth / 2, y + 55, cardWidth - 70, 34, {
        color: i === 1 ? green : cool,
        weight: 920,
      });
      drawTextBlock(ctx, body, x + cardWidth / 2, y + 135, cardWidth - 80, 28, { color: softText, weight: 760 });
    });
  } else {
    drawTextBlock(ctx, scene.caption, 960, 570, 1000, 38, { color: softText, weight: 800 });
  }

  ctx.fillStyle = theme.progressTrack;
  ctx.fillRect(96, height - 70, width - 192, 6);
  const progress = Math.max(0, Math.min(1, totalProgress));
  const pg = ctx.createLinearGradient(96, 0, width - 96, 0);
  pg.addColorStop(0, accent);
  pg.addColorStop(0.55, gold);
  pg.addColorStop(1, green);
  ctx.fillStyle = pg;
  ctx.fillRect(96, height - 70, (width - 192) * progress, 6);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recordYouTubeVideo() {
  if (!window.MediaRecorder) throw new Error("MediaRecorder is unavailable in this browser.");
  if (!scenes.length) throw new Error("먼저 주제로 새 영상을 생성해야 합니다.");
  if (!useOpenAiTts) throw new Error("1080p export needs OpenAI, Google, or macOS server TTS, not browser-only TTS.");
  const blocked = manifestBlockReason(currentManifest);
  if (blocked) throw new Error(`Render blocked: ${blocked}`);
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.captureStream) throw new Error("Canvas video capture is unavailable.");
  const context = await ensureAudioContext();
  const voice = selectedVoice();
  const rate = Number(rateInput.value) || 1;
  const buffers = [];
  downloadStatus.textContent = `Preparing audio 0/${scenes.length}`;
  for (let index = 0; index < scenes.length; index += 1) {
    buffers.push(await fetchOpenAiAudioBuffer(scenes[index], { background: true, voice }));
    downloadStatus.textContent = `Preparing audio ${index + 1}/${scenes.length}`;
    await wait(20);
  }

  const audioDestination = context.createMediaStreamDestination();
  const stream = canvas.captureStream(30);
  const mixedStream = new MediaStream([...stream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()]);
  const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  const recorder = new MediaRecorder(
    mixedStream,
    mimeType ? { mimeType, videoBitsPerSecond: 8000000 } : { videoBitsPerSecond: 8000000 },
  );
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };

  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  recorder.start(1000);
  const renderDurations = buffers.map((buffer) => Math.max(PAGE_SECONDS, buffer.duration / rate + 0.35));
  const exportTotal = renderDurations.reduce((sum, duration) => sum + duration, 0);
  let elapsedTotal = 0;

  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    const buffer = buffers[index];
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(audioDestination);
    source.start();

    const duration = renderDurations[index];
    const started = performance.now();
    while ((performance.now() - started) / 1000 < duration) {
      const sceneElapsed = (performance.now() - started) / 1000;
      drawSceneCanvas(
        ctx,
        scene,
        index,
        Math.min(1, sceneElapsed / duration),
        (elapsedTotal + sceneElapsed) / exportTotal,
      );
      downloadStatus.textContent = `Rendering ${formatTime(elapsedTotal + sceneElapsed)} / ${formatTime(exportTotal)}`;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    elapsedTotal += duration;
    try {
      source.stop();
    } catch {}
  }

  drawSceneCanvas(ctx, scenes[scenes.length - 1], scenes.length - 1, 1, 1);
  await wait(350);
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  mixedStream.getTracks().forEach((track) => track.stop());

  return new Blob(chunks, { type: recorder.mimeType || "video/webm" });
}

async function renderDownload() {
  if (isPlaying) pause();
  downloadBtn.disabled = true;
  downloadLink.hidden = true;
  try {
    const blob = await recordYouTubeVideo();
    if (downloadLink.dataset.url) URL.revokeObjectURL(downloadLink.dataset.url);
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.dataset.url = url;
    downloadLink.download = downloadFilename();
    downloadLink.hidden = false;
    downloadLink.textContent = `Download ${downloadLink.download}`;
    downloadStatus.textContent = `${Math.round(blob.size / 1024 / 1024)} MB · 1920x1080 WebM`;
  } catch (error) {
    console.warn(error);
    downloadStatus.textContent = error.message || "Render failed.";
  } finally {
    downloadBtn.disabled = false;
  }
}

function loadVoices() {
  if (useOpenAiTts) {
    const voicesForProvider = currentProviderVoices();
    const previous = selectedOpenAiVoice || voiceSelect.value;
    const backupVoice =
      selectedTtsProvider === "openai" && voicesForProvider.includes(BACKUP_OPENAI_VOICE) ? BACKUP_OPENAI_VOICE : "";
    const defaultVoice = voicesForProvider.includes(currentBestVoice())
      ? currentBestVoice()
      : backupVoice || voicesForProvider[0];
    selectedOpenAiVoice = voicesForProvider.includes(previous) ? previous : defaultVoice;
    renderOpenAiVoiceOptions(voiceSelect);
    renderOpenAiVoiceOptions(builderVoiceSelect);
    updateVoiceUrl();
    renderVersionLinks();
    return;
  }

  if (!("speechSynthesis" in window)) {
    voiceSelect.innerHTML = '<option value="">TTS unavailable</option>';
    voiceSelect.disabled = true;
    muteBtn.textContent = "Voice Off";
    ttsEnabled = false;
    return;
  }

  voices = window.speechSynthesis.getVoices();
  const koreanVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("ko"));
  const preferred = koreanVoices.length ? koreanVoices : voices;
  voiceSelect.disabled = false;
  voiceSelect.innerHTML = preferred
    .map((voice) => `<option value="${voice.name}">${voice.name} (${voice.lang})</option>`)
    .join("");
  if (builderVoiceSelect) {
    builderVoiceSelect.disabled = false;
    builderVoiceSelect.innerHTML = voiceSelect.innerHTML;
    builderVoiceSelect.value = voiceSelect.value;
  }
}

playBtn.addEventListener("click", async () => {
  if (isPlaying) pause();
  else await play();
});

prevSceneBtn?.addEventListener("click", () => {
  jumpSceneBy(-1);
});

nextSceneBtn?.addEventListener("click", () => {
  jumpSceneBy(1);
});

restartBtn.addEventListener("click", restart);

muteBtn.addEventListener("click", () => {
  ttsEnabled = !ttsEnabled;
  muteBtn.textContent = ttsEnabled ? "Voice On" : "Voice Off";
  if (!ttsEnabled) stopSpeech();
  else speakActiveScene();
});

cleanBtn.addEventListener("click", () => {
  setCleanMode(appShell.dataset.clean !== "true");
});

downloadBtn?.addEventListener("click", renderDownload);

voiceSelect.addEventListener("change", async () => {
  if (useOpenAiTts) {
    selectedOpenAiVoice = voiceSelect.value || currentBestVoice();
    syncBuilderVoice();
    updateVoiceUrl();
    clearAudioCaches();
    sceneDurations = scenes.map((scene) => scene.duration || PAGE_SECONDS);
    rebuildTimeline();
    renderScriptList();
    renderVersionLinks();
    updateView({ suppressSpeech: true });
    ttsStatus.textContent = `Selected ${selectedOpenAiVoice} via ${currentTtsProviderLabel()}`;
    ttsStatus.className = "tts-status openai";
  }
  audioBufferCache.clear();
  if (isPlaying) await speakActiveScene();
  else if (useOpenAiTts) {
    previewSelectedOpenAiVoice(selectedOpenAiVoice);
    if (shouldWarmFullAudio()) warmAllSceneAudio(selectedOpenAiVoice);
    else if (shouldPrefetchAudio()) prefetchScene(0, selectedOpenAiVoice);
  }
});

builderVoiceSelect?.addEventListener("change", () => {
  if (!voiceSelect || builderVoiceSelect.value === voiceSelect.value) return;
  voiceSelect.value = builderVoiceSelect.value;
  voiceSelect.dispatchEvent(new Event("change"));
});

async function changeTtsProvider(provider) {
  const normalized = normalizeTtsProvider(provider);
  const nextProvider = ttsProviders.find((item) => item.id === normalized);
  if (nextProvider && !nextProvider.available && normalized !== "browser") return;
  pause();
  selectedTtsProvider = normalized;
  useOpenAiTts = selectedTtsProvider !== "browser";
  clearAudioCaches();
  sceneDurations = scenes.map((scene) => scene.duration || PAGE_SECONDS);
  rebuildTimeline();
  renderTtsProviderSelects();
  loadVoices();
  updateVoiceUrl();
  renderScriptList();
  updateView({ suppressSpeech: true });
  if (useOpenAiTts) {
    ttsStatus.textContent = `Selected ${currentTtsProviderLabel()}`;
    ttsStatus.className = "tts-status openai";
    previewSelectedOpenAiVoice(selectedOpenAiVoice);
    if (shouldWarmFullAudio()) warmAllSceneAudio(selectedOpenAiVoice);
    else if (shouldPrefetchAudio()) prefetchScene(0, selectedOpenAiVoice);
  } else {
    ttsStatus.textContent = "Browser voice fallback";
    ttsStatus.className = "tts-status fallback";
  }
}

[ttsProviderSelect, playbackTtsProviderSelect].forEach((selectEl) => {
  selectEl?.addEventListener("change", async () => {
    await changeTtsProvider(selectEl.value);
  });
});

styleSelect?.addEventListener("change", () => {
  appShell.dataset.template = styleSelect.value || "explainer";
  invalidateBrief();
});

visualThemeSelect?.addEventListener("change", () => {
  applyVisualTheme(visualThemeSelect.value);
});

topicInput?.addEventListener("input", invalidateBrief);
topicNotes?.addEventListener("input", invalidateBrief);

scriptList?.addEventListener("click", async (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const item = target?.closest("[data-script-index]");
  if (!item) return;
  const index = Number(item.dataset.scriptIndex);
  if (!Number.isInteger(index) || index < 0 || index >= scenes.length) return;
  stopSpeech();
  activeSceneIndex = index;
  activeAudioSceneIndex = -1;
  currentTime = sceneStarts[index] || 0;
  updateView({ suppressSpeech: true });
  if (isPlaying) await speakActiveScene();
});

async function prepareTopicBrief() {
  const topic = topicInput.value.replace(/\s+/g, " ").trim();
  if (!topic) {
    setBuildStatus("주제를 입력해야 합니다.", "warn");
    topicInput.focus();
    return;
  }

  const style = styleSelect?.value || "explainer";
  const notes = topicNotes?.value.replace(/\s+/g, " ").trim() || "";
  const signature = topicSignature();
  if (prepareBtn) prepareBtn.disabled = true;
  if (generateBtn) generateBtn.disabled = true;
  setBuildStatus("Preparing topic brief, prompt, and source check...");
  try {
    const response = await fetch("/api/brief", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic, style, notes }),
    });
    const brief = await response.json();
    if (!response.ok) throw new Error(brief.error || "Topic brief failed.");
    brief.signature = signature;
    currentBrief = brief;
    renderBrief(brief);
    if (generateBtn) generateBtn.disabled = false;
    const sourceCount = brief.sources?.length || 0;
    const quality = brief.sourceQuality || brief.research?.sourceQuality || {};
    const qualityText = Number.isFinite(quality.average)
      ? ` · source avg ${quality.average} · primary ${quality.primaryCount || 0}`
      : "";
    setBuildStatus(`Brief ready: review prompt · ${brief.style} · sources ${sourceCount}${qualityText}`);
  } catch (error) {
    console.warn(error);
    currentBrief = null;
    setBuildStatus(error.message || "Topic brief failed.", "warn");
  } finally {
    if (prepareBtn) prepareBtn.disabled = false;
  }
}

async function generateVideoFromTopic(options = {}) {
  const topic = topicInput.value.replace(/\s+/g, " ").trim();
  if (!topic) {
    setBuildStatus("주제를 입력해야 합니다.", "warn");
    topicInput.focus();
    return;
  }

  if (!options.automatic && (!currentBrief || currentBrief.signature !== topicSignature())) {
    setBuildStatus("먼저 Discuss Topic으로 프롬프트를 확인해야 합니다.", "warn");
    if (generateBtn) generateBtn.disabled = true;
    return;
  }

  const voice = builderVoiceSelect?.value || selectedOpenAiVoice || BEST_OPENAI_VOICE;
  const style = styleSelect?.value || "explainer";
  const notes = topicNotes?.value.replace(/\s+/g, " ").trim() || "";
  if (generateBtn) generateBtn.disabled = true;
  if (prepareBtn) prepareBtn.disabled = true;
  setBuildStatus(
    options.automatic
      ? "Generating a verified video from this topic..."
      : "Researching sources, generating scenes, then running quality gate...",
  );
  if (downloadLink) downloadLink.hidden = true;
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic, voice, style, notes }),
    });
    const manifest = await response.json();
    if (!response.ok) throw new Error(generationErrorMessage(manifest, "Generate failed."));
    const blocked = manifestBlockReason(manifest);
    if (blocked) throw new Error(blocked);
    applyManifest(manifest, voice);
    const score = manifest.quality?.score;
    const sourceCount = manifest.sources?.length || manifest.research?.sources?.length || 0;
    const attempts = manifest.quality?.attempts || 1;
    const scoreText = Number.isFinite(score) ? ` · q${score}` : "";
    const sourceQuality = manifest.quality?.sourceQuality || manifest.research?.sourceQuality || {};
    const sourceQualityText = Number.isFinite(sourceQuality.average)
      ? ` · src${sourceQuality.average}/p${sourceQuality.primaryCount || 0}`
      : "";
    setBuildStatus(
      `Preview ready: ${manifest.scenes.length} pages · ${style} · sources ${sourceCount}${scoreText}${sourceQualityText} · attempts ${attempts} · ${manifest.route || "generated"}`,
      manifest.quality?.passed === false ? "warn" : "ok",
    );
  } catch (error) {
    console.warn(error);
    setBuildStatus(error.message || "Generate failed.", "warn");
  } finally {
    if (generateBtn) generateBtn.disabled = false;
    if (prepareBtn) prepareBtn.disabled = false;
  }
}

function shouldAutoGenerateInitialManifest() {
  return params.get("autoload") === "1";
}

generatorForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await prepareTopicBrief();
});

prepareBtn?.addEventListener("click", prepareTopicBrief);
generateBtn?.addEventListener("click", generateVideoFromTopic);

rateInput.addEventListener("input", () => {
  if (isPlaying && ttsEnabled) speakActiveScene();
});

function isEditableTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

window.addEventListener("keydown", (event) => {
  if (event.isComposing || isEditableTarget(event.target)) return;
  if (event.code === "Space") {
    event.preventDefault();
    if (isPlaying) pause();
    else play();
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    jumpSceneBy(-1);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    jumpSceneBy(1);
  }
  if (event.key === "Escape" && appShell.dataset.clean === "true") {
    event.preventDefault();
    setCleanMode(false);
  }
  if (event.key.toLowerCase() === "r") restart();
});

window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoices);

async function loadVoiceBackend() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const status = await response.json();
    const legacyProviders = [
      {
        id: "openai",
        label: status.provider || "OpenAI TTS",
        available: Boolean(status.openaiTts),
        model: status.model,
        reasoningEffort: status.reasoningEffort,
        bestVoice: status.bestVoice || BEST_OPENAI_VOICE,
        voices: Array.isArray(status.voices) ? status.voices : [],
      },
      {
        id: "browser",
        label: "Browser system TTS",
        available: true,
        model: "speechSynthesis",
        bestVoice: "",
        voices: [],
      },
    ];
    ttsProviders = (
      Array.isArray(status.providers) && status.providers.length ? status.providers : legacyProviders
    ).map((provider) => ({
      ...provider,
      id: normalizeTtsProvider(provider.id),
      available: provider.id === "browser" ? true : Boolean(provider.available),
      voices: Array.isArray(provider.voices) ? provider.voices : [],
    }));
    providerVoices = ttsProviders.reduce(
      (acc, provider) => {
        acc[provider.id] = provider.voices;
        return acc;
      },
      { openai: [], gemini: [], google: [], macos: [] },
    );
    providerBestVoices = ttsProviders.reduce(
      (acc, provider) => {
        if (provider.bestVoice) acc[provider.id] = provider.bestVoice;
        return acc;
      },
      {
        openai: BEST_OPENAI_VOICE,
        gemini: BEST_GEMINI_TTS_VOICE,
        google: BEST_GOOGLE_TTS_VOICE,
        macos: BEST_MACOS_TTS_VOICE,
      },
    );
    const requestedProvider = normalizeTtsProvider(params.get("tts") || selectedTtsProvider);
    const requestedAvailable = ttsProviders.some(
      (provider) => provider.id === requestedProvider && (provider.available || provider.id === "browser"),
    );
    selectedTtsProvider = requestedAvailable
      ? requestedProvider
      : ttsProviders.find((provider) => provider.id === "openai" && provider.available)?.id ||
        ttsProviders.find((provider) => provider.id === "gemini" && provider.available)?.id ||
        ttsProviders.find((provider) => provider.id === "google" && provider.available)?.id ||
        ttsProviders.find((provider) => provider.id === "macos" && provider.available)?.id ||
        "browser";
    useOpenAiTts = selectedTtsProvider !== "browser";
    renderTtsProviderSelects();
    if (useOpenAiTts) {
      const requestedVoice = params.get("voice");
      const voicesForProvider = currentProviderVoices();
      selectedOpenAiVoice = voicesForProvider.includes(requestedVoice)
        ? requestedVoice
        : voicesForProvider.includes(currentBestVoice())
          ? currentBestVoice()
          : voicesForProvider[0];
      const provider = currentTtsProvider();
      const effortLabel = provider?.reasoningEffort ? ` / ${provider.reasoningEffort}` : "";
      ttsStatus.textContent = `${currentTtsProviderLabel()} ${provider?.model || ""}${effortLabel} ready`;
      backendLabel = ttsStatus.textContent;
      ttsStatus.className = "tts-status openai";
    } else {
      ttsStatus.textContent = "Browser voice fallback";
      ttsStatus.className = "tts-status fallback";
    }
  } catch {
    useOpenAiTts = false;
    selectedTtsProvider = "browser";
    renderTtsProviderSelects();
    ttsStatus.textContent = "Browser voice fallback";
    ttsStatus.className = "tts-status fallback";
  }
  loadVoices();
  if (shouldAutoGenerateInitialManifest() && !initialAutoGenerateStarted) {
    initialAutoGenerateStarted = true;
    generateVideoFromTopic({ automatic: true }).catch((error) => {
      console.warn(error);
      setBuildStatus(error.message || "Initial generate failed.", "warn");
      if (useOpenAiTts) {
        if (shouldPrefetchAudio()) prefetchScene(0, selectedOpenAiVoice);
        if (shouldWarmFullAudio()) warmAllSceneAudio(selectedOpenAiVoice);
      }
    });
    return;
  }
  if (useOpenAiTts) {
    if (shouldPrefetchAudio()) prefetchScene(0, selectedOpenAiVoice);
    if (shouldWarmFullAudio()) warmAllSceneAudio(selectedOpenAiVoice);
  }
}

renderScriptList();
if (scriptTitle) scriptTitle.textContent = currentManifest.title;
loadVoiceBackend();
if (params.get("clean") === "1") {
  setCleanMode(true, { updateUrl: false });
}
updateView();
