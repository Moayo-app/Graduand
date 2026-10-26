/**
 * 페이지 배선 — DOM 과 뷰모델 사이. 판정은 전부 판정기 모듈이, 화면 결정은 전부
 * 뷰모델 층(report.ts · screens.ts)이 한다: 이 파일은 연결만 한다.
 *
 * ⭐⭐ **로케일을 고르는 입력은 그 문서가 선언한 `lang` 하나다.** ⛔ 협상이 아니다 —
 * 서버 협상(Accept-Language 302)은 우리 코드가 도는 서버가 0 이라 설 자리가 없고,
 * 브라우저 쪽 `navigator.language` 분기도 **같은 협상**이다: 주소가 가리키는 문서와 다른
 * 언어가 그려지면 그 주소를 공유한 사람과 공유받은 사람이 **다른 화면**을 받는다. 보고서를
 * 주소로 옮기는 제품에서 그것은 기능이 아니라 결함이다. ⇒ 주소 하나가 한 언어를 가리킨다.
 */

import { DECLARATION_FILE, SCAFFOLD_JSON } from '../../verifier/src/index.ts';
import { parseRepoInput } from './github-url.ts';
import { diagnoseUrl, openFragment, type Outcome } from './outcome.ts';
import { buildReport } from './report.ts';
import { unjudgeableScreen } from './screens.ts';
import { renderReport, renderScreen } from './render.ts';
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
const form = must<HTMLFormElement>('#diagnose-form');
const input = must<HTMLInputElement>('#repo-input');
const button = must<HTMLButtonElement>('#diagnose-button');
const entryError = must<HTMLParagraphElement>('#entry-error');
const entryStatus = must<HTMLParagraphElement>('#entry-status');

function show(outcome: Outcome): void {
  result.replaceChildren();
  if (outcome.kind === 'report') {
    result.append(
      renderReport(buildReport(outcome.measurement, outcome.origin, strings, outcome.entitlement)),
    );
  } else {
    result.append(renderScreen(unjudgeableScreen(outcome, strings)));
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

async function openFromHash(): Promise<void> {
  const fragment = window.location.hash.slice(1);
  if (fragment === '') return;
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

// 체크아웃에서 돌아오는 활성화 신호의 자리.
if (new URLSearchParams(window.location.search).get('activated') !== null) {
  must<HTMLElement>('#activated-banner').hidden = false;
}
