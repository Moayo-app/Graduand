# Graduand

> ⭕ 이름은 **확정됐다**(2026-10-27) — 표기 = 식별자 = `graduand`. ⚠️ 그것을 지탱하는 것은
> 상표 **출원** 2건이고, **출원은 등록이 아니다** — 심사가 열려 있다.

규칙을 코드로 쥐고, 에이전트가 낸 일을 그 규칙으로 판정한다. 판정은 **고객의 CI 에서** 돈다 —
호스팅 SaaS 가 아니고, 우리 인프라는 고객 저장소를 읽지 않는다.

이 저장소가 담는 것: **판정기 · 어댑터 · 진단 페이지 소스 · 사이트 배선 · 저장소 운영 ·
정책 문서 · 증서 전문.** 이 목록이 범위의 정의다 — 어느 경로가 어느 묶음인지는 산문이 아니라
[`config/public-scope.yml`](config/public-scope.yml) 의 **행**이 갖는다.

오늘 상태 (2026-10-27): **정책 문서 6벌**(약관·환불·개인정보 × ko·en, **판 1.0.0** —
[docs/policies/](docs/policies/))과 그 가드가 서 있고, 빌드가 그것을 HTML 로 낸다. 판정기와
진단 페이지의 소스가 들어왔고, 사이트가 서는 자리의 선언([`wrangler.jsonc`](wrangler.jsonc))도
여기 있다. ⬜ 사이트는 **아직 공개되지 않았다** — 도메인이 붙지 않았고, 그 부착이
곧 공개 전환이다. 측정 명령은 `npm test` 이고, 세션 부트스트랩은 [CLAUDE.md](CLAUDE.md).

## 라이선스

이 저장소는 **한 벌의 허가로 덮이지 않습니다** — 성질이 다른 넷이 한 트리에 삽니다.

| 묶음 | 허가 |
|---|---|
| 판정기 · 진단 페이지 (파는 제품) | **BSL 1.1** — [`LICENSE`](LICENSE) · 무료 범위는 Additional Use Grant 에 **기능으로** ([경계](docs/licensing/feature-boundary.md)) · Change License = Apache-2.0 |
| 가드 · CI · 선언 · 입구 산문 (저장소 운영) | **Apache-2.0** — [`LICENSE-APACHE-2.0`](LICENSE-APACHE-2.0) |
| 약관 · 환불 · 개인정보 ([docs/policies/](docs/policies/)) | **all rights reserved** — 읽히기 위해 공개하고, 재사용 허가는 두지 않습니다 |
| 두 증서의 전문 자체 | 각자의 저작권자(MariaDB · ASF) 조건대로 |

⚠️ **어느 경로에 무엇이 붙는지의 정본은 산문이 아니라 선언입니다** —
[`config/public-scope.yml`](config/public-scope.yml) 의 `license` 축이 **행마다** 적고, 그
값이 빠진 행은 가드가 막습니다(침묵의 기본값은 all rights reserved 이고, 그 뜻은 「아직 안
정했다」가 아니라 「베껴 쓸 수 없다」입니다). 묶음마다의 **사유**는
[docs/licensing/repository-licensing.md](docs/licensing/repository-licensing.md) 가 갖습니다.
