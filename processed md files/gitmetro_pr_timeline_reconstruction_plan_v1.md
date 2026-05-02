# GitMetro PR Timeline Reconstruction 구현 지침서 v1

> 대상: Claude Code CLI
> 작성자: Codex
> 목적: GitHub PR metadata를 사용해 squash/rebase 중심 repository에서도 과거 branch 작업 흐름이 "분기 -> 작업 -> 합류" 형태의 지하철 노선으로 보이도록 재구성한다.

---

## 0. 반드시 먼저 읽을 것

이 작업을 시작하기 전에 아래 파일을 먼저 읽고 지침을 따른다.

- `/Users/minmac/Documents/dev/Project/GitMetro/AGENTS.md`
- `/Users/minmac/Documents/dev/Project/GitMetro/userneeds.md`

특히 다음 규칙을 지킨다.

- 기존 md 파일은 절대 수정하지 않는다.
- 이 md 파일을 처리 완료하면 `/Users/minmac/Documents/dev/Project/GitMetro/processed md files/`로 이동한다.
- 프로젝트 코드 수정은 이 문서 범위 안에서만 진행한다.
- unrelated refactor, 대규모 스타일 변경, 포맷 churn은 하지 않는다.
- 작업 후 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`를 모두 실행한다.
- 실패하면 즉시 멈추고 실패 원인과 수정 범위를 보고한다.

---

## 1. 현재 문제 요약

현재 GitMetro는 다음 단계까지 구현되어 있다.

- public GitHub REST API graph integration
- first-parent merge 기반 historical branch extraction
- PR history enrichment
- server-side in-memory TTL cache
- diagnostics INFO popover
- `Show branch history`, `Show PR history` toggle

하지만 `facebook/react`, `vercel/next.js` 같은 repository에서는 여전히 사용자가 기대하는 "과거 branch가 분리됐다가 다시 합쳐지는 지도"처럼 보이지 않는다.

이유는 다음과 같다.

1. `history.historicalBranches = 0`인 경우가 많다.
   - 많은 대형 repo가 squash/rebase merge를 사용한다.
   - 이 경우 git commit parent graph에는 merge commit second parent가 남지 않는다.
   - 따라서 순수 git topology만으로는 과거 branch lane을 복원할 수 없다.

2. 현재 PR enrichment는 PR commit을 lane에 올리지만, 지도 구조로 재구성하지 않는다.
   - `src/lib/graph/prHistory.ts`는 PR별 commit node와 `synthetic-pr` edge를 만든다.
   - 하지만 branch-off 시작점이 없다.
   - merge-back endpoint도 "가독성 있는 지도 anchor"가 아니라 찾을 수 있는 target sha에만 의존한다.
   - PR commit이 1개인 경우 `MetroMapCanvas`의 `chain.length < 2` 조건 때문에 branch line이 거의 보이지 않는다.

3. 현재 지도는 "데이터 존재"와 "지도처럼 읽힘" 사이의 변환이 부족하다.
   - 왼쪽 panel에는 `History 22`, `PR #36236`처럼 보이지만 canvas에서는 라벨이 쌓이거나 짧은 점처럼 보인다.
   - GitMetro의 목적은 GitHub Network clone이 아니라, PR/branch 작업 흐름을 사용자가 한눈에 이해하는 것이다.

---

## 2. 이번 작업 목표

이번 작업은 기존 PR enrichment를 한 단계 발전시켜 **PR Timeline Reconstruction**을 구현한다.

핵심 목표:

- squash/rebase PR도 최소한 다음 형태로 보이게 한다.

```text
main ─────●──────────────●────
           ╲            ╱
            ●──●──●────●
              PR branch
```

- PR commit이 1개뿐이어도 최소한 다음 형태로 보이게 한다.

```text
main ─────●────────●────
           ╲      ╱
            ●────●
            PR #123
```

- 사용자는 `Show PR history`를 켰을 때 "과거에 PR 단위로 작업이 갈라지고 다시 합류했다"는 흐름을 볼 수 있어야 한다.

이번 작업의 핵심 철학:

- `Exact Git History`는 실제 parent graph 기반이다.
- `PR Timeline Map`은 GitHub PR metadata 기반의 시각 재구성이다.
- GitMetro 기본 경험은 `PR Timeline Map`이어야 한다.

---

## 3. 이번 작업 범위

포함한다.

- PR timeline reconstruction normalizer 추가
- virtual visual node 타입 추가
- PR branch-off / PR chain / PR merge-back edge 타입 추가
- single-commit PR도 노선으로 보이도록 최소 visual span 보정
- `MetroMapCanvas`에서 reconstructed PR lane 렌더링
- `Show PR history` toggle과의 연동 유지
- diagnostics에 reconstruction 수치 추가
- 관련 unit/component/API regression test 추가

포함하지 않는다.

- GitHub OAuth login
- private repository 지원
- persistent DB cache
- export 기능
- D3 전환
- gsap animation
- matrix/terminal background animation
- design theme 전면 개편
- 실제 git object를 로컬 clone해서 분석하는 기능

---

## 4. 구현 방향 한 줄 요약

현재 `buildPrHistory`가 만드는 "PR commit lane"을 **visual timeline branch**로 바꾼다.

기존:

```text
PR commits only + one synthetic edge
```

변경:

```text
virtual start node -> PR commits -> virtual end node
branch-off edge + PR chain edge + merge-back edge
```

---

## 5. 데이터 모델 설계

### 5.1 CommitNode 확장

파일:

- `src/types/gitmetro.ts`

`CommitNode`에 아래 optional field를 추가한다.

```ts
export type VisualNodeKind =
  | "commit"
  | "pr-start"
  | "pr-end";

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

  /**
   * Visual-only identity.
   * Required when the same real sha needs to appear on multiple visual lanes
   * or when the node is virtual.
   */
  nodeId?: string;

  /**
   * Visual-only node marker.
   * Real commits can omit this or use "commit".
   */
  visualKind?: VisualNodeKind;

  /**
   * True for synthetic PR start/end nodes created from PR metadata.
   */
  isVirtual?: boolean;

  /**
   * Original real commit sha when this visual node mirrors a real commit.
   */
  realSha?: string;

  /**
   * Optional display timeline override.
   * Use this only if the visual sequence needs spacing that differs from raw t.
   */
  displayT?: number;
}
```

주의:

- 기존 코드가 `sha`를 key로 쓰는 부분이 많다.
- 이번 작업에서는 `nodeId ?? sha`를 visual key로 사용하는 helper를 만든다.
- 실제 commit identity는 계속 `sha`로 유지한다.
- virtual node의 `sha`는 실제 SHA가 아니어도 되지만, collision을 피하기 위해 `virtual/pr/{number}/start` 같은 문자열을 사용한다.

### 5.2 GraphEdge 확장

파일:

- `src/types/gitmetro.ts`

`GraphEdgeType`을 확장한다.

```ts
export type GraphEdgeType =
  | "commit"
  | "branch"
  | "merge"
  | "synthetic-pr"
  | "pr-branch-off"
  | "pr-chain"
  | "pr-merge-back";
```

`GraphEdge`에도 visual node id를 처리할 수 있게 명확한 주석을 추가한다.

```ts
export interface GraphEdge {
  id: string;
  from: string; // nodeId or sha
  to: string; // nodeId or sha
  type: GraphEdgeType;
  branchId?: string;
  color?: string;
}
```

기존 `synthetic-pr`는 당장 제거하지 말고 backward compatibility를 유지한다.

---

## 6. Helper 설계

### 6.1 visual node helper 추가

신규 파일:

- `src/lib/graph/visualNode.ts`

역할:

- visual node id 계산
- real/virtual node 구분
- edge endpoint lookup 통일

예상 API:

```ts
import type { CommitNode } from "@/types/gitmetro";

export function getVisualNodeId(node: CommitNode): string {
  return node.nodeId ?? node.sha;
}

export function buildVisualNodeIndex(
  commits: CommitNode[],
): Record<string, CommitNode> {
  const byId: Record<string, CommitNode> = {};
  commits.forEach((commit) => {
    byId[getVisualNodeId(commit)] = commit;
    if (!commit.nodeId && commit.sha) {
      byId[commit.sha] = commit;
    }
  });
  return byId;
}

export function makePrStartNodeId(pullNumber: number): string {
  return `virtual/pr/${pullNumber}/start`;
}

export function makePrEndNodeId(pullNumber: number): string {
  return `virtual/pr/${pullNumber}/end`;
}

export function makePrCommitNodeId(pullNumber: number, sha: string): string {
  return `pr/${pullNumber}/commit/${sha}`;
}
```

주의:

- `makePrCommitNodeId`는 같은 real sha가 default branch와 PR lane에 동시에 나타나는 상황을 안전하게 만든다.
- 기존 `layout.bySha`는 이름이 애매해진다. 이번 작업에서는 새 layout index 이름을 추가하는 것이 좋다.

---

## 7. PR Timeline Reconstruction Normalizer

### 7.1 신규 파일

신규 파일:

- `src/lib/graph/prTimelineReconstruction.ts`

기존 `src/lib/graph/prHistory.ts`를 즉시 삭제하지 않는다.

추천 방식:

- `prHistory.ts`는 기존 테스트와 backward compatibility를 위해 유지한다.
- API route에서 `buildPrHistory` 대신 새 `buildPrTimelineHistory`를 사용한다.
- 또는 `buildPrHistory` 내부를 새 구현으로 갈아타되 테스트 이름은 유지한다.
- 더 안전한 방식은 새 파일을 만들고 API route에서 새 builder를 호출하는 것이다.

### 7.2 입력 타입

예상 입력:

```ts
export interface PrTimelineHistoryInput {
  pulls: GitHubPullRequestListItem[];
  commitsByPull: Record<number, GitHubCommitListItem[]>;
  existingBranches: BranchLine[];
  existingCommits: CommitNode[];
  existingCommitsBySha: Record<string, CommitNode>;
  defaultBranchName: string;
  startLane: number;
  prHistoryLimit: number;
  prCommitLimit: number;
  minPrVisualSpan: number;
}
```

### 7.3 출력 타입

```ts
export interface PrTimelineHistoryResult {
  branches: BranchLine[];
  commits: CommitNode[];
  edges: GraphEdge[];
  warnings: string[];
  capped: boolean;
  fetchedPulls: number;
  fetchedPullCommits: number;
  reconstructedBranches: number;
  virtualNodes: number;
}
```

---

## 8. Reconstruction Algorithm

### 8.1 기본 원칙

PR 하나는 반드시 다음 visual 구조를 갖는다.

```text
start virtual node -> PR commit nodes -> end virtual node
```

edge는 다음 세 종류를 만든다.

```text
default anchor -> start virtual node       type: pr-branch-off
start -> commits -> end                   type: pr-chain
end virtual node -> default merge anchor   type: pr-merge-back
```

### 8.2 default branch commit index 만들기

existing commit에서 default branch commit만 추출한다.

```ts
const defaultCommits = existingCommits
  .filter((c) => c.branch === defaultBranchName)
  .sort((a, b) => a.t - b.t);
```

각 commit은 date epoch도 계산한다.

```ts
interface DefaultTimelinePoint {
  nodeId: string;
  sha: string;
  t: number;
  epoch: number;
}
```

### 8.3 branch-off anchor 찾기

우선순위:

1. PR 첫 commit의 parent 중 existing default commit에 있는 sha
2. PR `created_at` 이전/근처 default commit
3. 첫 PR commit date 이전/근처 default commit
4. 없으면 default branch의 가장 가까운 오래된 commit
5. 그래도 없으면 warning 후 해당 PR skip

주의:

- GitHub PR commit API의 commit parent가 default branch에 존재하지 않을 수 있다.
- squash/rebase repo에서는 PR commit parent가 원래 branch parent와 다를 수 있다.
- 따라서 날짜 기반 fallback이 반드시 필요하다.

### 8.4 merge-back anchor 찾기

우선순위:

1. `pull.merge_commit_sha`가 existing default commit에 있으면 사용
2. `pull.head.sha`가 existing default commit에 있으면 사용
3. `pull.merged_at` 이후 가장 가까운 default commit
4. `pull.updated_at` 이후 가장 가까운 default commit
5. 없으면 branch-off anchor보다 뒤에 있는 default commit
6. 그래도 없으면 warning 후 `pr-merge-back` edge 생략

### 8.5 visual t 배치

중요하다. 이 작업의 핵심은 data t가 아니라 visual t이다.

PR lane이 읽히려면 다음 조건을 만족해야 한다.

- startT < commitT... < endT
- endT는 merge anchor 근처여야 한다.
- PR commit이 1개여도 start와 end 사이 거리가 최소 `minPrVisualSpan` 이상이어야 한다.
- branch-off anchor와 merge-back anchor가 너무 가까우면 PR lane을 강제로 펼친다.

추천 로직:

```text
anchorStartT = branchOff.t
anchorEndT = mergeBack?.t ?? anchorStartT + minPrVisualSpan + rawCommitCount

visualStartT = anchorStartT + 0.35
visualEndT = max(anchorEndT - 0.35, visualStartT + minPrVisualSpan)

commit slots:
  if rawCommitCount === 0: skip
  if rawCommitCount === 1:
    commitT = midpoint(visualStartT, visualEndT)
  else:
    distribute evenly between visualStartT and visualEndT
```

현재 `CommitNode.t`는 number이므로 소수점 t 사용이 가능하다.
기존 layout이 `t * STEP`만 하므로 소수점 t는 자연스럽게 작동한다.

다만 테스트에서 정수 가정이 있는지 확인한다.

### 8.6 virtual start/end node 만들기

start node:

```ts
{
  sha: makePrStartNodeId(pull.number),
  nodeId: makePrStartNodeId(pull.number),
  shortSha: "start",
  branch: branchId,
  t: visualStartT,
  displayT: visualStartT,
  parents: [branchOff.nodeIdOrSha],
  message: `PR #${pull.number} opened`,
  author: pull.user?.login ?? "github",
  date: formatDate(pull.created_at),
  isMerge: false,
  isVirtual: true,
  visualKind: "pr-start",
  pr: `#${pull.number}`,
}
```

end node:

```ts
{
  sha: makePrEndNodeId(pull.number),
  nodeId: makePrEndNodeId(pull.number),
  shortSha: "merge",
  branch: branchId,
  t: visualEndT,
  displayT: visualEndT,
  parents: [lastPrVisualNodeId],
  message: `PR #${pull.number} merged`,
  author: pull.merged_by?.login ?? pull.user?.login ?? "github",
  date: formatDate(pull.merged_at),
  isMerge: true,
  isVirtual: true,
  visualKind: "pr-end",
  pr: `#${pull.number}`,
}
```

실제 GitHub PR type에 `merged_by`가 없다면 optional 처리한다.

### 8.7 실제 PR commit node 만들기

PR commit node는 기존 real commit과 달리 visual lane용 node로 만든다.

```ts
{
  sha: raw.sha,
  nodeId: makePrCommitNodeId(pull.number, raw.sha),
  realSha: raw.sha,
  shortSha: raw.sha.slice(0, 7),
  branch: branchId,
  t: computedT,
  displayT: computedT,
  parents: [],
  message: firstLine(raw.commit.message),
  author,
  avatar,
  date,
  isMerge: raw.parents.length > 1,
  pr: `#${pull.number}`,
}
```

중요:

- 기존 `buildPrHistory`는 `existingCommitsBySha[c.sha]`가 있으면 skip했다.
- 이번 reconstruction에서는 skip하지 않는다.
- 같은 real sha가 default branch에 있더라도 PR lane에 "visual copy"를 만들 수 있어야 한다.
- 단, 같은 PR 내부에서 중복 sha는 제거한다.

### 8.8 PR branch 생성

BranchLine:

```ts
{
  id: `pr/${pull.number}`,
  name: pull.head?.ref || `PR #${pull.number}`,
  category,
  color,
  lane: nextLane--,
  headSha: pull.head?.sha,
  isHistorical: true,
  isActive: true,
  source: "pull-request",
  pullNumber: pull.number,
  pullTitle: pull.title,
  pullUrl: pull.html_url,
}
```

### 8.9 Edge 생성

branch-off:

```ts
{
  id: `pr-off/${pull.number}`,
  from: branchOffNodeId,
  to: startNodeId,
  type: "pr-branch-off",
  branchId,
}
```

chain:

```ts
{
  id: `pr-chain/${pull.number}/${idx}`,
  from: prevNodeId,
  to: nextNodeId,
  type: "pr-chain",
  branchId,
}
```

merge-back:

```ts
{
  id: `pr-back/${pull.number}`,
  from: endNodeId,
  to: mergeBackNodeId,
  type: "pr-merge-back",
  branchId,
}
```

---

## 9. Layout 변경

파일:

- `src/lib/layout/buildLayout.ts`

현재:

```ts
const tMax = commits.length === 0 ? 0 : Math.max(...commits.map((c) => c.t));
const bySha: Record<string, CommitNode> = {};
commits.forEach((c) => {
  bySha[c.sha] = c;
});
```

변경 방향:

- visual id index를 추가한다.
- `displayT ?? t` 기준으로 위치를 계산할 수 있게 한다.

추천 타입:

```ts
export interface MapLayout {
  laneByBranchId: Record<string, number>;
  pos: (t: number, lane: number) => Point;
  posForCommit: (commit: CommitNode, lane: number) => Point;
  bySha: Record<string, CommitNode>;
  byNodeId: Record<string, CommitNode>;
  width: number;
  height: number;
  tMax: number;
  minLane: number;
}
```

`bySha`는 기존 호환을 위해 유지한다.

추가:

```ts
const visualT = (c: CommitNode) => c.displayT ?? c.t;
const tMax = commits.length === 0 ? 0 : Math.max(...commits.map(visualT));
```

`byNodeId`:

```ts
const byNodeId = buildVisualNodeIndex(commits);
```

---

## 10. Renderer 변경

파일:

- `src/components/map/MetroMapCanvas.tsx`

### 10.1 edge endpoint lookup 변경

현재 synthetic edge는 `layout.bySha[edge.from]`를 사용한다.

변경:

- edge lookup은 `layout.byNodeId[edge.from] ?? layout.bySha[edge.from]`
- 모든 `GraphEdge` 렌더링에 이 helper를 사용한다.

### 10.2 PR chain 렌더링

현재 branch path는 `branchChains[b.id]`를 사용한다.

변경:

- branch chain 정렬은 `(displayT ?? t)` 기준으로 한다.
- `chain.length >= 2`면 path를 그린다.
- PR branch는 virtual start/end가 들어가므로 single-commit PR도 chain length가 3이 된다.

### 10.3 virtual station 렌더링

virtual node는 일반 commit station처럼 크게 보이면 안 된다.

추천:

- `visualKind === "pr-start"`:
  - 작은 hollow circle
  - hover tooltip은 간단히 `PR # opened`
  - click inspector는 가능하면 열되, 가상 노드임을 표시

- `visualKind === "pr-end"`:
  - 작은 transfer ring 또는 merge marker
  - hover tooltip은 `PR # merged`

Station 컴포넌트를 직접 크게 바꾸기보다 `MetroMapCanvas`에서 virtual node용 작은 SVG element를 그리는 방식이 안전하다.

단, hover/click 동작은 기존과 맞춘다.

### 10.4 edge style

추천 style:

- `pr-chain`: PR branch color, solid, opacity 0.9
- `pr-branch-off`: PR branch color, dashed or semi-transparent, opacity 0.55
- `pr-merge-back`: PR branch color, dashed or semi-transparent, opacity 0.65
- 기존 `synthetic-pr`: backward compatibility로 dashed 유지

---

## 11. API route 변경

파일:

- `src/app/api/github/graph/route.ts`

현재 `buildPrHistory` 호출부를 찾아 새 `buildPrTimelineHistory`로 교체한다.

추가 query option:

- `prTimelineMode`
  - allowed: `"reconstructed" | "legacy"`
  - default: `"reconstructed"`

- `minPrVisualSpan`
  - default: `2`
  - clamp: `1..8`

기본 동작:

- `includePrHistory=true`
- `prTimelineMode=reconstructed`

legacy mode는 기존 `buildPrHistory`를 쓰고, reconstructed mode는 새 builder를 쓴다.

추천 이유:

- 테스트와 비교가 쉽다.
- 문제가 생기면 query로 legacy fallback이 가능하다.

Graph meta에 추가:

```ts
prHistory: {
  enabled: boolean;
  branches: number;
  capped: boolean;
  fetchedPulls: number;
  fetchedPullCommits: number;
  mode: "legacy" | "reconstructed";
  reconstructedBranches?: number;
  virtualNodes?: number;
  branchOffEdges?: number;
  mergeBackEdges?: number;
}
```

---

## 12. Diagnostics UI 변경

파일:

- `src/components/map/GraphDiagnostics.tsx`
- `src/lib/github/api-types.ts`

INFO popover에 다음을 추가한다.

- PR mode: `reconstructed` or `legacy`
- PR branches
- virtual nodes
- branch-off edges
- merge-back edges

예상 표시:

```text
PR mode        reconstructed
PR lanes       23
Virtual nodes  46
Branch-off     23
Merge-back     23
```

warnings는 기존처럼 표시한다.

---

## 13. Branch Filter UI 변경

파일:

- `src/components/filters/BranchFilterPanel.tsx`

기존 `Show PR history` toggle 유지.

추가 UI는 선택 사항이지만 추천:

- `PR Timeline Map` 상태를 직접 끄고 켜는 UI는 이번에는 toolbar diagnostics에만 표시해도 된다.
- 사용자가 바꿀 수 있는 토글까지 만들려면 API 재요청이 필요하므로 이번 작업에서는 하지 않는다.

즉 이번 작업에서 user-facing toggle은 기존 `Show PR history`만 유지한다.

---

## 14. MapShell 변경

파일:

- `src/components/map/MapShell.tsx`

확인할 것:

- `showPrHistory=false`일 때 source `"pull-request"` branch뿐 아니라 관련 edges도 모두 사라져야 한다.
- 현재 `MetroMapCanvas`가 `edge.branchId` visibility를 확인하고 있다면 충분할 수 있다.
- 새 edge type도 반드시 `branchId`를 가진다.

---

## 15. 테스트 계획

반드시 테스트를 추가/수정한다.

### 15.1 visualNode tests

신규:

- `src/lib/graph/visualNode.test.ts`

검증:

- `getVisualNodeId`가 `nodeId` 우선 사용
- `nodeId` 없으면 `sha` 사용
- `buildVisualNodeIndex`가 virtual node와 real sha를 모두 lookup 가능
- PR node id helper가 deterministic

### 15.2 prTimelineReconstruction tests

신규:

- `src/lib/graph/prTimelineReconstruction.test.ts`

필수 케이스:

1. single-commit PR도 start/commit/end 3개 node 생성
2. branch-off edge 생성
3. merge-back edge 생성
4. PR chain edge 생성
5. same real sha가 existing default commit에 있어도 PR visual copy 생성
6. `displayT`/`t`가 start < commit < end 순서
7. `minPrVisualSpan` 적용
8. `prHistoryLimit` cap 적용
9. `prCommitLimit` cap 적용
10. target anchor를 못 찾으면 warning
11. branch-off anchor를 못 찾으면 skip 또는 warning
12. lane이 startLane부터 감소

### 15.3 buildLayout tests

수정:

- `src/lib/layout/buildLayout.test.ts`

추가 케이스:

- `displayT`가 있으면 width/tMax 계산에 반영
- `byNodeId` index 생성
- `posForCommit`이 `displayT ?? t` 사용

### 15.4 MetroMapCanvas tests

수정:

- `src/components/map/MetroMapCanvas.test.tsx`

추가 케이스:

- `pr-branch-off` edge 렌더링
- `pr-chain` edge 렌더링
- `pr-merge-back` edge 렌더링
- virtual start/end node 렌더링
- `Show PR history` off 상태에서 PR edges가 숨겨짐
- single-commit PR도 branch path가 보임

### 15.5 API route tests

수정:

- `src/app/api/github/graph/route.test.ts`

추가 케이스:

- default `prTimelineMode=reconstructed`
- `prTimelineMode=legacy` fallback
- `minPrVisualSpan` clamp
- response meta에 reconstructed fields 포함
- reconstructed mode에서 virtual nodes/edges 포함

### 15.6 Diagnostics tests

수정:

- `src/components/map/GraphDiagnostics.test.tsx`

추가 케이스:

- PR mode 표시
- virtual nodes 표시
- branch-off/merge-back edge count 표시

---

## 16. 수동 검증 계획

개발 서버를 실행해서 아래 repo를 확인한다.

```bash
npm run dev
```

추천 URL:

- `http://localhost:3000/map/facebook/react`
- `http://localhost:3000/map/vercel/next.js`
- `http://localhost:3000/map/octocat/Hello-World`

확인할 것:

1. `facebook/react`에서 왼쪽 HISTORY에 PR branch가 보인다.
2. canvas에서 PR branch가 main/default line에서 분기해서 다시 합류하는 형태로 보인다.
3. single commit PR도 최소 짧은 branch line으로 보인다.
4. `Show PR history`를 끄면 PR branch와 관련 connector가 사라진다.
5. 다시 켜면 복원된다.
6. INFO popover에서 PR mode가 `reconstructed`로 보인다.
7. vertical orientation에서도 PR branch가 깨지지 않는다.
8. zoom/pan/hover/click inspector가 기존처럼 동작한다.

---

## 17. 예상 주의점

### 17.1 "정확성"과 "가독성"의 균형

이 기능은 exact git graph가 아니다.

GitHub PR metadata를 바탕으로 다음을 추정한다.

- branch-off 시점
- merge-back 시점
- PR lane의 visual span

따라서 UI 또는 diagnostics에서 reconstructed mode임을 드러내야 한다.

### 17.2 같은 sha 중복

PR commit sha가 default branch에도 존재할 수 있다.

이 경우:

- real sha는 동일
- visual node는 별도 `nodeId`

이 설계를 지키지 않으면 layout index가 덮어써져서 PR lane이 사라질 수 있다.

### 17.3 기존 inspector 영향

가상 start/end node를 클릭했을 때 inspector가 이상하게 보일 수 있다.

우선순위:

1. hover/click crash가 없어야 한다.
2. inspector에는 `PR # opened/merged` 정도라도 표시한다.
3. 가상 노드인 경우 files/parents는 `—` 처리해도 된다.

### 17.4 label 과밀

PR lane이 많으면 라벨이 많이 쌓인다.

이번 작업에서는 label collision 해결까지 하지 않는다.

다만 branch path 자체가 보이는 것이 우선이다.

---

## 18. 완료 기준

다음 조건을 모두 만족해야 완료다.

- `buildPrTimelineHistory` 또는 동등한 reconstruction builder가 구현됨
- single-commit PR도 visual branch line으로 보임
- PR branch-off edge가 생성되고 렌더링됨
- PR merge-back edge가 생성되고 렌더링됨
- 같은 real sha가 main과 PR lane에 동시에 있어도 layout이 깨지지 않음
- `Show PR history` off 시 PR branch/node/edge가 모두 숨겨짐
- INFO diagnostics에 reconstruction 관련 수치가 표시됨
- 기존 197개 테스트가 유지되고 신규 테스트가 추가됨
- `npm run lint` 통과
- `npm run typecheck` 통과
- `npm run test` 통과
- `npm run build` 통과
- 이 md 파일을 `processed md files/`로 이동

---

## 19. 작업 후 보고 형식

작업 완료 후 아래 형식으로 보고한다.

```md
✅ 작업 완료 보고

작업 요약:
- PR Timeline Reconstruction 구현
- squash/rebase PR도 virtual start/end node와 branch-off/merge-back edge로 지도화
- single-commit PR도 visible branch lane으로 표시

추가/변경 파일:
- ...

핵심 구현:
- ...

테스트:
- ...

검증:
- npm run lint: ...
- npm run typecheck: ...
- npm run test: ...
- npm run build: ...

수동 확인:
- facebook/react: ...
- vercel/next.js: ...

남은 이슈:
- 없으면 없음
- 있으면 구체적으로
```

---

## 20. Claude Code CLI에게 주는 마지막 지시

이번 작업의 목적은 단순히 PR 데이터를 더 많이 가져오는 것이 아니다.

목적은 사용자가 기대하는 GitMetro의 핵심 경험, 즉:

```text
"과거에 branch/PR이 main에서 갈라졌다가 다시 합쳐지는 흐름을 한눈에 보는 지도"
```

를 실제 화면에서 보이게 하는 것이다.

따라서 구현 중 판단이 필요하면 다음 우선순위를 따른다.

1. 지도처럼 읽히는가
2. 기존 interaction이 깨지지 않는가
3. 데이터 추정임을 diagnostics로 설명할 수 있는가
4. API 요청 수가 폭증하지 않는가
5. 테스트로 회귀를 막을 수 있는가

