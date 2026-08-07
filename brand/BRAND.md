# Brand: The Fourth Branch (Integrity Project)

Locked design direction for `thefourthbranch.net`. Approved by Jim 2026-08-07 from the homepage
concept artifact. Read this before generating any front-end code, copy, or visual asset for this
project.

## Concept: "The Ledger"

The visual language of a public record: docket entries, ledger lines, source citations, not a
newsroom template and not a campaign site. This project is legally and operationally separate from
`skovgard2026`; **do not reuse or reference that project's brand system (`wy-*` tokens, frontier
theme, Bitter/Source Sans, ember/sandstone palette)**. This is a distinct organization with its own
identity, on purpose.

## Hard rules, do not deviate

- Palette lives in `brand/palette.json`. Do not introduce a color outside it.
- **Brass (`#8C6A31` light / `#D2A55C` dark) is reserved exclusively for financial figures**:
  money-involved fields, price displays. Never use it as a general accent.
- **Seal red (`#9C3B26` light / `#D6795C` dark) marks status/new/alert only.** It is a
  document-stamp reference, not a semantic danger color. Don't reach for it as "the red one."
- Verdigris is the one primary accent. Keep the page's boldness spent there; everything else
  stays quiet.
- Typography: Libre Caslon Display for headlines, Libre Caslon Text for ledes/emphasis, Public
  Sans for body/UI, IBM Plex Mono for every piece of record metadata (dates, dollar amounts, vote
  tallies, docket eyebrows). See `brand/typography.json` for the full rationale. The mono face in
  particular is load-bearing (it visually marks "this is a verifiable data point"), not stylistic.
- Self-host font files under `/public/fonts/`. Do not link a Google Fonts `<link>` in production.
- Cool paper background, never the warm-cream/serif combination; that reads as generic
  AI-generated civic-site design, and this project deliberately avoids it.
- No Wyoming state seal, no U.S. government seal imagery, no imagery that implies official
  government status. This is a citizen nonprofit, not a government entity, and the "Fourth
  Branch" name should never visually overclaim that distinction.

## Writing style

**Never use an em dash.** This is Jim's fixed personal writing rule across all his projects, not
a stylistic suggestion. Rewrite instead of substituting: split into two sentences, use a comma
with a conjunction, or use parentheses for an aside. See `docs/style.md` if it exists in this
project, or the equivalent doc in `skovgard2026` for the full rationale.

## Where to find brand details

- Palette: `brand/palette.json`
- Typography: `brand/typography.json`
- Reference implementation: the approved homepage concept artifact (ledger card layout, geography
  picker, Watch alert-email mockup, membership tier cards). Treat it as the living reference until
  `src/pages/index.astro` supersedes it.

## Status

Design direction approved 2026-08-07. Frontend implementation in progress; see
`docs/planning/05-mvp-roadmap.md` Phase 1.
