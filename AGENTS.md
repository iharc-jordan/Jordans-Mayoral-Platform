# Repository agent instructions

## Purpose

This repository is the authoritative public, version-controlled record of Jordan Stevenson’s released mayoral platform, campaign rules and formal public commitments. Changes to political records are public accountability events, not ordinary documentation edits.

## Public-record integrity is an adversarial boundary

Treat validation, change association, versioning and immutable records as security-sensitive audit infrastructure. Do not assume contributors, automation, pull-request metadata, filenames, Markdown formatting or remote links are honest merely because they are syntactically valid.

A green test suite is not proof that a change is safe. For changes to the public-record contract, validators, workflows or political records, perform fresh-context adversarial review and resolve every applicable P1 and P2 review finding before merge.

## Political record scope

- Treat `CAMPAIGN-RULES.md` and every Markdown file anywhere under `platform/` as politically tracked, except only paths explicitly classified as repository documentation by a checked-in exact allowlist.
- Reject unexpected, nested, uppercase or otherwise nonconforming political paths. Never silently treat them as infrastructure-only.
- Politically meaningful front matter is part of the public record. Status, title, category, dates, eligibility, version and other commitment-bearing metadata must be included in semantic comparison where applicable.
- Do not delete a tracked political record to represent withdrawal or retirement. Retain the record, mark its public status and preserve prior wording in Git history.
- One pull request should contain one coherent political change. Every semantic delta in every affected record must be explained. Documenting one valid paragraph does not authorize an unrelated change elsewhere in the same file.

## Immutable change records

- A later political change requires exactly one new immutable `changes/*.md` record unless the approved contract explicitly supports a bounded multi-record case.
- The immutable record must account for every removed and added semantic block, including politically meaningful front matter.
- Compare claims bidirectionally. Every declared old/new block must exist in the actual delta, and every actual political delta must be covered by the record.
- Reject partial, embellished, invented, common-substring or unchanged wording presented as the change.
- Existing immutable record IDs and paths may never be reused, modified or deleted.
- Parse rendered Markdown structure. Headings inside fenced code blocks, HTML comments or other non-rendered contexts do not satisfy required public sections.
- Supporting evidence must use genuinely public HTTPS URLs. Reject credentials, localhost, loopback, link-local and private-network destinations.
- Public implementation routes and artifact paths require exact token matches. Substring matches are not acceptable. The root route `/` is valid.

## Version and changelog integrity

- Versions must increase monotonically from the predecessor public version.
- Enforce the documented patch, minor and major rules for the selected classification.
- Reject duplicate, regressive or classification-inappropriate versions.
- `CHANGELOG.md` must contain a newly added, rendered public entry for the change. HTML comments or unrelated existing text do not satisfy this requirement.
- A change record must not contain or depend on its own final commit SHA.

## Trusted validation

- Political pull requests must not be able to weaken the validator, tests, workflow or package command that judges the same pull request.
- Either prohibit political-record changes from modifying validation machinery in the same PR or execute a trusted base-branch or pinned validator against the proposed tree.
- Changes to validator code, tests, workflow files, package scripts or this `AGENTS.md` require a separate infrastructure PR and adversarial review.
- Required CI must fail closed for missing, malformed, ambiguous or undocumented political changes.

## Pull-request discipline

- Start from current `main` and use a focused branch.
- Link an approved issue with explicit acceptance criteria.
- Do not mix political content with audit-infrastructure remediation.
- Include exact commands and actual results.
- Add a regression test for every identified bypass or review finding.
- Do not merge with unresolved applicable P1 or P2 review threads.
- Use squash merge for one conceptual public change where repository settings permit.

## Website boundary

The public platform repository records and explains approved changes. It does not automatically publish campaign website body copy. Website presentation changes require a separate reviewed pull request in `iharc-jordan/jordan-civic-site` with exact immutable-record authorization and exact affected scope.
