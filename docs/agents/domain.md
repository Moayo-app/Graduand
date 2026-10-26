<!-- 이 파일은 Agent-Platform 생성물이다 — 손으로 고치지 말 것 (ISSUE-42).
     정본 템플릿: platform/shared-blocks/templates/domain.md
     재생성(플랫폼 저장소에서): npm run shared-block -- --service <서비스> --file <이름> --out <서비스 저장소>/docs/agents/domain.md --force
     대상 저장소: Moayo-app/Graduand
     생성 판: d99aefcb96cc -->

# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root, or
- **`GLOSSARY-MAP.md`** at the repo root if it exists: it points at one `GLOSSARY.md` per context. Read each one relevant to the topic.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (most repos):

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Multi-context repo (presence of `GLOSSARY-MAP.md` at the root):

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← system-wide decisions
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← context-specific decisions
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## 문서가 충돌하면 무엇이 이기는지 명시한다

**저장소는 자기 문서 계층의 우선순위를 한 곳에 적어둔다.** 스킬이 여러 문서에서 서로 다른
답을 얻었을 때 무엇을 따를지 정해두지 않으면 조용히 아무거나 고른다.

우선순위의 **내용은 저장소마다 다르다** — 아래는 형태이지 값이 아니다.

- Close-Unfold: *"**ADR 이 스펙을 이깁니다** — ADR 은 스펙보다 나중에 내려진 결정이고,
  스펙의 일부를 명시적으로 뒤집었습니다."*
- Moayo: *"정책 값이 필요하면 `docs/policies/` 를, 용어 정의가 필요하면 `GLOSSARY.md` 를 본다.
  **둘이 충돌하면 `docs/policies/` 가 이긴다.**"*

> 두 서비스에서 **독립적으로** 같은 형태가 나왔다 (2026-08-26). [#20](https://github.com/Moayo-app/Agent-Platform/issues/20) 의 「두 번째 인스턴스」
> 시험을 통과한 첫 사례다 — 같은 질문(「문서가 충돌하면 무엇이 이기는가」)에 다른 답을 낸다.
> 그래서 **형태만** 공유하고 값은 서비스가 정한다.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
