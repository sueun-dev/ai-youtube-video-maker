const scenes = [
  {
    duration: 10,
    layout: "hero",
    kicker: "01 / SOURCE",
    title: "HTML이 영상 소스가 된다",
    mark: "영상 소스",
    subtitle: "36 pages · 10 second rhythm · one fixed voice per version",
    caption: "HTML이 영상 소스가 된다.",
    speech:
      "이번 버전은 HTML을 미리보기 창이 아니라 영상 소스로 씁니다. 36개의 페이지가 있고, 각 페이지는 한 문장 단위의 내레이션과 정확히 맞춰집니다.",
  },
  {
    duration: 10,
    layout: "compare",
    title: "고정 타이머는 긴 영상에서 깨진다",
    mark: "고정 타이머",
    caption: "고정 타이머는 긴 영상에서 깨진다.",
    panels: [
      { title: "Timer First", lines: ["8초 고정", "문장 중간 전환", "목소리 바꾸면 틀어짐"], tone: "muted" },
      { title: "Audio First", lines: ["음성 생성", "실제 길이 측정", "끝난 뒤 전환"], tone: "hot" },
    ],
    speech:
      "먼저 고정 타이머를 버립니다. 6분짜리 영상에서 타이머만 믿으면 말이 잘리거나 화면이 멈춥니다. 여기서는 오디오가 장면 길이를 정합니다.",
  },
  {
    duration: 10,
    layout: "spec",
    title: "한 페이지는 하나의 명세를 가진다",
    mark: "하나의 명세",
    caption: "한 페이지는 하나의 명세를 가진다.",
    specs: [
      ["scene_role", "setup"],
      ["visual_layout", "spec grid"],
      ["narration", "one beat"],
      ["duration", "10 sec"],
    ],
    speech:
      "각 페이지는 그냥 화면 조각이 아닙니다. 역할, 레이아웃, 짧은 화면 문장, 음성 원고, 목표 길이를 함께 가진 작은 제작 명세입니다.",
  },
  {
    duration: 10,
    layout: "cards",
    title: "역할을 나누면 흐름이 생긴다",
    mark: "흐름",
    caption: "역할을 나누면 흐름이 생긴다.",
    cards: [
      ["H", "hook", "무엇을 만들지 바로 제시"],
      ["M", "mechanism", "작동 순서를 화면으로 분리"],
      ["Q", "quality", "검수 기준을 숫자로 고정"],
    ],
    speech:
      "36페이지는 무작위로 늘린 게 아닙니다. 도입, 문제, 원리, 실행, 검수, 버전, 마무리로 역할을 나눠서 자연스럽게 넘어가게 합니다.",
  },
  {
    duration: 10,
    layout: "flow",
    title: "원고에서 WAV까지 한 방향으로 흐른다",
    mark: "WAV",
    caption: "원고에서 WAV까지 한 방향으로 흐른다.",
    nodes: ["script", "voice", "wav", "decode", "screen"],
    activeNode: 2,
    speech:
      "흐름은 단순합니다. 원고가 들어오고, 고정된 voice로 음성이 만들어지고, WAV 파일이 생기고, 브라우저가 길이를 읽은 뒤 화면을 맞춥니다.",
  },
  {
    duration: 10,
    layout: "clock",
    title: "오디오 길이가 페이지 전환을 정한다",
    mark: "페이지 전환",
    caption: "오디오 길이가 페이지 전환을 정한다.",
    clock: "10.0s",
    note: "decodeAudioData -> duration -> page timeline",
    speech:
      "한 페이지는 기본적으로 10초 리듬을 가집니다. 다만 음성이 10초보다 조금 길면 화면은 기다립니다. 말이 끝나기 전에 넘어가지 않습니다.",
  },
  {
    duration: 10,
    layout: "metrics",
    title: "6분 영상은 36페이지가 기준이다",
    mark: "36페이지",
    caption: "6분 영상은 36페이지가 기준이다.",
    metrics: [
      ["pages", "36"],
      ["rhythm", "10s"],
      ["runtime", "6m"],
      ["voice", "fixed"],
    ],
    speech:
      "6분짜리 영상이라면 36페이지가 기준입니다. 사용자는 30초 동안 같은 화면을 보고 싶어 하지 않습니다. 10초마다 정보가 바뀌어야 합니다.",
  },
  {
    duration: 10,
    layout: "code",
    title: "프롬프트는 제작 JSON을 출력해야 한다",
    mark: "제작 JSON",
    caption: "프롬프트는 제작 JSON을 출력해야 한다.",
    code: [
      "{",
      '"page": 8,',
      '"layout": "code",',
      '"speech": "one exact narration beat",',
      '"duration_floor_seconds": 10',
      "}",
    ],
    speech:
      "프롬프트도 감상문이 아니라 제작 JSON을 내야 합니다. 페이지 번호, 레이아웃, 화면 문장, 내레이션, 최소 길이가 데이터로 나와야 합니다.",
  },
  {
    duration: 10,
    layout: "pipeline",
    title: "검수는 감이 아니라 숫자다",
    mark: "숫자",
    caption: "검수는 감이 아니라 숫자다.",
    steps: ["generate", "decode", "measure", "fail/pass", "sync"],
    speech:
      "검수는 느낌으로 하지 않습니다. 서버가 만든 WAV 길이를 실제로 계산하고, 전체 합산이 목표보다 짧으면 그 버전은 실패로 처리합니다.",
  },
  {
    duration: 10,
    layout: "qa",
    title: "짧으면 침묵 대신 설명을 늘린다",
    mark: "설명",
    caption: "짧으면 침묵 대신 설명을 늘린다.",
    rows: [
      ["total < target", "fail build"],
      ["thin page", "add example"],
      ["silent gap", "reject"],
    ],
    speech:
      "길이가 부족할 때 빈 시간을 넣으면 안 됩니다. 약한 페이지를 찾아 예시, 실패 조건, 다음 장면과의 연결을 넣어 내용을 늘립니다.",
  },
  {
    duration: 10,
    layout: "spectrum",
    title: "목소리는 한 버전 안에서 고정된다",
    mark: "고정",
    caption: "목소리는 한 버전 안에서 고정된다.",
    decision: "한 영상 안에서 voice를 섞지 않는다.",
    speech:
      "중요한 규칙은 이것입니다. 한 영상 안에서는 목소리가 하나여야 합니다. cedar 버전이면 36페이지 전체가 cedar로만 재생됩니다.",
  },
  {
    duration: 10,
    layout: "cards",
    title: "여러 목소리는 서로 다른 풀버전이다",
    mark: "풀버전",
    caption: "여러 목소리는 서로 다른 풀버전이다.",
    cards: [
      ["C", "cedar", "같은 36페이지 원고"],
      ["M", "marin", "같은 화면 흐름"],
      ["A", "alloy", "별도 URL 버전"],
    ],
    speech:
      "여러 목소리는 한 영상에서 섞는 옵션이 아닙니다. 같은 36페이지 원고를 cedar 버전, marin 버전처럼 따로 만든다는 뜻입니다.",
  },
  {
    duration: 10,
    layout: "clean",
    title: "큰 하단 자막은 제거한다",
    mark: "제거",
    caption: "큰 하단 자막은 제거한다.",
    frames: [
      ["no subtitle slab", "화면 아래를 덮지 않음"],
      ["small timecode", "진행만 표시"],
      ["scene content", "정보는 HTML 안에 배치"],
    ],
    speech:
      "하단을 덮던 큰 자막은 제거했습니다. 사용자가 봐야 하는 정보는 페이지 안의 카드, 표, 코드 패널, 흐름도에 들어갑니다.",
  },
  {
    duration: 10,
    layout: "render",
    title: "화면은 장면 단위로 검수한다",
    mark: "검수",
    caption: "화면은 장면 단위로 검수한다.",
    speech:
      "페이지가 많아질수록 렌더 검수가 중요합니다. 텍스트가 프레임 밖으로 나가지 않는지, 카드가 겹치지 않는지, 타임코드가 방해하지 않는지 봅니다.",
  },
  {
    duration: 10,
    layout: "flow",
    title: "도입부는 문제를 빨리 세운다",
    mark: "도입부",
    caption: "도입부는 문제를 빨리 세운다.",
    nodes: ["what", "why", "how", "proof", "next"],
    activeNode: 0,
    speech:
      "도입부는 오래 끌지 않습니다. 무엇을 만드는지, 왜 필요한지, 어떤 방식으로 해결하는지 빠르게 세워야 뒤 장면이 자연스럽게 이어집니다.",
  },
  {
    duration: 10,
    layout: "cards",
    title: "문제에서 원리로 넘어간다",
    mark: "원리",
    caption: "문제에서 원리로 넘어간다.",
    cards: [
      ["1", "problem", "화면과 말이 따로 움직임"],
      ["2", "principle", "audio controls timeline"],
      ["3", "result", "말과 장면이 같이 끝남"],
    ],
    speech:
      "문제를 보여준 뒤에는 바로 원리로 갑니다. 화면이 먼저 넘어가는 문제를 해결하려면, 말이 끝나는 시점을 화면 전환 기준으로 삼아야 합니다.",
  },
  {
    duration: 10,
    layout: "spec",
    title: "각 페이지는 1대1 매칭을 가진다",
    mark: "1대1",
    caption: "각 페이지는 1대1 매칭을 가진다.",
    specs: [
      ["page", "17"],
      ["screen", "one idea"],
      ["speech", "one beat"],
      ["next", "after audio"],
    ],
    speech:
      "말과 화면은 1대1로 맞아야 합니다. 한 페이지에는 하나의 시각 아이디어가 있고, 그 페이지의 내레이션도 같은 아이디어만 말합니다.",
  },
  {
    duration: 10,
    layout: "clock",
    title: "10초 리듬은 지루함을 줄인다",
    mark: "10초",
    caption: "10초 리듬은 지루함을 줄인다.",
    clock: "10s",
    note: "page rhythm with audio-safe extension",
    speech:
      "10초 리듬은 사용자가 따라오기 쉬운 단위입니다. 너무 빠르면 이해가 끊기고, 너무 느리면 같은 화면을 오래 보게 됩니다.",
  },
  {
    duration: 10,
    layout: "metrics",
    title: "한 페이지에는 한 아이디어만 둔다",
    mark: "한 아이디어",
    caption: "한 페이지에는 한 아이디어만 둔다.",
    metrics: [
      ["idea", "1"],
      ["copy", "short"],
      ["audio", "one"],
      ["motion", "clean"],
    ],
    speech:
      "한 페이지에 여러 설명을 넣지 않습니다. 한 아이디어, 한 화면 구조, 한 음성 구간으로 제한하면 다음 장면으로 넘어가는 흐름이 정리됩니다.",
  },
  {
    duration: 10,
    layout: "pipeline",
    title: "캐시는 voice별로 분리한다",
    mark: "voice별",
    caption: "캐시는 voice별로 분리한다.",
    steps: ["text", "voice", "hash", "wav", "version"],
    speech:
      "오디오 캐시는 원고만으로 나누지 않습니다. 같은 문장도 voice가 다르면 다른 버전이므로, 캐시 키에 voice를 함께 넣습니다.",
  },
  {
    duration: 10,
    layout: "qa",
    title: "목소리 섞임은 실패 조건이다",
    mark: "실패",
    caption: "목소리 섞임은 실패 조건이다.",
    rows: [
      ["one video", "one voice"],
      ["voice switch", "new version"],
      ["mixed cache", "reject"],
    ],
    speech:
      "한 영상 안에서 목소리가 섞이면 실패입니다. 선택을 바꾸는 순간 기존 재생과 백그라운드 생성을 끊고, 새 voice 버전으로 다시 준비해야 합니다.",
  },
  {
    duration: 10,
    layout: "compare",
    title: "샘플과 풀버전은 다르다",
    mark: "풀버전",
    caption: "샘플과 풀버전은 다르다.",
    panels: [
      { title: "Sample", lines: ["짧은 비교", "톤 확인", "빠른 선택"], tone: "muted" },
      { title: "Full Version", lines: ["36페이지", "같은 원고", "voice 고정"], tone: "hot" },
    ],
    speech:
      "짧은 샘플은 목소리를 고르기 위한 도구입니다. 실제 영상은 샘플이 아니라 36페이지 전체를 같은 voice로 만든 풀버전이어야 합니다.",
  },
  {
    duration: 10,
    layout: "clean",
    title: "화면 글자는 짧고 구조는 선명해야 한다",
    mark: "선명",
    caption: "화면 글자는 짧고 구조는 선명해야 한다.",
    frames: [
      ["short title", "한 줄 핵심"],
      ["visual proof", "카드와 숫자"],
      ["no clutter", "불필요한 자막 제거"],
    ],
    speech:
      "화면에는 긴 문단을 올리지 않습니다. 긴 설명은 음성이 맡고, 화면은 짧은 제목과 구조화된 정보로만 흐름을 보여줍니다.",
  },
  {
    duration: 10,
    layout: "render",
    title: "모바일에서도 장면이 깨지면 안 된다",
    mark: "모바일",
    caption: "모바일에서도 장면이 깨지면 안 된다.",
    speech:
      "데스크톱에서만 예쁜 화면은 부족합니다. 모바일 폭에서도 글자가 겹치지 않고, 카드가 화면 밖으로 밀리지 않아야 실제 템플릿으로 쓸 수 있습니다.",
  },
  {
    duration: 10,
    layout: "spec",
    title: "레이아웃은 장면 목적에 맞춘다",
    mark: "목적",
    caption: "레이아웃은 장면 목적에 맞춘다.",
    specs: [
      ["compare", "차이 설명"],
      ["clock", "시간 설명"],
      ["qa", "검수 설명"],
      ["final", "정리"],
    ],
    speech:
      "모든 페이지가 같은 카드 모양이면 지루합니다. 비교는 split board, 시간은 clock, 검수는 table처럼 목적에 맞는 HTML을 써야 합니다.",
  },
  {
    duration: 10,
    layout: "flow",
    title: "전환은 다음 질문으로 이어져야 한다",
    mark: "다음 질문",
    caption: "전환은 다음 질문으로 이어져야 한다.",
    nodes: ["claim", "because", "therefore", "check", "move"],
    activeNode: 3,
    speech:
      "장면 전환은 갑자기 바뀌면 안 됩니다. 한 페이지의 끝은 다음 페이지가 답할 질문을 남겨야 합니다. 그래야 36페이지가 하나의 흐름처럼 보입니다.",
  },
  {
    duration: 10,
    layout: "cards",
    title: "주제가 바뀌어도 구조는 유지된다",
    mark: "구조",
    caption: "주제가 바뀌어도 구조는 유지된다.",
    cards: [
      ["T", "topic", "새 주제 입력"],
      ["M", "manifest", "36페이지 생성"],
      ["V", "version", "voice별 풀버전"],
    ],
    speech:
      "이 시스템은 이 주제에만 묶이면 안 됩니다. 새 주제가 들어와도 36페이지 매니페스트와 voice별 풀버전 구조는 그대로 유지됩니다.",
  },
  {
    duration: 10,
    layout: "code",
    title: "짧은 페이지는 확장 규칙을 가진다",
    mark: "확장 규칙",
    caption: "짧은 페이지는 확장 규칙을 가진다.",
    code: [
      "if measured_duration < 10:",
      "  add concrete example",
      "  add failure condition",
      "  regenerate page audio",
      "  rebuild timeline",
    ],
    speech:
      "어떤 페이지가 10초보다 너무 짧으면, 침묵을 붙이는 대신 확장 규칙을 실행합니다. 예시나 실패 조건을 넣고 다시 생성합니다.",
  },
  {
    duration: 10,
    layout: "qa",
    title: "300초 미만은 자동 실패다",
    mark: "자동 실패",
    caption: "300초 미만은 자동 실패다.",
    rows: [
      ["runtime >= 300s", "pass"],
      ["runtime < 300s", "expand"],
      ["audio cut", "fail"],
    ],
    speech:
      "전체 길이도 숫자로 막아야 합니다. 300초 미만이면 성공이라고 말하지 않습니다. 원고를 늘리고, 바뀐 페이지의 음성을 다시 만듭니다.",
  },
  {
    duration: 10,
    layout: "spectrum",
    title: "기본 버전은 cedar로 고정한다",
    mark: "cedar",
    caption: "기본 버전은 cedar로 고정한다.",
    decision: "cedar is the default full-video version.",
    speech:
      "기본 풀버전은 cedar로 고정합니다. 설명형 영상에서는 너무 들뜨지 않고 안정적인 목소리가 낫습니다. 다른 voice는 별도 버전으로 봅니다.",
  },
  {
    duration: 10,
    layout: "metrics",
    title: "10개 목소리는 10개 버전이다",
    mark: "10개 버전",
    caption: "10개 목소리는 10개 버전이다.",
    metrics: [
      ["voices", "10"],
      ["pages", "36"],
      ["mixing", "0"],
      ["links", "10"],
    ],
    speech:
      "정리하면 목소리 10개는 옵션 10개가 아니라 버전 10개입니다. 각 버전은 같은 36페이지를 하나의 voice로만 재생합니다.",
  },
  {
    duration: 10,
    layout: "final",
    title: "렌더 경로는 하나로 유지한다",
    mark: "하나",
    caption: "렌더 경로는 하나로 유지한다.",
    route: ["prompt", "manifest", "html", "voice", "render"],
    stamp: "ONE RENDER PATH",
    speech:
      "렌더 경로는 하나여야 합니다. 프롬프트가 매니페스트를 만들고, HTML이 페이지를 만들고, voice 버전이 오디오를 만들고, 브라우저가 재생합니다.",
  },
  {
    duration: 10,
    layout: "pipeline",
    title: "생성, 측정, 동기화를 반복한다",
    mark: "반복",
    caption: "생성, 측정, 동기화를 반복한다.",
    steps: ["write", "speak", "measure", "sync", "review"],
    speech:
      "제작 루프는 반복됩니다. 원고를 쓰고, 음성을 만들고, 길이를 측정하고, 화면을 동기화하고, 브라우저에서 실제로 확인합니다.",
  },
  {
    duration: 10,
    layout: "clean",
    title: "사용자는 변화가 보여야 계속 본다",
    mark: "변화",
    caption: "사용자는 변화가 보여야 계속 본다.",
    frames: [
      ["every 10s", "새 페이지"],
      ["one idea", "짧은 화면"],
      ["voice synced", "말 끝난 뒤 전환"],
    ],
    speech:
      "사용자는 변화가 있어야 계속 봅니다. 그래서 30초짜리 정지 화면을 없애고, 10초마다 새로운 페이지가 나타나도록 나눴습니다.",
  },
  {
    duration: 10,
    layout: "render",
    title: "최종 검수는 브라우저에서 한다",
    mark: "브라우저",
    caption: "최종 검수는 브라우저에서 한다.",
    speech:
      "마지막 검수는 코드만 보지 않고 브라우저에서 합니다. 페이지 수, 하단 자막 제거, voice 고정, 장면 전환을 실제 화면에서 확인합니다.",
  },
  {
    duration: 10,
    layout: "final",
    title: "36페이지가 하나의 영상처럼 이어진다",
    mark: "36페이지",
    caption: "36페이지가 하나의 영상처럼 이어진다.",
    route: ["36 pages", "10 sec", "one voice", "audio sync", "complete"],
    stamp: "AUDIO-SYNCED FULL VERSION",
    speech:
      "결론은 간단합니다. 36페이지, 10초 리듬, 한 버전 안의 단일 voice, 오디오 기준 전환. 이 네 가지가 맞아야 볼만한 HTML TTS 영상이 됩니다.",
  },
];

const _topicScenes = [
  {
    duration: 10,
    layout: "hero",
    kicker: "OPENAI / APRIL 2026",
    title: "GPT-5.5는 무엇이 달라졌나",
    mark: "GPT-5.5",
    subtitle: "OpenAI 공식 발표 기준으로 보는 모델, 인프라, 안전성",
    caption: "GPT-5.5는 무엇이 달라졌나.",
    speech:
      "이번 영상은 OpenAI가 2026년 4월 23일 발표한 GPT-5.5를 공식 글 기준으로 정리합니다. 내부 비공개 레시피가 아니라, 공개된 모델 방향과 서비스 구조를 봅니다.",
  },
  {
    duration: 10,
    layout: "compare",
    title: "답변 모델보다 작업 모델에 가깝다",
    mark: "작업 모델",
    caption: "답변 모델보다 작업 모델에 가깝다.",
    panels: [
      { title: "Old expectation", lines: ["질문", "짧은 답", "사람이 다음 단계 관리"], tone: "muted" },
      { title: "GPT-5.5 direction", lines: ["복잡한 목표", "도구 사용", "끝까지 점검"], tone: "hot" },
    ],
    speech:
      "OpenAI는 GPT-5.5를 단순히 더 똑똑한 답변 모델로 설명하지 않습니다. 글쓰기, 코딩, 조사, 데이터 분석, 소프트웨어 조작까지 이어가는 작업 모델로 설명합니다.",
  },
  {
    duration: 10,
    layout: "spec",
    title: "핵심은 더 빨리 의도를 파악하는 것",
    mark: "의도",
    caption: "핵심은 더 빨리 의도를 파악하는 것.",
    specs: [
      ["intent", "earlier"],
      ["planning", "longer"],
      ["tools", "stronger"],
      ["checks", "keeps going"],
    ],
    speech:
      "공식 설명에서 중요한 문장은 사용자가 하려는 일을 더 빨리 이해한다는 점입니다. 그래서 단계를 하나씩 지시하기보다, 지저분한 작업을 맡기고 계획과 점검을 기대할 수 있습니다.",
  },
  {
    duration: 10,
    layout: "cards",
    title: "강점은 긴 작업 루프에 있다",
    mark: "긴 작업",
    caption: "강점은 긴 작업 루프에 있다.",
    cards: [
      ["C", "coding", "구현, 디버그, 테스트"],
      ["U", "computer use", "앱과 도구 조작"],
      ["R", "research", "증거 수집과 판단"],
    ],
    speech:
      "OpenAI가 강조한 강점은 agentic coding, computer use, knowledge work, scientific research입니다. 공통점은 한 번 답하고 끝나는 일이 아니라 오래 이어지는 작업이라는 점입니다.",
  },
  {
    duration: 10,
    layout: "metrics",
    title: "성능은 올라갔지만 지연은 유지했다",
    mark: "지연",
    caption: "성능은 올라갔지만 지연은 유지했다.",
    metrics: [
      ["intelligence", "up"],
      ["latency", "5.4 level"],
      ["tokens", "lower"],
      ["work", "longer"],
    ],
    speech:
      "흥미로운 부분은 속도입니다. OpenAI는 GPT-5.5가 GPT-5.4 수준의 실제 서빙 지연을 유지하면서 더 높은 지능을 제공한다고 설명합니다.",
  },
  {
    duration: 10,
    layout: "code",
    title: "Codex에서는 토큰 효율도 중요했다",
    mark: "토큰 효율",
    caption: "Codex에서는 토큰 효율도 중요했다.",
    code: ["same engineering task", "fewer tokens", "more checks", "less hand-holding", "higher completion quality"],
    speech:
      "Codex에서 중요한 변화는 단지 점수가 아닙니다. 공식 글은 GPT-5.5가 같은 Codex 작업을 더 적은 토큰으로 끝내는 경향도 강조합니다.",
  },
  {
    duration: 10,
    layout: "metrics",
    title: "Terminal-Bench 2.0: 82.7%",
    mark: "82.7%",
    caption: "Terminal-Bench 2.0은 82.7%로 발표됐다.",
    metrics: [
      ["GPT-5.5", "82.7%"],
      ["GPT-5.4", "75.1%"],
      ["domain", "coding"],
      ["style", "CLI work"],
    ],
    speech:
      "코딩 쪽에서는 Terminal-Bench 2.0 숫자가 큽니다. OpenAI 발표 기준 GPT-5.5는 82.7퍼센트, GPT-5.4는 75.1퍼센트입니다.",
  },
  {
    duration: 10,
    layout: "metrics",
    title: "SWE-Bench Pro: 58.6%",
    mark: "58.6%",
    caption: "SWE-Bench Pro는 58.6%로 공개됐다.",
    metrics: [
      ["SWE-Bench Pro", "58.6%"],
      ["GPT-5.4", "57.7%"],
      ["task", "GitHub issues"],
      ["note", "public eval"],
    ],
    speech:
      "SWE-Bench Pro에서는 GPT-5.5가 58.6퍼센트로 공개됐습니다. 실제 GitHub 이슈 해결에 가까운 작업을 얼마나 끝까지 수행하는지 보는 지표입니다.",
  },
  {
    duration: 10,
    layout: "metrics",
    title: "GDPval: 84.9%",
    mark: "84.9%",
    caption: "전문 지식 작업에서도 상승이 있었다.",
    metrics: [
      ["GDPval", "84.9%"],
      ["GPT-5.4", "83.0%"],
      ["scope", "44 jobs"],
      ["type", "knowledge work"],
    ],
    speech:
      "전문 지식 작업에서도 수치가 나옵니다. GDPval에서 GPT-5.5는 84.9퍼센트로 발표됐고, 이는 다양한 직업의 명세 있는 업무를 보는 평가입니다.",
  },
  {
    duration: 10,
    layout: "metrics",
    title: "OSWorld-Verified: 78.7%",
    mark: "78.7%",
    caption: "컴퓨터 사용 능력도 핵심 축이다.",
    metrics: [
      ["OSWorld", "78.7%"],
      ["GPT-5.4", "75.0%"],
      ["surface", "real apps"],
      ["goal", "operate"],
    ],
    speech:
      "computer use에서는 OSWorld-Verified가 중요합니다. GPT-5.5는 78.7퍼센트로, 실제 컴퓨터 환경에서 조작하고 목표를 달성하는 능력을 보여줍니다.",
  },
  {
    duration: 10,
    layout: "metrics",
    title: "BrowseComp: 84.4%",
    mark: "84.4%",
    caption: "온라인 조사도 발표된 강점 중 하나다.",
    metrics: [
      ["BrowseComp", "84.4%"],
      ["GPT-5.4", "82.7%"],
      ["skill", "browse"],
      ["mode", "evidence"],
    ],
    speech:
      "조사 능력도 포함됩니다. BrowseComp에서 GPT-5.5는 84.4퍼센트로 발표됐고, 이는 온라인에서 증거를 찾고 판단하는 능력과 연결됩니다.",
  },
  {
    duration: 10,
    layout: "flow",
    title: "연구에서는 질문에서 실험까지 간다",
    mark: "실험",
    caption: "연구에서는 질문에서 실험까지 간다.",
    nodes: ["question", "evidence", "analysis", "code", "result"],
    activeNode: 2,
    speech:
      "과학 연구 쪽 설명도 흥미롭습니다. OpenAI는 GPT-5.5가 질문에 답하는 것을 넘어, 증거를 모으고 분석하고 다음 실험을 제안하는 루프에 강하다고 설명합니다.",
  },
  {
    duration: 10,
    layout: "cards",
    title: "공식 글은 GeneBench와 BixBench를 언급한다",
    mark: "GeneBench",
    caption: "GeneBench와 BixBench가 연구 평가로 언급됐다.",
    cards: [
      ["G", "GeneBench", "유전학 데이터 분석"],
      ["B", "BixBench", "바이오인포매틱스"],
      ["L", "loop", "분석과 해석 반복"],
    ],
    speech:
      "공식 발표는 GeneBench와 BixBench 같은 과학 평가도 언급합니다. 핵심은 어려운 데이터 분석을 여러 단계로 이어가는 능력입니다.",
  },
  {
    duration: 10,
    layout: "spec",
    title: "만드는 방식은 모델만의 문제가 아니다",
    mark: "모델만",
    caption: "만드는 방식은 모델만의 문제가 아니다.",
    specs: [
      ["model", "reasoning"],
      ["serving", "latency"],
      ["hardware", "GB200 / GB300"],
      ["stack", "co-designed"],
    ],
    speech:
      "GPT-5.5를 만든다는 말은 모델 파일 하나를 만든다는 뜻으로 끝나지 않습니다. OpenAI는 훈련과 서빙, 하드웨어, 추론 스택을 함께 설계했다고 설명합니다.",
  },
  {
    duration: 10,
    layout: "flow",
    title: "GB200과 GB300 NVL72 위에서 설계됐다",
    mark: "GB200",
    caption: "GB200과 GB300 NVL72가 인프라로 언급됐다.",
    nodes: ["train", "serve", "GB200", "GB300", "latency"],
    activeNode: 2,
    speech:
      "공식 글은 GPT-5.5가 NVIDIA GB200과 GB300 NVL72 시스템에 맞춰 공동 설계되고, 훈련되고, 서빙됐다고 말합니다.",
  },
  {
    duration: 10,
    layout: "compare",
    title: "추론 효율은 따로 떼어낼 수 없다",
    mark: "추론 효율",
    caption: "추론 효율은 전체 시스템 문제다.",
    panels: [
      { title: "Isolated tuning", lines: ["모델만 최적화", "서빙은 나중", "병목 숨김"], tone: "muted" },
      { title: "Integrated system", lines: ["모델", "하드웨어", "트래픽"], tone: "hot" },
    ],
    speech:
      "OpenAI는 GPT-5.4 수준의 지연을 유지하려면 추론을 여러 최적화 조각이 아니라 통합 시스템으로 다시 봐야 했다고 설명합니다.",
  },
  {
    duration: 10,
    layout: "code",
    title: "트래픽 분할 휴리스틱도 개선됐다",
    mark: "휴리스틱",
    caption: "트래픽 분할과 부하 분산이 개선됐다.",
    code: [
      "production traffic patterns",
      "partition requests",
      "balance GPU work",
      "reduce wasted capacity",
      "serve smarter model at speed",
    ],
    speech:
      "구체적인 예로는 부하 분산과 파티셔닝 휴리스틱이 나옵니다. Codex가 생산 트래픽 패턴을 분석하고 더 나은 분할 방식을 만드는 데 도움을 줬다고 설명합니다.",
  },
  {
    duration: 10,
    layout: "cards",
    title: "모델이 자신을 서빙하는 스택도 도왔다",
    mark: "스택",
    caption: "GPT-5.5는 인프라 개선에도 쓰였다.",
    cards: [
      ["C", "Codex", "실험을 빠르게 배선"],
      ["5.5", "GPT-5.5", "스택 개선점 제안"],
      ["I", "infra", "서빙 목표 달성"],
    ],
    speech:
      "공식 글에서 재미있는 표현은 모델이 자신을 서빙하는 인프라 개선에도 도움을 줬다는 점입니다. 다만 이것은 공개된 서빙 최적화 맥락으로만 봐야 합니다.",
  },
  {
    duration: 10,
    layout: "qa",
    title: "안전성은 출시 전 절차의 핵심이다",
    mark: "안전성",
    caption: "안전성은 출시 전 절차의 핵심이다.",
    rows: [
      ["preparedness", "evaluated"],
      ["red teaming", "internal + external"],
      ["domains", "bio + cyber"],
    ],
    speech:
      "출시 과정에서 안전성도 큰 축입니다. 시스템 카드에 따르면 GPT-5.5는 배포 전 안전 평가와 Preparedness Framework, 그리고 사이버와 생물학 역량에 대한 타깃 레드팀을 거쳤습니다.",
  },
  {
    duration: 10,
    layout: "qa",
    title: "사이버와 생물학은 High로 다뤄졌다",
    mark: "High",
    caption: "사이버와 생물학 역량은 High로 취급됐다.",
    rows: [
      ["biology / chemistry", "High"],
      ["cybersecurity", "High"],
      ["critical cyber", "not reached"],
    ],
    speech:
      "OpenAI는 GPT-5.5의 생물학과 화학, 그리고 사이버 보안 역량을 High로 취급한다고 설명합니다. 동시에 Critical 사이버 수준에는 도달하지 않았다고 밝힙니다.",
  },
  {
    duration: 10,
    layout: "spectrum",
    title: "강한 모델일수록 접근 제어가 중요하다",
    mark: "접근 제어",
    caption: "강한 모델일수록 접근 제어가 중요하다.",
    decision: "capability up -> safeguards up",
    speech:
      "능력이 올라가면 접근 제어도 같이 올라가야 합니다. GPT-5.5 발표에는 더 엄격한 분류기, 반복 오용 보호, 검증된 방어 목적 접근 같은 내용이 들어 있습니다.",
  },
  {
    duration: 10,
    layout: "spec",
    title: "ChatGPT와 Codex에 먼저 배포됐다",
    mark: "Codex",
    caption: "ChatGPT와 Codex 배포가 발표됐다.",
    specs: [
      ["ChatGPT", "Plus / Pro / Business / Enterprise"],
      ["Codex", "Plus through Go"],
      ["context", "400K in Codex"],
      ["Pro", "harder work"],
    ],
    speech:
      "제품 배포도 명확합니다. GPT-5.5는 ChatGPT와 Codex에 배포됐고, Codex에서는 400K 컨텍스트 윈도우가 공식 글에 언급됩니다.",
  },
  {
    duration: 10,
    layout: "metrics",
    title: "API는 4월 24일 업데이트로 제공됐다",
    mark: "API",
    caption: "4월 24일 API 제공 업데이트가 있었다.",
    metrics: [
      ["announce", "Apr 23"],
      ["API update", "Apr 24"],
      ["model", "gpt-5.5"],
      ["pro", "gpt-5.5-pro"],
    ],
    speech:
      "공식 글에는 2026년 4월 24일 업데이트도 있습니다. GPT-5.5와 GPT-5.5 Pro가 API에서 사용 가능해졌고, 시스템 카드도 추가 safeguards 설명으로 갱신됐습니다.",
  },
  {
    duration: 10,
    layout: "compare",
    title: "핵심 변화는 사용자가 덜 관리한다는 점이다",
    mark: "덜 관리",
    caption: "핵심 변화는 사용자가 덜 관리한다는 점이다.",
    panels: [
      { title: "Before", lines: ["작업 쪼개기", "중간 확인", "수동 재시도"], tone: "muted" },
      { title: "GPT-5.5", lines: ["계획", "도구 사용", "자체 점검"], tone: "hot" },
    ],
    speech:
      "사용자 경험으로 보면 핵심은 사용자가 덜 관리한다는 점입니다. 모델이 계획하고 도구를 쓰고, 모호한 부분을 지나가며, 끝까지 점검하는 쪽으로 이동했습니다.",
  },
  {
    duration: 10,
    layout: "flow",
    title: "좋은 사용법은 목표와 검수 조건을 같이 주는 것",
    mark: "검수 조건",
    caption: "목표와 검수 조건을 같이 줘야 한다.",
    nodes: ["goal", "context", "tools", "checks", "done"],
    activeNode: 3,
    speech:
      "이런 모델을 잘 쓰려면 단순한 질문보다 목표와 검수 조건을 같이 줘야 합니다. 어떤 파일을 봐야 하는지, 무엇을 증거로 볼지, 언제 끝났다고 할지 알려주는 식입니다.",
  },
  {
    duration: 10,
    layout: "qa",
    title: "주의할 점은 공개된 사실만 말하는 것이다",
    mark: "공개된 사실",
    caption: "공개된 사실만 말해야 한다.",
    rows: [
      ["training recipe", "not public"],
      ["serving details", "partly public"],
      ["evals", "published"],
    ],
    speech:
      "GPT-5.5를 만드는 영상을 만들 때 주의할 점도 있습니다. 학습 데이터나 내부 레시피를 아는 척하면 안 됩니다. 공개된 평가, 인프라, 안전성, 배포 사실만 말해야 합니다.",
  },
  {
    duration: 10,
    layout: "pipeline",
    title: "정리하면 네 축이다",
    mark: "네 축",
    caption: "정리하면 네 축이다.",
    steps: ["model", "tools", "infra", "safety", "product"],
    speech:
      "정리하면 GPT-5.5 발표는 네 축으로 볼 수 있습니다. 더 오래 일하는 모델, 더 강한 도구 사용, 더 효율적인 인프라, 더 강한 안전 장치입니다.",
  },
  {
    duration: 10,
    layout: "clean",
    title: "이 영상은 발표를 작업 흐름으로 번역한다",
    mark: "작업 흐름",
    caption: "발표를 작업 흐름으로 번역한다.",
    frames: [
      ["what changed", "작업 모델"],
      ["how served", "통합 인프라"],
      ["how released", "안전성과 배포"],
    ],
    speech:
      "이 영상의 목적은 발표문을 그대로 읽는 것이 아닙니다. GPT-5.5가 왜 작업 모델로 설명되는지, 어떻게 서빙되고, 어떤 안전 절차를 거쳤는지 흐름으로 번역하는 것입니다.",
  },
  {
    duration: 10,
    layout: "final",
    title: "GPT-5.5는 긴 작업을 맡기는 방향의 모델이다",
    mark: "긴 작업",
    caption: "GPT-5.5는 긴 작업을 맡기는 방향의 모델이다.",
    route: ["intent", "tools", "infra", "safety", "work"],
    stamp: "GPT-5.5: REAL WORK MODEL",
    speech:
      "결론입니다. GPT-5.5의 핵심은 더 좋은 한 문장 답변이 아니라, 긴 작업을 맡기고 도구와 검수를 포함해 끝까지 진행하게 하는 방향입니다.",
  },
];

const PAGE_SECONDS = 10;

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
    const frames = scene.frames?.length
      ? scene.frames
      : [
          ["핵심", scene.title || "main point"],
          ["근거", scene.claim || scene.caption || "source backed"],
          ["다음", scene.caption || "next"],
        ];
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
const VISUAL_THEME_IDS = ["studio", "blueprint", "paper", "terminal", "minimal"];
const VISUAL_THEME_PALETTES = {
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
let selectedVisualTheme = normalizeVisualTheme(params.get("theme") || "studio");
let warmupToken = 0;
const audioBufferCache = new Map();
const audioBufferPromises = new Map();
const previewBufferCache = new Map();
const previewBufferPromises = new Map();
let currentManifest = {
  title: "Topic brief first",
  subtitle: "주제, 출처, 생성 프롬프트를 먼저 확인한 뒤 영상을 만든다",
  topic: "OpenAI GPT-5.5 발표 내용과 개발 방식",
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
  return VISUAL_THEME_IDS.includes(value) ? value : "studio";
}

function applyVisualTheme(theme, options = {}) {
  selectedVisualTheme = normalizeVisualTheme(theme);
  appShell.dataset.visualTheme = selectedVisualTheme;
  if (visualThemeSelect) visualThemeSelect.value = selectedVisualTheme;
  if (options.updateUrl === false) return;
  const url = new URL(window.location.href);
  url.searchParams.set("theme", selectedVisualTheme);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function currentVisualPalette() {
  return VISUAL_THEME_PALETTES[selectedVisualTheme] || VISUAL_THEME_PALETTES.studio;
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
  if (/fallback/i.test(route)) {
    return "AI 생성이 로컬 템플릿으로 떨어졌습니다. 잘못된 주제 영상이 될 수 있어서 막았습니다.";
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
  if (briefTitle) briefTitle.textContent = "Review before generation";
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
  if (prevSceneBtn) prevSceneBtn.disabled = activeSceneIndex <= 0;
  if (nextSceneBtn) nextSceneBtn.disabled = activeSceneIndex >= scenes.length - 1;
  if (sceneCounter) {
    sceneCounter.textContent = `${String(activeSceneIndex + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}`;
  }
}

function updateView(options = {}) {
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
  isLoadingSpeech = true;
  stopSpeech();
  isLoadingSpeech = true;
  const scene = scenes[activeSceneIndex];
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
  pause();
  currentTime = 0;
  activeSceneIndex = 0;
  updateView();
  await play();
}

async function jumpToScene(index, options = {}) {
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

function drawSceneCanvas(ctx, scene, index, sceneProgress, totalProgress) {
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
    const frameItems = scene.frames?.length
      ? scene.frames
      : [
          ["핵심", scene.title || "main point"],
          ["근거", scene.claim || scene.caption || "source backed"],
          ["다음", scene.caption || "next"],
        ];
    [
      [360, 500, 650, 300],
      [1060, 535, 410, 265],
      [1510, 575, 210, 225],
    ].forEach(([x, y, cardWidth, cardHeight], i) => {
      const [head, body] = frameItems[i] || frameItems[0] || ["핵심", scene.title];
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
      body: JSON.stringify({ topic, style, notes, sceneCount: 30, targetSeconds: 300 }),
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
      ? "Loading verified default video..."
      : "Researching sources, generating scenes, then running quality gate...",
  );
  if (downloadLink) downloadLink.hidden = true;
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic, voice, style, notes, sceneCount: 30, targetSeconds: 300 }),
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
