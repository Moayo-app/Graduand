/**
 * 선언 0 에서도 **보이는 사실** — ⛔ 판정이 아니다.
 *
 * ⭐⭐ **왜 이 모듈이 생겼는가.** 선언이 분모이므로, 선언하지 않은 저장소에서는 공유값 축도
 * UI 경로 축도 미판정이다 — 그것은 **옳다**. 그런데 무료 진단에 주소를 넣은 방문자가 받는
 * 화면은 네 칸 중 **하나**만 재어진 보고서이고, 그가 읽는 「이 도구는 내 저장소에 할 말이
 * 거의 없다」도 틀리지 않았다: 우리가 실제로 그 저장소에 대해 **말한** 것이 한 칸뿐이다.
 *
 * ⛔ **판정기를 늘려 해결하지 않는다.** 선언 없이 위반을 짓는 축은 정의상 **우리가 지은
 * 규율**이고, 그것은 이 제품이 파는 명제(분모는 고객의 선언이다)의 반대다. 「같은 이름이
 * 다른 값을 든다」를 선언 없이 위반으로 부르면 테마(`:root` 와 `.dark`)와 모노레포의 독립
 * 앱이 전부 빨갛다 — **거짓 양성으로 산 두께는 미판정보다 나쁘다.**
 *
 * ⇒ 두꺼워지는 것은 판정이 아니라 **사실**이다. 이 모듈이 내는 것에는:
 * ⛔ 상태(3상태)가 없다 · ⛔ 수를 하나로 접는 산술이 없다 · ⛔ 점수·등급·백분율이 없다.
 * 재어진 것과 섞이지 않게 **봉투의 다른 칸**에 산다(`Measurement.undeclared`).
 *
 * 사실 둘:
 *
 * ⑴ **문서 사본** — 같은 블록이 파일 둘 이상에 **축자로** 산다. ⭐ 제품의 명제 그 자체이고
 *    (사본은 갈라진다), 로더가 이미 `.md` 전부의 본문을 싣기 때문에(`needsContent`)
 *    **요청 한 건도 늘리지 않는다.** 사본은 위반이 아니다 — 어느 사실이 어디 사는지는
 *    고객이 정한다. 사본은 **갈라질 자리**다: 축자로 같은 두 블록은 둘 중 하나만 고쳐지는
 *    날 갈라지고, 그 날을 보는 것이 이 제품이다.
 *
 * ⑴′ **갈라진 사본** — 그 「그 날」이 이미 지난 자리다. ⚠️⚠️ 이것이 없는 동안 ⑴ 의 수는
 *    **거꾸로 읽혔다**: 사본 둘 중 하나만 고쳐진 저장소에서 축자 사본은 **0 건**이고, 그
 *    0 은 「사본 없음」으로 읽힌다 — 이 모듈이 막으려던 바로 그 둔갑을 이 모듈이 저지르고
 *    있었다. ⇒ 다른 두 문서의 블록 한 쌍이 「겹치는 줄이 갈라진 줄보다 많고, 축자로 같지는
 *    않다」면 그 쌍을 적는다.
 *
 * ⑵ **선언할 수 있는 분모** — 어댑터마다 그 꼴의 경로가 몇 건인가. 「선언하면 이런 분모가
 *    선다」의 **경로 쪽 절반**이다. ⚠️ 본문은 세지 않는다 — 스코프와 토큰은 본문을 읽어야
 *    알고, **두 로더 모두** 선언이 지목하지 않은 파일의 본문을 싣지 않는다(`needsContent`
 *    는 `.md` 와 선언 파일뿐이다: 브라우저는 무인증 한도 때문이고, 워크스페이스는 같은
 *    규율을 공유한다). ⇒ 실린 수를 **따로** 적는다 — 선언 전의 `loaded` 0 은 「토큰 0」이
 *    아니라 「읽지 않았다」이고, 그 둘을 가르는 것이 이 제품의 전부다.
 */

import { VALUE_ADAPTERS } from './adapters/adapter.ts';
import type { RepoSnapshot } from './snapshot.ts';

/**
 * 사본 한 건 — 같은 블록이 사는 **집들**.
 *
 * ⛔ 블록 전문을 싣지 않는다 — 봉투는 URL fragment 에 실리는 표면이다. 싣는 것은 사람이
 * 찾아갈 **손잡이 한 줄**이고, 그 상한은 `HEAD_MAX` 다(`refs` 증거가 참조 문자열을 축자로
 * 드는 것과 같은 급이다 — 좌표와 손잡이는 싣고 본문은 싣지 않는다).
 */
export interface DocumentCopy {
  /** 블록의 첫 줄(잘릴 수 있다 — `HEAD_MAX`). */
  head: string;
  /** 블록의 줄 수. */
  lines: number;
  /** 그 블록이 축자로 사는 파일들(코드유닛 순). **둘 이상**이다. */
  files: string[];
}

/**
 * 갈라진 사본 한 쌍 — 「한 사실의 두 판」.
 *
 * ⛔ **유사도 점수가 아니다.** 단위는 여전히 **축자 동일한 줄**이고, 여기 실리는 것은 수
 * 둘(겹친 줄 · 갈라진 줄)이다. ⛔ 비율도 등급도 내지 않는다 — 문(gate)은 그 두 수의
 * **비교**이지 공표되는 비율이 아니다. 퍼지 유사도를 쓰면 「같은 주제의 다른 두 문단」이
 * 사본이 되고, 거짓 양성으로 산 두께는 미판정보다 나쁘다.
 */
export interface DivergedCopy {
  /** 두 판이 **함께 든** 줄 중 가장 긴 것(잘릴 수 있다 — `HEAD_MAX`). 가장 구별되는 손잡이다. */
  head: string;
  /** 두 판이 사는 파일 **둘**(코드유닛 순). */
  files: [string, string];
  /** 축자로 같은 줄의 수. */
  shared: number;
  /**
   * 한쪽에만 있는 줄의 수 — **양쪽을 더한 것**이다. **1 이상**이다(0 이면 축자 사본이다).
   * ⚠️ 문이 겨루는 상대는 이 합이 아니라 **한쪽의** 고유 줄 수다 — 합과 겨루면 석 줄
   * 문단의 한 줄 수정이 동점으로 빠진다.
   */
  differing: number;
}

/** 수의 범위 — 쌍마다 다르던 수가 가족으로 접히는 자리. 전부 같으면 `from === to` 다. */
export interface Span {
  from: number;
  to: number;
}

/**
 * 갈라진 사본의 **가족** — 손잡이가 같은 쌍들을 한 자리에 모은 것.
 *
 * ⭐⭐ **보고 표면의 물건이지 봉투의 물건이 아니다.** 쌍이 단위인 것은 그대로이고(봉투가
 * 쌍을 그대로 나른다), 이것은 받는 쪽이 접는 **파생**이다 — 요약이 이미 그 쌍 전부를
 * 나르므로 받는 쪽이 다시 셀 입력을 갖는다(격자와 가르는 축이 그것이다).
 *
 * ⚠️ **왜 접는가.** 한 블록이 집 N 곳에 살면 쌍이 C(N,2) 로 분다 — 이 저장소 실측에서 생성
 * 머리말 하나가 쌍 12 건으로 서서 같은 손잡이를 열두 번 반복했다. 수는 틀리지 않았고 **읽기**가
 * 틀렸다: 같은 사실이 목록의 아래를 가린다.
 *
 * ⛔ 수를 잃지 않는다 — 쌍마다 다르던 수가 **범위**로 남는다. ⛔ 상태도 비율도 없다.
 */
export interface DivergedFamily {
  head: string;
  /** 그 블록이 사는 자리 전부(쌍들의 **합집합**, 코드유닛 순). */
  files: string[];
  /** 이 가족이 접은 쌍의 수. */
  pairs: number;
  shared: Span;
  differing: Span;
}

/**
 * 쌍 → 가족. ⭐⭐ **접는 손은 이 함수 하나다** — 측정 명령과 페이지가 각자 접으면 그 둘은
 * 갈라지고, 갈라진 뒤에도 양쪽이 자기 기준으로는 옳다(이 모듈이 재는 그 결함이다).
 *
 * ⚠️ 손잡이가 다르면 **다른 가족**이다 — 같은 블록의 쌍이라도 가장 긴 공통 줄이 다르면
 * 갈라져 선다. ⛔ 전이적으로 이어 붙이지 않는다: 「어느 둘이 갈라졌는가」는 전이적이지
 * 않다(A↔B 와 B↔C 가 갈라졌다고 A↔C 가 갈라진 것은 아니다).
 *
 * 순수 함수다 — 같은 쌍 목록에서 같은 바이트가 난다(들어온 순서를 그대로 쥔다: 쌍 목록이
 * 이미 전순서로 정렬돼 있고, 가족은 **처음 본 손잡이 순**으로 선다).
 */
export function foldDiverged(pairs: readonly DivergedCopy[]): DivergedFamily[] {
  const families = new Map<string, DivergedFamily & { homes: Set<string> }>();
  for (const pair of pairs) {
    const seen = families.get(pair.head);
    if (seen === undefined) {
      families.set(pair.head, {
        head: pair.head,
        files: [],
        homes: new Set(pair.files),
        pairs: 1,
        shared: { from: pair.shared, to: pair.shared },
        differing: { from: pair.differing, to: pair.differing },
      });
      continue;
    }
    for (const file of pair.files) seen.homes.add(file);
    seen.pairs += 1;
    seen.shared = { from: Math.min(seen.shared.from, pair.shared), to: Math.max(seen.shared.to, pair.shared) };
    seen.differing = {
      from: Math.min(seen.differing.from, pair.differing),
      to: Math.max(seen.differing.to, pair.differing),
    };
  }
  return [...families.values()].map(({ homes, ...family }) => ({ ...family, files: [...homes].sort() }));
}

/** 어댑터 하나가 이 저장소에서 **고를 수 있는 것** — 경로만으로 센다. */
export interface AdapterSurface {
  adapter: string;
  /** 그 어댑터의 꼴인 추적 경로 수. 0 도 참인 답이다 — 지어내지 않는다. */
  files: number;
  /**
   * 그중 본문이 이 스냅샷에 **실린** 수. ⚠️ **선언 전에는 0 이 평상시다** — 두 로더 모두
   * 선언이 지목하지 않은 파일의 본문을 싣지 않는다. 그 0 은 「토큰 0」이 아니라 「읽지
   * 않았다」이고, 선언이 그 파일을 지목하는 날 이 수가 오른다.
   */
  loaded: number;
}

/**
 * 선언 0 에서 보이는 것 전부. ⛔ 상태도 3상태 수도 없다 — 이 칸을 보고 「통과」나 「위반」을
 * 읽을 수 있는 필드가 **하나도** 없는 것이 그 규율의 집행이다.
 */
export interface UndeclaredFacts {
  /** 사본 — 수 내림차순 · 같으면 손잡이 순. 상한이 있다(`COPY_CAP`). */
  copies: DocumentCopy[];
  /** 상한에 잘린 사본 수. ⭐ `blocks` 는 그와 무관하게 **전수**다. */
  copiesOmitted: number;
  /** 사본인 블록의 전수 — 상한과 무관하다. */
  blocks: number;
  /** 갈라진 사본 — 겹친 줄 많은 순. 상한이 있다(`DIVERGED_CAP`). */
  diverged: DivergedCopy[];
  /** 상한에 잘린 쌍의 수. ⭐ `divergedPairs` 는 그와 무관하게 **전수**다. */
  divergedOmitted: number;
  /**
   * 갈라진 사본인 쌍의 수 — 목록의 상한(`DIVERGED_CAP`)과 무관하다.
   * ⚠️ **`divergedTruncated` 가 참이면 이 수도 전수가 아니다** — 거기까지 본 수다. 두 칸을
   * 함께 읽어야 「몇이다」와 「그게 전부인가」가 갈린다.
   */
  divergedPairs: number;
  /**
   * 짝을 **다 보지 못한 채 멈췄는가** — ⛔ 못 본 것을 「갈라짐 0」으로 접지 않는다.
   * 상한과 다른 사실이다: 저쪽은 **센 뒤에** 목록을 자른 것이고, 이쪽은 **세지 못한** 것이다.
   */
  divergedTruncated: boolean;
  /**
   * 사본의 분모 — 추적되는 문서 수와, 그중 본문을 읽은 수. ⚠️ 둘이 다르면 사본의 수는
   * **부분 수집 위의 수**다: 잘림을 0 으로 접지 않는다.
   */
  documents: { tracked: number; read: number };
  /** 어댑터 등록부 전수(id 순). 저장소가 분모를 정하지 않는다. */
  surfaces: AdapterSurface[];
}

/**
 * 블록의 하한 — **2 줄 이상 · 120 자 이상**.
 *
 * 제목 한 줄 · 목록 한 줄 · 표 구분선 · 라이선스 한 줄은 산문의 평상시이고, 전부 세면
 * 잡음이 사실을 덮는다. ⭐ 이 휴리스틱은 **놓치는 쪽으로 틀리며**, 놓친 것은 「사본 0」이
 * 아니라 적지 않은 것이다 — 분모(`documents`)가 그 사실을 따로 든다.
 */
export const MIN_COPY_LINES = 2;
export const MIN_COPY_CHARS = 120;

/** 손잡이 한 줄의 상한 — 넘으면 자른다(블록 전문은 어느 경우에도 싣지 않는다). */
export const HEAD_MAX = 80;

/** 사본 목록의 상한 — 봉투가 URL fragment 에 실린다. 잘린 수는 `copiesOmitted` 가 센다. */
export const COPY_CAP = 50;

/** 갈라진 사본 목록의 상한 — 같은 이유다. 잘린 수는 `divergedOmitted` 가 센다. */
export const DIVERGED_CAP = 50;

/**
 * 손잡이가 되는 줄의 하한 — **40자**. 짧은 줄(`---` · `## 설치`)은 관용구라 두 블록이
 * 그것을 함께 든다는 사실이 사본의 신호가 되지 못한다.
 */
export const ANCHOR_CHARS = 40;

/**
 * 한 손잡이가 설 수 있는 자리의 상한 — **스무 곳**. 그보다 많이 서는 줄은 사본의 신호가
 * 아니라 관용구다(라이선스 고지 · 생성기 머리말). ⭐ 이 휴리스틱은 **놓치는 쪽으로 틀린다.**
 */
export const ANCHOR_HOMES_MAX = 20;

/**
 * 갈라진 사본의 문 — 겹친 줄의 하한. **둘**이다: 겹치는 줄은 손잡이의 하한(`ANCHOR_CHARS`)
 * 을 넘는 긴 줄을 **반드시 포함하므로**(그 줄로 짝이 섰다) 둘이면 이미 강한 증거다.
 *
 * ⚠️ **실측이 셋을 둘로 내렸다** — 석 줄짜리 문단에서 한 줄이 고쳐진 것이 드리프트의 평상시
 * 모양인데, 셋을 요구하면 그 평상시가 통째로 빠진다(겹침 2). 놓치는 쪽으로 틀리는 것과
 * **아무것도 보지 못하는 것**은 다르다.
 */
export const MIN_SHARED_LINES = 2;

/**
 * 볼 수 있는 짝의 상한 — ⚠️ 닿으면 **멈추고 그 사실을 적는다**(`divergedTruncated`).
 * ⛔ 조용히 멈추지 않는다: 못 본 짝을 「갈라짐 0」으로 접으면 큰 저장소가 전부 초록이 된다.
 */
export const PAIRS_MAX = 50_000;

const isDocument = (path: string): boolean => path.endsWith('.md');

/**
 * 블록으로 가른다 — 빈 줄이 경계다. 정규화는 **줄 끝 공백과 CR 뿐**이고 그 밖은 축자다:
 * 더 정규화하면 「같은 블록인가」가 우리의 해석이 되고, 해석한 동일성은 고객이 검증할 수 없다.
 *
 * ⚠️ 빈 줄을 품은 코드 펜스는 **덩이 둘로 갈린다** — 그 둘이 각자 하한을 넘으면 각자 세어진다.
 * 펜스를 추적하지 않는 것은 선택이다: 추적하면 이 모듈이 마크다운 문법을 해석하기 시작하고,
 * 그 해석은 `notations.ts` 한 자리에 있어야 한다.
 */
function blocksOf(text: string): { head: string; lines: number; body: string }[] {
  const out: { head: string; lines: number; body: string }[] = [];
  let current: string[] = [];
  const flush = (): void => {
    if (current.length === 0) return;
    const body = current.join('\n');
    if (current.length >= MIN_COPY_LINES && body.length >= MIN_COPY_CHARS) {
      out.push({ head: current[0]!.slice(0, HEAD_MAX), lines: current.length, body });
    }
    current = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '').replace(/\s+$/, '');
    if (line === '') flush();
    else current.push(line);
  }
  flush();
  return out;
}

/** 한 자리의 블록 — 갈라짐을 재려면 **줄의 집합**이 필요하다(축자 사본은 본문만으로 충분했다). */
interface Placed {
  file: string;
  body: string;
  lines: Set<string>;
}

/**
 * 갈라진 사본을 찾는다 — **축자 동일한 줄**만으로.
 *
 * ⭐⭐ 모든 블록 쌍을 보지 않는다. **구별되는 줄**(`ANCHOR_CHARS` 이상)을 손잡이로 삼아 그
 * 줄을 함께 든 블록만 짝으로 본다 — 짧은 줄은 관용구라 함께 들었다는 사실이 신호가 아니고,
 * 너무 많은 자리에 선 줄도 같다(`ANCHOR_HOMES_MAX`). ⭐ 이 휴리스틱은 **놓치는 쪽으로
 * 틀리며**, 놓친 것은 「갈라짐 0」이 아니라 적지 않은 것이다.
 *
 * ⛔ 유사도를 **점수로 짓지 않는다** — 재는 것은 줄 집합의 교집합과 차집합이고, 문은 그
 * 두 **수의 비교**다(겹친 쪽이 다수여야 한 사실의 두 판이다).
 */
function divergedCopies(placed: readonly Placed[]): { pairs: DivergedCopy[]; truncated: boolean } {
  // 손잡이 → 그 줄을 든 블록들. ⛔ 블록 자신이 아니라 **색인**을 먼저 짓는다: 짝의 수가
  //    블록 수의 제곱으로 자라는 자리를 여기서 막는다.
  const byAnchor = new Map<string, number[]>();
  placed.forEach((block, at) => {
    for (const line of block.lines) {
      if (line.length < ANCHOR_CHARS) continue;
      const homes = byAnchor.get(line);
      if (homes) homes.push(at);
      else byAnchor.set(line, [at]);
    }
  });

  const seen = new Set<string>();
  const pairs: DivergedCopy[] = [];
  let truncated = false;
  // 손잡이를 **정렬해** 돈다 — 상한에 닿아 멈추더라도 같은 입력이 같은 자리에서 멈춘다.
  for (const anchor of [...byAnchor.keys()].sort()) {
    const homes = byAnchor.get(anchor)!;
    // 관용구는 손잡이가 못 된다 — 한 자리뿐인 줄도, 너무 많은 자리에 선 줄도.
    if (homes.length < 2 || homes.length > ANCHOR_HOMES_MAX) continue;
    for (let i = 0; i < homes.length; i += 1) {
      for (let j = i + 1; j < homes.length; j += 1) {
        const a = placed[homes[i]!]!;
        const b = placed[homes[j]!]!;
        // 집이 둘이어야 사본이다 — 한 파일 안의 두 블록은 세지 않는다(축자 사본과 같은 규율).
        if (a.file === b.file) continue;
        const key = `${homes[i]}\u0000${homes[j]}`;
        if (seen.has(key)) continue;
        if (seen.size >= PAIRS_MAX) {
          truncated = true;
          break;
        }
        seen.add(key);

        let shared = 0;
        for (const line of a.lines) if (b.lines.has(line)) shared += 1;
        const onlyA = a.lines.size - shared;
        const onlyB = b.lines.size - shared;
        const differing = onlyA + onlyB;
        // ⛔ 축자로 같은 쌍은 여기 들지 않는다 — 저쪽 목록(`copies`)의 것이고, 두 번 세지 않는다.
        if (differing === 0) continue;
        // ⭐⭐ 문은 **한쪽씩** 본다 — 겹친 줄이 **어느 쪽의 고유한 줄보다도** 많아야 한
        //   사실의 두 판이다. ⚠️ 양쪽 고유를 **더한 수**와 겨루면 석 줄 문단에서 한 줄이
        //   고쳐진 평상시가 동점으로 빠진다(겹침 2 · 고유 1+1=2) — 그 평상시가 바로 우리가
        //   보려는 것이다. ⛔ 비율을 내지 않는다 — 수의 비교다.
        if (shared < MIN_SHARED_LINES || shared <= Math.max(onlyA, onlyB)) continue;

        // 손잡이는 **함께 든 줄 중 가장 긴 것**이다 — 가장 구별되는 자리를 사람에게 준다.
        let handle = '';
        for (const line of a.lines) {
          if (b.lines.has(line) && line.length > handle.length) handle = line;
        }
        const files: [string, string] = a.file < b.file ? [a.file, b.file] : [b.file, a.file];
        pairs.push({ head: handle.slice(0, HEAD_MAX), files, shared, differing });
      }
      if (truncated) break;
    }
    if (truncated) break;
  }

  // 겹침 많은 순 · 갈라짐 적은 순 · 손잡이 · 파일쌍 — 꼬리까지 비교해 **전순서**로 둔다.
  pairs.sort(
    (x, y) =>
      y.shared - x.shared ||
      x.differing - y.differing ||
      (x.head < y.head ? -1 : x.head > y.head ? 1 : 0) ||
      (x.files.join('\u0000') < y.files.join('\u0000') ? -1 : 1),
  );
  return { pairs, truncated };
}

/**
 * 스냅샷에서 선언 0 의 사실을 읽는다 — I/O 0 · 네트워크 0(스냅샷이 본문을 들고 있다).
 *
 * ⛔ 선언을 읽지 않는다 — 이 칸의 사실은 **선언과 무관하게** 참이어야 한다. 선언이 있는
 * 저장소에서도 같은 수가 나오고, 그래서 「선언했더니 사본이 사라졌다」가 성립하지 않는다.
 */
export function readUndeclared(snapshot: RepoSnapshot): UndeclaredFacts {
  const documents = snapshot.paths.filter(isDocument);
  const read: { path: string; text: string }[] = [];
  for (const path of documents) {
    const text = snapshot.files.get(path);
    // 추적되는데 못 읽었다 — 부재가 아니라 잘림이고, 그 차이는 아래 분모가 든다.
    if (typeof text === 'string') read.push({ path, text });
  }

  // 블록 본문 → 그 블록이 사는 파일들. ⭐ 한 파일 안의 반복은 사본이 **아니다**(집이 둘이어야
  //   사본이다) — 그래서 파일은 집합으로 모은다.
  const homes = new Map<string, { head: string; lines: number; files: Set<string> }>();
  const placed: Placed[] = [];
  for (const { path, text } of read) {
    for (const block of blocksOf(text)) {
      const seen = homes.get(block.body);
      if (seen) seen.files.add(path);
      else homes.set(block.body, { head: block.head, lines: block.lines, files: new Set([path]) });
      placed.push({ file: path, body: block.body, lines: new Set(block.body.split('\n')) });
    }
  }
  const { pairs, truncated } = divergedCopies(placed);

  const copied = [...homes.values()]
    .filter((home) => home.files.size >= 2)
    .map((home): DocumentCopy => ({
      head: home.head,
      lines: home.lines,
      files: [...home.files].sort(),
    }))
    // 집이 많은 것 · 큰 것 · 손잡이 순 — 꼬리의 파일 목록까지 비교해 **전순서**로 둔다:
    // 같은 입력이 같은 바이트를 내야 두 표면의 봉투가 갈라지지 않는다.
    .sort(
      (a, b) =>
        b.files.length - a.files.length ||
        b.lines - a.lines ||
        (a.head < b.head ? -1 : a.head > b.head ? 1 : 0) ||
        (a.files.join('\u0000') < b.files.join('\u0000') ? -1 : 1),
    );

  const surfaces = [...VALUE_ADAPTERS]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((adapter): AdapterSurface => {
      const candidates = snapshot.paths.filter((path) =>
        adapter.extensions.some((extension) => path.endsWith(extension)),
      );
      return {
        adapter: adapter.id,
        files: candidates.length,
        // 「실렸는가」는 스냅샷에 묻는다 — 경로 목록은 추적을 말하고 본문의 유무는 말하지 않는다.
        loaded: candidates.filter((path) => typeof snapshot.files.get(path) === 'string').length,
      };
    });

  return {
    copies: copied.slice(0, COPY_CAP),
    copiesOmitted: Math.max(copied.length - COPY_CAP, 0),
    blocks: copied.length,
    diverged: pairs.slice(0, DIVERGED_CAP),
    divergedOmitted: Math.max(pairs.length - DIVERGED_CAP, 0),
    divergedPairs: pairs.length,
    divergedTruncated: truncated,
    documents: { tracked: documents.length, read: read.length },
    surfaces,
  };
}
