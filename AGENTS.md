# Public Platform Repository Instructions

## Authoritative source

`data/campaign-rules.json` is the authoritative public source for current campaign-rule wording, stable IDs, order and website surfaces. `CAMPAIGN-RULES.md` is retained unchanged as the pre-migration historical source and must not be edited for future rule changes.

## Political changes

- Keep one coherent political change per pull request.
- Edit rules by stable ID in `data/campaign-rules.json`.
- Add exactly one new `changes/YYYY-MM-DD-slug.json` record for a political change.
- The record must name the exact changed rule and policy IDs, contain the exact previous and new rule objects, and declare the surfaces from the structured rules.
- Do not edit or delete an existing Markdown or JSON change record.
- Keep political data changes separate from validator, workflow, schema, package or governance changes.
- Existing `platform/*.md` policies remain public source records. Their change records must identify the exact changed policy IDs; the validator does not infer prose meaning.

## Integrity boundary

Normal branch protection, the deterministic `validate` check, ordinary review and Git history are the integrity boundary. Preserve the historical `v1.0.0` and `v1.1.0` tags. Routine changes use their change ID, date and merge commit; create a semantic-version release only for a deliberately bundled platform release.

Do not reintroduce semantic Markdown inference, LCS comparison, parser edge-case machinery, trusted dual validators, canary pull requests, historical-ID scans or cross-repository authorization without a separately approved architecture issue. Prefer deleting obsolete complexity over compatibility layering.
