# GitMetro GitHub OAuth Login 구현 지침서 v1

> 대상: Claude Code CLI
> 작성자: Codex
> 목적: GitMetro에 GitHub OAuth 로그인을 구현해 public repository graph fetch가 unauthenticated 60 req/h 제한에 막히지 않도록 하고, 이후 private repository 지원의 기반을 만든다.

---

## 0. 반드시 먼저 읽을 것

작업 시작 전 아래 파일을 읽고 따른다.

- `/Users/minmac/Documents/dev/Project/GitMetro/AGENTS.md`
- `/Users/minmac/Documents/dev/Project/GitMetro/userneeds.md`

필수 규칙:

- 기존 md 파일은 절대 수정하지 않는다.
- 이 md 파일을 처리 완료하면 `/Users/minmac/Documents/dev/Project/GitMetro/processed md files/`로 이동한다.
- OAuth token 값, client secret 값, session secret 값은 코드나 md에 절대 하드코딩하지 않는다.
- GitHub access token은 client component로 절대 내려보내지 않는다.
- 이번 작업은 OAuth login/session/token usage에 집중한다.
- PR routing layout, graph normalization, map interaction은 불필요하게 수정하지 않는다.
- 작업 후 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`를 모두 실행한다.

---

## 1. 공식 문서 기준

구현 기준은 GitHub OAuth App web application flow다.

참고:

- GitHub OAuth Apps web application flow: `https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps`
- GitHub REST API authentication: `https://docs.github.com/v3/auth`
- GitHub REST API rate limits: `https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api`

핵심 흐름:

```text
1. User clicks Sign in with GitHub
2. GET /api/auth/github/login
3. Redirect to https://github.com/login/oauth/authorize
4. GitHub redirects back to /api/auth/github/callback?code=...&state=...
5. Server exchanges code for access_token
6. Server stores token in HttpOnly cookie/session
7. GitHub API server routes use OAuth token
```

---

## 2. 현재 프로젝트 상태

현재 `src/lib/github/client.ts`는 server env token만 사용한다.

```ts
const token = process.env.GITHUB_TOKEN;
if (token) {
  headers.Authorization = `Bearer ${token}`;
}
```

현재 entry page sign-in button은 stub이다.

```tsx
// src/components/entry/GitHubSignInButton.tsx
onClick={() => {
  // OAuth route will be added in a later phase. Stub action for now.
}}
```

현재 API route:

- `src/app/api/github/graph/route.ts`
- `src/app/api/github/repo/route.ts`

위 route는 모두 server에서 GitHub REST API를 호출한다.

따라서 좋은 설계는:

```text
client -> GitMetro API route -> GitHub REST API
```

구조를 유지하고, GitHub token은 server route 내부에서만 사용한다.

---

## 3. 이번 작업 목표

이번 작업 목표:

- GitHub OAuth login/logout/me API 구현
- HttpOnly secure session cookie 구현
- GitHub API client가 user OAuth token을 우선 사용하게 변경
- Entry page sign-in button 실제 login route 연결
- Toolbar 또는 UI에서 login 상태 표시
- rate limit error 시 login CTA 제공
- 기존 `GITHUB_TOKEN` fallback 유지
- tests 추가

이번 작업에서 하지 않을 것:

- private repository fetch 지원 완성
- repository picker
- org/repo 권한 selector
- refresh token flow
- GitHub App 전환
- database session
- persistent server cache
- NextAuth/Auth.js 도입

---

## 4. 인증 방식 선택

### 4.1 선택: 직접 OAuth App flow 구현

현재 프로젝트는 dependency가 매우 작다.

```json
"dependencies": {
  "next": "^15.1.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0"
}
```

NextAuth/Auth.js를 도입하면 빠르지만, 현재 GitMetro에는 과하다.

이번 v1에서는 직접 OAuth App web flow를 구현한다.

장점:

- 작은 코드
- server-only token control 명확
- GitHub API client와 직접 연결 쉬움
- 테스트 범위 명확

### 4.2 token storage

v1에서는 stateless HttpOnly cookie session을 사용한다.

cookie payload에 access token을 평문으로 넣지 않는다.

권장:

- AES-GCM encrypted session cookie
- HMAC signed state cookie
- Node built-in `crypto`만 사용
- 신규 dependency 추가하지 않음

대안:

- token을 plain HttpOnly cookie에 넣는 방식은 구현이 쉽지만, 보안상 피한다.
- server memory session은 local dev에서는 쉽지만 serverless/Vercel에서 인스턴스 간 공유가 안 된다.

따라서 v1 권장 방식:

```text
oauth access token -> encrypted session cookie -> server route decrypt -> GitHub API call
```

---

## 5. 환경 변수

`.env.example`에 추가한다.

```bash
# GitHub OAuth App
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/github/callback

# Used to encrypt/sign GitMetro auth cookies.
# Generate with: openssl rand -base64 32
AUTH_SECRET=

# Existing optional server fallback token
GITHUB_TOKEN=
GITHUB_API_VERSION=2022-11-28
```

주의:

- 실제 값은 `.env.local`에만 둔다.
- `.env.local`은 git에 커밋하지 않는다.
- `AUTH_SECRET`은 최소 32 bytes entropy를 권장한다.

GitHub OAuth App 설정:

```text
Application name: GitMetro Local
Homepage URL: http://localhost:3000
Authorization callback URL: http://localhost:3000/api/auth/github/callback
```

Vercel 배포 시:

```text
Homepage URL: https://<deployment-domain>
Authorization callback URL: https://<deployment-domain>/api/auth/github/callback
```

---

## 6. Auth 파일 구조

신규 파일:

```text
src/lib/auth/config.ts
src/lib/auth/cookies.ts
src/lib/auth/crypto.ts
src/lib/auth/githubOAuth.ts
src/lib/auth/session.ts
src/lib/auth/types.ts
```

신규 API routes:

```text
src/app/api/auth/github/login/route.ts
src/app/api/auth/github/callback/route.ts
src/app/api/auth/github/logout/route.ts
src/app/api/auth/github/me/route.ts
```

테스트:

```text
src/lib/auth/crypto.test.ts
src/lib/auth/session.test.ts
src/lib/auth/githubOAuth.test.ts
src/app/api/auth/github/login/route.test.ts
src/app/api/auth/github/callback/route.test.ts
src/app/api/auth/github/logout/route.test.ts
src/app/api/auth/github/me/route.test.ts
```

---

## 7. Auth Types

파일:

- `src/lib/auth/types.ts`

예상 타입:

```ts
export interface GitMetroSession {
  provider: "github";
  accessToken: string;
  tokenType: "bearer";
  scope: string;
  login: string;
  avatarUrl?: string;
  name?: string | null;
  createdAt: number;
}

export interface GitHubOAuthTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

export interface GitHubUserResponse {
  login: string;
  avatar_url?: string;
  name?: string | null;
}

export interface AuthUser {
  provider: "github";
  login: string;
  avatarUrl?: string;
  name?: string | null;
  scope: string;
}
```

---

## 8. Auth Config

파일:

- `src/lib/auth/config.ts`

역할:

- env 읽기
- missing env error 정리
- cookie name 중앙화

예상:

```ts
export const AUTH_COOKIE = "gitmetro_session";
export const AUTH_STATE_COOKIE = "gitmetro_oauth_state";
export const AUTH_RETURN_TO_COOKIE = "gitmetro_auth_return_to";

export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

export function getBaseUrl(req: Request): string {
  const envRedirect = process.env.GITHUB_OAUTH_REDIRECT_URI;
  if (envRedirect) {
    return new URL(envRedirect).origin;
  }
  const url = new URL(req.url);
  return url.origin;
}

export function getGithubOAuthConfig() {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return { ok: false as const, missing: [...] };
  }
  return { ok: true as const, clientId, clientSecret, redirectUri };
}
```

주의:

- `clientSecret`는 client component에서 import되지 않도록 `src/lib/auth/*`는 server-only로만 사용한다.
- 필요하면 `import "server-only";`를 추가한다.
  - 현재 package에 `server-only`가 없을 수 있다. Next.js 프로젝트에서는 보통 사용 가능하지만, dependency 확인 후 사용한다.
  - 불확실하면 runtime boundary를 API route 내부로 유지하고 client import를 피한다.

---

## 9. Cookie Helper

파일:

- `src/lib/auth/cookies.ts`

역할:

- secure/sameSite/httpOnly 옵션 중앙화
- dev/prod secure 처리

예상:

```ts
export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
```

state cookie:

```ts
httpOnly: true
sameSite: "lax"
secure: production only
path: "/"
maxAge: 10 minutes
```

---

## 10. Crypto Helper

파일:

- `src/lib/auth/crypto.ts`

목표:

- `AUTH_SECRET`으로 session payload 암호화/복호화
- OAuth state 생성
- timing-safe state 비교

권장 구현:

- Node `crypto`
- AES-256-GCM
- random 12-byte IV
- base64url encode

예상 API:

```ts
export function createRandomState(): string;
export function encryptJson<T>(value: T): string;
export function decryptJson<T>(token: string): T | null;
export function safeEqual(a: string, b: string): boolean;
```

`AUTH_SECRET` 처리:

- base64 또는 plain string 모두 처리 가능하게 한다.
- 간단하게 SHA-256으로 32-byte key를 derive해도 된다.

예상:

```ts
function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return createHash("sha256").update(secret).digest();
}
```

주의:

- 복호화 실패 시 throw보다 `null` 반환 권장.
- API route에서 invalid session을 logout 상태로 처리한다.

---

## 11. Session Helper

파일:

- `src/lib/auth/session.ts`

Next app route에서 cookies를 읽어 session을 반환한다.

예상 API:

```ts
import { cookies } from "next/headers";

export async function readSession(): Promise<GitMetroSession | null>;
export function encodeSession(session: GitMetroSession): string;
export function decodeSession(value: string): GitMetroSession | null;
export function sessionToUser(session: GitMetroSession): AuthUser;
```

주의:

- `readSession`은 server route에서만 사용한다.
- helper tests에서는 `decodeSession` 중심으로 검증하고, `cookies()` mocking은 route tests에서 처리한다.

---

## 12. GitHub OAuth Helper

파일:

- `src/lib/auth/githubOAuth.ts`

역할:

- authorize URL 생성
- code exchange
- `/user` fetch

예상 API:

```ts
export function buildGitHubAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string;

export async function exchangeGitHubCode(input: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<GitHubOAuthTokenResponse>;

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUserResponse>;
```

scope:

v1 public repo rate-limit 해결만 목표라면 scope는 최소화한다.

권장:

```text
read:user
```

주의:

- private repo 지원은 나중에 `repo` scope가 필요할 수 있다.
- `repo` scope는 권한이 크므로 이번 v1 기본값으로 쓰지 않는다.

authorize URL:

```text
https://github.com/login/oauth/authorize
  ?client_id=...
  &redirect_uri=...
  &state=...
  &scope=read:user
```

token exchange:

```text
POST https://github.com/login/oauth/access_token
Accept: application/json
Content-Type: application/json
```

---

## 13. API Routes

### 13.1 Login route

파일:

- `src/app/api/auth/github/login/route.ts`

동작:

1. OAuth env 확인
2. state 생성
3. returnTo query 읽기
4. state cookie 저장
5. returnTo cookie 저장
6. GitHub authorize URL로 redirect

Endpoint:

```text
GET /api/auth/github/login?returnTo=/map/facebook/react
```

returnTo validation:

- internal path만 허용
- `http://evil.com` 같은 외부 URL 금지
- 기본 `/`

예상:

```ts
function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
```

### 13.2 Callback route

파일:

- `src/app/api/auth/github/callback/route.ts`

동작:

1. `code`, `state` query 확인
2. state cookie와 query state 비교
3. code exchange
4. token response 검증
5. GitHub `/user` fetch
6. session 생성 및 encrypted cookie 저장
7. state cookie 삭제
8. returnTo로 redirect

에러 처리:

- invalid state: redirect `/` 또는 auth error page 없이 query param으로 간단히 처리
- token exchange failure: redirect `/?auth_error=github_oauth_failed`
- missing env: JSON 500 or redirect with error

권장 v1:

```text
redirect /?auth_error=...
```

### 13.3 Logout route

파일:

- `src/app/api/auth/github/logout/route.ts`

동작:

- session cookie 삭제
- redirect `/`

Endpoint:

```text
POST /api/auth/github/logout
```

또는 간단히:

```text
GET /api/auth/github/logout
```

v1에서는 button/form 편의를 위해 GET도 허용 가능하지만, 가능하면 POST가 더 깔끔하다.

### 13.4 Me route

파일:

- `src/app/api/auth/github/me/route.ts`

응답:

로그인 상태:

```json
{
  "ok": true,
  "authenticated": true,
  "user": {
    "provider": "github",
    "login": "minmac",
    "avatarUrl": "...",
    "name": "...",
    "scope": "read:user"
  }
}
```

비로그인:

```json
{
  "ok": true,
  "authenticated": false,
  "user": null
}
```

주의:

- access token은 절대 응답하지 않는다.

---

## 14. GitHub API Client 변경

파일:

- `src/lib/github/client.ts`

현재:

```ts
export async function githubFetch<T>(path: string)
```

변경:

```ts
export interface GithubFetchOptions {
  token?: string | null;
}

export async function githubFetch<T>(
  path: string,
  options: GithubFetchOptions = {},
): Promise<GithubFetchResult<T>>
```

header priority:

```text
1. options.token
2. process.env.GITHUB_TOKEN
3. unauthenticated
```

예상:

```ts
function buildHeaders(token?: string | null): HeadersInit {
  ...
  const authToken = token || process.env.GITHUB_TOKEN;
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
}
```

테스트:

- options.token이 있으면 env token보다 우선
- options.token 없으면 env token 사용
- 둘 다 없으면 Authorization 없음

---

## 15. Fetch Layer Token Propagation

현재 fetch helpers:

```text
fetchRepository(owner, repo)
fetchBranches(owner, repo)
fetchCommits(owner, repo, sha, limit)
fetchTags(owner, repo)
fetchMergedPullRequests(...)
fetchPullRequestCommits(...)
```

이 helper들이 `githubFetch` options를 받을 수 있게 변경한다.

예상:

```ts
import type { GithubFetchOptions } from "./client";

export async function fetchRepository(
  owner: string,
  repo: string,
  options: GithubFetchOptions = {},
) {
  return githubFetch<GitHubRepo>(`/repos/${owner}/${repo}`, options);
}
```

모든 GitHub fetch helper에 동일하게 적용.

주의:

- 기존 호출부가 깨지지 않게 default `{}` 사용.
- tests는 기존 mocking과 호환되게 업데이트.

---

## 16. Graph/Repo API Route Token Usage

파일:

- `src/app/api/github/graph/route.ts`
- `src/app/api/github/repo/route.ts`

각 route에서 session을 읽는다.

```ts
const session = await readSession();
const githubToken = session?.accessToken ?? null;
```

그 후 fetch layer에 전달한다.

```ts
fetchRepository(owner, repo, { token: githubToken })
fetchBranches(owner, repo, { token: githubToken })
...
```

meta에 auth source를 추가하면 diagnostics에 유용하다.

`GraphMeta`에 optional field:

```ts
auth?: {
  authenticated: boolean;
  source: "oauth" | "env" | "none";
  login?: string;
}
```

source 계산:

```ts
if (session) source = "oauth"
else if (process.env.GITHUB_TOKEN) source = "env"
else source = "none"
```

주의:

- access token은 meta에 포함하지 않는다.
- login은 공개 GitHub username이라 포함 가능.

---

## 17. Cache Key 주의

현재 graph cache key는 repo/options 기반이다.

OAuth token 도입 후 cache key에 auth source를 반영해야 한다.

이유:

- public repo 데이터는 token과 무관하게 같아 보일 수 있지만 rateLimit/meta/auth가 달라진다.
- 나중에 private repo를 지원할 때 token별 접근 가능성이 달라진다.

v1 권장:

```ts
authCacheScope =
  session ? `oauth:${session.login}` :
  process.env.GITHUB_TOKEN ? "env" :
  "none";
```

graph cache key에 추가:

```text
auth=oauth:minmac
```

주의:

- token 값 자체를 cache key에 넣지 않는다.
- login 정도만 사용한다.

---

## 18. UI 변경

### 18.1 GitHubSignInButton

파일:

- `src/components/entry/GitHubSignInButton.tsx`

stub 제거.

단순 link/button:

```tsx
export function GitHubSignInButton() {
  return (
    <a href="/api/auth/github/login" ...>
      <GhIcon /> Sign in with GitHub
    </a>
  );
}
```

현재 페이지로 돌아오게 하려면 client에서 현재 path를 붙일 수 있다.
Entry page는 `/`라 v1에서는 단순 route로 충분하다.

### 18.2 Auth status hook/component

신규 client component:

- `src/components/auth/AuthStatus.tsx`

역할:

- `/api/auth/github/me` fetch
- login 상태 표시
- logout button 제공

간단한 구현:

```tsx
useEffect(() => {
  fetch("/api/auth/github/me").then(...)
}, []);
```

Toolbar에 넣을 수 있다.

파일:

- `src/components/map/MapToolbar.tsx`

표시:

- 로그인됨: GitHub avatar/login + Logout
- 비로그인: Sign in with GitHub

주의:

- token은 절대 client로 전달하지 않는다.

### 18.3 Error UI 개선

파일:

- `src/components/map/GitHubGraphError.tsx`

rate_limited 또는 forbidden 시:

- 비로그인 상태라면 "Sign in with GitHub" CTA 표시
- login route로 이동

단, `GitHubGraphError`가 auth 상태를 모르면 단순히 항상 sign-in CTA를 보여도 된다.

---

## 19. Tests

### 19.1 github client tests

파일:

- `src/lib/github/client.test.ts`

추가:

- `githubFetch(path, { token: "user-token" })` uses `Bearer user-token`
- options token wins over `process.env.GITHUB_TOKEN`
- no token + no env -> no Authorization

### 19.2 auth crypto tests

파일:

- `src/lib/auth/crypto.test.ts`

검증:

- encrypt/decrypt round trip
- invalid token returns null
- changed secret cannot decrypt
- createRandomState returns non-empty unique strings
- safeEqual true/false

### 19.3 auth session tests

파일:

- `src/lib/auth/session.test.ts`

검증:

- encode/decode session
- token not exposed by `sessionToUser`
- invalid cookie returns null

### 19.4 OAuth helper tests

파일:

- `src/lib/auth/githubOAuth.test.ts`

검증:

- authorize URL has client_id, redirect_uri, state, scope
- exchangeGitHubCode sends correct POST
- token error response handled
- fetchGitHubUser sends Authorization header

### 19.5 route tests

신규 route tests:

```text
src/app/api/auth/github/login/route.test.ts
src/app/api/auth/github/callback/route.test.ts
src/app/api/auth/github/logout/route.test.ts
src/app/api/auth/github/me/route.test.ts
```

검증:

login:

- missing env -> 500 or error redirect
- success -> redirect GitHub authorize URL
- state cookie set
- returnTo cookie set

callback:

- missing code -> error redirect
- invalid state -> error redirect
- exchange success -> session cookie set
- returnTo redirect
- token response error -> error redirect

logout:

- session cookie cleared

me:

- no cookie -> authenticated false
- valid cookie -> authenticated true, no token in response

### 19.6 graph API tests

파일:

- `src/app/api/github/graph/route.test.ts`

추가:

- when session exists, fetch layer receives OAuth token
- meta.auth.source is `"oauth"`
- cache key differentiates oauth/env/none

가능하면 route helper를 작게 분리해서 테스트를 쉽게 만든다.

### 19.7 UI tests

파일:

- `src/components/entry/GitHubSignInButton.test.tsx` 또는 기존 entry test가 없다면 신규
- `src/components/auth/AuthStatus.test.tsx`
- `src/components/map/GitHubGraphError.test.tsx` 필요 시

검증:

- SignInButton href
- AuthStatus shows login/logout states
- logout triggers route

---

## 20. 수동 검증

### 20.1 GitHub OAuth App 만들기

GitHub:

```text
Settings -> Developer settings -> OAuth Apps -> New OAuth App
```

local 설정:

```text
Homepage URL: http://localhost:3000
Authorization callback URL: http://localhost:3000/api/auth/github/callback
```

### 20.2 .env.local 설정

```bash
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
AUTH_SECRET=...
```

`AUTH_SECRET` 생성:

```bash
openssl rand -base64 32
```

### 20.3 dev server

```bash
npm run dev
```

확인:

1. `/`에서 Sign in with GitHub 클릭
2. GitHub authorize 화면 이동
3. 승인 후 GitMetro로 복귀
4. Toolbar/AuthStatus에 GitHub login 표시
5. `/api/auth/github/me`가 authenticated true 반환
6. `/api/github/graph?owner=facebook&repo=react` 호출 시 rateLimit limit이 5000 근처로 증가
7. logout 후 `/api/auth/github/me`가 authenticated false 반환

---

## 21. 보안 체크리스트

반드시 확인:

- `access_token`이 client JSON 응답에 포함되지 않음
- `access_token`이 localStorage/sessionStorage에 저장되지 않음
- session cookie는 `HttpOnly`
- production cookie는 `Secure`
- sameSite는 `lax`
- OAuth state 검증 있음
- returnTo open redirect 방지
- token 값이 logs/test snapshot에 남지 않음
- cache key에 token 값이 직접 들어가지 않음

---

## 22. 완료 기준

다음 조건을 모두 만족해야 완료다.

- GitHub OAuth login route 구현
- callback code exchange 구현
- encrypted HttpOnly session cookie 구현
- logout route 구현
- me route 구현
- GitHub API client가 OAuth token을 우선 사용
- env `GITHUB_TOKEN` fallback 유지
- unauthenticated fallback 유지
- Entry sign-in button이 실제 login route로 연결
- UI에서 로그인 상태 확인 가능
- token이 client로 노출되지 않음
- auth/session/client tests 추가
- 기존 tests 유지
- `npm run lint` 통과
- `npm run typecheck` 통과
- `npm run test` 통과
- `npm run build` 통과
- 이 md 파일을 `/Users/minmac/Documents/dev/Project/GitMetro/processed md files/`로 이동

---

## 23. 작업 후 보고 형식

작업 완료 후 아래 형식으로 보고한다.

```md
✅ 작업 완료 보고

작업 요약:
- GitHub OAuth login 구현
- HttpOnly encrypted session cookie 구현
- GitHub API client OAuth token priority 적용
- Entry/Toolbar/AuthStatus UI 연결

추가/변경 파일:
- ...

핵심 구현:
- ...

보안 처리:
- ...

테스트:
- ...

검증:
- npm run lint: ...
- npm run typecheck: ...
- npm run test: ...
- npm run build: ...

수동 확인:
- OAuth App 설정:
- 로그인:
- /api/auth/github/me:
- graph rate limit:

남은 이슈:
- 없으면 없음
- 있으면 구체적으로
```

---

## 24. Claude Code CLI에게 주는 마지막 지시

이번 작업은 GitMetro의 API rate limit과 향후 private repo 지원을 위한 인증 기반이다.

가장 중요한 원칙:

```text
GitHub access token은 server boundary 밖으로 절대 나가지 않는다.
```

깔끔한 구조를 우선한다.

- auth crypto/session/oauth helper는 lib/auth로 분리
- GitHub API client는 token option만 받도록 단순화
- UI는 authenticated state만 표시
- route handlers가 server-only token orchestration 담당

작업 범위를 넓히지 말고 OAuth login 기반을 탄탄하게 완성하라.

