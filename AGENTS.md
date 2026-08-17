<!-- AGENTS.md -->
# Agent Instructions for `integrity`

This file is repo-local. It applies only inside:

- `/home/anchor/projects/integrity`
- Git remote: `github.com/anchorskov/integrity` (public repo)
- Public brand/domain for this project: `thefourthbranch.net`. The legal entity and internal
  codename are both "Integrity Project" / "integrity"; the public-facing name is "The Fourth
  Branch." Use the public name in user-facing copy, the internal name in code/repo/infra.

**Start every session on this project by reading `docs/progress.md`** (newest entry first) and
this file. Planning may be continuing in a separate conversation in parallel; treat
`docs/planning/*.md` as possibly stale and re-check before assuming it still matches what's live.

## Project Scope Guard

This project is a distinct 501(c)(3) nonprofit, legally and operationally separate from Jim's
other projects, in particular `skovgard2026` (a U.S. Senate campaign committee).

- **Do not reuse `skovgard2026`'s brand system** (`wy-*` tokens, frontier theme, Bitter/Source
  Sans, ember/sandstone palette). This project has its own brand, see `brand/BRAND.md`.
- Reusing *code and schema patterns* from `skovgard2026`/`grassmvt_survey` is fine and expected
  (see `docs/planning/03-reuse-architecture.md`); reusing *live infrastructure* (databases,
  Workers, accounts) is not, beyond the one explicitly logged exception below.
- If a rule, instruction, or prior memory mentions another project by name, don't apply it here
  without checking it against this file and the docs/planning notes first.
- Before changing public-facing identity fields (domain, org name, contact emails, donation
  links), verify them against this repo's actual filed documents in `docs/legal/`, not assumption.

## Infrastructure

- **Cloudflare account is shared** with `skovgard2026`/`grassmvt_survey` (Jim's preference, one
  account for all projects), logged as an accepted, monitored risk in
  `docs/planning/04-org-compliance.md`. Resources themselves are fully separate:
  - Worker: `fourthbranch-api` (never confuse with `skovgard2026-api`)
  - D1 databases: `fourthbranch` (production), `fourthbranch-preview`. Binding name `DB` in both.
  - Domain: `thefourthbranch.net`
  - Billing is combined at the account level. Once either project generates real (non-free-tier)
    Cloudflare usage, flag it, this needs an accountant's read on cost allocation, not a
    unilateral engineering call.
- **Database:** D1 (Cloudflare's SQLite), not Postgres, decided for MVP speed. See
  `docs/planning/03-reuse-architecture.md` #2 if this needs revisiting later; the entity design in
  `docs/planning/02-data-model.md` was written to port to Postgres without a redesign if it ever
  comes to that.
- **API framework:** Hono (`worker/src/index.ts`), not native Cloudflare Workers request/response
  APIs. This is the deliberate hedge that keeps a path open to hosting off Cloudflare later. Don't
  write route handlers against Cloudflare-specific globals; take everything through Hono's
  context (`c.env`, `c.req`, etc.) so the same code could run on Node/Deno/Bun.
- **Frontend:** Astro, static output, in the repo root (`src/`, `astro.config.mjs`). API lives
  entirely in `worker/`, a separate deploy target, not Astro SSR.
- Migrations live in `worker/migrations/`. Apply with
  `npx wrangler d1 migrations apply <db-name> --env <env> --remote` from `worker/`, never guess at
  a database name, check `worker/wrangler.toml` first.
- Before running any `wrangler deploy`/`d1 execute` against `--env production`, confirm the exact
  resource name in `worker/wrangler.toml` first. Do not create a new Worker or D1 database just
  because a command prompts for one.

## Writing Style

**Never use an em dash** (`—`, `&#8212;`, or `--` used as a dash), anywhere: copy, docs, commit
messages, code comments. This is Jim's fixed personal writing rule, not a suggestion. See
`docs/style.md`. Before publishing new copy, grep for it:

```bash
grep -rn "—" src/ brand/ worker/src/ docs/planning/
```

## Brand

Locked design direction: `brand/BRAND.md`, `brand/palette.json`, `brand/typography.json`. Read
`BRAND.md`'s hard rules before generating any front-end code, copy, or visual asset. Summary:
"The Ledger" concept (public-record visual language), Libre Caslon + Public Sans + IBM Plex Mono,
verdigris as the one primary accent, brass reserved for money figures only, no Wyoming/US
government seal imagery (this is a citizen nonprofit, not a government entity).

## Neutrality Rule (501(c)(3) hard constraint)

The candidate/public-office database must never carry scores, ratings, or endorsements, sourced
records only, identical fields per candidate. This isn't a style preference, it's the IRS
501(c)(3) campaign-intervention constraint the org's own Certificate of Incorporation commits to.
See `docs/planning/01-product-spec.md` and `docs/planning/04-org-compliance.md`.

**Known unresolved tension, logged, not solved:** Jim is simultaneously a director of this org and
a candidate for U.S. Senate. Do not publish any candidate-database content touching a Skovgard race
without checking `docs/planning/04-org-compliance.md`'s board-composition section first, and
without real legal review, regardless of how the Wyoming primary (Aug 18, 2026) turns out.

## Documentation Index

**`docs/` is entirely gitignored**, same convention as `skovgard2026`/`grassmvt_survey`. Every
file below exists only on this machine, not in git or on any remote. `docs/legal/` in particular
contains PII (home address, phone, email) from the actual filed incorporation documents, never
remove it from `.gitignore`.

| File | What it's for |
|---|---|
| `docs/AGENTS_PRIVATE.md` | Confidentiality preferences for handling this project's own working material, read given this repo's remote is public |
| `docs/progress.md` | Living session journal, read this first when resuming work |
| `docs/style.md` | The no-em-dash writing rule, full detail |
| `docs/planning/00-source-notes.md` | Jim's original concept doc, seed reference |
| `docs/planning/01-product-spec.md` | Feature list, membership tiers, MVP scope |
| `docs/planning/02-data-model.md` | Entity schema, the `sources`/`*_claims` provenance design |
| `docs/planning/03-reuse-architecture.md` | File-by-file reuse map, Phase 0 infrastructure decisions |
| `docs/planning/04-org-compliance.md` | Built from the real Articles/Bylaws, the board-composition conflict, IRS quid-pro-quo note |
| `docs/planning/05-mvp-roadmap.md` | Full MVP build sequence, phase by phase |
| `docs/planning/06-membership-civic-info-planning.md` | Imported canonical copy of the external membership/civic-information planning draft |
| `docs/planning/07-planning-deconflict-notes-2026-08-07.md` | Deconflict map of overlapping planning drafts and recommended consolidation steps |
| `docs/planning/08-civic-graph-spec.md` | Conceptual civic graph: entities (Person, Office, Election, Survey, Fact, Watch, etc.), time/provenance design rules, MVP entity priority |
| `docs/planning/09-civic-geography-spec.md` | Location-to-jurisdiction resolution design: provider hierarchy, boundary versioning, election-time vs. survey-time geography snapshots |
| `docs/planning/10-survey-methodology-spec.md` | Survey methodology classes (open vs. verified vs. scientific), response/aggregation rules, neutrality review, publication thresholds |
| `docs/planning/11-funding-model-benchmarks.md` | Nonprofit funding benchmarks (WyoFile, Montana Free Press, VTDigger, Colorado Sun), membership pricing rationale, AI cost/routing tiers, KPI framework |
| `docs/planning/12-design-overview.md` | Originating design rationale doc that `08`/`09`/`10` were split out of; kept for the Integrity Agent tool design, Civic Home wireframe, and decision log not yet promoted elsewhere |
| `docs/legal/` | Actual filed Certificate of Incorporation and Bylaws (PII, gitignored) |

Keep this list current: add a row when a new `docs/*.md` file is created, remove it if deleted.
