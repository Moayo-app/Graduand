/**
 * 둘째 문서의 배선 — DOM 과 뷰모델 사이. 조립은 전부 판정기 모듈이, 화면 결정은 전부
 * 뷰모델 층(`composed.ts` · `screens.ts`)이 한다: 이 파일은 연결만 한다.
 *
 * ⭐⭐ **조립기가 측정 명령과 같은 함수 하나다**(`composeConstitution`) — 화면이 내보내는
 * 문자열과 `graduand canon`·`link` 이 쓰는 바이트가 **같은 손**에서 난다.
 *
 * ⭐⭐ **한 번 누르면 선언 1+N 벌이 난다.** 앞 판은 갈래 고르개 하나로 정본과 연결을 갈라서
 * 한 번에 선언 **하나**를 냈고, 헌법 하나를 저장소 N 개에 심으려면 고객이 같은 화면을 N+1 번
 * 돌며 축 이름을 N+1 번 손으로 적었다 — 그 반복이 이 제품이 재는 갈라짐의 생산 공정이다.
 * ⇒ 이름 하나 · 정본 하나 · 연결 N 개를 받아 **그 헌법에 답하는 저장소 전부의 선언**을 낸다.
 *
 * ⭐⭐ **주소로 받는다 — 그것이 비공개 저장소의 길이다.** 파일과 스코프가 **고르개**였던
 * 동안 이 입구는 공개 저장소만 받았다(이 브라우저가 읽을 수 있는 것이 그것뿐이다). 규칙의
 * 정본을 비공개에 두는 조직이 평상시라, 그 입구는 그들에게 「여기서는 아무것도 못 한다」였다.
 * ⇒ 셋을 주소로 받고, 읽기는 **확인하는 걸음**으로 남는다.
 *
 * ⭕ **추측을 받지 않는다는 규율은 읽기로 옮겨 갔다** — 읽혔으면 조립이 그 스냅샷으로 적힌
 * 주소를 **읽어 본다**(실재하는가 · 그 스코프에서 값이 하나라도 읽히는가). ⛔ 읽지 않은 것은
 * 「참이다」가 아니라 **「묻지 않았다」**이고, 조립기가 그 둘을 이미 가른다(`self: null`).
 *
 * ⭐ **런타임에 태어나는 자리의 자구는 발행본에서 읽는다**(`data-…`) — 목록의 제거 버튼과
 * 결과 카드의 버튼 둘이 그렇다. 이 파일이 자구를 쥐면 그것이 **사본**이고, 사본은 카탈로그가
 * 움직이는 날 갈라진다.
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
import { readRepo, readScopes, composeIntent, type ComposeNetOutcome } from './outcome.ts';
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
const axisInput = must<HTMLInputElement>('#hold-axis');
const repoInput = must<HTMLInputElement>('#hold-repo');
const fileInput = must<HTMLInputElement>('#hold-file');
const fileOptions = must<HTMLDataListElement>('#hold-file-options');
const scopeInput = must<HTMLInputElement>('#hold-scope');
const scopeOptions = must<HTMLDataListElement>('#hold-scope-options');
const readButton = must<HTMLButtonElement>('#hold-read');
const linkInput = must<HTMLInputElement>('#hold-link-repo');
const linkAddButton = must<HTMLButtonElement>('#hold-link-add');
const linkEmpty = must<HTMLParagraphElement>('#hold-link-empty');
const linkList = must<HTMLUListElement>('#hold-link-list');
const composeButton = must<HTMLButtonElement>('#hold-compose');
const holdError = must<HTMLParagraphElement>('#hold-error');
const holdStatus = must<HTMLParagraphElement>('#hold-status');
const holdResult = must<HTMLElement>('#hold-result');

/** 발행본의 속성에 선 자구 — ⛔ 이 파일이 자구를 쥐지 않는다(쥐면 사본이다). */
const label = (node: Element, name: string): string => node.getAttribute(name) ?? '';
const removeLabel = label(linkList, 'data-remove');
const snippetLabel = label(holdResult, 'data-snippet');
const copyLabel = label(holdResult, 'data-copy');
const downloadLabel = label(holdResult, 'data-download');

/**
 * ⚠️ **어댑터는 고르개가 아니다** — 등록부에 이름이 하나뿐인 동안 고르게 하는 것은 선택이
 * 아니라 묻기만 하는 칸이다. 이름이 늘면 그때 고르개가 선다. ⛔ 그래도 **화면이 그 이름을
 * 적지는 않는다**: 등록부의 첫 자리를 읽는다(사본이 생기지 않는다).
 */
const ADAPTER = VALUE_ADAPTERS[0]!.id;

/**
 * **읽어 본** 정본 — ⭐ 생략(null)이 「참이다」가 아니라 **「묻지 않았다」**다(자격의 그 규율과
 * 같은 꼴). 들어 있으면 조립이 그것으로 적힌 주소를 읽어 보고, 연결 갈래의 박제도 **이
 * 스냅샷에서** 읽는다(정본을 저장소마다 다시 가져오지 않는다).
 */
let seen: { repo: string; snapshot: RepoSnapshot; base: ValidDeclaration | null } | null = null;

/**
 * 연결 저장소들 — ⭐ **주소만** 든다. 선언을 더할 자리(각자의 `base`)는 조립할 때 읽는다:
 * 더하기 시점에 읽어 두면 조립까지의 사이에 그 저장소가 움직여도 화면은 낡은 선언에 축을
 * 더하고, 그 전문을 고객이 커밋하면 **남이 적은 축이 조용히 사라진다**.
 */
const linked: RepoRef[] = [];

const say = (node: HTMLParagraphElement, line: string | null): void => {
  node.textContent = line ?? '';
  node.hidden = line === null;
};

/** 제안 — ⛔ 입력을 막지 않는다(비어 있으면 아무 말도 하지 않는 것이 참이다). */
const suggest = (node: HTMLDataListElement, entries: readonly { value: string; label: string }[]): void => {
  node.replaceChildren();
  for (const entry of entries) {
    const option = document.createElement('option');
    option.value = entry.value;
    if (entry.label !== entry.value) option.textContent = entry.label;
    node.append(option);
  }
};

/** 판정 불가는 **전용 화면**이 받는다 — 읽지 못한 것은 조립의 거부가 아니다. */
const screenFor = (outcome: Parameters<typeof unjudgeableScreen>[0]): HTMLElement =>
  renderScreen(unjudgeableScreen(outcome, strings));

/** 연결 목록 — ⭐ 비어 있다는 사실도 **말한다**(빈 목록은 아무 말도 하지 않는다). */
function refreshLinks(): void {
  linkList.replaceChildren();
  for (const target of linked) {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'mono';
    name.textContent = target.repo;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'link-remove';
    remove.textContent = removeLabel;
    remove.addEventListener('click', () => {
      linked.splice(linked.indexOf(target), 1);
      refreshLinks();
    });
    item.append(name, remove);
    linkList.append(item);
  }
  linkEmpty.hidden = linked.length > 0;
}

/** 적힌 파일에서 어댑터가 본 스코프 — ⭐ 읽어 본 저장소에서만 선다(제안일 뿐이다). */
function suggestScopes(repo: string, file: string): void {
  if (seen === null || seen.repo !== repo || file === '') return;
  void readScopes({ repo }, [file], ADAPTER).then((outcome) => {
    if (outcome.kind !== 'scopes' || outcome.probe.kind !== 'read') return;
    // 읽은 스냅샷을 **본문이 실린 것**으로 바꾼다 — 조립이 그것으로 트리오를 읽어 본다.
    seen = { repo, snapshot: outcome.snapshot, base: seen!.base };
    suggest(
      scopeOptions,
      outcome.probe.scopes.map((entry) => ({
        value: entry.scope,
        label: strings.constitution.result.scopeOption(entry.scope, entry.tokens),
      })),
    );
  });
}

readButton.addEventListener('click', () => {
  const target = parseRepoInput(repoInput.value);
  if (target === null) {
    say(holdError, strings.entry.unreadableInput);
    return;
  }
  say(holdError, null);
  holdResult.replaceChildren();
  readButton.disabled = true;
  say(holdStatus, strings.entry.running);

  void readRepo(target, ADAPTER).then((outcome) => {
    readButton.disabled = false;
    say(holdStatus, null);
    if (outcome.kind !== 'repo') {
      // ⛔ 읽지 못한 것이 조립을 막지 않는다 — 비공개 저장소의 선언도 적을 수 있어야 한다.
      //    화면은 **왜 못 읽었는지**와 대안 경로를 말하고, 폼은 그대로 선다.
      seen = null;
      holdResult.replaceChildren(screenFor(outcome));
      return;
    }
    seen = { repo: target.repo, snapshot: outcome.snapshot, base: outcome.base };
    if (outcome.files.length === 0) {
      // 「읽을 꼴의 파일이 없다」는 **참인 답**이다 — 없는 후보를 지어내지 않는다.
      say(holdError, strings.constitution.result.noFiles);
      suggest(fileOptions, []);
      return;
    }
    suggest(
      fileOptions,
      outcome.files.map((file) => ({ value: file, label: file })),
    );
    suggestScopes(target.repo, fileInput.value.trim());
  });
});

// 주소가 바뀌면 읽어 둔 것의 **의미가 바뀐다** — 들고 가지 않는다(남의 스냅샷으로 읽어 보면
// 「실재하지 않는다」가 거짓으로 난다).
repoInput.addEventListener('input', () => {
  seen = null;
  suggest(fileOptions, []);
  suggest(scopeOptions, []);
});
fileInput.addEventListener('change', () => {
  if (seen !== null) suggestScopes(seen.repo, fileInput.value.trim());
});

linkAddButton.addEventListener('click', () => {
  const target = parseRepoInput(linkInput.value);
  if (target === null) {
    say(holdError, strings.entry.unreadableInput);
    return;
  }
  say(holdError, null);
  // ⛔ 같은 주소를 두 번 들지 않는다 — 두 번 들면 같은 저장소의 선언이 두 벌 나오고, 고객은
  //    그 둘 중 어느 것이 맞는지 묻게 된다(둘은 바이트까지 같지만 그 사실을 화면이 못 말한다).
  if (!linked.some((entry) => entry.repo === target.repo)) linked.push(target);
  linkInput.value = '';
  refreshLinks();
});

/** 조각 하나와 그 버튼 둘 — ⭐ 보이는 바이트와 나가는 바이트가 **같은 문자열**이다(사본 0). */
function snippetOf(json: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'card-snippet';
  const pre = document.createElement('pre');
  pre.className = 'snippet';
  pre.setAttribute('aria-label', snippetLabel);
  pre.textContent = json;

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'card-copy';
  copy.textContent = copyLabel;
  copy.addEventListener('click', () => {
    void navigator.clipboard.writeText(json).then(
      () => say(holdStatus, strings.scaffold.copied(DECLARATION_FILE)),
      // 복사하지 못한 것을 복사했다고 말하지 않는다 — 조각은 화면에 그대로 있다.
      () => say(holdStatus, strings.scaffold.copyFailed),
    );
  });

  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'card-download';
  download.textContent = downloadLabel;
  download.addEventListener('click', () => {
    // ⛔ 전송이 아니다 — 브라우저가 이미 쥔 바이트를 **그 브라우저가** 파일로 내린다.
    //    주소는 런타임에 난 것이고 나가는 요청이 0 이다.
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = DECLARATION_FILE;
    anchor.click();
    URL.revokeObjectURL(url);
  });

  wrap.append(pre, copy, download);
  return wrap;
}

/** 카드 하나 — 조립의 사실 · 조각 · 버튼 둘. ⭐ 거부면 조각이 없고, 버튼도 서지 않는다. */
function cardOf(outcome: ComposeNetOutcome, intent: ConstitutionIntent['kind'], repo: string): HTMLElement {
  const card = document.createElement('section');
  card.className = 'hold-card';
  if (outcome.kind !== 'compose') {
    // ⚠️ 읽지 못한 것은 **조립의 거부가 아니다** — 요구하는 행동이 다르므로 전용 화면이 선다.
    card.append(screenFor(outcome));
    return card;
  }
  const vm = buildComposed(outcome.outcome, intent, strings, repo);
  card.append(renderComposed(vm));
  if (vm.json !== null) card.append(snippetOf(vm.json));
  return card;
}

/**
 * 정본의 스냅샷에 **방금 조립한 선언**을 실어 둔다 — ⭐⭐ 연결 갈래가 박제를 읽으려면 정본
 * 저장소가 「자기 공유값을 어떻게 읽는가」를 선언하고 있어야 한다(`readCanon` 이 그 선언에서
 * 어댑터를 찾는다). 그런데 이 화면의 평상시는 **정본 선언이 아직 커밋되지 않은** 자리다 —
 * 그것을 지금 조립하는 중이다. ⇒ 정본의 스냅샷에 그 선언을 실어 조립한다: 커밋하면 실제로
 * 그 바이트가 그 자리에 선다. ⛔ 지어내는 것이 아니다 — 같은 화면이 같은 입력으로 낸 선언이다.
 */
function withDeclaration(snapshot: RepoSnapshot, json: string): RepoSnapshot {
  const paths = snapshot.paths.includes(DECLARATION_FILE)
    ? snapshot.paths
    : [...snapshot.paths, DECLARATION_FILE].sort();
  return { ...snapshot, paths, files: new Map(snapshot.files).set(DECLARATION_FILE, json) };
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const target = parseRepoInput(repoInput.value);
  if (target === null) {
    say(holdError, strings.entry.unreadableInput);
    return;
  }
  const axis = axisInput.value.trim();
  const named = axisNameProblem(axis);
  if (named !== null) {
    // ⭐ 묻는 손은 **하나**다(`axisNameProblem`) — 화면이 자기 규칙을 두면 조립기가 거부하는
    //   이름을 받아들이거나, 조립기가 받는 이름을 화면이 막는다.
    say(holdError, named);
    return;
  }
  say(holdError, null);

  const repo = target.repo;
  const file = fileInput.value.trim();
  const scope = scopeInput.value.trim();
  // ⭐ 읽어 본 것이 **이 주소**일 때만 시야로 쓴다 — 주소가 바뀐 뒤의 스냅샷은 남의 것이다.
  const sight = seen !== null && seen.repo === repo ? seen : null;
  const canonIntent: ConstitutionIntent = {
    kind: 'canon',
    axis,
    trio: { adapter: ADAPTER, files: [file], scope },
    self: sight?.snapshot ?? null,
    base: sight?.base ?? null,
  };

  composeButton.disabled = true;
  say(holdStatus, strings.entry.running);
  // ⭐ 정본이 **먼저**다 — 연결의 박제가 그 선언을 기준으로 읽히므로, 정본이 서지 않으면
  //   연결도 서지 않는다(순서가 뒤바뀌면 「없는 기준으로 읽은 박제」가 난다).
  void composeIntent(canonIntent)
    .then(async (first) => {
      const cards: HTMLElement[] = [cardOf(first, 'canon', repo)];
      const composedCanon =
        first.kind === 'compose' && first.outcome.kind === 'composed' ? first.outcome.json : null;
      for (const entry of linked) {
        if (composedCanon === null) break;
        // ⭐ 저장소마다 **그 저장소의 선언**을 읽어 축을 더한다 — 읽지 못하면 그 카드만
        //   판정 불가이고, 나머지 저장소의 선언은 그대로 선다(한 벌의 실패가 전부를 지우지 않는다).
        const read = await readRepo(entry, ADAPTER);
        if (read.kind !== 'repo') {
          cards.push(cardOf(read, 'link', entry.repo));
          continue;
        }
        const linkIntent: ConstitutionIntent = {
          kind: 'link',
          axis,
          canon: { repo, file, scope },
          // ⛔ 하류(연결 저장소)의 트리오는 받지 않는다 — 이 화면이 적은 것은 **정본**이고,
          //    그쪽 코드를 어느 어댑터로 읽을지는 그 저장소의 사정이다(폴백 선언으로도 선다).
          trio: null,
          self: null,
          base: read.base,
        };
        // ⚠️ 정본을 읽어 두지 **못했으면** 시야를 넘기지 않는다 — 그러면 조립이 지목을 따라
        //    스스로 읽고, 비공개라 읽지 못하면 그 카드가 **판정 불가**로 선다(대안 경로를
        //    함께 말한다). ⛔ 박제 없는 연결 선언을 조용히 내지 않는다: 연결의 절반이다.
        const peers = sight === null ? undefined : [withDeclaration(sight.snapshot, composedCanon)];
        cards.push(cardOf(await composeIntent(linkIntent, { peers }), 'link', entry.repo));
      }
      holdResult.replaceChildren(...cards);
      holdResult.scrollIntoView({ block: 'nearest' });
    })
    .finally(() => {
      composeButton.disabled = false;
      say(holdStatus, null);
    });
});

refreshLinks();
