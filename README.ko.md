# OpenFMV

<p align="center">
  <img src="./public/logo.png" alt="OpenFMV Logo" width="128" />
</p>

<p align="center">
  <mark><strong>이 프로젝트는 빠르게 발전하고 있습니다. 앞으로의 업데이트를 기대해 주세요.</strong></mark>
</p>

<p align="center">
  <a href="./readme.md">English</a> · <a href="./README.zh-CN.md">简体中文</a> · <a href="./README.ja.md">日本語</a> · 한국어
</p>

OpenFMV는 인터랙티브 영상, 분기형 내러티브, 인터랙티브 숏드라마, 로컬에서 재생할 수 있는 스토리 경험을 만들기 위한 AI Native 인터랙티브 콘텐츠 에디터입니다.

핵심은 노드 단위 FlowTimeline입니다. 각 장면에는 미디어 트랙뿐 아니라 버튼, 핫스팟, 일시정지 게이트, 시간 지정 분기, 변수 액션을 위한 인터랙션 트랙을 둘 수 있습니다. 블루프린트 그래프는 이런 인터랙티브 장면을 연결하는 상위 수준의 맵 역할을 합니다. 로컬 에셋, 미리보기, 내보내기, AI 보조 제작은 로컬 우선 Next.js + Electron 데스크톱 앱 안에 유지됩니다. 프로젝트, 가져온 미디어, 타임라인 데이터, 생성된 패키지는 모두 사용자의 기기에 저장됩니다. 계정 시스템, 호스팅 데이터베이스, 클라우드 스토리지에 의존하지 않습니다.

![OpenFMV 에디터 개요](./public/readme/openfmv-editor-overview.png)

## 제품 하이라이트

<table>
  <tr>
    <td width="25%" valign="top">
      <img src="./public/readme/feature-readme-preview.png" alt="노드 인터랙션 타임라인" width="100%" />
      <br />
      <strong>노드 인터랙션 트랙</strong><br />
      각 장면 안에 미디어, 버튼, 핫스팟, 일시정지 게이트, 분기, 변수 액션을 겹쳐 구성합니다.
    </td>
    <td width="25%" valign="top">
      <img src="./public/readme/feature-readme-blueprint.png" alt="비주얼 스토리 맵" width="100%" />
      <br />
      <strong>비주얼 스토리 맵</strong><br />
      인터랙티브 장면을 블루프린트로 연결해 분기, 출력, 스토리 흐름을 정리합니다.
    </td>
    <td width="25%" valign="top">
      <img src="./public/readme/feature-readme-assets.png" alt="로컬 에셋 관리" width="100%" />
      <br />
      <strong>로컬 에셋 라이브러리</strong><br />
      비디오, 이미지, 오디오, 텍스트 에셋을 로컬 프로젝트 폴더로 가져옵니다.
    </td>
    <td width="25%" valign="top">
      <img src="./public/readme/feature-readme-export.png" alt="로컬 내보내기" width="100%" />
      <br />
      <strong>로컬 내보내기</strong><br />
      미디어 참조를 로컬로 유지하면서 재생 가능한 인터랙티브 콘텐츠를 패키징합니다.
    </td>
  </tr>
</table>

## 만들 수 있는 것

- 인터랙티브 영상과 분기형 내러티브 프로토타입
- 선택에 따라 재생이 달라지는 인터랙티브 숏드라마 장면
- 데모, 리뷰, 실험을 위한 로컬 재생 가능 스토리 패키지
- 프로젝트 데이터를 로컬에 유지하는 AI 보조 내러티브 제작 워크플로

## 제작 워크플로

1. 프로젝트 워크스페이스에서 로컬 프로젝트를 만들거나 엽니다.
2. 원본 미디어를 로컬 에셋 라이브러리로 가져옵니다.
3. `/nodes`에서 FlowTimeline으로 각 장면의 미디어 트랙과 인터랙션 트랙을 편집합니다.
4. 버튼, 핫스팟, 일시정지 게이트, 시간 지정 분기, 변수 액션을 인터랙션 클립으로 추가합니다.
5. 스토리 흐름에 분기 구조가 필요해지면 `/editor` 블루프린트 그래프에서 장면을 연결합니다.
6. 인터랙티브 재생을 미리 보고, 공유하거나 테스트할 준비가 되면 로컬 재생 가능 패키지를 내보냅니다.

## 제품 둘러보기

### 인터랙티브 재생 미리보기

시청자가 스토리 안에서 어떻게 이동하는지 미리 봅니다. 버튼 선택, 장면 전환, 인터랙티브 재생을 맥락 안에서 확인하는 공간입니다.

![OpenFMV 재생 미리보기](./public/readme/openfmv-play-preview.png)

### 로컬 프로젝트 워크스페이스

로컬 초안, 프로젝트 템플릿, 최근 작업에서 시작합니다. OpenFMV는 호스팅 워크스페이스가 아니라 로컬 프로젝트 파일을 중심으로 설계되었습니다.

![OpenFMV 프로젝트 워크스페이스](./public/readme/openfmv-projects.jpg)

### 스토리 블루프린트 에디터

에디터는 상위 수준의 스토리 맵입니다. 스토리 흐름, 노드 관계, 분기 출력, 노드 프롬프트, 장면 메타데이터를 담당합니다.

![OpenFMV 스토리 블루프린트](./public/readme/openfmv-editor-overview.png)

### AI Native 설정

OpenFMV는 로컬 AI 터미널과 모델 서비스와 함께 작동하도록 설계되었습니다. AI 레이어는 프로젝트 저장소를 로컬에 유지하면서 글쓰기, 아이디어 도출, 편집 워크플로를 돕는 것을 목표로 합니다.

![OpenFMV AI 설정](./public/readme/openfmv-aiconfig-preview.jpg)

### 비주얼 스토리 프리셋

프리셋 콘텐츠는 인터랙티브 스토리 실험과 시각적 방향을 빠르게 시작하는 출발점이 될 수 있습니다.

![OpenFMV 기본 스토리 프리셋](./public/readme/default-story-preset.png)

## 핵심 기능

- **FlowTimeline 장면 편집:** 각 노드를 독립적인 타임라인으로 편집하고 미디어 트랙과 인터랙션 트랙을 다룹니다.
- **인터랙션 클립:** 버튼, 핫스팟, 일시정지 게이트, 시간 지정 분기, 변수 액션을 타임라인 클립으로 추가합니다.
- **블루프린트 그래프 편집:** 핸들, 엣지, 분기 출력으로 인터랙티브 노드를 비선형 스토리 흐름에 연결합니다.
- **로컬 미디어 워크플로:** 가져온 파일을 로컬 프로젝트 에셋 폴더로 복사하고 내보내기까지 해당 참조를 유지합니다.
- **AI 보조 제작:** 사용자 계정이나 클라우드 동기화를 추가하지 않고 로컬 AI 엔진을 설정해 어시스턴트 워크플로를 사용할 수 있습니다.
- **데스크톱 우선 경험:** 로컬 Next.js standalone 서비스가 뒷받침하는 Electron 패키지 앱으로 실행됩니다.

## 현재 범위

OpenFMV는 의도적으로 로컬 우선을 지향합니다. 현재 제품에는 로그인, 다중 사용자 협업, 클라우드 동기화, 클라우드 데이터베이스, 호스팅 미디어 라이브러리, 타사 플랫폼으로의 원클릭 게시가 포함되어 있지 않습니다.

AI 기능은 보조 용도입니다. 스크립트, 스토리보드, 시각 에셋, 인터랙션 로직을 처음부터 끝까지 완전히 자동 생성하는 기능은 아직 제공하지 않습니다.

내보내기는 로컬 재생 가능 패키지와 데스크톱 앱 배포 워크플로에 초점을 둡니다. 완전한 Windows EXE 스토리 패키징은 현재 제품 범위에 포함되지 않습니다.

## 기술 스택

- **프레임워크:** Next.js 16 App Router, React, TypeScript
- **데스크톱 셸:** Electron
- **그래프 편집:** React Flow
- **상태 관리:** Zustand와 로컬 브라우저 스토리지
- **스타일링:** Tailwind CSS와 `openfmv-*` 디자인 토큰
- **영속성:** 로컬 OpenFMV 프로젝트 JSON 파일과 복사된 로컬 에셋
- **런타임:** 미리보기와 내보내기에서 공유하는 그래프 런타임

## 빠른 시작

### 요구 사항

- Node.js 20 이상
- npm
- 현재 데스크톱 패키징은 Windows를 주요 대상으로 합니다

### 설치

```bash
npm install
```

### Web 앱 시작

```bash
npm run dev
```

그런 다음 `http://localhost:3000`을 엽니다.

### 데스크톱 앱 개발 모드 시작

```bash
npm run desktop:dev
```

### Next.js 앱 빌드

```bash
npm run build
```

### 데스크톱 앱 패키징

```bash
npm run package:desktop
```

패키징된 데스크톱 앱은 백그라운드에서 로컬 Next.js standalone 서비스를 시작하고, 서비스가 준비되면 메인 인터페이스를 엽니다. 로컬 서비스에 연결할 수 없는 경우 OpenFMV는 런타임 로그 경로가 포함된 진단 오류 페이지를 표시합니다.

## 자주 사용하는 명령

```bash
npm run dev
npm run desktop
npm run desktop:dev
npm run desktop:standalone
npm run build
npm run package:desktop
npm run lint
npm run test:run
```

단일 테스트 파일 실행:

```bash
npx vitest path/to/test.test.ts
```

단일 테스트 이름으로 실행:

```bash
npx vitest path/to/test.test.ts -t "test name"
```

## 프로젝트 구조

```text
app/
  _components/          React 컴포넌트
    editor/             블루프린트 에디터 UI
    local/              데스크톱/로컬 프로젝트 UI
    nodes/              React Flow 노드 컴포넌트
    player/             플레이어와 미리보기 UI
    ui/                 공유 UI 프리미티브
  _features/
    node-timeline/      NodeTimeline v2 schema, UI, commands, snapping, playback
  _hooks/               React hooks
  _store/               Zustand stores
  _types/               공유 TypeScript 타입
  _utils/               런타임과 그래프 유틸리티
  api/                  로컬 Next.js API routes
  editor/               블루프린트 에디터 라우트
  nodes/                노드 단위 타임라인 에디터 라우트
  play/[id]/            플레이어 라우트
  projects/             프로젝트 워크스페이스 라우트
electron/
  main.js               Electron 메인 프로세스와 로컬 서비스 부트스트랩
  preload.js            Electron preload bridge
  exporter.js           로컬 재생 가능 패키지 내보내기 도구
public/
  readme/               README 스크린샷
shared/
  runtimeCore.mjs       플레이어와 내보내기 도구가 공유하는 런타임
messages/
  *.json                next-intl 로케일 파일
__tests__/
  unit/                 Vitest 단위 테스트
```

## 프로젝트 파일

OpenFMV는 프로젝트를 로컬 프로젝트 파일과 복사된 로컬 에셋으로 저장합니다. 가져온 미디어는 프로젝트 에셋 폴더에 있어야 하며, 기존 노드 단위 미디어 필드가 아니라 `node.data.timeline`에서 참조해야 합니다.

노드 타임라인 모델은 미디어와 인터랙션의 주요 모델입니다.

- 미디어 트랙에는 비디오, 이미지, 오디오 클립이 포함됩니다.
- 인터랙션 트랙에는 버튼, 핫스팟, 일시정지 게이트, 텍스트, 분기, 변수 클립이 포함됩니다.
- 런타임 미리보기와 내보내기는 타임라인 모델에서 컴파일됩니다.

## 내보내기와 패키징

OpenFMV 내보내기는 타임라인 클립의 미디어 경로를 로컬 재생 가능 패키지용으로 다시 씁니다. 타임라인 클립의 `src`와 `poster` 값은 내보내기 중 복사되고 재작성됩니다.

데스크톱 패키징은 Electron Builder를 사용합니다. 생성된 실행 파일, 설치 프로그램, unpacked 앱 폴더는 `dist/`에 기록되고 git에서 무시됩니다.

데스크톱 아이콘은 패키징 전에 `public/logo.png`에서 생성됩니다.

```text
build/icons/icon.ico
build/icons/icon.png
```

## 개발 참고

- 타임라인 동작은 `app/_features/node-timeline/`에 둡니다.
- 공유 런타임 동작은 `shared/runtimeCore.mjs`에 둡니다.
- 플레이어 UI는 `app/_components/player/`에 둡니다.
- 로컬 데스크톱 UI는 `app/_components/local/`에 둡니다.
- 제품 범위가 명확히 바뀌지 않는 한 호스팅 백엔드, 사용자 계정, 클라우드 스토리지, 동기화 기능을 추가하지 마세요.

## 기여

OpenFMV는 여전히 빠르게 변화하고 있습니다. 변경 사항은 집중된 범위로 유지하고, 로컬 우선 원칙과 타임라인 기반 아키텍처에 맞춰 주세요.

## 감사

OpenFMV는 Next.js, Electron, React Flow, Zustand, Tailwind CSS, 그리고 더 넓은 오픈소스 JavaScript 생태계를 바탕으로 만들어졌습니다.

OpenFMV는 영감과 참고가 된 다음 오픈소스 프로젝트에도 감사드립니다.

- [OpenCut-app/OpenCut](https://github.com/OpenCut-app/OpenCut)
- [nexu-io/open-design](https://github.com/nexu-io/open-design)

## 라이선스

MIT
