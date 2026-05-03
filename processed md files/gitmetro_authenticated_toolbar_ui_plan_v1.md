# GitMetro Authenticated Toolbar UI 구현 지침서 v1

> 대상: Claude Code CLI
> 작성자: Codex
> 목적: GitHub OAuth 로그인 이후 상단바에 사용자 정보와 실사용 편의 기능을 제공하는 authenticated account UI를 구현한다.

---

## 0. 반드시 먼저 읽을 것

작업 시작 전 아래 파일을 먼저 읽고 따른다.

- `/Users/minmac/Documents/dev/Project/GitMetro/AGENTS.md`
- `/Users/minmac/Documents/dev/Project/GitMetro/userneeds.md`

필수 규칙:

- 기존 md 파일은 절대 수정하지 않는다.
- 이 md 파일을 처리 완료하면 `/Users/minmac/Documents/dev/Project/GitMetro/processed md files/`로 이동한다.
- access token은 client component, JSON response, DOM, localStorage/sessionStorage에 절대 노출하지 않는다.
- 이번 작업은 로그인 후 toolbar/account UI 개선만 한다.
- OAuth server flow, graph layout, GitHub graph normalization은 불필요하게 수정하지 않는다.
- 작업 후 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`를 모두 실행한다.

---

## 1. 현재 상태

현재 OAuth login 자체는 구현되어 있다.

현재 UI:

- `src/components/auth/AuthStatus.tsx`
  - `/api/auth/github/me` 호출
  - anonymous: `Sign in`
  - authenticated: avatar + login + logout link

- `src/components/map/MapToolbar.tsx`
  - `AuthStatus`를 toolbar 오른쪽에 표시

현재 한계:

- 로그인 후 사용자 정보가 너무 빈약하다.
- 계정 메뉴가 없다.
- rate limit 상태가 GraphDiagnostics 안쪽에만 숨어 있다.
- 로그인 상태/source/scope를 사용자가 확인하기 어렵다.
- logout이 작은 text link라 실사용 UI로는 약하다.
- repository page에서 로그인 CTA는 returnTo를 유지하지 않는다.

---

## 2. 이번 작업 목표

로그인 후 상단바에 GitHub 계정 정보와 편의 기능을 제공한다.

목표 UX:

```text
[avatar] minmac ▾    [API 4987/5000]

dropdown:
  minmac
  GitHub OAuth · read:user
  API rate limit 4987 / 5000
  reset 12:34

  Open GitHub profile
  Refresh repository graph
  Sign out
```

anonymous 상태:

```text
Sign in with GitHub
```

loading 상태:

```text
small skeleton / …
```

---

## 3. 이번 작업 범위

포함:

- `AuthStatus`를 account menu 형태로 개선하거나 새 `AccountMenu` 컴포넌트 생성
- Toolbar에 로그인 사용자 정보, auth source, rate limit summary 표시
- Dropdown/popover 메뉴 제공
- Logout action을 명확한 menu item/button으로 제공
- 현재 path를 `returnTo`로 login route에 전달
- tests 추가/수정

포함하지 않음:

- OAuth flow 재구현
- private repo 지원
- DB session
- GitHub App 전환
- user settings page
- saved repositories
- persistent user preferences

---

## 4. 컴포넌트 설계

### 4.1 권장 파일 구조

신규 또는 변경:

```text
src/components/auth/AccountMenu.tsx
src/components/auth/AccountMenu.test.tsx
src/components/auth/AuthStatus.tsx
src/components/auth/AuthStatus.test.tsx
src/components/map/MapToolbar.tsx
src/components/map/MapToolbar.test.tsx        # 없으면 신규는 선택
```

권장:

- 기존 `AuthStatus`를 너무 비대하게 만들지 말고, 내부에서 `AccountMenu`를 사용한다.
- `AuthStatus`는 `/me` fetch + state 관리 담당.
- `AccountMenu`는 순수 UI 담당.

구조:

```tsx
AuthStatus
  - fetch /api/auth/github/me
  - loading/authenticated/anonymous state
  - passes user + meta to AccountMenu

AccountMenu
  - button
  - dropdown
  - logout
  - profile link
  - refresh action
```

---

## 5. AuthStatus Props 확장

파일:

- `src/components/auth/AuthStatus.tsx`

현재 props 없음.

변경:

```ts
import type { GraphMeta } from "@/lib/github/api-types";

interface AuthStatusProps {
  meta?: GraphMeta;
  returnTo?: string;
  compact?: boolean;
}
```

`MapToolbar`에서:

```tsx
<AuthStatus meta={meta} returnTo={`/map/${repo.owner}/${repo.name}`} />
```

anonymous sign-in href:

```ts
const loginHref = returnTo
  ? `/api/auth/github/login?returnTo=${encodeURIComponent(returnTo)}`
  : "/api/auth/github/login";
```

주의:

- `returnTo`는 client에서 외부 URL로 직접 만들지 않는다.
- 여기서는 내부 path만 넣는다.
- server route의 `sanitizeReturnTo`가 다시 방어한다.

---

## 6. AccountMenu UI

신규 파일:

- `src/components/auth/AccountMenu.tsx`

Props:

```ts
import type { AuthUser } from "@/lib/auth/types";
import type { GraphMeta } from "@/lib/github/api-types";

interface AccountMenuProps {
  user: AuthUser;
  meta?: GraphMeta;
}
```

동작:

- local `open` state
- button 클릭 시 dropdown toggle
- Escape key로 닫기
- 외부 click으로 닫기 가능하면 구현, 어렵다면 v1에서는 button toggle + menu item click close만 해도 됨

Button 표시:

```text
[avatar] login ▾
```

name이 있으면 dropdown 안에 name + login 표시.

Dropdown 표시:

```text
GitHub Account
{avatar} {name || login}
@{login}

Auth source: OAuth
Scope: read:user
Rate limit: 4987 / 5000
Reset: 12:34

Open GitHub profile
Refresh repository graph
Sign out
```

Actions:

- Open GitHub profile:
  - `https://github.com/${user.login}`
  - `target="_blank"`
  - `rel="noreferrer"`

- Refresh repository graph:
  - simplest v1: `window.location.reload()`
  - label: `Refresh graph`
  - only show on map page? If component is toolbar-only, always okay.

- Sign out:
  - `href="/api/auth/github/logout"`
  - or button with `window.location.href = "/api/auth/github/logout"`
  - 기존 logout route가 GET/POST 모두 지원하므로 link 가능.

주의:

- token은 절대 표시하지 않는다.
- scope는 표시 가능.
- avatar는 GitHub CDN image라 plain `<img>` 사용 가능. 기존 lint disable 유지.

---

## 7. Rate Limit Summary

### 7.1 meta.rateLimit 사용

`GraphMeta`에는 이미:

```ts
rateLimit?: {
  limit?: number;
  remaining?: number;
  reset?: number;
};
auth?: {
  authenticated: boolean;
  source: "oauth" | "env" | "none";
  login?: string;
};
```

`AccountMenu`에서 meta가 있으면 표시한다.

Rate text:

```ts
function formatRateLimit(meta?: GraphMeta): string | null {
  const remaining = meta?.rateLimit?.remaining;
  const limit = meta?.rateLimit?.limit;
  if (remaining == null || limit == null) return null;
  return `${remaining.toLocaleString()} / ${limit.toLocaleString()}`;
}
```

reset:

```ts
function formatReset(reset?: number): string | null {
  if (!reset) return null;
  return new Date(reset * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

### 7.2 toolbar mini pill

상단 button 옆에 작게 표시 가능:

```text
API 4,987/5,000
```

단 너무 복잡하면 dropdown 내부만 표시해도 된다.

추천:

- Account button 옆에 `API {remaining}` mini badge 표시
- dropdown에는 full details 표시

---

## 8. Auth Source 표시

meta가 있을 때:

- `meta.auth.source === "oauth"`: `OAuth`
- `meta.auth.source === "env"`: `Server token`
- `meta.auth.source === "none"`: `Anonymous`

로그인 사용자는 보통 OAuth source가 맞아야 한다.

만약 `/me`는 authenticated인데 current graph meta source가 `env`라면:

- UI는 session user를 보여주되 dropdown에 `Graph API: Server token` 표시 가능.
- 이는 cache/stale 상황에서 있을 수 있으므로 crash 금지.

---

## 9. Loading/Anonymous UI

Loading:

```tsx
<span data-testid="auth-status-loading" className="...">…</span>
```

유지 가능.

Anonymous:

```tsx
<a href={loginHref} ...>
  <GhIcon /> Sign in
</a>
```

MapToolbar에서는 returnTo를 넘겨야 한다.

Entry page의 `GitHubSignInButton`도 이미 returnTo prop이 있다면 유지한다.

---

## 10. Styling Guidelines

현재 toolbar는 compact developer tool 느낌이다.

따라서:

- 카드 같은 큰 UI 금지
- 작은 rounded-md menu
- font size `text-xs`, mono where useful
- border `border-line`, bg `bg-panel-alt`/`bg-panel`
- Auth menu dropdown width `w-64` 정도
- z-index는 GraphDiagnostics popover와 충돌하지 않게 `z-30` 이상

예상 class:

```tsx
className="relative"
```

dropdown:

```tsx
className="absolute right-0 top-full z-30 mt-2 w-64 rounded-md border border-line bg-panel p-3 text-xs text-text shadow-xl"
```

---

## 11. Accessibility

필수:

- Account button `aria-haspopup="menu"`
- `aria-expanded={open}`
- dropdown role `menu` 또는 단순 panel
- logout/profile actions는 keyboard focus 가능
- Escape로 닫기 구현 권장
- avatar `alt=""` 유지, login text가 있으므로 decorative

---

## 12. Tests

### 12.1 AuthStatus tests 수정

파일:

- `src/components/auth/AuthStatus.test.tsx`

기존 테스트 유지:

- anonymous CTA
- authenticated user/logout
- fetch error anonymous

추가:

- `returnTo` prop이 login href에 반영됨
- authenticated 상태에서 AccountMenu button이 표시됨
- meta.rateLimit이 있으면 rate text가 표시됨

### 12.2 AccountMenu tests 신규

파일:

- `src/components/auth/AccountMenu.test.tsx`

검증:

1. avatar/login 표시
2. click opens menu
3. name/login/scope 표시
4. rate limit 표시
5. profile link href 정확
6. logout link href 정확
7. refresh button calls `window.location.reload`
8. Escape closes menu

테스트에서 `window.location.reload` mocking이 어렵다면 refresh action은 function prop으로 주입한다.

추천 props:

```ts
interface AccountMenuProps {
  user: AuthUser;
  meta?: GraphMeta;
  onRefresh?: () => void;
}
```

default:

```ts
onRefresh ?? (() => window.location.reload())
```

테스트는 `onRefresh` mock 사용.

### 12.3 MapToolbar tests

없으면 신규는 선택.

검증 가능하면:

- `AuthStatus`에 `returnTo=/map/{owner}/{repo}` 전달되는지 직접 test는 어려움.
- 대신 AuthStatus test에서 returnTo만 충분히 검증해도 됨.

---

## 13. 수동 검증

전제:

- OAuth App 설정 완료
- `.env.local` 설정 완료
- 로그인 가능 상태

실행:

```bash
npm run dev
```

확인:

1. `/`에서 로그인
2. `/map/facebook/react` 진입
3. Toolbar 오른쪽에 avatar + login 표시
4. 클릭하면 account menu 열림
5. name/login/scope/auth source/rate limit 표시
6. Open GitHub profile 클릭 시 새 탭
7. Refresh graph 클릭 시 현재 map reload
8. Sign out 클릭 시 logout되고 anonymous CTA 표시
9. token 문자열은 DOM/API 응답 어디에도 표시되지 않음

보안 확인:

```bash
curl -s http://localhost:3000/api/auth/github/me | jq
```

응답에 `accessToken`이 없어야 한다.

---

## 14. 완료 기준

다음 조건을 모두 만족해야 완료다.

- 로그인 후 toolbar에 avatar/login이 표시됨
- account dropdown/menu가 있음
- dropdown에 기본 사용자 정보와 scope/auth source/rate limit이 표시됨
- Open GitHub profile 동작
- Refresh graph 동작
- Sign out 동작
- anonymous 상태에서는 Sign in CTA 표시
- `returnTo`가 map page에서 유지됨
- access token은 client에 노출되지 않음
- tests 추가/수정
- `npm run lint` 통과
- `npm run typecheck` 통과
- `npm run test` 통과
- `npm run build` 통과
- 이 md 파일을 `/Users/minmac/Documents/dev/Project/GitMetro/processed md files/`로 이동

---

## 15. 작업 후 보고 형식

작업 완료 후 아래 형식으로 보고한다.

```md
✅ 작업 완료 보고

작업 요약:
- Authenticated toolbar account menu 구현
- 로그인 사용자 정보/rate limit/auth source/scope 표시
- profile/refresh/logout 편의 기능 추가

추가/변경 파일:
- ...

핵심 구현:
- ...

보안 확인:
- token client 미노출

테스트:
- ...

검증:
- npm run lint: ...
- npm run typecheck: ...
- npm run test: ...
- npm run build: ...

수동 확인:
- ...

남은 이슈:
- 없으면 없음
- 있으면 구체적으로
```

---

## 16. Claude Code CLI에게 주는 마지막 지시

이번 작업은 인증 로직 자체가 아니라 **로그인 후 사용자가 실제로 상태를 이해하고 조작할 수 있는 toolbar UI**를 만드는 작업이다.

가장 중요한 기준:

```text
로그인한 사용자가 상단바에서 "내 계정으로 GitHub API가 동작 중이다"를 즉시 알 수 있어야 한다.
```

단, access token은 절대 노출하지 않는다.

