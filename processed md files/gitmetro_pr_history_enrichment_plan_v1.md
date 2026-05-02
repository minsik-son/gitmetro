# GitMetro PR History Enrichment Plan v1

작성일: 2026-05-01
대상: Claude Code CLI
목적: squash/rebase merge 중심 repository에서도 과거 branch/PR 작업 흐름을 시각적으로 볼 수 있도록 GitHub Pull Request metadata를 이용해 synthetic branch lanes를 생성한다. 또한 요청 수 증가에 대비해 server-side cache와 diagnostics UI를 함께 도입한다.

공식 문서 참고:
- GitHub REST API - Pull requests: https://docs.github.com/en/rest/pulls/pulls
- GitHub REST API - List pull requests: https://docs.github.com/en/rest/pulls/pulls#list-pull-requests
- GitHub REST API - List commits on a pull request: https://docs.github.com/en/rest/pulls/pulls#list-commits-on-a-pull-request
- GitHub REST API - List pull requests associated with a commit: https://docs.github.com/en/rest/commits/commits#list-pull-requests-associated-with-a-commit
- GitHub REST API - Rate limits: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

---

## 0. 운영 규칙

이 문서를 처리하는 Claude Code CLI는 아래 규칙을 반드시 지킨다.

1. 먼저 `/Users/minmac/Documents/dev/Project/GitMetro/AGENTS.md`를 읽는다.
2. 이 md 파일은 수정하지 않는다.
3. 이미 생성된 md 파일은 수정하지 않는다.
4. 작업 완료 후 이 md 파일을 아래 경로로 이동한다.
   - from: `/Users/minmac/Documents/dev/Project/GitMetro/md Files`
   - to: `/Users/minmac/Documents/dev/Project/GitMetro/processed md files`
5. 이번 작업은 PR history enrichment, server-side cache, diagnostics UI만 한다.
6. OAuth, private repo, export PNG/PDF, matrix background, skill-tree renderer는 이번 범위가 아니다.
7. 기존 public GitHub API flow, historical branch flow, tests를 깨지 않도록 한다.
8. PR enrichment는 API 요청 수가 많아질 수 있으므로 반드시 cap과 cache를 둔다.

---

## 1. 현재 상태와 문제

현재 구현:
- public GitHub API integration 완료
- default branch first-parent trunk 분리 완료
- true merge commit의 second-parent chain을 historical branch lane으로 복원
- `Show branch history` toggle 기본 ON

남은 문제:
- `facebook/react`, `vercel/next.js` 같은 대형 repo는 최근 history에 merge commit이 거의 없을 수 있다.
- squash merge 또는 rebase merge는 Git commit parent graph에서 branch topology가 사라진다.
- 실제로는 PR branch에서 작업했지만 Git graph에는 일직선 commit으로만 남는다.
- 현재 `meta.history.historicalBranches = 0`이면 사용자는 toggle을 켜도 변화가 없어서 고장처럼 느낀다.

이번 목표:
- GitHub PR metadata를 이용해 squash/rebase merge도 synthetic branch lane으로 표현한다.
- 사용자가 PR 기반 history를 on/off 할 수 있게 한다.
- diagnostics UI로 “왜 history가 안 보이는지 / 어떤 데이터가 표시되는지” 설명한다.
- API 요청 폭증을 막기 위해 server-side TTL cache를 추가한다.

---

## 2. UX 목표

### 2.1 사용자에게 보여주고 싶은 결과

사용자가 `facebook/react` 또는 `vercel/next.js`를 열었을 때:
- commit graph만으로 historical branch가 0개여도 PR 기반 synthetic lanes가 표시된다.
- lane 이름은 가능한 한 `PR #12345`와 PR title/source branch를 보여준다.
- PR lane은 main/canary/default branch에서 분기되어 다시 합류한 것처럼 보인다.
- 이 정보가 Git parent graph에서 온 것인지 PR metadata에서 온 것인지 구분 가능해야 한다.

### 2.2 옵션

왼쪽 panel의 Display 또는 History 섹션:

```text
Show branch history
Show PR history
```

권장 기본값:
- `Show branch history`: ON
- `Show PR history`: ON

설명:
- branch history: true merge commit 기반
- PR history: squash/rebase 포함 GitHub PR metadata 기반 synthetic lanes

동작:
- `Show branch history` OFF → `source === "merge-history"` 숨김
- `Show PR history` OFF → `source === "pull-request"` 숨김
- 둘 다 OFF → 현재 branch refs 중심 단순 보기

### 2.3 Diagnostics UI

현재 API meta/warnings가 화면에 거의 보이지 않는다.
이제 사용자가 이유를 이해할 수 있게 compact diagnostics를 추가한다.

위치 후보:
- toolbar의 `TRUNCATED` pill 근처에 `INFO` 또는 `DIAGNOSTICS` pill
- 클릭하면 작은 popover 또는 right/left panel 아래 compact diagnostics

표시 항목:
- selected branches
- fetched commits
- historical merge branches
- PR synthetic branches
- warnings
- rate limit remaining
- truncated/capped 여부

문구 예:

```text
History
Merge lanes: 0
PR lanes: 24
Warnings:
- This repository appears to use squash/rebase merges.
- Showing 24 PR branches capped by prHistoryLimit.
```

주의:
- 화면을 복잡하게 만들지 않는다.
- 우선은 toolbar pill + small popover 또는 left panel 하단 compact section 정도로 충분하다.

---

## 3. Commit Message 제안

이 작업을 시작하기 전에 현재 상태를 저장할 commit message 추천:

```text
feat: add historical branch lanes
```

조금 더 자세한 body:

```text
Split default branch history by first-parent trunk, add merge-history lanes, and expose a branch history toggle with regression coverage.
```

---

## 4. Server-side Cache 설계

PR enrichment는 요청 수가 늘어난다.
OAuth 전까지는 unauthenticated rate limit이 낮으므로 cache가 필요하다.

### 4.1 목표

- 같은 repo/옵션 요청은 일정 시간 동안 GitHub API를 다시 때리지 않는다.
- dev 환경에서 새로고침 반복 시 rate limit 소모를 줄인다.
- production serverless 환경에서도 최소한 per-instance memory cache로 동작하게 한다.

### 4.2 구현 위치

신규 파일:

```text
src/lib/cache/memoryCache.ts
```

기능:

```ts
export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export function getCached<T>(key: string): T | null;
export function setCached<T>(key: string, value: T, ttlMs: number): void;
export function getOrSetCached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T>;
export function clearCacheForTests(): void;
```

TTL 기본값:

```ts
GRAPH_CACHE_TTL_MS = 5 * 60 * 1000
PR_CACHE_TTL_MS = 10 * 60 * 1000
```

주의:
- memory cache는 process-local이다.
- Vercel serverless에서 영구 cache가 아니다.
- 그래도 dev와 warm instance에는 도움이 된다.
- 나중에 Redis/Vercel KV 같은 외부 cache로 교체 가능하게 key/value API를 단순화한다.

### 4.3 cache key

Graph route cache key:

```text
github-graph:{owner}/{repo}:maxBranches={n}:commitLimit={n}:branchCommitLimit={n}:includeHistory={bool}:historyLimit={n}:historyCommitLimit={n}:includePrHistory={bool}:prHistoryLimit={n}:prCommitLimit={n}
```

PR list cache key:

```text
github-pr-list:{owner}/{repo}:base={branch}:limit={n}
```

PR commits cache key:

```text
github-pr-commits:{owner}/{repo}:pull={number}:limit={n}
```

---

## 5. GitHub PR API 사용 범위

### 5.1 List closed pull requests

Endpoint:

```text
GET /repos/{owner}/{repo}/pulls?state=closed&base={defaultBranch}&sort=updated&direction=desc&per_page=100&page=1
```

필터:
- `merged_at != null`
- `base.ref === defaultBranch`
- 너무 오래된 PR은 현재 commit window와 연결이 어려울 수 있으므로 우선 최근 N개만 사용

기본 cap:

```ts
DEFAULT_PR_HISTORY_LIMIT = 24
DEFAULT_PR_COMMIT_LIMIT = 40
DEFAULT_PR_LIST_PAGES = 2
```

clamp:

```ts
prHistoryLimit: 0..50
prCommitLimit: 1..100
prListPages: 1..5
```

### 5.2 List commits on a pull request

Endpoint:

```text
GET /repos/{owner}/{repo}/pulls/{pull_number}/commits?per_page=100&page=1
```

사용:
- PR lane에 표시할 commit 후보
- PR head sha / commit dates / author / message

주의:
- PR commits endpoint는 PR 하나당 요청 1개 이상이다.
- `prHistoryLimit=24`면 최대 24 요청이 추가될 수 있다.
- cache가 필수다.

### 5.3 Commit associated PR endpoint

Endpoint:

```text
GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls
```

이번 v1에서는 필수로 쓰지 않는다.
후속으로 특정 main commit이 어느 PR에서 왔는지 보강할 때 사용한다.

---

## 6. 타입 추가

### 6.1 GitHub PR raw types

신규 또는 기존 `src/lib/github/types.ts` 확장:

```ts
export interface GitHubPullRequestListItem {
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  merge_commit_sha: string | null;
  html_url: string;
  head: {
    ref: string;
    sha: string;
    label: string;
    repo?: { full_name: string } | null;
    user?: { login: string } | null;
  };
  base: {
    ref: string;
    sha: string;
  };
  user?: {
    login: string;
    avatar_url?: string;
  } | null;
  updated_at: string;
  created_at: string;
}
```

PR commits는 기존 `GitHubCommitListItem` 재사용 가능.

### 6.2 GitMetro branch metadata

이미 `BranchSource = "ref" | "merge-history" | "pull-request"`가 있다.
`BranchLine`에 있는 `pullNumber`를 PR lane에 사용한다.

필요 시 추가:

```ts
pullTitle?: string;
pullUrl?: string;
```

`CommitNode.pr`는 `#1234` 형태로 채운다.

### 6.3 Graph meta 추가

`GraphMeta.history` 확장:

```ts
history: {
  enabled: boolean;
  historicalBranches: number;
  capped: boolean;
  source: "first-parent-merge";
  prEnabled: boolean;
  prBranches: number;
  prCapped: boolean;
}
```

또는 별도:

```ts
prHistory: {
  enabled: boolean;
  branches: number;
  capped: boolean;
  fetchedPulls: number;
  fetchedPullCommits: number;
}
```

권장:
- 별도 `prHistory`가 더 명확하다.

---

## 7. Fetch Layer 추가

신규 파일:

```text
src/lib/github/fetchPullRequests.ts
src/lib/github/fetchPullRequestCommits.ts
```

### 7.1 fetchPullRequests

Signature:

```ts
export async function fetchMergedPullRequests(
  owner: string,
  repo: string,
  options: {
    base: string;
    limit: number;
    maxPages?: number;
  },
): Promise<GitHubPullRequestListItem[]>
```

동작:
- `/pulls?state=closed&base=...&sort=updated&direction=desc`
- `merged_at != null`만 반환
- limit 도달 시 중단
- pagination 지원

### 7.2 fetchPullRequestCommits

Signature:

```ts
export async function fetchPullRequestCommits(
  owner: string,
  repo: string,
  pullNumber: number,
  options: { limit: number },
): Promise<GitHubCommitListItem[]>
```

동작:
- `/pulls/{number}/commits`
- limit 도달 시 중단
- pagination 지원

---

## 8. PR Synthetic Branch Normalization

신규 파일:

```text
src/lib/graph/prHistory.ts
```

### 8.1 입력

```ts
export interface PrHistoryInput {
  pulls: GitHubPullRequestListItem[];
  commitsByPull: Record<number, GitHubCommitListItem[]>;
  existingBranches: BranchLine[];
  existingCommitsBySha: Record<string, CommitNode>;
  existingRawBySha: Record<string, GitHubCommitListItem>;
  defaultBranchName: string;
  startLane: number;
  prHistoryLimit: number;
  prCommitLimit: number;
}
```

### 8.2 출력

```ts
export interface PrHistoryResult {
  branches: BranchLine[];
  commits: CommitNode[];
  warnings: string[];
  capped: boolean;
  fetchedPulls: number;
  fetchedPullCommits: number;
}
```

### 8.3 Lane 생성

각 merged PR에 대해:
- PR commits가 1개 이상이어야 함
- 이미 existing graph에 모든 commit이 같은 lane으로 잘 표현되어 있으면 skip 가능
- squash/rebase 포함, PR 단위 lane을 만든다.

BranchLine:

```ts
{
  id: `pr/${pull.number}`,
  name: pull.head.ref || `PR #${pull.number}`,
  category: classifyBranchName(pull.head.ref) 또는 "feature",
  color,
  lane,
  headSha: pull.head.sha,
  isHistorical: true,
  source: "pull-request",
  pullNumber: pull.number,
  pullTitle: pull.title,
  pullUrl: pull.html_url,
  isActive: true,
}
```

### 8.4 CommitNode 생성

PR commits:
- `branch = pr/{number}`
- `pr = #number`
- `message`, `author`, `date`, `parents`는 PR commit API 응답 기반
- 기존 graph commit과 sha가 겹치면 중복 노드를 만들지 않는 것을 기본으로 한다.

문제:
- squash merge의 경우 PR commit sha가 default branch에 그대로 남아있지 않을 수 있다.
- PR commits를 lane에 표시해도 default branch의 squash commit과 parent edge로 자연스럽게 연결되지 않는다.

해결:
- synthetic connector edge가 필요하다.

---

## 9. Synthetic Connector Edge 설계

현재 renderer는 commit parents 기반 edge만 그린다.
PR synthetic lane은 default branch squash commit과 parent 관계가 없을 수 있다.

따라서 `GraphEdge` 개념을 추가한다.

### 9.1 타입 추가

`src/types/gitmetro.ts`:

```ts
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: "commit" | "branch" | "merge" | "synthetic-pr";
  branchId?: string;
  color?: string;
}

export interface GitMetroGraph {
  repo: RepositorySummary;
  branches: BranchLine[];
  commits: CommitNode[];
  edges?: GraphEdge[];
}
```

### 9.2 PR synthetic edge 생성

각 PR lane:
- from: PR lane 마지막 commit sha
- to: merge target commit sha 후보

target 후보 우선순위:
1. `pull.merge_commit_sha`가 existing graph commits에 있으면 사용
2. `pull.head.sha`가 existing graph commits에 있으면 사용
3. PR `merged_at` 이후 가장 가까운 default branch commit
4. 없으면 synthetic edge 생략하고 warning

edge:

```ts
{
  id: `pr-edge/${pull.number}`,
  from: lastPrCommitSha,
  to: targetSha,
  type: "synthetic-pr",
  branchId: `pr/${pull.number}`,
}
```

### 9.3 renderer 변경

`MetroMapCanvas`:
- 기존 parent-based edges 유지
- `data.edges`가 있으면 추가 렌더링
- `synthetic-pr` edge는 dashed 또는 낮은 opacity로 그린다.
- 사용자가 “PR metadata 기반 synthetic”임을 시각적으로 구분 가능해야 한다.

스타일:
- strokeDasharray `"6 5"` 또는 opacity `0.65`
- legend에 `PR history` 항목 추가 가능

---

## 10. UI Toggle 처리

`MapShell`:

```ts
const [showHistory, setShowHistory] = useState(true);
const [showPrHistory, setShowPrHistory] = useState(true);
```

effective visibility:
- `source === "merge-history"`는 showHistory로 제어
- `source === "pull-request"`는 showPrHistory로 제어

edges:
- hidden branch source의 synthetic edge도 숨긴다.

`BranchFilterPanel`:
- Display:
  - `Show branch history`
  - `Show PR history`
- History group:
  - merge-history와 pull-request를 badge로 구분
  - PR lane은 `PR #1234` badge

---

## 11. Diagnostics UI

신규 컴포넌트 후보:

```text
src/components/map/GraphDiagnostics.tsx
```

Props:

```ts
interface GraphDiagnosticsProps {
  meta: GraphMeta;
}
```

`GitHubGraphLoader`가 `meta`를 `MapShell`로 전달:

```tsx
<MapShell graph={state.graph} meta={state.meta} skipInitialLoading />
```

`MapShell`이 `MapToolbar` 또는 left panel에 전달.

표시:
- `selectedBranches`
- `fetchedCommits`
- `history.historicalBranches`
- `prHistory.branches`
- `warnings`
- `rateLimit.remaining`

간단 구현:
- toolbar에 `details`/`summary` 형태나 small popover button
- 복잡한 floating positioning library는 쓰지 않는다.

---

## 12. API Route 변경

`/api/github/graph` query 추가:

```text
includePrHistory=true
prHistoryLimit=24
prCommitLimit=40
prListPages=2
```

기본:

```ts
includePrHistory: true
prHistoryLimit: 24
prCommitLimit: 40
prListPages: 2
```

서버 flow:

1. repo fetch
2. branches fetch
3. commits fetch
4. tags fetch
5. merge-history normalize
6. if includePrHistory:
   - fetch merged PR list with cache
   - for each selected PR fetch PR commits with cache
   - enrich graph with PR synthetic branches/edges
7. return graph + meta

중요:
- PR fetch 실패는 graph 전체 실패로 만들지 않는다.
- warning으로 남기고 기존 graph를 반환한다.
- 단 repo/branch/commit fetch 실패는 기존처럼 failure.

---

## 13. 테스트 계획

기존 151개 테스트는 모두 유지되어야 한다.

### 13.1 Cache tests

파일:
- `src/lib/cache/memoryCache.test.ts`

테스트:
- set/get 동작
- ttl 만료
- getOrSetCached loader 1회만 호출
- clearCacheForTests

### 13.2 PR fetch tests

파일:
- `src/lib/github/fetchPullRequests.test.ts`
- `src/lib/github/fetchPullRequestCommits.test.ts`

테스트:
- endpoint path/query가 올바름
- merged_at 없는 PR 필터링
- limit과 pagination 동작
- PR commits limit 동작
- GitHub error propagation

### 13.3 PR history normalizer tests

파일:
- `src/lib/graph/prHistory.test.ts`

테스트:
- merged PR에서 `source: "pull-request"` branch 생성
- PR commits가 CommitNode로 변환
- `pullNumber`, `pullTitle`, `pullUrl`, `pr` 필드 채움
- merge_commit_sha가 있으면 synthetic edge 생성
- merge_commit_sha가 없으면 merged_at 이후 가까운 default commit target 사용
- target 없으면 warning
- duplicate sha는 중복 node 생성 안 함
- cap/warning 동작

### 13.4 Renderer tests

파일:
- `src/components/map/MetroMapCanvas.test.tsx`

추가:
- graph.edges synthetic-pr edge 렌더링
- hidden PR branch일 때 synthetic edge 숨김

### 13.5 UI tests

파일:
- `src/components/filters/BranchFilterPanel.test.tsx`
- `src/components/map/MapShell.test.tsx`
- `src/components/map/GraphDiagnostics.test.tsx`

테스트:
- Show PR history toggle 표시
- OFF 시 PR branch 숨김
- ON 시 PR branch 복원
- diagnostics에 merge lanes / PR lanes / warnings 표시

### 13.6 API route tests

파일:
- `src/app/api/github/graph/route.test.ts`

추가:
- includePrHistory=true 기본값
- includePrHistory=false면 PR fetch 호출 안 함
- PR fetch 실패가 success response warning으로 남음
- success meta에 prHistory 포함
- cache hit 시 GitHub fetch 호출 수 감소

---

## 14. 수동 검증 시나리오

작업 후 확인:

1. `npm run dev`
2. `/map/facebook/react`
3. diagnostics 확인
   - merge lanes가 0이어도 PR lanes가 생성되는지
4. `Show PR history` OFF
   - PR lanes 사라지는지
5. `Show PR history` ON
   - PR lanes 복원되는지
6. `/map/vercel/next.js`
   - PR lanes가 생성되는지
7. `Show branch history`, `Show PR history` 조합 확인
8. hover tooltip / click inspector / empty click close 유지 확인
9. warnings와 truncated 표시가 과하지 않은지 확인

주의:
- 대형 repo는 여전히 capped될 수 있다.
- PR lanes는 synthetic이므로 실제 git parent graph와 다르게 dashed edge로 구분되어야 한다.

---

## 15. 검증 명령

반드시 실행:

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

모두 통과해야 한다.

---

## 16. 완료 기준

완료 기준:
- server-side memory cache가 있다.
- `/api/github/graph`가 PR enrichment 옵션을 지원한다.
- merged PR metadata로 `source: "pull-request"` branch lanes가 생성된다.
- synthetic PR edges가 renderer에 표시된다.
- `Show PR history` toggle이 동작한다.
- diagnostics UI에서 merge history 0 / PR history N / warnings를 확인할 수 있다.
- PR fetch 실패는 전체 graph 실패가 아니라 warning으로 처리된다.
- 기존 tests와 신규 tests가 모두 통과한다.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`가 모두 통과한다.
- 이 md 파일이 `processed md files`로 이동된다.

---

## 17. 작업 후 보고 형식

Claude Code CLI는 작업 완료 후 아래 형식으로 보고한다.

```text
작업 요약:
- 

추가/변경 파일:
- 

Cache:
- 

PR API:
- fetchPullRequests:
- fetchPullRequestCommits:

PR normalization:
- synthetic branches:
- synthetic edges:
- caps/warnings:

UI:
- Show PR history:
- diagnostics:

테스트:
- cache:
- PR fetch:
- PR normalizer:
- renderer:
- UI:
- API route:

검증:
- npm run lint
- npm run typecheck
- npm run test
- npm run build

수동 확인:
- facebook/react:
- vercel/next.js:
- warnings:
- rate limit:

남은 이슈:
- 

다음 추천 작업:
- 
```

---

## 18. 다음 단계 예고

이 단계 후 후보:
1. GitHub OAuth login
2. persistent cache or Vercel KV
3. PR lane layout quality 개선
4. diagnostics polish
5. export PNG/PDF

우선순위 추천:
- PR enrichment가 안정되면 OAuth를 붙인다.
- OAuth가 들어오면 private repo와 higher rate limit을 동시에 해결할 수 있다.
