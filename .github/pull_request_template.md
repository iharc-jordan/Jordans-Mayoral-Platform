## Summary

Describe the proposed repository change in plain language.

## Public source scope

- Changed rule IDs:
- Changed policy IDs:
- Affected website surfaces:
- Structured change record, or `Not applicable: infrastructure-only`:

## Exact change

- [ ] One coherent political change is included.
- [ ] `affectedRuleIds` exactly matches the changed structured rule IDs.
- [ ] `affectedPolicyIds` exactly matches the changed policy files.
- [ ] `previousValues` and `newValues` exactly match the base and proposed rule objects.
- [ ] `affectedSurfaces` exactly matches the changed rules.
- [ ] `whatDidNotChange` identifies the unaffected commitments.
- [ ] Supporting links are public HTTPS URLs.
- [ ] No historical change record was edited or deleted.
- [ ] Political data was not mixed with validator, workflow, schema, package or governance changes.

## Post-merge website verification

Complete after merge:

- [ ] The campaign website loaded the merged structured source.
- [ ] The affected public page shows the approved wording.
- [ ] One desktop smoke check passed.
- [ ] One mobile smoke check passed.

## Validation commands and results

```text
npm test
npm run validate -- --base <base-sha> --head <head-sha>
git diff --check
```
