/**
 * ko — **정본**이다. 문구를 바꾸는 순서가 하나다: 여기를 고치고, 타입이 가리키는 번역
 * 자리를 고친다.
 *
 * ⭐ 이 파일이 **한글이 사는 유일한 화면 코드**다 — 「하드코딩 한글 0」 가드의 분모에서
 * 사유와 함께 빠지는 한 자리이고, 빠지는 범위가 이 파일 하나다(`i18n.test.ts`). 문구가
 * 코드에 박히면 번역 한 벌이 **조용히 옛 문구를 들고** 남는데, 그 갈라짐은 화면에 아무
 * 표시도 남기지 않는다.
 *
 * ⚠️ 여기 있는 자구는 **옮겨 온 것**이고 새로 쓴 것이 아니다 — 카탈로그로 옮기면서 문구가
 * 함께 움직이면 「옮겼다」와 「고쳤다」가 한 커밋에서 섞여 무엇이 바뀐지 읽을 수 없다.
 */

import { ENTITLEMENT } from '../../verifier/src/index.ts';
import type { EntitlementDetail } from '../../verifier/src/index.ts';
import type { Strings } from './strings.ts';

/**
 * 사유마다 **요구하는 행동** 하나 — 사유 코드가 둘인 이유가 이 문장들이다(「사라」와
 * 「네트워크를 열어라」). ⭐ 파일 이름·환경변수 이름은 **판정기 상수에서 값으로** 온다:
 * 여기 자구로 베끼면 상류가 이름을 바꾼 날 화면만 옛 이름을 들고 남는다.
 */
const ACTION: Readonly<Record<EntitlementDetail, string>> = {
  'not-configured': `자격이 설정되지 않았다 — 하나 사서 핸들을 ${ENTITLEMENT.file} 에 커밋하고, 키를 ${ENTITLEMENT.keyEnv} 에 둔다.`,
  'vendor-said-no': `벤더가 답했다: 이 키는 이 활성화에 유효하지 않다 — 사거나 갱신한 뒤 ${ENTITLEMENT.file} 을 고친다.`,
  'past-expiry': '이 자격은 만기를 넘겼다 — 전환하면 수가 다시 나온다.',
  'handle-absent': `${ENTITLEMENT.keyEnv} 는 있는데 ${ENTITLEMENT.file} 이 없다 — 활성화한 뒤 받은 핸들을 커밋한다.`,
  'handle-unreadable': `${ENTITLEMENT.file} 을 읽지 못했다 — 그 파일의 키는 "${ENTITLEMENT.handleKey}" 하나다.`,
  'key-absent': `${ENTITLEMENT.file} 은 커밋돼 있는데 ${ENTITLEMENT.keyEnv} 가 이 환경에 없다 — 이 작업의 비밀에 키를 둔다.`,
  'vendor-unconfigured': '이 판의 판정기에는 발행 조직 id 가 아직 없다 — 물을 길이 없었고, 그것은 고객 탓이 아니다.',
  'no-answer': '벤더가 답하지 않았다 — 이 작업의 네트워크를 열거나, 네트워크가 돌아온 뒤 다시 돌린다.',
  'answer-unreadable': '벤더가 이 판정기는 모르는 모양으로 답했다 — 모르는 답은 「없다」가 아니다.',
};

export const ko: Strings = {
  locale: 'ko',

  status: {
    pass: '통과',
    violation: '위반',
    unjudged: '미판정',
  },

  reason: {
    'no-declaration':
      '사유 no-declaration — 판정의 분모가 선언되지 않았다. 선언 부재는 위반도 통과도 아니다.',
    'collection-truncated':
      '사유 collection-truncated — 입력을 전부 읽지 못했다. 잘린 수집 위에서는 수를 내지 않는다.',
    'no-adapter':
      '사유 no-adapter — 어댑터 선언이 없어 코드를 읽지 않았다. 선언이 든 박제가 분모로 남지만 「코드 == 박제」는 묻지 못한다.',
    'single-repo-surface':
      '사유 single-repo-surface — 「박제 == 정본」은 저장소 전부가 보이는 표면의 몫이다. 이 표면은 저장소 하나만 보므로 판정하지 않는다.',
    'no-verifier':
      '사유 no-verifier — 규칙은 편입됐지만 그 칸을 볼 판정기가 선언되지 않았다. 실행할 수 없는 규칙은 「위반 0」이 아니라 판정 실행 불가다.',
    'declared-divergence':
      '사유 declared-divergence — 이 값의 정본이 여기라고 사유를 달아 선언했다. 「박제 == 정본」에서만 빠지고 「코드 == 박제」는 그대로 판정된다.',
    'declared-exemption':
      '사유 declared-exemption — 이 규칙을 적용하지 않기로 사유와 만기를 달아 선언했다. 칸은 남고 분모는 줄지 않는다.',
    'no-entitlement':
      '사유 no-entitlement — 자격이 없다. 분모(칸의 구성)는 그대로 보이고 수만 나오지 않는다.',
    'entitlement-unverifiable':
      '사유 entitlement-unverifiable — 자격을 확인하지 못했다(답을 받지 못했다). 「자격 없음」과 같은 칸이 아니다.',
  },

  report: {
    title: '판정 보고서',
    label: {
      repo: '저장소',
      commit: '커밋',
      source: '입력 출처',
      measuredAt: '측정 시각',
      verifier: '판정기',
    },
    repoUnknown: '(저장소 이름을 읽지 못함)',
    source: (origin, source) =>
      origin === 'url'
        ? `공개 저장소 URL — 이 브라우저가 api.github.com 에서 직접 읽음 (${source})`
        : `URL fragment — 저장소 쪽에서 측정해 가져온 요약 (${source})`,
    dirtyUnknown: '미커밋 변경 수를 읽지 못했다 — 「모름」은 0 이 아니다.',
    dirty: (files) => `미커밋 변경 파일 ${files}개 — 아래 수는 위 커밋에 정확히 대응하지 않는다.`,
    fragmentNotice:
      '이 주소(fragment)에는 저장소 이름과 판정 결과가 들어 있다 — 주소를 공유하면 그것들이 함께 간다.',
    scope: (notations) => [
      `refs 가 보는 표기: ${notations}`,
      '이 열거 밖의 표기와 읽지 못한 입력은 「위반 0」이 아니라 미판정이다.',
    ],
    totals: ({ checks, violations, passes, unjudged }) =>
      `체크 ${checks} — 위반 ${violations} · 통과 ${passes} · 미판정 ${unjudged}`,
    omitted: (beyond) => `… 외 ${beyond}건 — 위의 수(counts)는 전수다.`,
    divergence: ({ token, reason, at }) =>
      `${token} — 선언된 갈라짐: ${reason}${at === null ? '' : ` (${at})`}`,
  },

  screen: {
    commandCaption:
      '저장소 루트에서 실행하면 판정이 그 기계에서 돌고, 결과 요약만 이 페이지 주소의 fragment 로 열린다 — 코드도 토큰도 어디로도 가지 않는다.',

    privateOrMissing: {
      title: '판정 불가 — 무인증으로 읽을 수 없는 주소다',
      lines: [
        '비공개 저장소이거나, 존재하지 않는다 — 무인증 GitHub API 는 둘을 구분해 주지 않고, 이 페이지는 구분하는 척하지 않는다.',
        '읽을 수 없음은 「위반 0」이 아니다 — 수를 내지 않았다.',
        '비공개 저장소의 판정은 저장소가 있는 쪽에서 돈다. 여기에 PAT(토큰) 입력 칸이 없는 것은 빠뜨린 게 아니라 설계다.',
      ],
    },

    truncated: {
      title: '판정 불가 — API 가 파일 목록을 잘랐다',
      lines: [
        '저장소가 커서 무인증 API 표면으로는 전체 파일 목록을 받을 수 없다. 잘린 목록 위의 판정은 거짓이 되므로 수를 내지 않는다.',
        '저장소 쪽에서 도는 명령은 이 제한과 무관하다.',
      ],
    },

    rateLimited: (wait) => ({
      title: '판정 불가 — GitHub API 무인증 한도에 걸렸다',
      lines: [
        '이 네트워크의 무인증 호출 한도가 소진됐다 — 한도는 GitHub 가 IP 단위로 센다.',
        wait,
        '기다리지 않는 길도 있다 — 저장소 쪽에서 도는 명령은 이 한도와 무관하다.',
      ],
    }),
    waitUnknown: '응답이 리셋 시각을 말하지 않았다 — 잠시 뒤 다시 시도하라.',
    wait: (minutes, resetAt) => `한도는 약 ${minutes}분 뒤 풀린다 (${resetAt} 기준).`,

    versionMismatch: (axis, found) => ({
      title: '판정 불가 — 이 페이지가 모르는 보고서 판이다',
      lines: [
        `주소의 요약이 ${axis} 버전 「${found}」 로 만들어졌는데, 이 페이지는 그 판을 모른다.`,
        '모르는 판을 조용히 해석하면 거짓 보고서가 된다 — 그래서 여기서 멈춘다.',
        '페이지를 새로고침해 최신 판으로 다시 열거나, 측정한 쪽의 판정기를 최신으로 올려 주소를 다시 만든다.',
      ],
    }),
    axis: { fragment: 'fragment', schema: '스키마' },

    fragmentUnreadable: {
      title: '판정 불가 — 주소의 요약이 손상됐다',
      lines: [
        '요약의 자기검증(길이·체크섬)이 맞지 않는다 — 옮기는 과정 어딘가에서 주소가 잘렸거나 변형됐다.',
        '잘린 요약을 그대로 그리면 거짓 보고서가 된다 — 그래서 그리지 않는다. 측정한 쪽에서 주소를 다시 만들어 통째로 옮겨라.',
      ],
    },

    declarationInvalid: (problems) => ({
      title: '판정 실패 — graduand.json 이 깨졌다',
      lines: [
        '선언이 깨지면 미판정으로 접지 않고 여기서 요란하게 멈춘다 — 조용히 넘어간 오타는 「통과」로 둔갑한다.',
        ...problems.map((problem) => `· ${problem}`),
        '선언을 고치면 바로 다시 돈다.',
      ],
    }),

    error: (message) => ({
      title: '진단이 끝나지 못했다',
      lines: [
        message,
        '네트워크가 끊겼거나 GitHub API 가 예상 밖 응답을 냈다. 수를 내지 않았다 — 다시 시도하라.',
      ],
    }),
  },

  entitlement: {
    unwired: [
      '자격을 묻지 않았다 — 이 판의 판정기에는 발행 조직 id 가 아직 없다.',
      '막은 것은 아무것도 없다. 아래 수는 자격을 증명하라는 요구를 받은 적이 없다.',
    ],
    absent: (reason, detail) => [
      `미판정 (${reason}) — 빨강이 아니고, 위반 수도 아니다.`,
      ACTION[detail],
      '아래 칸은 분모를 그대로 보인다 — 없는 것은 수이고, 칸의 구성이 아니다.',
    ],
    expires: ({ expires, daysLeft, onDate }, convertPath) => [
      `${onDate} (UTC) 기준 — 자격의 만기는 ${expires} 이고 ${daysLeft}일 남았다.`,
      `그 전에 이 도구 안에서 전환한다: ${convertPath}`,
    ],
    expired: ({ expires, daysLeft, onDate }, convertPath) => [
      `${onDate} (UTC) 기준 — 자격은 ${expires} 에 끝났고 ${-daysLeft}일이 지났다.`,
      `이 도구 안에서 전환하면 수가 다시 나온다: ${convertPath}`,
    ],
  },

  entry: {
    unreadableInput: '읽을 수 있는 형태가 아니다 — owner/name 또는 github.com 저장소 주소를 받는다.',
    running: '진단 중 — 이 브라우저가 api.github.com 에서 직접 읽는 중이다.',
  },

  scaffold: {
    copied: (file) => `복사했다 — 저장소 루트에 ${file} 로 저장하면 된다.`,
    copyFailed: '클립보드에 쓰지 못했다 — 위 조각을 직접 선택해 복사하라.',
  },
};
