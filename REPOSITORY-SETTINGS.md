# Repository settings for public-record integrity

The following GitHub settings are manual administrative controls. Documentation in this repository does not prove that they are enabled. A repository administrator must configure and verify them in GitHub.

## Required `main` protections

- Require a pull request before merging to `main`.
- Require the `Validate public change records / validate` status check.
- Block force pushes.
- Block branch deletion.
- Restrict administrative bypass to genuine emergencies and review every bypass publicly.

## Merge discipline

Use one pull request, one conceptual public change and one squash-merge commit. Prefer or require squash merging for political-record changes. Disable rebase merging where repository settings permit so the association among the record, exact political scope and resulting commit remains deterministic.

The pull request is review context. The immutable `changes/*.md` file merged with the political change is the permanent explanation.

## Verification checklist

After changing repository settings, verify in GitHub that:

1. a direct push to `main` is rejected;
2. the validation workflow is required before merge;
3. force pushes and branch deletion are blocked;
4. squash merging is available and rebase merging is disabled;
5. bypass access is limited to the intended administrators.
