# Methodology

## Inclusion standard

This repository includes released platform policies, formal campaign promises, campaign rules, governing principles and fine print needed to understand those commitments. It excludes drafts, internal strategy, private information, opposition research, legal-case information and promotional material that does not establish a public commitment.

The source hierarchy for the original baseline was the deployed campaign website, linked public campaign documents, other official public announcements and public source history used to verify wording. An unresolved material conflict blocks publication rather than being guessed at.

## Canonical campaign rules

`data/campaign-rules.json` is the current authoritative rule source. Each rule has a stable `rule-N` ID, explicit number and order, exact title and body fields, and at least one explicit website surface. The campaign website validates and reads this merged branch-protected source directly; it does not maintain a separate copy of rule wording or infer route scope from Markdown.

Campaign-rule surfaces come from `data/campaign-rules.json`. Existing policy-page routes continue to come from the campaign website’s typed policy bindings.

`CAMPAIGN-RULES.md` is retained unchanged as the historical source at the structured migration boundary. The `v1.0.0` and `v1.1.0` tags continue to identify the two bundled historical releases.

## Change records

New political changes add one permanent `changes/YYYY-MM-DD-slug.json` record containing:

- ID, date, title and classification;
- affected rule and policy IDs;
- affected public surfaces;
- summary and reason;
- exact previous and new rule objects;
- what did not change; and
- supporting public HTTPS links.

The final merge commit and pull request are derived from GitHub history and are not embedded before merge. Existing Markdown records remain part of the public history and are not converted, edited or deleted.

## Validation

The deterministic validator checks the strict structured-rule shape, deep-compares base and proposed rule objects, identifies exact changed IDs, and requires one matching new JSON record. The record's rule IDs, exact previous and new objects, and affected surfaces must equal the actual data change. For existing policy Markdown, validation checks only that the record names the exact changed policy IDs.

Political data changes cannot also modify validation, workflow, schema, package or governance machinery. Existing change records cannot be edited or deleted. The validator intentionally does not infer Markdown semantics, compare prose blocks, enforce release-version increments, scan all history for reused IDs, run a second trusted validator or create canary pull requests.

## Public evidence and corrections

Supporting links must be ordinary public HTTPS URLs. A correction or changed position is explained plainly in its change record, including the exact structured rule values when rules change. Previous states remain accessible through Git history.

Routine changes are identified by change ID, date and commit. A new semantic version is created only when Jordan deliberately publishes a bundled platform release.

## Historical boundary

Forward tracking begins at **2026-07-24T09:00:00-04:00** with tagged baseline `v1.0.0` at commit `573d624fdd000da86eca654f882f02c01f6fa29c`. Earlier versions remain available in Git history; the repository does not reconstruct private development or statements from before the boundary.
