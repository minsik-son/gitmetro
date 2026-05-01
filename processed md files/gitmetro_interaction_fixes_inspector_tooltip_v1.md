# GitMetro Interaction Fixes: Inspector Collapse and Tooltip Behavior v1

작성일: 2026-05-01
대상: Claude Code CLI
목적: 현재 mock graph 기반 GitMetro map 화면에서 발견된 selected commit inspector와 commit hover tooltip 상호작용 문제를 수정한다.

---

## 0. 운영 규칙

이 문서를 처리하는 Claude Code CLI는 아래 규칙을 반드시 지킨다.

1. 먼저 `/Users/minmac/Documents/dev/Project/GitMetro/AGENTS.md`를 읽는다.
2. 이 md 파일은 수정하지 않는다.
3. 이미 생성된 md 파일은 수정하지 않는다.
4. 작업 완료 후 이 md 파일을 아래 경로로 이동한다.
   - from: `/Users/minmac/Documents/dev/Project/GitMetro/md Files`
   - to: `/Users/minmac/Documents/dev/Project/GitMetro/processed md files`
5. 이번 작업은 상호작용 수정만 한다.
6. GitHub API 연동, OAuth, 디자인 대개편, 라우팅 변경, 테마 추가 작업은 하지 않는다.

---

## 1. 현재 발견된 문제

### 문제 1: Selected commit panel이 항상 오른쪽 공간을 차지함

현재 map 화면 오른쪽의 `Selected commit` inspector가 선택 상태를 계속 유지하며, 허공을 클릭해도 닫히지 않는다.

사용자가 원하는 동작:
- map의 빈 공간, 즉 commit station이 아닌 허공을 클릭하면 오른쪽 `Selected commit` panel이 오른쪽으로 접히거나 사라져야 한다.
- panel이 닫히면 중앙 map 영역이 더 넓어져야 한다.
- commit station을 클릭하면 오른쪽 `Selected commit` panel이 다시 열리고 해당 commit 정보가 고정 표시되어야 한다.

### 문제 2: Hover tooltip이 너무 오래 남아 있음

현재 commit station에 hover하면 tooltip이 뜨지만, 마우스를 station에서 벗어나 map 허공으로 옮겨도 사라지지 않고 site/canvas 바깥으로 나가야 사라진다.

사용자가 원하는 동작:
- tooltip은 commit station에 hover 중일 때만 표시한다.
- commit station에서 mouse leave가 발생하면 즉시 tooltip을 닫는다.
- map 허공으로 마우스를 옮기면 tooltip이 사라져야 한다.
- commit station을 클릭하면 hover tooltip과 별개로 오른쪽 `Selected commit` panel이 열리고 고정된다.

---

## 2. 수정 대상 파일

우선 수정 예상 파일:

1. `/Users/minmac/Documents/dev/Project/GitMetro/src/components/map/MapShell.tsx`
2. `/Users/minmac/Documents/dev/Project/GitMetro/src/components/map/MetroMapCanvas.tsx`
3. `/Users/minmac/Documents/dev/Project/GitMetro/src/components/map/Station.tsx`
4. `/Users/minmac/Documents/dev/Project/GitMetro/src/components/inspector/CommitInspector.tsx`

필요 시 Tailwind class 조정을 위해 아래 파일도 확인:

5. `/Users/minmac/Documents/dev/Project/GitMetro/src/app/globals.css`

---

## 3. 요구 동작 상세

### 3.1 Selected commit panel open/close

상태 규칙:
- `selectedSha: string | null`
- `selectedSha`가 commit sha이면 inspector open
- `selectedSha === null`이면 inspector collapsed/hidden

동작:
- commit station click:
  - `selectedSha = commit.sha`
  - 오른쪽 `CommitInspector` 표시
  - selected ring 표시
  - hover tooltip은 유지하지 않아도 된다. click 시 tooltip을 닫아도 된다.
- map 빈 공간 click:
  - `selectedSha = null`
  - 오른쪽 `CommitInspector` 숨김
  - selected ring 제거
  - 중앙 map 영역이 inspector width만큼 넓어진다.
- inspector 내부 클릭:
  - 빈 공간 click으로 전파되어 panel이 닫히면 안 된다.
  - parent commit row 클릭은 기존처럼 선택 commit을 변경해야 한다.

권장 구현:
- `MapShell`에서 `selectedSha` 초기값을 `null`로 두거나, 현재처럼 기본 commit을 선택하되 빈 공간 click으로 반드시 null이 되게 한다.
- 사용자가 더 넓은 map을 보기 원하므로 권장 기본값은 `null`이다.
- `selectedCommit` 계산에서 fallback으로 마지막 commit을 자동 선택하지 않는다.
- `selectedCommit`은 `selectedSha`가 있을 때만 찾는다.
- `selectedCommit`이 없으면 `CommitInspector`를 렌더링하지 않는다.

예상 구조:

```tsx
const [selectedSha, setSelectedSha] = useState<string | null>(null);

const selectedCommit = selectedSha
  ? themedGraph.commits.find((c) => c.sha === selectedSha)
  : null;
```

### 3.2 빈 공간 click 처리

빈 공간 click은 `MetroMapCanvas` 또는 canvas wrapper에서 처리한다.

주의:
- commit station click은 `e.stopPropagation()`으로 canvas empty click에 전파되지 않아야 한다.
- drag-pan과 click이 충돌하지 않도록 한다.
- 사용자가 drag를 끝냈을 때 click처럼 판정되어 panel이 닫히면 안 된다.

권장 구현:
- pointer down 위치를 저장한다.
- pointer up/click 시 이동 거리가 작을 때만 empty click으로 처리한다.
- 간단한 1차 구현에서는 `svg`의 `onClick`에서 `onClearSelection()`을 호출하고, `Station` click은 이미 `stopPropagation()` 처리되어 있으므로 이를 활용해도 된다.
- 더 안전하게 하려면 drag distance threshold를 둔다.

권장 prop:

```ts
onClearSelection: () => void;
```

`MapShell`에서:

```tsx
<MetroMapCanvas
  ...
  onClearSelection={() => {
    setSelectedSha(null);
    setHover(null);
  }}
/>
```

### 3.3 Inspector layout collapse

현재 layout:
- left filter panel
- center map
- right inspector

수정 후:
- inspector open: 기존처럼 오른쪽 320px panel 표시
- inspector closed: 오른쪽 panel을 렌더링하지 않아 center map이 남는 공간을 모두 사용

필수:
- inspector를 숨길 때 빈 320px 공간이 남으면 안 된다.
- 별도의 collapsed tab은 이번 작업 범위에 넣지 않는다.
- 애니메이션은 선택 사항이다. 구현한다면 150-200ms 정도의 짧은 width/opacity transition만 사용한다.

권장:
- 단순하게 `selectedCommit && <CommitInspector ... />`로 렌더링한다.
- `selectedCommit` fallback을 제거하면 충분히 중앙 map이 넓어진다.

### 3.4 Tooltip hover behavior

현재 문제:
- `MetroMapCanvas` wrapper의 `onMouseLeave`에서만 hover를 null로 만드는 구조라, station을 벗어나도 canvas 안이면 tooltip이 유지된다.

수정:
- `Station` 컴포넌트에 `onHoverEnd` 또는 `onMouseLeave` prop을 추가한다.
- station `<g>`에 `onMouseLeave={onHoverEnd}`를 연결한다.
- `MetroMapCanvas`에서는 station마다 `onHoverEnd={() => onHoverChange(null)}`를 전달한다.

권장 interface:

```ts
interface Props {
  ...
  onHover: (e: MouseEvent<SVGGElement>) => void;
  onHoverEnd: () => void;
}
```

Station:

```tsx
<g
  ...
  onMouseEnter={onHover}
  onMouseMove={onHover}
  onMouseLeave={onHoverEnd}
  onClick={(e) => {
    e.stopPropagation();
    onSelect();
  }}
>
```

MapShell 또는 MetroMapCanvas:

```tsx
<Station
  ...
  onHover={handleHover(c)}
  onHoverEnd={() => onHoverChange(null)}
/>
```

click 시 tooltip 처리:
- commit station click 후 tooltip이 남아 있으면 시각적으로 혼란스럽다.
- station click 시 `onHoverChange(null)`도 함께 호출하는 것을 권장한다.
- inspector가 고정 정보 역할을 하므로 click 후 tooltip은 없어져도 된다.

---

## 4. 사용자 경험 기준

수정 후 사용자는 아래처럼 느껴야 한다.

1. 평소에는 map을 넓게 볼 수 있다.
2. commit station에 마우스를 올리면 tooltip이 즉시 뜬다.
3. commit station에서 마우스를 떼면 tooltip이 즉시 사라진다.
4. commit station을 클릭하면 오른쪽 selected commit panel이 열린다.
5. 다른 commit station을 클릭하면 panel 내용이 해당 commit으로 바뀐다.
6. map 허공을 클릭하면 selected commit panel이 닫힌다.
7. panel이 닫힌 상태에서도 hover tooltip은 정상 동작한다.
8. pan/zoom 동작이 기존처럼 유지된다.

---

## 5. 구현 시 주의사항

1. 이번 작업은 상호작용 개선만 한다.
2. mock graph data는 수정하지 않는다.
3. branch category, layout algorithm, theme token은 수정하지 않는다.
4. `CommitInspector`의 정보 구조는 유지한다.
5. `CommitTooltip`의 디자인은 유지한다.
6. map zoom controls, legend, branch filter 위치는 유지한다.
7. TypeScript 타입 오류가 없어야 한다.
8. ESLint 오류가 없어야 한다.
9. click과 drag가 충돌하지 않도록 확인한다.

---

## 6. 검증 시나리오

수동 검증:

1. `npm run dev` 실행
2. `/map/lumen-labs/lumen-pay` 접속
3. 첫 화면에서 inspector가 닫혀 있거나, 열려 있더라도 허공 클릭 시 닫히는지 확인
4. commit station hover
   - tooltip 표시 확인
5. commit station에서 마우스를 허공으로 이동
   - tooltip 즉시 사라짐 확인
6. commit station click
   - inspector open 확인
   - 선택 commit 정보 고정 확인
7. map 허공 click
   - inspector close 확인
   - map 영역 확장 확인
8. 다른 commit station click
   - inspector가 다시 열리고 내용 변경 확인
9. pan drag
   - drag 종료 시 inspector가 의도치 않게 닫히지 않는지 확인
10. zoom controls
   - 기존 기능 유지 확인
11. branch filter toggle
   - 기존 기능 유지 확인
12. horizontal/vertical 전환
   - inspector open/close와 tooltip 동작이 모두 유지되는지 확인

자동 검증:

```text
npm run lint
npm run typecheck
npm run build
```

테스트 스크립트가 이미 있다면:

```text
npm run test
```

---

## 7. 완료 후 보고 형식

작업 완료 후 아래 형식으로 보고한다.

```text
작업 요약:
- Selected commit inspector가 commit click 시 열리고 map 허공 click 시 닫히도록 수정
- station hover tooltip이 station hover 중에만 표시되도록 수정

변경 파일:
- 

검증:
- npm run lint
- npm run typecheck
- npm run build
- npm run test 또는 테스트 미작성 사유

수동 확인:
- station hover -> tooltip 표시
- station mouse leave -> tooltip 사라짐
- station click -> inspector open
- empty map click -> inspector close
- pan/zoom 기존 동작 유지

남은 이슈:
- 
```

---

## 8. Claude 검토 지침

수정 후 Claude에게 코드 검토를 맡길 경우 아래 기준으로 확인한다.

```text
Review this interaction fix for GitMetro.

Focus:
1. Does empty map click collapse the Selected commit inspector?
2. Does commit station click open/fix the inspector?
3. Does station hover tooltip disappear on station mouse leave, not only canvas/site mouse leave?
4. Does click propagation avoid immediately closing the inspector after station click?
5. Does drag-pan avoid being mistaken for empty click?
6. Does the center map area expand when the inspector is closed?
7. Are existing pan, zoom, branch filter, theme, and orientation interactions preserved?
8. Are TypeScript types clean and minimal?

Return critical interaction bugs first, then UX issues, then maintainability notes.
```
