# GitMetro Branch History Visualization Toggle Plan v1

작성일: 2026-05-01
대상: Claude Code CLI
목적: 실제 public GitHub repo에서 과거에 분기되었다가 merge된 branch 흐름이 납작한 일직선으로 보이는 문제를 개선하고, 사용자가 historical branch visualization을 on/off 할 수 있게 만든다.

공식 문서 참고:
- GitHub REST API - List commits: https://docs.github.com/en/rest/commits/commits
- GitHub REST API - List pull requests associated with a commit: https://docs.github.com/en/rest/commits/commits#list-pull-requests-associated-with-a-commit
- GitHub REST API - Compare two commits: https://docs.github.com/en/rest/commits/commits#compare-two-commits
- GitHub REST API - List pull requests: https://docs.github.com/en/rest/pulls/pulls

---

## 0. 운영 규칙

이 문서를 처리하는 Claude Code CLI는 아래 규칙을 반드시 지킨다.

1. 먼저 `/Users/minmac/Documents/dev/Project/GitMetro/AGENTS.md`를 읽는다.
2. 이 md 파일은 수정하지 않는다.
3. 이미 생성된 md 파일은 수정하지 않는다.
4. 작업 완료 후 이 md 파일을 아래 경로로 이동한다.
   - from: `/Users/minmac/Documents/dev/Project/GitMetro/md Files`
   - to: `/Users/minmac/Documents/dev/Project/GitMetro/processed md files`
5. 이번 작업은 branch history visualization 개선과 on/off UI 추가만 한다.
6. OAuth, caching, export, matrix background, skill-tree renderer는 이번 범위가 아니다.
7. 기존 public GitHub API integration, mock graph tests, interaction tests를 깨지 않도록 한다.

---

## 1. 현재 문제 진단

사용자가 `vercel/next.js`로 테스트했을 때 아래 문제가 발견되었다.

문제:
- 과거에 branch가 분리되었다가 merge된 흐름이 보이지 않고, 거의 일직선처럼 보인다.
- 왼쪽 branch list에는 feature branch가 여러 개 보이지만, map에서는 branch lane이 실제 분기/합류 흐름을 충분히 보여주지 못한다.

현재 구현의 원인:
1. GitHub `/branches` API는 현재 살아있는 branch ref만 준다.
   - 이미 merge 후 삭제된 과거 feature branch 이름은 branch list에 없다.
2. `GET /commits?sha={defaultBranch}`는 default branch에서 reachable한 commit을 가져온다.
   - merge commit의 second-parent 쪽 commit도 reachable history에 포함될 수 있다.
3. 현재 `assignCommitBranches` v1은 default branch가 자신이 본 commit을 먼저 전부 claim한다.
   - 이 때문에 과거 branch commit이 default lane에 붙어서 일직선처럼 보일 수 있다.
4. fully merged branch는 unique segment가 없으면 lane만 있고 선이 거의 안 보인다.
5. squash merge 또는 rebase merge는 git parent 관계상 branch 구조가 사라진다.
   - 이 경우 commit graph만으로는 과거 branch를 완벽히 복원할 수 없다.
   - 필요하면 PR metadata 기반 best-effort reconstruction이 필요하다.

결론:
- 지금 화면은 v1 normalizer의 한계이며, GitMetro의 핵심 목표인 “분기와 합류를 한눈에 보여주기”에는 부족하다.
- default branch를 단순 전체 reachable history로 보지 말고, first-parent trunk와 historical side branch lane을 분리해야 한다.
- 사용자가 원치 않을 수 있으므로 historical branch visualization은 on/off 가능해야 한다.

---

## 2. 이번 단계 목표

목표:
1. default branch의 main/canary trunk는 first-parent chain 중심으로 표현한다.
2. merge commit의 second-parent history를 historical branch lane으로 재구성한다.
3. historical branch lane을 map에서 분기 → 합류 형태로 표시한다.
4. 사용자가 historical branch visualization을 on/off 할 수 있게 한다.
5. 큰 repo에서 너무 복잡해지지 않도록 cap과 warning을 둔다.

비목표:
- deleted branch의 정확한 원래 이름을 100% 복원하지 않는다.
- squash/rebase merge의 branch 구조를 완벽히 복원하지 않는다.
- OAuth는 하지 않는다.
- GitHub GraphQL 전환은 하지 않는다.
- 전체 repository history를 무제한으로 가져오지 않는다.

---

## 3. UX 요구사항

### 3.1 기본 동작

권장 기본값:
- `Show branch history`: ON

이유:
- GitMetro의 핵심 목적은 branch가 갈라지고 합쳐지는 흐름을 시각적으로 보여주는 것이다.
- 기본이 OFF면 현재처럼 일반 git log line에 가까워져 제품 정체성이 약해진다.

단:
- 너무 큰 repo에서는 cap을 적용하고 `TRUNCATED` 또는 warning을 보여준다.

### 3.2 UI 위치

왼쪽 `BranchFilterPanel`의 `Display` 또는 별도 `History` 섹션에 toggle을 추가한다.

문구:

```text
Show branch history
```

보조 설명은 UI에 길게 넣지 않는다.
필요하면 tooltip/title 정도만 사용한다.

동작:
- ON: historical branch lanes 표시
- OFF: historical branch lanes 숨김

중요:
- toggle OFF는 API 재호출 없이 이미 받은 graph에서 `isHistorical` branch를 숨기는 방식으로 우선 구현한다.
- API 호출 비용을 줄이고 UX를 빠르게 유지하기 위해서다.

### 3.3 Filter panel 표시

historical branch는 일반 feature와 섞어서 보여도 되지만, 사용자가 구분할 수 있어야 한다.

권장:
- 별도 섹션 `HISTORY`
- 또는 branch row에 작은 `history` badge

예:

```text
HISTORY  12
merge #1234
history m1abc01
```

historical branch 이름 생성 우선순위:
1. merge commit message에서 branch name을 추출할 수 있으면 사용
2. 관련 PR number/name을 알 수 있으면 `PR #1234`
3. 아니면 `history/{shortMergeSha}` 또는 `merge/{shortSha}`

---

## 4. 타입 변경 제안

대상:
- `/Users/minmac/Documents/dev/Project/GitMetro/src/types/gitmetro.ts`

`BranchLine`에 optional metadata 추가:

```ts
export type BranchSource = "ref" | "merge-history" | "pull-request";

export interface BranchLine {
  id: string;
  name: string;
  category: BranchCategory;
  color: string;
  lane: number;
  headSha?: string;
  isDefault?: boolean;
  isActive?: boolean;
  isHistorical?: boolean;
  source?: BranchSource;
  mergedIntoSha?: string;
  sourceSha?: string;
  pullNumber?: number;
}
```

`GitMetroGraph`는 그대로 유지해도 된다.

필요하면 `RepositorySummary` 또는 API meta에 history 정보를 추가한다.

```ts
history?: {
  enabled: boolean;
  historicalBranches: number;
  capped: boolean;
}
```

하지만 우선은 `GraphApiSuccess.meta`에 넣는 것이 더 좋다.

---

## 5. API Query 및 Meta 변경

`/api/github/graph` query에 옵션 추가:

```text
includeHistory=true
historyLimit=24
historyCommitLimit=40
```

기본값:

```ts
includeHistory: true
historyLimit: 24
historyCommitLimit: 40
```

clamp:

```ts
historyLimit: 0..50
historyCommitLimit: 5..100
```

응답 meta 추가:

```ts
meta: {
  ...
  history: {
    enabled: boolean;
    historicalBranches: number;
    capped: boolean;
    source: "first-parent-merge";
  };
}
```

warnings 예:
- `Showing 24 historical merge branches (capped by historyLimit)`
- `Squash/rebase merges cannot be reconstructed from git parents`
- `Some historical branch commits were unavailable within commit limits`

---

## 6. 핵심 알고리즘: First-Parent Trunk 분리

현재 가장 중요한 개선은 default branch가 모든 reachable commit을 claim하지 않게 만드는 것이다.

### 6.1 first-parent trunk 계산

입력:
- selected default branch head sha
- raw commit pool

알고리즘:

```text
start = defaultBranchHeadSha
while start exists in rawBySha:
  add start to defaultTrunkSet
  firstParent = rawBySha[start].parents[0]
  start = firstParent?.sha
```

결과:
- default branch는 `defaultTrunkSet`에 있는 commit만 trunk lane으로 claim한다.
- merge commit은 first-parent chain에 있으므로 trunk lane에 남는다.
- merge commit의 second parent 쪽 commit들은 historical side branch lane 후보가 된다.

주의:
- commit pool에 first parent가 없으면 중단한다.
- fetched commit limit 때문에 중간이 끊길 수 있다. 이 경우 warning을 남긴다.

### 6.2 assignCommitBranches 수정

현재:
- default branch가 default commit list를 전부 claim

수정:
- `historyMode` 또는 `includeHistory`가 true일 때:
  - default branch는 first-parent trunk set만 claim
  - non-default current branch는 기존 unique segment 방식 유지
  - historical merge branches가 second-parent chain commit을 claim

OFF일 때:
- 기존 v1 방식과 유사하게 동작해도 된다.
- 단 기존 tests가 깨지지 않도록 mode별 테스트를 분리한다.

---

## 7. Historical Merge Branch 재구성

### 7.1 대상 merge commit 찾기

대상:
- default first-parent trunk에 있는 commit 중 `parents.length > 1`
- develop/release 같은 주요 branch first-parent trunk에서도 확장 가능하지만, 이번 v1에서는 default branch 중심으로 시작한다.

각 merge commit:
- parent[0] = trunk previous commit
- parent[1..] = merged branch head 후보

### 7.2 second-parent chain walk

각 second parent sha에 대해:

```text
chain = []
cursor = secondParentSha
while cursor exists in rawBySha:
  if cursor already assigned to default trunk:
    break
  if cursor already assigned to another branch:
    break
  chain.push(cursor)
  cursor = rawBySha[cursor].parents[0]?.sha
  if chain.length >= historyCommitLimit:
    capped warning
    break
```

chain이 비어 있으면 historical branch를 만들지 않는다.

### 7.3 historical BranchLine 생성

id:

```text
history/{mergeShortSha}/{index}
```

name:
- merge message에서 branch name을 추출하면 그 이름
- 아니면 `merge/{mergeShortSha}`

category:
- branch name을 추출하면 `classifyBranchName(name)` 사용
- 아니면 `feature`

metadata:

```ts
isHistorical: true
source: "merge-history"
mergedIntoSha: mergeCommitSha
sourceSha: secondParentSha
```

lane:
- current ref branches 다음 lane부터 아래로 배치
- 너무 많으면 `historyLimit`로 cap

### 7.4 historical CommitNode 배정

second-parent chain commit:
- branch = historical branch id
- t = 기존 date order index 유지

merge commit:
- default trunk branch에 남는다.
- cross-branch edge는 historical branch commit → merge commit parent 관계로 표시된다.

주의:
- 현재 renderer는 parents 기반 edge를 그린다.
- second-parent chain의 head commit이 merge commit parent로 들어가 있으면 자동으로 합류 edge가 생긴다.

---

## 8. Squash/Rebase Merge 한계와 PR 기반 확장

중요:
- squash merge는 merge commit이 없고 parent가 1개다.
- rebase merge도 원래 branch topology가 default history에 평평하게 들어갈 수 있다.
- 이 경우 git parent graph만으로는 “분기되었다가 합쳐진 branch”를 정확히 복원할 수 없다.

이번 v1:
- first-parent + true merge commit history를 먼저 구현한다.
- PR 기반 reconstruction은 구조만 열어둔다.

후속 v2 후보:
- `GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls`
- `GET /repos/{owner}/{repo}/pulls?state=closed&base={defaultBranch}&sort=updated&direction=desc`
- PR commit list를 이용해 squash/rebase merge도 synthetic history lane으로 표현

주의:
- PR API는 요청 수가 빠르게 늘어난다.
- OAuth 또는 caching 전에 무리하게 많이 호출하지 않는다.

---

## 9. UI 구현 상세

대상 예상 파일:
- `src/components/filters/BranchFilterPanel.tsx`
- `src/components/map/MapShell.tsx`
- `src/components/map/GitHubGraphLoader.tsx`
- `src/components/map/MapToolbar.tsx`

### 9.1 MapShell state

추가 state:

```ts
const [showHistory, setShowHistory] = useState(true);
```

visibleBranches 초기화:
- historical branch도 기본 visible
- showHistory false면 render/filter 단계에서 historical branch 숨김

권장:
- `effectiveVisibleBranches`를 계산한다.

```ts
const effectiveVisibleBranches = new Set(
  [...visibleBranches].filter((id) => {
    const branch = branchById[id];
    if (!showHistory && branch?.isHistorical) return false;
    return true;
  })
);
```

BranchFilterPanel props:

```ts
showHistory: boolean;
setShowHistory: (next: boolean) => void;
```

### 9.2 BranchFilterPanel

추가 UI:
- `Display` 또는 새 `History` 섹션
- checkbox/toggle:

```text
Show branch history
```

Historical branch section:
- `HISTORY` category를 별도 그룹으로 보여준다.
- 현재 `BranchCategory`에 `history`를 추가하지 말고, `isHistorical`로 그룹을 분리한다.

### 9.3 Toolbar warning

이미 `TRUNCATED` pill이 있다면 유지한다.

추가 가능:
- history capped 시 `HISTORY CAPPED` pill

단, UI가 복잡해지면 warnings panel은 후속 작업으로 둔다.

---

## 10. 테스트 계획

기존 117개 테스트는 모두 유지되어야 한다.

신규/수정 테스트:

### 10.1 first-parent trunk

신규 파일 후보:
- `src/lib/graph/firstParent.test.ts`
- 또는 `assignCommitBranches.test.ts`에 추가

테스트:
- default branch가 merge second-parent commits를 claim하지 않는다.
- default branch는 first-parent chain만 claim한다.
- first-parent chain이 끊겨도 crash하지 않는다.

### 10.2 historical branch extraction

신규 파일 후보:
- `src/lib/graph/historicalBranches.test.ts`
- 또는 `normalizeGitHubGraph.test.ts`에 추가

fixture:
- main: A → B → M
- feature: C → D
- M parents: B, D

기대:
- main branch commit: A, B, M
- historical branch commit: C, D
- historical branch has `isHistorical = true`
- historical branch has `mergedIntoSha = M`
- D → M edge가 renderer에서 그려질 수 있도록 parents 유지

### 10.3 includeHistory off

테스트:
- `includeHistory = false`이면 historical branch가 생성되지 않는다.
- 기존 current branch behavior가 유지된다.

### 10.4 history cap

테스트:
- historyLimit보다 많은 merge commit이 있으면 capped warning 생성
- generated historical branch 수가 historyLimit 이하

### 10.5 UI interaction

대상:
- `BranchFilterPanel`
- `MapShell`

테스트:
- `Show branch history` toggle이 존재한다.
- toggle off 시 historical branch station/line이 숨겨진다.
- toggle on 시 다시 보인다.
- branch 개별 visibility와 showHistory toggle이 충돌하지 않는다.

### 10.6 API route

대상:
- `src/app/api/github/graph/route.test.ts`

테스트:
- query `includeHistory=false`가 normalizer option으로 전달된다.
- query `historyLimit` clamp가 적용된다.
- success meta에 history 정보가 포함된다.

---

## 11. 수동 검증 시나리오

작업 후 아래 repo로 확인한다.

1. `octocat/Hello-World`
2. `vercel/next.js`
3. `facebook/react`
4. true merge commit이 많은 작은 public repo가 있으면 추가

확인:
- `vercel/next.js`에서 이전보다 branch history가 덜 납작하게 보이는지
- true merge commit이 있는 repo에서 branch가 분리 후 merge되는 형태가 보이는지
- `Show branch history` OFF 시 기존처럼 단순하게 보이는지
- ON/OFF 전환이 빠른지
- tooltip/inspector/pan/zoom이 유지되는지
- truncated/history capped warning이 과하게 거슬리지 않는지

주의:
- `vercel/next.js`가 squash/rebase 중심이면 여전히 완벽한 분기/합류가 안 보일 수 있다.
- 이 경우 화면 또는 warning에 “squash/rebase merge history requires PR enrichment”를 meta warning으로 남기는 것은 허용한다.

---

## 12. 검증 명령

반드시 실행:

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

모두 통과해야 한다.

---

## 13. 완료 기준

완료 기준:
- historical branch visualization이 기본 ON이다.
- 사용자가 `Show branch history` toggle로 historical branch lane을 숨기고 다시 보일 수 있다.
- default branch trunk가 first-parent 중심으로 분리된다.
- merge commit second-parent chain이 historical branch lane으로 표시된다.
- historyLimit/historyCommitLimit cap과 warning이 동작한다.
- existing tests가 모두 통과한다.
- 신규 tests가 추가된다.
- `vercel/next.js` 같은 큰 repo에서도 crash하지 않는다.
- 이 md 파일이 `processed md files`로 이동된다.

---

## 14. 작업 후 보고 형식

Claude Code CLI는 작업 완료 후 아래 형식으로 보고한다.

```text
작업 요약:
- 

추가/변경 파일:
- 

알고리즘 변경:
- first-parent trunk:
- historical merge branches:
- includeHistory off:
- cap/warnings:

UI 변경:
- Show branch history toggle:
- historical branch grouping:

테스트:
- first-parent:
- historical branches:
- includeHistory off:
- UI toggle:
- API query/meta:

검증:
- npm run lint
- npm run typecheck
- npm run test
- npm run build

수동 확인:
- vercel/next.js:
- 기타 repo:

남은 이슈:
- squash/rebase merge 한계:
- PR enrichment 필요 여부:

다음 추천 작업:
- 
```

---

## 15. 다음 단계 예고

이 단계 후에도 squash/rebase merge 중심 repo에서 과거 branch가 충분히 안 보이면 다음 단계는 PR metadata enrichment다.

후속 후보:
1. closed merged PR list fetch
2. PR commits fetch
3. squash/rebase PR을 synthetic branch lane으로 표현
4. API caching
5. OAuth login

우선순위 추천:
- 이 단계에서 true merge history를 먼저 안정화한다.
- 그 다음 PR enrichment와 caching을 같이 검토한다.
