<!--
  라이선스 경계의 정본 — 기능 → 게이트·선언 조건 (이 저장소 이슈 #23 의 집행).
  ⭐ 이 문서와 `LICENSE` 의 Additional Use Grant 는 **같은 한 사실**에서 나온다:
  「그 기능이 선언을 요구하는가」. 두 문서가 같은 사실을 다른 말로 적으면 갈라지고,
  갈라짐은 이 제품이 파는 바로 그 결함이다. 고칠 때 둘을 **함께** 고친다.
-->

# 라이선스 경계 — 층이 아니라 기능으로 그린다

## 1. 무엇이 어디에 적혀 있는가

| 파일 | 담는 것 |
|---|---|
| [`LICENSE`](../../LICENSE) | **지금 적용되는 라이선스** — Business Source License 1.1 증서. Terms 블록(Licensor · Licensed Work · Additional Use Grant · Change Date · Change License)이 채워져 있다 |
| [`LICENSE-APACHE-2.0`](../../LICENSE-APACHE-2.0) | **Change License 의 전문** — Apache License 2.0. ⚠️ 지금 적용되는 라이선스가 아니라 **Change Date 이후에** 적용되는 라이선스다 |
| [`verifier/LICENSE`](../../verifier/LICENSE) | 위 증서와 **바이트까지 같은** 사본. 발행되는 npm 패키지가 증서를 싣기 위한 자리다 (§5) |
| [`verifier/package.json`](../../verifier/package.json) 의 `license` | `SEE LICENSE IN LICENSE` — ⛔ SPDX 식으로 적을 수 없다 (§4) |

## 2. ⭐⭐ 기능 → 게이트·선언 조건

**가르는 사실은 하나다 — 그 기능이 「선언」을 요구하는가.** 그 하나에서 표의 모든 칸과
증서의 Additional Use Grant 가 함께 나온다.

| 기능 | 코드의 자리 | 선언을 요구하는가 | 자격을 요구하는가 | Grant 가 덮는가 |
|---|---|---|---|---|
| **참조 판정** (`refs`) | `verifier/src/judge.ts:75` · `verifier/src/verifiers/refs.ts:138` | ⛔ **아니다** — 런너가 받는 것이 `{ snapshot, index }` 뿐이고 판정 함수의 인자에 선언이 **없다** | ⛔ 아니다 | ⭕ **덮는다** |
| **편입** (`admissions`) | `verifier/src/declaration.ts:94` | ⭕ 선언의 최상위 키다 — 편입 기록이 **분모 자체**다 | ⭕ | ⛔ |
| **편입 격자** | `verifier/src/grid.ts:127` · 셈은 `:67` | ⭕ 행은 편입·면제, 열은 선언된 UI — **분모가 선언이다** | ⭕ (수를 내는 것만 — 칸 구성은 자격 없이도 보인다) | ⛔ |
| **면제** (`exemptions`) | `verifier/src/declaration.ts:96` · 만기는 `verifier/src/expiry.ts:107` | ⭕ 선언의 최상위 키다 | ⭕ | ⛔ |
| 팔레트 (`palette` · `palette-cross`) | `verifier/src/judge.ts:73`·`:74` · `verifier/src/verifiers/palette.ts:129` | ⭕ 선언이 없거나 `palette` 키가 없으면 **`no-declaration` 미판정**이다 | ⭕ | ⛔ |
| UI 경로 (`ui-paths`) | `verifier/src/judge.ts:76` · `verifier/src/verifiers/ui-paths.ts:39` | ⭕ 선언이 없거나 `ui` 키가 없으면 **`no-declaration` 미판정**이다 | ⭕ | ⛔ |

⇒ 「`refs` 가 무료다」의 뜻은 **「그 파일이 무료 층이다」가 아니라 「선언 0 으로도 수가
나온다」**다. 그리고 유료 쪽으로 이름이 불린 셋(편입 · 격자 · 면제)은 **선언 자신의
기능**이라, 「선언을 요구하는가」 한 줄이 그 셋을 그대로 고른다.

⚠️ 아래 셋(팔레트 · UI 경로)은 상류의 결의가 **이름으로 부르지 않았다.** 표에 넣은 근거는
**측정**이다 — 선언이 없으면 수를 내지 않는다(위 자리들). ⇒ 「선언을 요구하는가」에 ⭕ 이고,
Grant 는 그 조건으로 쓰여 있으므로 이 셋은 Grant 밖이다. ⭕ **이름으로 부른 적 없는 것을
표가 조용히 유료로 만들지 않는다** — 재어서 그 칸에 들어왔다는 사실을 여기 적어 둔다.

## 3. ⭐⭐ 「어느 파일이 어느 층인가」는 물을 수 없는 질문이다

⛔ **파일 머리 층 표기 없음 · 디렉터리 분할 없음.** 무료/유료는 파일의 성질이 아니라
**게이트와 선언의 성질**이기 때문이다. 코드에서 읽히는 것은 **게이트 한 자리**다:

- `verifier/src/entitlement.ts:196` — `entitlementGate` 는 **`state:'absent'` 하나에서만**
  걸린다. `undefined`(묻지 않은 표면)·`unwired`·`entitled` 는 통과한다.
- `verifier/src/judge.ts:106` — 그 게이트를 부르는 자리가 **하나**다.
- `verifier/src/judge.ts:86` — 게이트가 열리면 `VERIFIER_IDS` **전부**가 돈다. ⇒ `refs` 와
  `palette` 를 **가르는 코드가 없다.**

⚠️ **그래서 게이트는 기능별이 아니라 표면별이다** — 자격을 싣고 그 자격이 `absent` 인
표면에서는 `refs` 까지 미판정이 된다(`verifier/src/judge.ts:126`). ⇒ **증서는 코드보다 넓게
허락한다**: Grant 는 참조 판정의 production use 를 주는데, 코드의 게이트는 그 표면에서
참조 판정도 내주지 않는다. 틀리는 방향이 **고객에게 안전한 쪽**이라 이대로 두되, 좁히거나
넓힐지는 결정 사항이고 여기서 정하지 않는다 (§6).

## 4. ⛔ SPDX 로는 이 경계를 적을 수 없다

SPDX 식은 「이 패키지는 A」 또는 「A OR B」만 말한다 — 「이 **기능**은 A, 저 기능은 B」를 말할
문법이 없다. 파일 단위 분할도 기각됐으므로 파일별 표기도 쓸 수 없다. ⇒ `license` 를
**파일로 보낸다**: `"license": "SEE LICENSE IN LICENSE"`. 그것으로 「`UNLICENSED` 가
아니다」는 충족되고, 「어느 기능이 어느 조건인가」는 이 문서가 받는다.

## 5. 증서가 발행본에 실린다 — 재서 확인했다

BSL 1.1 축자: 「You must conspicuously display this License on **each original or modified
copy** of the Licensed Work.」 ⇒ 발행되는 npm 패키지도 그 copy 다.

⭕ **측정** (2026-10-26 · npm 11.19.0 · node v24.20.0): `verifier/` 에 `LICENSE` 를 두고
`npm pack --dry-run` 을 돌리면, `files` 가 그 이름을 **적지 않아도** 타르볼에 들어온다
(`npm notice 5.4kB LICENSE`). 표준 이름이라 npm 이 자동으로 싣는다.

⇒ 그래도 **`files` 에 적는다.** 이 저장소의 규율이 「선언이 실물과 1:1」이고, 적지 않으면
발행본이 증서를 싣는 근거가 **저장소 어디에도 선언되지 않은 도구 기본값**이 된다. 그리고
`verifier/src/package.test.ts` 의 「발행 AC1」이 타르볼의 파일 목록을 **전수로** 단정하므로,
증서가 빠지면 그 테스트가 빨갛다 — 실리는지를 **묻는 자리**가 그것이다.

⚠️ **사본이 하나 생긴다**(`LICENSE` ↔ `verifier/LICENSE`). 사본은 갈라지므로 그 갈라짐을
**가드가 묻는다**: `tools/test/license-copy.test.mjs` 가 두 파일의 바이트 동일성을 단정한다.
⭐ Change Date 는 **발행마다** 다시 박히므로, 한쪽만 박고 넘어가는 그 실수가 정확히 이
가드의 표적이다.

## 6. ⚠️ 미결 — 사람이 채울 자리를 한 자리에 모은다

⛔ 아래 값들은 **지어내지 않았다.** 빈 채로 두고 여기 모아 둔다.

| 미결 | 왜 비어 있는가 | 채워지는 자리 |
|---|---|---|
| **Change Date** | 값이 「그 판의 발행일 + 4년」이고 실모듈은 **발행된 적이 없다**(`private: true` · `0.1.0`). ⛔ 예정일을 적으면 「정해진 날짜」로 읽힌다 — 미판정을 통과로 그리는 그 모양이다 | 증서의 그 칸은 `UNSET` 로 **greppable** 하게 두었다. 발행 절차의 다섯째 항이 판마다 이 칸을 박는다 |
| **상업 라이선스 문의 창구** | BSL Terms 가 「you must purchase a commercial license from the Licensor」를 말하는데, 이 저장소가 아는 연락처가 **없다**(처리방침의 문의 칸도 「도메인이 확정되는 날 적습니다」다) | 증서의 선택 항목(「For information about alternative licensing arrangements…」)을 **넣지 않았다**. 도메인이 서는 날 한 줄로 들어간다 |
| **Licensed Work 의 바깥** | 증서가 이름으로 부른 것은 제품 코드(`verifier/` · `diagnosis/`)다. 이 저장소의 운영 파일(`tools/` · `config/` · `docs/` · `.github/`)은 **어느 라이선스도 받지 않았다** | 결정이 서면 그 파일이 이 표를 받는다 |
| **게이트와 Grant 의 비대칭** | §3 의 ⚠️ — 증서가 코드보다 넓게 허락한다 | 좁히면 코드, 넓히면 문면이다. 어느 쪽인지는 결정 사항이다 |

## 7. 증서의 출처 — 축자와 확인일

⭕ **1차 사료 둘을 각각 읽었다** (확인일 2026-10-26):

- `https://spdx.org/licenses/BUSL-1.1.html` — `LICENSE` 의 라이선스 본문(제목 · 저작권 줄 ·
  Terms · Covenants of Licensor)은 **이 판에서 그대로 떠온 바이트**다.
- `https://mariadb.com/bsl11/` — Terms 와 Covenants 가 **낱말까지 같다.** ⚠️ 다른 곳이
  **한 줄** 있다: 저작권·상표 표시가 이 판에서는 「copyright © 2024 MariaDB plc … trademark
  of MariaDB plc」이고 SPDX 판에서는 「© 2017 MariaDB Corporation Ab … MariaDB Corporation
  Ab」다. ⇒ 한 판에서 통째로 떠오고(섞으면 그것이 사본의 갈라짐이다) 그 차이를 여기 적는다.

⚠️ **Terms 블록(Parameters)의 모양은 두 원부에 없다** — 원부가 싣는 것은 라이선스 본문과
Covenants 뿐이다. 다섯 칸의 이름은 본문과 Covenants 가 **요구하는** 것이고(「the Licensor
may make an Additional Use Grant, **above**」), 그 블록의 배치는 우리가 쓴 것이다.

⚠️ **적격성 근거 하나가 2차 증거다.** Covenant 1 은 Change License 가 「GPL Version 2.0 or
any later version, 또는 GPL Version 2.0 **or a later version** 과 호환되는」 라이선스일 것을
요구한다(축자, 원부 둘 일치). Apache-2.0 이 GPLv3 과 호환된다는 것은 **Apache 재단 자신의
서술**로만 확인했고 FSF 원문은 읽지 못했다(HTTP 429). ⇒ 이 고리에 하중을 걸지 않는다.
하중이 걸리면 법무 확인이 선행이고, ⛔ 이 문서는 법률 자문이 아니다 — 정하는 것은
**무엇을 어디에 적는가**다.

⭕ 그리고 판마다 다시 박는 집행은 **증서 자신이 명시로 허용한다**(축자, 원부 둘 일치):
「This License applies separately for each version of the Licensed Work and the **Change Date
may vary for each version** of the Licensed Work released by Licensor.」
