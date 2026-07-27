## Summary

Describe the proposed repository change in plain language.

## Immutable change record

Link the new authoritative `changes/*.md` record. Infrastructure-only pull requests may write `Not applicable: no political record changed`.

## Public records affected

List every exact changed `CAMPAIGN-RULES.md` or `platform/*.md` path. Write `None` only for an infrastructure-only pull request.

## Website pages and public artifacts affected

List every exact public route and document that requires separate review. This repository does not publish website body copy automatically.

## Classification and commitment effect

- Classification:
- Effect on the commitment:

## Immutable-record completeness

- [ ] The record contains the exact previous wording, or `Not applicable: new commitment` for a genuine addition.
- [ ] The record contains the exact new wording, or `Not applicable: commitment withdrawn` for a genuine withdrawal.
- [ ] The record explains why the change is being made.
- [ ] Every supporting-evidence link is public HTTPS and explains what it supports.
- [ ] The record specifically states **What did not change**.
- [ ] The record identifies every public implementation route or artifact requiring separate review.

## Version and changelog

- [ ] The version follows the documented semantic-version rules.
- [ ] `CHANGELOG.md` contains a concise entry linking the immutable record.
- [ ] A release or commit reference will be added through the normal release workflow when available; this commit does not attempt to contain its own final SHA.

## Scope and public-information confirmation

- [ ] No unrelated commitment changed.
- [ ] No campaign rule or platform record outside the paths listed above changed.
- [ ] No private information, donor personal information, credentials, internal strategy, opposition research or legal-case information is included.
- [ ] Website copy, if required, will change only through a separate reviewed website pull request.

## Validation commands and results

Paste each command that actually ran and its exact result.

```text
npm test
npm run validate -- --base <base-sha> --head <head-sha>
git diff --check
```
