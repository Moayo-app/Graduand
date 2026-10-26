# graduand verifier module (pre-public)

판정기 넷(`refs` · `ui-paths` · `palette` · `palette-cross`)과 판정 스키마 하나,
팔레트 어댑터(`css-custom-properties` — Tailwind v4 `@theme` 포함), fragment codec, CLI.
고객 CI 와 브라우저 진단 페이지가 **같은 모듈**을 import 한다 — 사본이 없다.

- 런타임 의존성 **0**. 개발에 빌드 단계 없음 — Node ≥23.6 이 타입을 지우며 소스가 그대로
  돈다(`node src/cli.ts`). ⚠️ **발행본은 다르다** — `npm run build` 가 `dist/` 로 내고
  `bin`·`exports` 가 그 산출물을 가리킨다: 발행본은 남의 기계에서 도는데, 그쪽 번들러와
  Node 가 `node_modules` 안의 `.ts` 를 받아 준다는 것은 **우리가 검증할 수 없는 선언**이다.
- 수는 3상태(통과 · 위반 · 미판정 + 사유 코드)로만 말한다. 점수·등급·백분율 API 는 없다.
- 네트워크는 `api.github.com` 하나(브라우저 로더)뿐이고, 결과를 되쏘는 경로는 없다.
- 팔레트의 교차 축(박제 == 정본)은 선언의 정본 포인터(`palette.canon`)를 따라 **다른
  체크아웃**의 정본을 읽어 판정한다 — 분모는 정본이 든 토큰이고, 박제에서 조용히 빠진
  토큰은 **위반**이다. 체크아웃이 하나뿐인 표면에서는 그 칸이 **「판정 불가」로 정직하게**
  적힌다(`single-repo-surface`) — 칸을 비우면 「위반 0」으로 읽히기 때문이다.
- 팔레트 증거는 좌표(토큰 · 파일 · 행 · 사유)뿐이다 — 고객 파일의 값·산문은 보고에 싣지 않는다.
- 편입 격자(규칙 × 표면)는 선언에서 **파생**된다 — 분모도 칸 수도 고객이 적는 자리가 없고,
  보고는 「관할 N — 위반 k · 통과 p · 미판정 m」으로만 말한다.

```
npm test          # node --test (발행본을 실제로 포장해 푸는 AC 포함)
npm run typecheck # tsc --noEmit
npm run build     # tsc → dist/ (발행본의 산출 — prepack 이 같은 것을 돌린다)
node src/cli.ts [--root <path>]... [--json | --fragment]
node src/cli.ts --help
```

`--root` 를 여러 번 주면 **한 잡에 체크아웃 N개**다 — 교차 축이 설 수 있는 유일한 표면이고,
각 체크아웃은 나머지 전부를 시야로 판정된다. 보고는 체크아웃마다 한 절 + 관할 합산 한 줄이다.

⚠️ 이 폴더는 공개 배달 저장소([Moayo-app/Graduand](https://github.com/Moayo-app/Graduand))로
옮겨질 범위다 — **공개-안전만 담는다.** 패키지명 `graduand` 는 잠정(이름 트랙 선행조건
해소 뒤 npm 발행), `private: true` 는 그때까지의 안전핀이다.

⭕ **`private` 를 걷는 시점은 하나다** — 코드 이사와 **공개 전환** 뒤다. ⛔ 지금 걷지 않는다:
걷는 순간 이 모듈은 발행 가능해지고, 발행된 판은 되돌릴 수 없다(npm 은 취소된 버전
문자열까지 영구히 막는다). 그래서 `private` 가 걷히는 PR 은 **그 둘이 끝났음을 본문으로
밝힌다** — 그 짝으로, 걷히지 않은 동안 `private: true` 가 서 있는지를 `src/package.test.ts`
가 문다. ⭐ 장기 경로는 Trusted Publishing(GitHub Actions OIDC + provenance)이고 **공개
저장소가 전제**라, 고객이 「이 모듈이 그 저장소 그 커밋에서 나왔다」를 **검증**하게 된다 —
이 제품이 파는 명제를 자기 배포에 적용하는 자리다.
