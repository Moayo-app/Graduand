# 고객 CI 의 입구

`graduand` 를 **한 줄로** 돌리는 자리 — 입구 셋이다.

⭐⭐ **변환의 손은 둘이고, 입구는 그것을 부르기만 한다** — argv 를 짓는
[`graduand-ci.sh`](graduand-ci.sh) 와 시야를 모으는 [`graduand-peers.sh`](graduand-peers.sh).
입구마다 「루트 목록 → `--root` 반복」이나 또래 clone 루프를 적으면 그 사본들은 갈라지고,
갈라진 뒤에도 각자 자기 기준으로는 옳다. 이 모듈이 재는 결함이 바로 그것이라, 그 결함을 이
모듈의 입구가 저지르지 않게 한다. 입구가 하는 일은 **환경을 채워 그 스크립트를 부르는 것**뿐이다.

| | GitHub | GitLab | 빅버킷 |
| --- | --- | --- | --- |
| 입구 | [`action.yml`](action.yml) | [`gitlab-ci.yml`](gitlab-ci.yml) | [`bitbucket-pipelines.yml`](bitbucket-pipelines.yml) |
| 고객이 드는 것 | **참조** (`uses:`) | **참조** (`include: remote:`) | ⚠️ **사본** (붙여 넣는다) |
| 판정기를 어떻게 얻는가 | Action 참조가 러너에 **이미 놓는다** | 얕은 clone 하나 (`GRADUAND_REF` 가 판을 고정한다) | 얕은 clone 하나 (같은 변수) |
| 시야를 어떻게 모으는가 | `actions/checkout` 을 여러 번 (`path:`) | `GRADUAND_PEERS` | `GRADUAND_PEERS` + **당신의 자격** |

## ⚠️ 빅버킷만 사본이 된다 — 그 사실을 먼저 적는다

GitHub 은 Action 을 참조하면 그 저장소가 러너에 놓이고, GitLab 은 `include: remote:` 로 이
저장소의 파일을 **가리킨다** — 둘 다 당신이 우리 파일의 사본을 들지 않는다. 빅버킷
Pipelines 에는 원격 include 가 없어서(재사용 단위는 Docker 이미지로 발행하는 pipe 다), 그
조각은 당신의 `bitbucket-pipelines.yml` 에 **붙여 넣는다.**

⭐ 사본은 갈라진다 — 이 제품이 파는 그 명제다. ⇒ 설계의 전부가 하나다: **사본이 되는 면적을
줄였다.** 당신이 드는 것은 ⑴ 판정기를 가져오는 clone 두 줄 ⑵ 공유 스크립트 둘을 부르는 줄,
그뿐이다. 루트 변환도 또래 루프도 그 조각에 **없다.**

⛔ **pipe(Docker 이미지)로 내지 않았다** — 레지스트리 발행이 필요하고, 우리 이미지가 당신의
CI 에서 도는 공급망 표면이 생긴다. 지금 받는 둘(토큰 0 · 남의 Action 0)의 성질과 다른 결정이다.

## GitHub

```yaml
jobs:
  graduand:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { path: app }
      # ⭐ 정본을 **같은 잡의 시야에** 넣는다 — 교차 축이 설 수 있는 유일한 모양이다.
      - uses: actions/checkout@v4
        with: { repository: acme/design-system, path: design-system }
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - uses: Moayo-app/Graduand/verifier/ci@<ref>
        with:
          roots: |
            app
            design-system
```

입력 넷 — `roots`(한 줄에 하나 · 기본 `.`) · `command`(`judge` 기본 | `rules`) ·
`format`(`report` 기본 | `json`) · `output-path`(stdout 을 담을 파일 · 비면 담지 않는다).

## GitLab

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/Moayo-app/Graduand/<ref>/verifier/ci/gitlab-ci.yml'

variables:
  GRADUAND_REF: '<ref>'
  GRADUAND_PEERS: 'design-system https://github.com/acme/design-system.git main'
  GRADUAND_ROOTS: |
    .
    design-system
```

들어오는 잡은 둘이다 — 쓸 수 있는 `graduand` 와, 늘려 쓸 수 있는 숨은 템플릿 `.graduand`
(`extends: .graduand`).

## 빅버킷

저장소 변수에 둘을 두고(`GRADUAND_REF` · `GRADUAND_ROOTS`), 조각을
[`bitbucket-pipelines.yml`](bitbucket-pipelines.yml) 에서 그대로 가져와 당신의 같은 이름
파일에 붙인다. 상류를 함께 보려면 셋째를 둔다 — `GRADUAND_PEERS`(한 줄에
`<디렉터리> <url> <ref>`).

⚠️ **빅버킷은 자기 저장소 하나만 clone 한다.** 상류를 가져오려면 자격(앱 비밀번호 · 저장소
액세스 토큰 · SSH 키)이 필요하고 ⛔ **그 자격은 당신의 것이다 — 우리는 받지 않는다.** url 에
무엇을 적을지는 당신의 CI 가 정한다. 적지 않으면 교차 축은 `single-repo-surface` 미판정으로
남는다 — 그것은 「위반 0」이 아니다.

## 읽기 전에 알아야 하는 넷

⚠️ **`roots` 는 선언이다.** 체크아웃해 둔 것이 자동으로 시야에 들지 않는다 — 적지 않은
체크아웃은 보이지 않고, 그 축은 「위반 0」이 아니라 `single-repo-surface` **미판정**이다.
⛔ 디스크를 훑어 추측하지 않는다: 추측한 분모 위의 수는 전부 거짓이다.

⚠️ **판의 고정은 당신의 선언이다.** clone 하는 두 입구(GitLab · 빅버킷)의 `GRADUAND_REF` 에
**기본값이 없고 비면 멈춘다** — `main` 을 기본으로 깔면 판정기가 당신이 모르는 사이에 바뀌고, 어제 초록이던
커밋이 오늘 빨강이 된다. 그것은 「정본과 하류가 갈라졌는가」를 파는 도구가 자기 고객에게
저지르는 바로 그 갈라짐이다. GitHub 쪽은 `@<ref>` 가 같은 자리다.
⭐ 그 두 자리는 **없앨 수 없는 사본**이라(공유 스크립트를 가져오는 줄이 공유 스크립트가 될
수는 없다) 선언하고 가드를 세웠다 — 테스트가 양쪽을 **함께** 문다(판 고정 · 얕은 clone ·
박힌 셸의 구문).

⚠️ **Node 는 당신이 세운다 — ≥23.6.** 그 판이 TypeScript 소스를 빌드 없이 그대로 도는 첫
판이고, 이 패키지는 개발 빌드가 0 이다. 입구는 Node 를 **세우지 않는다**(세우면 당신이 이미
고른 판을 말없이 덮어쓴다) — 대신 **먼저 묻고 멈춘다**: 낮으면 `exit 2` 이고 무엇을 하라고
말한다. ⛔ 돌 수 없는 것을 「위반 0」으로 넘기지 않는다.

⚠️ **종료 코드는 그대로 전달된다 — 접는 자리가 없다.**

| 코드 | 뜻 |
| --- | --- |
| 0 | 위반 0 · 넘긴 만기 0. ⭕ 미판정이 있어도 0 이다 — 미판정은 사유와 함께 보고될 뿐 빨강의 근거가 아니다. |
| 1 | 위반 ≥ 1 **또는** 만기를 넘긴 면제 ≥ 1. |
| 2 | 판정 실패 — 선언이 깨졌거나, 대상을 읽을 수 없거나, 입구가 돌 수 없다. **수를 내지 않았다.** |

`command: rules` 는 판정하지 않으므로 **1 을 내지 않는다** — 선언이 무엇을 분모로 세웠는가만
낸다(편입 규칙과 그 규칙이 고른 판정기 · 공유값 축마다의 정본 주소 · 면제와 그 만기).

## 없는 것

- ⛔ **토큰 · 시크릿 입력이 0.** 입구는 저장소에 아무것도 쓰지 않고, 판정 결과를 어디로도
  내보내지 않는다. 다른 Action 도 부르지 않는다.
- ⛔ **`--fragment` · `--open` 이 없다.** 앞은 측정 하나를 주소에 싣고 뒤는 그 주소로
  브라우저를 연다 — CI 에 브라우저가 없고, 요약의 자리는 비공개 저장소의 **사람** 입구다.
- ⛔ **점수 · 등급 · 백분율이 없다.** 수는 3상태(통과 · 위반 · 미판정 + 사유)로만 말한다.
