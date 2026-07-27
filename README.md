# Jordan Stevenson 2026 Platform and Campaign Commitments

This repository is the public, version-controlled record of Jordan Stevenson's released 2026 Port Hope mayoral platform, campaign commitments and campaign rules.

Public tracking began at **2026-07-24T09:00:00-04:00** in America/Toronto, which is **2026-07-24T13:00:00Z** in UTC.

> Policies should improve as evidence and community feedback come in. The problem is not changing. The problem is pretending nothing changed.

Policy can evolve. Evidence can improve. Community feedback can expose a better approach. Changing a policy is not inherently improper. Material changes made after public tracking began are documented through immutable repository change records, visible pull requests, the changelog and Git history.

This first commit records the campaign's public position immediately before tracking began. It does not claim to reconstruct every website edit or public statement made before this repository existed.

## What is included

- Released platform policies and tightly connected policy packages
- Public campaign rules and governing commitments
- Public financial, transparency, privacy and accountability commitments
- Public source links and available publication metadata
- A visible process for corrections, clarifications, revisions and withdrawals

See [the platform index](platform/README.md), [campaign rules](CAMPAIGN-RULES.md), [methodology](METHODOLOGY.md) and [changelog](CHANGELOG.md).

## How future changes work

Each formal public change must add exactly one URL-safe `changes/*.md` record in the same pull request as the affected campaign-rule or platform files. The Git diff proves what text changed. The immutable change record explains why it changed, how it is classified, what it affects, and what did not change. The merged pull request supplies supplementary review context; its editable description is not the authoritative explanation.

The record uses validated YAML front matter and these Markdown sections:

- `What changed`
- `Why it changed`
- `Previous wording`
- `New wording`
- `Effect on the commitment`
- `What did not change`
- `Supporting evidence`
- `Public implementation`

New commitments use `Not applicable: new commitment` instead of invented previous wording. Withdrawals use `Not applicable: commitment withdrawn` instead of invented new wording. Evidence links must be public HTTPS links and state what each source supports. A single conceptual change may cover multiple records only when the immutable record declares the exact complete scope.

Run `npm test` and `npm run validate -- --base <base-sha> --head <head-sha>` before review. Validation fails closed when a political record lacks exactly one new record, scope or wording cannot be verified, a record is malformed, or an existing historical record is edited or deleted.

Retired or withdrawn commitments will remain available in Git history and will be marked rather than silently deleted.

Missing, malformed, ambiguous or mismatched records do not erase repository activity. The public campaign website must display the underlying tracked commit as an `Unclassified repository change` without inventing the missing explanation.

Repository change records identify voter-facing implementation work, but they do not automatically rewrite campaign website policy bodies. Website copy changes require a separate reviewed pull request in `iharc-jordan/jordan-civic-site`.

See [the methodology](METHODOLOGY.md) for classification and version rules and [repository settings](REPOSITORY-SETTINGS.md) for the manual protections expected on `main`.

## Reuse and attribution

The campaign wants useful ideas to travel. The platform and campaign-record text in this repository is licensed under the [Creative Commons Attribution 4.0 International License](LICENSE).

Other candidates, campaigns, residents and organizations may copy, share and adapt this material, including for their own platforms, provided they give appropriate credit, link to the licence and indicate what they changed. Reuse does not imply endorsement by Jordan Stevenson or the campaign.
