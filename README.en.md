# Graduand

**Judging whether the rules you wrote down still hold at this commit.**

[한국어](README.md) · this is a translation; the Korean text is the canon.

Writing a rule down and having it hold are two different things. graduand holds your rules as
code and judges whether the repository still matches them. There are only three answers —
**pass, violation, unjudged** — and a cell nobody looked at is never counted as a pass.

Judgment runs **in your own CI**. This is not a hosted SaaS. There is no place where our
infrastructure reads your repository.

## Subscribing

There is one place to subscribe — **<https://graduand.dev>**. Pricing and payment stand only on
that screen; this repository holds no second entrance.

⬜ **That address is not served yet** — attaching the domain *is* the switch to public. What this
line points at today is a **settled place**, not a screen that stands.

⭕ **Subscribing does not move the boundary**: judgment still runs on your side. What entitlement
divides is **whether a feature needs a declaration** — `refs` reports with no declaration at all,
while the three declaration-driven axes and admissions, the grid and exemptions do ask for it.
Even where it is asked for, the **shape of the cells stays visible**; only the counts are withheld.

## What gets judged

| Verifier | The question it asks |
|---|---|
| `refs` | Can somebody who clones the repository actually reach the files, paths and anchors your docs point at? This is the axis that reports with no declaration at all |
| `shared-values` | Do shared values such as colour and spacing match the basis your repository wrote down? |
| `shared-values-cross` | Does that basis still match the value in the canon repository? This is the drift that opens up between repositories |
| `ui-paths` | Does a declared UI path point at a directory that really exists? |

Values that cannot be resolved — a `var()` indirection, or a token defined twice in the same
scope — are left **unjudged** rather than guessed at. Unjudged is not "0 violations". It means
the thing could not be measured, and every such cell carries its reason.

What gets measured is declared by `graduand.json` at your repository root. A cell you did not
declare is unjudged, not a violation, and a rule you decide not to apply is written down as an
exemption **with a reason and an expiry**.

## What stands today, and what does not

- ⭕ **Six policy documents** (terms, refunds, privacy × ko · en, version 1.0.0 — **in effect
  2026-10-28** · [docs/policies/](docs/policies/)) and their guards. The build renders them to HTML.
- ⭕ **The source of the verifiers and of the diagnosis page**, plus the declaration of where the
  site stands ([`wrangler.jsonc`](wrangler.jsonc)).
- ⬜ **The diagnosis page is not public yet** — no domain is attached to `graduand.dev`, and
  attaching one is the switch to public. The day it attaches, this line and the ⬜ under
  "Subscribing" are lifted **together**.
- ⬜ **The package is not published yet** — [`verifier/package.json`](verifier/package.json) is
  `private: true`, and lifting that comes after the switch to public.

The measuring command is `npm test`. If you are working in the repository, read
[CONTRIBUTING.md](CONTRIBUTING.md) and [CLAUDE.md](CLAUDE.md).

## What this repository holds

**Verifiers · adapters · diagnosis page source · site wiring · repository operations · policy
documents · licence texts.** That list is the definition of its scope. Which path belongs to
which group is held by the **rows** of
[`config/public-scope.yml`](config/public-scope.yml), not by prose.

## Licensing

This repository is **not covered by a single grant** — four things of different natures live in
one tree.

| Group | Grant |
|---|---|
| Verifiers · diagnosis page (the product we sell) | **BSL 1.1** — [`LICENSE`](LICENSE) · the free scope is written into the Additional Use Grant **as features** ([boundary](docs/licensing/feature-boundary.md)) · Change License = Apache-2.0 |
| Guards · CI · declarations · entry prose (repository operations) | **Apache-2.0** — [`LICENSE-APACHE-2.0`](LICENSE-APACHE-2.0) |
| Terms · refunds · privacy ([docs/policies/](docs/policies/)) | **all rights reserved** — published to be read, with no grant to reuse |
| The texts of the two licences themselves | under their own copyright holders' terms (MariaDB · ASF) |

⚠️ **Which grant attaches to which path is settled by the declaration, not by this prose** —
the `license` axis of [`config/public-scope.yml`](config/public-scope.yml) writes it **row by
row**, and a row missing that value is blocked by a guard. (Silence defaults to all rights
reserved, and that means "you cannot copy this", not "we have not decided yet".) The **reasons**
behind each group are held by
[docs/licensing/repository-licensing.md](docs/licensing/repository-licensing.md).
