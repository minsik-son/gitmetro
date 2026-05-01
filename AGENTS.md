### **해당 프로젝트는 Github의 Branch를 시각적인 맵으로 보여주는 웹 사이트로 이름은 GitMetro이다.**

**기술 스택**
* **React**
* **Node.js**
* **TailwindCSS**
* **TypeScript**
* **Github API**
* **Vercel**
* **D3.js** (필요할 경우)
* **gsap** (필요할 경우)

**개발 과정**
WebSite 디자인은 Figma와 Claude design을 사용한다.
기능구현은 Codex와 Claude Code Cli를 동시에 사용하는데 codex는 분석과 설계를 한뒤 개발 지침과 가이드를 md파일로 작성하여 Claude Code Cli가 코딩을 진행하도록 한다. 
즉, Codex가 뇌이고 Claude Code Cli가 손이다. 
코드 검토도 Claude로 이중검토를 할예정이라 md파일로 설계 가이드를 만들고 난뒤 클로드에게 복사 붙여넣기할 검토 지침도 함께 나열한다.

**개발 규칙**
md 파일은 '/Users/minmac/Documents/dev/Project/GitMetro/md Files' 경로에서 생성한다.
그리고 Claude Code Cli가 읽고 처리한 md 파일은 '/Users/minmac/Documents/dev/Project/GitMetro/processed md files'로 파일을 이동한다.
이 절차는 claude가 md 파일들을 어디까지 처리했는지 명확하게 트래킹하기위해 필요하다.

**이미 생성한 md 파일 수정 절대 금지**
claude code cli용 md파일을 한번 생성했으면 그다음은 수정사항이 생겨도 그수정사항만 다시 생성.
md 파일 수정은 **절대 금지**
따라서 prompt용 md파일은 덮어쓰는거 없이 무조건 신규생승으로 진행. 
지난 prompt 수정버전이면 v1,v2,v3로 버전업해서 신규생성하고 새로운 prompt면 새롭게 v1로 진행

**프로젝트의 핵심**
이미 Github자체에서 Network를 보여주고 있지만 그것만으로 한눈에 들어오질 않아서 시작한 프로젝트로 본 목적은 branch map을 가독성있게 한국에 보여주는것을 목표로 한다. 때문에 실생활에서 이미 익숙한 지하철 노선도를 모티브로 삼았으며 각각의 branch들은 지하철의 역, main, feature, hotfix, release 들은 지하철의 노선 (색깔별로 구분), 그리고 merge는 환승역처럼 표시한다. 또한 각 branch역에 마우스를 hover하면 해당 branch의 커밋 정보를 보여주는 팝업이 뜸.

**사이트 테마**
기본적으로 개발자들이 많이 찾는 웹사이트가 될 예정인 만큼 다크모드를 기본으로 한다.
하지만 유저가 원할경우 light mode도 가능하고 또 맵 디자인은 지하철 테마에서 게임스킬트리나 사이버펑크 테마 혹은 런던지하철 테마같이 커스텀도 가능하게 할 예정

**Website flow**
첫 진입 페이지 깔끔하고 단순하게 사이트의 이름과 간략적인 설명 그리고 Github 저장소를 입력하는 심플한 디자인을 원한다. 
Github 저장소 입력칸을 채우고 enter를 치면 로딩 후 지하철 맵이 렌더링 된다.
로딩 페이지는 터미널에서 깃헙 저장소를 읽고 처리중임을 보여주는 애니메이션을 렌더링한다. 

**프로젝트의 필수 기능**
/Users/minmac/Documents/dev/Project/GitMetro/userneeds.md 참고

**에이전트 검증**
검증단계:
1. 문제 해결 혹은 새로운 기능이 확실하게 동작하는지를 테스트
2. 새로운 코드적용으로 인해 기존 코드가 부작용, 에러 유발이 없는지 테스트
3. 새로운 코드가 전체적인 프로젝트 큰그림에 맞는 코드인지를 테스트

**프로젝트의 작업 파일들은 절대 내가 허락하기전에는 코딩하지말것**

**코딩하기전에는 항상 나에게 수락을 요구하는 절차를 붙일것**

**내가 직접 코딩하라는 말이 있었어도 항상 수락으로 더블체크를 할것**

**코딩하라는 직접적인 명령이 없다면 진단과 설계만 할것**

**Codex에서는 절대로 허락없이 코딩작업 시작하지 말것**

**Codex CLI에서 md파일을 진행할경우는 컨펌이 된 md 파일을 제공하는 경우라서 바로 코딩 진행 가능**

**mock up용 HTML파일은 예외로 Codex에서도 바로 생성 가능**

*코딩작업은 오로지 무슨일이 있어도 Cladue Code CLI를 통해서 진행할 예정이니 prompt로 만들라는 지시가 내려오면 Codex에서 진행되는 모든 작업은 Claude code cli를 위한 Prompt로 정리할것**

