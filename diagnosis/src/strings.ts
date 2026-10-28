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

/**
 * 보고서 꼬리의 수 — 셋을 접어 한 숫자로 만들지 않는다(3상태 그대로 센다).
 *
 * ⭐⭐ **`measured` 가 파생이 아니라 축이다.** 3상태를 **둘로** 먼저 가르는 것이 이 보고서의
 * 첫 구분이기 때문이다 — 「재어진 것」 안에서 통과와 위반이 갈리고, 「재지 않은 것」은 그
 * 바깥이다. ⛔ 카탈로그가 `violations + passes` 를 더하게 두지 않는다: 셈이 문구 쪽으로
 * 내려가면 로케일마다 한 벌씩 생기고, 그 사본들은 갈라진다.
 */
export interface Totals {
  readonly checks: number;
  readonly measured: number;
  readonly violations: number;
  readonly passes: number;
  readonly unjudged: number;
}

/**
 * 문서가 **발행 시점에** 싣는 정적 산문 — 히어로 · 입구 카드 둘 · 스캐폴드 · 가격 · 푸터.
 *
 * ⭐⭐ **왜 이 절이 생겼는가.** 이 산문은 `index.html` 안에 **한국어로** 있었다. 가드
 * 「화면 코드에 하드코딩 한글이 0」은 참이었지만 **HTML 이 그 분모가 아니라서** 그 공백이
 * 초록 아래 살아 있었다 — `/en/` 을 막고 있던 것은 번역이 아니라 **산문의 소속**이었다.
 * ⇒ 산문이 카탈로그로 내려오고, 그 순간 분모가 실제로 전부를 덮는다.
 *
 * ⛔ **런타임에 채우지 않는다.** 이 절의 소비자는 브라우저가 아니라 **생성기**(`generate.ts`)
 * 이고, 발행본은 산문이 **바이트로 박힌** 정적 HTML 이다 — 런타임에 채우면 스크립트를 끈
 * 방문자가 받는 바이트에 산문이 0 이 되는데, 그것은 구독 입구를 JS 없이 눌리게 둔 이유를
 * 정면으로 지운다.
 *
 * ⭐ **인라인 강조는 자구 안에 산다** — `` `…` `` 는 코드 조각, `*…*` 는 강조다. 문장을
 * 마크업으로 토막내면 번역이 강조의 자리를 자기 문법대로 옮길 수 없다. 변환은 생성기가
 * **이스케이프한 뒤** 하므로, 카탈로그가 마크업을 들고 있는 것이 아니다.
 *
 * ⛔ **법정 게시 항목의 값은 여기 없다** — 로케일 불변이라 `publisher.ts` 한 벌이고,
 * 이 절이 드는 것은 그 **라벨**뿐이다.
 */
export interface PageText {
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly lede: string;
  /** 체크아웃에서 돌아오는 활성화 신호의 한 줄 — 발행 시점에 박히고 스크립트가 보인다. */
  readonly activated: string;

  /**
   * GNB — 항목 **둘**뿐이다(브랜드 락업 · 로케일 셀렉터).
   *
   * ⛔ 1차 행동 0 · 내비 링크 0 · 햄버거 0 — 사유는 **중복**이다: 진단 입구가 히어로 바로
   * 아래라 첫 화면에 이미 있고, 요금제·FAQ 는 푸터의 제품 컬럼이 닻으로 받는다.
   *
   * ⚠️ 여기 적혀 있던 사유(「앵커를 쓸 수 없다」)는 **낡았다** — 막던 것은 앵커 자체가
   * 아니라 해시를 요약과 나눠 쓰지 못한 것이었고, 그 규칙이 형식에 생기면서
   * (`looksLikeFragment`) 같은 문서 안의 닻이 섰다. 낡은 선언은 미판정이 아니라 판정 실패라
   * 자구를 고친다.
   */
  readonly nav: {
    readonly label: string;
    /** 브랜드 링크의 이름 — ⭐ 해시 보기에서 **해시를 지우고 본문으로 돌아가는 유일한 길**이다. */
    readonly home: string;
    /** 셀렉터의 요약 문면 — 눌러서 펴는 `<details>` 의 그 한 줄. */
    readonly localeLabel: string;
  };

  readonly entry: {
    readonly label: string;
    readonly publicTitle: string;
    readonly publicBody: string;
    readonly inputLabel: string;
    readonly inputPlaceholder: string;
    readonly submit: string;
    readonly privateTitle: string;
    readonly privateBody: string;
    readonly privateNote: string;
  };

  /**
   * 기능 — ⭐⭐ **영업 화면이 무엇을 파는가를 칸으로 적는 자리.** 히어로는 축의 **이름**만
   * 말할 수 있고(한 문장이다), 그 이름들이 무엇을 재는지는 적을 자리가 없었다 — 그 공백을
   * 읽는 사람이 메우게 두면 광고는 어휘만 던지고 내용을 말하지 않는다.
   *
   * ⭐ **칸마다 「선 것」만 적는다** — 안 선 것의 자리는 FAQ 와 고지 둘이고(가격 · 활성화),
   * 여기 섞으면 「돌아간다」와 「아직 아니다」가 같은 꼴로 선다.
   *
   * ⚠️ **수를 열거에서 받는다** — 칸의 수를 틀이 들고(카드마다 자리 둘) 생성기가
   * `features.item<N>.…` 로 짓는다: 열거가 늘거나 줄면 「모르는 자리」나 「쓰이지 않는 키」로
   * 생성기가 **던진다**. ⛔ 그래서 수를 산문에 적지 않는다 — 적으면 사본이 하나 늘고, 그
   * 사본은 칸이 움직이는 날 조용히 갈라진다.
   */
  readonly features: {
    readonly label: string;
    readonly title: string;
    readonly lede: string;
    readonly items: readonly { readonly title: string; readonly body: string }[];
  };

  readonly scaffold: {
    readonly label: string;
    readonly title: string;
    readonly body: string;
    readonly snippetLabel: string;
    readonly copy: string;
    readonly emptyNote: string;
    readonly canonNote: string;
    /** ⚠️ 「작업 사본」이다 — git 체크아웃이지 결제 화면이 아니다(번역이 그 둘을 가른다). */
    readonly workingCopyNote: string;
  };

  readonly cta: {
    readonly label: string;
    readonly title: string;
    readonly boundary: string;
    readonly price: string;
    readonly priceNote: string;
    /**
     * 세금 한 줄 — ⚠️ **벤더 설정이 참으로 만드는 것까지만 말한다.**
     *
     * ⭐⭐ **결정은 「표시가에 세금을 포함한다」다.** 세금 별도로 가려면 관할마다 다른 총액을
     * 우리가 화면에 세워야 하는데, 소비자 대상 **첫 화면 총액 표시**를 요구하는 관할이 여럿
     * 이라(한국·일본·호주) **틀린 총액이 곧 위법 표시**가 된다 — 법적 의무가 「영원히 맞게
     * 유지할 소프트웨어」로 바뀌는 자리다. ⇒ 포함을 유지한다.
     *
     * ⚠️⚠️ **이 줄은 세 번 뒤집혔다** — ⑴ 「포함되지 않는다」(틀렸다: 실물이 포함이었다)
     * ⑵ 「포함되거나 더해진다」 ⑶ 「더해진다」(설정을 바꿔 참으로 만들었다) ⑷ 다시 여기.
     * **근거를 적지 않으면 네 번째가 온다** — 그래서 위 문단이 있다.
     *
     * 실물: 두 가격이 `tax_behavior: **location**` 이라 처리가 구매자의 지역을 따른다
     * (실측: 한국 체크아웃 `Subtotal $15 · Taxes (included) $1.36 · Monthly $15`).
     * ⛔ **지역을 지목하지 않는다** — 비(非)VAT 지역의 화면은 **재지 않았다**. 재지 않은 것을
     * 적으면 그 문장이 다음 드리프트의 씨앗이다.
     *
     * ⚠️ **가드는 있되 반쪽이다** — `boundary.test.ts` 의 CTA 단정이 이 줄의 자구를 문다.
     * ⛔ 그러나 벤더 설정이 바뀌어도 그 단정은 **초록**이다(발행본만 보고 결제 벤더를 보지
     * 못한다). 선언과 벤더 사이는 기계가 잇지 못한다 ⇒ 설정을 바꾸는 날 **사람이** 함께 본다.
     */
    readonly tax: string;
    /**
     * 창구 화면에서 고르는 것 둘 — ⭐ **링크가 잠그지 않는다**는 사실의 산문 쪽이다(기계
     * 쪽은 구독 입구의 AC2 가 `href` 의 질의를 0 으로 센다).
     *
     * ⚠️ 이 주석이 입구의 **파일 이름**을 적지 않는 것은 취향이 아니다 — 배선 금칙이 화면
     * 코드를 **주석까지** 훑으므로, 그 단어 하나가 들어오면 이 파일이 빨갛다.
     *
     * ⚠️⚠️ **이 자리는 「스텁 고지」였고 사유가 두 번 움직인 끝에 사라졌다.** ⑴ 「결제 창구의
     * 심사가 끝나지 않아」(벤더 쪽) → ⑵ 「이 주소를 창구로 보내는 연결이 없어」(우리 쪽) →
     * ⑵ 가 `site.ts` 의 리다이렉트 선언으로 서면서 **고지가 가리킬 조건이 0** 이 됐다.
     * ⇒ 고지를 걷고 남은 **사실**만 남겼다. ⛔ 조건 없는 「아직 서지 않았다」를 두지 않는다 —
     * 그것이 금칙 다섯과 **같은 뿌리**다(상태를 말하는 척하며 결과를 흐린다).
     */
    readonly choiceNote: string;
    readonly start: string;
  };

  /**
   * 활성화 안내 — 가격 **뒤**다.
   *
   * ⭕⭕ **이 블록이 섰다.** 조건이 셋이었고 셋 다 풀렸다: ⑴ 못 산다(구독 입구가 리다이렉트
   * 선언을 지나며) ⑵ 사도 자격을 묻지 못한다(발행 조직 id 가 서면서) ⑶ 핸들을 받아 오는
   * 걸음이 없다(활성화 명령이 서면서). ⇒ **「아직 서지 않았다」의 고지를 걷었다** — 조건
   * 없는 고지를 두지 않는다는 그 규율이 마지막으로 한 일이다.
   *
   * ⚠️ **기계가 보지 못하는 칸이 하나 남는다** — 구독한 고객이 실제로 키를 받는지는 결제
   * 벤더의 설정이고, 발행본만 보는 가드는 벤더를 보지 못한다(`cta.tax` 와 **같은 반쪽**이다).
   * ⇒ 사이트가 서는 날 사람이 그 칸을 함께 본다. ⛔ 보지 못한 것을 화면에 적지 않는다.
   *
   * ⛔ **핸들 파일 · 핸들 키 · 환경변수의 이름 셋을 적지 않는다** — 판정기 모듈의
   * `ENTITLEMENT` 가 그 셋을 들고 있지만 **상류에서 결정된 적이 없고**, 발행본에 적으면
   * 미확정을 확정처럼 말한다. 가드가 그 셋을 발행본에서 **0 으로 센다**.
   */
  readonly activation: {
    readonly title: string;
    /** 모양만 — 핸들 하나를 커밋하고 키 하나를 CI 비밀에 넣는다. */
    readonly body: string;
    /**
     * 이름을 **여기 적지 않는 이유** — ⚠️ 사유가 바뀌었다.
     *
     * 전에는 「아직 정해지지 않았다」였다(⛔ 지어낸 이름을 미리 적지 않는다). 상수가
     * 서고 측정 명령이 그 셋을 **화면에 적어 주면서** 그 사유는 참이 아니게 됐다 — 이름은
     * 실물이 됐다. ⇒ 남은 사유는 **더 센 쪽**이다: 발행본에 적으면 그것이 **사본**이고,
     * 사본은 이름이 움직이는 날 명령과 갈라진다. 이 제품이 파는 결함 그대로다.
     * ⭐ 그래서 가드는 그대로 셋을 0 으로 센다 — 바뀐 것은 사유이고 분모가 아니다.
     */
    readonly naming: string;
  };

  /**
   * FAQ — 가격·활성화 **뒤**, Footer 앞.
   *
   * ⭐⭐ **정책을 답하지 않고 가리킨다.** 환불·약관·개인정보·라이선스 증서는 정본이 따로
   * 있고(푸터의 법률 컬럼), 여기서 답하면 **금칙 가드가 없는 자리에서 정책을 말하는** 것이
   * 된다 — 선언 없는 파일이 조용히 두 번째 정본이 되는 그 자리다. ⇒ 길이 규칙이 아니라
   * **소속 규칙**이고, 정책 내용은 한 줄이어도 보낸다.
   *
   * ⚠️ 그 결과 문항이 **둘**이다 — 나머지 후보 셋(결과의 행방 · 비공개 저장소 · 지금 구독
   * 가능 여부)은 원페이지의 다른 블록이 **이미 답한다**. 빈약한 것이 아니라 사본을 만들지
   * 않으면 그렇게 된다. ⛔ 수를 채우려고 문항을 늘리지 않는다.
   *
   * ⭐ 답은 **세 줄까지**다 — 넘으면 `/` 에 앉지 않는다. 가드가 발행본에서 센다.
   */
  readonly faq: {
    readonly title: string;
    /** 칼 셋 중 **안 선 둘** — 광고 자리는 선 것만 말하고, 묻는 사람에게는 여기서 답한다. */
    readonly knivesQ: string;
    /** 쥐다 — 결 ⑵: 우리 손이지만 **선행 결정 하나**가 먼저 뒤집혀야 한다. */
    readonly knivesA1: string;
    /** 승격하다 — 결 ⑶: 상류가 안개다. 조건은 **「없다」**이고, 빈 칸으로 두지 않는다. */
    readonly knivesA2: string;
    /**
     * 자격의 의미 — ⭐ 가격 블록과 **중복이 아니다**: 가격은 「얼마」를 말하고 이것은
     * 「자격이 없으면 **무엇이 달라지나**」를 말한다.
     *
     * ⭕ **판정 어휘를 여기서는 쓴다** — 주어가 판정 결과이기 때문이다. 금칙은 「우리가
     * 무엇을 출하했는가」를 말할 때이고, 그쪽은 「섰다 / 아직 서지 않았다」가 든다.
     */
    readonly freeQ: string;
    readonly freeA1: string;
    readonly freeA2: string;
    readonly freeA3: string;
  };

  /**
   * Footer — 블록 **일곱**: 브랜드 · 회사 · 제품 · 법률 · 언어 · 법정 게시 · 저작권.
   *
   * ⛔ **브랜드 블록에 태그라인이 없다** — 원페이지라 히어로 문장이 **같은 문서 안**에
   * 있고, 두 번 적으면 사본이다(형제 둘은 여러 장이라 태그라인을 둔다 — 분모가 다르다).
   *
   * ⚠️ **제품 컬럼의 링크는 실재하는 블록만 가리킨다** — 없는 블록을 가리키면 잘못 선언한
   * 것이고, 그것은 미판정이 아니라 판정 실패다(가드가 `id` 로 대조한다). ⭐ 그래서 FAQ 줄은
   * **FAQ 블록이 선 뒤에** 들어왔다 — 자구도 그 블록의 제목 키 하나를 **같이 쓴다**(링크와
   * 제목이 여기서는 같은 말이라, 두 키로 적으면 사본이다).
   */
  readonly footer: {
    readonly privacy: string;
    readonly terms: string;
    readonly refunds: string;
    readonly portal: string;
    readonly renewal: string;
    /** 정책 셋의 시행일 — ⛔ 날짜를 적지 않는다: 아직 정해지지 않았고 그 조건을 말한다. */
    readonly effective: string;
    /**
     * 시행일이 **박힌 뒤의** 같은 줄 — ⭐ 날짜를 인자로 받는다(값은 `publisher.ts` 가 들고
     * 로케일 불변이다). ⚠️ 함수 잎이라 객체를 훑는 가드에 **보이지 않는다** — 깨우는 손이
     * `i18n.test.ts` 에 있다. ⛔ 자구에 날짜를 박지 않는다: 박으면 사본이 둘이 된다.
     */
    readonly effectiveOn: (date: string) => string;
    readonly companyHeading: string;
    /** 새 창으로 열리는 링크가 **말없이** 열리지 않게 — 시각으로는 숨고 보조기술에는 들린다. */
    readonly newWindow: string;
    readonly contact: string;
    readonly productHeading: string;
    /** 가격 절로 가는 **같은 문서 안의 닻** — 별 페이지가 아니라 이 원페이지의 한 블록이다. */
    readonly pricing: string;
    /**
     * 둘째 문서로 가는 줄 — ⭐ 발견이 **sitemap 하나에 기대지 않는다**: 사람이 걸어갈 길이
     * 없으면 그 문서는 크롤러만 아는 문서가 된다.
     */
    readonly constitution: string;
    /** 둘째 문서에서 원페이지로 돌아오는 줄 — 제품 컬럼이 **문서마다 자기 블록을** 가리킨다. */
    readonly diagnosis: string;
    readonly legalHeading: string;
    readonly languagesHeading: string;
    /** 법정 게시의 **라벨**만 — 값은 `publisher.ts` 가 로케일 불변으로 든다. */
    readonly publisher: {
      readonly label: string;
      readonly company: string;
      readonly representative: string;
      readonly registration: string;
      readonly address: string;
      readonly contact: string;
      readonly mailOrderReport: string;
    };
  };
}

/**
 * 둘째 문서의 산문 — **헌법 관리**와 **관측 결과**. ⭐ 원페이지(`PageText`)와 **다른 절**인
 * 이유는 성질이 다르기 때문이다: 저쪽은 **영업 화면**이고 이쪽은 **고객이 쓰는 도구**다.
 * 한 절에 담으면 어느 자구가 어느 문서에 서는지를 타입이 말하지 못하고, 생성기의 「자리 ↔
 * 키 1:1」이 문서별로 설 수 없다(쓰이지 않는 키가 늘 생긴다).
 *
 * ⛔ **크롬의 자구는 여기 없다** — GNB · 푸터 · 법정 게시의 라벨은 `PageText` 한 벌이 들고
 * 두 문서가 **같은 크롬**을 받는다. 두 벌로 적으면 사본이고, 사본은 갈라진다.
 */
export interface ConstitutionText {
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly lede: string;

  /**
   * 헌법 관리 — 「헌법을 만든다」의 두 갈래를 **조립해 내보낸다**.
   *
   * ⛔ **쓰지 않는다 · 커밋하지 않는다** — 이 화면이 내는 것은 **문자열**이고, 파일을 쓰는
   * 것은 측정 명령의 몫이다(결정: 조립은 화면, 쓰기는 CLI). 조립기는 **같은 함수 하나**라
   * 두 입구의 산출이 바이트까지 같다.
   */
  readonly hold: {
    readonly label: string;
    readonly title: string;
    readonly body: string;
    /** ⛔ 쓰지 않는다 · 커밋하지 않는다 — 입구의 사실이라 블록 머리에 한 번 선다. */
    readonly writeNote: string;

    /**
     * 갈래 — ⭐ **입력의 모양은 하나**이고 가르는 것은 「읽은 저장소가 누구의 것인가」다.
     * 그래서 고르개 하나가 그 둘을 든다(입구를 둘로 두면 같은 입력이 두 벌이 된다).
     */
    readonly kindLabel: string;
    readonly kindCanon: string;
    readonly kindLink: string;
    /** 고른 갈래가 **무엇을 적는가** — 고르개 바로 아래에서 갈래마다 바뀐다. */
    readonly canonNote: string;
    readonly linkNote: string;

    /**
     * 공유값 축의 이름 — ⭐⭐ **한 저장소가 헌법 여럿에 답한다**(개정 4): 축마다 정본이
     * 따로 서므로 개발 헌법과 디자인 헌법이 **서로 다른 상류**에 살아도 한 선언이 둘을
     * 가리킨다. ⛔ 이름을 우리가 고르지 않는다 — 고르면 선언은 우리가 상상한 조직의 것이 된다.
     */
    readonly axisLabel: string;
    readonly axisPlaceholder: string;
    readonly axisNote: string;

    readonly repoLabel: string;
    readonly repoPlaceholder: string;
    readonly read: string;
    readonly fileLabel: string;
    readonly scopeLabel: string;
    readonly compose: string;
    readonly snippetLabel: string;
    readonly copy: string;
    /** 조각을 받은 뒤의 다음 걸음 — ⭐ 판정은 **루트의 진단**이 보여준다. */
    readonly nextNote: string;
  };

  /**
   * 조립·관측의 **결과 문구** — ⭐ 수와 사유는 판정기 모듈이 내고 문장은 여기서 짓는다
   * (고지가 사실로 내려온 그 규율). ⛔ 수를 접는 어휘 0.
   */
  /**
   * **런타임에만 서는 문구** — ⭐ 발행 시점에는 값이 없다(수와 사유를 받아 짓거나, 읽어 본
   * 뒤에야 참이 된다). 발행본에 **바이트로** 서야 하는 산문과 한 절에 두면 그 단정의 분모가
   * 흐려지므로 자리를 가른다.
   */
  readonly result: {
    /** 고를 것이 0 일 때 — 「읽을 꼴의 파일이 없다」는 참인 답이다(지어내지 않는다). */
    readonly noFiles: string;
    /** 그 파일에서 읽힌 것이 0 일 때 — 파싱 실패와 **다른 자리**다. */
    readonly noScopes: string;
    /** 스코프 한 줄 — 읽힌 수가 「어느 쪽이 공유값의 자리인가」를 말한다. */
    readonly scopeOption: (scope: string, tokens: number) => string;
    /** 조립이 박제를 **정본에서 읽었다** — 그 수. */
    /** 어느 헌법의 조립인가 — 체크 id 의 뒷칸이 이 이름이다. */
    readonly axis: (axis: string) => string;
    /** ⭐ **더한 것과 지은 것을 가른다** — 더했으면 조각은 「당신의 선언 + 축 하나」의 전문이다. */
    readonly added: string;
    readonly pinned: (count: number) => string;
    /** 이 저장소가 정본이라 박제가 0 인 자리. */
    readonly canonSelf: string;
    /** 박제하지 않은 정본 토큰 — 값이 해석되지 않는 자리. */
    readonly unpinned: (count: number) => string;
    readonly unpinnedWhy: Readonly<Record<'ambiguous-cascade' | 'var-indirection', string>>;
    /** 편입 기록이 빈 선언으로 난다 — 참인 선언이다. */
    readonly admissionsEmpty: string;
    /** 조립이 서지 않았다 — 지어낸 분모를 쓰지 않는다. */
    readonly refused: string;
    /** 격자 — 「관할 N — 위반 k · 통과 p · 미판정 m」. ⛔ 셋을 접는 수를 만들지 않는다. */
    readonly jurisdiction: (counts: {
      readonly cells: number;
      readonly violation: number;
      readonly pass: number;
      readonly unjudged: number;
    }) => string;
    /** 격자의 꼴 — 규칙 × 표면. */
    readonly shape: (rules: number, surfaces: number) => string;
    /** 칸이 0 일 때 — 빈 분모는 미판정이고, 「편입 0」은 결함이 아니다. */
    readonly emptyDenominator: string;
    /** 규칙 한 줄이 고른 판정기들. */
    readonly chose: (verifiers: string) => string;
    /** 규칙이 판정기를 고르지 않았다. */
    readonly choseNone: string;
    /**
     * 이 측정이 **함께 본** 저장소들 — 교차 축이 설 수 있었던 조건이다. ⭐ 이름은 봉투가
     * 들고 오므로, 요약으로 받은 보고도 이 줄을 **참으로** 적는다.
     */
    readonly canonRead: (repos: string) => string;
    /** 저장소 하나만 보았다 — 교차 축은 미판정이고 「위반 0」이 아니다. */
    readonly canonAbsent: string;
  };
}

export interface Strings {
  /** 이 벌이 자기를 무엇이라 말하는가 — 발행된 문서의 `lang` 과 맞는지 가드가 문다. */
  readonly locale: Locale;

  /** 발행 시점에 문서에 박히는 정적 산문 — 생성기가 읽는 유일한 산문 출처다. */
  readonly page: PageText;

  /** 둘째 문서의 산문 — 크롬은 `page` 가 들고, 이 절은 그 문서의 블록만 든다. */
  readonly constitution: ConstitutionText;

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
    /** 두 절의 머리 — ⭐ 「색이 다르다」가 아니라 **같은 칸이 아니다**를 말하는 자리다. */
    readonly measuredHeading: string;
    readonly unmeasuredHeading: string;
    /**
     * 접은 증거의 요약 줄 — ⚠️ **보인 수만** 말한다. 자른 수는 `omitted` 가 따로 말하고,
     * 둘을 한 문장에 뭉치면 「안 보이는 이유」 둘(접힘 · 잘림)이 한 수로 읽힌다.
     */
    readonly evidenceSummary: (shown: number) => string;
    /** 화면에 싣지 않은 증거 — 수(counts)는 그와 무관하게 전수다. */
    readonly omitted: (beyond: number) => string;
    readonly divergence: (evidence: DivergenceText) => string;
  };

  /**
   * 선언 0 에서도 **보이는 사실** — ⛔ 판정이 아니다.
   *
   * ⭐⭐ **머리말이 그 사실을 적는다.** 상태 없는 수를 재어진 칸 옆에 세우면 「사본 7건」이
   * 위반 7건으로 읽히고, 그 혼동이 이 제품이 파는 결함이다 — 그래서 「판정이 아니다」가
   * 문구에 **있다**: 적지 않은 수는 언제든 판정으로 읽힌다.
   *
   * ⛔ **하한의 수를 문구에 박지 않는다** — 판정기 모듈의 상수에서 받는다(`MIN_COPY_LINES`).
   * 박으면 그 수가 세는 손과 갈라지고, 갈라진 날 화면이 세지 않은 것을 셌다고 말한다.
   */
  readonly undeclared: {
    readonly heading: string;
    /** 「이것은 판정이 아니다」를 말하는 줄들. */
    readonly notice: readonly string[];
    /** 사본의 분모 — 전부 읽었을 때와 **부분 수집**일 때가 다른 문장이다. */
    readonly documentsRead: (tracked: number) => string;
    readonly documentsPartial: (tracked: number, read: number) => string;
    readonly copiesNone: (minLines: number) => string;
    readonly copies: (blocks: number) => string;
    /**
     * 갈라진 사본 — ⭐ **축자 사본과 다른 사실이라 문장이 따로다.** 앞은 「아직 같다」이고
     * 뒤는 「이미 두 말을 하고 있다」: 한 수로 접으면 요구하는 행동이 섞인다.
     */
    readonly divergedNone: string;
    readonly diverged: (pairs: number) => string;
    /**
     * 가족 하나의 머리 — 집 수 · 쌍 수 · 겹친 줄 · 갈라진 줄. ⛔ 비율을 말하지 않는다.
     * ⭐ 수는 **문자열로** 받는다 — 범위(`3–5`)인지 한 수(`3`)인지는 접는 손이 정하고,
     * 문구는 그것을 자리에 끼운다(두 로케일이 범위의 자구를 각자 짓지 않는다).
     */
    readonly divergedFamily: (homes: number, pairs: number, shared: string, differing: string) => string;
    readonly divergedOmitted: (beyond: number) => string;
    /** ⚠️ **다 보지 못했다** — 상한에 잘린 목록과 다른 사실이다(센 뒤와 세지 못한 것). */
    readonly divergedTruncated: string;
    /** 사본 한 건의 머리 — 집 수와 줄 수. */
    readonly homes: (homes: number, lines: number) => string;
    /** 상한에 잘린 사본 — 수(blocks)는 그와 무관하게 전수다. */
    readonly copiesOmitted: (beyond: number) => string;
    /** 왜 사본이 위반이 아닌가 · 왜 그래도 적는가. */
    readonly why: readonly string[];
    readonly surfacesHeading: string;
    readonly surfaceNone: (adapter: string) => string;
    readonly surfaceAll: (adapter: string, files: number) => string;
    readonly surfacePartial: (adapter: string, files: number, loaded: number) => string;
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
