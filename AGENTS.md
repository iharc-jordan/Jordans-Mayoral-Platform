# Public Platform Repository Instructions

## Authoritative audit role

This repository is the authoritative public political audit record for Jordan Stevenson for Mayor of Port Hope. Treat public-record integrity as an adversarial security boundary. Green CI is necessary but is never sufficient evidence that an audit-sensitive change is complete or safe.

The public campaign website is a separate reviewed publication boundary. Repository Markdown and immutable records document public history; they never automatically rewrite voter-facing website body copy. Website publication requires its own reviewed change in `iharc-jordan/jordan-civic-site`.

## Political change contract

- Use one pull request for one coherent political change.
- Never mix political content with validator, workflow, test, package-script, contract, schema, governance or other audit-infrastructure remediation.
- Account for every removed and every added semantic block in both directions. Every declared previous and new block must exist in the actual delta, and every actual political delta must appear in the immutable record.
- Include politically meaningful front matter in semantic coverage. Only fields on the validator's explicit reviewed administrative allowlist may be excluded.
- Treat every Markdown path under `platform/` as political when it changes. The exact checked-in documentation allowlist permits the unchanged index to exist; it is never permission to place political wording in `platform/README.md`. Reject changes to that index and malformed, uppercase, nested or otherwise unexpected political paths.
- Never delete a tracked political record to withdraw or replace it. Retain the record and update its public status through the reviewed change contract.
- Immutable change-record IDs and paths are permanent. Never modify, delete, reuse or reintroduce one, including after deletion.
- Required record headings and changelog entries must be visible rendered Markdown, never text hidden in comments, code fences or other non-rendered contexts.
- Versions must increase monotonically from the predecessor public version and use the patch or minor increment required by the documented classification. Routine political evolution must not use a major reset.
- Supporting evidence must use genuinely public HTTPS URLs. Never use credentials, localhost, loopback, link-local, private-network or malformed targets.
- Keep public implementation routes and artifact paths exact; `/` is the campaign website root route.
- Keep semantic comparison explicitly resource-bounded and fail closed before adversarial block counts or complexity can exhaust validation memory.

## Trusted validation and review

Political pull requests may not change the validator that judges them. Validator implementation, validator tests, package scripts or lockfiles, validation workflows, contract or schema files, and this `AGENTS.md` require a separate infrastructure-only pull request with no political content. Pull-request validation must execute trusted base-sourced code against the proposed tree.

Add a focused fictional regression test for every identified bypass. Applicable unresolved P1 and P2 review threads block merge until the exact fix and test evidence have been independently reviewed and the threads are resolved. Do not treat a passing status check as a substitute for adversarial review.

Before approving a political change, verify semantic coverage, political front matter, exact affected scope, record permanence, rendered structure, version progression, public evidence and the separate website-publication impact.
