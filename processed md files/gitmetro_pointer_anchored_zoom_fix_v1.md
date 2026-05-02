# GitMetro Pointer-Anchored Zoom Fix 구현 지침서 v1

> 대상: Claude Code CLI
> 작성자: Codex
> 목적: wheel zoom in/out 시 화면이 왼쪽 원점으로 빨려 들어가지 않고, 항상 마우스 포인터 아래의 지도 지점이 그대로 유지되도록 pan/zoom transform을 보정한다.

---

## 0. 반드시 먼저 읽을 것

작업 시작 전 아래 파일을 읽고 지침을 따른다.

- `/Users/minmac/Documents/dev/Project/GitMetro/AGENTS.md`
- `/Users/minmac/Documents/dev/Project/GitMetro/userneeds.md`

필수 규칙:

- 기존 md 파일은 절대 수정하지 않는다.
- 이 md 파일을 처리 완료하면 `/Users/minmac/Documents/dev/Project/GitMetro/processed md files/`로 이동한다.
- 이번 작업은 zoom/pan interaction fix만 한다.
- layout, GitHub API, graph normalization, PR reconstruction, route rendering 구조를 불필요하게 건드리지 않는다.
- 작업 후 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`를 모두 실행한다.

---

## 1. 현재 상태 검증 결과

작업 전 Codex가 현재 코드 기준선을 확인했다.

```bash
npm run lint       # pass
npm run typecheck  # pass
npm run test       # 30 files / 245 tests passed
npm run build      # pass
```

따라서 이번 작업은 기존 통과 상태에서 wheel zoom anchor 문제만 고치는 좁은 수정이어야 한다.

---

## 2. 현재 문제

사용자 보고:

- zoom in/out 시 마우스 포인터 위치를 기준으로 확대/축소되지 않는다.
- 화면이 굉장히 왼쪽 사이드 또는 원점 쪽을 기준으로 zoom 되는 느낌이다.
- 요구사항: **무조건 마우스 포인터 기준으로 view가 zoom in/out 되어야 한다.**

현재 문제 위치:

- `src/components/map/MetroMapCanvas.tsx`

현재 wheel handler:

```ts
const onWheel = (e: WheelEvent<HTMLDivElement>) => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  const delta = -e.deltaY * 0.0015;
  hasUserNavigatedRef.current = true;
  setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
};
```

현재 SVG transform:

```tsx
<g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
```

현재 transform 수식:

```text
screen = pan + world * zoom
```

문제:

- wheel zoom에서 `zoom`만 바꾸고 `pan`을 보정하지 않는다.
- 따라서 마우스 아래에 있던 world coordinate가 zoom 후 다른 screen coordinate로 이동한다.
- 결과적으로 포인터 기준 zoom이 아니라 transform 원점 기준 zoom처럼 보인다.

---

## 3. 목표 동작

wheel zoom in/out 시:

```text
zoom 전 마우스 아래에 있던 지도 지점(world point)
==
zoom 후에도 같은 마우스 위치 아래에 있는 지도 지점(world point)
```

즉, anchor point invariant를 보장해야 한다.

```text
mouse = pan + world * oldZoom
mouse = nextPan + world * nextZoom
```

따라서:

```text
worldX = (mouseX - pan.x) / oldZoom
worldY = (mouseY - pan.y) / oldZoom

nextPan.x = mouseX - worldX * nextZoom
nextPan.y = mouseY - worldY * nextZoom
```

---

## 4. 부작용 검토

이번 수정이 건드릴 수 있는 기존 동작:

1. drag pan
   - 기존 drag는 `panX + dx`, `panY + dy` 방식이다.
   - pointer zoom helper가 drag state를 건드리면 안 된다.

2. auto-fit
   - `hasUserNavigatedRef`가 false일 때 focusBounds 기반 auto-fit이 실행된다.
   - wheel zoom을 실행하면 기존처럼 `hasUserNavigatedRef.current = true`가 되어야 한다.
   - pointer zoom 후 auto-fit이 즉시 덮어쓰면 안 된다.

3. route layout
   - `buildMetroRouteLayout`은 변경하지 않는다.
   - route path/station 좌표 계산은 변경하지 않는다.

4. hover tooltip
   - tooltip 좌표는 screen coordinate 기반이다.
   - pan/zoom 보정과 직접 충돌하지 않아야 한다.

5. click/drag clear selection
   - wheel event는 click clear와 무관해야 한다.

6. zoom controls button
   - 마우스 wheel은 pointer 기준이어야 한다.
   - `+ / -` 버튼은 포인터 기준을 적용할 명확한 pointer가 없으므로 center 기준 zoom으로 처리하는 것을 권장한다.
   - 단, 이번 작업에서 button zoom 구조 변경이 커지면 wheel fix를 우선한다.

---

## 5. 구현 설계

### 5.1 helper 추가

신규 파일 권장:

- `src/lib/layout/viewportTransform.ts`
- `src/lib/layout/viewportTransform.test.ts`

이 파일은 pan/zoom transform helper만 담당한다.

예상 API:

```ts
export interface Point {
  x: number;
  y: number;
}

export interface Pan {
  x: number;
  y: number;
}

export interface ZoomAtPointInput {
  oldZoom: number;
  nextZoom: number;
  pan: Pan;
  anchor: Point;
}

export function clampZoom(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function zoomAtPoint(input: ZoomAtPointInput): Pan {
  const worldX = (input.anchor.x - input.pan.x) / input.oldZoom;
  const worldY = (input.anchor.y - input.pan.y) / input.oldZoom;
  return {
    x: input.anchor.x - worldX * input.nextZoom,
    y: input.anchor.y - worldY * input.nextZoom,
  };
}
```

방어 조건:

- `oldZoom <= 0`일 가능성은 현재 clamp상 낮지만, helper에서 방어해도 좋다.
- `oldZoom === nextZoom`이면 기존 pan을 그대로 반환하는 것이 안전하다.

권장:

```ts
if (!Number.isFinite(input.oldZoom) || input.oldZoom <= 0) {
  return input.pan;
}
if (input.oldZoom === input.nextZoom) {
  return input.pan;
}
```

### 5.2 MetroMapCanvas wheel handler 수정

파일:

- `src/components/map/MetroMapCanvas.tsx`

현재:

```ts
const onWheel = (e: WheelEvent<HTMLDivElement>) => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  const delta = -e.deltaY * 0.0015;
  hasUserNavigatedRef.current = true;
  setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
};
```

변경 후 개념:

```ts
const onWheel = (e: WheelEvent<HTMLDivElement>) => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();

  const el = containerRef.current;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const anchor = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };

  const delta = -e.deltaY * 0.0015;
  const oldZoom = zoom;
  const nextZoom = clampZoom(oldZoom + delta, MIN_ZOOM, MAX_ZOOM);
  const nextPan = zoomAtPoint({
    oldZoom,
    nextZoom,
    pan,
    anchor,
  });

  hasUserNavigatedRef.current = true;
  setZoom(() => nextZoom);
  setPan(nextPan);
};
```

주의:

- 이 handler는 `zoom`과 `pan` prop을 동시에 사용한다.
- 빠른 wheel event에서 stale closure가 걱정되면 `zoomRef`, `panRef`를 추가한다.

추천 robust 구현:

```ts
const zoomRef = useRef(zoom);
const panRef = useRef(pan);

useEffect(() => {
  zoomRef.current = zoom;
}, [zoom]);

useEffect(() => {
  panRef.current = pan;
}, [pan]);
```

그리고 wheel handler:

```ts
const oldZoom = zoomRef.current;
const oldPan = panRef.current;
const nextZoom = clampZoom(oldZoom + delta, MIN_ZOOM, MAX_ZOOM);
const nextPan = zoomAtPoint({ oldZoom, nextZoom, pan: oldPan, anchor });

zoomRef.current = nextZoom;
panRef.current = nextPan;
setZoom(() => nextZoom);
setPan(nextPan);
```

이렇게 하면 wheel event가 빠르게 연속으로 들어와도 계산이 안정적이다.

### 5.3 drag pan과 ref 동기화

drag move에서 `setPan`을 호출할 때도 `panRef.current`를 갱신하는 것이 좋다.

기존:

```ts
setPan({
  x: drag.current.panX + dx,
  y: drag.current.panY + dy,
});
```

권장:

```ts
const nextPan = {
  x: drag.current.panX + dx,
  y: drag.current.panY + dy,
};
panRef.current = nextPan;
setPan(nextPan);
```

auto-fit에서도 ref를 갱신한다.

```ts
zoomRef.current = fit.zoom;
panRef.current = fit.pan;
setZoom(() => fit.zoom);
setPan(fit.pan);
```

reset에서 ref 동기화는 `ZoomControls`가 별도 컴포넌트라 이번 작업에서는 선택 사항이다.
단, 가능하면 MapShell에서 reset callback을 중앙화하는 후속 개선 후보로 남긴다.

### 5.4 ZoomControls 버튼 처리

현재 `ZoomControls`는 map container 위치를 모른다.

```ts
onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
```

이번 사용자 요구의 핵심은 마우스 포인터 wheel zoom이다.

하지만 버튼 zoom도 원점 기준으로 빨리는 부작용이 있을 수 있다.
가능하면 다음 중 하나를 선택한다.

#### Option A: 이번 작업에서는 wheel zoom만 고친다

- 가장 작은 변경.
- 사용자 요구인 "마우스 포인터 기준"에 직접 대응.
- 버튼은 현재처럼 유지.

#### Option B: 버튼 zoom은 viewport center 기준으로 고친다

- 더 나은 UX.
- `ZoomControls`를 `MetroMapCanvas` 안으로 이동하거나, `onZoomIn`, `onZoomOut`, `onResetView` callback을 `MapShell`/`MetroMapCanvas` 구조에 맞게 재설계해야 한다.
- 변경 범위가 커질 수 있으므로 테스트를 충분히 추가해야 한다.

권장:

- v1에서는 wheel zoom pointer-anchor fix를 반드시 완료한다.
- 버튼 center-anchor fix는 변경량이 작으면 포함하고, 구조가 커지면 별도 후속으로 남긴다.

---

## 6. 테스트 계획

### 6.1 viewportTransform unit tests

신규:

- `src/lib/layout/viewportTransform.test.ts`

필수 테스트:

1. `clampZoom` clamps min/max
2. `zoomAtPoint` preserves anchor world coordinate
3. zoom in preserves point under cursor
4. zoom out preserves point under cursor
5. same zoom returns same pan
6. invalid oldZoom returns same pan

예시 검증:

```ts
const oldZoom = 1;
const nextZoom = 2;
const pan = { x: -100, y: -50 };
const anchor = { x: 400, y: 300 };

const worldBefore = {
  x: (anchor.x - pan.x) / oldZoom,
  y: (anchor.y - pan.y) / oldZoom,
};

const nextPan = zoomAtPoint({ oldZoom, nextZoom, pan, anchor });

const screenAfter = {
  x: nextPan.x + worldBefore.x * nextZoom,
  y: nextPan.y + worldBefore.y * nextZoom,
};

expect(screenAfter).toEqual(anchor);
```

### 6.2 MetroMapCanvas interaction tests

파일:

- `src/components/map/MetroMapCanvas.test.tsx`

추가 테스트:

1. `ctrl/meta + wheel` calls `setZoom` and `setPan`
2. wheel zoom in computes pan anchored at mouse point
3. wheel zoom out computes pan anchored at mouse point
4. wheel without `ctrlKey`/`metaKey` does nothing
5. zoom clamp at min/max does not create pan jump

JSDOM에서 `getBoundingClientRect`는 기본 0일 수 있다.
테스트에서 canvas element에 mock을 건다.

```ts
const canvas = screen.getByTestId("metro-canvas");
vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
  left: 100,
  top: 50,
  width: 800,
  height: 600,
  right: 900,
  bottom: 650,
  x: 100,
  y: 50,
  toJSON: () => {},
});
```

이벤트:

```ts
fireEvent.wheel(canvas, {
  ctrlKey: true,
  deltaY: -100,
  clientX: 500,
  clientY: 350,
});
```

검증:

- `setZoom` 호출
- `setPan` 호출
- `setPan` 값이 기존 `{x: 0, y: 0}`이 아니라 anchor 보정값인지 확인

주의:

- 현재 `setup()` helper는 `pan`과 `zoom` override가 없다.
- test에서 `setup({ zoom, pan })`을 지원하도록 helper를 확장한다.

### 6.3 기존 regression 유지

기존 테스트가 계속 통과해야 한다.

- drag 후 background click clear 방지
- station hover/click
- PR route path 렌더링
- Show PR history visibility
- MapShell orientation toggle

---

## 7. 수동 검증 계획

개발 서버:

```bash
npm run dev
```

검증 URL:

- `http://localhost:3000/map/facebook/react`
- `http://localhost:3000/map/vercel/next.js`

검증 방법:

1. 지도의 특정 station 위에 마우스를 둔다.
2. trackpad pinch 또는 `Ctrl/Meta + wheel`로 zoom in 한다.
3. 마우스 아래 station/route 지점이 화면에서 거의 같은 위치에 남아 있어야 한다.
4. 같은 위치에서 zoom out 한다.
5. 마우스 아래 지점이 여전히 anchor로 유지되어야 한다.
6. drag pan 후 wheel zoom도 같은 방식으로 동작해야 한다.
7. auto-fit 직후 첫 wheel zoom도 정상이어야 한다.

부정 조건:

- zoom in 시 화면이 왼쪽 위/왼쪽 사이드로 빨려 들어가면 실패.
- zoom out 시 포인터 아래 지점이 밀려나면 실패.
- drag pan 후 wheel zoom 기준점이 어긋나면 실패.

---

## 8. 완료 기준

다음 조건을 모두 만족해야 완료다.

- wheel zoom in이 마우스 포인터 기준으로 동작
- wheel zoom out도 마우스 포인터 기준으로 동작
- pan/zoom transform invariant가 unit test로 검증됨
- drag pan 기존 동작 유지
- auto-fit 기존 동작 유지
- station hover/click 기존 동작 유지
- `Show PR history`/route rendering 영향 없음
- `npm run lint` 통과
- `npm run typecheck` 통과
- `npm run test` 통과
- `npm run build` 통과
- 이 md 파일을 `/Users/minmac/Documents/dev/Project/GitMetro/processed md files/`로 이동

---

## 9. 작업 후 보고 형식

작업 완료 후 아래 형식으로 보고한다.

```md
✅ 작업 완료 보고

작업 요약:
- Pointer-anchored wheel zoom 구현
- zoomAtPoint helper 추가
- wheel zoom in/out 시 cursor 아래 world coordinate 유지

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

## 10. Claude Code CLI에게 주는 마지막 지시

이번 작업은 zoom UX bug fix다.

route layout, PR reconstruction, GitHub API, cache layer는 건드리지 않는다.

성공 기준은 간단하다.

```text
wheel zoom 전후로 마우스 포인터 아래의 지도 지점이 그대로 유지되는가?
```

이 invariant를 코드와 테스트로 보장하라.

