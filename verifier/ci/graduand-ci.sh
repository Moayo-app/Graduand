#!/bin/sh
# argv 를 짓는 **하나의 손** — 고객 CI 의 두 입구가 이것을 부른다.
#
# ⭐⭐ 왜 스크립트가 따로 서는가. 입구가 둘이다(GitHub 재사용 Action · GitLab include).
# 둘이 각자 「루트 목록 → `--root` 반복」을 적으면 그 둘은 갈라지고, 갈라진 뒤에도 둘 다
# 자기 기준으로는 옳다 — 이 모듈이 재는 그 결함을 이 모듈의 입구가 저지르는 자리다.
# ⇒ 변환을 여기 한 벌 두고 두 입구는 **환경을 채워 이것을 부른다.**
#
# ⛔ 이 스크립트는 판정하지 않는다 — 판정은 CLI 가 한다. 여기 있는 것은 ⑴ 환경 → argv
#    ⑵ 돌 수 있는지 먼저 묻기, 둘뿐이다. 그래서 판정의 규율(3상태 · 종료 코드의 근거)이
#    한 자리에 남는다: 종료 코드를 **그대로 전달한다**(0 통과 · 1 위반 또는 넘긴 만기 ·
#    2 판정 실패). ⛔ 어느 코드도 접지 않는다 — 접는 입구는 거짓 초록의 생산 공정이다.
#
# 환경:
#   GRADUAND_ROOTS    체크아웃 경로 — **한 줄에 하나.** 안 주면 `.` 하나다.
#                     ⚠️ 주고서 비우면 **멈춘다**: 「루트를 줬는데 비었다」를 조용히 `.`
#                     하나로 접으면 N 개를 보라고 설정한 잡이 한 개만 보고 초록이 된다.
#   GRADUAND_COMMAND  judge (기본) | rules
#   GRADUAND_FORMAT   report (기본) | json
#   GRADUAND_OUTPUT   stdout 을 함께 담을 파일. 비면 담지 않는다.
#   GRADUAND_SRC      판정기 패키지 경로. 기본은 이 스크립트의 **부모**다.
#   GRADUAND_NODE     node 실행 파일. 기본 `node`.
#   GRADUAND_DRY_RUN  1 이면 argv 를 한 줄에 하나씩 찍고 **돌리지 않는다**(시험용 입구).
#
# ⛔ `--fragment`·`--open` 을 내보내지 않는다 — 앞은 측정 하나를 주소에 싣고 뒤는 그 주소로
#    브라우저를 연다. CI 에는 브라우저가 없고, 요약의 자리는 비공개 저장소의 **사람** 입구다.
set -eu

die() {
  for line in "$@"; do printf '%s\n' "$line" >&2; done
  # 2 = 판정 실패 — **수를 내지 않았다.** ⛔ 1 이 아니다: 그 자리는 「위반 ≥ 1」의 몫이고,
  # 돌지 못한 것을 위반으로 세면 「돌 수 없다」가 「규칙을 깼다」로 둔갑한다.
  exit 2
}

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
src=${GRADUAND_SRC:-$(CDPATH= cd -- "$here/.." && pwd)}
cli="$src/src/cli.ts"
[ -f "$cli" ] || die \
  "graduand: 판정기를 찾지 못했다 — $cli" \
  "  GRADUAND_SRC 는 판정기 패키지(package.json 이 있는 폴더)를 가리켜야 한다." \
  "  지금 값: ${GRADUAND_SRC:-"(미설정 — 이 스크립트의 부모로 추정했다)"}"

command=${GRADUAND_COMMAND:-judge}
case "$command" in
  judge | rules) ;;
  *) die "graduand: 모르는 command — '$command'. 받는 것은 judge · rules 둘이다." ;;
esac

format=${GRADUAND_FORMAT:-report}
case "$format" in
  report | json) ;;
  *)
    die \
      "graduand: 모르는 format — '$format'. 받는 것은 report · json 둘이다." \
      "  ⛔ fragment · open 은 이 입구에 없다 — 측정 하나를 싣는 플래그이고, CI 에는 브라우저가 없다."
    ;;
esac

# ⭐ argv 를 **위치 인자로** 짓는다 — 문자열에 모아 다시 쪼개면 공백이 든 경로가 둘로
#    갈라지고, 그 갈라짐은 「선언한 루트」와 「판정한 루트」가 다른 채 초록이 되는 자리다.
set --
# 하위 명령은 **첫 자리에만** 온다 — CLI 가 그 자리를 집행한다(뒤에 붙은 이름은 오류다).
if [ "$command" = rules ]; then
  set -- rules
fi

roots=${GRADUAND_ROOTS-.}
# 「주지 않았다」와 「주고서 비웠다」를 가른다 — 앞은 기본값의 자리, 뒤는 오류다.
if [ -n "${GRADUAND_ROOTS+set}" ] && [ -z "$(printf '%s' "$roots" | tr -d '[:space:]')" ]; then
  die \
    "graduand: GRADUAND_ROOTS 가 비었다 — 조용히 '.' 하나로 접지 않는다." \
    "  루트를 N 개 보라고 설정한 잡이 하나만 보고 초록이 되는 자리다." \
    "  ⇒ 한 줄에 경로 하나를 적거나, 변수를 아예 주지 않아라(기본은 '.' 하나다)."
fi

# 줄 단위로만 쪼갠다 — 경로에 공백이 들 수 있고, 한 줄에 하나가 이 입구의 선언 모양이다.
count=0
old_ifs=$IFS
IFS='
'
for root in $roots; do
  root=$(printf '%s' "$root" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  [ -n "$root" ] || continue
  set -- "$@" --root "$root"
  count=$((count + 1))
done
IFS=$old_ifs
[ "$count" -gt 0 ] || die "graduand: 쪼갠 뒤 남은 루트가 0 이다 — GRADUAND_ROOTS 에 공백뿐인 줄만 있었다."

if [ "$format" = json ]; then
  set -- "$@" --json
fi

# 시험용 입구 — ⭐ 두 입구가 **같은 argv** 를 짓는지 묻는 자리다. 그 질문에 답이 없으면
# 「손이 하나다」는 산문일 뿐이고, 산문은 갈라져도 초록이다.
if [ "${GRADUAND_DRY_RUN:-}" = 1 ]; then
  for arg in "$@"; do printf '%s\n' "$arg"; done
  exit 0
fi

node_bin=${GRADUAND_NODE:-node}
command -v "$node_bin" >/dev/null 2>&1 || die \
  "graduand: node 가 없다 — '$node_bin'" \
  "  판정기는 런타임 의존이 0 이지만 **Node 는 필요하다**(타입을 지우며 소스를 그대로 돈다)." \
  "  GitHub: actions/setup-node 로 node-version 24 를 먼저 세워라."

# ⚠️ **먼저 묻고 멈춘다.** Node ≥23.6 이 `.ts` 를 그대로 도는 첫 판이고, 그 아래에서는
#    CLI 가 구문 오류로 죽는다 — 그 죽음은 「판정기가 깨졌다」로 읽혀 고객이 우리를 의심하는
#    자리다. ⛔ 돌 수 없는 것을 「위반 0」으로 넘기지도 않는다(exit 2 — 수를 내지 않았다).
node_version=$("$node_bin" --version 2>/dev/null || true)
node_major=$(printf '%s' "$node_version" | sed -n 's/^v\([0-9]\{1,\}\)\..*$/\1/p')
node_minor=$(printf '%s' "$node_version" | sed -n 's/^v[0-9]\{1,\}\.\([0-9]\{1,\}\)\..*$/\1/p')
[ -n "$node_major" ] && [ -n "$node_minor" ] || die \
  "graduand: node 판을 읽지 못했다 — '$node_bin --version' 이 '$node_version' 을 냈다." \
  "  읽지 못한 판으로 돌리지 않는다: 돌 수 있는지 모르는 채 낸 수는 초록이어도 뜻이 없다."
if [ "$node_major" -lt 23 ] || { [ "$node_major" -eq 23 ] && [ "$node_minor" -lt 6 ]; }; then
  die \
    "graduand: node $node_version 은 너무 낮다 — 필요한 것은 ≥23.6 이다." \
    "  그 판이 TypeScript 소스를 **빌드 없이** 그대로 도는 첫 판이고, 이 패키지는 개발 빌드가 0 이다." \
    "  GitHub: actions/setup-node 의 node-version 을 24 로 올려라." \
    "  GitLab: image 를 node:24 계열로 올려라."
fi

if [ -n "${GRADUAND_OUTPUT:-}" ]; then
  # ⛔ 종료 코드를 파이프에 넘기지 않는다 — POSIX sh 에 PIPESTATUS 가 없어 `| tee` 는 tee 의
  #    코드를 돌려주고, 그러면 **위반이 초록으로 둔갑한다.** 그래서 파일로 받고 그 뒤에 찍는다.
  set +e
  "$node_bin" "$cli" "$@" >"$GRADUAND_OUTPUT"
  code=$?
  set -e
  cat "$GRADUAND_OUTPUT"
  exit "$code"
fi

exec "$node_bin" "$cli" "$@"
