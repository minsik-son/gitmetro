# GitMetro 전체 뼈대 구성 및 Claude Design Prompt v1

작성일: 2026-05-01
작성 목적: GitHub 저장소 링크를 입력하면 브랜치와 커밋 흐름을 지하철 노선도 또는 게임 스킬트리처럼 한눈에 보여주는 GitMetro의 초기 제품 구조와 Claude Design용 프롬프트를 정리한다.

중요 운영 규칙:
- 이 문서는 설계와 디자인 프롬프트 문서이다.
- 실제 React, Node.js, TailwindCSS, TypeScript 코딩은 사용자의 별도 승인 전까지 시작하지 않는다.
- 기존에 생성된 md 파일은 수정하지 않는다.
- 후속 수정이 필요하면 `v2`, `v3`처럼 새 파일로 추가 생성한다.

---

## 1. GitMetro 제품 한 줄 정의

GitMetro는 GitHub 저장소의 브랜치, 커밋, 머지 흐름을 개발자에게 익숙한 지하철 노선도 또는 게임 스킬트리 형태로 시각화해서, 복잡한 저장소 히스토리를 빠르게 이해하게 만드는 웹사이트이다.

핵심 비유:
- `main` 또는 `master`: 중앙을 관통하는 메인 지하철 노선
- `develop`, `release`, `feature/*`, `hotfix/*`: 메인에서 갈라지는 보조 노선
- commit: 지하철 역 또는 스킬 노드
- merge commit: 환승역 또는 합류 스킬 노드
- branch head: 현재 노선의 종착역
- PR 또는 tag: 역 주변의 보조 배지

---

## 2. MVP 제품 흐름

### 2.1 첫 진입 화면

목표:
- 복잡한 설명 없이 바로 GitHub 저장소를 입력하게 만든다.
- 서비스 이름 `GitMetro`가 첫 화면에서 강하게 인식되어야 한다.

구성 요소:
- 상단 또는 중앙의 `GitMetro` 로고 타입
- 한 줄 설명: `Turn Git branches into a readable metro map.`
- GitHub 저장소 입력창
  - 지원 입력 예시: `https://github.com/facebook/react`, `facebook/react`
  - Enter 입력 시 로딩 화면으로 이동
- GitHub OAuth 로그인 버튼
  - 공개 저장소는 로그인 없이 가능하게 시작할 수 있다.
  - Private 저장소와 API Rate Limit 완화를 위해 로그인 진입점을 제공한다.
- 최근 입력 저장소 또는 샘플 저장소 영역은 MVP 후순위로 둔다.

### 2.2 로딩 화면

목표:
- GitHub 데이터를 읽고 분석하는 과정이 느껴지도록 터미널 기반 애니메이션을 보여준다.
- 단순 스피너가 아니라 개발자 도구 같은 감각을 준다.

구성 요소:
- 터미널 패널
- 단계별 로그 애니메이션
  - `Parsing repository URL...`
  - `Fetching branches...`
  - `Reading commit graph...`
  - `Detecting merge stations...`
  - `Building metro layout...`
- 진행률 바 또는 커서 깜빡임
- 실패 시 명확한 에러 메시지
  - 저장소 없음
  - 권한 없음
  - API Rate Limit
  - 너무 큰 저장소라 요약 모드 필요

### 2.3 메인 맵 화면

목표:
- 저장소의 브랜치 구조가 첫눈에 들어와야 한다.
- 세부 커밋 정보는 hover 또는 click으로 필요할 때만 드러난다.

주요 레이아웃:
- 상단 툴바
  - 저장소명
  - 현재 테마 선택
  - Export 버튼
  - GitHub에서 열기 버튼
  - Dark/Light 모드 토글
- 왼쪽 필터 패널
  - 브랜치 타입별 토글: main, develop, feature, hotfix, release, 기타
  - 브랜치 검색
  - 타임라인 범위 선택
  - 커밋 수 제한 또는 요약 모드
- 중앙 시각화 캔버스
  - pan & zoom 지원
  - 메인 라인은 굵고 안정적인 수평선
  - 보조 브랜치는 메인에서 분기 후 다시 합류
  - merge commit은 환승역 스타일
  - 커밋 노드는 지하철 역처럼 표현
- 오른쪽 인스펙터 패널
  - 선택한 commit 또는 branch 상세 정보
  - commit hash, author, date, message, changed files, PR link
  - 선택 전에는 저장소 요약 정보 표시

---

## 3. 정보 구조 IA

권장 화면 단위:
- `/`: 저장소 입력 랜딩
- `/loading`: 분석 중 화면
- `/map/:owner/:repo`: 시각화 화면
- `/auth/callback`: GitHub OAuth 콜백
- `/error`: 권한, 입력, API 실패 안내

MVP 이후 확장:
- `/gallery`: 샘플 저장소 또는 공개 맵 갤러리
- `/settings`: 테마, OAuth, export 설정
- `/share/:mapId`: 공유 가능한 정적 맵

---

## 4. 데이터 파이프라인 뼈대

### 4.1 입력 파싱

입력값:
- `https://github.com/{owner}/{repo}`
- `github.com/{owner}/{repo}`
- `{owner}/{repo}`

결과:
- `owner`
- `repo`
- 입력 유효성 상태

### 4.2 GitHub 데이터 수집

필요 데이터:
- 저장소 메타데이터
- 브랜치 목록
- 각 브랜치의 head commit
- commit 목록과 parent 관계
- merge commit 여부
- PR 정보
- tag 정보
- commit author, date, message
- 가능하면 changed files count

권장 전략:
- 공개 저장소는 unauthenticated GitHub API로 시작 가능
- OAuth 로그인 시 private repo와 더 높은 rate limit 지원
- 대형 저장소는 전체 커밋을 한 번에 가져오지 않고 최근 N개 또는 기간 필터로 제한
- 백엔드에서 GitHub API 호출과 정규화를 담당하고, 프론트엔드는 정규화된 그래프 데이터를 받는다.

### 4.3 정규화 데이터 모델

CommitNode:
- `sha`
- `shortSha`
- `parents`
- `children`
- `message`
- `authorName`
- `authorAvatarUrl`
- `committedAt`
- `branchRefs`
- `tags`
- `pullRequest`
- `changedFilesCount`
- `isMergeCommit`
- `nodeType`: `commit`, `merge`, `branch-head`, `tagged`

BranchLine:
- `id`
- `name`
- `category`: `main`, `develop`, `feature`, `hotfix`, `release`, `other`
- `color`
- `commitShas`
- `startCommitSha`
- `headCommitSha`
- `mergedInto`
- `isActive`
- `laneIndex`

GraphEdge:
- `from`
- `to`
- `type`: `commit`, `branch`, `merge`
- `branchId`

LayoutNode:
- `commitSha`
- `x`
- `y`
- `laneIndex`
- `importance`
- `visible`
- `clusterId`

---

## 5. 시각화 레이아웃 원칙

### 5.1 Metro Map 모드

원칙:
- `main`은 중앙 수평 노선으로 고정한다.
- 시간 또는 topological order 기준으로 왼쪽에서 오른쪽으로 흐르게 한다.
- 보조 브랜치는 main에서 위아래로 분기한다.
- merge 지점은 main 또는 대상 브랜치로 다시 합류하는 환승역으로 표시한다.
- 같은 타입 브랜치는 색상 계열은 유지하되, 노선별 구분이 가능해야 한다.

표현:
- main: 굵은 흰색 또는 밝은 라임 계열 라인
- develop: 청록색 계열
- feature: 파란색 또는 보라색 계열
- hotfix: 빨강 또는 주황 계열
- release: 노랑 또는 골드 계열
- merge: 두꺼운 외곽 링이 있는 환승역
- branch head: 종착역처럼 끝점 강조

### 5.2 Skill Tree 모드

원칙:
- main은 중심 스킬 루트처럼 직선 또는 약한 곡선으로 흐른다.
- feature는 unlock path처럼 위아래로 퍼진다.
- merge는 스킬 합류 또는 진화 노드처럼 보이게 한다.
- 커밋 중요도에 따라 노드 크기를 달리할 수 있다.

표현:
- 일반 commit: 작은 노드
- merge commit: 큰 노드
- release/tag: 빛나는 노드 또는 배지
- active branch head: 강조된 terminal node

### 5.3 선 꼬임 방지

필수 원칙:
- branch lane을 명확히 배정한다.
- 같은 부모에서 갈라진 브랜치는 가까운 lane에 묶는다.
- 오래된 branch 또는 commit이 너무 많으면 cluster로 접는다.
- 화면 밖 데이터는 성능을 위해 가상화하거나 요약한다.
- 대형 저장소는 처음부터 전체 그래프가 아니라 요약 맵을 먼저 보여준다.

---

## 6. 기능 우선순위

### MVP 필수

1. GitHub 저장소 URL 입력
2. GitHub OAuth 로그인 진입점
3. 저장소 브랜치와 커밋 데이터 로딩
4. main 중심의 metro map 렌더링
5. branch 타입별 색상 구분
6. commit hover tooltip
7. commit click inspector panel
8. pan & zoom
9. branch 타입 토글
10. 기본 dark mode
11. 로딩 터미널 애니메이션
12. 에러 상태 화면

### MVP 이후

1. timeline slider
2. export PNG/PDF
3. London Underground theme
4. Cyberpunk theme
5. Skill tree theme
6. shareable static map
7. 대형 저장소 summary mode
8. Web Worker 기반 layout 계산
9. 미니맵
10. PR 단위 보기

---

## 7. 권장 기술 구조

Frontend:
- React
- TypeScript
- TailwindCSS
- SVG 기반 초기 렌더링
- D3.js는 scale, zoom, path 계산, layout 보조에 사용
- 상태 관리는 초기에는 React state와 custom hook으로 충분
- 복잡도가 커지면 Zustand 같은 경량 상태관리 검토

Backend:
- Node.js API layer
- GitHub REST 또는 GraphQL API 호출
- OAuth token 처리
- commit graph 정규화
- 대형 저장소 응답 제한 및 캐싱

Deployment:
- Vercel
- API Route 또는 별도 Node 서버
- GitHub OAuth secret은 환경변수 관리

성능:
- commit 수 제한 기본값 제공
- 화면에 보이는 노드만 강조 렌더링
- 너무 큰 저장소는 cluster node로 요약
- layout 계산이 무거워지면 Web Worker로 분리

---

## 8. 디자인 방향

전체 인상:
- 개발자 도구답게 어둡고 선명하다.
- 너무 게임 UI처럼 과장하지 않고, 첫 버전은 고급스러운 지하철 노선도에 가깝게 간다.
- 네온 효과는 포인트로만 사용한다.
- 정보량이 많아도 스캔이 쉬워야 한다.

기본 테마:
- 배경: 거의 검정에 가까운 다크 그레이
- 패널: 약간 밝은 차콜
- 텍스트: 흰색, 회색, muted gray
- 강조색: cyan, lime, coral, yellow, violet을 노선 색상으로 제한적으로 사용
- 카드 반경: 8px 이하
- 버튼과 입력창은 개발자 도구 느낌으로 단단하게 구성

타이포그래피:
- 로고와 큰 제목은 굵고 짧게
- 커밋 정보, 해시, 터미널 로그는 monospace 사용
- UI 레이블은 작고 명확하게

상호작용:
- hover 시 station tooltip 표시
- click 시 inspector 고정
- zoom level에 따라 커밋 메시지 라벨 표시 여부 변경
- branch filter 토글 시 라인이 자연스럽게 사라지고 나타남
- loading terminal은 실제 처리 단계처럼 보이도록 순차 출력

---

## 9. Claude Design Prompt

아래 내용을 Claude Design에 그대로 붙여넣어 디자인 시안을 요청한다.

```text
Create a polished product UI design for a web app named "GitMetro".

Product concept:
GitMetro turns a GitHub repository's branch and commit history into a readable metro map or game skill tree. The core metaphor is: main/master is the central metro line, feature/develop/hotfix/release branches are colored branch lines, commits are stations, and merge commits are transfer stations. Developers should understand a repository's branching history at a glance.

Audience:
Software engineers, open source maintainers, engineering managers, and developers who want a more readable alternative to GitHub's default network graph.

Visual style:
- Default dark mode.
- Premium developer tool aesthetic.
- Clean, focused, technical, and readable.
- Inspired by modern metro maps, terminal interfaces, GitHub UI, and subtle cyberpunk accents.
- Avoid a marketing landing page feel. The first screen should feel like a usable product.
- Do not use decorative gradient blobs or abstract SVG hero illustrations.
- Use real UI surfaces: input, toolbar, panels, canvas, filters, inspector, terminal loading state.
- Keep card radius at 8px or less.
- Use meaningful icons where helpful.

Required screens:

1. Entry screen
- Show the product name "GitMetro" prominently.
- Include a short line: "Turn Git branches into a readable metro map."
- Include a large GitHub repository input field.
- Placeholder examples: "facebook/react" or "https://github.com/facebook/react".
- Include a "Visualize" action and a "Sign in with GitHub" secondary action.
- Keep the screen simple and focused. The repository input should be the main action.
- Show a subtle preview strip or mini metro map hint in the background or lower viewport, but do not turn it into a generic hero illustration.

2. Loading screen
- Show a terminal-style panel that looks like GitMetro is reading and processing a GitHub repo.
- Include animated-looking log lines:
  "Parsing repository URL..."
  "Fetching branches..."
  "Reading commit graph..."
  "Detecting merge stations..."
  "Building metro layout..."
- Include a progress indicator and blinking cursor feel.
- Keep it dark, sharp, and developer-friendly.

3. Main visualization screen
- Full app layout with:
  - Top toolbar showing repo name, theme selector, export button, GitHub link, dark/light toggle.
  - Left filter panel with branch type toggles: main, develop, feature, hotfix, release, other.
  - Timeline range control.
  - Central pan-and-zoom metro map canvas.
  - Right inspector panel for selected commit or branch.
- The central map should show:
  - main as a strong horizontal central line.
  - feature/develop/hotfix/release lines branching out and merging back.
  - commits as station nodes.
  - merge commits as transfer station rings.
  - branch heads as terminal stations.
- Include hover tooltip example for a commit:
  commit hash, author, date, commit message, changed files count.
- Include selected commit state in the right inspector panel.

4. Theme direction
- Default: GitMetro Dark.
- Include visual affordance for future themes:
  Metro, Skill Tree, Cyberpunk, London Tube.
- Do not fully design all themes, but make the theme selector visible.

UX requirements:
- The UI must be readable with many branches.
- The visual hierarchy should make main branch obvious.
- Controls should be compact and efficient, not oversized marketing UI.
- Text must fit cleanly inside buttons, panels, and tooltips.
- The design must feel ready to implement in React + TailwindCSS + TypeScript.

Deliverables:
- Desktop design for all three screens.
- Mobile responsive concept for entry screen and map screen.
- Component inventory: input, buttons, toolbar, side panel, filter toggle, timeline slider, tooltip, station node, merge node, branch line, terminal loading panel.
- Include spacing, color, and typography guidance.
```

---

## 10. Claude Code CLI용 구현 가이드 초안

아래는 디자인 이후 실제 구현 프롬프트로 확장할 때 사용할 수 있는 초기 방향이다. 아직 코딩 지시가 아니라 구조 설계이다.

```text
You are implementing GitMetro, a React + TypeScript + TailwindCSS web app that visualizes GitHub branch and commit history as a metro map.

Before coding:
- Read AGENTS.md.
- Do not modify existing prompt md files.
- Confirm the approved design/spec md file.
- Keep implementation scoped to the approved task.

Project goal:
- Accept a GitHub repository URL.
- Fetch branch and commit data through a Node.js backend/API layer.
- Normalize the Git commit graph.
- Render it as a metro map where main/master is the central trunk line and branch types are colored side lines.

Suggested app structure:
- src/app or src/pages for routes
- src/components/landing
- src/components/loading
- src/components/map
- src/components/inspector
- src/components/filters
- src/lib/github
- src/lib/graph
- src/lib/layout
- src/types/gitmetro

Core implementation stages:
1. Create the entry screen UI.
2. Parse GitHub repo input.
3. Create loading terminal state.
4. Define TypeScript graph data types.
5. Build mocked graph data for first visualization.
6. Render main metro line and side branch lines from mocked data.
7. Add pan and zoom.
8. Add tooltip and inspector interactions.
9. Add GitHub API integration after visualization works with mock data.
10. Add OAuth after public repository flow is stable.

Validation:
- Test URL parsing with valid and invalid GitHub inputs.
- Test that main line remains visually dominant.
- Test branch filter toggles.
- Test tooltip and inspector behavior.
- Test loading and error states.
- Test no obvious layout break on mobile entry screen.
```

---

## 11. Claude 검토 지침

Claude에게 코드 검토를 요청할 때 아래 기준을 함께 전달한다.

```text
Review this implementation for GitMetro.

Focus areas:
1. Does the implementation match the product goal of making GitHub branch history readable as a metro map?
2. Is main/master clearly represented as the central trunk line?
3. Are feature, develop, hotfix, release, and other branches visually distinguishable?
4. Are merge commits represented as transfer stations or clear join points?
5. Does the data model preserve commit parent relationships accurately?
6. Does the UI handle loading, empty, error, and large repository states?
7. Are pan, zoom, tooltip, and inspector interactions implemented without breaking layout?
8. Are TypeScript types clear enough to prevent graph data bugs?
9. Are GitHub API calls isolated from rendering components?
10. Are there any performance risks for repositories with many commits?
11. Does the implementation avoid unnecessary refactors outside the approved scope?
12. Does it align with AGENTS.md rules and GitMetro's long-term theme direction?

Return:
- Critical bugs first.
- Then UX or readability issues.
- Then maintainability issues.
- Then missing tests.
- Include exact files and lines where possible.
```

---

## 12. 다음 결정이 필요한 부분

아래는 구현 전에 사용자 결정이 필요한 항목이다.

1. 초기 MVP는 `Metro Map`만 구현할지, `Skill Tree` 시각 모드까지 mock 단계에서 같이 잡을지
2. 첫 구현을 실제 GitHub API 연동부터 할지, mock graph 기반 UI 검증부터 할지
3. OAuth를 MVP 필수로 바로 넣을지, 공개 저장소 시각화 이후 붙일지
4. 렌더링 엔진을 SVG로 시작할지, 대형 저장소를 고려해 Canvas를 바로 검토할지
5. 첫 디자인 톤을 `GitMetro Dark`로 고정할지, Cyberpunk 포인트를 더 강하게 줄지

권장 기본 선택:
- 첫 구현은 `Metro Map` 중심
- mock graph 기반 UI 검증을 먼저 진행
- 공개 저장소 시각화 이후 OAuth 추가
- SVG + D3 zoom으로 시작
- 기본 디자인은 절제된 dark developer tool 톤
