# GitMetro Claude Code CLI 구현 설계 지침 v1

작성일: 2026-05-01
대상: Claude Code CLI
목적: Claude Design 결과물을 기준으로 GitMetro 실제 웹앱 구현을 시작하기 위한 전체 개발 방향, 파일 구조, 기능 순서, 검증 기준을 정의한다.

---

## 0. 가장 중요한 운영 규칙

이 문서를 처리하는 Claude Code CLI는 아래 규칙을 반드시 지킨다.

1. 먼저 `/Users/minmac/Documents/dev/Project/GitMetro/AGENTS.md`를 읽는다.
2. 이 md 파일은 수정하지 않는다.
3. 이미 생성된 md 파일은 수정하지 않는다.
4. 구현이 끝나면 처리 완료된 이 md 파일을 아래 경로로 이동한다.
   - from: `/Users/minmac/Documents/dev/Project/GitMetro/md Files`
   - to: `/Users/minmac/Documents/dev/Project/GitMetro/processed md files`
5. 사용자가 별도 요청하지 않은 리팩토링은 하지 않는다.
6. Claude Design 폴더는 디자인 참고 자료로만 사용한다. 원본 디자인 파일을 임의로 수정하지 않는다.
7. 실제 앱 코드는 프로젝트 루트 기준으로 새롭게 구성한다.

---

## 1. 읽어야 할 기준 자료

반드시 확인할 파일:

1. `/Users/minmac/Documents/dev/Project/GitMetro/AGENTS.md`
2. `/Users/minmac/Documents/dev/Project/GitMetro/userneeds.md`
3. `/Users/minmac/Documents/dev/Project/GitMetro/md Files/gitmetro_project_skeleton_and_claude_design_prompt_v2.md`
4. `/Users/minmac/Documents/dev/Project/GitMetro/GitMetro from Claude design/GitMetro Prototype.html`
5. `/Users/minmac/Documents/dev/Project/GitMetro/GitMetro from Claude design/app.jsx`
6. `/Users/minmac/Documents/dev/Project/GitMetro/GitMetro from Claude design/metro-map.jsx`
7. `/Users/minmac/Documents/dev/Project/GitMetro/GitMetro from Claude design/graph-data.js`
8. `/Users/minmac/Documents/dev/Project/GitMetro/GitMetro from Claude design/styles.css`

디자인 기준:
- 현재 사용자가 원하는 entry 화면은 미니멀한 중앙 입력 화면이다.
- `screenshots/01-entry.png`의 풍부한 히어로형 화면은 이전 흔적이다.
- 향후 matrix animation 또는 terminal animation을 entry background에 얇게 추가할 수 있으므로, entry background는 별도 컴포넌트 레이어로 분리한다.
- 현재 디자인 결과물의 map 화면 구조와 색감은 사용자가 원하는 방향과 잘 맞는다.

---

## 2. 구현 목표

GitMetro는 GitHub 저장소 URL을 입력받아 branch, commit, merge 흐름을 지하철 맵 또는 게임 스킬트리처럼 시각화하는 웹앱이다.

핵심 목표:
- GitHub repo 입력
- GitHub 데이터 로딩
- terminal-style loading 화면
- main 중심 metro map 시각화
- horizontal 기본 방향
- vertical 옵션 지원
- branch type별 색상 구분
- commit hover tooltip
- commit click inspector
- branch filter
- timeline control
- theme selector
- GitHub OAuth 진입점
- 공개 저장소 우선 지원
- 이후 private repository 지원을 위한 구조 확보
- Vercel 배포 가능한 구조

---

## 3. 권장 기술 선택

권장:
- Next.js
- React
- TypeScript
- TailwindCSS
- Node.js API Route
- SVG 기반 map renderer
- D3.js는 zoom, scale, path 계산이 필요할 때만 사용

선택 이유:
- Vercel 배포와 GitHub OAuth/API Route 구성이 쉽다.
- 프론트와 백엔드를 한 프로젝트에서 관리할 수 있다.
- GitHub API token을 서버 영역에서 안전하게 다룰 수 있다.
- 현재 Claude Design 결과물을 React 컴포넌트로 재구성하기 좋다.

주의:
- Claude Design 결과물은 UMD React + Babel 기반 프로토타입이다.
- 실제 구현에서는 이 구조를 그대로 복사하지 말고, TypeScript 컴포넌트와 Tailwind 기반으로 재구성한다.
- 단, 시각 디자인, 화면 구성, 인터랙션, mock graph 구조는 적극 참고한다.

---

## 4. 개발 단계 개요

이 프로젝트는 프로토타입만 만들고 끝내는 것이 아니라 현재 구상한 제품 범위를 실제 구현하는 방향이다.
다만 안정적인 개발을 위해 아래 순서로 진행한다.

1. 프로젝트 세팅
2. 디자인 시스템과 레이아웃 기반 구축
3. mock graph 기반 프론트 구현
4. metro map renderer 구현
5. GitHub 데이터 모델 설계
6. GitHub API 백엔드 구현
7. 실제 GitHub 데이터와 map renderer 연결
8. OAuth 구조 추가
9. 테스트
10. 배포 준비

---

## 5. 1단계: 프로젝트 세팅

프로젝트 루트:
- `/Users/minmac/Documents/dev/Project/GitMetro`

현재 루트에는 실제 앱 구조가 없을 수 있다.
없다면 Next.js + TypeScript + TailwindCSS 프로젝트를 루트에 생성한다.

권장 구조:

```text
/Users/minmac/Documents/dev/Project/GitMetro
  src/
    app/
      page.tsx
      map/
        [owner]/
          [repo]/
            page.tsx
      api/
        github/
          repo/route.ts
          graph/route.ts
        auth/
          github/
            route.ts
            callback/route.ts
    components/
      entry/
      loading/
      map/
      layout/
      inspector/
      filters/
      ui/
    lib/
      github/
      graph/
      layout/
      theme/
      utils/
    types/
      gitmetro.ts
    data/
      mockGraph.ts
  public/
  package.json
  tailwind.config.ts
  tsconfig.json
  next.config.ts
```

라우트:
- `/`: 저장소 입력 entry 화면
- `/map/[owner]/[repo]`: 시각화 화면
- API:
  - `/api/github/repo`
  - `/api/github/graph`
  - `/api/auth/github`
  - `/api/auth/github/callback`

---

## 6. 2단계: 프론트 디자인 기반 구축

Claude Design 기준으로 아래 화면을 구현한다.

### 6.1 Entry 화면

기준:
- 미니멀 중앙 카드형 화면
- `GitMetro` 로고
- `Turn any GitHub repository into a readable metro map.`
- GitHub repo 입력창
- `Visualize` 버튼
- `Sign in with GitHub` 버튼

구현 컴포넌트:
- `EntryPage`
- `RepoInputForm`
- `GitHubSignInButton`
- `EntryBackground`

EntryBackground:
- 현재는 아주 얇은 grid 또는 빈 dark background로 시작한다.
- 추후 matrix rain 또는 terminal trace animation을 넣을 수 있게 별도 컴포넌트로 분리한다.
- 배경 애니메이션은 입력 UI 가독성을 절대 해치지 않아야 한다.

### 6.2 Loading 화면

기준:
- terminal-style panel
- GitHub repo 분석 로그가 순차적으로 출력되는 느낌

구현 컴포넌트:
- `LoadingTerminal`
- `TerminalLine`
- `AnalysisProgress`

로그 예시:
- `Parsing repository URL...`
- `Fetching branches...`
- `Reading commit graph...`
- `Detecting merge stations...`
- `Allocating branch lanes...`
- `Building metro layout...`

### 6.3 Map 화면

기준:
- 상단 toolbar
- 왼쪽 branch filter panel
- 중앙 metro map canvas
- 오른쪽 commit inspector

구현 컴포넌트:
- `MapShell`
- `MapToolbar`
- `BranchFilterPanel`
- `MetroMapCanvas`
- `CommitTooltip`
- `CommitInspector`
- `ZoomControls`
- `MapLegend`
- `TimelineControl`
- `ThemeSelector`
- `OrientationToggle`

---

## 7. 3단계: mock graph 기반 프론트 완성

GitHub API를 바로 연결하지 말고 먼저 mock graph로 UI와 renderer를 완성한다.

이유:
- 이 프로젝트의 핵심은 GitHub API 호출보다 branch graph를 읽기 쉽게 보여주는 것에 있다.
- renderer, data model, interaction이 안정되어야 실제 GitHub 데이터를 붙였을 때 흔들리지 않는다.

mock data 기준:
- Claude Design의 `graph-data.js`를 TypeScript로 변환해 `src/data/mockGraph.ts`에 둔다.
- mock repo는 `lumen-labs/lumen-pay` 형태를 유지해도 된다.
- branch, commit, parent, merge, tag, head 정보를 모두 포함한다.

필수 동작:
- `/map/lumen-labs/lumen-pay` 진입 시 mock graph 렌더링
- horizontal map 기본 렌더링
- vertical map 전환
- theme 전환
- branch toggle
- commit hover tooltip
- commit click inspector
- zoom controls
- pan interaction

---

## 8. 4단계: Metro Map Renderer 구현

렌더링 방식:
- SVG 기반으로 시작한다.
- `horizontal`이 기본값이다.
- `vertical`은 명시적 옵션이다.

핵심 타입:

```ts
export type MapOrientation = 'horizontal' | 'vertical';
export type VisualMode = 'metro' | 'skill-tree';
export type BranchCategory = 'main' | 'develop' | 'feature' | 'hotfix' | 'release' | 'other';

export interface RepositorySummary {
  owner: string;
  name: string;
  fullName: string;
  description?: string;
  defaultBranch: string;
  stars?: number;
  forks?: number;
  commitsTotal?: number;
  branchesTotal?: number;
  contributors?: number;
  lastSync?: string;
}

export interface BranchLine {
  id: string;
  name: string;
  category: BranchCategory;
  color: string;
  lane: number;
  headSha?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface CommitNode {
  sha: string;
  shortSha: string;
  branch: string;
  t: number;
  parents: string[];
  message: string;
  author: string;
  avatar?: string;
  date: string;
  files?: number;
  isMerge: boolean;
  isHead?: boolean;
  isTag?: boolean;
  tag?: string;
  pr?: string;
}

export interface GitMetroGraph {
  repo: RepositorySummary;
  branches: BranchLine[];
  commits: CommitNode[];
}
```

Layout 원칙:
- horizontal:
  - x = 시간 또는 topological index
  - y = branch lane
  - main은 중심 trunk line
- vertical:
  - y = 시간 또는 topological index
  - x = branch lane
  - main은 위에서 아래로 흐르는 중심 trunk line

시각 표현:
- 일반 commit: 작은 station node
- merge commit: transfer station ring
- branch head: terminal station
- tag: 작은 label
- main line: 가장 시각적으로 우선순위가 높아야 함

주의:
- 현재 Claude Design의 vertical은 기본적으로 한쪽 방향으로 lane이 쌓이는 구조에 가깝다.
- 최종 제품에서는 vertical 모드에서 branch가 좌우로 분기할 수 있도록 lane 배치 함수를 분리해둔다.
- 초기 구현에서는 안정성을 위해 한쪽 lane stacking으로 시작해도 되지만, lane strategy를 교체 가능하게 만든다.

---

## 9. 5단계: GitHub 데이터 모델과 정규화

GitHub API 원본 응답을 UI에서 직접 사용하지 않는다.
반드시 `GitMetroGraph` 형태로 정규화한다.

필요 기능:
- repo URL 파싱
- owner/repo 추출
- repository metadata 조회
- branch 목록 조회
- commit 목록 조회
- parent 관계 유지
- merge commit 감지
- branch category 분류
- lane 배정
- t index 배정

URL 입력 지원:
- `https://github.com/{owner}/{repo}`
- `github.com/{owner}/{repo}`
- `{owner}/{repo}`

Branch category 규칙:
- `main`, `master` → `main`
- `develop`, `dev` → `develop`
- `feature/*`, `feat/*` → `feature`
- `hotfix/*`, `fix/*` → `hotfix`
- `release/*`, `rc/*` → `release`
- 나머지 → `other`

대형 저장소 대응:
- 처음부터 전체 commit을 무제한 로딩하지 않는다.
- 기본 commit limit을 둔다.
- date range 또는 최근 N개 commit 기준을 지원한다.
- 너무 큰 repo는 summary mode 또는 clustering 안내를 제공한다.

---

## 10. 6단계: Backend / GitHub API

API Route 권장:

```text
GET /api/github/repo?owner={owner}&repo={repo}
GET /api/github/graph?owner={owner}&repo={repo}&limit=500
```

서버 책임:
- GitHub API 호출
- token 관리
- rate limit handling
- 응답 정규화
- 에러 메시지 표준화

프론트 책임:
- 사용자 입력
- loading 상태
- error 상태
- 정규화 graph 렌더링

에러 상태:
- invalid repo input
- repo not found
- private repo without auth
- GitHub API rate limit
- network failure
- graph too large
- unsupported repo state

---

## 11. 7단계: OAuth

OAuth는 공개 저장소 flow가 안정된 뒤 붙인다.
단, 처음부터 구조상 OAuth 확장을 막지 않도록 설계한다.

필요 목적:
- private repository 접근
- GitHub API rate limit 완화

주의:
- access token을 client component에 노출하지 않는다.
- token은 서버 route 또는 안전한 session/cookie 구조로 다룬다.
- `.env.local`에 필요한 환경변수를 정의한다.

예상 환경변수:

```text
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=
```

---

## 12. 8단계: 기능 연결

최종 사용자 flow:

1. `/` 진입
2. GitHub repo 입력
3. `Visualize` 클릭 또는 Enter
4. loading terminal 표시
5. GitHub graph API 호출
6. 성공 시 `/map/[owner]/[repo]`로 이동
7. map 렌더링
8. branch filter, theme, orientation, tooltip, inspector 사용

상태 관리:
- 초기에는 React state와 custom hook으로 충분하다.
- 상태가 복잡해지면 Zustand 같은 경량 store를 검토한다.

권장 hooks:
- `useRepoInput`
- `useGitMetroGraph`
- `useMapViewport`
- `useBranchVisibility`
- `useSelectedCommit`
- `useTheme`
- `useOrientation`

---

## 13. 9단계: 테스트 계획

필수 테스트:

1. URL parser
   - `facebook/react`
   - `https://github.com/facebook/react`
   - invalid input

2. Branch category classifier
   - main/master
   - develop/dev
   - feature/*
   - hotfix/*
   - release/*
   - unknown branch

3. Graph normalizer
   - parent 관계 유지
   - merge commit 감지
   - branch head 감지
   - t index 생성
   - lane 배정

4. Renderer
   - horizontal 기본 렌더링
   - vertical 렌더링
   - merge node 표시
   - tag 표시
   - hidden branch 미표시

5. UI interaction
   - repo input submit
   - loading state
   - branch toggle
   - commit hover tooltip
   - commit click inspector
   - theme switch
   - orientation switch
   - zoom button
   - pan interaction

6. Error state
   - repo not found
   - rate limit
   - private repo without login

권장 도구:
- unit test: Vitest
- component/test browser: Playwright 또는 Testing Library
- lint/typecheck: ESLint, TypeScript

최소 검증 명령:

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

프로젝트에 위 스크립트가 없다면 추가한다.

---

## 14. 10단계: 배포 준비

배포 대상:
- Vercel

확인 항목:
- production build 성공
- `.env.example` 작성
- GitHub OAuth callback URL 문서화
- public repo flow 정상 동작
- API error message가 사용자에게 명확히 표시됨
- mobile entry 화면 깨지지 않음
- map 화면은 최소 tablet/desktop 우선으로 안정화

---

## 15. 디자인 이식 세부 지침

현재 Claude Design에서 유지할 것:
- 미니멀 entry 화면
- dark developer tool 톤
- 작은 radius, 단단한 버튼
- terminal loading panel
- map shell 3-column layout
- branch color swatch
- commit inspector 구조
- horizontal/vertical segmented control
- theme selector
- zoom controls
- legend

조정할 것:
- TailwindCSS 기반 컴포넌트로 재작성
- TypeScript 타입 적용
- inline mock 스타일 제거
- 실제 라우팅 구조 적용
- 모바일 viewport 고정 제거
- old hero CSS/컴포넌트 흔적은 가져오지 않음

나중을 위해 구조만 열어둘 것:
- `EntryBackground`에 matrix rain 또는 terminal trace animation
- `visualMode: skill-tree`
- export PNG/PDF
- shareable map
- minimap
- large repo summary mode

---

## 16. 완료 기준

1차 구현 완료 기준:
- Next.js 앱이 정상 실행된다.
- `/`에서 repo 입력 UI가 보인다.
- mock graph 기준 `/map/lumen-labs/lumen-pay`가 정상 렌더링된다.
- horizontal/vertical 전환이 동작한다.
- branch filter가 동작한다.
- commit hover tooltip이 동작한다.
- commit click inspector가 동작한다.
- theme selector가 동작한다.
- loading terminal UI가 동작한다.
- TypeScript build가 통과한다.

2차 구현 완료 기준:
- public GitHub repo 입력 시 실제 GitHub data를 가져온다.
- GitHub 데이터를 `GitMetroGraph`로 정규화한다.
- 실제 repo graph가 map renderer에 연결된다.
- 기본 error state가 동작한다.

3차 구현 완료 기준:
- OAuth 진입점이 동작한다.
- private repository 접근 구조가 준비된다.
- Vercel 배포가 가능하다.

---

## 17. 작업 후 보고 형식

Claude Code CLI는 작업 완료 후 아래 형식으로 보고한다.

```text
작업 요약:
- 

변경 파일:
- 

검증:
- npm run lint
- npm run typecheck
- npm run test
- npm run build

남은 이슈:
- 

다음 추천 작업:
- 
```

---

## 18. 이번 문서의 핵심 결론

구현은 `mock graph 기반 프론트 완성`을 먼저 하고, 그 다음 `GitHub API 연동`으로 넘어간다.

이유:
- GitMetro의 제품 가치는 API 호출 자체가 아니라 복잡한 branch graph를 가독성 있게 보여주는 데 있다.
- renderer와 data model이 먼저 안정되어야 실제 GitHub 데이터를 붙여도 화면이 무너지지 않는다.
- 현재 Claude Design 결과물은 시각 기준으로 매우 유용하지만, 실제 앱에서는 TypeScript/Next.js 구조로 재구성해야 한다.
