/**
 * 페이지 배선 — DOM 과 뷰모델 사이. 판정은 전부 판정기 모듈이, 화면 결정은 전부
 * 뷰모델 층(report.ts · screens.ts)이 한다: 이 파일은 연결만 한다.
 *
 * ⭐⭐ **로케일을 고르는 입력은 그 문서가 선언한 `lang` 하나다.** ⛔ 협상이 아니다 —
 * 서버 협상(Accept-Language 302)은 **페이지 요청이 워커를 거치지 않아** 설 자리가 없고,
 * 브라우저 쪽 `navigator.language` 분기도 **같은 협상**이다: 주소가 가리키는 문서와 다른
 * 언어가 그려지면 그 주소를 공유한 사람과 공유받은 사람이 **다른 화면**을 받는다. 보고서를
 * 주소로 옮기는 제품에서 그것은 기능이 아니라 결함이다. ⇒ 주소 하나가 한 언어를 가리킨다.
 */

import { DECLARATION_FILE, looksLikeFragment, SCAFFOLD_JSON } from '../../verifier/src/index.ts';
import { parseRepoInput } from './github-url.ts';
import { diagnoseUrl, openFragment, type Outcome } from './outcome.ts';
import { buildObservation } from './observation.ts';
import { buildReport } from './report.ts';
import { unjudgeableScreen } from './screens.ts';
import { renderObservation, renderReport, renderScreen } from './render.ts';
import { stringsFor } from './strings.ts';

/**
 * 이 문서가 선언한 벌. ⚠️ 모르는 `lang` 이면 `stringsFor` 가 **던진다** — 조용히 정본으로
 * 접으면 발행된 문서가 선언한 언어와 그려진 언어가 갈라지고, 그 갈라짐은 화면에 아무 표시도
 * 남기지 않는다. 발행본의 `lang` 이 아는 값인지는 가드가 따로 문다.
 */
const strings = stringsFor(document.documentElement.lang);

const must = <T extends Element>(selector: string): T => {
  const node = document.querySelector<T>(selector);
  if (node === null) throw new Error(`missing element: ${selector}`);
  return node;
};

const result = must<HTMLElement>('#result');
const scaffold = must<HTMLElement>('#scaffold');
const form = must<HTMLFormElement>('#diagnose-form');
const input = must<HTMLInputElement>('#repo-input');
const button = must<HTMLButtonElement>('#diagnose-button');
const entryError = must<HTMLParagraphElement>('#entry-error');
const entryStatus = must<HTMLParagraphElement>('#entry-status');

function show(outcome: Outcome): void {
  result.replaceChildren();
  if (outcome.kind === 'report') {
    // ⭐⭐ **갈래가 하나로 합쳐졌다** — 격자가 봉투에 타면서, 요약으로 들어온 보고도 저장소를
    //   읽은 보고와 **같은 화면**을 받는다. 그 전에는 비공개 고객(요약으로 들어오는 유일한
    //   길)만 관할 수 한 줄을 못 받았다 — 돈 내는 쪽이 더 가난한 화면을 받던 자리다.
    result.append(renderObservation(buildObservation(outcome, strings)));
    // ⭕ 보고서 옆에는 남는다 — 수가 나온 뒤 선언을 고치는 것이 다음 걸음이다.
    scaffold.hidden = false;
  } else {
    const screen = unjudgeableScreen(outcome, strings);
    result.append(renderScreen(screen));
    // ⭐ 갈래는 screens.ts 가 쥔다 — 여기는 그 사실을 **적용만** 한다. 명령을 든 화면에서
    //   스캐폴드가 같이 서면 「어느 쪽을 하라는 건가」가 흐려지고, `error` 에서는 스캐폴드가
    //   아무것도 풀지 않는다(고칠 자리가 우리 쪽이거나 네트워크다).
    scaffold.hidden = !screen.showsScaffold;
  }
  result.scrollIntoView({ block: 'nearest' });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const parsed = parseRepoInput(input.value);
  if (parsed === null) {
    entryError.textContent = strings.entry.unreadableInput;
    entryError.hidden = false;
    return;
  }
  entryError.hidden = true;
  button.disabled = true;
  entryStatus.textContent = strings.entry.running;
  entryStatus.hidden = false;
  void diagnoseUrl(parsed).then((outcome) => {
    button.disabled = false;
    entryStatus.hidden = true;
    show(outcome);
  });
});

/**
 * 해시 하나를 **둘이 나눠 쓴다** — 보고서 요약과 페이지 앵커다. 보고 페이지의 주소가
 * 루트 + `#<요약>` 이라 그 자리가 겹친다.
 *
 * ⭐⭐ **가르는 규칙은 이 파일의 것이 아니다.** 요약의 모양을 아는 것은 그 형식이고
 * (`looksLikeFragment`), 여기서 따로 판단하면 그 판단이 형식과 갈라진다 — 갈라진 날
 * **요약이 조용히 앵커로 읽혀** 보고서가 아무 표시 없이 사라진다.
 *
 * ⚠️ 그 전까지는 **비어 있지 않은 해시 전부**를 요약으로 읽었다. 그래서 페이지 앵커
 * (`#cta`)를 누르면 본문 위에 「조각을 읽을 수 없다」 판정 불가 화면이 떴다 — 화면이 참이
 * 아닌 말을 하는 자리였다. ⇒ 판 이름을 자처하지 않는 해시는 **브라우저의 몫**으로 둔다:
 * 우리가 아무것도 하지 않는 것이 곧 앵커로 도는 것이다.
 */
async function openFromHash(): Promise<void> {
  const fragment = window.location.hash.slice(1);
  if (!looksLikeFragment(fragment)) return;
  show(await openFragment(fragment));
}

window.addEventListener('hashchange', () => {
  void openFromHash();
});
void openFromHash();

/**
 * 선언 스캐폴드의 조각 — 체크아웃이 **없는** 방문자가 복사해 붙이는 입구.
 *
 * ⭐ 문자열의 정본은 판정기 모듈이다(`graduand init` 이 파일로 쓰는 바로 그 바이트).
 * 페이지가 사본을 들면 두 입구가 갈라지고, 그 갈라짐이 이 제품이 재는 결함이다.
 * ⛔ 전송이 아니다 — 클립보드와 화면뿐이고, 이 조각은 어디로도 가지 않는다.
 */
const snippet = must<HTMLPreElement>('#scaffold-snippet');
snippet.textContent = SCAFFOLD_JSON;

const scaffoldCopy = must<HTMLButtonElement>('#scaffold-copy');
const scaffoldStatus = must<HTMLParagraphElement>('#scaffold-status');
const sayCopy = (line: string): void => {
  scaffoldStatus.textContent = line;
  scaffoldStatus.hidden = false;
};
scaffoldCopy.addEventListener('click', () => {
  void navigator.clipboard.writeText(SCAFFOLD_JSON).then(
    () => sayCopy(strings.scaffold.copied(DECLARATION_FILE)),
    // 복사하지 못한 것을 복사했다고 말하지 않는다 — 조각은 화면에 그대로 있다.
    // ⛔ 왜 막혔는지는 말하지 않는다(권한·브라우저·맥락 중 어느 것인지 모른다).
    () => sayCopy(strings.scaffold.copyFailed),
  );
});

/**
 * 체크아웃에서 돌아오는 활성화 신호의 자리.
 *
 * ⭐⭐ **창구에 주는 돌아오는 주소는 로케일을 명시한다.** 그 주소는 이 저장소 밖(창구의
 * 설정)에 살고, 가드는 발행본의 바이트만 물지 창구를 보지 못한다 — 그래서 여기 적는 것은
 * 값이 아니라 **고른 사유**다: 발행 출처 + 기본 로케일의 원페이지 + 이 질의 하나.
 *
 * ⬜ **맨 도메인을 주지 않는 이유가 미판정이다.** 맨 도메인은 리다이렉트 선언을 한 번 지나는데
 * (루트 → 기본 로케일), 그 선언이 **질의 문자열을 목적지로 넘기는지**를 벤더 1차 문서가
 * 말하지 않는다(목적지에 질의를 **쓸 수 있다**는 말만 있고, 들어온 질의를 잇는다는 말은
 * 없다). 넘기지 않으면 이 블록이 영영 열리지 않고, 그 실패는 화면에 아무 표시도 남기지
 * 않는다 — 돈을 낸 사람만 조용히 확인을 못 받는다.
 * ⇒ 재는 비용보다 **지나지 않는 쪽**이 싸다: 로케일을 명시하면 그 선언을 아예 밟지 않는다.
 * ⭕ 그리고 **잃는 것이 0 이다** — 루트는 어차피 **무조건** 기본 로케일로 가므로 둘이 같은
 * 문서에 닿는다.
 *
 * ⭕ **그 미판정이 닫혔다 — 도메인이 붙은 뒤 실물에 재 봤다.** 맨 도메인에 이 질의를 붙여
 * 치니 리다이렉트가 질의를 **그대로 넘겼다**(`?activated` 가 기본 로케일 쪽 `location` 에
 * 그대로 실려 왔다). ⇒ 맨 도메인을 줘도 이 블록은 열린다. ⛔ 그래도 **고른 것은 바꾸지
 * 않는다**: 로케일을 명시하면 그 선언을 **아예 밟지 않으므로**, 루트의 목적지가 움직이는
 * 날에도 돌아오는 주소가 함께 흔들리지 않는다. 바뀐 것은 사유다 — **미판정에서 선택으로**.
 */
if (new URLSearchParams(window.location.search).get('activated') !== null) {
  must<HTMLElement>('#activated-banner').hidden = false;
}
