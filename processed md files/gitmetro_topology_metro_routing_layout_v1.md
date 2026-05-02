# GitMetro Topology Metro Routing Layout 구현 지침서 v1

> 대상: Claude Code CLI
> 작성자: Codex
> 목적: GitMetro map을 업로드 참고 이미지처럼 `main에서 분기 -> branch lane에서 평행 진행 -> merge 지점에서 다시 합류`하는 진짜 지하철 노선도 구조로 렌더링한다.

---

## 0. 반드시 먼저 읽을 것

작업 시작 전에 아래 파일을 먼저 읽고 따른다.

- `/Users/minmac/Documents/dev/Project/GitMetro/AGENTS.md`
- `/Users/minmac/Documents/dev/Project/GitMetro/userneeds.md`

특히 다음 규칙을 반드시 지킨다.

- 기존 md 파일은 절대 수정하지 않는다.
- 이 md 파일을 처리 완료하면 `/Users/minmac/Documents/dev/Project/GitMetro/processed md files/`로 이동한다.
- 이번 작업 범위 밖의 refactor, redesign, formatting churn은 하지 않는다.
- 작업 후 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`를 모두 실행한다.
- 실패하면 즉시 멈추고 실패 원인과 수정 범위를 보고한다.

---

## 1. 참고 이미지와 목표 구도

사용자가 업로드한 참고 이미지:

- `/Users/minmac/Downloads/3207c94d8c1d6f34215e8de3c263eefcd6c3f38b.png`

사용자가 원하는 구도는 다음이다.

```text
main ─────●────────────●────────────────●
           │            │                │
           │            │                │
hotfix     └────●───────┘                │
                │                        │
develop         └────●──────────●────────┘
                     │          │
featureB             └──●──●──●─┘
                        │
featureA               └────●──●───────┘
```

핵심은 다음이다.

- branch가 생성된 commit 지점에서 수직으로 내려가거나 올라가며 분기한다.
- branch는 자기 lane에서 main과 평행하게 진행한다.
- merge되면 merge target branch의 해당 commit 지점으로 수직 합류한다.
- merge 지점은 환승역처럼 보인다.
- commit/station은 각 lane 위에 놓인다.
- branch label은 lane 왼쪽에 붙는다.
- 선은 point-to-point data edge가 아니라 route path로 계산되어야 한다.

현재 구현처럼 "commit t 기준으로 점을 찍고 edge를 연결"하는 방식으로는 이 구도를 만들기 어렵다.

---

## 2. 현재 문제 요약

현재 상태:

- PR Timeline Reconstruction은 데이터 생성에 성공한다.
- API meta 기준으로 `mode: reconstructed`, `virtualNodes`, `branchOffEdges`, `mergeBackEdges`가 생성된다.
- 하지만 화면에서는 PR branch가 거의 보이지 않거나 사용자가 원하는 구도로 보이지 않는다.

원인:

1. branch lane이 단순 stack이다.
   - PR lane이 `-12 ~ -35`처럼 아래로 계속 밀린다.
   - `abs(lane) * 64` 좌표 때문에 많은 PR branch가 viewport 밖으로 나간다.

2. renderer가 route-first가 아니다.
   - 현재 `MetroMapCanvas`는 branch chain과 edge를 별도로 그린다.
   - branch-off와 merge-back이 "노선 path"에 통합되지 않는다.

3. PR branch가 main 근처에서 분기하는 시각 구조가 아니다.
   - 데이터상 `pr-branch-off`, `pr-merge-back` edge가 있어도, 실제 path는 사용자 눈에 "분기한 노선"으로 읽히지 않는다.

4. stable branch가 기본 selection에서 시야를 먹는다.
   - `facebook/react`에서는 오래된 `0.10-stable`, `0.11-stable` 같은 branch가 먼저 보인다.
   - 사용자가 보고 싶은 최근 PR/branch history가 아래/오른쪽으로 밀린다.

이번 작업은 "더 많은 데이터 수집"이 아니라 **metro routing layout**을 구현하는 작업이다.

---

## 3. 이번 작업 목표

목표:

- 업로드 이미지처럼 branch route가 실제 노선처럼 보이게 한다.
- branch-off와 merge-back을 한 route path 안에 포함한다.
- single-commit PR도 짧은 평행 노선으로 보이게 한다.
- PR/reconstructed branch는 기본 화면에서 실제로 보여야 한다.
- `Show PR history`를 끄면 해당 route 전체가 사라져야 한다.
- horizontal/vertical orientation 모두 동작해야 한다.

완료 후 사용자는 `facebook/react`에서 다음을 볼 수 있어야 한다.

- main lane
- main에서 아래로 분기하는 PR branch들
- PR branch lane에서 수평으로 진행하는 commit/station
- 다시 main으로 합류하는 수직 connector

---

## 4. 이번 작업 범위

포함한다.

- route-first layout builder 추가
- branch route path 생성
- branch-off / branch-horizontal / merge-back segment 렌더링
- PR branch lane compact placement
- initial viewport/focus 개선
- PR route visibility 개선
- stable/current ref branch와 PR history branch의 기본 표시 우선순위 조정
- tests 추가/수정

포함하지 않는다.

- GitHub OAuth
- private repository 지원
- persistent DB cache
- export 기능
- D3 도입
- gsap animation
- matrix/terminal background
- theme 전면 재설계
- local git clone 기반 topology 분석

---

## 5. 핵심 설계 방향

현재는 대략 이렇게 렌더링한다.

```text
commit positions -> branch chain path -> parent/synthetic edge path
```

이번 작업 후에는 이렇게 렌더링한다.

```text
graph data -> routed branch model -> route path + station positions
```

즉, `CommitNode`가 먼저가 아니라 `Route`가 먼저다.

---

## 6. 새 Layout Builder 추가

신규 파일:

- `src/lib/layout/buildMetroRouteLayout.ts`
- `src/lib/layout/buildMetroRouteLayout.test.ts`

이 파일은 기존 `buildLayout.ts`를 즉시 제거하지 않는다.

역할:

- GitMetroGraph를 받아 branch route를 계산한다.
- route별 station position을 계산한다.
- route별 SVG path를 계산한다.
- initial focus bounds를 계산한다.

예상 public API:

```ts
import type {
  BranchLine,
  CommitNode,
  GitMetroGraph,
  GraphEdge,
  MapOrientation,
} from "@/types/gitmetro";

export type MetroRouteKind =
  | "trunk"
  | "ref"
  | "merge-history"
  | "pull-request";

export type MetroSegmentKind =
  | "trunk"
  | "branch-off"
  | "branch"
  | "merge-back";

export interface RoutedStation {
  key: string;
  commit: CommitNode;
  branchId: string;
  x: number;
  y: number;
  lane: number;
  isVirtual: boolean;
}

export interface RoutedPath {
  id: string;
  branchId: string;
  kind: MetroRouteKind;
  segmentKind: MetroSegmentKind;
  d: string;
  color: string;
  opacity: number;
  dashArray?: string;
  strokeWidth?: number;
}

export interface RoutedLaneLabel {
  branchId: string;
  name: string;
  x: number;
  y: number;
  color: string;
  source?: BranchLine["source"];
  pullNumber?: number;
}

export interface RouteBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MetroRouteLayout {
  width: number;
  height: number;
  stations: RoutedStation[];
  paths: RoutedPath[];
  laneLabels: RoutedLaneLabel[];
  byKey: Record<string, RoutedStation>;
  focusBounds: RouteBounds;
  fullBounds: RouteBounds;
}

export interface BuildMetroRouteLayoutOptions {
  orientation: MapOrientation;
  visibleBranches: Set<string>;
  preferPrFocus?: boolean;
}

export function buildMetroRouteLayout(
  graph: GitMetroGraph,
  options: BuildMetroRouteLayoutOptions,
): MetroRouteLayout;
```

---

## 7. Lane 배치 전략

### 7.1 기존 문제

현재 lane은 데이터에서 받은 `branch.lane`을 그대로 쓴다.

```ts
main: 0
stable branches: -1 ~ -11
PR branches: -12 ~ -35
```

이 방식은 PR history를 화면 밖으로 밀어낸다.

### 7.2 새 전략

route layout에서는 branch source별로 lane을 재배치한다.

기본 horizontal 기준:

```text
main/default trunk: lane 0
active develop/release/hotfix/feature refs: lane 1..N 또는 -1..-N
PR history branches: main 근처 compact pool
old stable/other refs: 뒤쪽 pool 또는 기본 숨김 후보
```

추천 v1 전략:

- default branch: lane `0`
- selected non-default ref branch: lane `1..refCount`
- PR/reconstructed branch: lane `1..prLaneCount`를 재사용 가능하게 compact 배치
- 너무 많은 PR은 lane을 계속 늘리지 말고 `maxVisiblePrLanes` 안에서 겹치지 않게 배정

중요:

- lane은 시각적 lane이다. 기존 `BranchLine.lane`과 다를 수 있다.
- route layout 내부에서 `visualLaneByBranchId`를 별도로 만든다.

추천 상수:

```ts
const ROUTE_STEP = 84;
const ROUTE_LANE_GAP = 86;
const ROUTE_PAD_X = 150;
const ROUTE_PAD_Y = 92;
const ROUTE_CORNER_R = 18;
const MAX_COMPACT_PR_LANES = 8;
```

### 7.3 PR lane compact assignment

PR route는 시간 구간을 가진다.

```ts
interface RouteInterval {
  branchId: string;
  startT: number;
  endT: number;
}
```

같은 lane에 놓을 수 있는 조건:

- 두 interval이 겹치지 않거나
- 충분한 gap이 있다.

간단한 greedy:

```ts
for each PR route sorted by startT:
  place into first lane whose lastEndT + minGap <= route.startT
  otherwise create next lane
  if lane count exceeds MAX_COMPACT_PR_LANES:
    still assign, but continue stacking after compact lanes
```

v1에서는 완벽한 interval packing이 아니어도 된다.
하지만 PR lane이 무조건 `-12 ~ -35`로 밀리는 문제는 반드시 해결해야 한다.

---

## 8. Route 모델 계산

### 8.1 trunk route

default branch는 trunk다.

default branch commit들은 기존 `displayT ?? t` 순서로 정렬한다.

trunk path:

```text
M first.x trunkY H last.x
```

station은 trunk lane 위에 놓는다.

### 8.2 PR/reconstructed route

PR branch는 기존 PR Timeline Reconstruction이 만든 node/edge를 사용한다.

식별:

- `branch.source === "pull-request"`
- virtual start node: `visualKind === "pr-start"`
- virtual end node: `visualKind === "pr-end"`
- PR commit visual copy: `branch === pr/{number}`
- edges:
  - `pr-branch-off`
  - `pr-chain`
  - `pr-merge-back`

PR route에는 최소 다음이 있어야 한다.

```ts
startAnchor: default branch station
startVirtual: PR start node
branchStations: PR commit visual nodes
endVirtual: PR end node
endAnchor: default branch station
```

### 8.3 branch route path

horizontal orientation 기준:

```text
start anchor at trunk: (xStart, yTrunk)
branch lane:          yBranch
end anchor at trunk:  (xEnd, yTrunk)

path:
M xStart yTrunk
L xStart yBranch
L xEnd yBranch
L xEnd yTrunk
```

corner는 둥글게 처리한다.

추천 helper:

```ts
function roundedMetroBranchPath(
  start: Point,
  laneY: number,
  end: Point,
  radius: number,
): string
```

vertical orientation 기준:

```text
M xTrunk yStart
L xBranch yStart
L xBranch yEnd
L xTrunk yEnd
```

### 8.4 station 배치

PR branch의 station은 route의 horizontal segment 위에 놓는다.

중요:

- station의 y는 branch lane y다.
- station의 x는 `displayT` 기반이되, start/end anchor 사이에 clamp한다.
- single-commit PR도 start/end virtual node와 실제 commit이 branch lane 위에 보여야 한다.

horizontal 기준:

```ts
stationX = tToX(displayT)
stationY = branchLaneY
```

단, `displayT`가 branch start/end 밖으로 나가면 clamp한다.

```ts
stationX = clamp(tToX(displayT), xStart + minInnerPad, xEnd - minInnerPad)
```

start/end virtual station도 branch lane 위에 둔다.

branch-off/merge-back connector는 start/end virtual station과 trunk anchor를 연결한다.

### 8.5 merge marker

merge-back anchor에는 환승역처럼 보여야 한다.

v1에서는 기존 `Station`의 merge/head 스타일을 활용하되, 다음 중 하나를 적용한다.

- merge target commit에 `isMerge`가 true면 ring 강조
- `pr-merge-back` edge target이면 target station에 transfer ring overlay
- `MetroMapCanvas`에서 merge-back target key set을 만들고 overlay circle을 추가

---

## 9. Data Shape 변경 최소화

가능하면 `GitMetroGraph`의 data shape를 크게 흔들지 않는다.

이번 작업은 render-time layout을 바꾸는 것이 핵심이다.

권장:

- `CommitNode`, `GraphEdge` 확장은 이미 되어 있으므로 추가 변경은 최소화
- 새 `RouteLayout` 타입은 `src/lib/layout/buildMetroRouteLayout.ts` 내부 또는 별도 type로 둔다.
- API response shape는 변경하지 않아도 된다.

필요하면 `GraphMeta.prHistory`에 아래 필드만 추가할 수 있다.

```ts
routeMode?: "classic" | "metro-routing";
```

하지만 v1에서는 UI meta보다 실제 화면 구현을 우선한다.

---

## 10. MetroMapCanvas 변경

파일:

- `src/components/map/MetroMapCanvas.tsx`

현재는 다음 순서로 그린다.

- guide line
- parent edges
- synthetic edges
- branch chain
- stations
- labels

변경 후 route mode에서는 다음 순서로 그린다.

1. lane guide
2. trunk route path
3. branch route paths
4. merge/transfer connector overlay
5. stations
6. virtual stations
7. lane labels

권장 구현:

- 기존 `buildLayout` 기반 로직을 완전히 지우지 말고, 새 route layout을 사용하도록 변경한다.
- `buildMetroRouteLayout`이 `paths`, `stations`, `laneLabels`를 반환하게 한다.
- `MetroMapCanvas`는 계산된 path와 station만 렌더한다.

예상 구조:

```tsx
const routeLayout = useMemo(
  () =>
    buildMetroRouteLayout(data, {
      orientation,
      visibleBranches,
      preferPrFocus: true,
    }),
  [data, orientation, visibleBranches],
);

{routeLayout.paths.map((path) => (
  <path
    key={path.id}
    d={path.d}
    stroke={path.color}
    strokeWidth={path.strokeWidth ?? theme.lineWidth}
    strokeDasharray={path.dashArray}
    opacity={path.opacity}
  />
))}

{routeLayout.stations.map((station) => (
  station.commit.isVirtual ? <VirtualStation ... /> : <Station ... />
))}
```

주의:

- 기존 hover/click/selection behavior 유지
- `selectedKey`는 `getVisualNodeId(commit)` 기준 유지
- `Show PR history` off 시 PR route가 완전히 사라져야 한다.

---

## 11. Initial Viewport / Auto Focus

현재 사용자가 보는 화면에서 PR route가 안 보이는 가장 큰 이유 중 하나는 initial pan/zoom이 맞지 않기 때문이다.

이번 작업에서 반드시 추가한다.

### 11.1 focusBounds 계산

`buildMetroRouteLayout`은 `focusBounds`를 반환한다.

우선순위:

1. visible PR route가 있으면 PR route + default trunk 일부 bounds
2. 없으면 default branch bounds
3. 없으면 full bounds

### 11.2 MapShell 또는 MetroMapCanvas에서 initial fit

파일:

- `src/components/map/MetroMapCanvas.tsx`
- 또는 `src/components/map/MapShell.tsx`

최초 렌더 시 focusBounds가 viewport 안에 들어오도록 pan/zoom을 조정한다.

주의:

- 사용자가 pan/zoom을 조작한 뒤에는 자동 fit을 반복하지 않는다.
- orientation/theme/graph 변경 때만 reset할 수 있다.

추천 state:

```ts
const hasUserNavigatedRef = useRef(false);
```

drag/wheel/zoom button 사용 시 true.

fit helper:

```ts
function fitBoundsToViewport(
  bounds: RouteBounds,
  viewport: { width: number; height: number },
  padding: number,
): { zoom: number; pan: { x: number; y: number } }
```

zoom clamp는 기존 `0.5..2`보다 route map에서는 더 넓게 필요할 수 있다.

추천:

- min zoom `0.25`
- max zoom `2`

---

## 12. 기본 visible branch 정책

현재 `visibleBranches`는 모든 branch를 기본 visible로 둔다.

```ts
new Set(graph.branches.map((b) => b.id))
```

`facebook/react` 같은 repo에서는 오래된 stable branch가 너무 많이 보여서 PR map을 가린다.

이번 작업에서 기본 visible policy를 조정한다.

### 12.1 추천 정책

파일:

- `src/components/map/MapShell.tsx`
- 또는 신규 `src/lib/graph/defaultVisibleBranches.ts`

추천 API:

```ts
export function buildDefaultVisibleBranches(graph: GitMetroGraph): Set<string>
```

정책:

- default branch는 항상 visible
- `source === "pull-request"`는 visible
- `source === "merge-history"`는 visible
- develop/release/hotfix/feature ref는 visible
- old stable/other ref는 기본 hidden 후보

단, branch list에서는 eye toggle로 다시 켤 수 있어야 한다.

v1 기준:

- category `"other"`이고 `source === "ref"`인 branch가 너무 많으면 기본 hidden
- 단 branch count가 적은 repo에서는 모두 visible 가능

구체 정책:

```ts
const refBranches = graph.branches.filter(b => b.source === "ref");
const prBranches = graph.branches.filter(b => b.source === "pull-request");

if (prBranches.length > 0) {
  visible = default + develop/release/hotfix/feature refs + PR/history;
  hide "other" refs except default;
} else {
  visible = all branches;
}
```

이렇게 하면 `facebook/react`에서 오래된 stable branch가 기본 화면을 먹지 않는다.

---

## 13. Visual Styling

업로드 이미지처럼 보여야 한다.

### 13.1 line

추천:

- trunk line: 5~6px
- branch line: 5px
- branch-off/merge-back connector: branch line과 같은 색, solid
- 추정 연결임을 표시해야 한다면 opacity만 조금 낮추고 dashed는 지양

현재 dashed edge는 너무 약해서 안 보인다.

PR Timeline Map 모드에서는:

- `pr-branch-off`: solid, opacity 0.9
- `pr-chain`: solid, opacity 0.95
- `pr-merge-back`: solid, opacity 0.9

diagnostics에서 reconstructed임을 이미 보여주므로, 선을 약하게 숨길 필요가 없다.

### 13.2 colors

현재 PR branch 대부분이 `other`라 cyan 하나로 몰린다.

v1에서는 다음 중 하나를 적용한다.

Option A:

- PR branch도 category color를 유지하되, `other` PR은 PR 전용 palette를 cycle한다.

Option B:

- PR source 전용 palette:

```ts
const PR_ROUTE_COLORS = [
  "#46d369",
  "#4dd8e8",
  "#f5d84c",
  "#ff9f43",
  "#7aa7ff",
  "#d86bff",
];
```

추천: Option B.

### 13.3 labels

branch label은 lane 왼쪽에 보인다.

PR branch label은 너무 길면 잘라낸다.

추천:

- max label width 92px
- PR number badge는 branch panel에 있으므로 canvas label에는 짧은 branch name만 사용

---

## 14. Orientation 지원

horizontal:

- trunk: x축 진행
- branches: y축 lane 분리
- branch-off/merge-back: 수직 connector

vertical:

- trunk: y축 진행
- branches: x축 lane 분리
- branch-off/merge-back: 수평 connector

`buildMetroRouteLayout`에서 orientation별 좌표 변환을 분리한다.

추천 helper:

```ts
function pointFor(t: number, lane: number, orientation: MapOrientation): Point
```

하지만 route path는 orientation별로 명시적으로 만드는 것이 안전하다.

---

## 15. 테스트 계획

반드시 테스트 추가/수정.

### 15.1 buildMetroRouteLayout tests

신규:

- `src/lib/layout/buildMetroRouteLayout.test.ts`

필수 케이스:

1. default branch trunk path 생성
2. PR branch route가 branch-off, branch, merge-back path를 생성
3. PR route station이 branch lane 위에 배치됨
4. single-commit PR도 3개 station(start/commit/end)과 branch path를 가짐
5. PR lane이 compact하게 재배치됨
6. old `other` ref lane 때문에 PR lane이 `-12` 이하로 밀리지 않음
7. visibleBranches에 없는 branch route는 제외
8. focusBounds가 PR route를 포함
9. vertical orientation path 생성
10. merge-back target station이 focusBounds에 포함됨

### 15.2 defaultVisibleBranches tests

신규 권장:

- `src/lib/graph/defaultVisibleBranches.test.ts`

필수 케이스:

1. PR branch가 있으면 default + PR/history + important refs만 visible
2. old other refs는 기본 hidden
3. PR branch가 없으면 기존처럼 all visible
4. default branch는 항상 visible

### 15.3 MetroMapCanvas tests

수정:

- `src/components/map/MetroMapCanvas.test.tsx`

추가 케이스:

1. route layout path가 렌더링됨
2. `pr-branch-off`가 dashed가 아니라 visible solid path로 렌더링됨
3. single commit PR route가 visible branch path로 렌더링됨
4. `Show PR history` off 시 PR route path와 PR station이 모두 사라짐
5. virtual station hover/click 동작 유지

### 15.4 MapShell tests

수정:

- `src/components/map/MapShell.test.tsx`

추가 케이스:

1. default visible policy 적용
2. PR history branch가 기본 visible
3. old other ref가 PR mode에서 기본 hidden
4. eye toggle로 hidden ref를 다시 켤 수 있음

### 15.5 Visual regression style tests

가능한 범위에서 DOM attribute test를 추가한다.

- route path에 `data-testid="route-path-{branchId}"`
- segment path에 `data-segment-kind`
- PR station에 `data-virtual`

---

## 16. 수동 검증 계획

개발 서버:

```bash
npm run dev
```

검증 URL:

- `http://localhost:3000/map/facebook/react`
- `http://localhost:3000/map/vercel/next.js`
- `http://localhost:3000/map/octocat/Hello-World`

확인할 것:

1. `facebook/react`에서 PR branch가 실제로 화면 안에 보인다.
2. PR branch가 main에서 수직으로 분기한다.
3. PR branch가 자기 lane에서 main과 평행하게 진행한다.
4. PR branch가 main으로 다시 수직 합류한다.
5. single-commit PR도 짧은 평행 노선으로 보인다.
6. stable branch들이 기본 화면을 가리지 않는다.
7. `Show PR history` off/on이 route 전체에 적용된다.
8. zoom 50%에서도 PR route가 보인다.
9. Horizontal/Vertical 전환 모두 깨지지 않는다.
10. hover tooltip과 right inspector가 기존처럼 작동한다.

---

## 17. 예상 구현 순서

추천 순서:

1. `buildMetroRouteLayout.ts` type/API 작성
2. visual node/edge lookup helper 재사용
3. default trunk route 생성
4. PR route 생성
5. compact PR lane assignment
6. route path generation
7. `MetroMapCanvas`를 route layout 기반으로 렌더링
8. default visible branch policy 추가
9. auto focus/fit bounds 추가
10. tests 추가
11. lint/typecheck/test/build 실행
12. md 파일 processed 폴더로 이동

---

## 18. 주의점

### 18.1 기존 mock graph 유지

mock graph와 기존 interaction tests가 깨지면 안 된다.

PR route가 없는 graph에서는 기존처럼 branch chain이 보이거나, route builder가 ref branch route를 만들 수 있어야 한다.

### 18.2 API data를 다시 바꾸지 말 것

이번 작업은 API보다 renderer/layout 문제다.

불필요하게 GitHub fetch layer를 건드리지 않는다.

### 18.3 path는 강하게 보여야 한다

사용자가 현재 문제를 "아예 안 보인다"고 보고했다.

따라서 PR route는 시각적으로 분명해야 한다.

- 너무 낮은 opacity 금지
- 너무 얇은 stroke 금지
- dashed로 숨기는 것 금지

### 18.4 추정 정보 표시는 diagnostics에서 처리

PR reconstructed route는 추정 기반이다.

하지만 선 자체를 흐리게 해서 "불확실함"을 표현하지 말고, INFO diagnostics에서 설명한다.

---

## 19. 완료 기준

다음 조건을 모두 만족해야 완료다.

- 새 route-first layout builder가 구현됨
- 업로드 이미지처럼 branch-off / parallel branch / merge-back 구도가 보임
- `facebook/react`에서 PR route가 첫 화면 또는 focus된 화면 안에 보임
- PR lane이 old stable branch 아래로 밀리지 않음
- single-commit PR도 branch path가 보임
- `Show PR history` off/on 정상
- Horizontal/Vertical 정상
- hover/click/right inspector regression 없음
- 기존 tests 유지 + 신규 tests 추가
- `npm run lint` 통과
- `npm run typecheck` 통과
- `npm run test` 통과
- `npm run build` 통과
- 이 md 파일을 `/Users/minmac/Documents/dev/Project/GitMetro/processed md files/`로 이동

---

## 20. 작업 후 보고 형식

작업 완료 후 아래 형식으로 보고한다.

```md
✅ 작업 완료 보고

작업 요약:
- Topology Metro Routing Layout 구현
- branch-off → parallel branch lane → merge-back 구도 구현
- PR route visibility/initial focus/default visible policy 개선

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

## 21. Claude Code CLI에게 주는 마지막 지시

이번 작업은 "PR 데이터가 있는지"를 증명하는 작업이 아니다.

이미 PR 데이터와 virtual node/edge는 생성된다.

이번 작업의 성공 기준은 단 하나다.

```text
사용자가 업로드한 이미지처럼,
branch가 main에서 뻗어나와 평행하게 달리다가 merge 지점에서 다시 합쳐지는 모습이 실제 화면에 보이는가?
```

코드 판단이 필요하면 다음 우선순위를 따른다.

1. 업로드 이미지 같은 노선 구도가 보이는가
2. PR branch가 첫 화면에서 보이는가
3. interaction이 깨지지 않는가
4. 기존 graph/mock/tests가 깨지지 않는가
5. route 추정임을 diagnostics에서 설명할 수 있는가

