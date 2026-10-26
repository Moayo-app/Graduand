/**
 * 화면 문구의 **모양** — 로케일 둘이 이 한 타입을 채운다.
 *
 * ⭐⭐ **왜 타입이 패리티 가드인가.** 두 벌의 키 집합이 같은지를 테스트만으로 물으면
 * 실패는 `npm test` 에서 나오고, 그 사이 `tsc` 는 초록이다 — 이 저장소가 이미 그 공백에서
 * 샜다(사유 코드 둘이 늘었는데 화면의 사유 표가 모르는 상태로 양쪽 PR 의 CI 가 초록이었다).
 * 여기서는 번역 한 벌이 `Strings` 를 **구현**하므로, 키가 빠지거나 인자 모양이 어긋나면
 * **타입 검사가** 막는다. 런타임 전수 가드는 그 위에 한 겹 더 얹는 것이고(`i18n.test.ts`),
 * 둘 중 하나만으로는 오늘만 참이다.
 *
 * ⭐ **ko 가 정본이고 en 이 번역이다.** 정본이 둘이면 사본이고, 사본은 갈라진다 — 이 제품이
 * 파는 바로 그 명제라 자기에게 먼저 적용한다. 그래서 문구를 바꾸는 순서가 하나다: ko 를
 * 고치고, 타입이 가리키는 en 자리를 고친다.
 *
 * ⛔ **협상이 없다.** 로케일을 고르는 입력은 **그 문서가 선언한 `lang`** 하나다 — 서버 협상
 * (Accept-Language 302)은 기각됐고(우리 코드가 도는 서버가 0 이다), 브라우저 쪽
 * `navigator.language` 분기도 같은 협상이다: 주소가 가리키는 문서와 **다른 언어**가 그려지면
 * 그 주소를 공유한 사람이 받은 화면과 공유받은 사람이 받는 화면이 달라진다. 주소 하나가 한
 * 언어를 가리키는 것이 공유 가능한 보고서의 조건이고, 그 사실을 가드가 문다(`i18n.test.ts`).
 *
 * ⚠️ **모르는 `lang` 은 조용히 정본으로 접지 않는다**(`stringsFor` 가 던진다) — 접으면
 * 오타가 「ko 로 그렸다」로 둔갑하고, 발행된 문서가 선언한 언어와 그려진 언어가 갈라진다.
 * 발행본의 `lang` 이 아는 값인지는 가드가 따로 문다.
 */

import type {
  CheckStatus,
  EntitlementDetail,
  ExpiryFact,
  ReasonCode,
} from '../../verifier/src/index.ts';
import type { ReportOrigin } from './report.ts';
// ⚠️ 두 벌은 **값**으로 들어오고, 그쪽은 이 파일의 **타입만** 가져간다(`import type` 은
//    지워지므로 런타임 순환이 없다). 값으로 되가져오면 그 자리에서 순환이 된다.
import { ko } from './strings-ko.ts';
import { en } from './strings-en.ts';

/**
 * 출하된 로케일 전수 — **ko 가 첫 자리(정본)**다.
 *
 * ⚠️ 이 열거는 아직 **개방 목록에서 유도되지 않는다.** 분모의 정본은 공개 배달 저장소의
 * `config/allowed-countries.yml`(`doc_locale` 의 합집합)이고, 그쪽 가드 축자가 「로케일
 * 분모는 config 에서 **유도**하고 테스트에 수를 적지 않는다」다. ⛔ 그 파일의 사본을 여기
 * 두지 않는다 — 사본은 갈라지고, 갈라진 사본이 바로 이 제품이 재는 결함이다. ⇒ 유도하는
 * 모양은 **코드 이사 뒤 한 저장소에서** 선다. 그때 이 상수가 유도의 결과로 바뀐다.
 */
export const LOCALES = ['ko', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** 판정 불가 화면 한 장 — 제목과 줄들. 명령·설명은 뷰모델 층이 붙인다. */
export interface ScreenText {
  readonly title: string;
  readonly lines: readonly string[];
}

/** 선언된 갈라짐 증거 한 건 — 사유는 **사람이 읽는 문장**이라 `k=v` 칸으로 접지 않는다. */
export interface DivergenceText {
  readonly token: string;
  readonly reason: string;
  /** `file:line` — 증거가 자리를 들었을 때만. */
  readonly at: string | null;
}

/** 보고서 꼬리의 수 — 셋을 접어 한 숫자로 만들지 않는다(3상태 그대로 센다). */
export interface Totals {
  readonly checks: number;
  readonly violations: number;
  readonly passes: number;
  readonly unjudged: number;
}

export interface Strings {
  /** 이 벌이 자기를 무엇이라 말하는가 — 발행된 문서의 `lang` 과 맞는지 가드가 문다. */
  readonly locale: Locale;

  /** 3상태의 이름. ⛔ 넷째가 없다 — 접는 말은 금칙이다. */
  readonly status: Readonly<Record<CheckStatus, string>>;

  /**
   * 사유 코드마다 문구가 하나씩 — **전수여야 한다.** 판정기에 사유가 늘면 `Record` 가
   * 두 벌 모두에서 타입 검사로 막는다. 비어 있는 사유는 화면에서 「미판정」만 남기는데,
   * 사유 없는 미판정은 이 제품이 팔지 않는 물건이다.
   */
  readonly reason: Readonly<Record<ReasonCode, string>>;

  readonly report: {
    readonly title: string;
    readonly label: {
      readonly repo: string;
      readonly commit: string;
      readonly source: string;
      readonly measuredAt: string;
      readonly verifier: string;
    };
    /** 저장소 이름을 읽지 못했을 때 — 빈 칸이 아니라 **못 읽었다고 말한다**. */
    readonly repoUnknown: string;
    readonly source: (origin: ReportOrigin, source: string) => string;
    /** 「모름」은 0 이 아니다. */
    readonly dirtyUnknown: string;
    readonly dirty: (files: number) => string;
    readonly fragmentNotice: string;
    readonly scope: (notations: string) => readonly string[];
    readonly totals: (totals: Totals) => string;
    /** 화면에 싣지 않은 증거 — 수(counts)는 그와 무관하게 전수다. */
    readonly omitted: (beyond: number) => string;
    readonly divergence: (evidence: DivergenceText) => string;
  };

  readonly screen: {
    readonly commandCaption: string;
    readonly privateOrMissing: ScreenText;
    readonly truncated: ScreenText;
    readonly rateLimited: (wait: string) => ScreenText;
    /** 리셋 시각을 말하지 않은 응답 — 모르는 것을 숫자로 지어내지 않는다. */
    readonly waitUnknown: string;
    readonly wait: (minutes: number, resetAt: string) => string;
    readonly versionMismatch: (axis: string, found: string) => ScreenText;
    /** 판 불일치의 축 이름 — 문구 안에 들어가므로 번역을 탄다. */
    readonly axis: { readonly fragment: string; readonly schema: string };
    readonly fragmentUnreadable: ScreenText;
    readonly declarationInvalid: (problems: readonly string[]) => ScreenText;
    readonly error: (message: string) => ScreenText;
  };

  /**
   * 자격·만기 **고지** — ⭐⭐ 이 절이 받는 것은 판정기 모듈의 **사실**이고, 문장은 여기서
   * 짓는다. 그 반대(정본이 완성된 문장을 내고 두 표면이 축자로 드는 꼴)는 로케일이 둘이
   * 되는 순간 ⑴ 한국어 화면에 영문 한 줄을 세우거나 ⑵ 두 표면의 「같은 한 문장」이
   * 로케일마다 갈라진다 — 둘 다 거짓이라 **정본이 사실로 내려왔다.**
   *
   * ⛔ **여기서 날짜를 세지 않는다.** 남은 날과 「넘겼는가」는 `ExpiryFact` 가 들고 오고,
   * 이 함수들이 하는 일은 그 사실을 **문장에 끼우는 것**뿐이다 — 세는 손이 둘이 되면
   * 경계값(만기 **당일**은 아직 자격이다)이 한쪽에서만 포함이 되고, 그러면 같은 자격이
   * 표면에 따라 끝났다/안 끝났다가 된다.
   *
   * ⚠️ **자격이 있는 상태(`entitled`)와 묻지 않은 표면(`unasked`)의 자리는 없다** — 그
   * 상태들이 고지하는 자격 줄이 0 이기 때문이다(없는 사실을 적지 않는다). 만기가 든 자격은
   * 아래 `expires` 로 간다: 「자격이 있다」와 「만기가 남았다」는 다른 사실이다.
   */
  readonly entitlement: {
    /** 물을 길이 없는 빌드 — ⭐ **막지 않는다는 사실을 말한다**(조용한 통과를 두지 않는다). */
    readonly unwired: readonly string[];
    /**
     * 수가 나오지 않는다 — 사유 코드와 **요구하는 행동**이 함께 간다.
     *
     * ⚠️ `reason` 은 **코드 그대로** 줄에 들어간다(번역하지 않는다) — 기계가 읽는 손잡이라
     * 로케일마다 달라지면 같은 미판정을 두 이름으로 부르게 된다. 사람이 읽는 사유 문장은
     * 칸마다의 `reason` 표가 이미 든다. `detail` 이 가르는 것은 **행동**이다.
     */
    readonly absent: (reason: ReasonCode, detail: EntitlementDetail) => readonly string[];
    /** 만기가 남았다 — 만기일 · 남은 날 · 센 기준일 · 전환 경로가 **함께** 간다. */
    readonly expires: (expiry: ExpiryFact, convertPath: string) => readonly string[];
    /**
     * 만기를 넘겼다 — ⭐ **접는 자리가 여기다**: 사실의 남은 날은 음수 그대로이고, 그것을
     * 「며칠 전」으로 읽는 것이 문장의 몫이다(사실에서 접으면 「언제 끝났는지」가 사라진다).
     */
    readonly expired: (expiry: ExpiryFact, convertPath: string) => readonly string[];
  };

  readonly entry: {
    readonly unreadableInput: string;
    readonly running: string;
  };

  readonly scaffold: {
    readonly copied: (file: string) => string;
    readonly copyFailed: string;
  };
}

/** 출하된 두 벌 — 아래 `stringsFor` 가 고르는 전부다. */
export const CATALOG: Readonly<Record<Locale, Strings>> = { ko, en };

/**
 * 그 문서의 `lang` 이 가리키는 벌.
 *
 * @throws Error 모르는 `lang` 일 때 — ⛔ 정본으로 조용히 접지 않는다: 접으면 발행된 문서가
 *   선언한 언어와 그려진 언어가 갈라지고, 그 갈라짐은 화면에 아무 표시도 남기지 않는다.
 */
export function stringsFor(lang: string): Strings {
  const locale = lang.trim().toLowerCase();
  if (!(LOCALES as readonly string[]).includes(locale)) {
    throw new Error(`no catalog for lang: ${JSON.stringify(lang)}`);
  }
  return CATALOG[locale as Locale];
}
