<!-- 이 파일은 생성물이다 — 손으로 고치지 말 것. 고칠 자리는 이 저장소가 아니라 상류의 생성기다.
     생성 판: 5937d365ce94 -->

# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

이 표를 서비스마다 다르게 쓰려면 **이 파일이 아니라 플랫폼 템플릿을 고친다** — 여기서 고친
차이는 재생성 때 사라지고, 사라지기 전까지는 드리프트로 실패한다. 의도적으로 갈라져야 한다면
서비스 블록 마커로 선언한다 (ISSUE-51).
