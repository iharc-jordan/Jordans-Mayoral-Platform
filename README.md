# Jordan Stevenson 2026 Platform and Campaign Commitments

This repository is the public, version-controlled record of Jordan Stevenson's released 2026 Port Hope mayoral platform, campaign commitments and campaign rules.

Public tracking began at **2026-07-24T09:00:00-04:00** in America/Toronto, which is **2026-07-24T13:00:00Z** in UTC.

> Policies should improve as evidence and community feedback come in. The problem is not changing. The problem is pretending nothing changed.

## Current public sources

- [`data/campaign-rules.json`](data/campaign-rules.json) is authoritative for the 12 current campaign rules, their stable IDs, order, exact public wording and website surfaces.
- [`platform/`](platform/README.md) contains the released platform policies and policy packages.
- [`changes/`](changes) contains permanent public change records. Historical records are Markdown; new records are JSON.
- [`CHANGELOG.md`](CHANGELOG.md) preserves the published `v1.0.0` and `v1.1.0` release history.
- [`CAMPAIGN-RULES.md`](CAMPAIGN-RULES.md) is the unchanged pre-structured migration source preserved for public history. Future rule changes edit only the JSON source.

This repository began with the campaign's public position immediately before tracking started. It does not claim to reconstruct every earlier website edit or public statement.

## Future changes

A campaign-rule change uses one protected pull request:

1. Edit one or more rules by stable ID in `data/campaign-rules.json`.
2. Add one `changes/YYYY-MM-DD-slug.json` record.
3. Run `npm test` and `npm run validate -- --base BASE_SHA --head HEAD_SHA`.
4. Merge through ordinary branch protection and review.
5. Confirm the campaign website loaded the merged structured source on one desktop and one mobile viewport.

The change record identifies the changed rule or policy IDs and surfaces, explains the change and reason, includes exact previous and new rule objects, states what did not change, and links supporting public evidence. It does not contain its own final commit SHA.

Existing `platform/*.md` policies use the same one-record workflow, with a simple exact changed-file scope check. The validator does not infer prose meaning.

## Presentation records

An immutable presentation record documents a reviewed material change to how voters find, distinguish or interpret official campaign information, without changing a campaign rule or policy. It uses `"recordType": "presentation"` and the separate exact schema enforced by `npm run validate`.

Presentation records are limited to information architecture, public-surface organization or comparable publication-structure changes. They are not a website activity log and cannot be combined with campaign-rule, policy, validator, workflow, schema, test, package or governance changes. Existing political records do not include `recordType` and continue using the political-record contract.

Historical change records are never edited or deleted. Git history, the stable change ID, its date and the merge commit provide the routine public identity. A semantic-version release is optional and reserved for a deliberately bundled platform release.

## Reuse and attribution

The platform and campaign-record text in this repository is licensed under the [Creative Commons Attribution 4.0 International License](LICENSE). Other candidates, campaigns, residents and organizations may copy, share and adapt it with appropriate credit, a licence link and a clear indication of what they changed. Reuse does not imply endorsement by Jordan Stevenson or the campaign.
