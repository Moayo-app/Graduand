#!/bin/sh
# 시야를 모으는 **하나의 손** — 정본 저장소를 얕게 가져온다.
#
# ⭐⭐ 왜 스크립트가 따로 서는가. 판정기를 **참조**로 받는 입구(GitHub Action)와 **clone**
# 으로 받는 입구(GitLab · 빅버킷)가 갈린다. 뒤의 둘은 또래 저장소도 자기가 가져와야 하는데,
# 그 루프를 둘이 각자 적으면 사본이 둘이고 갈라진다 — argv 를 짓는 손을 하나로 둔
# (`graduand-ci.sh`) 그 결정과 **같은 자리**다. ⇒ 가져오는 손도 하나다.
#
# ⛔ 이 스크립트는 판정하지 않고 시야를 **적지도** 않는다 — 가져오는 것과 **보는 것**은 다른
#    행위다. 가져온 디렉터리는 `GRADUAND_ROOTS` 에 적어야 판정의 시야에 든다. 둘을 한
#    변수로 합치면 「무엇을 보았는가」의 손이 둘이 되고, 적지 않은 체크아웃을 디스크에서
#    추측해 채우는 자리가 생긴다 — 추측한 분모 위의 수는 전부 거짓이다.
#
# 환경:
#   GRADUAND_PEERS    한 줄에 `<디렉터리> <url> <ref>`. ⭕ 비면 clone 0 이고 **조용히
#                     성공한다** — 또래가 없는 저장소가 평상시다(교차 축은 그 표면에서
#                     `single-repo-surface` 미판정으로 남고, 그것은 「위반 0」이 아니다).
#   GRADUAND_PEERS_DRY_RUN  1 이면 `git clone` 대신 `<디렉터리> <url> <ref>` 를 한 줄씩
#                     찍는다 — 두 입구가 **같은 줄**을 짓는지 묻는 자리다.
#
# ⚠️ **자격을 받지 않는다.** 비공개 상류를 가져오는 자격(앱 비밀번호 · 액세스 토큰 · SSH
#    키)은 **고객의 것**이고 이 스크립트는 그것을 인자로도 환경으로도 받지 않는다 — url 에
#    무엇을 적을지는 고객의 CI 가 정한다. ⛔ 우리가 고객 저장소를 읽는 경로는 없다.
set -eu

die() {
  for line in "$@"; do printf '%s\n' "$line" >&2; done
  # 2 = 판정 실패 — **수를 내지 않았다.** ⛔ 1 이 아니다: 시야를 못 모은 것은 위반이 아니다.
  exit 2
}

peers=${GRADUAND_PEERS:-}
# ⭕ 빈 것은 오류가 아니다 — `GRADUAND_ROOTS` 와 **다른 자리**다. 저쪽은 「루트를 줬는데
#    비었다」가 N 개를 하나로 접는 자리라 멈추지만, 또래는 0 이 평상시다.
[ -n "$(printf '%s' "$peers" | tr -d '[:space:]')" ] || exit 0

command -v git >/dev/null 2>&1 || die \
  "graduand: git 이 없다 — 시야를 모으려면 clone 이 필요하다." \
  "  이미지에 git 을 넣거나(alpine: apk add --no-cache git), 또래를 러너가 먼저 두게 해라."

# ⛔ 파이프로 돌지 않는다 — POSIX sh 에서 `… | while` 은 **서브셸**이라 그 안의 exit 가
#    스크립트를 멈추지 못한다. 잘못된 줄 하나가 조용히 넘어가면 시야가 모자란 채 초록이 된다.
old_ifs=$IFS
IFS='
'
for line in $peers; do
  IFS=$old_ifs
  # 줄 끝 공백과 빈 줄은 선언이 아니다.
  line=$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  if [ -n "$line" ]; then
    # shellcheck disable=SC2086
    set -- $line
    [ "$#" -eq 3 ] || die \
      "graduand: GRADUAND_PEERS 의 줄이 '<디렉터리> <url> <ref>' 셋을 갖지 않았다 — '$line'" \
      "  ⛔ 모자란 줄을 추측으로 채우지 않는다: 틀린 상류에서 읽은 정본은 미판정보다 나쁘다."
    if [ "${GRADUAND_PEERS_DRY_RUN:-}" = 1 ]; then
      printf '%s %s %s\n' "$1" "$2" "$3"
    else
      rm -rf "$1"
      # ⚠️ **얕다** — 판정이 읽는 것은 추적 파일의 목록과 선언이 지목한 파일의 본문이고,
      #    이력은 한 건도 읽지 않는다. ⭐ 판을 고정하는 것은 고객의 선언이다(`<ref>`).
      git clone --quiet --depth 1 --branch "$3" "$2" "$1"
    fi
  fi
  IFS='
'
done
IFS=$old_ifs
