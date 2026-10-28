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

⭕ **That address stands** — the domain is attached (measured 2026-10-28: 200, redirecting to `/en/`).

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

## Commands

It runs in one line, with nothing to install. `--help` says which commands exist.

```
npx graduand --help
```

| Command | What it does |
|---|---|
| `graduand` | **Judges.** No subcommand is the judgment |
| `graduand init` | **Writes** an empty `graduand.json` |
| `graduand canon` | Writes "this is the canon" — adds one shared-value axis to the declaration |
| `graduand link` | Writes "the canon is over there and the values are these" — the pins are **read** from the canon |
| `graduand rules` | Prints **what the declaration put up as the denominator**. It does not judge |
| `graduand deliver` | **Rewrites** values that drifted from the canon, in the downstream repository |
| `graduand activate` | Turns a subscription key into an entitlement handle and writes one file to commit |

⛔ **No command commits.** Writing a file and putting it in the history are different acts, and
the second one is yours. ⛔ **No command sends us your repository** — the one place that touches
the network is `activate`, and what it asks is the payment vendor.

### Judging — `graduand`

```
npx graduand
```

It reads the declaration, opens a cell per admitted rule and counts **pass · violation ·
unjudged**. There are three exit codes: `0` no violations · `1` one or more violations · `2`
**judgment failure** (the declaration is broken, or the declaration and the real tree say
different things). ⚠️ `2` does not mean "many violations" — it means **it could not be measured**.

Drift *between* repositories ("pins == canon") only stands when one job sees both checkouts.
Repeat `--root` to widen the sight: the first is the repository being judged, the rest are sight.

```
npx graduand --root . --root ../design-system
```

Reports come in three shapes. The default is prose for a person, `--json` is the envelope a
machine reads, and `--fragment` is a summary that fits in a single address. `--open` opens that
summary in the diagnosis page in your browser.

### Writing the declaration — `init` · `canon` · `link`

To stand up an empty declaration:

```
npx graduand init
```

In the **canon repository** (where the original of the rule lives), write "this is the canon".
`--file` repeats.

```
npx graduand canon --axis design --adapter css-custom-properties --file tokens.css --scope :root
```

In a repository that **receives** that canon, point at the canon and write the pinned values.
⭐ The pins are never taken by hand — show the canon checkout with `--root` and they are **read**
from there.

```
npx graduand link --axis design --canon acme/design --canon-file tokens.css --canon-scope :root --root . --root ../design
```

⛔ If the canon is not in sight it refuses rather than writing an empty pin: a pin read from
nowhere is an invented basis, and a wrong basis is worse than none. ⛔ It never overwrites an
existing declaration — it prints the composed document on stdout, and moving it is yours.

### Asking for the denominator — `rules`

```
npx graduand rules
```

It prints **what the declaration put up as the denominator** — the admitted rules and the
verifiers they chose, the canon address of each shared-value axis, exemptions and their expiry.
It does not judge, so there is no red here (the exit code is `0` or `2`). `--json` gives the
machine-readable shape.

### Putting drifted values back — `deliver`

Judgment shows the drift and **stops there**. Fixing it is still done by a person today, and
copying the same value into N repositories by hand is exactly the **production line** of the
drift this product measures. `deliver` removes that line.

```
npx graduand deliver --root . --root ../design
```

It **rewrites** the downstream repository's own files with the values read from the canon.

**The mechanism is four lines.**

1. **The side that pulls is downstream.** The canon holds no list of the repositories that
   receive it — the pointer (`canon`) is written in the **downstream declaration**, so the
   direction is downstream→upstream. ⛔ The canon therefore **cannot push**. Downstream CI takes
   the upstream into its sight (repeat `--root`) and runs it.
2. **The denominator is the receiving side's declaration.** Only the tokens that repository
   **pinned** are carried, and the sending side never widens that denominator. Widening it is a
   **declaration act** on the receiving side.
3. **Three places are left alone.** ⛔ A value whose basis a reason moved (`diverged`) — putting
   it back would silently cancel that declaration. ⛔ A canon token the downstream did not pin —
   the cross axis already counts that as a **violation**, and quietly filling it would hide the
   violation forever. ⛔ A pin the canon does not know — a repository-local value, and legitimate.
4. **It only writes.** ⛔ It neither commits nor stages: writing a file and putting it in the
   history are different acts, and the second one is yours. ⛔ It raises no red either — both the
   places it did not fill and the drift itself are counted by **judgment**. If two hands counted
   the same fact, those two would drift apart.

⛔ **This is not a delivery our infrastructure runs.** It runs in your organisation, in your CI —
here too there is no place where we read or write your repository.

⬜ **The other direction is not here yet.** Where the downstream is right and the canon is stale,
**moving the basis itself** (promotion) does not stand. Delivery has nothing to choose — the canon
is the basis — while promotion is the **judgment** of which side is right, and we do not make that
judgment for you. Its shape when it stands is settled: among the observed drifts **a person
picks**, and the machine only names candidates.

### Entitlement — `activate`

```
npx graduand activate
```

It turns a subscription key into an entitlement handle and writes **one file to commit**. The key
comes from the environment (a secret) and the handle goes to a file (it is committed). Without a
key it refuses with `2` — and that `2` is not a defect, it is a true refusal saying "put the key in".

### In CI

Three entrances are ready — GitHub Actions, GitLab CI and Bitbucket Pipelines. How to attach them,
and what each entrance holds as a copy, is held by [verifier/ci/README.md](verifier/ci/README.md).

## What stands today, and what does not

- ⭕ **Six policy documents** (terms, refunds, privacy × ko · en, version 1.0.0 — **in effect
  2026-10-28** · [docs/policies/](docs/policies/)) and their guards. The build renders them to HTML.
- ⭕ **The source of the verifiers and of the diagnosis page**, plus the declaration of where the
  site stands ([`wrangler.jsonc`](wrangler.jsonc)).
- ⭕ **The diagnosis page is public** — the domain is attached to `graduand.dev`. This line and
  the ⬜ under "Subscribing" were lifted **together**, because they were the same fact.
- ⭕ **The package is published** — npm `graduand` (version 1.0.0). The `npx` line under
  "Commands" above runs as it stands.

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
