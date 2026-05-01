# GitMetro Test Foundation and Regression Plan v1

작성일: 2026-05-01
대상: Claude Code CLI
목적: mock graph 기반 프론트 구현과 interaction fix가 완료된 현재 상태에서, 다음 단계인 GitHub API 연동 전에 핵심 유틸, 레이아웃, UI 상호작용을 보호하는 테스트 기반을 구축한다.

---

## 0. 운영 규칙

이 문서를 처리하는 Claude Code CLI는 아래 규칙을 반드시 지킨다.

1. 먼저 `/Users/minmac/Documents/dev/Project/GitMetro/AGENTS.md`를 읽는다.
2. 이 md 파일은 수정하지 않는다.
3. 이미 생성된 md 파일은 수정하지 않는다.
4. 작업 완료 후 이 md 파일을 아래 경로로 이동한다.
   - from: `/Users/minmac/Documents/dev/Project/GitMetro/md Files`
   - to: `/Users/minmac/Documents/dev/Project/GitMetro/processed md files`
5. 이번 작업은 테스트 기반 구축과 회귀 테스트 작성만 한다.
6. GitHub API 연동, OAuth, 디자인 변경, 라우팅 변경, 렌더링 알고리즘 대개편은 하지 않는다.
7. 테스트를 위해 필요한 devDependency 추가는 허용한다. 추가 시 `package-lock.json`도 함께 갱신한다.

---

## 1. 현재 상태 요약

이미 완료된 상태:
- Next.js 15 + React 19 + TypeScript + TailwindCSS 앱이 루트에 구축됨
- mock graph 기반 entry → loading terminal → map flow 구현됨
- horizontal/vertical orientation 전환 구현됨
- branch filter toggle 구현됨
- theme selector 구현됨
- commit hover tooltip 구현됨
- commit click inspector 구현됨
- zoom controls와 pan interaction 구현됨
- selected commit inspector collapse와 station mouse leave tooltip fix가 처리됨
- `npm run lint`, `npm run typecheck`, `npm run build`가 통과한 것으로 보고됨

현재 빈칸:
- `package.json`에 `test: vitest run`은 있지만 실제 테스트 케이스가 없음
- GitHub API 연동 전에 핵심 유틸과 interaction 회귀를 잡아둘 필요가 있음

---

## 2. 이번 단계 목표

이번 단계의 목표는 “테스트를 많이 만드는 것”이 아니라, 다음 GitHub API 연동 때 깨지면 치명적인 기반 로직을 먼저 보호하는 것이다.

필수 목표:
1. Vitest가 실제 테스트 파일을 발견하고 실행하게 만든다.
2. GitHub repo input parser를 테스트한다.
3. branch category classifier를 테스트한다.
4. graph theme 적용 로직을 테스트한다.
5. layout 계산과 orientation별 좌표 변환을 테스트한다.
6. lane strategy를 테스트한다.
7. mock graph data invariant를 테스트한다.
8. selected commit inspector와 hover tooltip interaction 회귀 테스트를 추가한다.
9. `npm run test`가 통과해야 한다.

---

## 3. 의존성 및 테스트 설정

현재 `vitest`, `jsdom`, `@vitejs/plugin-react`는 이미 devDependency에 있다.

React component interaction test가 필요하면 아래 devDependency를 추가한다.

권장 추가:

```text
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
```

필요 설정:
- `vitest.config.ts`
- `src/test/setup.ts`

권장 `vitest.config.ts` 방향:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

권장 `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

주의:
- Next.js App Router 자체를 통합 테스트하려고 무리하지 않는다.
- 이번 단계는 unit test + lightweight component test 중심이다.
- SVG 전체 snapshot 테스트는 하지 않는다. 너무 쉽게 깨져서 유지보수성이 낮다.

---

## 4. 테스트 파일 구조

권장 파일 구조:

```text
src/
  lib/
    github/
      parseRepoInput.test.ts
      branchCategory.test.ts
    graph/
      applyTheme.test.ts
    layout/
      buildLayout.test.ts
      laneStrategy.test.ts
  data/
    mockGraph.test.ts
  components/
    map/
      MapShell.test.tsx
      MetroMapCanvas.test.tsx
```

테스트 파일 이름은 `.test.ts` 또는 `.test.tsx`를 사용한다.

---

## 5. Unit Test 상세

### 5.1 parseRepoInput

대상 파일:
- `/Users/minmac/Documents/dev/Project/GitMetro/src/lib/github/parseRepoInput.ts`

테스트 케이스:
- `facebook/react` → `{ owner: "facebook", repo: "react" }`
- `https://github.com/facebook/react` → 정상
- `http://github.com/facebook/react` → 정상
- `github.com/facebook/react` → 정상
- `https://github.com/facebook/react.git` → 정상
- 앞뒤 공백 포함 입력 → trim 후 정상
- 빈 문자열 → 실패
- owner만 있는 입력 → 실패
- invalid character 포함 → 실패

검증:
- 성공 케이스는 `ok: true`
- 실패 케이스는 `ok: false`와 error message 존재

### 5.2 branchCategory

대상 파일:
- `/Users/minmac/Documents/dev/Project/GitMetro/src/lib/github/branchCategory.ts`

테스트 케이스:
- `main` → `main`
- `master` → `main`
- `develop` → `develop`
- `dev` → `develop`
- `feature/auth` → `feature`
- `feat/wallet` → `feature`
- `hotfix/login` → `hotfix`
- `fix/session` → `hotfix`
- `release/2.4` → `release`
- `rc/2.5.0` → `release`
- `chore/update-deps` → `other`
- 대소문자 섞인 branch name도 정상 분류

### 5.3 applyThemeToGraph

대상 파일:
- `/Users/minmac/Documents/dev/Project/GitMetro/src/lib/graph/applyTheme.ts`
- `/Users/minmac/Documents/dev/Project/GitMetro/src/lib/theme/themes.ts`

테스트 케이스:
- 원본 graph 객체를 mutation하지 않는다.
- 각 branch category가 theme color로 remap된다.
- unknown/other branch는 fallback color를 받는다.
- repo와 commits 정보는 보존된다.

### 5.4 buildLayout

대상 파일:
- `/Users/minmac/Documents/dev/Project/GitMetro/src/lib/layout/buildLayout.ts`

테스트 케이스:
- horizontal orientation:
  - `pos(t, lane)`에서 t가 증가하면 x가 증가한다.
  - lane이 main에서 멀어지면 y가 증가한다.
  - width가 height보다 커지는 경향이 있다.
- vertical orientation:
  - `pos(t, lane)`에서 t가 증가하면 y가 증가한다.
  - lane이 main에서 멀어지면 x가 증가한다.
  - height가 width보다 커지는 경향이 있다.
- `bySha` map이 모든 commit sha를 포함한다.
- 빈 commits 배열에서도 crash하지 않는다.

### 5.5 rectPath

대상 파일:
- `/Users/minmac/Documents/dev/Project/GitMetro/src/lib/layout/buildLayout.ts`

테스트 케이스:
- horizontal path가 `M`, `L`, `A` 또는 `Q`를 포함하는 유효한 SVG path string을 반환한다.
- vertical path도 유효한 SVG path string을 반환한다.
- 같은 좌표 또는 아주 가까운 좌표에서도 빈 문자열을 반환하지 않는다.

정확한 path 전체 문자열에 과하게 의존하지 않는다.
핵심 포인트만 검사한다.

### 5.6 laneStrategy

대상 파일:
- `/Users/minmac/Documents/dev/Project/GitMetro/src/lib/layout/laneStrategy.ts`

테스트 케이스:
- `stackedLaneStrategy`가 branch의 기존 lane 값을 유지한다.
- 모든 branch id가 결과 map에 들어간다.
- 빈 branch 배열은 빈 객체를 반환한다.

### 5.7 mockGraph invariant

대상 파일:
- `/Users/minmac/Documents/dev/Project/GitMetro/src/data/mockGraph.ts`

테스트 케이스:
- repo fullName 또는 owner/name이 존재한다.
- branches가 하나 이상 존재한다.
- commits가 하나 이상 존재한다.
- 모든 commit의 branch가 실제 branch id를 참조한다.
- 모든 parent sha가 실제 commit에 존재한다.
- merge commit은 parents가 2개 이상이다.
- head commit이 최소 1개 이상 존재한다.
- branch category가 허용된 category 중 하나다.

이 테스트는 실제 GitHub API 연동 후에도 mock data 품질을 보호하는 역할을 한다.

---

## 6. Component Interaction Test 상세

컴포넌트 테스트는 사용자 동작이 깨지면 바로 알 수 있게 최소한의 회귀 테스트로 작성한다.

### 6.1 MapShell

대상 파일:
- `/Users/minmac/Documents/dev/Project/GitMetro/src/components/map/MapShell.tsx`

테스트 목표:
- loading 완료 후 map 화면이 나타난다.
- `Selected commit` inspector는 기본적으로 닫혀 있거나, 빈 canvas click 시 닫힌다.
- station click 시 inspector가 열린다.
- empty map click 시 inspector가 닫힌다.
- orientation toggle이 horizontal/vertical 상태를 바꾼다.
- theme selector가 값 변경을 받을 수 있다.

주의:
- `LoadingTerminal`이 timer를 사용한다면 fake timers를 쓰거나, 테스트에서 loading을 기다릴 수 있게 처리한다.
- 필요하면 `LoadingTerminal`의 delay를 테스트에서 우회하기 위한 prop 또는 내부 구조를 최소 변경할 수 있다.
- 단, 제품 동작을 바꾸는 방식으로 우회하지 않는다.

권장 접근:
- `render(<MapShell graph={mockGraph} />)`
- fake timers로 loading 완료
- station 요소를 찾기 어렵다면 `Station`에 접근 가능한 `aria-label` 또는 `data-testid`를 추가한다.

접근성 권장:
- commit station `<g>` 또는 클릭 target에 `role="button"`과 `aria-label`을 줄 수 있으면 추가한다.
- 예: `aria-label={`Commit ${commit.shortSha}: ${commit.message}`}`
- SVG `<g>`가 role 처리에 애매하면 `data-testid={`station-${commit.sha}`}`를 추가해도 된다.

### 6.2 MetroMapCanvas

대상 파일:
- `/Users/minmac/Documents/dev/Project/GitMetro/src/components/map/MetroMapCanvas.tsx`
- `/Users/minmac/Documents/dev/Project/GitMetro/src/components/map/Station.tsx`

테스트 목표:
- visible branch만 station/line이 표시된다.
- station mouse enter 또는 mouse move 시 `onHoverChange`가 commit 정보와 좌표를 받는다.
- station mouse leave 시 `onHoverChange(null)`이 호출된다.
- station click 시 `onSelectCommit`이 호출된다.
- empty canvas click 시 `onClearSelection` 또는 대응 handler가 호출된다.
- station click은 empty canvas click으로 전파되지 않는다.
- drag-pan 후에는 empty click으로 오인되어 selection clear가 호출되지 않는다.

주의:
- SVG 좌표나 path string 전체를 snapshot으로 고정하지 않는다.
- 상호작용 handler 호출 여부 중심으로 테스트한다.

---

## 7. 테스트를 위해 허용되는 작은 코드 조정

테스트 가능성을 높이기 위해 아래 정도의 작은 조정은 허용한다.

허용:
- station에 `aria-label`, `role`, `data-testid` 추가
- canvas wrapper에 `data-testid="metro-canvas"` 추가
- inspector에 `data-testid="commit-inspector"` 추가
- tooltip에 `data-testid="commit-tooltip"` 추가
- `LoadingTerminal` 테스트를 위한 delay 제어 prop 추가
- handler 이름을 명확히 하기 위한 prop 추가

금지:
- 디자인을 바꾸는 변경
- 화면 레이아웃을 바꾸는 변경
- mock graph 내용을 임의 변경
- GitHub API 연동 시작
- OAuth 시작
- map renderer 알고리즘 대개편

---

## 8. 검증 명령

작업 후 반드시 아래를 실행한다.

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

모두 통과해야 한다.

만약 `npm run lint`가 Next 15 환경에서 `next lint` 지원 문제로 실패한다면:
- 원인을 보고한다.
- 기존 프로젝트 스크립트를 임의로 크게 바꾸지 않는다.
- 필요한 경우 최소 변경으로 lint script를 현재 Next 버전에 맞게 조정할 수 있다.

---

## 9. 완료 기준

완료 기준:
- `npm run test`가 실제 테스트 케이스를 실행한다.
- 최소 20개 이상의 의미 있는 test case가 존재한다.
- URL parsing, branch classification, layout, lane strategy, mock graph invariant가 테스트된다.
- inspector open/close와 tooltip hover behavior 회귀 테스트가 존재한다.
- lint/typecheck/test/build가 통과한다.
- 이번 md 파일이 `processed md files`로 이동된다.

---

## 10. 작업 후 보고 형식

Claude Code CLI는 작업 완료 후 아래 형식으로 보고한다.

```text
작업 요약:
- 

추가/변경 파일:
- 

테스트 커버리지:
- parseRepoInput:
- branchCategory:
- applyTheme:
- buildLayout/rectPath:
- laneStrategy:
- mockGraph invariant:
- MapShell/MetroMapCanvas interaction:

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

## 11. 다음 단계 예고

이 테스트 기반이 통과하면 다음 구현 단계는 `public GitHub API graph integration`이다.

다음 단계에서 다룰 예정:
- `/api/github/repo`
- `/api/github/graph`
- GitHub repository metadata fetch
- branch list fetch
- commit list fetch
- GitHub response → `GitMetroGraph` 정규화
- public repository flow
- error state
- API rate limit handling

이번 문서에서는 위 작업을 시작하지 않는다.
