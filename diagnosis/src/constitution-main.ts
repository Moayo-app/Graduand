/**
 * 둘째 문서의 배선 — DOM 과 뷰모델 사이. 조립은 전부 판정기 모듈이, 화면 결정은 전부
 * 뷰모델 층(`composed.ts` · `screens.ts`)이 한다: 이 파일은 연결만 한다.
 *
 * ⭐⭐ **조립기가 측정 명령과 같은 함수 하나다**(`composeConstitution`) — 화면이 내보내는
 * 문자열과 `graduand canon`·`link` 이 쓰는 바이트가 **같은 손**에서 난다.
 *
 * ⭐⭐ **추측을 받지 않는다** — 트리오를 손으로 적게 두면 고객은 세 번 추측하고(어느 파일인지 ·
 * 스코프의 자구 · 거기서 값이 읽히는지) 틀린 선언은 판정을 멈춘다. ⇒ 저장소를 **읽어** 고르게
 * 한다: 걸음이 둘이고 **비용이 다르다**(경로는 한 번 읽으면 공짜, 스코프는 그 파일을 한 번 더).
 *
 * ⛔ **쓰지도 커밋하지도 않는다** — 내는 것은 문자열이고, 파일을 쓰는 것은 고객 기계에서 도는
 * 명령의 몫이다. ⛔ **판정을 보여 주지 않는다** — 그 자리는 **루트의 진단**이다.
 */

import {
  axisNameProblem,
  VALUE_ADAPTERS,
  type ConstitutionIntent,
  type RepoSnapshot,
  type ValidDeclaration,
} from '../../verifier/src/index.ts';
import { DECLARATION_FILE } from '../../verifier/src/index.ts';
import { buildComposed } from './composed.ts';
import { parseRepoInput, type RepoRef } from './github-url.ts';
import { composeIntent, readRepo, readScopes, type ComposeNetOutcome } from './outcome.ts';
import { renderComposed, renderScreen } from './render.ts';
import { unjudgeableScreen } from './screens.ts';
import { stringsFor } from './strings.ts';

const strings = stringsFor(document.documentElement.lang);

const must = <T extends Element>(selector: string): T => {
  const node = document.querySelector<T>(selector);
  if (node === null) throw new Error(`missing element: ${selector}`);
  return node;
};

const form = must<HTMLFormElement>('#hold-form');
const kind = must<HTMLSelectElement>('#hold-kind');
const axisInput = must<HTMLInputElement>('#hold-axis');
const noteCanon = must<HTMLParagraphElement>('#hold-note-canon');
const noteLink = must<HTMLParagraphElement>('#hold-note-link');
const repoInput = must<HTMLInputElement>('#hold-repo');
const readButton = must<HTMLButtonElement>('#hold-read');
const pick = must<HTMLElement>('#hold-pick');
const fileSelect = must<HTMLSelectElement>('#hold-file');
const scopeSelect = must<HTMLSelectElement>('#hold-scope');
const composeButton = must<HTMLButtonElement>('#hold-compose');
const holdError = must<HTMLParagraphElement>('#hold-error');
const holdStatus = must<HTMLParagraphElement>('#hold-status');
const holdResult = must<HTMLElement>('#hold-result');
const snippet = must<HTMLPreElement>('#hold-snippet');
const copyButton = must<HTMLButtonElement>('#hold-copy');

/**
 * ⚠️ **어댑터는 고르개가 아니다** — 등록부에 이름이 하나뿐인 동안 고르게 하는 것은 선택이
 * 아니라 묻기만 하는 칸이다. 이름이 늘면 그때 고르개가 선다. ⛔ 그래도 **화면이 그 이름을
 * 적지는 않는다**: 등록부의 첫 자리를 읽는다(사본이 생기지 않는다).
 */
const ADAPTER = VALUE_ADAPTERS[0]!.id;

/**
 * 읽은 저장소 — 조립까지 그 **스냅샷**을 들고 간다(트리오를 읽어 보는 손이 그것을 받는다).
 * ⭐ `base` 는 그 저장소가 **이미 든 선언**이다: 생성 갈래에서 조립이 거기에 축을 더한다.
 */
let read: { target: RepoRef; snapshot: RepoSnapshot; base: ValidDeclaration | null } | null = null;
/** 조립된 바이트 — 복사 버튼이 **보이는 조각과 같은 것**을 쓴다(사본 0). */
let composed: string | null = null;

const say = (node: HTMLParagraphElement, line: string | null): void => {
  node.textContent = line ?? '';
  node.hidden = line === null;
};

/** 조각과 그 버튼은 **한 쌍**으로만 선다 — 조각 없는 버튼은 아무것도 복사하지 않는다. */
function showSnippet(json: string | null): void {
  composed = json;
  snippet.textContent = json ?? '';
  snippet.hidden = json === null;
  copyButton.hidden = json === null;
}

const options = (node: HTMLSelectElement, entries: readonly { value: string; label: string }[]): void => {
  node.replaceChildren();
  for (const entry of entries) {
    const option = document.createElement('option');
    option.value = entry.value;
    option.textContent = entry.label;
    node.append(option);
  }
};

kind.addEventListener('change', () => {
  // ⭐ 설명 둘은 **발행본에 이미 있다** — 여기서 하는 일은 보이는 쪽을 바꾸는 것뿐이고,
  //   문구를 만들지 않는다(없는 말이 런타임에 생기는 자리를 두지 않는다).
  noteCanon.hidden = kind.value !== 'canon';
  noteLink.hidden = kind.value === 'canon';
  // 갈래가 바뀌면 읽은 저장소의 **의미**가 바뀐다(내 것 ↔ 정본) — 고른 것을 들고 가지 않는다.
  read = null;
  pick.hidden = true;
  showSnippet(null);
  holdResult.replaceChildren();
});

/** 판정 불가는 **전용 화면**이 받는다 — 읽지 못한 것은 조립의 거부가 아니다. */
function showUnjudgeable(outcome: Parameters<typeof unjudgeableScreen>[0]): void {
  holdResult.replaceChildren(renderScreen(unjudgeableScreen(outcome, strings)));
  pick.hidden = true;
  showSnippet(null);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const target = parseRepoInput(repoInput.value);
  if (target === null) {
    say(holdError, strings.entry.unreadableInput);
    return;
  }
  say(holdError, null);
  holdResult.replaceChildren();
  showSnippet(null);
  readButton.disabled = true;
  say(holdStatus, strings.entry.running);

  void readRepo(target, ADAPTER).then((outcome) => {
    readButton.disabled = false;
    say(holdStatus, null);
    if (outcome.kind !== 'repo') {
      showUnjudgeable(outcome);
      return;
    }
    if (outcome.files.length === 0) {
      // 「읽을 꼴의 파일이 없다」는 **참인 답**이다 — 고를 것이 없는 고르개를 세우지 않는다.
      say(holdError, strings.constitution.result.noFiles);
      pick.hidden = true;
      return;
    }
    read = { target, snapshot: outcome.snapshot, base: outcome.base };
    options(
      fileSelect,
      outcome.files.map((file) => ({ value: file, label: file })),
    );
    options(scopeSelect, []);
    pick.hidden = false;
    fileSelect.dispatchEvent(new Event('change'));
  });
});

fileSelect.addEventListener('change', () => {
  if (read === null) return;
  const file = fileSelect.value;
  say(holdError, null);
  composeButton.disabled = true;
  say(holdStatus, strings.entry.running);

  // ⚠️ 본문을 실어야 스코프를 안다 — 그래서 **한 번 더** 읽는다(경로와 값은 비용이 다르다).
  void readScopes(read.target, file, ADAPTER).then((outcome) => {
    say(holdStatus, null);
    if (outcome.kind !== 'scopes') {
      showUnjudgeable(outcome);
      return;
    }
    // 읽은 스냅샷을 **본문이 실린 것**으로 바꾼다 — 조립이 그것으로 트리오를 읽어 본다.
    read = { target: read!.target, snapshot: outcome.snapshot, base: read!.base };
    if (outcome.probe.kind === 'unreadable' || outcome.probe.scopes.length === 0) {
      // ⛔ 파싱 실패와 「읽힌 값 0」은 **같은 자리가 아니다** — 전자는 눈이 먼 입력이다.
      say(
        holdError,
        outcome.probe.kind === 'unreadable' ? outcome.probe.message : strings.constitution.result.noScopes,
      );
      options(scopeSelect, []);
      composeButton.disabled = true;
      return;
    }
    options(
      scopeSelect,
      outcome.probe.scopes.map((entry) => ({
        value: entry.scope,
        label: strings.constitution.result.scopeOption(entry.scope, entry.tokens),
      })),
    );
    composeButton.disabled = false;
  });
});

function showCompose(outcome: ComposeNetOutcome, branch: ConstitutionIntent['kind']): void {
  if (outcome.kind !== 'compose') {
    showUnjudgeable(outcome);
    return;
  }
  const vm = buildComposed(outcome.outcome, branch, strings);
  holdResult.replaceChildren(renderComposed(vm));
  showSnippet(vm.json);
  holdResult.scrollIntoView({ block: 'nearest' });
}

composeButton.addEventListener('click', () => {
  if (read === null) return;
  const trio = { adapter: ADAPTER, files: [fileSelect.value], scope: scopeSelect.value };
  // ⭐ 갈래가 가르는 것은 **읽은 저장소가 누구의 것인가**다 — 입력의 모양은 하나다.
  const axis = axisInput.value.trim();
  const named = axisNameProblem(axis);
  if (named !== null) {
    // ⭐ 묻는 손은 **하나**다(`axisNameProblem`) — 화면이 자기 규칙을 두면 조립기가 거부하는
    //   이름을 받아들이거나, 조립기가 받는 이름을 화면이 막는다.
    say(holdError, named);
    return;
  }
  say(holdError, null);
  const intent: ConstitutionIntent =
    kind.value === 'canon'
      ? { kind: 'canon', axis, trio, self: read.snapshot, base: read.base }
      : {
          kind: 'link',
          axis,
          canon: { repo: read.target.repo, file: fileSelect.value, scope: scopeSelect.value },
          // ⛔ 하류(당신 저장소)의 트리오는 받지 않는다 — 이 화면이 읽은 것은 **정본**이고,
          //    당신 코드를 어느 어댑터로 읽을지는 그 저장소의 사정이다(폴백 선언으로도 선다).
          trio: null,
          // ⛔ 그리고 그 저장소의 **선언**도 받지 않는다 — 이 화면이 읽은 선언은 **정본의**
          //    것이고, 하류의 선언에 축을 더하는 일에 남의 선언을 base 로 쓰면 그 순간 사본이다.
          //    연결 갈래에서 더하기는 체크아웃이 있는 쪽(`graduand link`)의 몫이다.
          base: null,
          self: null,
        };
  composeButton.disabled = true;
  say(holdStatus, strings.entry.running);
  void composeIntent(intent).then((outcome) => {
    composeButton.disabled = false;
    say(holdStatus, null);
    showCompose(outcome, intent.kind);
  });
});

copyButton.addEventListener('click', () => {
  if (composed === null) return;
  void navigator.clipboard.writeText(composed).then(
    () => say(holdStatus, strings.scaffold.copied(DECLARATION_FILE)),
    // 복사하지 못한 것을 복사했다고 말하지 않는다 — 조각은 화면에 그대로 있다.
    () => say(holdStatus, strings.scaffold.copyFailed),
  );
});
