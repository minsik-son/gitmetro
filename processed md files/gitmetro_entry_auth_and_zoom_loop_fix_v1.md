# GitMetro Entry Auth UI + Zoom Update Loop Fix v1

## 0. 작업 목적

현재 GitHub OAuth 로그인 자체는 성공하지만 두 가지 문제가 남아 있다.

1. `/map/[owner]/[repo]` 화면 상단 toolbar에서는 로그인된 유저 account menu가 보이지만, `/` entry page에서는 여전히 정적 `Sign in with GitHub` 버튼만 보인다.
2. map 화면에서 아래 React 오류가 발생한다.

```text
Maximum update depth exceeded.

at setZoom (src/components/map/MapShell.tsx:151:35)
at MetroMapCanvas.useEffect (src/components/map/MetroMapCanvas.tsx:262:5)
```

이 md의 목표는:

- entry page에서도 로그인 상태를 확인하고 authenticated user UI를 보여주기
- 기존 entry 디자인의 단순함은 유지하기
- `MetroMapCanvas` auto-fit과 `MapShell` zoom setter 사이의 무한 update loop 제거하기
- pointer anchored wheel zoom, auto-fit, pan/drag, toolbar auth 기능은 유지하기

---

## 1. 현재 원인 분석

### 1.1 Entry page 로그인 UI 원인

현재 `src/app/page.tsx`는 `AuthStatus`가 아니라 정적 링크 컴포넌트인 `GitHubSignInButton`을 직접 렌더링한다.

```tsx
import { GitHubSignInButton } from "@/components/entry/GitHubSignInButton";

...

<RepoInputForm />
<GitHubSignInButton />
```

`GitHubSignInButton`은 `/api/auth/github/me`를 조회하지 않는다. 따라서 로그인된 상태여도 entry page에서는 account menu로 바뀔 수 없다.

반면 `src/components/map/MapToolbar.tsx`는 아래처럼 `AuthStatus`를 사용한다.

```tsx
<AuthStatus meta={meta} returnTo={`/map/${repo.owner}/${repo.name}`} />
```

그래서 map page에서만 authenticated toolbar UI가 정상 표시된다.

### 1.2 Maximum update depth 원인

`src/components/map/MapShell.tsx`에서 `MetroMapCanvas`에 넘기는 `setZoom` prop이 매 렌더마다 새 함수로 생성된다.

```tsx
setZoom={(updater) => setZoom((z) => updater(z))}
```

`src/components/map/MetroMapCanvas.tsx`의 auto-fit effect는 `setZoom`을 dependency로 포함하고, effect 안에서 다시 `setZoom`을 호출한다.

```tsx
useEffect(() => {
  ...
  setZoom(() => fit.zoom);
  setPan(fit.pan);
}, [routeLayout, setZoom, setPan]);
```

흐름:

```text
MapShell render
→ 새로운 setZoom wrapper 생성
→ MetroMapCanvas auto-fit effect dependency 변경
→ effect 실행 후 setZoom 호출
→ MapShell re-render
→ 또 새로운 setZoom wrapper 생성
→ effect 재실행
→ 반복
```

따라서 함수 identity 안정화와 auto-fit state update guard가 필요하다.

---

## 2. 구현 범위

### 2.1 Entry page authenticated UI

수정 대상 후보:

- `src/app/page.tsx`
- `src/components/auth/AuthStatus.tsx`
- `src/components/auth/AccountMenu.tsx`
- 관련 테스트

권장 구현:

1. `AuthStatus`에 entry page에서 쓸 수 있는 표시 variant를 추가한다.

예시:

```ts
type AuthStatusVariant = "toolbar" | "entry";

interface Props {
  meta?: GraphMeta;
  returnTo?: string;
  variant?: AuthStatusVariant;
  showRefresh?: boolean;
}
```

2. 기존 toolbar 기본 동작은 유지한다.

- `variant` 기본값은 `"toolbar"`
- `showRefresh` 기본값은 `true`
- `MapToolbar` 사용부는 현재와 같은 UI가 나와야 한다.

3. entry variant의 anonymous 상태는 기존 `GitHubSignInButton`과 같은 full-width button 스타일을 유지한다.

기존 스타일 기준:

```tsx
"mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-medium text-text transition hover:bg-panel-alt"
```

label도 entry에서는 기존과 동일하게 `Sign in with GitHub`를 사용한다.

4. entry variant의 authenticated 상태는 기존 심플한 entry 화면을 해치지 않는 작은 account panel 형태로 표시한다.

권장 형태:

```tsx
<div
  data-testid="entry-authenticated-panel"
  className="mt-3 flex w-full items-center justify-between gap-3 rounded-md border border-line bg-panel px-3 py-2"
>
  <span className="min-w-0 text-xs text-muted">
    Signed in
  </span>
  <AccountMenu user={state.user} meta={meta} showRefresh={false} />
</div>
```

세부 디자인은 기존 토큰(`bg-panel`, `border-line`, `text-muted`, `text-text`)을 사용한다.

5. entry page는 `GitHubSignInButton` 대신 `AuthStatus`를 사용한다.

예시:

```tsx
import { AuthStatus } from "@/components/auth/AuthStatus";

...

<RepoInputForm />
<AuthStatus variant="entry" returnTo="/" showRefresh={false} />
```

6. `GitHubSignInButton`은 삭제하지 않는다.

기존 테스트와 호환성을 위해 남긴다. 아직 다른 곳에서 쓸 수 있는 entry 전용 정적 링크 컴포넌트로 유지한다.

### 2.2 AccountMenu refresh action 옵션화

entry page에서는 `Refresh graph` 액션이 어색하므로 `AccountMenu`에 optional prop을 추가한다.

예시:

```ts
interface Props {
  user: AuthUser;
  meta?: GraphMeta;
  onRefresh?: () => void;
  showRefresh?: boolean;
}
```

- 기본값: `showRefresh = true`
- map toolbar에서는 기존처럼 `Refresh graph`가 보인다.
- entry variant에서는 `showRefresh={false}`로 숨긴다.
- profile / logout action은 유지한다.

### 2.3 Zoom infinite update loop 수정

수정 대상:

- `src/components/map/MapShell.tsx`
- `src/components/map/MetroMapCanvas.tsx`
- 관련 테스트

#### 2.3.1 MapShell setter identity 안정화

`MapShell`에서 inline `setZoom` wrapper를 매 렌더마다 만들지 말고 `useCallback`으로 안정화한다.

예시:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";

...

const updateZoom = useCallback((updater: (z: number) => number) => {
  setZoom((z) => updater(z));
}, []);
```

그리고 두 사용부 모두 같은 stable callback을 넘긴다.

```tsx
<MetroMapCanvas
  ...
  setZoom={updateZoom}
  ...
/>

<ZoomControls
  zoom={zoom}
  setZoom={updateZoom}
  setPan={setPan}
/>
```

`setPan`은 React state setter라 identity가 안정적이므로 그대로 사용해도 된다.

#### 2.3.2 MetroMapCanvas auto-fit state update guard

`MetroMapCanvas` auto-fit effect는 동일한 zoom/pan 값을 반복해서 set하지 않아야 한다.

권장 helper:

```ts
const ZOOM_EPSILON = 0.001;
const PAN_EPSILON = 0.5;

function almostSameViewport(
  currentZoom: number,
  currentPan: { x: number; y: number },
  nextZoom: number,
  nextPan: { x: number; y: number },
) {
  return (
    Math.abs(currentZoom - nextZoom) < ZOOM_EPSILON &&
    Math.abs(currentPan.x - nextPan.x) < PAN_EPSILON &&
    Math.abs(currentPan.y - nextPan.y) < PAN_EPSILON
  );
}
```

auto-fit effect 내부:

```tsx
const currentZoom = zoomRef.current;
const currentPan = panRef.current;

if (almostSameViewport(currentZoom, currentPan, fit.zoom, fit.pan)) {
  return;
}

zoomRef.current = fit.zoom;
panRef.current = fit.pan;
setZoom(() => fit.zoom);
setPan(fit.pan);
```

중요:

- auto-fit 자체를 제거하지 않는다.
- `hasUserNavigatedRef` 동작을 유지한다.
- wheel zoom 시 `hasUserNavigatedRef.current = true`로 auto-fit이 다시 덮어쓰지 않는 현재 동작을 유지한다.
- pointer anchored zoom 계산(`zoomAtPoint`)은 변경하지 않는다.

---

## 3. 테스트 지침

기존 테스트 수가 많으므로 회귀 방지 중심으로 추가한다.

### 3.1 AuthStatus 테스트 추가/수정

파일:

- `src/components/auth/AuthStatus.test.tsx`
- `src/components/auth/AccountMenu.test.tsx`

필수 케이스:

1. `AuthStatus variant="entry"` + anonymous
   - `auth-status-anonymous`가 렌더된다.
   - href가 `returnTo="/"`를 encode한다.
   - label이 `Sign in with GitHub`이다.
   - full-width entry class를 가진다. class 전체 문자열 exact match까지는 필요 없고 `w-full`, `text-sm` 등 핵심만 확인해도 된다.

2. `AuthStatus variant="entry"` + authenticated
   - `entry-authenticated-panel`이 렌더된다.
   - `account-menu-button`이 보인다.
   - user login이 보인다.
   - `Refresh graph` 액션은 보이지 않는다.

3. `AuthStatus` 기본 toolbar variant
   - 기존 compact anonymous CTA가 유지된다.
   - authenticated 상태에서 AccountMenu가 유지된다.

4. `AccountMenu showRefresh={false}`
   - dropdown을 열었을 때 `account-menu-refresh`가 없어야 한다.

### 3.2 EntryPage 테스트 추가

가능하면 신규 파일 추가:

- `src/app/page.test.tsx`

필수 케이스:

1. `/api/auth/github/me`가 anonymous 응답일 때 entry page에 `Sign in with GitHub`가 보인다.
2. authenticated 응답일 때 entry page에 account menu button이 보이고 정적 `github-sign-in-button`만 남아 있지 않아야 한다.

참고:

```tsx
import EntryPage from "./page";
```

`fetch`는 기존 `AuthStatus.test.tsx` 패턴처럼 `vi.stubGlobal("fetch", mockFetch)` 사용.

### 3.3 Zoom loop 회귀 테스트

파일:

- `src/components/map/MetroMapCanvas.test.tsx`
- 또는 `src/components/map/MapShell.test.tsx`

필수 케이스:

1. `MetroMapCanvas` auto-fit이 동일 layout과 동일 viewport 값에서 반복적으로 `setZoom`/`setPan`을 호출하지 않는다.

권장 방식:

- `metro-canvas`의 `getBoundingClientRect`를 mock해서 auto-fit이 실제 실행되게 한다.
- 첫 auto-fit 호출 후 mock clear 또는 rerender.
- 동일 props로 rerender했을 때 추가 호출이 발생하지 않는지 검증한다.

주의:

- jsdom에서는 기본 rect가 0이라 기존 auto-fit이 bail out할 수 있다. 반드시 rect mock이 필요하다.

2. `MapShell` 렌더링이 update depth를 유발하지 않는지 간접 검증한다.

가능한 방식:

- `render(<MapShell graph={...} skipInitialLoading />)` 후 `metro-canvas` 확인.
- `console.error` spy를 두고 `Maximum update depth exceeded` 메시지가 호출되지 않았는지 확인.
- 단, 이 테스트가 flaky하면 `MetroMapCanvas`의 auto-fit idempotency 테스트를 더 직접적으로 유지한다.

3. 기존 pointer anchored wheel zoom 테스트는 그대로 통과해야 한다.

---

## 4. 수동 검증 시나리오

작업 후 사용자가 `npm run dev`로 확인할 흐름:

1. 로그인 전 `/` 접속
   - 기존처럼 repo input 아래 `Sign in with GitHub` 버튼이 보인다.

2. GitHub OAuth 로그인 완료 후 `/` 접속
   - repo input 아래 로그인 버튼 대신 GitHub user account menu가 보인다.
   - dropdown에는 profile / sign out이 보인다.
   - entry page에서는 `Refresh graph`가 보이지 않는 것이 자연스럽다.

3. `/map/facebook/react` 접속
   - toolbar account menu가 기존처럼 보인다.
   - rate limit badge/meta가 있으면 표시된다.
   - dropdown에는 `Refresh graph`가 유지된다.

4. map에서 wheel zoom
   - `ctrl` 또는 `meta` + wheel zoom in/out 시 마우스 포인터 아래의 위치를 기준으로 확대/축소된다.
   - console에 `Maximum update depth exceeded`가 다시 뜨지 않는다.

5. map에서 pan/drag
   - drag 후 auto-fit이 다시 pan/zoom을 덮어쓰지 않는다.

---

## 5. 검증 명령

작업 후 반드시 아래 순서로 실행한다.

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

실패하면 즉시 멈추고 실패 로그를 요약해서 보고한다.

---

## 6. 작업 완료 후 처리

작업이 끝나면 이 md 파일을 반드시 아래 경로로 이동한다.

```text
/Users/minmac/Documents/dev/Project/GitMetro/processed md files/
```

원본 md 수정 금지. 수정사항이 추가로 필요하면 새 md 파일로 버전업한다.

---

## 7. 완료 보고 형식

완료 후 아래 형식으로 보고한다.

```text
작업 요약:
- Entry page authenticated account menu 적용
- AccountMenu refresh action 옵션화
- MapShell zoom setter identity 안정화
- MetroMapCanvas auto-fit 반복 state update guard 추가

추가/변경 파일:
- ...

테스트:
- ...

검증:
- npm run lint ...
- npm run typecheck ...
- npm run test ...
- npm run build ...

수동 확인:
- ...

남은 이슈:
- 없으면 없음
```

---

## 8. Claude Code CLI 자체 검토 지침

구현 후 아래 관점으로 자체 리뷰한다.

1. 인증 보안
   - access token이 client response, DOM, test snapshot, console log에 노출되지 않는지 확인한다.
   - `/api/auth/github/me` 응답 구조는 token 없이 user 정보만 유지한다.

2. UI 일관성
   - entry page는 기존 미니멀 디자인을 유지한다.
   - toolbar account menu는 기존 map page 레이아웃을 깨지 않는다.
   - entry page에서 account dropdown이 viewport 밖으로 잘리지 않는지 확인한다.

3. zoom 안정성
   - auto-fit이 초기/방향 변경 시에는 동작한다.
   - 사용자가 wheel zoom 또는 drag를 한 뒤에는 auto-fit이 조작을 덮어쓰지 않는다.
   - `setZoom`/`setPan`이 동일 값으로 반복 호출되지 않는다.

4. 회귀 위험
   - 기존 `GitHubSignInButton` 테스트를 깨지 않는다.
   - 기존 pointer anchored wheel zoom 테스트를 깨지 않는다.
   - 기존 316개 테스트와 신규 테스트가 모두 통과해야 한다.
