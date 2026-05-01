# GitMetro Public GitHub API Integration Plan v1

작성일: 2026-05-01
대상: Claude Code CLI
목적: 테스트 기반이 구축된 현재 상태에서 mock graph를 public GitHub repository 데이터로 교체할 수 있도록 GitHub REST API 연동, graph 정규화, loading/error flow, 테스트 범위를 설계한다.

공식 문서 확인:
- GitHub REST API - Get a repository: https://docs.github.com/en/rest/repos/repos
- GitHub REST API - List branches: https://docs.github.com/en/rest/branches/branches
- GitHub REST API - List commits: https://docs.github.com/en/rest/commits/commits
- GitHub REST API - List repository tags: https://docs.github.com/rest/repos/repos
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
5. 이번 작업은 public GitHub repository graph integration만 한다.
6. OAuth, private repo, export PNG/PDF, share page, skill-tree renderer, matrix background animation은 이번 범위가 아니다.
7. 기존 mock graph 기반 테스트와 interaction 테스트를 깨지 않도록 한다.
8. public API 연동 실패 시 mock graph로 조용히 fallback하지 않는다. 사용자에게 명확한 error state를 보여준다.

---

## 1. 현재 상태 요약

이미 완료된 것:
- Next.js 15 + React 19 + TypeScript + TailwindCSS 앱 구축
- mock graph 기반 `/map/[owner]/[repo]` 화면 구현
- horizontal/vertical orientation
- branch filter
- theme selector
- hover tooltip
- click inspector
- inspector collapse
- pan/zoom
- Vitest 테스트 환경
- 핵심 lib, layout, mock graph, interaction 회귀 테스트

현재 한계:
- `/map/[owner]/[repo]`는 URL의 owner/repo만 toolbar에 반영하고 실제 data는 `MOCK_GRAPH`를 사용한다.
- GitHub API route가 없다.
- GitHub 응답을 `GitMetroGraph`로 정규화하는 계층이 없다.
- 실제 public repo의 not found, rate limit, private/forbidden, oversized 상태를 처리하지 않는다.

이번 목표:
- public repository URL 입력 후 실제 GitHub 데이터를 가져와 metro map으로 렌더링한다.

---

## 2. 사용자 Flow 목표

최종 flow:

1. 사용자가 `/`에서 `facebook/react` 또는 `https://github.com/facebook/react` 입력
2. `/map/facebook/react`로 이동
3. map page에서 loading terminal 표시
4. client가 `/api/github/graph?owner=facebook&repo=react` 호출
5. API route가 GitHub REST API에서 repository, branches, commits, tags를 수집
6. 서버가 `GitMetroGraph`로 정규화
7. client가 `MapShell`에 실제 graph를 전달
8. 사용자는 기존과 동일하게 map, filter, orientation, tooltip, inspector를 사용
9. 실패 시 error panel 표시

중요:
- loading terminal은 실제 API 호출이 진행되는 동안 보여야 한다.
- server component가 데이터를 다 가져온 뒤에야 client loading을 보여주는 구조는 피한다.

---

## 3. 권장 구조 변경

현재:

```text
src/app/map/[owner]/[repo]/page.tsx
  -> MOCK_GRAPH를 owner/repo만 바꿔 MapShell에 전달
```

변경 후:

```text
src/app/map/[owner]/[repo]/page.tsx
  -> <GitHubGraphLoader owner={owner} repo={repo} />

src/components/map/GitHubGraphLoader.tsx
  -> client component
  -> loading terminal 표시
  -> /api/github/graph 호출
  -> success: <MapShell graph={graph} skipInitialLoading />
  -> error: <GitHubGraphError />
```

`MapShell` 조정:
- 현재 `MapShell`은 내부에서 loading phase를 갖고 있다.
- 실제 API loading은 `GitHubGraphLoader`가 담당하게 한다.
- `MapShell`에 아래 prop을 추가한다.

```ts
interface Props {
  graph: GitMetroGraph;
  loadingStepMs?: number;
  skipInitialLoading?: boolean;
}
```

동작:
- mock/test에서 기존 loading을 유지할 수 있다.
- 실제 GitHub graph flow에서는 `skipInitialLoading` 또는 `initialPhase="map"` 방식으로 즉시 map을 렌더링한다.

---

## 4. 신규/수정 파일 제안

신규 API route:

```text
src/app/api/github/repo/route.ts
src/app/api/github/graph/route.ts
```

신규 GitHub lib:

```text
src/lib/github/client.ts
src/lib/github/types.ts
src/lib/github/errors.ts
src/lib/github/fetchRepository.ts
src/lib/github/fetchBranches.ts
src/lib/github/fetchCommits.ts
src/lib/github/fetchTags.ts
```

신규 graph normalization:

```text
src/lib/graph/normalizeGitHubGraph.ts
src/lib/graph/branchSelection.ts
src/lib/graph/assignCommitBranches.ts
```

신규 UI:

```text
src/components/map/GitHubGraphLoader.tsx
src/components/map/GitHubGraphError.tsx
```

테스트:

```text
src/lib/github/client.test.ts
src/lib/github/fetchRepository.test.ts
src/lib/github/fetchBranches.test.ts
src/lib/github/fetchCommits.test.ts
src/lib/github/fetchTags.test.ts
src/lib/graph/normalizeGitHubGraph.test.ts
src/app/api/github/graph/route.test.ts
src/components/map/GitHubGraphLoader.test.tsx
```

필요 시 기존 테스트 업데이트:

```text
src/components/map/MapShell.test.tsx
```

---

## 5. GitHub REST API 사용 범위

이번 단계는 REST API만 사용한다.

### 5.1 Repository metadata

Endpoint:

```text
GET https://api.github.com/repos/{owner}/{repo}
```

사용 데이터:
- `owner.login`
- `name`
- `full_name`
- `description`
- `default_branch`
- `stargazers_count`
- `forks_count`
- `pushed_at`
- `updated_at`
- `private`
- `html_url`

### 5.2 Branch list

Endpoint:

```text
GET https://api.github.com/repos/{owner}/{repo}/branches?per_page=100&page=1
```

공식 문서 기준:
- public resource는 authentication 없이 호출 가능
- `per_page` max는 100

사용 데이터:
- `name`
- `commit.sha`
- `protected`

### 5.3 Commits per branch

Endpoint:

```text
GET https://api.github.com/repos/{owner}/{repo}/commits?sha={branchName}&per_page=100&page={page}
```

공식 문서 기준:
- `sha` query는 commit listing 시작 branch/SHA를 지정
- public resource는 authentication 없이 호출 가능
- `per_page` max는 100

사용 데이터:
- `sha`
- `parents[].sha`
- `commit.message`
- `commit.author.name`
- `commit.author.date`
- `commit.committer.date`
- `author.login`
- `author.avatar_url`
- `html_url`

주의:
- list commits 응답은 changed files 상세를 포함하지 않는다.
- 이번 단계에서 commit별 changed files count를 얻기 위해 single commit endpoint를 모든 commit에 호출하지 않는다.
- `CommitNode.files`는 `undefined`로 둔다.
- inspector는 files가 없을 때 `—` 또는 적절한 empty 표시를 유지한다.

### 5.4 Tags

Endpoint:

```text
GET https://api.github.com/repos/{owner}/{repo}/tags?per_page=100&page=1
```

사용 데이터:
- `name`
- `commit.sha`

정규화:
- tag commit sha가 포함된 commit이면 `isTag = true`, `tag = tag.name`
- 여러 tag가 같은 sha를 가리키면 첫 번째 tag만 표시하거나 짧게 join한다.
- tag fetch 실패는 graph 전체 실패로 만들지 않는다. warning으로만 남길 수 있다.

---

## 6. Rate Limit 및 인증 정책

이번 단계:
- public repository는 unauthenticated request로 우선 지원
- optional server-only `GITHUB_TOKEN`이 있으면 Authorization header에 사용
- OAuth는 하지 않는다.

공식 문서 기준:
- unauthenticated REST API primary rate limit은 IP 기준 60 requests/hour
- authenticated REST API는 일반적으로 더 높은 limit을 제공

환경변수:

```text
GITHUB_TOKEN=
GITHUB_API_VERSION=2026-03-10
```

주의:
- `GITHUB_TOKEN`은 절대 client component에 노출하지 않는다.
- `NEXT_PUBLIC_` prefix를 붙이지 않는다.
- token이 없어도 public repo flow는 동작해야 한다.

GitHub 요청 headers:

```text
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2026-03-10
Authorization: Bearer ${GITHUB_TOKEN} // token이 있을 때만
User-Agent: GitMetro
```

---

## 7. API Response 설계

`/api/github/graph` 성공 응답:

```ts
type GraphApiSuccess = {
  ok: true;
  graph: GitMetroGraph;
  meta: {
    source: "github";
    owner: string;
    repo: string;
    truncated: boolean;
    selectedBranches: number;
    fetchedCommits: number;
    maxBranches: number;
    commitLimit: number;
    warnings: string[];
    rateLimit?: {
      limit?: number;
      remaining?: number;
      reset?: number;
    };
  };
};
```

`/api/github/graph` 실패 응답:

```ts
type GraphApiFailure = {
  ok: false;
  error: {
    code:
      | "invalid_request"
      | "not_found"
      | "forbidden"
      | "rate_limited"
      | "github_unavailable"
      | "empty_graph"
      | "unknown";
    message: string;
    status: number;
    resetAt?: string;
  };
};
```

HTTP status mapping:
- 400: invalid_request
- 403 with rate limit headers: rate_limited 또는 forbidden
- 404: not_found
- 409: github_unavailable 또는 empty_graph
- 500: unknown/server error

---

## 8. Graph Normalization Strategy v1

이번 단계는 완벽한 Git graph visualizer가 아니라, public repo branch/commit history를 `GitMetroGraph`로 안정적으로 변환하는 첫 버전이다.

### 8.1 Branch selection

문제:
- 큰 repo는 branch가 수백 개일 수 있다.
- 모든 branch에 대해 commits를 가져오면 rate limit에 바로 걸릴 수 있다.

기본값:

```ts
const DEFAULT_MAX_BRANCHES = 12;
const DEFAULT_BRANCH_COMMIT_LIMIT = 80;
const DEFAULT_TOTAL_COMMIT_LIMIT = 500;
```

query params:

```text
/api/github/graph?owner={owner}&repo={repo}&maxBranches=12&commitLimit=500
```

선택 규칙:
1. default branch는 무조건 포함
2. `develop`/`dev` 우선 포함
3. `release/*`, `rc/*`
4. `hotfix/*`, `fix/*`
5. `feature/*`, `feat/*`
6. 기타 branch

동일 category 내부 정렬:
- branch head sha가 default branch와 다른 branch 우선
- 이름 알파벳 정렬

### 8.2 BranchLine 생성

각 selected branch:
- `id`: branch name
- `name`: branch name
- `category`: `classifyBranchName(name)`
- `color`: category별 기본 색상 placeholder
- `lane`: default branch `0`, 나머지 `-1`, `-2`, ...
- `headSha`: branch commit sha
- `isDefault`: repo.default_branch와 일치 여부
- `isActive`: true

주의:
- theme color remap은 기존 `applyThemeToGraph`가 담당한다.
- 여기서는 category와 lane을 안정적으로 넣는 것이 중요하다.

### 8.3 Commit 수집

각 selected branch마다:
- `GET /commits?sha={branchName}&per_page=100&page=...`
- branch별 최대 `DEFAULT_BRANCH_COMMIT_LIMIT`만 수집
- 전체 unique commit 수가 `DEFAULT_TOTAL_COMMIT_LIMIT`에 도달하면 중단

중복 처리:
- 같은 sha는 하나의 raw commit record로 dedupe
- `branchCommitShasByBranch[branchId]`는 branch별 commit 순서를 보존

GitHub commit list는 최신 commit부터 반환되므로:
- 내부 정규화에서는 필요한 경우 오래된 commit → 최신 commit 순서로 뒤집어 사용한다.

### 8.4 Primary branch assignment

현재 `CommitNode`는 `branch: string` 하나만 갖는다.
하나의 commit이 여러 branch에 포함될 수 있으므로 v1에서는 primary branch를 정해야 한다.

권장 알고리즘:

1. default branch commits를 먼저 default branch에 assign
2. 나머지 branch는 branch selection 순서대로 처리
3. branch history를 newest → oldest로 보며, 이미 assign된 sha를 만날 때까지 unique segment를 해당 branch에 assign
4. 이미 assign된 shared ancestor는 기존 branch assignment를 유지
5. merge commit은 자신이 발견된 target branch에 남긴다.
6. branch head sha는 반드시 해당 branch에 보이도록 한다. 단, 이미 default branch에 포함된 fully merged branch는 별도 unique segment가 없을 수 있다.

목표:
- feature/hotfix/release branch의 고유 commit은 해당 branch lane에 표시
- merge commit은 main/develop/release 같은 target branch lane에 표시
- parent edge가 branch spawn/merge 관계를 만들 수 있게 parents를 보존

### 8.5 t index 생성

`CommitNode.t`는 layout x/y 시간축 index다.

권장:
- included commits를 commit date ascending으로 정렬
- 같은 date는 sha로 stable tie-break
- `t = index`

주의:
- Git date만으로 완벽한 topological order가 보장되지는 않는다.
- parent가 child보다 뒤로 배치되는 edge case는 v1에서 warning으로 기록한다.
- 필요하면 normalize 단계에서 parent t가 child t보다 커지는 경우 child t를 뒤로 미는 보정은 후속 작업으로 둔다.

### 8.6 CommitNode 생성

필드 매핑:

```ts
sha: raw.sha
shortSha: raw.sha.slice(0, 7)
branch: primaryBranchId
t: computedIndex
parents: raw.parents.map((p) => p.sha)
message: first line of raw.commit.message
author: raw.author?.login ?? raw.commit.author?.name ?? raw.commit.committer?.name ?? "unknown"
avatar: initials from author/login/name
date: formatted commit date
files: undefined
isMerge: raw.parents.length > 1
isHead: selected branch head sha set contains raw.sha
isTag: tag map has raw.sha
tag: tag map value
pr: undefined
```

주의:
- `parents`는 included commit에 없는 sha도 원본 그대로 보존할 수 있다.
- renderer는 unknown parent를 무시하므로 crash하면 안 된다.
- tests에서는 normalizer가 unknown parent 때문에 crash하지 않는지 확인한다.

---

## 9. API Route 설계

### 9.1 `/api/github/repo`

Query:

```text
owner
repo
```

역할:
- repository metadata만 반환
- entry validation 또는 future preview에 활용 가능

이번 단계에서 필수는 아니지만 구현하면 좋다.

### 9.2 `/api/github/graph`

Query:

```text
owner
repo
maxBranches?
commitLimit?
branchCommitLimit?
```

역할:
- repository metadata
- branch list
- selected branches
- commits per selected branch
- tags
- `GitMetroGraph` normalization
- structured success/error response

서버 validation:
- owner/repo 누락 시 400
- owner/repo segment validation은 `parseRepoInput` 또는 별도 shared validator 재사용
- maxBranches/commitLimit은 min/max clamp

권장 clamp:

```ts
maxBranches: 1..30
branchCommitLimit: 10..200
commitLimit: 50..1000
```

---

## 10. Client Loading/Error Flow

### 10.1 GitHubGraphLoader

Props:

```ts
interface GitHubGraphLoaderProps {
  owner: string;
  repo: string;
}
```

State:

```ts
type State =
  | { status: "loading" }
  | { status: "success"; graph: GitMetroGraph; meta: GraphMeta }
  | { status: "error"; error: GraphApiFailure["error"] };
```

동작:
- mount 시 `/api/github/graph` 호출
- loading 동안 `LoadingTerminal` 표시
- success 시 `<MapShell graph={graph} skipInitialLoading />`
- error 시 `<GitHubGraphError error={error} owner={owner} repo={repo} />`

Retry:
- error 화면에 retry button 제공
- retry는 같은 API URL을 다시 호출

### 10.2 Error UI

에러 메시지:
- not_found: 저장소를 찾을 수 없음
- forbidden: private repo이거나 권한 부족
- rate_limited: GitHub API rate limit. resetAt이 있으면 표시
- empty_graph: branch/commit 데이터 없음
- github_unavailable: GitHub API conflict/unavailable
- unknown: 일반 실패

UI 톤:
- dark developer tool 톤 유지
- 커다란 마케팅형 화면 금지
- terminal/log 느낌의 concise error panel 권장

---

## 11. 테스트 계획

기존 테스트를 유지하고 아래 테스트를 추가한다.

### 11.1 github client tests

대상:
- `src/lib/github/client.ts`

테스트:
- Accept, X-GitHub-Api-Version, User-Agent header가 들어간다.
- `GITHUB_TOKEN`이 있을 때만 Authorization header가 들어간다.
- 200 JSON response를 반환한다.
- 404를 `GitHubApiError`로 변환한다.
- rate limit 관련 403을 `rate_limited`로 식별한다.
- invalid JSON 또는 network error를 안전하게 error로 변환한다.

### 11.2 fetch layer tests

대상:
- `fetchRepository`
- `fetchBranches`
- `fetchCommits`
- `fetchTags`

테스트:
- 올바른 endpoint path/query를 호출한다.
- pagination이 필요한 경우 page를 증가시킨다.
- max limit에 도달하면 중단한다.
- tags fetch 실패는 graph 전체 실패로 만들지 않는 전략이면 warning으로 남긴다.

### 11.3 normalizer tests

대상:
- `normalizeGitHubGraph`
- `branchSelection`
- `assignCommitBranches`

fixture:
- 작은 GitHub raw fixture를 테스트 파일 안에 작성한다.
- main, develop, feature, hotfix, release, merge commit, tag를 포함한다.

테스트:
- `GitMetroGraph` shape가 현재 renderer와 호환된다.
- default branch lane은 0이다.
- selected branch count가 maxBranches를 넘지 않는다.
- branch categories가 정확하다.
- commit sha dedupe가 된다.
- merge commit은 `isMerge = true`다.
- tag sha는 `isTag = true`, `tag` 값이 들어간다.
- commit dates가 `t` ascending order로 변환된다.
- missing parent sha가 있어도 crash하지 않는다.
- branch head commit은 `isHead = true`다.

### 11.4 API route tests

대상:
- `/api/github/graph`

테스트:
- owner/repo 누락 시 400
- GitHub 404를 structured failure로 반환
- successful raw fetch chain을 graph success response로 반환
- rate limit error가 structured failure로 반환

### 11.5 client loader tests

대상:
- `GitHubGraphLoader`

테스트:
- loading state에서 terminal이 보인다.
- success response 후 map shell이 보인다.
- error response 후 error panel이 보인다.
- retry button이 다시 fetch를 호출한다.

주의:
- 실제 GitHub 네트워크 호출을 테스트에서 하지 않는다.
- `global.fetch` mock 또는 MSW 중 하나를 사용한다. 이번 단계에서는 간단히 `global.fetch` mock으로 충분하다.

---

## 12. 수동 검증 시나리오

작업 후 반드시 수동 확인한다.

1. `npm run dev`
2. `/` 접속
3. `facebook/react` 입력 후 Visualize
4. loading terminal 표시 확인
5. 실제 repo metadata와 branch/commit graph가 map에 반영되는지 확인
6. branch filter 동작 확인
7. hover tooltip 동작 확인
8. station click inspector 동작 확인
9. empty map click inspector close 동작 확인
10. horizontal/vertical 전환 확인
11. theme selector 확인
12. 존재하지 않는 repo 입력
    - 예: `octocat/not-a-real-repo-xyz`
    - error panel 확인
13. rate limit 상황은 mock test로 검증하고, 수동에서는 headers/meta 표시만 확인

권장 public repo 수동 테스트:
- `octocat/Hello-World`
- `vercel/next.js`
- `facebook/react`

주의:
- 큰 repo는 branch/commit limit 때문에 일부만 표시되어야 정상이다.
- limit 때문에 일부만 표시될 경우 UI나 meta에 truncated/warning을 노출한다.

---

## 13. 검증 명령

작업 후 반드시 실행한다.

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

모두 통과해야 한다.

---

## 14. 완료 기준

완료 기준:
- `/api/github/graph`가 public GitHub repo를 `GitMetroGraph`로 반환한다.
- `/map/[owner]/[repo]`가 mock graph가 아니라 실제 public GitHub graph를 렌더링한다.
- loading terminal이 실제 API 호출 중 표시된다.
- error state가 structured message로 표시된다.
- default branch, branch categories, merge commits, tags가 가능한 범위에서 반영된다.
- branch/commit limit로 rate limit 위험을 줄인다.
- 기존 mock graph tests와 interaction tests가 계속 통과한다.
- 신규 GitHub client/normalizer/API route/loader tests가 통과한다.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`가 모두 통과한다.
- 이 md 파일이 `processed md files`로 이동된다.

---

## 15. 작업 후 보고 형식

Claude Code CLI는 작업 완료 후 아래 형식으로 보고한다.

```text
작업 요약:
- 

추가/변경 파일:
- 

API 구현:
- /api/github/repo:
- /api/github/graph:

Graph normalization:
- branch selection:
- commit dedupe:
- primary branch assignment:
- t index:
- tags:
- truncation/warnings:

테스트:
- GitHub client:
- fetch layer:
- normalizer:
- API route:
- client loader:
- existing regression:

검증:
- npm run lint
- npm run typecheck
- npm run test
- npm run build

수동 확인:
- tested repos:
- observed warnings:
- error state:

남은 이슈:
- 

다음 추천 작업:
- 
```

---

## 16. 다음 단계 예고

이 단계가 끝나면 다음 후보는 아래 중 하나다.

1. GitHub OAuth + private repository 지원
2. 대형 저장소 summary/clustering 개선
3. vertical lane bilateral split 개선
4. export PNG/PDF
5. entry background matrix/terminal animation

우선순위 추천:
- public API flow가 안정되면 OAuth를 붙인다.
- OAuth 전에는 private repo를 지원하지 않는다.
