<!--
  저장소 간 정본 선언표 — 가드 명세의 정본은 **비공개 상류**가 갖는다. 포인터만 둔다.
  코드는 저장소를 가로질러 재사용하지 않는다 — 빌리는 것은 문제 정의다:
  「이것이 없으면 제외 목록은 조용히 두 번째 정본이 된다.」
  아래 표는 가드(tools/test/policy-guards.test.mjs)가 기계로 읽는다 — 열 구성을 바꾸면 가드가 운다.
-->

# 정본 선언표 — 어느 문서가 어느 저장소의 정본인가

이 저장소의 정책 표면이 쥐고 있는 정본과, 빌려 쓰되 **사본을 만들지 않는** 바깥 정본을 한 표로
선언합니다. 여기 선언되지 않은 정책 파일이 이 저장소에 생기면 가드가 막습니다 — 선언 없는 파일은
조용히 두 번째 정본이 되기 때문입니다.

| 문서 | 정본 저장소 | 정본 경로 |
|---|---|---|
| 서비스 이용약관 (ko 정본) | Moayo-app/Graduand | docs/policies/terms.md |
| 환불 정책 (ko 정본) | Moayo-app/Graduand | docs/policies/refund.md |
| 개인정보 처리방침 (ko 정본) | Moayo-app/Graduand | docs/policies/privacy.md |
| 정책 문서 번역판 (en) | Moayo-app/Graduand | docs/policies/locales/en/ |
| 개방 목록 (출시 국가·문서 로케일 분모) | Moayo-app/Graduand | config/allowed-countries.yml |
| 정책 금칙·필수 문자열 | Moayo-app/Graduand | config/policy-strings.yml |
| 이 선언표 | Moayo-app/Graduand | docs/policies/canon.md |
| 자매 제품(Re:Stance)의 정책 문서와 가드 | Moayo-app/Re-Stance | docs/policies/ |
| 결정의 근거·조문 측정 (컴플라이언스) | **비공개 상류** | 이 저장소는 포인터만 둔다 — 이름도 적지 않는다 |

## 규율

- **구조만 상속하고 본문은 공유하지 않는다.** 자매 제품의 정책 문서는 제품명·회사 몫·조문이
  그 제품의 것이라, 본문을 베끼는 순간 두 저장소 중 하나는 거짓을 게시하게 됩니다.
- **바깥 정본을 이 저장소에 복제하지 않는다.** 필요한 것은 포인터로 가리킵니다 — 사본은 갈라지고,
  갈라진 뒤에도 둘 다 자기 기준으로는 옳기 때문입니다.
- **이 표의 Graduand 행은 실재와 1:1 이다.** 행이 가리키는 경로가 없거나, 표에 없는 정책 파일이
  저장소에 있으면 가드가 빨갛습니다.
